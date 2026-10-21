import { deployPrivateTronFixture } from './deployment.js';
import type { TronFixture } from './compiler.js';
const variants: TronFixture[] = ['standard', 'false-return', 'malformed-return', 'missing-event'];
export async function runNegativeFixtureSuite(signal?: AbortSignal, run = deployPrivateTronFixture) {
  const cases = variants.map(variant => ({ variant, outcome: 'NOT_TESTED', report: undefined as Awaited<ReturnType<typeof run>> | undefined }));
  let outcome = 'OBSERVED';
  for (const item of cases) {
    if (signal?.aborted) { outcome = 'ERROR'; break; }
    item.outcome = 'ERROR';
    try {
      item.report = await run(signal, false, false, item.variant);
      const observation = item.report.evidence.probe?.observation;
      const expectedVerdict = item.variant === 'standard' ? 'PASS' : 'FAIL';
      const expectedRegression = item.variant === 'standard' ? 'NORMAL_ACCEPTANCE_OBSERVED' : 'EXPECTED_REJECTION_OBSERVED';
      if (item.report.outcome !== 'OBSERVED' || observation?.fixtureVerdict !== expectedVerdict || observation?.validatorRegression !== expectedRegression) { outcome = 'ERROR'; break; }
      item.outcome = 'OBSERVED';
    } catch { outcome = 'ERROR'; break; }
  }
  return { schemaVersion: '1.0' as const, kind: 'TRON_PRIVATE_TVM_NEGATIVE_FIXTURES', outcome, cases,
    limitations: ['Defined private transfer expectations only; not AssessmentReport verdicts, Mainnet compatibility or asset safety.', 'Getter response blocks remain UNKNOWN. Each probe uses a separately owned, fresh isolated runtime.'] };
}
