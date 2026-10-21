import { open, constants } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const evidenceRoot = new URL('../reports/dashboard-evidence/', import.meta.url);
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function boundedRead(file, limit = 10 * 1024 * 1024) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat(); if (!stat.isFile() || stat.size > limit) throw new Error('INPUT_LIMIT');
    const bytes = Buffer.alloc(stat.size + 1); let used = 0;
    while (used < bytes.length) { const { bytesRead } = await handle.read(bytes, used, bytes.length - used, null); if (!bytesRead) break; used += bytesRead; }
    if (used !== stat.size) throw new Error('INPUT_CHANGED');
    return bytes.subarray(0, used);
  } finally { await handle.close(); }
}
export async function publishedIndex(root = evidenceRoot) {
  const bytes = await boundedRead(new URL('index.json', root), 2 * 1024 * 1024);
  const index = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (index.kind !== 'LOCAL_EVIDENCE_INDEX' || !Array.isArray(index.reports) || index.reports.length > 64 || !Array.isArray(index.items) || index.items.length > 2000) throw new Error('INVALID_INDEX');
  const ids = new Set();
  for (const r of index.reports) {
    if (!/^[a-f0-9]{64}$/.test(r.id) || ids.has(r.id) || !/^[a-f0-9]{64}$/.test(r.viewSha256) || !/^[a-f0-9]{64}$/.test(r.documentSha256)) throw new Error('INVALID_INDEX');
    ids.add(r.id);
  }
  let lastBuild = null;
  try { const value = JSON.parse((await boundedRead(new URL('last-build.json', root), 2000)).toString('utf8')); if (['SUCCESS', 'FAILED'].includes(value.state) && typeof value.at === 'string') lastBuild = { state: value.state, at: value.at }; } catch { /* The published index remains independently usable. */ }
  return { index: { ...index, indexSha256: digest(bytes), lastBuild }, bytes };
}
export async function publishedArtifact(id, format, root = evidenceRoot) {
  const { index } = await publishedIndex(root), entry = index.reports.find(r => r.id === id);
  if (!entry || !['json', 'html'].includes(format)) throw new Error('UNAVAILABLE');
  // Only IDs from a validated fixed index are converted into local artifact names.
  const file = format === 'json' ? `${entry.viewSha256}.json` : `${entry.documentSha256}.html`;
  const bytes = await boundedRead(new URL(`artifacts/${file}`, root), 4 * 1024 * 1024);
  if (digest(bytes) !== (format === 'json' ? entry.viewSha256 : entry.documentSha256)) throw new Error('HASH_MISMATCH');
  return bytes;
}
