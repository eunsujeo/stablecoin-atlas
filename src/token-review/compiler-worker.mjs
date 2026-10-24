// Only the repository-pinned compiler is executed. No import callback, scripts or downloads.
import solc from 'solc';
process.stdin.setEncoding('utf8');
let input = '';
for await (const chunk of process.stdin) {
  input += chunk.toString();
  if (Buffer.byteLength(input) > 2 * 1024 * 1024) process.exit(2);
}
try {
  const request = JSON.parse(input);
  const output = JSON.parse(solc.compile(JSON.stringify(request.input)));
  const selected = output.contracts?.[request.file]?.[request.contract];
  const result = { compiler: solc.version(), errors: (output.errors ?? []).map(e => ({ severity: e.severity, code: e.errorCode ?? null })),
    sources: output.sources ?? {}, selected: selected ?? null };
  const serialized = JSON.stringify(result);
  if (Buffer.byteLength(serialized) > 8 * 1024 * 1024) process.exit(2);
  process.stdout.write(serialized);
} catch { process.exitCode = 2; }
