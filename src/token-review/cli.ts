import { parseArgs } from 'node:util';
import { reviewToken } from './review.js';

export async function reviewCommand(args: string[]): Promise<number> {
  try {
    const { values } = parseArgs({ args, strict: true, allowPositionals: false,
      options: { config: { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean' } } });
    if (values.help) {
      process.stdout.write('npm run review:token -- --config <TokenReviewConfig1.0.json> --out <new-directory>\nRPC_URL from environment; EVM read-only, no AI/Slither/transactions. See docs/TOKEN_TECHNICAL_REVIEW.md.\n');
      return 0;
    }
    if (!values.config || !values.out || !process.env.RPC_URL) {
      process.stderr.write('Provide --config, --out (new directory), and RPC_URL in the environment.\n'); return 1;
    }
    const report = await reviewToken(values.config, process.env.RPC_URL, values.out);
    process.stderr.write(`Token review: ${report.execution}; findings=${report.findings.length}; failures=${report.failures.length}; AI/Slither NOT_RUN.\n`);
    return report.execution === 'PARTIAL' ? 2 : 0;
  } catch {
    // Never print arbitrary filesystem, compiler, parser, RPC, or configuration error text.
    process.stderr.write('Token review could not complete. Check configuration, local inputs, RPC_URL, and an unused output directory. Error details omitted.\n');
    return 1;
  }
}
