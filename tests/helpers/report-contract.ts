import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import { json, summarize } from '../../src/domain/evaluator.js';
import type { AssessmentReport } from '../../src/domain/model.js';

const ajv = new Ajv({ strict: true, allErrors: true });
export const reportSchema = JSON.parse(readFileSync(new URL('../../schemas/assessment-report.v1.schema.json', import.meta.url), 'utf8'));
const labSchema = JSON.parse(readFileSync(new URL('../../schemas/lab-report.v1.schema.json', import.meta.url), 'utf8'));
ajv.addSchema(reportSchema);
export const validateReportShape = ajv.getSchema(reportSchema.$id)!;
const validateLabShape = ajv.compile(labSchema);

// Apply to the wire representation, after bigint serialization.
export function assertReportContract(input: unknown): asserts input is AssessmentReport {
  assert(validateReportShape(input), ajv.errorsText(validateReportShape.errors));
  const report = input as AssessmentReport;
  const evidence = new Map(report.evidence.map(e => [e.id, e]));
  assert.equal(evidence.size, report.evidence.length, 'Duplicate evidence ID');
  const keys = new Set<string>();
  for (const result of report.results) {
    const key = JSON.stringify([result.scenarioId, result.capability]);
    assert(!keys.has(key), 'Duplicate scenario/capability pair'); keys.add(key);
    assert.equal(result.assessmentId, report.assessmentId, 'Assessment ID mismatch');
    assert.deepEqual(result.assetIdentity, report.assetIdentity, 'Identity mismatch');
    for (const ref of result.evidenceReferences) assert(evidence.has(ref), 'Dangling evidence reference');
    if (result.verdict === 'PASS' || result.verdict === 'FAIL') {
      assert(result.evidenceReferences.some(ref => evidence.get(ref)?.provenance === 'OBSERVED'), 'Missing observed evidence');
    }
    assert(Date.parse(result.completedAt) >= Date.parse(result.startedAt), 'Scenario time order');
  }
  assert(Date.parse(report.completedAt) >= Date.parse(report.startedAt), 'Assessment time order');
  const sorted = (values: AssessmentReport['capabilitySummary']) => values.map(v => ({ ...v, verdicts: [...v.verdicts].sort() }))
    .sort((a, b) => a.capability.localeCompare(b.capability));
  assert.deepEqual(sorted(report.capabilitySummary), sorted(summarize(report)), 'Capability summary mismatch');
}
export function assertSerializedReport(report: AssessmentReport): void {
  assertReportContract(JSON.parse(json(report)));
}
export function assertLabContract(input: unknown): void {
  assert(validateLabShape(input), ajv.errorsText(validateLabShape.errors));
  const lab = input as { profile: string; environment: { chainId: string }; assessments: { report: AssessmentReport }[] };
  for (const { report } of lab.assessments) {
    assertReportContract(report);
    assert.equal(report.mode, 'SIMULATION');
    assert.equal(report.profile, lab.profile);
    assert.equal(report.assetIdentity.networkId, lab.environment.chainId);
  }
}
