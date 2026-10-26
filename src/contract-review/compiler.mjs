import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sources } from './source.mjs';
export async function syntaxAnalysis(sourceBundle, { timeoutMs = 20000 } = {}) {
  const original = sources(sourceBundle);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) throw Error('INVALID_COMPILER_BUDGET');
  // Preserve UTF-8 offsets; pragma relaxation is an analysis copy, NEVER deployment verification.
  let relaxed = false;
  const input = Object.fromEntries(Object.entries(original).map(([name, s]) => [name, { content: s.content.replace(/pragma\s+solidity\s+[^;]+;/g, match => {
    relaxed = true; return [...match].map(c => c === '\n' ? '\n' : ' '.repeat(Buffer.byteLength(c))).join('');
  }) }]));
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--max-old-space-size=256', fileURLToPath(new URL('./worker.mjs', import.meta.url))], {
      env: { PATH: process.env.PATH ?? '' }, stdio: ['pipe', 'pipe', 'ignore'], shell: false,
    });
    const chunks = []; let bytes = 0, failed = false;
    const fail = () => { failed = true; child.kill('SIGKILL'); };
    const timer = setTimeout(fail, timeoutMs);
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 8 * 1024 * 1024) fail(); else chunks.push(chunk); });
    child.stdin.on('error', fail);
    child.once('error', () => { clearTimeout(timer); reject(Error('COMPILER_FAILED')); });
    child.once('close', code => {
      clearTimeout(timer); if (failed || code !== 0) { reject(Error('COMPILER_FAILED')); return; }
      try { resolve({ ...JSON.parse(Buffer.concat(chunks).toString('utf8')), pragmaRelaxed: relaxed }); } catch { reject(Error('COMPILER_FAILED')); }
    });
    child.stdin.end(JSON.stringify({ sources: input }));
  });
}
