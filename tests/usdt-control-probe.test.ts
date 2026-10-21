import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { keccak256 } from 'viem';
import { caller } from '../tools/research/usdc-control-probe.js';
import { BoundedReadRpc } from '../tools/research/bounded-read-rpc.js';
import { usdtReference, usdtGetters, USDTRpc, probeUSDT, validateUSDTReport, validateUSDTSource, decodeUSDTWord } from '../tools/research/usdt-control-probe.js';
const code = '0x6000', tag = '0x123', hash = '0x' + '11'.repeat(32), otherHash = '0x' + '22'.repeat(32), addr = '0x' + '33'.repeat(20), other = '0x' + '44'.repeat(20);
const ref = { ...usdtReference, codeHash: keccak256(code) }, word = (s: string) => '0x' + '0'.repeat(24) + s.slice(2), zero = '0x' + '0'.repeat(64);
const big = (2n ** 256n - 1n).toString(), large = (2n ** 53n + 1n).toString();
async function server(mode: string, run: (url: string, calls: any[]) => Promise<void>) {
  const calls: any[] = []; let headers = 0, codes = 0, chains = 0;
  const http = createServer(async (req, res) => {
    let raw = ''; for await (const p of req) raw += String(p); const b = JSON.parse(raw); calls.push(b); let result: any;
    const error = () => res.end(JSON.stringify({ jsonrpc: '2.0', id: b.id, error: { code: 3, message: 'execution reverted https://secret.invalid/CANARY' } }));
    if (b.method === 'eth_chainId') { chains++; result = mode === 'chain' || mode === 'postChain' && chains === 2 ? '0x2' : '0x1'; }
    if (b.method === 'eth_blockNumber') result = mode === 'badBlock' ? 'CANARY' : tag;
    if (b.method === 'eth_getBlockByNumber') { headers++; if (mode === 'postHeaderError' && headers === 2) { error(); return; } result = { number: tag, hash: mode === 'reorg' && headers === 2 ? otherHash : hash, secret: 'CANARY' }; }
    if (b.method === 'eth_getCode') { codes++; result = mode === 'empty' ? '0x' : mode === 'code' || mode === 'postCode' && codes === 2 ? '0x6001' : code; }
    if (b.method === 'eth_call') {
      const g = usdtGetters.find(g => g.selector === b.params[0].data)!;
      result = g.type === 'address' ? word(mode === 'ownerMismatch' && g.signature === 'getOwner()' ? other : addr)
        : g.type === 'uint256' ? '0x' + BigInt(g.signature === 'maximumFee()' ? big : large).toString(16).padStart(64, '0') : zero;
      if (mode === 'forward' && g.signature === 'deprecated()') result = '0x' + '0'.repeat(63) + '1';
      if (mode === 'dirty' && g.signature === 'paused()') result = '0x' + '0'.repeat(63) + '2';
      if (mode === 'dirtyAddress' && g.signature === 'owner()') result = otherHash;
      if (mode === 'short' && g.signature === 'maximumFee()') result = '0x00';
      if (mode === 'secret' && g.signature === 'owner()') result = 'https://secret.invalid/CANARY';
      if (mode === 'revert' && g.signature === 'getOwner()') { error(); return; }
      if (mode === 'oversized' && g.signature === 'owner()') result = 'CANARY'.repeat(200000);
    }
    res.end(JSON.stringify({ jsonrpc: '2.0', id: b.id, result }));
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve)); const a = http.address(); assert(a && typeof a !== 'string');
  try { await run(`http://127.0.0.1:${a.port}`, calls); } finally { http.closeAllConnections(); await new Promise<void>(resolve => http.close(() => resolve())); }
}

test('USDT canonical uint256 max/above2^53 values stay exact decimal strings; dirty words and source mutations are rejected', () => {
  for (const value of [0n, 2n ** 53n + 1n, 2n ** 256n - 1n]) assert.equal(decodeUSDTWord('0x' + value.toString(16).padStart(64, '0'), 'uint256'), value.toString());
  for (const raw of ['0x00', '0x' + 'ff'.repeat(33), 'CANARY']) assert.throws(() => decodeUSDTWord(raw, 'uint256'));
  assert.throws(() => decodeUSDTWord(otherHash, 'address')); assert.throws(() => decodeUSDTWord('0x' + '0'.repeat(63) + '2', 'bool'));
  const raw = readFileSync(new URL('../docs/research/usdt-control-provenance.json', import.meta.url)); validateUSDTSource(raw);
  const s = JSON.parse(raw.toString()); s.getterCandidates[0].abiEntry.constant = false; assert.throws(() => validateUSDTSource(Buffer.from(JSON.stringify(s))));
});

test('USDT fixed seven reads preserve decimal settings, owner equality and forwarding pointers without calling another target', async () => {
  for (const mode of ['success', 'ownerMismatch', 'forward']) await server(mode, async (url, calls) => {
    const r = await probeUSDT(url, ref); validateUSDTReport(r, ref); assert.equal(r.stage, 'OBSERVED'); assert.equal(r.requestCount, 14); assert.equal(r.evidence.length, 15);
    assert.equal(r.ownerResponseComparison, mode === 'ownerMismatch' ? 'MISMATCH' : 'MATCH'); assert.equal(r.readings[5]!.value, large); assert.equal(r.readings[6]!.value, big);
    assert.equal(typeof r.readings[6]!.value, 'string'); assert(!JSON.stringify(r).includes('CANARY')); assert.equal(r.authorityState, 'UNKNOWN');
    const reads = calls.filter(c => c.method === 'eth_call'); assert.equal(reads.length, 7); for (const [i, c] of reads.entries()) assert.deepEqual(c.params, [{ to: ref.target, from: caller, data: usdtGetters[i]!.selector }, tag]);
    assert(calls.filter(c => c.method === 'eth_getCode').every(c => c.params[0] === ref.target));
    for (const mutate of [(x: any) => x.readings[6].value = Number(big), (x: any) => x.readings[6].value = '01', (x: any) => x.ownerResponseComparison = 'UNKNOWN',
      (x: any) => x.readings[0].evidenceReferences = x.readings[1].evidenceReferences, (x: any) => x.evidence.at(-1).data.result.hash = otherHash]) {
      const c = structuredClone(r); mutate(c); assert.throws(() => validateUSDTReport(c, ref));
    }
  });
});

test('USDT failed chain/block/code gates prevent every getter and never fall back to another address or ABI', async () => {
  for (const mode of ['chain', 'badBlock', 'empty', 'code']) await server(mode, async (url, calls) => {
    const r = await probeUSDT(url, ref); validateUSDTReport(r, ref); assert.equal(r.stage, 'PRECONDITION_ERROR'); assert.equal(r.ownerResponseComparison, 'UNKNOWN');
    assert(r.readings.every(r => r.readStatus === 'NOT_TESTED')); assert(!calls.some(c => c.method === 'eth_call')); assert(!JSON.stringify(r).includes('CANARY'));
  });
});

test('USDT invalid/reverted/oversized partial reads keep UNKNOWN equality; post-code/chain/header failures preserve inconsistent evidence', async () => {
  for (const mode of ['dirty', 'dirtyAddress', 'short', 'secret', 'revert', 'oversized', 'postCode', 'postChain', 'reorg', 'postHeaderError']) await server(mode, async url => {
    const r = await probeUSDT(url, ref); validateUSDTReport(r, ref); assert.equal(r.stage, ['postCode', 'postChain', 'reorg', 'postHeaderError'].includes(mode) ? 'CONSISTENCY_ERROR' : 'PARTIAL');
    if (['dirtyAddress', 'secret', 'revert', 'oversized'].includes(mode)) assert.equal(r.ownerResponseComparison, 'UNKNOWN');
    assert(!JSON.stringify(r).includes('CANARY')); assert.equal(r.verdict, 'INCONCLUSIVE'); assert.equal(r.behaviorExecution, 'NOT_TESTED');
  });
});

test('USDT transport rejects account/target/storage/write/override/caller/tag variants and caps requests16', async () => {
  await server('success', async (url, calls) => {
    const unconfigured = new class extends BoundedReadRpc {}(url);
    await assert.rejects(unconfigured.request('eth_sendTransaction'), /validator/); assert.equal(calls.length, 0);
    const rpc = new USDTRpc(url, ref); await rpc.request('eth_blockNumber'); const tx = { to: ref.target, from: caller, data: usdtGetters[0].selector };
    for (const [m, p] of [['eth_call', [{ ...tx, to: addr }, tag]], ['eth_call', [{ ...tx, from: addr }, tag]], ['eth_call', [{ ...tx, data: '0xe47d6060' }, tag]],
      ['eth_call', [{ ...tx, data: tx.data + '00' }, tag]], ['eth_call', [tx, 'latest']], ['eth_call', [tx, tag, {}]], ['eth_getCode', [addr, tag]],
      ['eth_getStorageAt', [ref.target, zero, tag]], ['eth_sendTransaction', []], ['eth_sendRawTransaction', ['0x00']], ['eth_blockNumber', []]] as [string, any[]][]) await assert.rejects(rpc.request(m, p), /scope/);
    assert.equal(calls.length, 1); for (let i = 0; i < 15; i++) await rpc.request('eth_chainId'); await assert.rejects(rpc.request('eth_chainId'), /budget/); assert.equal(calls.length, 16);
  });
});

test('USDT CLI saves precondition failures in0600 and preserves existing output on startup failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'usdt-probe-')), out = join(directory, 'report.json'), run = promisify(execFile);
  try {
    await server('success', async url => {
      await assert.rejects(run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/usdt-control-probe.ts', '--out', out], { env: { ...process.env, RPC_URL: url }, timeout: 15000 }));
      const r = JSON.parse(await readFile(out, 'utf8')); validateUSDTReport(r); assert.equal(r.stage, 'PRECONDITION_ERROR'); assert.equal((await stat(out)).mode & 0o777, 0o600);
    });
    await writeFile(out, 'KEEP'); await assert.rejects(run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/usdt-control-probe.ts', '--out', out], { env: { ...process.env, RPC_URL: '' }, timeout: 15000 })); assert.equal(await readFile(out, 'utf8'), 'KEEP');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
