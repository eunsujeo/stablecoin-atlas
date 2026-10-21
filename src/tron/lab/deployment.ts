import { generateMnemonic, english, mnemonicToAccount } from 'viem/accounts';
import { decodeFunctionResult, encodeAbiParameters, type Hex } from 'viem';
import { setTimeout as delay } from 'node:timers/promises';
import { compileTronFixture, compileTronAllowanceProbe, tronAllowanceProbes, sha256, type TronAllowanceProbe, type TronFixture } from './compiler.js';
import { runPrivateTvmSmoke, tvmGenesis, type PrivateFixtureSession } from './runtime.js';
import { decimal } from './lossless.js';
import { tronAddress } from '../address.js';
import { feeLimit, originEnergyLimit, expectedContract, encodeSignedDeployment, prepareDeploymentTransaction, signVerifiedDeployment } from './transaction.js';
const check = (ok: unknown, code = 'FIXTURE_OBSERVATION_MISMATCH') => { if (!ok) throw new Error(code); };
export const initialSupply = 2n ** 128n;
function header(input: any) {
  const n = decimal(input.block_header?.raw_data?.number ?? (input.blockID?.startsWith('0000000000000000') ? '0' : undefined));
  check(typeof input.blockID === 'string' && /^[a-f0-9]{64}$/i.test(input.blockID)
    && BigInt('0x' + input.blockID.slice(0, 16)) === n, 'FIXTURE_INVALID_BLOCK');
  return { number: n.toString(), id: input.blockID.toLowerCase(), timestamp: String(decimal(input.block_header.raw_data.timestamp ?? (n === 0n ? '0' : undefined))) };
}
export async function waitForDeploymentReceipt(session: PrivateFixtureSession, txid: string,
  clock = { now: Date.now, pause: (ms: number) => delay(ms) as Promise<unknown> }, timeoutMs = 60000) {
  const deadline = clock.now() + timeoutMs;
  while (clock.now() < deadline) {
    const receipt = await session.request('receipt', { value: txid });
    if (receipt.id !== undefined) { check(receipt.id === txid, 'FIXTURE_RECEIPT_MISMATCH'); return receipt; }
    await clock.pause(250);
  }
  throw new Error('FIXTURE_RECEIPT_TIMEOUT');
}
export function verifyDeploymentReceipt(receipt: any, block: any, txid: string, contractHex: string) {
  check(receipt.id === txid && receipt.receipt?.result === 'SUCCESS'
    && (receipt.result === undefined || receipt.result === 'SUCESS')
    && receipt.contract_address?.toLowerCase() === contractHex, 'FIXTURE_DEPLOY_FAILED');
  const included = header(block);
  check(included.number === receipt.blockNumber && Array.isArray(block.transactions)
    && block.transactions.some((t: any) => t.txID === txid && t.ret?.[0]?.contractRet === 'SUCCESS'), 'FIXTURE_INCLUSION_MISMATCH');
  return { txId: txid, executionResult: 'SUCCESS', blockNumber: included.number, blockId: included.id,
    ...(receipt.fee === undefined ? {} : { feeSun: String(decimal(receipt.fee)) }),
    ...(receipt.receipt.energy_usage_total === undefined ? {} : { energyUsageTotal: String(decimal(receipt.receipt.energy_usage_total)) }) };
}
export async function resolveFixtureReference(session: PrivateFixtureSession, unsigned: any) {
  const tail = unsigned.raw_data?.ref_block_bytes;
  check(typeof tail === 'string' && /^[a-f0-9]{4}$/.test(tail), 'FIXTURE_INVALID_BLOCK');
  const reference = header(await session.request('block', { num: parseInt(tail, 16) }));
  check(decimal(reference.number) < 65536n && (reference.number === '0' ? reference.id === tvmGenesis
    : BigInt(Date.now()) - decimal(reference.timestamp) < 60000n), 'FIXTURE_INVALID_BLOCK');
  return reference;
}
export async function deployPrivateTronFixture(signal?: AbortSignal, exercise = false, boundary = false, probe?: TronFixture) {
  if (boundary) exercise = true;
  check(probe === undefined || !exercise, 'FIXTURE_MODE_MISMATCH');
  return deployCompiledFixture(await compileTronFixture(probe ?? 'standard'), signal, exercise, boundary, probe);
}
export async function deployPrivateTronAllowanceFixture(variant: TronAllowanceProbe, operation: 'approve' | 'transferFrom', signal?: AbortSignal) {
  check(Object.hasOwn(tronAllowanceProbes,variant), 'FIXTURE_VARIANT_REJECTED');
  const spec=tronAllowanceProbes[variant];
  check(['approve','transferFrom'].includes(operation) && (spec.operation === 'both' || spec.operation === operation), 'FIXTURE_ALLOWANCE_OPERATION_MISMATCH');
  return deployCompiledFixture(await compileTronAllowanceProbe(variant),signal,false,false,undefined,{variant,operation});
}
async function deployCompiledFixture(compiled: Awaited<ReturnType<typeof compileTronFixture>>, signal?: AbortSignal, exercise = false, boundary = false, probe?: TronFixture, allowancePlan?: {variant: TronAllowanceProbe; operation: 'approve' | 'transferFrom'}) {
  const mnemonic = generateMnemonic(english, 256), ownerAccount = mnemonicToAccount(mnemonic, { path: "m/44'/60'/0'/0/0" });
  const privateKey = ('0x' + Buffer.from(ownerAccount.getHdKey().privateKey!).toString('hex')) as Hex;
  const owner = tronAddress('41' + ownerAccount.address.slice(2));
  const evidence: Record<string, any> = { owner: owner.base58, stage: 'STARTUP', stateResponseBlock: 'UNKNOWN',
    limitations: ['Latest getter response blocks remain UNKNOWN; no Mainnet/finality/safety verification.', ...(exercise || probe || allowancePlan ? [] : ['No transfer/approve/transferFrom execution.'])] };
  const work = async (session: PrivateFixtureSession): Promise<Record<string, unknown>> => {
    const account = await session.request('account', { address: owner.hex, visible: false });
    check(account.address?.toLowerCase() === owner.hex && decimal(account.balance) >= BigInt(feeLimit), 'FIXTURE_ACCOUNT_NOT_READY');
    evidence.accountFunded = true; evidence.stage = 'BUILD_TRANSACTION';
    const request = { owner_address: owner.hex, name: compiled.build.contractName, abi: JSON.stringify(compiled.abi),
      bytecode: compiled.bytecode, fee_limit: feeLimit, call_value: '0', consume_user_resource_percent: '100', origin_energy_limit: originEnergyLimit, visible: false };
    const response = await session.request('deploy', request);
    check(response.txID && response.raw_data && response.raw_data_hex, 'FIXTURE_BUILD_REJECTED');
    let unsigned = response;
    evidence.stage = 'VALIDATE_TRANSACTION';
    const reference = await resolveFixtureReference(session, unsigned);
    const policy = { contractName: compiled.build.contractName, owner: owner.hex, bytecode: compiled.bytecode, abi: compiled.abi, block: reference, now: String(Date.now()) };
    evidence.stage = 'SIGN_TRANSACTION';
    unsigned = prepareDeploymentTransaction(unsigned, policy);
    const signed = await signVerifiedDeployment(unsigned, { ...policy, now: String(Date.now()) }, privateKey);
    const txid = unsigned.txID as string, contract = expectedContract(owner.hex, txid);
    evidence.txId = txid; evidence.contract = contract.base58; evidence.stage = 'BROADCAST';
    const accepted = await session.request('broadcast', { transaction: encodeSignedDeployment(signed, { ...policy, now: String(Date.now()) }) });
    evidence.broadcastCode = typeof accepted.code === 'string' && /^[A-Z_]+$/.test(accepted.code) ? accepted.code : 'UNKNOWN';
    check(accepted.result === true && (accepted.txid === undefined || accepted.txid === txid), 'FIXTURE_BROADCAST_REJECTED');
    evidence.broadcastAccepted = true; evidence.stage = 'WAIT_RECEIPT';
    const receipt = await waitForDeploymentReceipt(session, txid);
    const blockNumber = decimal(receipt.blockNumber);
    check(blockNumber <= BigInt(Number.MAX_SAFE_INTEGER), 'FIXTURE_INVALID_BLOCK');
    const block = await session.request('block', { num: Number(blockNumber) });
    evidence.receipt = verifyDeploymentReceipt(receipt, block, txid, contract.hex);
    evidence.stage = 'VERIFY_CODE';
    const deployed = await session.request('contract', { value: contract.hex, visible: false });
    check(deployed.runtimecode?.toLowerCase() === compiled.runtimeBytecode.toLowerCase(), 'FIXTURE_RUNTIME_CODE_MISMATCH');
    if (allowancePlan) evidence.allowanceRuntimeCode = { bytecode: deployed.runtimecode.toLowerCase(), sha256: sha256(Buffer.from(deployed.runtimecode,'hex')) };
    evidence.runtimeCodeMatchesBuild = true; evidence.stage = 'INITIAL_STATE';
    const read = async (name: string, signature: string, parameter = '') => {
      const response = await session.request('constant', { owner_address: owner.hex, contract_address: contract.hex,
        function_selector: signature, parameter, visible: false });
      check(response.result?.result === true && Array.isArray(response.constant_result) && response.constant_result.length === 1,
        'FIXTURE_CONSTANT_FAILED');
      return decodeFunctionResult({ abi: compiled.abi, functionName: name, data: ('0x' + response.constant_result[0]) as Hex });
    };
    const name = await read('name', 'name()'), symbol = await read('symbol', 'symbol()'), decimals = await read('decimals', 'decimals()');
    const totalSupply = await read('totalSupply', 'totalSupply()');
    const balance = await read('balanceOf', 'balanceOf(address)', encodeAbiParameters([{ type: 'address' }], [owner.rpc]).slice(2));
    const allowance = await read('allowance', 'allowance(address,address)', encodeAbiParameters([{ type: 'address' }, { type: 'address' }], [owner.rpc, owner.rpc]).slice(2));
    check(name === 'Private TVM Fixture' && symbol === 'TVMF' && decimals === 6 && totalSupply === initialSupply && balance === initialSupply && allowance === 0n);
    evidence.initialState = { name, symbol, decimals, totalSupply: String(totalSupply), ownerBalance: String(balance), ownerSelfAllowance: String(allowance), observedBlockOrSlot: 'UNKNOWN' };
    evidence.stage = 'VERIFIED_DEPLOYMENT_AND_INITIAL_STATE';
    if (exercise || probe || allowancePlan) {
      const actors = [0, 1, 2].map(index => {
        const account = mnemonicToAccount(mnemonic, { path: `m/44'/60'/0'/0/${index}` });
        return { address: tronAddress('41' + account.address.slice(2)),
          privateKey: ('0x' + Buffer.from(account.getHdKey().privateKey!).toString('hex')) as Hex };
      });
      evidence.actors = { owner: actors[0]!.address.base58, recipient: actors[1]!.address.base58, spender: actors[2]!.address.base58 };
      evidence.scenarioVersion = '1.0.0'; evidence.scenarioProfile = allowancePlan ? 'ALLOWANCE_PROBE' : probe ? 'TRANSFER_PROBE' : boundary ? 'BOUNDARY' : 'NORMAL';
      if (allowancePlan) {
        evidence.stage = 'ALLOWANCE_PROBE'; evidence.allowanceProbe = { variant: allowancePlan.variant, operation: allowancePlan.operation, outcome: 'ERROR', stage: 'BUILD' };
        const { runAllowanceScenario } = await import('./allowance-scenarios.js');
        await runAllowanceScenario(session, contract.hex, compiled.abi, actors, allowancePlan.variant, allowancePlan.operation, evidence.allowanceProbe);
        evidence.stage = 'VERIFIED_ALLOWANCE_PROBE';
      } else if (probe) {
        evidence.stage = 'TRANSFER_PROBE'; evidence.probe = { variant: probe, outcome: 'ERROR', stage: 'BUILD' };
        const { runTransferProbe } = await import('./negative.js');
        await runTransferProbe(session, contract.hex, compiled.abi, actors, probe, evidence.probe);
        evidence.stage = 'VERIFIED_TRANSFER_PROBE';
      } else {
        evidence.stage = 'EXERCISE_TOKEN'; evidence.scenarios = [];
        const { runTokenScenarios } = await import('./scenarios.js');
        await runTokenScenarios(session, contract.hex, compiled.abi, actors, evidence.scenarios, boundary);
        evidence.stage = 'VERIFIED_TOKEN_SCENARIOS';
      }
    }
    return evidence;
  };
  const runtime = await runPrivateTvmSmoke(undefined, { ...(signal ? { signal } : {}), fixture: { exercise, boundary, probe: probe !== undefined, ...(allowancePlan ? { allowance: true } : {}), mnemonic, work: async session => {
    try { return await work(session); }
    catch (error) { const code = error instanceof Error ? error.message : '';
      evidence.failure = /^(?:FIXTURE_[A-Z_]+|UNSAFE_DEPLOY_[A-Z_]+|UNSAFE_CALL_[A-Z_]+|INVALID_INTEGER)$/.test(code) ? code : 'FIXTURE_CHECK_FAILED'; throw error; }
  } } });
  return structuredClone({ schemaVersion: '1.0' as const, kind: allowancePlan ? 'TRON_PRIVATE_TVM_ALLOWANCE_PROBE' : probe ? 'TRON_PRIVATE_TVM_TRANSFER_PROBE' : boundary ? 'TRON_PRIVATE_TVM_TOKEN_BOUNDARIES' : exercise ? 'TRON_PRIVATE_TVM_TOKEN_SCENARIOS' : 'TRON_PRIVATE_TVM_FIXTURE_DEPLOYMENT', outcome: runtime.outcome === 'READY' && evidence.stage === (allowancePlan ? 'VERIFIED_ALLOWANCE_PROBE' : probe ? 'VERIFIED_TRANSFER_PROBE' : exercise ? 'VERIFIED_TOKEN_SCENARIOS' : 'VERIFIED_DEPLOYMENT_AND_INITIAL_STATE') ? 'OBSERVED' : 'ERROR',
    ...(allowancePlan ? { runtimeOwnership: runtime.outcome === 'READY' ? 'OBSERVED_OWNED_ISOLATED_RUNTIME' : 'UNKNOWN' } : {}), build: compiled.build, evidence, runtime });
}
