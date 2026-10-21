import { parseArgs } from 'node:util';
import { readStablecoinIssuers } from './xrpl-issuer-readonly.js';
import { writeReportAtomically } from '../report-output.js';
try {
  const { values } = parseArgs({ options: { out: { type: 'string' }, public: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false } }, strict: true, allowPositionals: false });
  if (values.help) {
    process.stdout.write('Issuer research only: --out report.json [--public]. Otherwise set XRPL_RPC_URL. No transactions.\n');
  } else {
    if (!values.out) throw new Error();
    const url = values.public ? 'https://xrplcluster.com/' : process.env.XRPL_RPC_URL;
    if (!url) throw new Error();
    const report = await readStablecoinIssuers(url);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(`XRPL issuer research: ${report.status}; requests=${report.requestCount}.\n`);
    process.exitCode = report.status === 'OBSERVED' ? 0 : 2;
  }
} catch {
  process.stderr.write('XRPL issuer research could not run/save. Check options, XRPL_RPC_URL or --public, and output path; details omitted.\n');
  process.exitCode = 1;
}
