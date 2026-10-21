import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeAbiParameters, toEventSelector } from 'viem';
import { verifyTransferProbe } from '../src/tron/lab/negative.js';
import { serializeTronRaw } from '../src/tron/lab/transaction.js';
import { sha256, compileTronFixture, type TronFixture } from '../src/tron/lab/compiler.js';
import { runNegativeFixtureSuite } from '../src/tron/lab/negative-suite.js';
const owner = '41' + '11'.repeat(20), recipient = '41' + '22'.repeat(20), contract = '41' + '33'.repeat(20), amount = 2n ** 64n + 123n, supply = 2n ** 128n;
function fixture(variant: TronFixture) {
  const raw = { ref_block_bytes: '0001', ref_block_hash: 'ab'.repeat(8), timestamp: '1700000000000', expiration: '1700000060000', fee_limit: '1000000000',
    contract: [{ type: 'TriggerSmartContract', parameter: { type_url: 'type.googleapis.com/protocol.TriggerSmartContract', value: { owner_address: owner, contract_address: contract, data: '12345678' } } }] };
  const rawDataHex = serializeTronRaw({ raw_data: raw }), txid = sha256(Buffer.from(rawDataHex, 'hex'));
  const event = { name: 'Transfer' as const, first: owner, second: recipient, amount };
  const before = { owner: supply.toString(), recipient: '0', spender: '0', allowance: '0', totalSupply: supply.toString() };
  const after = { ...before, owner: (supply - amount).toString(), recipient: amount.toString() };
  const receipt: any = { id: txid, blockNumber: '2', receipt: { result: 'SUCCESS' }, contractResult: [variant === 'false-return' ? '0'.repeat(64) : variant === 'malformed-return' ? '0'.repeat(63) + '2' : '0'.repeat(63) + '1'],
    log: variant === 'missing-event' ? [] : [{ address: contract.slice(2), topics: [toEventSelector('Transfer(address,address,uint256)').slice(2), '0'.repeat(24) + owner.slice(2), '0'.repeat(24) + recipient.slice(2)], data: encodeAbiParameters([{ type: 'uint256' }], [amount]).slice(2) }] };
  const block: any = { blockID: '0000000000000002' + 'ab'.repeat(24), block_header: { raw_data: { number: '2' } }, transactions: [{ txID: txid, raw_data: raw, ret: [{ contractRet: 'SUCCESS' }] }] };
  const binding = { owner, data: '12345678', rawDataHex };
  const verify = () => verifyTransferProbe(variant, receipt, block, txid, contract, event, binding, before, after);
  return { receipt, block, after, verify };
}
test('private negative probes distinguish canonical false, malformed bool 2 and missing log from the normal control', () => {
  for (const variant of ['standard', 'false-return', 'malformed-return', 'missing-event'] as const) {
    const result = fixture(variant).verify();
    assert.equal(result.fixtureVerdict, variant === 'standard' ? 'PASS' : 'FAIL');
    assert.equal(result.validatorRegression, variant === 'standard' ? 'NORMAL_ACCEPTANCE_OBSERVED' : 'EXPECTED_REJECTION_OBSERVED');
    assert.equal(result.actualError, variant === 'standard' ? 'NONE' : variant === 'missing-event' ? 'FIXTURE_CALL_LOG_MISMATCH' : 'FIXTURE_CALL_RETURN_MISMATCH');
    assert.equal(result.after.recipient, amount.toString()); assert.equal(result.stateResponseBlock, 'UNKNOWN');
  }
});
test('negative regression cannot count wrong receipt/block/body, REVERT, wrong state or multiple defects as expected rejection', () => {
  const mutations: Array<(f: ReturnType<typeof fixture>) => void> = [
    f => { f.receipt.id = '00'.repeat(32); }, f => { f.block.blockID = '00'.repeat(32); },
    f => { f.block.transactions[0].raw_data.contract[0].parameter.value.owner_address = recipient; },
    f => { f.receipt.receipt.result = 'REVERT'; f.receipt.result = 'FAILED'; },
    f => { f.receipt.receipt.result = 'OUT_OF_ENERGY'; }, f => { f.block.transactions = []; },
    f => { f.after.owner = supply.toString(); }, f => { f.after.allowance = '1'; },
  ];
  for (const variant of ['false-return', 'malformed-return', 'missing-event'] as const) for (const mutate of mutations) {
    const f = fixture(variant); mutate(f); assert.throws(f.verify);
  }
  for (const variant of ['false-return', 'malformed-return'] as const) {
    const f = fixture(variant); f.receipt.log = []; assert.throws(f.verify, /FIXTURE_CALL_LOG_MISMATCH/);
  }
  for (const variant of ['false-return', 'malformed-return', 'missing-event'] as const) {
    const f = fixture(variant); f.receipt.contractResult = []; assert.throws(f.verify, /FIXTURE_NEGATIVE_TRAIT_MISMATCH/);
    const g = fixture(variant); g.receipt.contractResult = ['0'.repeat(64)]; if (variant !== 'false-return') assert.throws(g.verify);
  }
});
test('compiler rejects unknown source selections before cache access or download', async () => {
  await assert.rejects(compileTronFixture('../outside.sol' as TronFixture), /FIXTURE_VARIANT_REJECTED/);
  await assert.rejects(compileTronFixture('__proto__' as TronFixture), /FIXTURE_VARIANT_REJECTED/);
});
test('negative suite requires a passing normal control and stops on errors with remaining probes NOT_TESTED', async () => {
  for (const fault of ['none', 'normal', 'negative', 'cleanup', 'throw', 'abort']) {
    let calls = 0; const controller = new AbortController(); if (fault === 'abort') controller.abort();
    const run: any = async (_signal: unknown, exercise: boolean, boundary: boolean, variant: string) => {
      assert.equal(exercise, false); assert.equal(boundary, false); calls++;
      if (fault === 'throw') throw Error('UPSTREAM_SECRET_CANARY');
      const bad = fault === 'normal' && variant === 'standard' || fault === 'negative' && variant === 'false-return' || fault === 'cleanup';
      return { outcome: bad ? 'ERROR' : 'OBSERVED', runtime: { cleanup: { container: fault === 'cleanup' ? 'FAILED' : 'REMOVED', network: 'REMOVED' } },
        evidence: { probe: { observation: { fixtureVerdict: variant === 'standard' ? 'PASS' : 'FAIL', validatorRegression: variant === 'standard' ? 'NORMAL_ACCEPTANCE_OBSERVED' : 'EXPECTED_REJECTION_OBSERVED' } } } };
    };
    const report = await runNegativeFixtureSuite(controller.signal, run);
    assert.equal(report.outcome, fault === 'none' ? 'OBSERVED' : 'ERROR');
    assert.equal(calls, fault === 'none' ? 4 : fault === 'negative' ? 2 : fault === 'abort' ? 0 : 1);
    if (fault !== 'none') assert(report.cases.slice(calls).every(c => c.outcome === 'NOT_TESTED'));
    assert(!JSON.stringify(report).includes('UPSTREAM_SECRET_CANARY'));
  }
});
