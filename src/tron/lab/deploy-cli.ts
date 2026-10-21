import { parseArgs } from 'node:util';
import { deployPrivateTronFixture } from './deployment.js';
import { serializePrivateTvmReport } from './report-contract.js';
import { writeReportAtomically } from '../../report-output.js';
const controller = new AbortController(); const abort = () => controller.abort();
process.once('SIGINT', abort); process.once('SIGTERM', abort);
try {
  const { values } = parseArgs({ options: { out: { type: 'string' }, exercise: { type: 'boolean', default: false }, boundary: { type: 'boolean', default: false } }, strict: true, allowPositionals: false });
  const report = await deployPrivateTronFixture(controller.signal, values.exercise || values.boundary, values.boundary), text = serializePrivateTvmReport(report);
  if (values.out) await writeReportAtomically(values.out, text); else process.stdout.write(text);
  process.stderr.write(`Private TRON fixture: ${report.outcome}; ${report.evidence.stage}; cleanup ${report.runtime.cleanup.container}/${report.runtime.cleanup.network}\n`);
  process.exitCode = report.outcome === 'OBSERVED' ? 0 : 1;
} catch { process.stderr.write('Private TRON fixture command failed; details omitted.\n'); process.exitCode = 1; }
finally { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
