import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyTokenPrecondition, verifyTokenTransition, type TokenSample, type TokenPrecondition } from '../src/tron/lab/call-evidence.js';
const sample = (owner: bigint, allowance: bigint): TokenSample => ({ owner: owner.toString(), recipient: '0', spender: '0', totalSupply: (2n ** 128n).toString(), allowance: allowance.toString() });
test('TVM boundary preconditions distinguish balance from allowance failure and zero from unapproved positive calls', () => {
  const large = 2n ** 64n + 1n;
  const cases: Array<[TokenPrecondition, TokenSample, bigint]> = [
    ['ZERO_WITHOUT_ALLOWANCE', sample(large, 0n), 0n], ['UNAPPROVED', sample(large, 0n), 1n],
    ['BALANCE', sample(large, 0n), large + 1n], ['ALLOWANCE', sample(large, 1n), 2n],
    ['BALANCE_WITH_ALLOWANCE', sample(large, large + 1n), large + 1n],
  ];
  for (const [kind, state, amount] of cases) verifyTokenPrecondition(state, kind, amount);
  const invalid: Array<[TokenPrecondition, TokenSample, bigint]> = [
    ['ZERO_WITHOUT_ALLOWANCE', sample(large, 1n), 0n], ['ZERO_WITHOUT_ALLOWANCE', sample(large, 0n), 1n],
    ['UNAPPROVED', sample(0n, 0n), 1n], ['UNAPPROVED', sample(large, 1n), 1n],
    ['BALANCE', sample(large, 0n), large], ['ALLOWANCE', sample(0n, 1n), 2n],
    ['ALLOWANCE', sample(large, 2n), 2n], ['BALANCE_WITH_ALLOWANCE', sample(large, large), large + 1n],
    ['BALANCE_WITH_ALLOWANCE', sample(large, large), large], ['UNAPPROVED', sample(large, 0n), -1n],
    ['BALANCE', sample(large, 0n), 2n ** 256n], ['BALANCE_WITH_ALLOWANCE', sample(large, 2n ** 256n), large + 1n],
  ];
  for (const [kind, state, amount] of invalid) assert.throws(() => verifyTokenPrecondition(state, kind, amount), /FIXTURE_CALL_PRECONDITION/);
});
test('zero transfer and zero transferFrom require every sampled token state unchanged, including allowance', () => {
  const state = sample(2n ** 128n, 0n);
  for (const operation of ['transfer', 'transferFrom'] as const) {
    verifyTokenTransition(state, state, operation, 0n);
    for (const key of Object.keys(state)) assert.throws(() => verifyTokenTransition(state, { ...state, [key]: (BigInt(state[key as keyof TokenSample]) + 1n).toString() }, operation, 0n));
  }
});

test('balance-failing transferFrom must roll back its earlier allowance decrement completely', () => {
  const state = sample(10n, 11n);
  verifyTokenPrecondition(state, 'BALANCE_WITH_ALLOWANCE', 11n);
  verifyTokenTransition(state, state, 'REVERT', 11n);
  assert.throws(() => verifyTokenTransition(state, { ...state, allowance: '0' }, 'REVERT', 11n));
  assert.throws(() => verifyTokenTransition(state, { ...state, allowance: '10' }, 'REVERT', 11n));
});
