import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { watchMarket, intervalMs } from '../tools/market-watch.mjs';
import { collectMarket } from '../tools/market-collect.mjs';
import { publishedMarket, withMarketWriter } from '../tools/market-store.mjs';
import { latest, series, validateSchedulerState } from './market-model.js';

async function temporary(run) {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-watch-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
const secret = 'never-persist-watch-key';
const response = endpoint => new Response(JSON.stringify(endpoint.includes('/market/')
  ? { circulatingSupply: '100.123456789123456789', price: '1.00001' }
  : endpoint.includes('/holders/') ? { totalSupply: { ethereum: '42' } }
    : { ethereum: { active: true, tip: '10', asOf: { tip: null } } }));

test('five-minute scheduler publishes exact real collector results twice; bounded budget and read-only status', async () => temporary(async directory => {
  let ticks = 0, requests = 0; const waits = [];
  const now = () => Date.UTC(2026, 9, 22) + ticks;
  const collect = options => collectMarket({ ...options, wait: async () => {},
    now: () => new Date(now()).toISOString(), fetcher: async url => { requests++; return response(new URL(url).pathname); } });
  const result = await watchMarket({ directory, key: secret, maxRuns: 2, collect,
    clock: () => ticks, now, wait: async ms => { waits.push(ms); ticks += ms; } });
  assert.equal(result.state, 'LIMIT_REACHED'); assert.equal(result.runs, 2);
  assert.equal(requests, 14); assert.deepEqual(waits, [intervalMs]);
  const data = await publishedMarket(directory);
  assert.equal(data.schedulerState.state, 'LIMIT_REACHED');
  const points = series(data, latest(data, { coinId: 'usdc', metric: 'PRICE' })[0]);
  assert.equal(points.length, 2); assert.equal(Date.parse(points[1].observedAt) - Date.parse(points[0].observedAt), intervalMs);
  assert.equal(points[0].amount, '1.00001');
  assert.equal((await readdir(join(directory, 'collected'))).length, 2);
  assert.ok(!JSON.stringify(data).includes(secret));
  assert.ok(!(await readdir(directory)).includes('.scheduler-lock'));
}));

test('failure stops without retry or sleeping; writer conflict does not issue requests or replace data', async () => temporary(async directory => {
  let requests = 0, waits = 0;
  await collectMarket({ directory, key: secret, wait: async () => {}, fetcher: async url => response(new URL(url).pathname) });
  const before = await publishedMarket(directory), index = await readFile(join(directory, 'index.json'), 'utf8');
  const collect = options => collectMarket({ ...options, wait: async () => {},
    fetcher: async () => { requests++; return new Response('private ' + secret, { status: 429, headers: { 'Retry-After': '600' } }); } });
  const result = await watchMarket({ directory, key: secret, collect, wait: async () => waits++ });
  assert.equal(result.state, 'FAILED'); assert.equal(requests, 1); assert.equal(waits, 0);
  assert.equal(JSON.parse(await readFile(join(directory, 'last-collection.json'))).httpStatus, 429);
  assert.equal(await readFile(join(directory, 'index.json'), 'utf8'), index);
  const after = await publishedMarket(directory);
  assert.deepEqual(after.observations, before.observations); assert.equal(after.publishedAt, before.publishedAt);
  await withMarketWriter(directory, async () => {
    const busy = await watchMarket({ directory, key: secret, collect });
    assert.equal(busy.state, 'FAILED'); assert.equal(requests, 1);
  });
}));

test('second scheduler is rejected before collection; abort drains current run and releases owned lock', async () => temporary(async directory => {
  const controller = new AbortController(); let calls = 0;
  const result = await watchMarket({ directory, signal: controller.signal, collect: async () => {
    calls++;
    await assert.rejects(watchMarket({ directory, collect: async () => { calls++; } }), { code: 'EEXIST' });
    controller.abort(); return { state: 'SUCCESS' };
  }, wait: async () => { throw Error('must not wait'); } });
  assert.equal(result.state, 'STOPPED'); assert.equal(calls, 1);
  assert.ok(!(await readdir(directory)).includes('.scheduler-lock'));
}));

test('an exception after successful publication stops the scheduler without undoing committed observations', async () => temporary(async directory => {
  let calls = 0;
  const result = await watchMarket({ directory, key: secret, collect: async options => {
    calls++;
    await collectMarket({ ...options, wait: async () => {}, fetcher: async url => response(new URL(url).pathname) });
    throw Error('private transport detail ' + secret);
  }, wait: async () => { throw Error('must not retry'); } });
  const data = await publishedMarket(directory);
  assert.equal(result.state, 'FAILED'); assert.equal(calls, 1);
  assert.equal(data.collectionState.state, 'SUCCESS'); assert.ok(data.observations.length > 0);
  assert.equal(data.schedulerState.state, 'FAILED'); assert.ok(!JSON.stringify(data).includes(secret));
  assert.ok(!(await readdir(directory)).includes('.scheduler-lock'));
}));

test('missed periods skip catch-up; wait cancellation exits gracefully; unsafe budgets/status rejected', async () => temporary(async directory => {
  let ticks = 0; const waits = [], controller = new AbortController();
  const result = await watchMarket({ directory, clock: () => ticks, signal: controller.signal,
    collect: async () => { ticks += intervalMs + 1000; return { state: 'SUCCESS' }; },
    wait: async ms => { waits.push(ms); controller.abort(); throw Error('aborted'); } });
  assert.deepEqual(waits, [intervalMs - 1000]); assert.equal(result.state, 'STOPPED');
  for (const maxRuns of [0, 289, 1.5]) await assert.rejects(watchMarket({ directory, maxRuns }), /INVALID_RUN_BUDGET/);
  assert.throws(() => validateSchedulerState({ ...result, requestLimit: 9999 }));
  assert.throws(() => validateSchedulerState({ ...result, secret }));
}));
