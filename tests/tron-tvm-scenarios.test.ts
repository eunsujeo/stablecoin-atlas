import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, encodeFunctionResult, encodeAbiParameters, parseAbi, toEventSelector, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { runTokenScenarios } from '../src/tron/lab/scenarios.js';
import { tronAddress } from '../src/tron/address.js';
import { sha256 } from '../src/tron/lab/compiler.js';
import { serializeTronRaw } from '../src/tron/lab/transaction.js';
import type { PrivateFixtureSession } from '../src/tron/lab/runtime.js';
const abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)',
  'function allowance(address,address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)',
  'function approve(address,uint256) returns (bool)', 'function transferFrom(address,address,uint256) returns (bool)']);
const actors = [1, 2, 3].map(n => { const privateKey = ('0x' + String(n).padStart(64, '0')) as Hex;
  return { privateKey, address: tronAddress('41' + privateKeyToAccount(privateKey).address.slice(2)) }; });
const contract = '41' + 'ab'.repeat(20), supply = 2n ** 128n;
test('scenario runner stops after builder rejection or wrong actual token delta and marks remaining cases NOT_TESTED', async () => {
  for (const [fault, boundary] of [['builder', false], ['state', false], ['baseline', false], ['builder', true], ['state', true], ['baseline', true]] as const) {
    const evidence: Record<string, any>[] = []; let triggers = 0, broadcasts = 0, reads = 0, unsigned: any, transferData: any;
    const reference = { blockID: '0000000000000001' + 'ab'.repeat(24), block_header: { raw_data: { number: '1', timestamp: String(Date.now()) } } };
    const session: PrivateFixtureSession = { async request(operation, body: any) {
      if (operation === 'account') return { address: body.address, balance: '1000000000000' };
      if (operation === 'constant') {
        reads++;
        const decoded = decodeFunctionData({ abi, data: ('0x' + body.data) as Hex });
        const ownerBalance = fault === 'baseline' && reads >= 6 ? supply - 1n : supply;
        const value = decoded.functionName === 'totalSupply' || decoded.functionName === 'balanceOf' && decoded.args![0]?.toLowerCase() === actors[0]!.address.rpc ? decoded.functionName === 'totalSupply' ? supply : ownerBalance : 0n;
        return { result: { result: true }, constant_result: [encodeFunctionResult({ abi, functionName: decoded.functionName, result: value }).slice(2)] };
      }
      if (operation === 'trigger') {
        triggers++; if (fault === 'builder') return { result: { result: false }, message: 'UPSTREAM_SECRET_CANARY' };
        transferData = body;
        unsigned = { visible: false, raw_data: { ref_block_bytes: '0001', ref_block_hash: 'ab'.repeat(8), timestamp: String(Date.now()), expiration: String(Date.now() + 60000), fee_limit: body.fee_limit,
          contract: [{ type: 'TriggerSmartContract', parameter: { type_url: 'type.googleapis.com/protocol.TriggerSmartContract', value: { owner_address: body.owner_address, contract_address: body.contract_address, data: body.data } } }] } };
        unsigned.raw_data.expiration = String(BigInt(unsigned.raw_data.timestamp) + 60000n);
        unsigned.raw_data_hex = serializeTronRaw(unsigned); unsigned.txID = sha256(Buffer.from(unsigned.raw_data_hex, 'hex'));
        return { result: { result: true }, transaction: unsigned };
      }
      if (operation === 'broadcast') { broadcasts++; assert.match(body.transaction, /^[a-f0-9]+$/); return { result: true, txid: unsigned.txID }; }
      if (operation === 'block') return body.num === 1 ? reference : { blockID: '0000000000000002' + 'ab'.repeat(24), block_header: { raw_data: { number: '2' } }, transactions: [{ ...unsigned, ret: [{ contractRet: 'SUCCESS' }] }] };
      if (operation === 'receipt') {
        const decoded = decodeFunctionData({ abi, data: ('0x' + transferData.data) as Hex });
        return { id: unsigned.txID, blockNumber: '2', receipt: { result: 'SUCCESS' }, contractResult: ['0'.repeat(63) + '1'], log: [{ address: contract.slice(2),
          topics: [toEventSelector('Transfer(address,address,uint256)').slice(2), '0'.repeat(24) + actors[0]!.address.hex.slice(2), '0'.repeat(24) + actors[1]!.address.hex.slice(2)],
          data: encodeAbiParameters([{ type: 'uint256' }], [decoded.args![1] as bigint]).slice(2) }] };
      }
      assert.fail('Unexpected operation');
    } };
    await assert.rejects(runTokenScenarios(session, contract, [...abi], actors, evidence, boundary), fault === 'baseline' ? /FIXTURE_BASELINE_CHANGED/ : fault === 'builder' ? /FIXTURE_TRIGGER_REJECTED/ : /FIXTURE_CALL_STATE_MISMATCH/);
    assert.equal(triggers, fault === 'baseline' ? 0 : 1); assert.equal(broadcasts, fault === 'state' ? 1 : 0);
    assert.equal(evidence.length, boundary ? 11 : 6); assert.equal(evidence[0]!.outcome, 'ERROR');
    assert(evidence.slice(1).every(e => e.outcome === 'NOT_TESTED'));
    assert(!JSON.stringify(evidence).includes('UPSTREAM_SECRET_CANARY'));
  }
});
