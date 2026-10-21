import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateMock, sumSupply, sortSupply, selectRows, historyFor, percent, exact, compact, coordinate } from './model.js';
const fixture = JSON.parse(await readFile(new URL('../docs/ui/mock-dashboard-data.json', import.meta.url), 'utf8'));
test('mock model preserves exact large amounts, independent scope totals, history and stable bigint ordering', () => {
  validateMock(fixture);
  assert.equal(sumSupply(selectRows(fixture, 'coins')), 220000000000n);
  assert.equal(sumSupply(selectRows(fixture, 'profiles')), 100000000000n);
  assert.equal(sumSupply(selectRows(fixture, 'profiles', 'USDC')), 30000000000n);
  assert.equal(historyFor(fixture).at(0).value, '170000000000');
  assert.equal(historyFor(fixture, 'USDC').at(-1).value, '80000000000');
  const rows = [{ id: 'high', supply: '9007199254740993' }, { id: 'low', supply: '9007199254740992' }, { id: 'tie', supply: '9007199254740993' }];
  assert.deepEqual(sortSupply(rows).map(r => r.id), ['high', 'tie', 'low']);
  assert.deepEqual(sortSupply(rows, true).map(r => r.id), ['low', 'high', 'tie']);
  assert.equal(exact(rows[0].supply), '9,007,199,254,740,993');
  assert.equal(percent('1', '3'), '33.3%'); assert.equal(percent('2', '3'), '66.7%');
  assert.equal(compact('120000000000'), '1,200억'); assert.equal(compact('123456789'), '1.23억');
  assert.equal(coordinate('9007199254740992', '9007199254740993'), 999);
});
test('missing/malformed values cannot become zero and explicit zero is retained without a fabricated ratio', () => {
  for (const invalid of [undefined, null, 0, 1e12, '1e12', '-1', '01', '1.2', '', '9'.repeat(79)]) {
    const mock = structuredClone(fixture); mock.coins[0].supply = invalid; assert.throws(() => validateMock(mock), /INVALID_MOCK/);
  }
  for (const change of [m => { m.allValuesAreFictional = false; }, m => { m.profiles[0].chain = 'Other'; }, m => { m.profiles[0].asset = 'USDT'; m.profiles[0].chain = 'XRPL'; }, m => { m.profiles[1] = m.profiles[0]; }, m => { m.coins[0].history[5] = '1'; }]) { const mock = structuredClone(fixture); change(mock); assert.throws(() => validateMock(mock)); }
  const mock = structuredClone(fixture);
  for (const row of [...mock.coins, ...mock.profiles]) { row.supply = '0'; if (row.history) row.history = row.history.map(() => '0'); }
  validateMock(mock); assert.equal(sumSupply(mock.coins), 0n); assert.equal(historyFor(mock)[0].value, '0');
  assert.equal(percent('0', '0'), '—'); assert.equal(percent('0', '1'), '0.0%');
  assert.throws(() => coordinate('1', '0')); assert.throws(() => coordinate('2', '1')); assert.throws(() => coordinate('1', '2', 10001));
});
