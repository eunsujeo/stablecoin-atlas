import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Ajv } from 'ajv';
import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem';
import { EvmReadOnlyAdapter } from '../../src/evm/adapter.js';
import { TronReadOnlyAdapter } from '../../src/tron/adapter.js';
import { proxySlots, canonicalCloneTarget } from '../../src/evm/proxy.js';
import { tronAddress } from '../../src/tron/address.js';
import { json, summarize } from '../../src/domain/evaluator.js';
import { writeReportAtomically } from '../../src/report-output.js';
import { BoundedReadRpc } from './bounded-read-rpc.js';
import { maxContextBytes, readContextInput, validateServiceAccountContext, validateServiceAccountContextReport } from './service-account-context.js';
type Context = ReturnType<typeof validateServiceAccountContext>;
const abi = parseAbi(['function name() view returns (string)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function totalSupply() view returns (uint256)', 'function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)']);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail = (): never => { throw new Error('Service account read-only run failed; details omitted.'); };
function requestFor(c: Context) {
  return { networkId: c.networkId, assetAddress: c.assetAddress, accountAddress: c.accounts[0]!.address,
    ...(c.queryKind === 'ALLOWANCE' ? { spenderAddress: c.accounts[1]!.address } : {}) };
}
const rpcAddress = (c: Context, value: string) => c.chainFamily === 'TRON' ? tronAddress(value).rpc : value;
function queryCall(c: Context) {
  const fn = c.queryKind === 'BALANCE' ? 'balanceOf' : 'allowance';
  const args = c.accounts.map(a => rpcAddress(c, a.address));
  return { to: rpcAddress(c, c.assetAddress), data: encodeFunctionData({ abi, functionName: fn, args: args as any }) };
}
// Private per-run scope: fixed token and query arguments; proxy code targets may
// only come from same-tag declared pointers or exact canonical clone runtime.
export class ServiceReadRpc extends BoundedReadRpc {
  private readonly context: Context;
  private readonly tags = new Set<string>();
  private readonly codeTargets = new Set<string>();
  private readonly beacons = new Set<string>();
  constructor(url: string, raw: Uint8Array) { super(url); if (!raw.byteLength || raw.byteLength > maxContextBytes) fail(); this.context = validateServiceAccountContext(Buffer.from(raw)); }
  protected override get requestBudget() { return 32; }
  override async request<T>(method: string, params: unknown[] = []): Promise<T> {
    const c = this.context, token = rpcAddress(c, c.assetAddress), tx = params[0] as any;
    const tag = method === 'eth_getStorageAt' ? params[2] : params[1];
    const tagOK = c.chainFamily === 'TRON' ? tag === 'latest' : typeof tag === 'string' && this.tags.has(tag);
    const key = (address: string, block: unknown) => `${String(block)}:${address.toLowerCase()}`;
    let ok = method === 'eth_chainId' && params.length === 0
      || c.chainFamily === 'EVM' && method === 'eth_blockNumber' && params.length === 0
      || method === 'eth_getBlockByNumber' && params.length === 2 && params[1] === false && (c.chainFamily === 'TRON' ? params[0] === 'latest' : this.tags.has(params[0] as string));
    if (method === 'eth_getCode') ok = params.length === 2 && tagOK && typeof params[0] === 'string' && (params[0].toLowerCase() === token.toLowerCase() || this.codeTargets.has(key(params[0], tag)));
    if (method === 'eth_getStorageAt') ok = c.chainFamily === 'EVM' && params.length === 3 && tagOK && params[0] === token && Object.values(proxySlots).includes(params[1] as any);
    if (method === 'eth_call') {
      const metadata = ['name', 'symbol', 'decimals', 'totalSupply'].map(functionName => encodeFunctionData({ abi, functionName } as any));
      const query = queryCall(c), balance = { to: token, data: encodeFunctionData({ abi, functionName: 'balanceOf', args: [rpcAddress(c, c.accounts[0]!.address) as any] }) };
      const tokenCall = tx && Object.keys(tx).sort().join(',') === 'data,to' && tx.to === token && (metadata.includes(tx.data) || tx.data === query.data || c.chainFamily === 'TRON' && c.queryKind === 'ALLOWANCE' && tx.data === balance.data);
      const beaconCall = c.chainFamily === 'EVM' && tx && Object.keys(tx).sort().join(',') === 'data,from,to' && typeof tx.to === 'string'
        && this.beacons.has(key(tx.to, tag)) && tx.data === '0x5c60da1b' && [token, '0x0000000000000000000000000000000000000000'].includes(tx.from);
      ok = params.length === 2 && tagOK && (tokenCall || beaconCall);
    }
    if (!ok) throw new Error('Read-only request outside account scope');
    const result = await this.transmit<T>(method, params);
    if (c.chainFamily === 'EVM') {
      if (method === 'eth_blockNumber' && typeof result === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(result)) this.tags.add(result);
      const pointer = typeof result === 'string' && /^0x0{24}[0-9a-f]{40}$/i.test(result) && !/^0x0{64}$/i.test(result) ? '0x' + result.slice(-40) : null;
      if (method === 'eth_getStorageAt' && pointer && [proxySlots.implementation, proxySlots.legacyImplementation, proxySlots.beacon].includes(params[1] as any)) {
        this.codeTargets.add(key(pointer, tag)); if (params[1] === proxySlots.beacon) this.beacons.add(key(pointer, tag));
      }
      if (method === 'eth_call' && tx.data === '0x5c60da1b' && pointer) this.codeTargets.add(key(pointer, tag));
      if (method === 'eth_getCode' && params[0] === token && typeof result === 'string') { const clone = canonicalCloneTarget(result); if (clone) this.codeTargets.add(key(clone, tag)); }
    }
    return result;
  }
}
type Binding = { request: ReturnType<typeof requestFor>; scenarioId: string | null; capability: string; evidenceReferences: { namespace: string; id: string }[]; readStatus: string; value?: string; queryBlockOrSlot: string; queryBlockHash: string | null; additionalBalanceRead: boolean };
function bindingFor(c: Context, assessment: any, evmAllowanceRead = false): Binding {
  if (evmAllowanceRead && (c.chainFamily !== 'EVM' || c.queryKind !== 'ALLOWANCE')) fail();
  const request = requestFor(c), unsupported = c.chainFamily === 'EVM' && c.queryKind === 'ALLOWANCE' && !evmAllowanceRead;
  if (unsupported) { if (assessment !== null) fail(); return { request, scenarioId: null, capability: 'ALLOWANCE', evidenceReferences: [], readStatus: 'NOT_TESTED', queryBlockOrSlot: 'UNKNOWN', queryBlockHash: null, additionalBalanceRead: false }; }
  const scenarioId = c.chainFamily === 'EVM' ? c.queryKind === 'ALLOWANCE' ? 'ERC20-011' : 'ERC20-000' : c.queryKind === 'BALANCE' ? 'TRC20-000' : 'TRC20-007';
  if (!assessment || assessment.mode !== 'READ_ONLY' || assessment.profile !== 'baseline' || assessment.assetIdentity.chainFamily !== c.chainFamily
    || assessment.assetIdentity.networkId !== c.networkId || assessment.assetIdentity.contractAddress.status !== 'KNOWN' || assessment.assetIdentity.contractAddress.value !== c.assetAddress) fail();
  const token = rpcAddress(c,c.assetAddress), expectedCall = queryCall(c);
  const metadata = ['name','symbol','decimals','totalSupply'].map(functionName => encodeFunctionData({abi,functionName} as any));
  const balanceData = encodeFunctionData({abi,functionName:'balanceOf',args:[rpcAddress(c,c.accounts[0]!.address) as any]});
  const beaconPointers = new Set<string>();
  for (const e of assessment.evidence) {
    if (!['RPC','RPC_ERROR'].includes(e.kind)) continue;
    const d=e.data;
    if (!['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_getStorageAt','eth_call'].includes(d.method)) fail();
    if (c.chainFamily === 'EVM' && e.kind === 'RPC' && d.method === 'eth_getStorageAt' && d.params[0] === token && d.params[1] === proxySlots.beacon && typeof d.result === 'string' && /^0x0{24}[0-9a-f]{40}$/i.test(d.result)) beaconPointers.add(`${d.params[2]}:0x${d.result.slice(-40).toLowerCase()}`);
    if (d.method === 'eth_call') {
      const tx=d.params[0], normal=tx && Object.keys(tx).sort().join(',') === 'data,to' && tx.to === token
        && (metadata.includes(tx.data) || tx.data === expectedCall.data || c.chainFamily === 'TRON' && c.queryKind === 'ALLOWANCE' && tx.data === balanceData);
      const beacon=c.chainFamily === 'EVM' && tx && typeof tx.to === 'string' && beaconPointers.has(`${d.params[1]}:${tx.to.toLowerCase()}`)
        && Object.keys(tx).sort().join(',') === 'data,from,to' && tx.data === '0x5c60da1b' && [token,'0x0000000000000000000000000000000000000000'].includes(tx.from);
      if (d.params.length !== 2 || !(normal || beacon)) fail();
    }
  }
  const ids = new Map<string, any>();
  for (const e of assessment.evidence) { if (ids.has(e.id)) fail(); ids.set(e.id, e); }
  const keys = new Set<string>();
  for (const r of assessment.results) {
    const key = `${r.scenarioId}:${r.capability}`; if (keys.has(key) || r.assessmentId !== assessment.assessmentId || !isDeepStrictEqual(r.assetIdentity, assessment.assetIdentity) || new Set(r.evidenceReferences).size !== r.evidenceReferences.length || r.evidenceReferences.some((id: string) => !ids.has(id))) fail(); keys.add(key);
    const allowed = c.chainFamily === 'EVM' ? ['ERC20-001','EVM-PROXY-001', c.queryKind === 'ALLOWANCE' ? 'ERC20-011' : 'ERC20-000'] : ['TRC20-001','TRC20-000',...(c.queryKind === 'ALLOWANCE' ? ['TRC20-007'] : [])];
    if (!allowed.includes(r.scenarioId) && (r.executionStatus !== 'NOT_EXECUTED' || r.verdict !== 'NOT_TESTED')) fail();
  }
  if (!isDeepStrictEqual(assessment.capabilitySummary, summarize(assessment))) fail();
  const selected = assessment.results.filter((r: any) => r.scenarioId === scenarioId && r.capability === c.queryKind); if (selected.length !== 1) fail(); const scenario = selected[0];
  const refs = scenario.evidenceReferences.map((id: string) => ids.get(id));
  const calls = refs.filter((e: any) => ['RPC','RPC_ERROR'].includes(e.kind) && e.data.method === 'eth_call');
  if (calls.length > 1) fail(); const call = calls[0], expected = queryCall(c);
  if (call && (!isDeepStrictEqual(call.data.params[0], expected) || call.data.params.length !== 2 || (c.chainFamily === 'TRON' ? call.data.params[1] !== 'latest' : !/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(call.data.params[1])))) fail();
  let readStatus = 'READ_FAILED', value: string | undefined;
  if (call?.kind === 'RPC' && !call.data.error) {
    try { if (evmAllowanceRead && (typeof call.data.result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(call.data.result))) throw new Error('Noncanonical allowance word'); const decoded: unknown = decodeFunctionResult({ abi, functionName: c.queryKind === 'BALANCE' ? 'balanceOf' : 'allowance', data: call.data.result }); if (typeof decoded === 'bigint') { value = decoded.toString(); readStatus = 'OK'; } else return fail(); }
    catch { readStatus = 'INVALID_RESPONSE'; }
  }
  if (value !== undefined) {
    const o = scenario.observations;
    if (scenario.executionStatus !== 'COMPLETED' || o[c.queryKind === 'BALANCE' ? 'balance' : 'allowance'] !== value
      || (c.queryKind === 'BALANCE' ? o.holder !== request.accountAddress : o.owner !== request.accountAddress || o.spender !== request.spenderAddress)) fail();
  } else if (Object.hasOwn(scenario.observations, c.queryKind === 'BALANCE' ? 'balance' : 'allowance')) fail();
  if (evmAllowanceRead && (scenario.scenarioVersion !== '1.0.0' || scenario.observations.readStatus !== readStatus || scenario.support !== 'UNKNOWN'
    || scenario.verdict !== (readStatus === 'OK' ? 'PASS' : 'INCONCLUSIVE') || scenario.executionStatus !== (readStatus === 'READ_FAILED' ? 'ERROR' : 'COMPLETED'))) fail();
  const block = c.chainFamily === 'EVM' && call ? BigInt(call.data.params[1]).toString() : 'UNKNOWN';
  let blockHash: string | null = null;
  if (c.chainFamily === 'EVM' && call) {
    if (scenario.observedBlockOrSlot !== block) fail();
    const headers = refs.filter((e: any) => e.kind === 'RPC' && e.data.method === 'eth_getBlockByNumber' && e.data.params[0] === call.data.params[1] && !e.data.error);
    if (headers.length !== 1 || headers[0].data.result?.number !== call.data.params[1] || !/^0x[0-9a-f]{64}$/i.test(headers[0].data.result?.hash)) fail(); blockHash = headers[0].data.result.hash;
  }
  if (c.chainFamily === 'TRON' && (assessment.assetIdentity.observedBlockOrSlot !== 'UNKNOWN' || scenario.observedBlockOrSlot !== 'UNKNOWN')) fail();
  return { request, scenarioId, capability: c.queryKind, evidenceReferences: scenario.evidenceReferences.map((id: string) => ({ namespace: 'assessment', id })), readStatus,
    ...(value === undefined ? {} : { value }), queryBlockOrSlot: block, queryBlockHash: blockHash, additionalBalanceRead: c.chainFamily === 'TRON' && c.queryKind === 'ALLOWANCE' };
}
export async function runServiceAccountReadOnly(input: Uint8Array, endpoints: { evm?: string | undefined; tron?: string | undefined }, options: { evmAllowance?: boolean } = {}) {
  if (!input.byteLength || input.byteLength > maxContextBytes) fail(); const raw = Buffer.from(input), startedAt = new Date().toISOString();
  const context = validateServiceAccountContext(raw); validateServiceAccountContextReport(context, raw);
  const evmAllowanceRead = options.evmAllowance === true;
  if (evmAllowanceRead && (context.chainFamily !== 'EVM' || context.queryKind !== 'ALLOWANCE')) fail();
  const unsupported = context.chainFamily === 'EVM' && context.queryKind === 'ALLOWANCE' && !evmAllowanceRead; let assessment: any = null;
  if (!unsupported) {
    const endpoint = context.chainFamily === 'EVM' ? endpoints.evm : endpoints.tron; if (!endpoint) return fail();
    const factory = (url: string) => new ServiceReadRpc(url, raw), request = requestFor(context);
    const result = context.chainFamily === 'EVM' ? await new EvmReadOnlyAdapter(endpoint, factory).assessReadOnly(request) : await new TronReadOnlyAdapter(endpoint, factory).assessReadOnly(request);
    assessment = JSON.parse(json(result));
  }
  const binding = bindingFor(context, assessment, evmAllowanceRead);
  return { schemaVersion: '1.0', kind: 'SERVICE_ACCOUNT_READ_ONLY_RUN_NOT_APPROVAL', ...(evmAllowanceRead ? { evmAllowanceRead: true as const } : {}), contextValidation: context, contextSha256: hash(context), assessment, assessmentSha256: assessment === null ? null : hash(assessment), snapshotHashEncoding: 'SHA256_JSON_STRINGIFY_UTF8',
    binding, stage: unsupported ? 'NOT_IMPLEMENTED' : binding.readStatus === 'OK' ? 'OBSERVED' : binding.readStatus,
    requestCount: assessment?.evidence.filter((e: any) => ['RPC','RPC_ERROR'].includes(e.kind)).length ?? 0, requestLimit: 32,
    authorityState: 'UNKNOWN', ownership: 'UNKNOWN', serviceAccountIdentity: 'UNKNOWN', support: 'UNKNOWN', verdict: 'INCONCLUSIVE', behaviorExecution: 'NOT_TESTED', startedAt, completedAt: new Date().toISOString(),
    limitations: ['Explicit read-only execution from original input bytes; local validation is not an admission token or account authentication.',
      'Nested Assessment uses its own evidence namespace and original scenario verdicts; root INCONCLUSIVE/UNKNOWN is separate.',
      'EVM identity and balance may use different numeric blocks; only the selected query tag/header is linked in binding.',
      'TRON latest/head observations do not establish the exact getter state block; it remains UNKNOWN.',
      evmAllowanceRead ? 'Explicit EVM allowance getter only; no approve/transferFrom/revocation or balance substitution.' : 'TRON allowance also reads owner balance. EVM allowance without explicit opt-in makes zero RPC requests.',
      'Each request is bounded to 10 seconds/1MiB, total32 requests, single endpoint and no redirects; no retries/fallback/signing/writes.',
      'Provider headers/numeric tags are not atomic hash pinning, independent verification or finality.'] };
}
const ajv = new Ajv({ strict: true });
ajv.addSchema(JSON.parse(readFileSync(new URL('../../schemas/assessment-report.v1.schema.json', import.meta.url), 'utf8')));
const schema = JSON.parse(readFileSync(new URL('../../schemas/service-account-readonly.v1.schema.json', import.meta.url), 'utf8'));
const check = ajv.compile(schema);
export function validateServiceAccountRun(report: unknown, raw: Uint8Array) {
  if (!check(report)) fail(); const p = report as Awaited<ReturnType<typeof runServiceAccountReadOnly>>; validateServiceAccountContextReport(p.contextValidation, raw);
  const binding = bindingFor(p.contextValidation, p.assessment, p.evmAllowanceRead === true), stage = p.assessment === null ? 'NOT_IMPLEMENTED' : binding.readStatus === 'OK' ? 'OBSERVED' : binding.readStatus;
  if (!isDeepStrictEqual(binding,p.binding) || p.stage !== stage || p.contextSha256 !== hash(p.contextValidation) || p.assessmentSha256 !== (p.assessment === null ? null : hash(p.assessment))
    || p.requestCount !== (p.assessment?.evidence.filter((e: any) => ['RPC','RPC_ERROR'].includes(e.kind)).length ?? 0)
    || !Number.isFinite(Date.parse(p.startedAt)) || !Number.isFinite(Date.parse(p.completedAt)) || Date.parse(p.startedAt) > Date.parse(p.contextValidation.validatedAt) || Date.parse(p.completedAt) < Date.parse(p.contextValidation.validatedAt)) fail();
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { values } = parseArgs({ options: { input: { type: 'string' }, out: { type: 'string' }, 'evm-allowance': { type: 'boolean' } }, strict: true });
    if (!values.input || !values.out) return fail(); const raw = await readContextInput(values.input, values.out);
    // Validate before reading the selected chain's environment configuration.
    const context = validateServiceAccountContext(raw);
    const endpoints = context.chainFamily === 'EVM' ? { evm: process.env.RPC_URL } : { tron: process.env.TRON_RPC_URL };
    const report = await runServiceAccountReadOnly(raw, endpoints, { evmAllowance: values['evm-allowance'] ?? false }); validateServiceAccountRun(report,raw);
    if (!['OBSERVED','NOT_IMPLEMENTED'].includes(report.stage)) return fail();
    await writeReportAtomically(values.out, json(report));
    process.stderr.write(`Service account read-only: ${report.stage}; ${report.requestCount} requests.\n`); if (report.stage === 'NOT_IMPLEMENTED') process.exitCode = 2;
  })().catch(() => { process.stderr.write('Service account read-only run failed; details omitted.\n'); process.exitCode = 1; });
}
