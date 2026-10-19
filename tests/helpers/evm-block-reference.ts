import assert from 'node:assert/strict';
import type { AssessmentReport } from '../../src/domain/model.js';

// EVM-specific assertions stay outside the chain-neutral report/adapter helpers.
export function assertEvmBlockReferences(report: AssessmentReport): void {
  assert.equal(report.assetIdentity.chainFamily, 'EVM');
  let references = 0;
  for (const [index, evidence] of report.evidence.entries()) {
    if (evidence.kind !== 'BLOCK_REFERENCE') continue;
    references++;
    const reference = evidence.data as { number: string; hash: string };
    assert.match(reference.number, /^(0|[1-9][0-9]*)$/);
    assert.match(reference.hash, /^0x[0-9a-fA-F]{64}$/);
    assert.equal(evidence.observedBlockOrSlot, reference.number);
    const preceding = report.evidence[index - 1]; assert(preceding && preceding.kind === 'RPC');
    const raw = preceding.data as { method: string; params: unknown[]; result: { number: string; hash: string } };
    assert.equal(raw.method, 'eth_getBlockByNumber');
    assert.equal(BigInt(raw.params[0] as string).toString(), reference.number);
    assert.equal(BigInt(raw.result.number).toString(), reference.number);
    assert.equal(raw.result.hash, reference.hash);
  }
  assert(references > 0, 'New EVM assessment must contain a validated block reference');
  assert(report.evidence.some(e => e.kind === 'BLOCK_REFERENCE' && e.observedBlockOrSlot === report.assetIdentity.observedBlockOrSlot));
  assert.deepEqual(report.capabilitySummary.find(s => s.capability === 'FINALITY'), {
    capability: 'FINALITY', support: 'UNKNOWN', verdicts: ['NOT_TESTED'],
  });
}
