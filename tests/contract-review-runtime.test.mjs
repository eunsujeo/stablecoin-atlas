import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { batchExperiments } from '../src/contract-review/lab.mjs';
test('owned Anvil batch fixture verifies CALL/delegated context, state, events, failure, residual value and disposable allowance behavior', { timeout: 90000 }, async () => {
  const source = await readFile(new URL('./fixtures/ContractReview.sol', import.meta.url), 'utf8');
  const result = await batchExperiments(source); assert.equal(result.status, 'PASS'); assert.equal(result.checks.length, 10); assert(result.checks.every(x => x.status === 'PASS')); assert.equal(result.environment, 'PROGRAM_OWNED_NEW_LOOPBACK_ANVIL');
});
