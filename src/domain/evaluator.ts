import { capabilities, type AssessmentReport, type Evidence, type ScenarioOutcome } from './model.js';

// A positive condition alone cannot manufacture evidence.
export function evaluate(condition: boolean | undefined, evidence: readonly Evidence[]): 'PASS' | 'FAIL' | 'INCONCLUSIVE' {
  if (condition === undefined || evidence.length === 0 || !evidence.some(e => e.provenance === 'OBSERVED')) return 'INCONCLUSIVE';
  return condition ? 'PASS' : 'FAIL';
}
export function enforceEvidence(outcome: ScenarioOutcome, evidence: readonly Evidence[]): ScenarioOutcome {
  if ((outcome.verdict === 'PASS' || outcome.verdict === 'FAIL') && evaluate(true, evidence) !== 'PASS') {
    return { ...outcome, verdict: 'INCONCLUSIVE', limitations: [...(outcome.limitations ?? []), 'Missing observed evidence.'] };
  }
  return outcome;
}
export function summarize(report: Pick<AssessmentReport, 'results'>): AssessmentReport['capabilitySummary'] {
  return capabilities.map(capability => {
    const results = report.results.filter(r => r.capability === capability);
    return { capability, support: results.some(r => r.support === 'SUPPORTED') ? 'SUPPORTED' :
      results.length && results.every(r => r.support === 'NOT_SUPPORTED') ? 'NOT_SUPPORTED' : 'UNKNOWN',
    verdicts: results.length ? [...new Set(results.map(r => r.verdict))] : ['NOT_TESTED'] };
  });
}
export function toBaseUnits(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error('Decimals must be uint8.');
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) throw new Error('Amount must be a non-negative decimal string.');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error('Amount exceeds decimal precision.');
  return BigInt(whole! + fraction.padEnd(decimals, '0'));
}
export function json(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => typeof item === 'bigint' ? item.toString() : item, 2) + '\n';
}
