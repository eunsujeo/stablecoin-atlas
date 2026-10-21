import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import { json } from '../../src/domain/evaluator.js';
import { validateAssessmentReportText } from '../../src/report-contract.js';
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
  const result = validateAssessmentReportText(JSON.stringify(input));
  assert(result.valid, JSON.stringify(result));
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
