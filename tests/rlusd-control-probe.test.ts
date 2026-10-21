import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { keccak256, toFunctionSelector } from 'viem';
import { proxySlots } from '../src/evm/proxy.js';
import { caller } from '../tools/research/usdc-control-probe.js';
import { rlusdReference, rlusdGetters, roleConstants, RLUSDRpc, probeRLUSD, validateRLUSDReport, validateRLUSDSource, decodeRLUSDWord } from '../tools/research/rlusd-control-probe.js';
const zero = '0x' + '00'.repeat(32), hash = '0x' + '11'.repeat(32), otherHash = '0x' + '22'.repeat(32);
const code = '0x6000', implementationCode = '0x6001', tag = '0x123';
const reference = { ...rlusdReference, proxyCodeHash: keccak256(code), implementationCodeHash: keccak256(implementationCode) };
const slotWord = '0x' + '0'.repeat(24) + reference.implementation.slice(2).toLowerCase();
async function server(mode: string, run: (url: string, calls: any[]) => Promise<void>) {
  const calls: any[] = []; let proxyCodes = 0, headers = 0;
  const http = createServer(async (req, res) => {
    let raw = ''; for await (const part of req) raw += String(part); const body = JSON.parse(raw); calls.push(body);
    const { method, params, id } = body;
    const error = () => res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: 3, message: 'execution reverted https://secret.invalid/CANARY' } }));
    let result: any = null;
    if (method === 'eth_chainId') result = mode === 'chain' ? '0x2' : '0x1';
    if (method === 'eth_blockNumber') result = mode === 'badNumber' ? 'CANARY' : tag;
    if (method === 'eth_getBlockByNumber') {
      headers++; if (mode === 'postError' && headers === 2) { error(); return; }
      result = { number: tag, hash: mode === 'badHeader' || mode === 'reorg' && headers === 2 ? 'CANARY' : hash, unexpected: 'CANARY' };
    }
    if (method === 'eth_getCode') {
      if (params[0] === reference.proxy) { proxyCodes++; result = mode === 'emptyCode' ? '0x' : mode === 'code' || mode === 'postCode' && proxyCodes === 2 ? '0x6002' : code; }
      else result = implementationCode;
    }
    if (method === 'eth_getStorageAt') result = params[1] === proxySlots.implementation
      ? mode === 'slot' || mode === 'postSlot' && proxyCodes === 2 ? zero : slotWord
      : mode === 'beacon' && params[1] === proxySlots.beacon ? slotWord : zero;
    if (method === 'eth_call') {
      const getter = rlusdGetters.find(g => g.selector === params[0].data)!;
      result = getter.type === 'bool' ? zero : roleConstants[getter.signature] ?? zero;
      if (mode === 'mismatch' && getter.signature === 'MINTER_ROLE()') result = zero;
      if (mode === 'dirty' && getter.type === 'bool') result = '0x' + '0'.repeat(63) + '2';
      if (mode === 'short' && getter.signature === 'MINTER_ROLE()') result = '0x00';
      if (mode === 'secret' && getter.type === 'bool') result = 'https://secret.invalid/CANARY';
      if (mode === 'revert' && getter.type === 'bool') { error(); return; }
      if (mode === 'oversized' && getter.type === 'bool') result = 'CANARY'.repeat(200000);
    }
    res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const a = http.address(); assert(a && typeof a !== 'string');
  try { await run(`http://127.0.0.1:${a.port}`, calls); }
  finally { http.closeAllConnections(); await new Promise<void>(resolve => http.close(() => resolve())); }
}

test('RLUSD exact word decoding accepts zero bytes32 without claiming authority and rejects dirty/short words; source hash is pinned', () => {
  assert.equal(decodeRLUSDWord(zero, 'bytes32'), zero); assert.equal(decodeRLUSDWord(zero, 'bool'), false);
  for (const raw of ['0x', '0x00', '0x' + '0'.repeat(63), 'CANARY']) assert.throws(() => decodeRLUSDWord(raw, 'bytes32'));
  assert.throws(() => decodeRLUSDWord('0x' + '0'.repeat(63) + '2', 'bool'));
  const source = readFileSync(new URL('../docs/research/rlusd-control-abi-study.json', import.meta.url)); validateRLUSDSource(source);
  const changed = JSON.parse(source.toString()); changed.getterCandidates[0].abiEntry.stateMutability = 'nonpayable';
  assert.throws(() => validateRLUSDSource(Buffer.from(JSON.stringify(changed))));
  for (const g of rlusdGetters) assert.equal(toFunctionSelector(g.signature), g.selector);
});

test('RLUSD gated probe links seven exact proxy responses and postchecks; literal role-ID difference stays a separate observation', async () => {
  for (const mode of ['success', 'mismatch']) await server(mode, async (url, calls) => {
    const r = await probeRLUSD(url, reference); validateRLUSDReport(r, reference);
    assert.equal(r.stage, 'OBSERVED'); assert.equal(r.requestCount, 22); assert.equal(r.evidence.length, 23);
    assert.equal(r.readings[0]!.value, false); assert.equal(r.readings[1]!.value, zero);
    assert.equal(r.readings[2]!.candidateConsistency, mode === 'mismatch' ? 'MISMATCH' : 'MATCH');
    assert.equal(r.authorityState, 'UNKNOWN'); assert.equal(r.verdict, 'INCONCLUSIVE'); assert(!JSON.stringify(r).includes('CANARY'));
    const reads = calls.filter(c => c.method === 'eth_call'); assert.equal(reads.length, 7);
    for (const [i, c] of reads.entries()) assert.deepEqual(c.params, [{ to: reference.proxy, from: caller, data: rlusdGetters[i]!.selector }, tag]);
    assert.equal(calls.at(-1).method, 'eth_getBlockByNumber'); assert(r.skipped.every(s => s.execution === 'NOT_TESTED'));
    for (const mutate of [(x: any) => x.readings[0].value = true, (x: any) => x.readings[2].candidateConsistency = 'UNKNOWN',
      (x: any) => x.initial.blockHash = otherHash, (x: any) => x.evidence.at(-1).data.result.hash = otherHash,
      (x: any) => x.reference.proxyCodeHash = otherHash, (x: any) => x.readings[0].evidenceReferences = x.readings[1].evidenceReferences]) {
      const changed = structuredClone(r); mutate(changed); assert.throws(() => validateRLUSDReport(changed, reference));
    }
  });
});

test('RLUSD wrong chain, block/header, code, implementation slot and beacon gates prevent every getter call', async () => {
  for (const mode of ['chain', 'badNumber', 'badHeader', 'emptyCode', 'code', 'slot', 'beacon']) await server(mode, async (url, calls) => {
    const r = await probeRLUSD(url, reference); validateRLUSDReport(r, reference);
    assert.equal(r.stage, 'PRECONDITION_ERROR'); assert(r.readings.every(r => r.readStatus === 'NOT_TESTED'));
    assert.equal(calls.filter(c => c.method === 'eth_call').length, 0); assert(!JSON.stringify(r).includes('CANARY'));
  });
});

test('RLUSD partial reads retain sanitized revert/invalid/size failures; post-read changes never become a coherent snapshot', async () => {
  for (const mode of ['dirty', 'short', 'secret', 'revert', 'oversized', 'reorg', 'postSlot', 'postCode', 'postError']) await server(mode, async url => {
    const r = await probeRLUSD(url, reference); validateRLUSDReport(r, reference);
    assert.equal(r.stage, ['reorg', 'postSlot', 'postCode', 'postError'].includes(mode) ? 'CONSISTENCY_ERROR' : 'PARTIAL');
    assert(!JSON.stringify(r).includes('CANARY')); assert.equal(r.support, 'UNKNOWN'); assert.equal(r.behaviorExecution, 'NOT_TESTED');
    if (mode === 'short') assert.equal(r.readings[2]!.readStatus, 'INVALID_RESPONSE');
    if (mode === 'revert') { assert.equal(r.readings[0]!.readStatus, 'READ_FAILED'); assert.equal(r.readings[0]!.errorKind, 'REVERT'); }
    if (mode === 'oversized') assert.equal(r.readings[0]!.errorKind, 'TRANSPORT_ERROR');
  });
});

test('RLUSD RPC rejects arbitrary target, caller, arguments, block, override and send methods and enforces request budget', async () => {
  await server('success', async (url, calls) => {
    const rpc = new RLUSDRpc(url, reference); await rpc.request('eth_blockNumber');
    const tx = { to: reference.proxy, from: caller, data: rlusdGetters[0].selector };
    const denied: [string, any[]][] = [ ['eth_sendTransaction', []], ['eth_sendRawTransaction', ['0x00']], ['eth_getLogs', []],
      ['eth_blockNumber', []], ['eth_call', [{ ...tx, to: reference.implementation }, tag]], ['eth_call', [{ ...tx, from: reference.proxy }, tag]],
      ['eth_call', [{ ...tx, data: tx.data + '00' }, tag]], ['eth_call', [{ ...tx, data: '0x91d14854' }, tag]],
      ['eth_call', [tx, 'latest']], ['eth_call', [tx, tag, {}]], ['eth_call', [{ ...tx, value: '0x0' }, tag]],
      ['eth_getStorageAt', [reference.implementation, proxySlots.implementation, tag]], ['eth_getStorageAt', [reference.proxy, proxySlots.admin, tag]],
      ['eth_getBlockByNumber', ['0x124', false]] ];
    for (const [m, p] of denied) await assert.rejects(rpc.request(m, p), /scope/);
    assert.equal(calls.length, 1);
    for (let i = 0; i < 23; i++) await rpc.request('eth_chainId');
    await assert.rejects(rpc.request('eth_chainId'), /budget/); assert.equal(calls.length, 24);
  });
});

test('RLUSD CLI saves a schema-valid precondition failure in0600 and preserves previous output on startup failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rlusd-probe-')), out = join(directory, 'report.json'), run = promisify(execFile);
  try {
    await server('success', async (url, calls) => {
      await assert.rejects(run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/rlusd-control-probe.ts', '--out', out],
        { env: { ...process.env, RPC_URL: url }, timeout: 15000 }));
      const r = JSON.parse(await readFile(out, 'utf8')); validateRLUSDReport(r); assert.equal(r.stage, 'PRECONDITION_ERROR');
      assert.equal((await stat(out)).mode & 0o777, 0o600); assert(!calls.some(c => c.method === 'eth_call'));
    });
    await writeFile(out, 'KEEP');
    await assert.rejects(run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/rlusd-control-probe.ts', '--out', out],
      { env: { ...process.env, RPC_URL: '' }, timeout: 15000 }));
    assert.equal(await readFile(out, 'utf8'), 'KEEP');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
