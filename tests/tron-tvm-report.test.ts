import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validatePrivateTvmReport as validate, serializePrivateTvmReport, savePrivateTvmReport } from '../src/tron/lab/report-contract.js';
import { privateTvmSpecimen, privateTvmSuite, syncEvidence, scenarioSpecimen, earlyErrorSpecimen } from './helpers/private-tvm-specimen.js';
test('private TVM v1 accepts separate report families, deliberate negative FAIL, canonical amounts and valid partial ERROR', () => {
  for (const r of [privateTvmSpecimen(), privateTvmSuite(), scenarioSpecimen(), scenarioSpecimen(true), earlyErrorSpecimen()]) {
    assert(validate(r).valid, r.kind); assert(validate(JSON.parse(serializePrivateTvmReport(r))).valid);
  }
  const deploy = privateTvmSpecimen(); deploy.kind = deploy.runtime.kind = 'TRON_PRIVATE_TVM_FIXTURE_DEPLOYMENT';
  delete deploy.evidence.probe; delete deploy.evidence.scenarioVersion; delete deploy.evidence.scenarioProfile; deploy.evidence.stage = 'VERIFIED_DEPLOYMENT_AND_INITIAL_STATE'; syncEvidence(deploy); assert(validate(deploy).valid);
  const smoke = structuredClone(deploy.runtime); smoke.kind = 'TRON_PRIVATE_TVM_RUNTIME_SMOKE'; delete smoke.observations.fixture; assert(validate(smoke).valid);
  const cleanup = privateTvmSpecimen(); cleanup.outcome = 'ERROR'; cleanup.runtime.outcome = 'ERROR'; cleanup.runtime.failure = 'CLEANUP_FAILED'; cleanup.runtime.cleanup = { container: 'FAILED', network: 'RETAINED' }; assert(validate(cleanup).valid);
});
test('private TVM v1 rejects missing/contradictory execution evidence, lossy amounts, secret fields and unknown enum/version', () => {
  const mutations: Array<(r: any) => void> = [
    r => { delete r.schemaVersion; }, r => { r.schemaVersion = '2.0'; }, r => { r.kind = 'ASSESSMENT'; },
    r => { r.rpcUrl = 'SECRET_CANARY'; }, r => { r.evidence.privateKey = 'SECRET_CANARY'; },
    r => { r.evidence.initialState.totalSupply = 9007199254740992; }, r => { r.evidence.initialState.ownerBalance = '1e18'; },
    r => { r.evidence.probe.amount = (2n ** 256n).toString(); }, r => { r.evidence.probe.observation.after.owner = '1'; },
    r => { r.evidence.probe.observation.logs = []; }, r => { r.evidence.probe.observation.contractResult = ['0'.repeat(64)]; },
    r => { r.evidence.probe.observation.fixtureVerdict = 'FAIL'; }, r => { r.evidence.probe.observation.actualError = 'FIXTURE_CALL_LOG_MISMATCH'; },
    r => { r.evidence.probe.observation.execution.blockId = '0'.repeat(64); },
    r => { r.evidence.probe.observation.execution.transaction.rawDataSha256 = '0'.repeat(64); },
    r => { r.evidence.probe.observation.execution.transaction.owner = r.evidence.actors.recipient; },
    r => { r.evidence.probe.observation.execution.transaction.calldata += '00'; },
    r => { r.evidence.runtimeCodeMatchesBuild = false; }, r => { delete r.evidence.receipt; },
    r => { r.evidence.initialState.observedBlockOrSlot = '2'; }, r => { r.build.contractName = 'TronFalseReturnToken'; },
    r => { r.runtime.kind = 'TRON_PRIVATE_TVM_TOKEN_SCENARIOS'; }, r => { r.runtime.cleanup.container = 'FAILED'; },
    r => { r.runtime.observations.peerCount = '1'; }, r => { r.runtime.observations.hostPublishedPorts = '1'; },
    r => { r.runtime.observations.headAfter = r.runtime.observations.headBefore; }, r => { delete r.runtime.observations.fixture; },
  ];
  for (const mutate of mutations) { const r = privateTvmSpecimen(); mutate(r); syncEvidence(r); assert(!validate(r).valid); }
  const duplicate = privateTvmSpecimen(); duplicate.runtime.observations.fixture.stage = 'WRONG'; assert(!validate(duplicate).valid);
});
test('private TVM scenario contract rejects missing/duplicate cases, wrong logs/calldata/state/baselines and success after an error', () => {
  const mutations: Array<(r: any) => void> = [
    r => { r.evidence.scenarios.pop(); }, r => { r.evidence.scenarios[1] = r.evidence.scenarios[0]; },
    r => { r.evidence.scenarios[0].receipt.event.data = '0'.repeat(64); },
    r => { r.evidence.scenarios[0].receipt.returnValue = false; }, r => { r.evidence.scenarios[0].after.owner = '0'; },
    r => { r.evidence.scenarios[1].before.owner = '0'; }, r => { r.evidence.scenarios[0].outcome = 'ERROR'; r.outcome = 'ERROR'; },
    r => { r.evidence.scenarios[0].amount = 'UNKNOWN'; }, r => { r.evidence.scenarios[0].receipt.feeSun = '18446744073709551616'; },
  ];
  for (const mutate of mutations) { const r = scenarioSpecimen(); mutate(r); syncEvidence(r); assert(!validate(r).valid); }
  const boundary = scenarioSpecimen(true); boundary.evidence.scenarios[9].after.allowance = '0'; syncEvidence(boundary); assert(!validate(boundary).valid);
});
test('private TVM suite contract rejects duplicate/mismatched variants and run IDs, cleanup failure and FAIL/regression confusion', () => {
  for (const mutate of [
    (r: any) => { r.cases[1].variant = 'standard'; }, (r: any) => { r.cases[1].report = r.cases[0].report; },
    (r: any) => { r.cases[1].report.runtime.runId = r.cases[0].report.runtime.runId; },
    (r: any) => { r.cases[1].report.runtime.cleanup.container = 'UNVERIFIED'; },
    (r: any) => { r.cases[1].report.evidence.probe.observation.fixtureVerdict = 'PASS'; syncEvidence(r.cases[1].report); },
  ]) { const r = privateTvmSuite(); mutate(r); assert(!validate(r).valid); }
  const aborted = privateTvmSuite(); aborted.outcome = 'ERROR'; aborted.cases = aborted.cases.map((c: any) => ({ variant: c.variant, outcome: 'NOT_TESTED' })); assert(validate(aborted).valid);
});
test('legacy inspection never inserts version/evidence or silently treats an unversioned report as v1', () => {
  const r = privateTvmSpecimen(); delete r.schemaVersion; delete r.runtime.schemaVersion; const before = JSON.stringify(r);
  assert(!validate(r).valid); assert(validate(r, true).valid); assert.equal(JSON.stringify(r), before);
  assert(!validate(privateTvmSpecimen(), true).valid);
  r.evidence.probe.observation.stateResponseBlock = '3'; syncEvidence(r); assert(!validate(r, true).valid);
});
test('private TVM publication validates before atomic replacement and CLI errors never echo report contents', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mca-tvm-report-test-')), path = join(directory, 'report.json');
  try {
    await writeFile(path, 'prior report'); const invalid = privateTvmSpecimen(); invalid.token = 'SECRET_CANARY';
    await assert.rejects(savePrivateTvmReport(path, invalid), { message: 'PRIVATE_TVM_REPORT_INVALID' }); assert.equal(await readFile(path, 'utf8'), 'prior report');
    await savePrivateTvmReport(path, earlyErrorSpecimen()); assert(validate(JSON.parse(await readFile(path, 'utf8'))).valid);
    const run = promisify(execFile); const okay = await run('node', ['--use-env-proxy', '--import', 'tsx', 'src/tron/lab/report-cli.ts', '--file', path]); assert.equal(JSON.parse(okay.stdout).valid, true);
    await writeFile(path, '{"secret":"SECRET_CANARY"}');
    await assert.rejects(run('node', ['--use-env-proxy', '--import', 'tsx', 'src/tron/lab/report-cli.ts', '--file', path]), (error: any) => { assert(!JSON.stringify({ stdout: error.stdout, stderr: error.stderr }).includes('SECRET_CANARY')); return true; });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('partial execution errors preserve captured state and unexecuted cases without requiring success evidence', () => {
  const r = scenarioSpecimen(); r.outcome = 'ERROR'; r.runtime.outcome = 'ERROR'; r.runtime.failure = 'RUNTIME_CHECK_FAILED'; r.evidence.failure = 'FIXTURE_BASELINE_CHANGED';
  r.evidence.scenarios = r.evidence.scenarios.map((c: any, index: number) => index === 0
    ? { id: c.id, outcome: 'ERROR', stage: 'PRECONDITION', before: { ...c.before, owner: '1' }, amount: c.amount, stateResponseBlock: 'UNKNOWN' }
    : { id: c.id, outcome: 'NOT_TESTED', stage: 'NOT_STARTED', amount: c.amount, expectedExecutionResult: c.expectedExecutionResult });
  syncEvidence(r); assert(validate(r).valid);
  r.evidence.scenarios[0].amount = 'UNKNOWN'; syncEvidence(r); assert(!validate(r).valid);
  const runtimeError = earlyErrorSpecimen().runtime; runtimeError.kind = 'TRON_PRIVATE_TVM_RUNTIME_SMOKE'; assert(validate(runtimeError).valid);
});
