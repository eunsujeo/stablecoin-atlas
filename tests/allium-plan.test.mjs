import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {alliumPlan, alliumSurveyResult} from '../tools/allium-plan.mjs';
import {alliumArguments, main} from '../tools/allium-plan-cli.mjs';

const metadata = JSON.parse(await readFile(new URL('../data/market-registration.json', import.meta.url)));
const legacy = JSON.parse(await readFile(new URL('../data/asset-registry.json', import.meta.url)));
const plan = () => alliumPlan(metadata, legacy, {asOfDay: '2026-10-23'});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(kind, mutation = () => {}) {
  const p = plan(), job = p.jobs.find(j => j.kind === kind);
  const data = p.targets.filter(t => t.family !== 'XRPL').map(t => {
    const common = {deployment_id: t.deploymentId, coin_id: t.coinId, requested_chain: t.networkId, requested_address: t.identity.address, observed_chain: t.networkId, observed_address: t.identity.address};
    return {...common, ...(kind === 'registry' ? {product_id: t.coinId, currency: t.currency.toLowerCase(), decimals_str: '6', is_native: true, is_verified: false} : kind === 'supply' ?
      {provider_day: '2026-10-21', total_supply_str: '100.000000000000000001', circulating_supply_str: '90', adjusted_circulating_supply_str: null, total_supply_usd_str: '99', circulating_supply_usd_str: '89', adjusted_circulating_supply_usd_str: null, is_native: true} :
      {provider_day: '2026-10-21', transfer_volume_str: '100.000000000000000001', transfer_volume_usd_str: '99', transfer_count_str: '9007199254740993', transfer_tx_count_str: '2', adjusted_volume_usd_str: null, has_adjusted_volume: false})};
  });
  const response = {sql: job.sql, data, queried_at: '2026-10-23T01:02:03.123456Z', meta: {row_count: data.length}, run_id: 'private-run'};
  mutation(response);
  const bytes = Buffer.from(JSON.stringify(response));
  return {p, bytes, options: {expectedHash: sha(bytes), now: '2026-10-24T00:00:00.000Z'}};
}
function review(kind, mutate) { const f = fixture(kind, mutate); return alliumSurveyResult(f.p, kind, f.bytes, f.options); }

test('offline plan pins approved identities and a seven-day exclusive UTC scheduling window without claiming coverage', async () => {
  const p = plan();
  assert.equal(p.targets.length, 13); assert.equal(p.targets.filter(t => t.family !== 'XRPL').length, 11);
  assert(p.targets.every(t => t.state === 'NOT_TESTED'));
  assert.deepEqual(p.window, {from: '2026-10-16', untilExclusive: '2026-10-23', days: 7, dateBasis: 'PROVIDER_DAY', aggregateTimezone: 'UNKNOWN'});
  assert.deepEqual([p.providerRequests, p.databaseWrites, p.scheduleWrites, p.executionEnabled], [0, 0, 0, false]);
  assert.equal(p.budget.maxHttpRequests, 39); assert.equal(p.budget.billingLimit, null);
  assert.equal(p.budget.retries, 0); assert.equal(p.budget.pages, 1);
  for (const j of p.jobs) {
    assert(j.sql.includes('LEFT JOIN')); assert(j.sql.includes("a.family = 'EVM' THEN LOWER("));
    assert.equal(j.resultLimit, j.expectedMaxRows + 1);
    assert(!j.sql.includes('rGm7')); assert.equal(j.sqlHash, sha(Buffer.from(j.sql)));
  }
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error('UNEXPECTED_NETWORK'); };
  try { assert.deepEqual(await main(['plan', '--day', '2026-10-23']), p); } finally { globalThis.fetch = realFetch; }
});

test('planner rejects identity drift, new deployments and invalid dates; calendar boundaries retain seven days', () => {
  for (const asOfDay of ['2026-02-30', '2026-10-23T00:00:00Z', undefined, '2000-01-01']) assert.throws(() => alliumPlan(metadata, legacy, {asOfDay}));
  assert.equal(alliumPlan(metadata, legacy, {asOfDay: '2028-03-01'}).window.from, '2028-02-23');
  const changed = structuredClone(metadata); changed.networks.find(n => n.id === 'polygon').networkIdentity = '999';
  assert.throws(() => alliumPlan(changed, legacy, {asOfDay: '2026-10-23'}));
  const extra = structuredClone(metadata); extra.newDeployments[0].id = 'unapproved';
  assert.throws(() => alliumPlan(extra, legacy, {asOfDay: '2026-10-23'}));
});

test('review preserves exact amounts, missing values, native/provider quality flags and original date, and strips private metadata', () => {
  for (const kind of ['registry', 'supply', 'volume']) {
    const result = review(kind);
    assert.equal(result.rows.length, 11); assert.equal(result.deferred.length, 2);
    assert(result.rows.every(r => r.state === 'OBSERVED'));
    assert(!JSON.stringify(result).includes('SELECT')); assert(!JSON.stringify(result).includes('private-run'));
    assert.equal(result.queriedAt, '2026-10-23T01:02:03.123456Z');
    if (kind === 'supply') { assert.equal(result.rows[0].values.total_supply, '100.000000000000000001'); assert.equal(result.rows[0].values.adjusted_circulating_supply, null); assert.equal(result.rows[0].providerDay, '2026-10-21'); }
    if (kind === 'volume') assert.equal(result.rows[0].values.transfer_count, '9007199254740993');
    if (kind === 'registry') assert.equal(result.rows[0].values.providerVerified, false);
  }
});

test('LEFT JOIN absence remains inconclusive while zero is observed; registry absence does not prove metric absence', () => {
  for (const kind of ['registry', 'supply', 'volume']) {
    const r = review(kind, p => { for (const k of Object.keys(p.data[0])) if (!['deployment_id', 'coin_id', 'requested_chain', 'requested_address'].includes(k)) p.data[0][k] = null; });
    assert.equal(r.rows[0].state, 'INCONCLUSIVE');
  }
  assert.equal(review('supply', p => p.data[0].total_supply_str = '0').rows[0].state, 'OBSERVED');
});

test('review rejects truncated or partial coverage, duplicates, unexpected SQL/hash, future times and untrusted amounts', () => {
  const mutations = [p => p.data.splice(0, 1), p => p.data.push(p.data[0]), p => { p.data = []; }, p => p.sql += ' ', p => p.queried_at = '2026-10-25T00:00:00Z',
    p => p.queried_at = '2026-10-22T23:59:59Z', p => p.data[0].provider_day = '2026-10-23', p => p.data[0].provider_day = '2026-10-15',
    p => p.data[0].total_supply_str = 100, p => p.data[0].total_supply_str = '-1', p => p.data[0].coin_id = 'unknown', p => p.data[0].observed_chain = 'wrong'];
  for (const mutate of mutations) assert.throws(() => review('supply', p => { mutate(p); p.meta.row_count = p.data.length; }));
  assert.throws(() => review('volume', p => p.data[0].transfer_count_str = '1.5'));
  assert.throws(() => review('volume', p => p.data[0].adjusted_volume_usd_str = '1'));
  assert.throws(() => review('registry', p => p.data[0].currency = 'eur'));
  assert.throws(() => review('registry', p => p.data[0].decimals_str = 6));
  assert.throws(() => review('supply', p => { p.data = Array.from({length: 78}, () => p.data[0]); p.meta.row_count = 78; }));
  assert.throws(() => review('supply', p => p.sql = plan().jobs.find(j => j.kind === 'volume').sql));
  const f = fixture('supply');
  assert.throws(() => alliumSurveyResult(f.p, 'supply', f.bytes, {...f.options, expectedHash: '0'.repeat(64)}));
  f.p.window.days = 8; assert.throws(() => alliumSurveyResult(f.p, 'supply', f.bytes, f.options));
});

test('review rejects invalid UTF-8, excessive nesting and response byte limit before projection', () => {
  const f = fixture('supply');
  for (const bytes of [Buffer.from([0xff]), Buffer.from('['.repeat(33) + '0' + ']'.repeat(33)), Buffer.alloc(2097153)]) {
    assert.throws(() => alliumSurveyResult(f.p, 'supply', bytes, {...f.options, expectedHash: sha(bytes)}));
  }
});

test('case-sensitive Solana/TRON identity is retained; only EVM address case is folded', () => {
  assert.throws(() => review('registry', p => { const r = p.data.find(r => r.requested_chain === 'solana'); r.observed_address = r.observed_address.toLowerCase(); }));
  assert.throws(() => review('registry', p => { const r = p.data.find(r => r.requested_chain === 'tron'); r.observed_address = r.observed_address.toLowerCase(); }));
  assert.equal(review('registry', p => { const r = p.data.find(r => r.requested_chain === 'ethereum'); r.observed_address = r.observed_address.toUpperCase(); }).rows.length, 11);
});

test('CLI has no execution or implicit day mode and rejects unknown/duplicate/missing flags', () => {
  assert.equal(alliumArguments(['plan', '--day', '2026-10-23']).command, 'plan');
  for (const args of [['run'], ['plan'], ['plan', '--day', 'x', '--day', 'y'], ['plan', '--day', 'x', '--execute', 'true'], ['review', '--day', 'x']]) assert.throws(() => alliumArguments(args));
});
