import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { databaseCollector } from '../tools/market-db/collect.mjs';
import { observationMonth } from '../tools/market-db/health.mjs';
import { parseWatchArguments } from '../tools/market-watch.mjs';
import { validateDatabaseState } from '../web/market-model.js';

test('explicit database mode accepts a private archive, rejects duplicate/unsafe command options and leaves JSON default', () => {
  assert.deepEqual(parseWatchArguments([]), { maxRuns: 12, database: false });
  assert.deepEqual(parseWatchArguments(['--database', '--max-runs', '2', '--archive-dir', '/private/archive']),
    { maxRuns: 2, database: true, archiveDirectory: '/private/archive' });
  for (const args of [['--database', '--database'], ['--archive-dir', '/tmp'], ['--max-runs', '289'], ['--max-runs', '0'], ['--database-url', 'secret']]) assert.throws(() => parseWatchArguments(args));
  assert.equal(observationMonth('2026-11-01T00:30:00+09:00'), '2026-10');
  assert.throws(() => observationMonth('invalid'));
});
test('DB connection failure makes zero provider calls and persists only redacted bounded status', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-db-preflight-')); let calls = 0;
  try {
    const run = databaseCollector({ env: {}, connect: async () => { throw Error('password-do-not-print'); }, collect: async () => { calls++; } });
    const result = await run({ directory });
    assert.equal(result.state, 'FAILED'); assert.equal(calls, 0);
    const raw = await readFile(join(directory, 'database-state.json'), 'utf8'), state = validateDatabaseState(JSON.parse(raw));
    assert.equal(state.state, 'FAILED'); assert.equal(state.localPublished, false); assert.equal(state.sourceHash, null);
    assert.ok(!raw.includes('password-do-not-print'));
    assert.throws(() => validateDatabaseState({ ...state, errorCode: 'password=secret' }));
    assert.throws(() => validateDatabaseState({ ...state, connectionString: 'secret' }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
