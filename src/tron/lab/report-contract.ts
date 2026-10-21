import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import { decodeFunctionData, encodeFunctionData, parseAbi } from 'viem';
import { isDeepStrictEqual } from 'node:util';
import { tronAddress } from '../address.js';
import { compilerPin, tronFixtures } from './compiler.js';
import { tvmGenesis, tvmImage } from './runtime.js';
import { verifyTokenEvent, verifyTokenPrecondition, verifyTokenTransition } from './call-evidence.js';
import { writeReportAtomically } from '../../report-output.js';
const schema = JSON.parse(readFileSync(new URL('../../../schemas/private-tvm-report.v1.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ strict: true, allErrors: false });
// Legacy inspection has its own shape, without inserting fields into old evidence.
const legacySchema = structuredClone(schema); delete legacySchema.$id;
for (const name of ['runtime', 'fixtureReport', 'suite']) legacySchema.definitions[name].required = legacySchema.definitions[name].required.filter((x: string) => x !== 'schemaVersion');
legacySchema.definitions.build.required = legacySchema.definitions.build.required.filter((x: string) => !['sourceFile', 'contractName', 'variant', 'abiSha256'].includes(x));
const shape = ajv.compile(schema), legacyShape = ajv.compile(legacySchema);
const check = (ok: unknown) => { if (!ok) throw Error('PRIVATE_TVM_REPORT_INVALID'); };
const equal = (a: unknown, b: unknown) => check(isDeepStrictEqual(a, b));
const decimal = (v: unknown) => { check(typeof v === 'string' && /^(0|[1-9][0-9]*)$/.test(v as string)); return BigInt(v as string); };
const uint256 = new Set(['amount', 'ownerBalance', 'ownerSelfAllowance', 'totalSupply']);
const uint64 = new Set(['number', 'blockNumber', 'feeSun', 'energyUsageTotal', 'elapsedMs', 'headObservationMs', 'memoryLimitBytes', 'pidsLimit', 'peerCount', 'hostPublishedPorts']);
const abi = parseAbi(['function transfer(address,uint256) returns (bool)', 'function approve(address,uint256) returns (bool)', 'function transferFrom(address,address,uint256) returns (bool)']);
const normalIds = ['transfer', 'approve', 'transferFrom', 'approve-for-revocation', 'revoke', 'unapproved-transferFrom'];
const boundaryIds = ['transfer', 'approve', 'transferFrom', 'zero-transfer', 'zero-transferFrom-without-allowance', 'insufficient-balance-transfer', 'approve-for-allowance-boundary', 'insufficient-allowance-transferFrom', 'approve-above-balance', 'insufficient-balance-transferFrom', 'revoke-after-boundaries'];
const variants = ['standard', 'false-return', 'malformed-return', 'missing-event'];
function ranges(value: any, key = '') {
  if (value === null || typeof value !== 'object') {
    if (uint256.has(key) && value !== 'UNKNOWN') check(decimal(value) < 2n ** 256n);
    if (uint64.has(key)) check(decimal(value) < 2n ** 64n);
    return;
  }
  if (value.amount === 'UNKNOWN') equal(value.outcome, 'NOT_TESTED');
  for (const [k, v] of Object.entries(value)) ranges(v, k);
}
function sample(value: any) { for (const k of ['owner', 'recipient', 'spender', 'allowance', 'totalSupply']) check(decimal(value[k]) < 2n ** 256n); }
function block(number: string, id: string) { check(BigInt('0x' + id.slice(0, 16)) === decimal(number)); }
function receipt(r: any, e: any, caller?: string) {
  block(r.blockNumber, r.blockId);
  if (r.transaction) {
    equal(r.txId, r.transaction.rawDataSha256); equal(r.transaction.contract, e.contract);
    if (caller) equal(r.transaction.owner, caller);
    tronAddress(r.transaction.owner); tronAddress(r.transaction.contract);
  }
}
function runtime(r: any) {
  const start = Date.parse(r.startedAt), end = Date.parse(r.completedAt);
  check(Number.isFinite(start) && Number.isFinite(end) && end >= start);
  equal(new Date(start).toISOString(), r.startedAt); equal(new Date(end).toISOString(), r.completedAt);
  equal(r.resources.container, 'mca-tvm-' + r.runId); equal(r.resources.network, r.resources.container + '-net');
  for (const k of ['genesis', 'headBefore', 'headAfter']) if (r.observations[k]) block(r.observations[k].number, r.observations[k].id);
  if (r.kind === 'TRON_PRIVATE_TVM_RUNTIME_SMOKE') check(!r.observations.fixture);
  if (r.outcome === 'READY') {
    check(r.failure === undefined); equal(r.image, tvmImage);
    equal(r.cleanup, { container: 'REMOVED', network: 'REMOVED' });
    check(r.resources.containerId && r.resources.networkId);
    const o = r.observations; equal(o.genesis, { number: '0', id: tvmGenesis });
    check(o.headBefore && o.headAfter && decimal(o.headAfter.number) > decimal(o.headBefore.number));
    equal(o.peerCount, '0'); equal(o.hostPublishedPorts, '0');
    check(o.internalNetwork === true && o.containerLoopbackProbe === true);
    equal(o.codeVersion, '4.8.2'); check(o.probe && o.imageId && o.resourceSample);
  } else check(typeof r.failure === 'string');
}
function call(r: any, e: any, id: string, probe = false) {
  check(r.transaction); receipt(r, e, probe ? e.actors.owner : undefined);
  const decoded = decodeFunctionData({ abi, data: ('0x' + r.transaction.calldata) as `0x${string}` });
  const method = decoded.functionName, args = decoded.args!;
  equal(encodeFunctionData({ abi, functionName: method, args }).slice(2), r.transaction.calldata);
  const from = method === 'transferFrom';
  if (probe) equal(method, 'transfer');
  else equal(method, id.includes('transferFrom') ? 'transferFrom' : id.includes('approve') || id.includes('revoke') ? 'approve' : 'transfer');
  equal(r.transaction.owner, from ? e.actors.spender : e.actors.owner);
  if (from) equal(String(args[0]).toLowerCase(), tronAddress(e.actors.owner).rpc);
  equal(String(args[from ? 1 : 0]).toLowerCase(), tronAddress(method === 'approve' ? e.actors.spender : e.actors.recipient).rpc);
  return { method, amount: args[args.length - 1] as bigint };
}
function event(r: any, e: any, method: string, amount: bigint) {
  check(r.event && r.returnValue === true);
  const expected = { name: method === 'approve' ? 'Approval' as const : 'Transfer' as const, first: e.actors.owner, second: method === 'approve' ? e.actors.spender : e.actors.recipient, amount };
  equal(r.event.name, expected.name); equal(r.event.first, expected.first); equal(r.event.second, expected.second); equal(r.event.amount, amount.toString()); equal(r.event.emitter, e.contract);
  verifyTokenEvent({ log: [{ address: tronAddress(r.event.emitter).hex.slice(2), topics: r.event.topics, data: r.event.data }] }, e.contract, expected);
}
function scenarios(e: any, boundary: boolean, observed: boolean, legacy: boolean) {
  if (!e.scenarios) { check(!observed); return; }
  if (e.scenarios.length === 0) { check(!observed); return; }
  const ids = boundary ? boundaryIds : normalIds; equal(e.scenarios.map((c: any) => c.id), ids);
  let stopped = false, previous: any, lastBlock = decimal(e.receipt?.blockNumber ?? '0');
  for (const c of e.scenarios) {
    if (c.amount === 'UNKNOWN') equal(c.outcome, 'NOT_TESTED');
    if (c.outcome === 'NOT_TESTED') {
      check(!observed); equal(c.stage, 'NOT_STARTED'); check(!c.txId && !c.receipt && !c.before && !c.after); stopped = true; continue;
    }
    check(!stopped);
    if (c.before) { sample(c.before); if (previous && c.outcome === 'OBSERVED') equal(c.before, previous); }
    if (c.after) sample(c.after);
    if (c.receipt) { receipt(c.receipt, e, c.caller); equal(c.receipt.txId, c.txId); }
    if (c.outcome === 'ERROR') { check(!observed); stopped = true; continue; }
    equal(c.stage, 'VERIFIED'); check(c.before && c.after && c.receipt && c.builderAccepted === true && c.stateResponseBlock === 'UNKNOWN');
    equal(c.txId, c.receipt.txId);
    const decoded = call(c.receipt, e, c.id); equal(decoded.amount, decimal(c.amount));
    check(decimal(c.receipt.blockNumber) > lastBlock); lastBlock = decimal(c.receipt.blockNumber);
    const fixed: Record<string, bigint> = { transfer: 2n ** 64n + 123n, approve: 2n ** 63n + 111n, transferFrom: 2n ** 63n + 111n, 'approve-for-revocation': 2n ** 63n + 111n, 'approve-for-allowance-boundary': 1n, 'insufficient-allowance-transferFrom': 2n, 'unapproved-transferFrom': 1n };
    if (fixed[c.id] !== undefined) equal(decoded.amount, fixed[c.id]);
    const reverted = c.id.startsWith('insufficient-') || c.id === 'unapproved-transferFrom';
    equal(c.receipt.executionResult, reverted ? 'REVERT' : 'SUCCESS');
    if (!legacy || c.expectedExecutionResult !== undefined) equal(c.expectedExecutionResult, c.receipt.executionResult);
    const pre = c.id === 'unapproved-transferFrom' ? 'UNAPPROVED' : c.id === 'zero-transferFrom-without-allowance' ? 'ZERO_WITHOUT_ALLOWANCE'
      : c.id === 'insufficient-balance-transfer' ? 'BALANCE' : c.id === 'insufficient-allowance-transferFrom' ? 'ALLOWANCE' : c.id === 'insufficient-balance-transferFrom' ? 'BALANCE_WITH_ALLOWANCE' : undefined;
    if (pre) { equal(c.precondition, pre); check(c.preconditionVerified === true); verifyTokenPrecondition(c.before, pre, decoded.amount); }
    if (c.id.includes('balance') && c.id !== 'approve-for-allowance-boundary') equal(decoded.amount, decimal(c.before.owner) + 1n);
    if (c.id.startsWith('zero-') || c.id.startsWith('revoke')) equal(decoded.amount, 0n);
    if (reverted) { equal(c.receipt.returnValue, 'NOT_APPLICABLE'); check(!c.receipt.event); }
    else event(c.receipt, e, decoded.method, decoded.amount);
    verifyTokenTransition(c.before, c.after, reverted ? 'REVERT' : decoded.method, decoded.amount);
    previous = c.after;
  }
  if (observed) check(e.scenarios.every((c: any) => c.outcome === 'OBSERVED'));
}
function probe(e: any, variant: string, observed: boolean) {
  const p = e.probe; if (!p) { check(!observed); return; }
  equal(p.variant, variant);
  if (p.before) sample(p.before); if (p.after) sample(p.after);
  if (p.outcome !== 'OBSERVED') { check(!observed); return; }
  equal(p.stage, 'VERIFIED'); check(p.builderAccepted === true && p.before && p.after && p.observation);
  const o = p.observation, r = o.execution; equal(o.before, p.before); equal(o.after, p.after); equal(o.stateResponseBlock, 'UNKNOWN');
  equal(p.txId, r.txId); equal(r.executionResult, 'SUCCESS'); check(decimal(r.blockNumber) > decimal(e.receipt.blockNumber));
  const decoded = call(r, e, '', true); equal(decoded.amount, decimal(p.amount)); equal(decoded.amount, 2n ** 64n + 123n);
  verifyTokenTransition(o.before, o.after, 'transfer', decoded.amount);
  const expected = variant === 'standard' ? 'NONE' : variant === 'missing-event' ? 'FIXTURE_CALL_LOG_MISMATCH' : 'FIXTURE_CALL_RETURN_MISMATCH';
  equal(o.expectedError, expected); equal(o.actualError, expected);
  equal(o.fixtureExpectation, variant === 'standard' ? 'PASS' : 'FAIL'); equal(o.fixtureVerdict, o.fixtureExpectation);
  equal(o.validatorRegression, variant === 'standard' ? 'NORMAL_ACCEPTANCE_OBSERVED' : 'EXPECTED_REJECTION_OBSERVED');
  equal(o.contractResult, [variant === 'false-return' ? '0'.repeat(64) : variant === 'malformed-return' ? '0'.repeat(63) + '2' : '0'.repeat(63) + '1']);
  if (variant === 'missing-event') equal(o.logs, []);
  else verifyTokenEvent({ log: o.logs }, e.contract, { name: 'Transfer', first: e.actors.owner, second: e.actors.recipient, amount: decoded.amount });
}
function fixture(r: any, legacy: boolean) {
  if (legacy) check(r.schemaVersion === undefined && r.runtime.schemaVersion === undefined);
  runtime(r.runtime); equal(r.kind, r.runtime.kind);
  const e = r.evidence, observed = r.outcome === 'OBSERVED', build = r.build;
  tronAddress(e.owner); if (e.contract) tronAddress(e.contract);
  if (r.runtime.observations.fixture) equal(e, r.runtime.observations.fixture);
  const variant = build.variant ?? (legacy ? e.probe?.variant : undefined);
  if (variant) {
    const selection = tronFixtures[variant as keyof typeof tronFixtures]; check(selection);
    if (!legacy || build.sourceFile !== undefined) equal(build.sourceFile, selection.sourceFile);
    if (!legacy || build.contractName !== undefined) equal(build.contractName, selection.contractName);
  }
  equal(build.file, compilerPin.file); check(build.reportedVersion === compilerPin.version || build.reportedVersion.startsWith(compilerPin.version + '.'));
  equal(build.version, compilerPin.version); equal(build.sha256, compilerPin.sha256); equal(build.manifestCommit, compilerPin.manifestCommit);
  if (e.receipt) { receipt(e.receipt, e); equal(e.receipt.txId, e.txId); equal(e.receipt.executionResult, 'SUCCESS'); }
  if (e.actors) { equal(e.actors.owner, e.owner); check(new Set(Object.values(e.actors)).size === 3); for (const a of Object.values(e.actors)) check(tronAddress(a as string).hex !== '41' + '0'.repeat(40)); }
  if (observed) {
    equal(r.runtime.outcome, 'READY'); check(r.runtime.observations.fixture); check(e.receipt && e.accountFunded === true && e.broadcastAccepted === true && e.runtimeCodeMatchesBuild === true && e.initialState);
    equal(e.initialState.totalSupply, (2n ** 128n).toString()); equal(e.initialState.ownerBalance, e.initialState.totalSupply); equal(e.initialState.ownerSelfAllowance, '0');
    equal(e.initialState.name, 'Private TVM Fixture'); equal(e.initialState.symbol, 'TVMF'); equal(e.initialState.decimals, 6);
  }
  if (e.scenarios || e.probe) equal(e.scenarioVersion, '1.0.0');
  if (r.kind === 'TRON_PRIVATE_TVM_FIXTURE_DEPLOYMENT') { if (observed) equal(e.stage, 'VERIFIED_DEPLOYMENT_AND_INITIAL_STATE'); check(!e.scenarios && !e.probe); }
  else if (r.kind === 'TRON_PRIVATE_TVM_TRANSFER_PROBE') { if (observed) { equal(e.stage, 'VERIFIED_TRANSFER_PROBE'); check(e.actors); } if (observed || e.probe || e.scenarioProfile !== undefined) equal(e.scenarioProfile, 'TRANSFER_PROBE'); probe(e, variant, observed); }
  else {
    const boundary = r.kind === 'TRON_PRIVATE_TVM_TOKEN_BOUNDARIES';
    if (observed) { equal(e.stage, 'VERIFIED_TOKEN_SCENARIOS'); check(e.actors); }
    if (variant) equal(variant, 'standard');
    if (e.scenarios && (!legacy || e.scenarioProfile)) equal(e.scenarioProfile, boundary ? 'BOUNDARY' : 'NORMAL');
    scenarios(e, boundary, observed, legacy);
  }
}
function inspect(input: any, legacy: boolean) {
  if (legacy) check(input.schemaVersion === undefined);
  ranges(input);
  if (input.kind === 'TRON_PRIVATE_TVM_RUNTIME_SMOKE') return runtime(input);
  if (input.kind !== 'TRON_PRIVATE_TVM_NEGATIVE_FIXTURES') return fixture(input, legacy);
  equal(input.cases.map((c: any) => c.variant), variants);
  let stopped = false; const runs = new Set<string>(); const resourceIds = new Set<string>(); const sources = new Map<string, string>();
  for (const c of input.cases) {
    if (c.outcome === 'NOT_TESTED') { check(input.outcome === 'ERROR' && !c.report); stopped = true; continue; }
    check(!stopped);
    if (c.report) {
      fixture(c.report, legacy); equal(c.report.kind, 'TRON_PRIVATE_TVM_TRANSFER_PROBE');
      equal(c.report.evidence.probe?.variant ?? c.report.build.variant, c.variant);
      check(!runs.has(c.report.runtime.runId)); runs.add(c.report.runtime.runId);
      for (const id of [c.report.runtime.resources.containerId, c.report.runtime.resources.networkId]) if (id) { check(!resourceIds.has(id)); resourceIds.add(id); }
      const b = c.report.build; if (b.sourceFile) { if (sources.has(b.sourceFile)) equal(b.sourceSha256, sources.get(b.sourceFile)); sources.set(b.sourceFile, b.sourceSha256); }
    }
    if (c.outcome === 'OBSERVED') { check(c.report); equal(c.report.outcome, 'OBSERVED'); }
    else { equal(input.outcome, 'ERROR'); stopped = true; }
  }
  if (input.outcome === 'OBSERVED') check(input.cases.every((c: any) => c.outcome === 'OBSERVED'));
}
function legacyGaps(input: any, prefix = ''): string[] {
  if (input.kind === 'TRON_PRIVATE_TVM_NEGATIVE_FIXTURES') return input.cases.flatMap((c: any, i: number) => c.report ? legacyGaps(c.report, `cases[${i}].`) : []);
  if (!input.build) return [];
  const result = ['sourceFile', 'contractName', 'variant', 'abiSha256'].filter(k => input.build[k] === undefined).map(k => prefix + 'build.' + k);
  const e = input.evidence;
  if ((e.scenarios || e.probe) && e.scenarioProfile === undefined) result.push(prefix + 'evidence.scenarioProfile');
  for (const [i, c] of (e.scenarios ?? []).entries()) if (c.outcome === 'OBSERVED' && (c.id === 'unapproved-transferFrom' || c.id.startsWith('insufficient-') || c.id === 'zero-transferFrom-without-allowance') && (!c.precondition || c.preconditionVerified !== true)) result.push(prefix + `evidence.scenarios[${i}].precondition`);
  return result;
}
export function validatePrivateTvmReport(input: unknown, legacy = false): { valid: boolean; mode: 'V1' | 'LEGACY'; limitations: string[]; issue?: 'SHAPE_INVALID' | 'INCONSISTENT_EVIDENCE'; missingLegacyEvidence?: string[] } {
  const base = { mode: legacy ? 'LEGACY' as const : 'V1' as const,
    limitations: ['Stored-summary consistency only; no chain re-execution or authenticity proof.', ...(legacy ? ['Unversioned legacy inspection; no version or missing evidence is inserted.'] : [])] };
  try {
    if (!(legacy ? legacyShape : shape)(input)) return { ...base, valid: false, issue: 'SHAPE_INVALID' };
    const missing = legacy ? { missingLegacyEvidence: legacyGaps(input) } : {};
    try { inspect(input, legacy); return { ...base, ...missing, valid: true }; }
    catch { return { ...base, ...missing, valid: false, issue: 'INCONSISTENT_EVIDENCE' }; }
  } catch { return { ...base, valid: false, issue: 'SHAPE_INVALID' }; }
}
export function serializePrivateTvmReport(input: unknown): string {
  try {
    const text = JSON.stringify(input, null, 2) + '\n'; check(validatePrivateTvmReport(JSON.parse(text)).valid); return text;
  } catch { throw Error('PRIVATE_TVM_REPORT_INVALID'); }
}
export async function savePrivateTvmReport(path: string, input: unknown) { await writeReportAtomically(path, serializePrivateTvmReport(input)); }
