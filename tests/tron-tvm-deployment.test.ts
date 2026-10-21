import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyDeploymentReceipt, waitForDeploymentReceipt } from '../src/tron/lab/deployment.js';
const txid = 'ab'.repeat(32), address = '41' + 'cd'.repeat(20);
const receipt = () => ({ id: txid, contract_address: address, blockNumber: '2', fee: '18446744073709551615', receipt: { result: 'SUCCESS', energy_usage_total: '628938' } });
const block = () => ({ blockID: '0000000000000002' + 'ef'.repeat(24), block_header: { raw_data: { number: '2', timestamp: '1700000000000' } }, transactions: [{ txID: txid, ret: [{ contractRet: 'SUCCESS' }] }] });
test('private deployment receipt binds local transaction/address, success, full block ID and actual inclusion', () => {
  const observed = verifyDeploymentReceipt(receipt(), block(), txid, address);
  assert.equal(observed.feeSun, '18446744073709551615'); assert.equal(observed.blockNumber, '2');
  const cases: Array<(r: any, b: any) => void> = [
    r => { r.id = '00'.repeat(32); }, r => { r.contract_address = '41' + '00'.repeat(20); },
    r => { r.receipt.result = 'REVERT'; }, r => { r.result = 'FAILED'; },
    r => { r.blockNumber = '3'; }, (_r, b) => { b.blockID = '00'.repeat(32); },
    (_r, b) => { b.transactions = []; }, (_r, b) => { b.transactions[0].ret[0].contractRet = 'REVERT'; },
  ];
  for (const change of cases) { const r = receipt(), b = block(); change(r, b); assert.throws(() => verifyDeploymentReceipt(r, b, txid, address)); }
});
test('receipt polling tolerates pending only; timeout never broadcasts or redeploys', async () => {
  for (const mode of ['ready', 'timeout', 'wrong-id']) {
    let now = 0, calls = 0;
    const session = { async request(operation: string, body: unknown) {
      assert.equal(operation, 'receipt'); assert.deepEqual(body, { value: txid }); calls++;
      return mode === 'wrong-id' ? { id: '00'.repeat(32) } : mode === 'ready' && calls === 2 ? receipt() : {};
    } };
    const clock = { now: () => now, async pause(ms: number) { now += ms; } };
    const pending = waitForDeploymentReceipt(session, txid, clock, 500);
    if (mode === 'ready') assert.equal((await pending).id, txid);
    else await assert.rejects(pending, mode === 'timeout' ? /FIXTURE_RECEIPT_TIMEOUT/ : /FIXTURE_RECEIPT_MISMATCH/);
    assert.equal(calls, mode === 'wrong-id' ? 1 : 2);
  }
});
