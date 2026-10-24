import { constants } from 'node:fs';
import { open, mkdtemp, chmod, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Explicitly pinned artifacts only. This registry never downloads or accepts executable paths.
export const cachedCompiler = Object.freeze({ id: 'solc-0.6.12-pinned',
  version: '0.6.12+commit.27d51765.Emscripten.clang',
  sha256: '3e1956c550ca48e289044c7c0bd892403081b4b5e17e77ce707c815ce6c4228f',
  provenance: 'EXISTING_PINNED_CACHE', independentAttestation: 'NOT_TESTED' });
export const jpycCompiler = Object.freeze({ id: 'solc-0.8.11-pinned',
  version: '0.8.11+commit.d7f03943.Emscripten.clang',
  sha256: '64117d4b13bfc5bc6e5f80823519b140e753a0c09e99edd756772dc3029bc1f8',
  provenance: 'BROWSER_ACQUIRED_PINNED_CACHE', independentAttestation: 'NOT_TESTED' });
export const usdtCompiler = Object.freeze({ id: 'solc-0.4.18-pinned',
  version: '0.4.18+commit.9cf6e910.Emscripten.clang',
  sha256: '905e3d253406973f545666d79cd64c5c85985992f68fa35935f60249e311d74f',
  provenance: 'BROWSER_ACQUIRED_PINNED_CACHE', independentAttestation: 'NOT_TESTED' });
export const cachedCompilers = Object.freeze([cachedCompiler, jpycCompiler, usdtCompiler]);
const cachePaths = new Map([
  [cachedCompiler.version, new URL('../../.state/usdc-source/compiler/soljson.js', import.meta.url)],
  [jpycCompiler.version, new URL('../../.state/jpyc-solc-browser-artifact/soljson.js', import.meta.url)],
  [usdtCompiler.version, new URL('../../.state/usdt-solc-0418-visible-browser-v2/soljson.js', import.meta.url)],
]);
export function cachedCompilerById(id) { return cachedCompilers.find(profile => profile.id === id) ?? null; }
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
export async function inspectCachedCompiler(version = cachedCompiler.version) {
  const profile = cachedCompilers.find(item => item.version === version);
  if (!profile) return null;
  try { await readVerifiedCompiler(cachePaths.get(version), profile.sha256); return profile; }
  catch (error) { if (error?.code === 'ENOENT') return null; throw new Error('COMPILER_CACHE_UNVERIFIED'); }
}
export async function stageCachedCompiler(version = cachedCompiler.version) {
  const profile = cachedCompilers.find(item => item.version === version);
  if (!profile) throw new Error('COMPILER_VERSION_UNAVAILABLE');
  const bytes = await readVerifiedCompiler(cachePaths.get(version), profile.sha256);
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
