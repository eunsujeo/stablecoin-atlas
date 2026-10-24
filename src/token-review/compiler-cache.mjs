import { constants } from 'node:fs';
import { open, mkdtemp, chmod, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Reviewed existing artifact only. This registry never downloads or accepts executable paths.
export const cachedCompiler = Object.freeze({ id: 'solc-0.6.12-pinned',
  version: '0.6.12+commit.27d51765.Emscripten.clang',
  sha256: '3e1956c550ca48e289044c7c0bd892403081b4b5e17e77ce707c815ce6c4228f',
  provenance: 'EXISTING_PINNED_CACHE', independentAttestation: 'NOT_TESTED' });
const cachePath = new URL('../../.state/usdc-source/compiler/soljson.js', import.meta.url);
export function verifyCompilerBytes(bytes, expectedHash) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 32 * 1024 * 1024
    || createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw new Error('COMPILER_CACHE_UNVERIFIED');
}
export async function readVerifiedCompiler(path, expectedHash) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 32 * 1024 * 1024 || info.uid !== process.getuid?.()) throw new Error('COMPILER_CACHE_UNVERIFIED');
    const buffer = Buffer.alloc(info.size + 1); let length = 0;
    while (length < buffer.length) {
      const read = await handle.read(buffer, length, buffer.length - length, null);
      if (!read.bytesRead) break; length += read.bytesRead;
    }
    const bytes = buffer.subarray(0, length); verifyCompilerBytes(bytes, expectedHash); return bytes;
  } finally { await handle.close(); }
}
export async function inspectCachedCompiler() {
  try { await readVerifiedCompiler(cachePath, cachedCompiler.sha256); return cachedCompiler; }
  catch (error) { if (error?.code === 'ENOENT') return null; throw new Error('COMPILER_CACHE_UNVERIFIED'); }
}
export async function stageCachedCompiler() {
  const bytes = await readVerifiedCompiler(cachePath, cachedCompiler.sha256);
  const directory = await mkdtemp(join(tmpdir(), 'token-review-solc-'));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    await chmod(directory, 0o700);
    const path = join(directory, 'compiler.cjs');
    const handle = await open(path, 'wx', 0o600);
    try { await handle.chmod(0o600); await handle.writeFile(bytes); await handle.sync(); }
    finally { await handle.close(); }
    return { path, cleanup };
  } catch { await cleanup(); throw new Error('COMPILER_CACHE_STAGE_FAILED'); }
}
