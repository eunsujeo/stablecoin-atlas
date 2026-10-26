// JSON-only compiler input: no import callback, external scripts or source paths on disk.
import solc from 'solc';
let text = '';
for await (const chunk of process.stdin) { text += chunk; if (Buffer.byteLength(text) > 2 * 1024 * 1024) process.exit(2); }
try {
  const request = JSON.parse(text);
  const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: request.sources,
    settings: { outputSelection: { '*': { '': ['ast'], '*': ['abi'] } }, evmVersion: 'shanghai' } })));
  const result = JSON.stringify({ version: solc.version(), errors: (output.errors ?? []).map(e => ({ severity: e.severity, code: e.errorCode ?? null })), sources: output.sources ?? {} });
  if (Buffer.byteLength(result) > 8 * 1024 * 1024) process.exit(2);
  process.stdout.write(result);
} catch { process.exitCode = 2; }
