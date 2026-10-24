import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { assessReadOnly } from './assessment.js';
import { json } from './domain/evaluator.js';
import { commandErrorMessage } from './diagnostics.js';
import { writeReportAtomically } from './report-output.js';
import type { AssessmentReport } from './domain/model.js';

const help = `Multi-Chain Asset Compatibility Lab

  npm run lab -- [--profile baseline|exact-receipt] [--out reports/lab.json]
  npm run assess -- [--chain evm|tron|solana] --network <chain-id|mainnet-beta> --token <contract-or-mint> [--holder <address>] [--token-account <Solana-token-account>] [--spender <TRON-address>] [--out <path>]
  npm run assess -- --chain xrpl --network mainnet --issuer <issuer> --currency <40-hex-code> [--holder <classic-address>] [--out <path>]
  npm run validate -- --file <AssessmentReport1.0.json>
  npm run review:token -- --config <TokenReviewConfig1.0-or-1.1.json> --out <new-directory> [--offline [--observations <saved-report.json>]]

lab: starts/stops a private Anvil and deploys seven local fixtures. No external transactions.
assess: read-only; evm uses RPC_URL; tron uses TRON_RPC_URL; solana uses SOLANA_RPC_URL (mint and optional explicit Token Account); xrpl uses XRPL_RPC_URL (issuer and optional holder trust-line). No private keys or signing.
JSON goes to stdout unless --out is supplied. Logs/summary go to stderr.
lab/assess exit codes: 0 completed; 1 command/infrastructure error; 2 completed with scenario FAIL.
validate: offline only; exit0 valid report,2 invalid report,1 input/options/infrastructure error. No asset approval.
`;
export async function main(args = process.argv.slice(2)): Promise<number> {
  const command = args[0];
  if (!command || command === '--help' || command === 'help') { process.stdout.write(help); return 0; }
  if (command === 'review-token') {
    const { reviewCommand } = await import('./token-review/cli.js');
    return reviewCommand(args.slice(1));
  }
  if (command === 'validate') {
    const { validateReportCommand } = await import('./report-validation-cli.js');
    return validateReportCommand(args.slice(1));
  }
  const { values } = parseArgs({ args: args.slice(1), options: {
    out: { type: 'string' }, profile: { type: 'string' }, network: { type: 'string' },
    token: { type: 'string' }, holder: { type: 'string' }, chain: { type: 'string' }, spender: { type: 'string' }, help: { type: 'boolean' },
    issuer: { type: 'string' }, currency: { type: 'string' }, 'token-account': { type: 'string' },
  }, strict: true, allowPositionals: false });
  if (values.help) { process.stdout.write(help); return 0; }
  let output: unknown, reports: AssessmentReport[];
  if (command === 'lab') {
    if (values['token-account'] !== undefined || values.network || values.token || values.holder || values.chain || values.spender !== undefined || values.issuer !== undefined || values.currency !== undefined) throw new Error('lab accepts only --profile and --out');
    const profile = values.profile ?? 'baseline';
    if (profile !== 'baseline' && profile !== 'exact-receipt') throw new Error('Unknown profile');
    const { runLab } = await import('./lab/run.js');
    const result = await runLab(profile);
    reports = result.assessments.map(a => a.report); output = result;
  } else if (command === 'assess') {
    if (values.profile !== undefined) throw new Error('assess uses the read-only baseline profile');
    const chain = values.chain ?? 'evm';
    if (chain !== 'evm' && chain !== 'tron' && chain !== 'solana' && chain !== 'xrpl') throw new Error('Unknown chain. Use evm, tron, solana or xrpl.');
    if (chain !== 'xrpl' && (values.currency !== undefined || values.issuer !== undefined)) throw new Error('Issuer and currency options require XRPL.');
    if (values['token-account'] !== undefined && chain !== 'solana') throw new Error('--token-account requires --chain solana.');
    let network = values.network;
    if (chain === 'xrpl') {
      if (network === 'mainnet') network = '0';
      if (network !== '0') throw new Error('Invalid XRPL network reference.');
      if (values.token !== undefined || values.spender !== undefined) throw new Error('XRPL accepts issuer, currency and optional holder.');
      if (!values.issuer || !values.currency) throw new Error('Unsupported XRPL currency and issuer pair.');
    } else if (chain === 'solana') {
      const { SOLANA_MAINNET_GENESIS } = await import('./research/solana-mint-readonly.js');
      if (network === 'mainnet-beta') network = SOLANA_MAINNET_GENESIS;
      if (network !== SOLANA_MAINNET_GENESIS) throw new Error('Invalid Solana network reference.');
      if (values.holder !== undefined) throw new Error('Solana requires --token-account instead of --holder.');
    } else if (!network || !/^[1-9][0-9]*$/.test(network)) throw new Error('Provide --network positive chain-id and --token address');
    if (chain !== 'xrpl' && !values.token) throw new Error('Provide --network positive chain-id and --token address');
    if (values.spender !== undefined && chain !== 'tron') throw new Error('--spender requires --chain tron.');
    if (values.spender !== undefined && values.holder === undefined) throw new Error('TRON spender requires holder.');
    const envName = chain === 'xrpl' ? 'XRPL_RPC_URL' : chain === 'solana' ? 'SOLANA_RPC_URL' : chain === 'tron' ? 'TRON_RPC_URL' : 'RPC_URL';
    const rpcUrl = process.env[envName];
    if (!rpcUrl) throw new Error(`Set ${envName} in the environment`);
    let report: AssessmentReport;
    if (chain === 'xrpl') {
      const { XrplReadOnlyAdapter } = await import('./xrpl/adapter.js');
      report = await new XrplReadOnlyAdapter(rpcUrl).assessReadOnly({ networkId: network, assetAddress: values.issuer!, currencyCode: values.currency!, ...(values.holder !== undefined ? { accountAddress: values.holder } : {}) });
    }
    else if (chain === 'evm') report = await assessReadOnly({ rpcUrl, networkId: network, token: values.token!,
      ...(values.holder ? { holder: values.holder } : {}) });
    else if (chain === 'solana') {
      const { SolanaReadOnlyAdapter } = await import('./solana/adapter.js');
      report = await new SolanaReadOnlyAdapter(rpcUrl).assessReadOnly({ networkId: network, assetAddress: values.token!, ...(values['token-account'] !== undefined ? { accountAddress: values['token-account'] } : {}) });
    }
    else {
      const { TronReadOnlyAdapter } = await import('./tron/adapter.js');
      report = await new TronReadOnlyAdapter(rpcUrl).assessReadOnly({ networkId: network, assetAddress: values.token!,
        ...(values.holder !== undefined ? { accountAddress: values.holder } : {}),
        ...(values.spender !== undefined ? { spenderAddress: values.spender } : {}) });
    }
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
