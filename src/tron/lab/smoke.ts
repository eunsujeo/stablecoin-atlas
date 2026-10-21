import { parseArgs } from 'node:util';
import { runPrivateTvmSmoke } from './runtime.js';
import { serializePrivateTvmReport } from './report-contract.js';
import { writeReportAtomically } from '../../report-output.js';
const controller = new AbortController();
const stop = () => controller.abort();
process.once('SIGINT', stop); process.once('SIGTERM', stop);
try {
  const { values } = parseArgs({ options: { out: { type: 'string' } }, strict: true, allowPositionals: false });
  const result = await runPrivateTvmSmoke(undefined, { signal: controller.signal });
  const payload = serializePrivateTvmReport(result);
  if (values.out) await writeReportAtomically(values.out, payload); else process.stdout.write(payload);
  process.stderr.write(`Private TVM runtime: ${result.outcome}; cleanup ${result.cleanup.container}/${result.cleanup.network}\n`);
  process.exitCode = result.outcome === 'READY' ? 0 : 1;
} catch {
  process.stderr.write('Private TVM smoke command failed; details omitted.\n'); process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
}
