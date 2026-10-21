import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { validatePrivateTvmReport } from './report-contract.js';
try {
  const { values } = parseArgs({ options: { file: { type: 'string' }, legacy: { type: 'boolean', default: false } }, strict: true, allowPositionals: false });
  if (!values.file) throw Error('FILE_REQUIRED');
  const text = await readFile(values.file, 'utf8'); if (Buffer.byteLength(text) > 10 * 1024 * 1024) throw Error('REPORT_TOO_LARGE');
  const result = validatePrivateTvmReport(JSON.parse(text), values.legacy);
  process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = result.valid ? 0 : 1;
} catch { process.stderr.write('Private TVM report validation failed; details omitted.\n'); process.exitCode = 1; }
