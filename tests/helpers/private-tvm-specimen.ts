import { encodeFunctionData, parseAbi, encodeAbiParameters, toEventSelector } from 'viem';
import { tronAddress } from '../../src/tron/address.js';
import { compilerPin, tronFixtures, type TronFixture } from '../../src/tron/lab/compiler.js';
import { tvmGenesis, tvmImage } from '../../src/tron/lab/runtime.js';
const hash = (n: number) => n.toString(16).padStart(64, '0');
const owner = tronAddress('41' + '11'.repeat(20)), recipient = tronAddress('41' + '22'.repeat(20)), spender = tronAddress('41' + '33'.repeat(20)), contract = tronAddress('41' + '44'.repeat(20));
const supply = 2n ** 128n, amount = 2n ** 64n + 123n;
export function privateTvmSpecimen(variant: TronFixture = 'standard', index = 1): any {
  const kind = 'TRON_PRIVATE_TVM_TRANSFER_PROBE', id = '00000000-0000-0000-0000-' + String(index).padStart(12, '0');
  const before = { owner: supply.toString(), recipient: '0', spender: '0', allowance: '0', totalSupply: supply.toString() };
  const after = { ...before, owner: (supply - amount).toString(), recipient: amount.toString() };
  const calldata = encodeFunctionData({ abi: parseAbi(['function transfer(address,uint256) returns (bool)']), functionName: 'transfer', args: [recipient.rpc, amount] }).slice(2);
  const execution = { txId: hash(index + 10), transaction: { type: 'TriggerSmartContract', owner: owner.base58, contract: contract.base58, calldata, rawDataSha256: hash(index + 10) }, executionResult: 'SUCCESS', blockNumber: '3', blockId: '0000000000000003' + 'ab'.repeat(24), feeSun: '1', energyUsageTotal: '1' };
  const log = { address: contract.hex.slice(2), topics: [toEventSelector('Transfer(address,address,uint256)').slice(2), '0'.repeat(24) + owner.hex.slice(2), '0'.repeat(24) + recipient.hex.slice(2)], data: encodeAbiParameters([{ type: 'uint256' }], [amount]).slice(2) };
  const expected = variant === 'standard' ? 'NONE' : variant === 'missing-event' ? 'FIXTURE_CALL_LOG_MISMATCH' : 'FIXTURE_CALL_RETURN_MISMATCH';
  const observation = { fixtureExpectation: variant === 'standard' ? 'PASS' : 'FAIL', fixtureVerdict: variant === 'standard' ? 'PASS' : 'FAIL', validatorRegression: variant === 'standard' ? 'NORMAL_ACCEPTANCE_OBSERVED' : 'EXPECTED_REJECTION_OBSERVED', expectedError: expected, actualError: expected, execution,
    contractResult: [variant === 'false-return' ? '0'.repeat(64) : variant === 'malformed-return' ? '0'.repeat(63) + '2' : '0'.repeat(63) + '1'], logs: variant === 'missing-event' ? [] : [log], before, after, stateResponseBlock: 'UNKNOWN', limitation: 'Synthetic test specimen; not execution evidence.' };
  const probe = { variant, outcome: 'OBSERVED', stage: 'VERIFIED', before, after, amount: amount.toString(), builderAccepted: true, txId: execution.txId, observation };
  const evidence = { owner: owner.base58, stage: 'VERIFIED_TRANSFER_PROBE', stateResponseBlock: 'UNKNOWN', limitations: ['Synthetic test specimen; not execution evidence.'], accountFunded: true, txId: hash(index), contract: contract.base58, broadcastCode: 'SUCCESS', broadcastAccepted: true,
    receipt: { txId: hash(index), executionResult: 'SUCCESS', blockNumber: '2', blockId: '0000000000000002' + 'ab'.repeat(24) }, runtimeCodeMatchesBuild: true,
    initialState: { name: 'Private TVM Fixture', symbol: 'TVMF', decimals: 6, totalSupply: supply.toString(), ownerBalance: supply.toString(), ownerSelfAllowance: '0', observedBlockOrSlot: 'UNKNOWN' },
    actors: { owner: owner.base58, recipient: recipient.base58, spender: spender.base58 }, scenarioVersion: '1.0.0', scenarioProfile: 'TRANSFER_PROBE', probe };
  const runtime = { schemaVersion: '1.0', kind, runId: id, image: tvmImage, startedAt: '2026-10-20T00:00:00.000Z', completedAt: '2026-10-20T00:00:10.000Z', outcome: 'READY',
    observations: { requestedAccountCount: '3', accountGenerationVerified: false, probe: { sourceSha256: hash(2), classSha256: hash(3), compiler: 'javac 21.0.9' }, imageId: 'sha256:' + hash(4), codeVersion: '4.8.2', peerCount: '0', genesis: { number: '0', id: tvmGenesis }, headBefore: { number: '0', id: tvmGenesis }, headAfter: { number: '1', id: '0000000000000001' + 'ab'.repeat(24) }, internalNetwork: true, hostPublishedPorts: '0', containerLoopbackProbe: true,
      resourceSample: { cpuPercent: '1%', memory: '1MiB / 2GiB', memoryPercent: '1%', sampleKind: 'SINGLE_DOCKER_STATS_OBSERVATION' }, fixture: structuredClone(evidence) },
    resources: { container: 'mca-tvm-' + id, network: 'mca-tvm-' + id + '-net', containerId: hash(index + 100), networkId: hash(index + 200) }, cleanup: { container: 'REMOVED', network: 'REMOVED' }, limitations: ['Synthetic test specimen; not execution evidence.'] };
  return { schemaVersion: '1.0', kind, outcome: 'OBSERVED', build: { ...compilerPin, ...tronFixtures[variant], variant, abiSha256: hash(5), reportedVersion: compilerPin.version, sourceSha256: variant === 'standard' ? hash(6) : hash(7), settings: { optimizer: { enabled: false, runs: 200 }, evmVersion: 'istanbul', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } }, bytecodeSha256: hash(8), runtimeBytecodeSha256: hash(9) }, evidence, runtime };
}
export const syncEvidence = (r: any) => { if (r.runtime.observations.fixture) r.runtime.observations.fixture = structuredClone(r.evidence); };
export function privateTvmSuite(): any { return { schemaVersion: '1.0', kind: 'TRON_PRIVATE_TVM_NEGATIVE_FIXTURES', outcome: 'OBSERVED', cases: (['standard', 'false-return', 'malformed-return', 'missing-event'] as const).map((v, i) => ({ variant: v, outcome: 'OBSERVED', report: privateTvmSpecimen(v, i + 1) })), limitations: ['Synthetic test specimen; not execution evidence.'] }; }
export function scenarioSpecimen(boundary = false): any {
  const r = privateTvmSpecimen(); r.kind = r.runtime.kind = boundary ? 'TRON_PRIVATE_TVM_TOKEN_BOUNDARIES' : 'TRON_PRIVATE_TVM_TOKEN_SCENARIOS';
  const e = r.evidence; const first = e.probe.before; delete e.probe;
  e.stage = 'VERIFIED_TOKEN_SCENARIOS'; e.scenarioProfile = boundary ? 'BOUNDARY' : 'NORMAL';
  const approved = 2n ** 63n + 111n;
  const plans: Array<[string, string, bigint | 'balance', boolean?, string?]> = [
    ['transfer', 'transfer', amount], ['approve', 'approve', approved], ['transferFrom', 'transferFrom', approved],
    ...(boundary ? [
      ['zero-transfer', 'transfer', 0n], ['zero-transferFrom-without-allowance', 'transferFrom', 0n, false, 'ZERO_WITHOUT_ALLOWANCE'],
      ['insufficient-balance-transfer', 'transfer', 'balance', true, 'BALANCE'], ['approve-for-allowance-boundary', 'approve', 1n],
      ['insufficient-allowance-transferFrom', 'transferFrom', 2n, true, 'ALLOWANCE'], ['approve-above-balance', 'approve', 'balance'],
      ['insufficient-balance-transferFrom', 'transferFrom', 'balance', true, 'BALANCE_WITH_ALLOWANCE'], ['revoke-after-boundaries', 'approve', 0n],
    ] : [
      ['approve-for-revocation', 'approve', approved], ['revoke', 'approve', 0n], ['unapproved-transferFrom', 'transferFrom', 1n, true, 'UNAPPROVED'],
    ]) as Array<[string, string, bigint | 'balance', boolean?, string?]>,
  ];
  let before = structuredClone(first);
  e.scenarios = plans.map(([id, method, value, reverted, precondition], index) => {
    const n = value === 'balance' ? BigInt(before.owner) + 1n : value, after = structuredClone(before);
    if (!reverted) {
      if (method !== 'approve') { after.owner = (BigInt(before.owner) - n).toString(); after.recipient = (BigInt(before.recipient) + n).toString(); }
      if (method === 'approve') after.allowance = n.toString();
      if (method === 'transferFrom') after.allowance = (BigInt(before.allowance) - n).toString();
    }
    const from = method === 'transferFrom', target = method === 'approve' ? spender : recipient;
    const args = from ? [owner.rpc, recipient.rpc, n] : [target.rpc, n];
    const calldata = encodeFunctionData({ abi: parseAbi(['function transfer(address,uint256) returns (bool)', 'function approve(address,uint256) returns (bool)', 'function transferFrom(address,address,uint256) returns (bool)']) as import('viem').Abi, functionName: method, args }).slice(2);
    const tx = hash(500 + index), result = reverted ? 'REVERT' : 'SUCCESS';
    const name = method === 'approve' ? 'Approval' : 'Transfer';
    const receipt: any = { txId: tx, transaction: { type: 'TriggerSmartContract', owner: from ? spender.base58 : owner.base58, contract: contract.base58, calldata, rawDataSha256: tx }, executionResult: result, blockNumber: String(index + 3), blockId: (index + 3).toString(16).padStart(16, '0') + 'ab'.repeat(24), returnValue: reverted ? 'NOT_APPLICABLE' : true };
    if (!reverted) receipt.event = { name, first: owner.base58, second: target.base58, amount: n.toString(), emitter: contract.base58, logIndex: '0', topics: [toEventSelector(`${name}(address,address,uint256)`).slice(2), '0'.repeat(24) + owner.hex.slice(2), '0'.repeat(24) + target.hex.slice(2)], data: encodeAbiParameters([{ type: 'uint256' }], [n]).slice(2) };
    const c = { id, outcome: 'OBSERVED', stage: 'VERIFIED', amount: n.toString(), caller: from ? spender.base58 : owner.base58, before, after, txId: tx, receipt, builderAccepted: true, stateResponseBlock: 'UNKNOWN', expectedExecutionResult: result, ...(precondition ? { precondition, preconditionVerified: true } : {}), ...(value === 'balance' ? { amountRule: 'OWNER_BALANCE_PLUS_ONE' } : {}) };
    before = structuredClone(after); return c;
  }); syncEvidence(r); return r;
}
export function earlyErrorSpecimen(): any {
  const r = privateTvmSpecimen(); r.outcome = 'ERROR'; r.runtime.outcome = 'ERROR'; r.runtime.failure = 'INTERRUPTED'; r.runtime.observations = {};
  r.runtime.cleanup = { container: 'NOT_CREATED', network: 'NOT_CREATED' }; delete r.runtime.resources.containerId; delete r.runtime.resources.networkId;
  r.evidence = { owner: owner.base58, stage: 'STARTUP', stateResponseBlock: 'UNKNOWN', limitations: ['Synthetic interrupted run.'] }; return r;
}
