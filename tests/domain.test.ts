import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enforceEvidence, evaluate, json, summarize, toBaseUnits } from '../src/domain/evaluator.js';
import { known, na, unknown, type Evidence } from '../src/domain/model.js';
import { classifyReturn } from '../src/evm/abi.js';
import { isRevert, RpcError } from '../src/evm/rpc.js';
const observed: Evidence = { id: 'e1', provenance: 'OBSERVED', observedAt: '2026-01-01T00:00:00Z', observedBlockOrSlot: '1', kind: 'TEST', data: { balance: '1' } };
test('PASS requires observed evidence and a known condition', () => {
  assert.equal(evaluate(true, []), 'INCONCLUSIVE');
  assert.equal(evaluate(true, [{ ...observed, provenance: 'INFERRED' }]), 'INCONCLUSIVE');
  assert.equal(evaluate(undefined, [observed]), 'INCONCLUSIVE');
  assert.equal(evaluate(false, [observed]), 'FAIL');
  assert.equal(evaluate(true, [observed]), 'PASS');
  for (const verdict of ['PASS', 'FAIL'] as const) {
    assert.equal(enforceEvidence({ verdict, support: 'UNKNOWN', observations: {} }, []).verdict, 'INCONCLUSIVE');
  }
});
test('identity unknown, inapplicable and known zero remain distinct', () => {
  assert.notDeepEqual(unknown('unknown issuer'), na('not an EVM field'));
  assert.deepEqual(known(0), { status: 'KNOWN', value: 0 });
});
test('amounts remain exact above Number.MAX_SAFE_INTEGER', () => {
  assert.equal(toBaseUnits('9007199254740993.123456', 6), 9007199254740993123456n);
  assert.equal(toBaseUnits('0', 0), 0n);
  assert.equal(toBaseUnits('1', 255), 10n ** 255n);
  for (const amount of ['1.0000001', '-1', '1e6', '01', 'NaN']) assert.throws(() => toBaseUnits(amount, 6));
  for (const decimals of [-1, 256, 1.5]) assert.throws(() => toBaseUnits('1', decimals));
  assert.equal(JSON.parse(json({ amount: 9007199254740993n })).amount, '9007199254740993');
});
test('return classification rejects malformed and noncanonical booleans', () => {
  assert.equal(classifyReturn('0x'), 'EMPTY');
  assert.equal(classifyReturn('0x' + '0'.repeat(63) + '1'), 'TRUE');
  assert.equal(classifyReturn('0x' + '0'.repeat(64)), 'FALSE');
  for (const data of ['0x01', '0xff', '0x' + '0'.repeat(63) + '2']) assert.equal(classifyReturn(data), 'MALFORMED');
});
test('unsupported and untested capabilities never acquire a positive result', () => {
  const summary = summarize({ results: [] });
  assert(summary.every(r => r.support === 'UNKNOWN' && r.verdicts.length === 1 && r.verdicts[0] === 'NOT_TESTED'));
});
test('transport and arbitrary RPC errors are not called token reverts', () => {
  assert.equal(isRevert(new Error('RPC transport/protocol failure')), false);
  assert.equal(isRevert(new RpcError(-32601, 'method not found')), false);
  assert.equal(isRevert(new RpcError(3, 'execution reverted')), true);
});
