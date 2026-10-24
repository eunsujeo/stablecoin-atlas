import { decodeFunctionResult, encodeFunctionData, keccak256, parseAbiItem, type AbiFunction, type Hex } from 'viem';
import { canonicalCloneTarget, inspectProxy } from '../evm/proxy.js';
import type { ReviewConfig, ReviewReport } from './model.js';
import { ReviewRpc } from './rpc.js';

// Explicit getter ABI allowlist. Merely writing `view` in untrusted input grants no call authority.
const getters: Record<string, string> = Object.fromEntries([
  ...['owner', 'pendingOwner', 'admin', 'masterMinter', 'blacklister', 'pauser', 'feeRecipient'].map(n => [`${n}()`, 'address']),
  ...['totalSupply', 'cap', 'maxSupply', 'fee', 'feeBps'].map(n => [`${n}()`, 'uint256']), ['decimals()', 'uint8'],
  ['paused()', 'bool'], ['getRoleAdmin(bytes32)', 'bytes32'], ['hasRole(bytes32,address)', 'bool'],
  ...['isMinter', 'isBlacklisted', 'blacklisted', 'whitelisted', 'allowlisted'].map(n => [`${n}(address)`, 'bool']),
  ['minterAllowance(address)', 'uint256'], ['minters(address)', 'uint256'],
]);
export function prepareProbe(probe: NonNullable<ReviewConfig['probes']>[number]): { abi: AbiFunction; data: Hex } {
  const item = parseAbiItem(probe.signature);
  if (item.type !== 'function' || !['view', 'pure'].includes(item.stateMutability)) throw new Error('READ_ONLY_GETTER_REQUIRED');
  const signature = `${item.name}(${item.inputs.map(i => i.type).join(',')})`;
  const output = getters[signature];
  if (!output || item.outputs.length !== 1 || item.outputs[0]?.type !== output) throw new Error('UNSUPPORTED_GETTER');
  if (probe.args.length !== item.inputs.length) throw new Error('INVALID_GETTER_ARGUMENTS');
  const args = item.inputs.map((input, i) => {
    const value = probe.args[i];
    if (/^uint/.test(input.type)) {
      if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('DECIMAL_STRING_REQUIRED');
      return BigInt(value);
    }
    return value;
  });
  return { abi: item, data: encodeFunctionData({ abi: [item], functionName: item.name, args }) };
}
export async function collect(config: ReviewConfig, report: ReviewReport, rpc: ReviewRpc): Promise<void> {
  const expected = BigInt(config.network.chainId);
  const chain = await rpc.request<Hex>('eth_chainId');
  if (BigInt(chain) !== expected) throw new Error('CHAIN_ID_MISMATCH');
  const blockNumber = config.network.blockNumber === undefined ? await rpc.request<Hex>('eth_blockNumber') : `0x${BigInt(config.network.blockNumber).toString(16)}`;
  const block = await rpc.request<{ number: Hex; hash: Hex }>('eth_getBlockByNumber', [blockNumber, false]);
  if (BigInt(block.number) !== BigInt(blockNumber)) throw new Error('BLOCK_NUMBER_MISMATCH');
  report.block.number = BigInt(block.number).toString(); report.block.hash = block.hash;
  rpc.block = report.block.number; rpc.pinHash(block.hash);
  rpc.record('REVIEW_BLOCK', { chainId: config.network.chainId, ...report.block, mode: 'EIP1898_REQUIRE_CANONICAL' });
  const getCode = async (address: string): Promise<string> => {
    const code = await rpc.request<Hex>('eth_getCode', [address, blockNumber]);
    if (code === '0x') throw new Error('NO_CONTRACT_CODE');
    const ev = rpc.record('CONTRACT_CODE', { address, code, runtimeHash: keccak256(code) });
    report.contracts.push({ address, runtimeHash: keccak256(code), evidenceRef: ev.id });
    return code;
  };
  const code = await getCode(config.token.address);
  const clone = canonicalCloneTarget(code); if (clone) rpc.allow(clone);
  report.proxy = await inspectProxy(rpc, config.token.address as Hex, code, blockNumber as Hex);
  const addresses = new Set(config.dependencies ?? []);
  for (const field of [report.proxy.implementationAddress, report.proxy.beaconAddress]) if (field.status === 'KNOWN') addresses.add(field.value);
  for (const address of addresses) {
    if (report.contracts.some(c => c.address === address)) continue;
    rpc.allow(address);
    try { await getCode(address); }
    catch { report.failures.push({ stage: 'dependency', code: 'DEPENDENCY_CODE_UNAVAILABLE', evidenceRefs: rpc.evidence.slice(-1).map(e => e.id) }); }
  }
  const proxyEvidence = rpc.evidence.findLast(e => e.kind === 'PROXY_OBSERVATION');
  report.findings.push({ id: 'proxy-pointer', rule: 'proxy-pointer-v1', scope: 'CHAIN', categories: ['CURRENT_STATE'],
    confirmation: report.proxy.resolution === 'RESOLVED' ? 'CONFIRMED' : 'UNKNOWN',
    summary: `${report.proxy.pattern}: 슬롯/포인터와 대상 코드 관측입니다. 실제 위임 실행·업그레이드 권한·비프록시 여부는 증명하지 않습니다.`, evidenceRefs: proxyEvidence ? [proxyEvidence.id] : [] });
  for (const probe of config.probes ?? []) {
    try {
      if (!report.contracts.some(c => c.address === probe.address)) throw new Error('UNOBSERVED_PROBE_TARGET');
      const prepared = prepareProbe(probe);
      const data = await rpc.request<Hex>('eth_call', [{ to: probe.address, data: prepared.data }, blockNumber]);
      const output = prepared.abi.outputs[0]!.type;
      if (data.length !== 66 || output === 'bool' && BigInt(data) > 1n
        || output === 'address' && !/^0x0{24}/i.test(data)
        || /^uint/.test(output) && BigInt(data) >= 2n ** BigInt(output.slice(4))) throw new Error('INVALID_GETTER_RESPONSE');
      const result: unknown = decodeFunctionResult({ abi: [prepared.abi], functionName: prepared.abi.name, data });
      const ev = rpc.record('GETTER_RESULT', { id: probe.id, address: probe.address, signature: probe.signature,
        args: probe.args, result: typeof result === 'bigint' ? result.toString() : result });
      report.findings.push({ id: `getter-${probe.id}`, rule: 'configured-getter-v1', scope: 'CHAIN', categories: ['CURRENT_STATE'], confirmation: 'CONFIRMED',
        summary: `${probe.id}: 설정한 getter의 반환값을 관측했습니다. 이 값만으로 실제 권한 경로·키 보유자·권한 행사를 증명하지 않습니다.`, evidenceRefs: [ev.id] });
    } catch {
      const ev = rpc.record('GETTER_FAILED', { id: probe.id, reason: 'GETTER_NOT_ESTABLISHED' });
      report.failures.push({ stage: `getter:${probe.id}`, code: 'GETTER_NOT_ESTABLISHED', evidenceRefs: [ev.id] });
      report.findings.push({ id: `getter-${probe.id}`, rule: 'configured-getter-v1', scope: 'CHAIN', categories: ['CURRENT_STATE'], confirmation: 'UNKNOWN',
        summary: `${probe.id}: 조회를 확정하지 못했습니다. 함수·권한·기능 부재를 뜻하지 않습니다.`, evidenceRefs: [ev.id] });
    }
  }
}
export async function recheck(config: ReviewConfig, report: ReviewReport, rpc: ReviewRpc): Promise<void> {
  if (!report.block.number || !report.block.hash) return;
  const block = await rpc.request<{ number: Hex; hash: Hex }>('eth_getBlockByNumber', [`0x${BigInt(report.block.number).toString(16)}`, false]);
  const chain = await rpc.request<Hex>('eth_chainId');
  if (BigInt(chain) !== BigInt(config.network.chainId) || BigInt(block.number) !== BigInt(report.block.number)
    || block.hash.toLowerCase() !== report.block.hash.toLowerCase()) throw new Error('CHAIN_REFERENCE_CHANGED');
  report.block.consistency = 'HASH_PINNED_RECHECKED';
}
