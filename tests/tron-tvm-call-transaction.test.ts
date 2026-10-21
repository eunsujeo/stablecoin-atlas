import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionData, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sha256 } from '../src/tron/lab/compiler.js';
import { serializeTronRaw } from '../src/tron/lab/transaction.js';
import { validateCallTransaction, prepareCallTransaction, signCallTransaction, encodeSignedCall } from '../src/tron/lab/call-transaction.js';
const key = ('0x' + '01'.padStart(64, '0')) as Hex, owner = '41' + privateKeyToAccount(key).address.slice(2).toLowerCase();
const contract = '41' + '33'.repeat(20), recipient = '41' + '22'.repeat(20), spender = '41' + '44'.repeat(20);
function fixture(lifetime = 60000n) {
  const data = encodeFunctionData({ abi: parseAbi(['function transfer(address,uint256) returns (bool)']), functionName: 'transfer',
    args: [('0x' + recipient.slice(2)) as Hex, 2n ** 128n + 1n] }).slice(2);
  const policy = { owner, contract, data, allowedSigners: [owner, recipient, spender], block: { number: '1', id: '0000000000000001' + 'ab'.repeat(24), timestamp: '1699999999000' }, now: '1700000000000' };
  const tx: any = { visible: false, raw_data: { ref_block_bytes: '0001', ref_block_hash: 'ab'.repeat(8), timestamp: policy.now,
    expiration: (BigInt(policy.now) + lifetime).toString(), fee_limit: '1000000000', contract: [{ type: 'TriggerSmartContract',
      parameter: { type_url: 'type.googleapis.com/protocol.TriggerSmartContract', value: { owner_address: owner, contract_address: contract, data } } }] } };
  tx.raw_data_hex = serializeTronRaw(tx); tx.txID = sha256(Buffer.from(tx.raw_data_hex, 'hex'));
  return { tx, policy };
}
test('Trigger signing authenticates exact calldata with large uint256 and serializes recovered local signer signature', async () => {
  const { tx, policy } = fixture(), original = JSON.stringify(tx);
  const signed = await signCallTransaction(tx, policy, key);
  assert.equal(JSON.stringify(tx), original); assert.equal(signed.signature.length, 1);
  assert(encodeSignedCall(signed, policy).endsWith('1241' + signed.signature[0]!.toLowerCase()));
  assert.equal(signed.raw_data_hex, tx.raw_data_hex);
  await assert.rejects(signCallTransaction(tx, policy, ('0x' + '02'.padStart(64, '0')) as Hex), /UNSAFE_DEPLOY/);
  assert.throws(() => encodeSignedCall(signed, { ...policy, now: '1700000060001' }), /UNSAFE_CALL/);
});
test('Trigger rejects calldata, caller, target, permission, funds, fee, TAPOS/hash and additional contract tampering before signing', () => {
  const changes: Array<(t: any) => void> = [
    t => { t.raw_data.contract[0].parameter.value.data += '00'; },
    t => { t.raw_data.contract[0].parameter.value.owner_address = recipient; },
    t => { t.raw_data.contract[0].parameter.value.contract_address = recipient; },
    t => { t.raw_data.contract.push(t.raw_data.contract[0]); }, t => { t.raw_data.contract[0].type = 'TransferContract'; },
    t => { t.raw_data.contract[0].parameter.type_url += 'Other'; }, t => { t.raw_data.contract[0].Permission_id = '1'; },
    t => { t.raw_data.contract[0].parameter.value.call_value = '1'; }, t => { t.raw_data.contract[0].parameter.value.call_token_value = '1'; },
    t => { t.raw_data.contract[0].parameter.value.token_id = '1'; }, t => { t.raw_data.fee_limit = '18446744073709551615'; },
    t => { t.raw_data.ref_block_bytes = '0002'; }, t => { t.raw_data.ref_block_hash = '00'.repeat(8); },
    t => { t.raw_data.timestamp = '1699990000000'; }, t => { t.raw_data.expiration = '1700000060001'; },
    t => { t.txID = '00'.repeat(32); }, t => { t.raw_data_hex += '00'; }, t => { t.signature = ['00']; },
    t => { t.raw_data.auths = [{}]; }, t => { t.raw_data.contract[0].parameter.value.unknown = 'secret'; },
  ];
  for (const change of changes) { const { tx, policy } = fixture(); change(tx); assert.throws(() => validateCallTransaction(tx, policy)); }
  const { tx, policy } = fixture(); assert.throws(() => validateCallTransaction(tx, { ...policy, allowedSigners: [recipient, spender, contract] }));
});
test('Trigger authenticates original TRE long expiry, shortens to 60s, and revalidates current time before encoding', async () => {
  const { tx, policy } = fixture(43200000n), original = JSON.stringify(tx);
  assert.throws(() => validateCallTransaction(tx, policy));
  const prepared = prepareCallTransaction(tx, policy); assert.equal(prepared.raw_data.expiration, '1700000060000');
  assert.notEqual(prepared.txID, tx.txID); assert.equal(JSON.stringify(tx), original);
  tx.txID = '00'.repeat(32); assert.throws(() => prepareCallTransaction(tx, policy));
});
