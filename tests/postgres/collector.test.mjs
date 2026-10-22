import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fixture } from './fixture.mjs';
import { connectDatabase } from '../../tools/market-db/connection.mjs';
import { initialize, partition, grantAccess } from '../../tools/market-db/schema.mjs';
import { checkDatabase } from '../../tools/market-db/health.mjs';
import { databaseCollector } from '../../tools/market-db/collect.mjs';
import { collectMarket } from '../../tools/market-collect.mjs';
import { loadSources } from '../../tools/market-db/files.mjs';
import { importSources, latestValues } from '../../tools/market-db/repository.mjs';
import { publishedMarket } from '../../tools/market-store.mjs';

test('database collector: actual private PostgreSQL roles, exact source/hash, preflight, schema drift, lost COMMIT response and recovery', { timeout: 120000 }, async () => {
  const f = await fixture(), directory = await mkdtemp(join(tmpdir(), 'atlas-db-collector-'));
  const root = join(directory, 'reports', 'market-store'), archiveDirectory = join(directory, 'archive');
  await mkdir(root, { recursive: true });
  const registryPath = new URL('../../data/asset-registry.json', import.meta.url);
  let client, requests = 0;
  const at = Date.UTC(2026, 9, 31, 23, 59, 0), secret = 'collector-test-never-store';
  const response = endpoint => new Response(JSON.stringify(endpoint.includes('/market/') ? { price: '1.000000000000000001', circulatingSupply: '9007199254740993.123456789' }
    : endpoint.includes('/holders/') ? { totalSupply: { ethereum: '42' } } : { ethereum: { active: true, tip: '42', asOf: { tip: null } } }));
  const collect = options => collectMarket({ ...options, wait: async () => {}, now: () => new Date(at).toISOString(),
    fetcher: async url => { requests++; return response(new URL(url).pathname); } });
  try {
    await initialize(f.admin); await partition(f.admin, '2026-10');
    const url = await f.createUser('atlas_test_collector'); await grantAccess(f.admin, 'atlas_test_collector', 'writer');
    const readerUrl = await f.createUser('atlas_test_viewer'); await grantAccess(f.admin, 'atlas_test_viewer', 'reader');
    client = await connectDatabase({ DATABASE_URL: url });
    assert.equal((await checkDatabase(client, { at })).state, 'READY');
    await assert.rejects(checkDatabase(client, { at, through: at + 120000 }), /DATABASE_PARTITION_REQUIRED/);
    const make = (env, custom = collect) => databaseCollector({ env, collect: custom, registryPath, archiveDirectory, now: () => at });
    const call = run => run({ directory: root, key: secret });
    assert.equal((await call(make({ DATABASE_URL: url }))).state, 'FAILED'); assert.equal(requests, 0);
    await partition(f.admin, '2026-11');
    assert.equal((await call(make({ DATABASE_URL: readerUrl }))).state, 'FAILED'); assert.equal(requests, 0);
    assert.equal((await call(make({ DATABASE_URL: f.url('postgres') }))).state, 'FAILED'); assert.equal(requests, 0);
    const success = await call(make({ DATABASE_URL: url }));
    assert.equal(success.state, 'SUCCESS'); assert.equal(requests, 7);
    const data = await publishedMarket(root); assert.equal(data.databaseState.state, 'STORED');
    assert.equal(data.databaseState.sourceName, success.sourceName); assert.equal(data.databaseState.sourceHash, success.sourceHash);
    assert.equal((await latestValues(client, { coin: 'usdc' })).values.find(v => v.metric === 'PRICE').amount, '1.000000000000000001');
    const input = await loadSources({ reportsDirectory: join(directory, 'reports'), registryPath, names: ['market-store/collected/' + success.sourceName] });
    assert.equal(input.sources[0].hash, success.sourceHash);
    assert.equal((await importSources(client, { ...input, archiveDirectory })).unchanged, 1);
    assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM atlas_market.import_manifest')).rows[0].n, 1);
    // Detect schema drift after a fresh local publication, before import.
    const broken = async options => {
      const result = await collectMarket({ ...options, now: () => new Date(at + 1000).toISOString(), wait: async () => {},
        fetcher: async url => { requests++; return response(new URL(url).pathname); } });
      await f.admin.query(`CREATE FUNCTION atlas_market.synthetic_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private reject'; END $$`);
      await f.admin.query('CREATE TRIGGER synthetic_reject BEFORE INSERT ON atlas_market.collection_run FOR EACH ROW EXECUTE FUNCTION atlas_market.synthetic_reject()');
      // Preserve the fingerprint so drift is rejected before any import writes.
      return result;
    };
    const failed = await call(make({ DATABASE_URL: url }, broken));
    assert.equal(failed.state, 'FAILED'); assert.equal(failed.published, true);
    assert.equal((await publishedMarket(root)).databaseState.state, 'FAILED');
    assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM atlas_market.import_manifest')).rows[0].n, 1);
    await f.admin.query('DROP TRIGGER synthetic_reject ON atlas_market.collection_run; DROP FUNCTION atlas_market.synthetic_reject()');
    const retry = (await publishedMarket(root)).databaseState;
    const recovery = await loadSources({ reportsDirectory: join(directory, 'reports'), registryPath, names: ['market-store/collected/' + retry.sourceName] });
    assert.equal((await importSources(client, { ...recovery, archiveDirectory })).sources, 1);
    assert.equal(requests, 14); // Recovery does not call the provider.
    const newer = options => collectMarket({ ...options, wait: async () => {}, now: () => new Date(at + 2000).toISOString(),
      fetcher: async url => { requests++; return response(new URL(url).pathname); } });
    const lost = databaseCollector({ env: { DATABASE_URL: url }, collect: newer, registryPath, archiveDirectory, now: () => at,
      connect: async env => {
        const c = await connectDatabase(env), query = c.query.bind(c); let commits = 0;
        c.query = async (...args) => {
          const value = await query(...args);
          if (args[0] === 'COMMIT' && ++commits === 4) throw Error('private COMMIT response lost');
          return value;
        };
        return c;
      } });
    const unknown = await call(lost); assert.equal(unknown.state, 'FAILED'); assert.equal(unknown.database, 'UNCONFIRMED');
    const pending = (await publishedMarket(root)).databaseState;
    assert.equal(pending.state, 'UNCONFIRMED');
    const committed = await loadSources({ reportsDirectory: join(directory, 'reports'), registryPath, names: ['market-store/collected/' + pending.sourceName] });
    assert.equal((await importSources(client, { ...committed, archiveDirectory })).unchanged, 1);
    assert.equal(requests, 21); // Resolve an uncertain commit without re-collecting.

    assert.ok(!(await readFile(join(root, 'database-state.json'), 'utf8')).includes(secret));
  } finally { await client?.end().catch(() => {}); await f.stop(); await rm(directory, { recursive: true, force: true }); }
});
