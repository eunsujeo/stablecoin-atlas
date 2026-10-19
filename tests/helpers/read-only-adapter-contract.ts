import assert from 'node:assert/strict';
import type { ReadOnlyAdapter, ReadOnlyAssessmentRequest } from '../../src/domain/adapter.js';
import type { AssessmentReport } from '../../src/domain/model.js';
import { assertSerializedReport } from './report-contract.js';

// Chain harnesses provide addresses, expected observations, and invalid requests.
// This helper imposes no token methods, signing, or chain-specific RPC vocabulary.
export async function verifyReadOnlyAdapterContract(input: {
  adapter: ReadOnlyAdapter;
  requests: readonly ReadOnlyAssessmentRequest[];
  invalidRequests: readonly ReadOnlyAssessmentRequest[];
  unexecuted: readonly { scenarioId: string; capability: string }[];
  verifyObservation(report: AssessmentReport, index: number): void;
}): Promise<AssessmentReport[]> {
  const reports = await Promise.all(input.requests.map(request => input.adapter.assessReadOnly(request)));
  assert.equal(new Set(reports.map(r => r.assessmentId)).size, reports.length, 'Request IDs must be independent');
  for (const [index, report] of reports.entries()) {
    assertSerializedReport(report);
    assert.equal(report.mode, 'READ_ONLY');
    assert.equal(report.assetIdentity.chainFamily, input.adapter.chainFamily);
    assert.equal(report.assetIdentity.networkId, input.requests[index]!.networkId);
    assert.equal(report.assetIdentity.issuerVerificationStatus, 'UNKNOWN');
    for (const key of input.unexecuted) {
      const result = report.results.find(r => r.scenarioId === key.scenarioId && r.capability === key.capability);
      assert(result, 'Expected unexecuted scenario');
      assert.equal(result.verdict, 'NOT_TESTED');
      assert.equal(result.executionStatus, 'NOT_EXECUTED');
      assert.equal(result.support, 'UNKNOWN');
    }
    input.verifyObservation(report, index);
    for (const other of reports) if (report !== other) {
      assert.notEqual(report.evidence, other.evidence);
      assert.notEqual(report.results, other.results);
    }
  }
  for (const request of input.invalidRequests) await assert.rejects(input.adapter.assessReadOnly(request));
  // A rejected request must not poison the same adapter's next successful report.
  const recovered = await input.adapter.assessReadOnly(input.requests[0]!);
  assertSerializedReport(recovered);
  input.verifyObservation(recovered, 0);
  return reports;
}
