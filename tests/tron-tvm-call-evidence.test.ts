import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeTronRaw } from '../src/tron/lab/transaction.js';
import { sha256 } from '../src/tron/lab/compiler.js';
import { encodeAbiParameters, toEventSelector } from 'viem';
import { verifyCallReceipt, verifyTokenTransition, type TokenSample } from '../src/tron/lab/call-evidence.js';
const owner = '41' + '11'.repeat(20), recipient = '41' + '22'.repeat(20), contract = '41' + '33'.repeat(20), amount = 2n ** 64n + 1n;
const raw = { ref_block_bytes: '0001', ref_block_hash: 'ab'.repeat(8), timestamp: '1700000000000', expiration: '1700000060000', fee_limit: '1000000000',
  contract: [{ type: 'TriggerSmartContract', parameter: { type_url: 'type.googleapis.com/protocol.TriggerSmartContract',
    value: { owner_address: owner, contract_address: contract, data: '12345678' } } }] };
const rawHex = serializeTronRaw({ raw_data: raw }), txid = sha256(Buffer.from(rawHex, 'hex'));
const binding = { owner, data: '12345678', rawDataHex: rawHex };
function fixture(name: 'Transfer' | 'Approval' = 'Transfer', value = amount) {
  return { expected: { name, first: owner, second: recipient, amount: value },
    receipt: { id: txid, blockNumber: '2', receipt: { result: 'SUCCESS' }, contractResult: ['0'.repeat(63) + '1'],
      log: [{ address: contract.slice(2), topics: [toEventSelector(`${name}(address,address,uint256)`).slice(2),
        '0'.repeat(24) + owner.slice(2), '0'.repeat(24) + recipient.slice(2)], data: encodeAbiParameters([{ type: 'uint256' }], [value]).slice(2) }] },
    block: { blockID: '0000000000000002' + 'ef'.repeat(24), block_header: { raw_data: { number: '2' } }, transactions: [{ txID: txid, raw_data: structuredClone(raw), ret: [{ contractRet: 'SUCCESS' }] }] } };
}
test('TVM receipt requires exact boolean, emitter, topics, uint256 data and actual successful block inclusion', () => {
  for (const name of ['Transfer', 'Approval'] as const) {
    const f = fixture(name), evidence = verifyCallReceipt(f.receipt, f.block, txid, contract, f.expected, binding);
    assert.equal(evidence.event?.amount, amount.toString()); assert.equal(evidence.returnValue, true);
  }
  const changes: Array<(r: any, b: any) => void> = [
    r => { r.id = '00'.repeat(32); }, r => { r.receipt.result = 'OUT_OF_ENERGY'; },
    r => { r.result = 'FAILED'; }, r => { r.contractResult = []; }, r => { r.contractResult = ['0'.repeat(64)]; },
    r => { r.contractResult[0] += '00'; }, r => { r.log = []; }, r => { r.log.push(r.log[0]); },
    r => { r.log[0].address = owner.slice(2); }, r => { r.log[0].topics.reverse(); },
    r => { r.log[0].topics[1] = '1' + r.log[0].topics[1].slice(1); }, r => { r.log[0].data = '00'.repeat(32); },
    (_r, b) => { b.transactions[0].raw_data.contract.push(b.transactions[0].raw_data.contract[0]); },
    (_r, b) => { b.transactions[0].raw_data.contract[0].parameter.value.data = 'ffffffff'; },
    (_r, b) => { b.transactions[0].raw_data.contract[0].parameter.value.owner_address = recipient; },
    (_r, b) => { b.transactions = []; }, (_r, b) => { b.blockID = '00'.repeat(32); },
    (_r, b) => { b.transactions[0].ret[0].contractRet = 'REVERT'; }, r => { r.blockNumber = '3'; },
  ];
  for (const change of changes) { const f = fixture(); change(f.receipt, f.block); assert.throws(() => verifyCallReceipt(f.receipt, f.block, txid, contract, f.expected, binding)); }
});
test('expected REVERT needs included REVERT, failed receipt and no committed logs', () => {
  const f = fixture(); const receipt: any = { ...f.receipt, result: 'FAILED', receipt: { result: 'REVERT' }, log: [] };
  f.block.transactions[0]!.ret[0]!.contractRet = 'REVERT';
  assert.equal(verifyCallReceipt(receipt, f.block, txid, contract, 'REVERT', binding).executionResult, 'REVERT');
  receipt.log = f.receipt.log; assert.throws(() => verifyCallReceipt(receipt, f.block, txid, contract, 'REVERT', binding));
  receipt.log = []; receipt.receipt.result = 'OUT_OF_ENERGY'; assert.throws(() => verifyCallReceipt(receipt, f.block, txid, contract, 'REVERT', binding));
});
test('sampled token states verify transfer, approval, consumption, revocation and revert without lossy arithmetic', () => {
  const supply = 2n ** 128n;
  const before: TokenSample = { owner: supply.toString(), recipient: '0', spender: '0', allowance: '0', totalSupply: supply.toString() };
  const transfer = { ...before, owner: (supply - amount).toString(), recipient: amount.toString() };
  verifyTokenTransition(before, transfer, 'transfer', amount);
  const approved = { ...transfer, allowance: amount.toString() }; verifyTokenTransition(transfer, approved, 'approve', amount);
  const moved = { ...approved, owner: (supply - 2n * amount).toString(), recipient: (2n * amount).toString(), allowance: '0' };
  verifyTokenTransition(approved, moved, 'transferFrom', amount);
  verifyTokenTransition(approved, { ...approved, allowance: '0' }, 'approve', 0n);
  verifyTokenTransition(before, before, 'REVERT', 1n);
  for (const key of Object.keys(moved)) assert.throws(() => verifyTokenTransition(approved, { ...moved, [key]: (BigInt(moved[key as keyof TokenSample]) + 1n).toString() }, 'transferFrom', amount));
  assert.throws(() => verifyTokenTransition(before, { ...before, allowance: '1' }, 'REVERT', 1n));
});

test('zero-value Transfer requires canonical true and exactly one zero event, not a missing or nonzero log', () => {
  const f = fixture('Transfer', 0n);
  assert.equal(verifyCallReceipt(f.receipt, f.block, txid, contract, f.expected, binding).event?.amount, '0');
  const changes: Array<(r: any) => void> = [r => { r.log = []; }, r => { r.contractResult = ['0'.repeat(64)]; },
    r => { r.log[0].data = '0'.repeat(63) + '1'; }, r => { r.log.push(r.log[0]); }];
  for (const change of changes) { const r = structuredClone(f.receipt); change(r); assert.throws(() => verifyCallReceipt(r, f.block, txid, contract, f.expected, binding)); }
});
