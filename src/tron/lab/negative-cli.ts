import { parseArgs } from 'node:util';
import { runNegativeFixtureSuite } from './negative-suite.js';
import { serializePrivateTvmReport } from './report-contract.js';
import { writeReportAtomically } from '../../report-output.js';
const controller = new AbortController(), abort = () => controller.abort();
process.once('SIGINT', abort); process.once('SIGTERM', abort);
try {
  const { values } = parseArgs({ options: { out: { type: 'string' } }, strict: true, allowPositionals: false });
  const report = await runNegativeFixtureSuite(controller.signal), text = serializePrivateTvmReport(report);
  if (values.out) await writeReportAtomically(values.out, text); else process.stdout.write(text);
  process.stderr.write(`Private TRON negative fixtures: ${report.outcome}; observed ${report.cases.filter(c => c.outcome === 'OBSERVED').length}/${report.cases.length}\n`);
  process.exitCode = report.outcome === 'OBSERVED' ? 0 : 1;
} catch { process.stderr.write('Private TRON negative-fixture command failed; details omitted.\n'); process.exitCode = 1; }
finally { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
