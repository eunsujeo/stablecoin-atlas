import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { assessReadOnly } from './assessment.js';
import { json } from './domain/evaluator.js';
import { commandErrorMessage } from './diagnostics.js';
import { writeReportAtomically } from './report-output.js';
import type { AssessmentReport } from './domain/model.js';

const help = `Multi-Chain Asset Compatibility Lab

  npm run lab -- [--profile baseline|exact-receipt] [--out reports/lab.json]
  npm run assess -- --network <chain-id> --token <address> [--holder <address>] [--out <path>]

lab: starts/stops a private Anvil and deploys seven local fixtures. No external transactions.
assess: read-only; set RPC_URL in the environment. No private keys or signing.
JSON goes to stdout unless --out is supplied. Logs/summary go to stderr.
Exit codes: 0 completed; 1 command/infrastructure error; 2 completed with scenario FAIL.
`;
export async function main(args = process.argv.slice(2)): Promise<number> {
  const command = args[0];
  if (!command || command === '--help' || command === 'help') { process.stdout.write(help); return 0; }
  const { values } = parseArgs({ args: args.slice(1), options: {
    out: { type: 'string' }, profile: { type: 'string' }, network: { type: 'string' },
    token: { type: 'string' }, holder: { type: 'string' }, help: { type: 'boolean' },
  }, strict: true, allowPositionals: false });
  if (values.help) { process.stdout.write(help); return 0; }
  let output: unknown, reports: AssessmentReport[];
  if (command === 'lab') {
    if (values.network || values.token || values.holder) throw new Error('lab accepts only --profile and --out');
    const profile = values.profile ?? 'baseline';
    if (profile !== 'baseline' && profile !== 'exact-receipt') throw new Error('Unknown profile');
    const { runLab } = await import('./lab/run.js');
    const result = await runLab(profile);
    reports = result.assessments.map(a => a.report); output = result;
  } else if (command === 'assess') {
    if (values.profile) throw new Error('assess uses the read-only baseline profile');
    if (!values.network || !/^[1-9][0-9]*$/.test(values.network) || !values.token) throw new Error('Provide --network positive chain-id and --token address');
    if (!process.env.RPC_URL) throw new Error('Set RPC_URL in the environment');
    const report = await assessReadOnly({ rpcUrl: process.env.RPC_URL, networkId: values.network, token: values.token,
      ...(values.holder ? { holder: values.holder } : {}) });
    output = report; reports = [report];
  } else throw new Error('Unknown command. Use --help.');
  const serialized = json(output);
  if (values.out) {
    await writeReportAtomically(values.out, serialized);
  } else process.stdout.write(serialized);
  const counts: Record<string, number> = {};
  for (const report of reports) for (const result of report.results) counts[result.verdict] = (counts[result.verdict] ?? 0) + 1;
  process.stderr.write(`Assessments: ${reports.length}; ${JSON.stringify(counts)}\n`);
  return counts.FAIL ? 2 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; }).catch((error: unknown) => {
    const reason = commandErrorMessage(error);
    process.stderr.write(`Command failed: ${reason}\nUse --help for usage.\n`);
    process.exitCode = 1;
  });
}
