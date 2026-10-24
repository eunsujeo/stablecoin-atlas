// Only the repository-pinned compiler is executed. No import callback, scripts or downloads.
import { createRequire } from 'node:module';
import { cachedCompilerById, readVerifiedCompiler } from './compiler-cache.mjs';
process.stdin.setEncoding('utf8');
let input = '';
for await (const chunk of process.stdin) {
  input += chunk.toString();
  if (Buffer.byteLength(input) > 2 * 1024 * 1024) process.exit(2);
}
try {
  const request = JSON.parse(input);
  let solc;
  if (request.profile === 'installed-solc') solc = (await import('solc')).default;
  else {
    const profile = cachedCompilerById(request.profile);
    if (!profile) throw new Error('UNKNOWN_COMPILER_PROFILE');
    await readVerifiedCompiler(request.stagedCompiler, profile.sha256);
    const require = createRequire(import.meta.url);
    const wrapper = require('solc/wrapper');
    solc = wrapper(require(request.stagedCompiler));
    if (solc.version() !== profile.version) throw new Error('COMPILER_VERSION_MISMATCH');
  }
  const output = JSON.parse(solc.compile(JSON.stringify(request.input)));
  const selected = output.contracts?.[request.file]?.[request.contract];
  const result = { compiler: solc.version(), errors: (output.errors ?? []).map(e => ({ severity: e.severity, code: e.errorCode ?? null })),
    sources: output.sources ?? {}, selected: selected ?? null };
  const serialized = JSON.stringify(result);
  if (Buffer.byteLength(serialized) > 8 * 1024 * 1024) process.exit(2);
  process.stdout.write(serialized);
} catch { process.exitCode = 2; }
