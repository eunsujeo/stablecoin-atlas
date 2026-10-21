import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { capabilities, type AssessmentReport, type Verdict } from '../src/domain/model.js';
import { summarize } from '../src/domain/evaluator.js';
import { assertReportContract, reportSchema, validateReportShape } from './helpers/report-contract.js';

const specimen = () => JSON.parse(readFileSync(new URL('./fixtures/report-v1.json', import.meta.url), 'utf8')) as AssessmentReport;
function sample(verdict: Verdict = 'PASS'): AssessmentReport {
  const r = specimen();
  r.evidence = [{ id: 'e1', kind: 'SYNTHETIC_TEST', provenance: 'OBSERVED', observedAt: r.startedAt, observedBlockOrSlot: '1', data: {} }];
  r.results = [{ assessmentId: r.assessmentId, assetIdentity: structuredClone(r.assetIdentity), scenarioId: 'CONTRACT-SPECIMEN',
    scenarioVersion: '1.0.0', capability: 'BALANCE', support: 'UNKNOWN', verdict,
    executionStatus: verdict === 'NOT_TESTED' ? 'NOT_EXECUTED' : 'COMPLETED',
    evidenceReferences: verdict === 'NOT_TESTED' ? [] : ['e1'], observedBlockOrSlot: '1',
    startedAt: r.startedAt, completedAt: r.completedAt, limitations: ['Synthetic specimen only.'],
    observations: { balance: '9007199254740993123456' } }];
  r.capabilitySummary = summarize(r);
  return r;
}

test('v1 report compatibility permits scenario revisions, reordered arrays and additive fields', () => {
  assertReportContract(specimen());
  assert.deepEqual(reportSchema.definitions.capability.enum, capabilities);
  const emptyMetadata = sample();
  emptyMetadata.assetIdentity.name = { status: 'KNOWN', value: '' };
  emptyMetadata.assetIdentity.symbol = { status: 'KNOWN', value: '' };
  emptyMetadata.results[0]!.assetIdentity = structuredClone(emptyMetadata.assetIdentity);
  assertReportContract(emptyMetadata); // An observed empty string is not an unknown value.
  const r = sample();
  const proxy = { ...structuredClone(r.results[0]!), scenarioId: 'EVM-PROXY-001', capability: 'UPGRADEABILITY' as const,
    observations: { proxy: { pattern: 'UNKNOWN', futureProbe: { status: 'READ_FAILED' } } } };
  for (const version of ['1.0.0', '1.1.0']) {
    proxy.scenarioVersion = version;
    r.results = [proxy, r.results[0]!];
    r.capabilitySummary = summarize(r).reverse();
    Object.assign(r, { futureReportField: { detail: 'ignored by v1 consumers' } });
    Object.assign(proxy, { futureResultField: true });
    assertReportContract(r);
    r.results.reverse();
    assertReportContract(r);
    r.results = [r.results.find(x => x.capability === 'BALANCE')!];
  }
});

test('v1 schema rejects missing fields, unknown core enums and lossy amount encodings', () => {
  const mutations: ((r: AssessmentReport) => void)[] = [
    r => Object.assign(r, { schemaVersion: '2.0' }),
    r => { Reflect.deleteProperty(r, 'evidence'); },
    r => Object.assign(r.results[0]!, { verdict: 'SAFE' }),
    r => Object.assign(r.results[0]!, { support: 'YES' }),
    r => Object.assign(r.results[0]!, { scenarioVersion: '1' }),
    r => Object.assign(r.results[0]!, { observedBlockOrSlot: 1 }),
    r => Object.assign(r.results[0]!, { evidenceReferences: ['e1', 'e1'] }),
    r => Object.assign(r.results[0]!, { evidenceReferences: [] }),
    r => Object.assign(r.results[0]!, { observedBlockOrSlot: 'UNKNOWN' }),
    r => Object.assign(r.results[0]!, { executionStatus: 'NOT_EXECUTED' }),
    r => Object.assign(r.results[0]!.observations, { balance: 9007199254740992 }),
    r => Object.assign(r.results[0]!.observations, { balance: '1e18' }),
    r => Object.assign(r.results[0]!.observations, { balance: '-1' }),
    r => Object.assign(r.results[0]!.observations, { initialAllowance: '-1' }),
    ...[1, '-1', '1e18'].map(allowance => (r: AssessmentReport) => Object.assign(r.results[0]!.observations, { allowance })),
    r => Object.assign(r.results[0]!.observations, { supplyBeforeNegative: 1 }),
    r => Object.assign(r.results[0]!.observations, { supplyAfterNegative: '1e12' }),
    r => Object.assign(r.results[0]!.observations, { metadata: { totalSupply: { status: 'OK', value: 1 } } }),
    r => Object.assign(r.assetIdentity, { decimals: { status: 'KNOWN', value: 256 } }),
    r => Object.assign(r.assetIdentity, { decimals: { status: 'KNOWN', value: 0, reason: 'ambiguous tag' } }),
    r => Object.assign(r.assetIdentity, { issuer: { status: 'UNKNOWN', value: 'invented', reason: 'unknown' } }),
  ];
  for (const mutate of mutations) {
    const r = sample(); mutate(r);
    assert.equal(validateReportShape(r), false, String(mutate));
  }
  const skipped = sample('NOT_TESTED'); skipped.results[0]!.executionStatus = 'COMPLETED';
  assert.equal(validateReportShape(skipped), false);
});

test('cross-record contract rejects broken evidence, identity, summary and scenario keys', () => {
  const mutations: ((r: AssessmentReport) => void)[] = [
    r => { r.evidence.push(structuredClone(r.evidence[0]!)); },
    r => { r.results[0]!.evidenceReferences = ['missing']; },
    r => { r.evidence[0]!.provenance = 'DOCUMENTED'; },
    r => { r.results[0]!.assessmentId = 'another-assessment'; },
    r => { r.results[0]!.assetIdentity.networkId = 'another-network'; },
    r => { r.results.push(structuredClone(r.results[0]!)); },
    r => { r.capabilitySummary = []; },
    r => { r.completedAt = '2025-01-01T00:00:00Z'; },
    r => { r.results[0]!.completedAt = '2025-01-01T00:00:00Z'; },
  ];
  for (const mutate of mutations) {
    const r = sample(); mutate(r);
    assert.throws(() => assertReportContract(r), String(mutate));
  }
  for (const verdict of ['PASS', 'FAIL'] as const) {
    const r = sample(verdict);
    r.evidence[0]!.provenance = 'DOCUMENTED';
    assert.throws(() => assertReportContract(r), /OBSERVED_EVIDENCE_REQUIRED/);
    r.results[0]!.evidenceReferences = [];
    assert.equal(validateReportShape(r), false);
  }
});

test('support is independent of verdict and repeated scenario IDs use capability keys', () => {
  for (const verdict of ['PASS', 'FAIL', 'INCONCLUSIVE', 'NOT_TESTED'] as const) {
    const r = sample(verdict);
    if (verdict !== 'NOT_TESTED') r.results[0]!.support = 'SUPPORTED';
    r.capabilitySummary = summarize(r); assertReportContract(r);
  }
  const r = sample('INCONCLUSIVE');
  r.results = ['PAUSE', 'BLACKLIST'].map(capability => ({ ...structuredClone(r.results[0]!),
    capability: capability as 'PAUSE' | 'BLACKLIST', scenarioId: 'ERC20-007' }));
  r.capabilitySummary = summarize(r); assertReportContract(r);
});
