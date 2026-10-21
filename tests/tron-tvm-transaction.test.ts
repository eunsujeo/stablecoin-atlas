import { test } from 'node:test';
import assert from 'node:assert/strict';
import utils from 'tronweb/utils';
import { privateKeyToAccount } from 'viem/accounts';
import { sha256 } from '../src/tron/lab/compiler.js';
import { parseTronJson, decimal } from '../src/tron/lab/lossless.js';
import { validateDeployTransaction, encodeSignedDeployment, prepareDeploymentTransaction, signVerifiedDeployment, expectedContract, feeLimit, originEnergyLimit, type DeployPolicy } from '../src/tron/lab/transaction.js';
const privateKey = ('0x' + '01'.padStart(64, '0')) as `0x${string}`;
const owner = '41' + privateKeyToAccount(privateKey).address.slice(2).toLowerCase();
function fixture() {
  const abi = [{ type: 'constructor', inputs: [], stateMutability: 'nonpayable' }];
  const policy: DeployPolicy = { owner, abi, bytecode: '60006000', now: '1700000000000',
    block: { number: '1', id: '0000000000000001' + 'ab'.repeat(24), timestamp: '1699999999000' } };
  const tx: any = { visible: false, raw_data: { ref_block_bytes: '0001', ref_block_hash: 'ab'.repeat(8),
    timestamp: policy.now, expiration: '1700000060000', fee_limit: feeLimit,
    contract: [{ type: 'CreateSmartContract', parameter: { type_url: 'type.googleapis.com/protocol.CreateSmartContract',
      value: { owner_address: owner, new_contract: { origin_address: owner, abi: { entrys: abi }, bytecode: policy.bytecode,
        consume_user_resource_percent: '100', origin_energy_limit: originEnergyLimit, name: 'TronStandardToken' } } } }] } };
  const pb = structuredClone(tx);
  for (const key of ['timestamp', 'expiration', 'fee_limit']) pb.raw_data[key] = Number(pb.raw_data[key]);
  for (const key of ['consume_user_resource_percent', 'origin_energy_limit']) pb.raw_data.contract[0].parameter.value.new_contract[key] = Number(pb.raw_data.contract[0].parameter.value.new_contract[key]);
  tx.raw_data_hex = utils.transaction.txPbToRawDataHex(utils.transaction.txJsonToPb(pb)).toLowerCase();
  tx.txID = sha256(Buffer.from(tx.raw_data_hex, 'hex'));
  return { tx, policy };
}
test('TRON native JSON preserves uint64/uint256 above 2^53 and rejects unsafe numeric representations', () => {
  const u64 = '18446744073709551615', u256 = (2n ** 256n - 1n).toString();
  const parsed = parseTronJson(`{"fee":${u64},"amount":${u256},"ok":true}`);
  assert.equal(parsed.fee, u64); assert.equal(parsed.amount, u256); assert.equal(decimal(parsed.amount), 2n ** 256n - 1n);
  assert.equal(JSON.stringify(parsed), `{"fee":"${u64}","amount":"${u256}","ok":true}`);
  for (const text of ['1.5', '1e20', '1e999']) assert.throws(() => parseTronJson(text), /LOSSLESS/);
  for (const v of [9007199254740992, '-1', '01', '1e3']) assert.throws(() => decimal(v));
});
test('verified deployment signs exact protobuf hash and recovers the disposable owner without a provider', async () => {
  const { tx, policy } = fixture(), before = JSON.stringify(tx);
  assert.deepEqual(validateDeployTransaction(tx, policy), tx);
  const signed = await signVerifiedDeployment(tx, policy, privateKey);
  assert.equal(JSON.stringify(tx), before); assert.equal(signed.signature.length, 1);
  const hex = encodeSignedDeployment(signed, policy);
  let length = tx.raw_data_hex.length / 2; const prefix: number[] = [];
  do { const byte = length & 127; length >>>= 7; prefix.push(byte | (length ? 128 : 0)); } while (length);
  assert.equal(hex, '0a' + Buffer.from(prefix).toString('hex') + tx.raw_data_hex + '1241' + signed.signature[0]!.toLowerCase());
  assert.equal(signed.raw_data_hex, tx.raw_data_hex); assert.equal(expectedContract(owner, tx.txID).hex.length, 42);
});
test('deployment tampering is rejected before signing: multiple contracts, hash, owner, permission, funds, ABI and TAPOS', () => {
  const changes: Array<(tx: any) => void> = [
    t => t.raw_data.contract.push(structuredClone(t.raw_data.contract[0])),
    t => { t.txID = '00'.repeat(32); }, t => { t.raw_data_hex += '00'; },
    t => { t.signature = ['00']; }, t => { t.raw_data.data = '00'; },
    t => { t.raw_data.contract[0].parameter.value.owner_address = '41' + '00'.repeat(20); },
    t => { t.raw_data.contract[0].parameter.value.new_contract.origin_address = '41' + '00'.repeat(20); },
    t => { t.raw_data.contract[0].Permission_id = '2'; },
    t => { t.raw_data.contract[0].parameter.value.call_token_value = '1'; },
    t => { t.raw_data.contract[0].parameter.value.new_contract.call_value = '1'; },
    t => { t.raw_data.contract[0].parameter.value.new_contract.bytecode = '6001'; },
    t => { t.raw_data.contract[0].parameter.value.new_contract.abi.entrys = []; },
    t => { t.raw_data.ref_block_hash = '00'.repeat(8); }, t => { t.raw_data.ref_block_bytes = '0002'; },
    t => { t.raw_data.expiration = '1700000060001'; }, t => { t.raw_data.timestamp = '1699990000000'; },
    t => { t.raw_data.fee_limit = '18446744073709551615'; },
  ];
  for (const change of changes) { const { tx, policy } = fixture(); change(tx); assert.throws(() => validateDeployTransaction(tx, policy), /UNSAFE_DEPLOY/); }
});

test('TRE long-expiry transaction is verified before shortening and recomputing its hash', () => {
  const { tx, policy } = fixture();
  tx.raw_data.expiration = (BigInt(policy.now) + 43200000n).toString();
  const copy = structuredClone(tx);
  for (const field of ['fee_limit', 'timestamp', 'expiration']) copy.raw_data[field] = Number(copy.raw_data[field]);
  for (const field of ['consume_user_resource_percent', 'origin_energy_limit']) copy.raw_data.contract[0].parameter.value.new_contract[field] = Number(copy.raw_data.contract[0].parameter.value.new_contract[field]);
  tx.raw_data_hex = utils.transaction.txPbToRawDataHex(utils.transaction.txJsonToPb(copy)).toLowerCase();
  tx.txID = sha256(Buffer.from(tx.raw_data_hex, 'hex'));
  const original = JSON.stringify(tx);
  assert.throws(() => validateDeployTransaction(tx, policy), /UNSAFE_DEPLOY_TIME/);
  const prepared = prepareDeploymentTransaction(tx, policy);
  assert.equal(prepared.raw_data.expiration, '1700000060000'); assert.notEqual(prepared.txID, tx.txID);
  assert.equal(JSON.stringify(tx), original);
  tx.txID = '00'.repeat(32); assert.throws(() => prepareDeploymentTransaction(tx, policy), /UNSAFE_DEPLOY_SERIALIZATION/);
});
