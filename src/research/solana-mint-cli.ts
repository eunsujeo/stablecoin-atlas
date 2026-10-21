import { parseArgs } from 'node:util';
import { readStablecoinMints } from './solana-mint-readonly.js';
import { writeReportAtomically } from '../report-output.js';

try {
  const { values } = parseArgs({ options: { out: { type: 'string' }, public: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false } }, strict: true, allowPositionals: false });
  if (values.help) {
    process.stdout.write('Research only: --out report.json [--public]. Otherwise set SOLANA_RPC_URL. No transactions.\n');
  } else {
    if (!values.out) throw new Error();
    // Choose once before requests. No retries, endpoint fallback, signing or proxy overrides.
    const url = values.public ? 'https://api.mainnet.solana.com' : process.env.SOLANA_RPC_URL;
    if (!url) throw new Error();
    const report = await readStablecoinMints(url);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(`Solana mint research: ${report.status}; requests=${report.requestCount}.\n`);
    process.exitCode = report.status === 'OBSERVED' ? 0 : 2;
  }
} catch {
  process.stderr.write('Solana mint research could not run/save. Check options, SOLANA_RPC_URL or --public, and output path; details omitted.\n');
  process.exitCode = 1;
}
