import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const execute = promisify(execFile);
export async function compileLocalProbe() {
  const directory = await mkdtemp(join(tmpdir(), 'mca-tvm-probe-'));
  try {
    const source = fileURLToPath(new URL('../../../tools/tron-tvm/LocalReadProbe.java', import.meta.url));
    const version = (await execute('javac', ['-version'], { timeout: 10000, maxBuffer: 4096 })).stdout.trim();
    if (!/^javac (17|21)\.[0-9.]+$/.test(version)) throw new Error('Unsupported compiler');
    await execute('javac', ['--release', '17', '-g:none', '-proc:none', '-classpath', directory, '-d', directory, source],
      { timeout: 30000, maxBuffer: 4096 });
    // Only public helper bytecode lives here. Dropped container capabilities cannot read a copied macOS UID's 0700 directory.
    await chmod(directory, 0o755); await chmod(join(directory, 'LocalReadProbe.class'), 0o644);
    const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
    return { directory, sourceSha256: digest(await readFile(source)), classSha256: digest(await readFile(join(directory, 'LocalReadProbe.class'))),
      compiler: version, cleanup: () => rm(directory, { recursive: true, force: true }) };
  } catch { await rm(directory, { recursive: true, force: true }); throw new Error('PROBE_COMPILE_FAILED'); }
}

export async function exchangeProbe(containerId: string, classpath: string, operation: string, body: unknown): Promise<string> {
  if (!['deploy', 'trigger', 'broadcast', 'receipt', 'contract', 'constant', 'account', 'block'].includes(operation)) throw new Error('FIXTURE_OPERATION_REJECTED');
  const input = JSON.stringify(body);
  if (Buffer.byteLength(input) > 1024 * 1024) throw new Error('FIXTURE_REQUEST_TOO_LARGE');
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', containerId, '/opt/java/bin/java', '-cp', classpath, 'LocalReadProbe', operation],
      { stdio: ['pipe', 'pipe', 'ignore'] });
    let output = '', size = 0, failure = false;
    const timer = setTimeout(() => { failure = true; child.kill(); }, 10000);
    child.stdout.on('data', data => { size += data.length; if (size > 1024 * 1024) { failure = true; child.kill(); } else output += String(data); });
    child.stdin.on('error', () => {}); child.on('error', () => { clearTimeout(timer); reject(new Error('FIXTURE_TRANSPORT_FAILED')); });
    child.on('close', code => { clearTimeout(timer); if (code !== 0 || failure) reject(new Error('FIXTURE_TRANSPORT_FAILED')); else resolve(output); });
    child.stdin.end(input);
  });
}
