import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { keccak256 } from 'viem';
import { usdcReference, caller } from '../tools/research/usdc-control-probe.js';
import { ManagementRpc, masterMinterReference, managementGetters, probeMasterMinterManagement, validateMinterManagementProbe, validateManagementSource } from '../tools/research/usdc-minter-management-probe.js';
import { proxySlots } from '../src/evm/proxy.js';
const word = (n: bigint) => '0x' + n.toString(16).padStart(64, '0');
const header = '0x' + '11'.repeat(32);
const baseReference = { ...usdcReference, proxyCodeHash: keccak256('0x6000'), implementationCodeHash: keccak256('0x6001') };
const reference = { ...masterMinterReference, codeHash: keccak256('0x6002'), codeBytes: 2 };
type Fault = 'none' | 'address' | 'code' | 'postCode' | 'postRole' | 'postHeader' | 'badWord' | 'rpc';
async function fixture(fault: Fault, action: (url: string, calls: any[]) => Promise<void>) {
  const calls: any[] = []; let codes = 0, masters = 0, headers = 0;
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += String(chunk);
    const b = JSON.parse(raw); calls.push(b); let result: unknown;
    if (b.method === 'eth_chainId') result = '0x1';
    else if (b.method === 'eth_blockNumber') result = '0x20';
    else if (b.method === 'eth_getBlockByNumber') { headers++; result = { number: '0x20', hash: fault === 'postHeader' && headers >= 5 ? '0x' + '22'.repeat(32) : header }; }
    else if (b.method === 'eth_getStorageAt') result = b.params[1] === proxySlots.legacyImplementation ? word(BigInt(baseReference.implementation)) : word(0n);
    else if (b.method === 'eth_getCode') {
      if (b.params[0] === baseReference.proxy) result = '0x6000';
      else if (b.params[0] === baseReference.implementation) result = '0x6001';
      else if (b.params[0] === reference.target) { codes++; result = fault === 'code' || (fault === 'postCode' && codes >= 4) ? '0x6003' : '0x6002'; }
      else result = '0x';
    } else if (b.method === 'eth_call') {
      const tx = b.params[0];
      if (tx.to === baseReference.proxy) {
        if (tx.data === '0x35d99f35') { masters++; result = word(fault === 'address' || (fault === 'postRole' && masters > 1) ? 111n : BigInt(reference.target)); }
        else result = word(tx.data === '0x5c975abb' ? 0n : 123n);
      } else if (tx.to === reference.target) {
        if (tx.data === managementGetters[0].selector && fault === 'rpc') {
          res.end(JSON.stringify({ jsonrpc: '2.0', id: b.id, error: { code: 3, message: 'https://secret.invalid/CANARY' } })); return;
        }
        result = tx.data === managementGetters[0].selector ? (fault === 'badWord' ? '0x' + '01'.repeat(32) : word(456n)) : word(BigInt(baseReference.proxy));
      }
    }
    res.end(JSON.stringify({ jsonrpc: '2.0', id: b.id, result }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address(); assert(addr && typeof addr !== 'string');
  try { await action(`http://127.0.0.1:${addr.port}`, calls); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

test('management reads bind the fresh role/code and keep token owner distinct from management owner', async () => {
  await fixture('none', async (url, calls) => {
    const r = await probeMasterMinterManagement(url, { baseReference, reference }); validateMinterManagementProbe(r);
    assert.equal(r.stage, 'OBSERVED'); assert.notEqual(r.baseProbe.readings[0]!.value, r.readings[0]!.value);
    assert.equal(r.readings[1]!.value, baseReference.proxy); assert.equal(r.readings[2]!.readStatus, 'NOT_TESTED');
    assert.equal(r.authorityState, 'UNKNOWN'); assert.equal(r.verdict, 'INCONCLUSIVE');
    assert.deepEqual(calls.filter(c => c.method === 'eth_call' && c.params[0].to === reference.target).map(c => c.params),
      managementGetters.map(g => [{ to: reference.target, from: caller, data: g.selector }, '0x20']));
    assert.equal(calls.at(-1).method, 'eth_getBlockByNumber');
    for (const mutate of [(p: any) => p.readings[0].value = p.baseProbe.readings[0].value,
      (p: any) => p.readings[0].evidenceReferences = ['e999'], (p: any) => p.reference.codeHash = keccak256('0x6003')]) {
      const changed = structuredClone(r); mutate(changed); assert.throws(() => validateMinterManagementProbe(changed));
    }
  });
});

test('unexpected fresh master address or code stops management calls without alternate targets', async () => {
  for (const fault of ['address', 'code'] as Fault[]) await fixture(fault, async (url, calls) => {
    const r = await probeMasterMinterManagement(url, { baseReference, reference }); validateMinterManagementProbe(r);
    assert.equal(r.stage, 'PRECONDITION_ERROR'); assert(r.readings.every(x => x.readStatus === 'NOT_TESTED'));
    assert.equal(calls.filter(c => c.method === 'eth_call' && c.params[0].to === reference.target).length, 0);
  });
});

test('management raw failures and code/role/header changes cannot be promoted to authority or coherent success', async () => {
  for (const fault of ['postCode', 'postRole', 'postHeader', 'badWord', 'rpc'] as Fault[]) await fixture(fault, async url => {
    const r = await probeMasterMinterManagement(url, { baseReference, reference }); validateMinterManagementProbe(r);
    assert.equal(r.stage, ['badWord', 'rpc'].includes(fault) ? 'PARTIAL' : 'CONSISTENCY_ERROR');
    assert.equal(r.verdict, 'INCONCLUSIVE'); assert(!JSON.stringify(r).includes('CANARY'));
    if (['postCode', 'postRole', 'postHeader'].includes(fault)) {
      const changed = structuredClone(r); changed.stage = 'OBSERVED'; assert.throws(() => validateMinterManagementProbe(changed));
    } else assert(!('value' in r.readings[0]!));
  });
});

test('management RPC enforces exact target-selector pairs with no controller enumeration or returned-owner calls', async () => {
  const rpc = new ManagementRpc('http://127.0.0.1:1', reference, baseReference.proxy, '32');
  for (const [to, data] of [[reference.target, '0x5c975abb'], [baseReference.proxy, '0x8da5cb5b'], [caller, '0x8da5cb5b'], [reference.target, '0xdeadbeef']]) {
    await assert.rejects(rpc.request('eth_call', [{ to, from: caller, data }, '0x20']), /Disallowed/);
  }
  await assert.rejects(rpc.request('eth_sendTransaction', []), /Disallowed/);
  await assert.rejects(rpc.request('eth_call', [{ to: reference.target, from: caller, data: '0x8da5cb5b' }, 'latest']), /Disallowed/);
  assert.equal(rpc.evidence.length, 0);
});

test('source binding keeps third-party 0.4.24 ABI separate from current official source and rejects selector/hash/version mixing', () => {
  const source = JSON.parse(readFileSync(new URL('../docs/research/usdc-master-minter-source.json', import.meta.url), 'utf8'));
  validateManagementSource(source);
  for (const mutate of [(s: any) => s.service.compilerVersion = '0.6.12+commit.27d51765',
    (s: any) => s.getters[1].selector = '0x8da5cb5b', (s: any) => s.reference.runtimeKeccak256 = keccak256('0x6000')]) {
    const changed = structuredClone(source); mutate(changed); assert.throws(() => validateManagementSource(changed));
  }
});
