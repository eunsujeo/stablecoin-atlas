import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { toEventSelector, getAddress } from 'viem';
import { deploymentReference as ref, DeploymentCandidateRpc, corroborateDeployment, extractCandidateAccounts, probeDeploymentCandidates, validateCandidateSource, validateCandidateReport } from '../tools/research/rlusd-account-candidates.js';
const tag = '0x' + BigInt(ref.blockNumber).toString(16), ix = '0x' + BigInt(ref.transactionIndex).toString(16), hash = '0x' + '11'.repeat(32), otherHash = '0x' + '22'.repeat(32);
const zero = '0x' + '00'.repeat(32), a = '0x' + '33'.repeat(20), sender = '0x' + '44'.repeat(20), word = (s: string) => '0x' + '0'.repeat(24) + s.slice(2);
const log = { address: ref.proxy, topics: [toEventSelector('RoleGranted(bytes32,address,address)'), zero, word(a), word(sender)], data: '0x',
  blockNumber: tag, blockHash: hash, transactionHash: ref.transactionHash, transactionIndex: ix, logIndex: '0x0', removed: false };
const receipt = { transactionHash: ref.transactionHash, blockNumber: tag, blockHash: hash, transactionIndex: ix, from: sender, to: null, contractAddress: ref.proxy, status: '0x1', logs: [log] };
const tx = { hash: ref.transactionHash, blockNumber: tag, blockHash: hash, transactionIndex: ix, from: sender, to: null };
const header = { number: tag, hash, transactions: [...Array(Number(BigInt(ref.transactionIndex))).fill(otherHash), ref.transactionHash] };
async function server(mode: string, run: (url: string, calls: any[]) => Promise<void>) {
  const calls: any[] = []; let headers = 0;
  const http = createServer(async (req, res) => {
    let raw = ''; for await (const p of req) raw += String(p); const b = JSON.parse(raw); calls.push(b); let result: any;
    if (b.method === 'eth_chainId') result = mode === 'chain' ? '0x2' : '0x1';
    if (b.method === 'eth_getTransactionByHash') result = mode === 'nullTx' ? null : mode === 'factory' ? { ...tx, to: sender } : tx;
    if (b.method === 'eth_getTransactionReceipt') result = mode === 'null' ? null : { ...receipt, unexpected: 'CANARY',
      contractAddress: mode === 'secret' ? 'https://secret.invalid/CANARY' : ref.proxy,
      logs: mode === 'empty' ? [] : mode === 'wrongEmitter' ? [{ ...log, address: sender }] : [log] };
    if (b.method === 'eth_getBlockByNumber') {
      headers++;
      if (mode === 'rpc' || mode === 'postError' && headers === 2) { res.end(JSON.stringify({ jsonrpc: '2.0', id: b.id, error: { code: 4444, message: 'https://secret.invalid/CANARY' } })); return; }
      result = { ...header, hash: mode === 'reorg' && headers === 2 ? otherHash : hash, unexpected: 'CANARY' };
    }
    res.end(JSON.stringify({ jsonrpc: '2.0', id: b.id, result }));
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve)); const address = http.address(); assert(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`, calls); }
  finally { http.closeAllConnections(); await new Promise<void>(resolve => http.close(() => resolve())); }
}

test('deployment candidate linkage requires exact successful top-level creation and header transaction slot', () => {
  assert.equal(corroborateDeployment(receipt, tx, header).transactionSender, getAddress(sender));
  for (const r of [{ ...receipt, status: '0x0' }, { ...receipt, contractAddress: sender }, { ...receipt, to: sender }, { ...receipt, blockHash: otherHash }]) assert.throws(() => corroborateDeployment(r, tx, header));
  assert.throws(() => corroborateDeployment(receipt, { ...tx, to: sender }, header));
  assert.throws(() => corroborateDeployment(receipt, tx, { ...header, transactions: [ref.transactionHash] }));
});

test('RoleGranted candidates use account, not sender; zero role ID is valid, addresses/padding/indexing and cap are exact', () => {
  const obs = extractCandidateAccounts(receipt); assert.equal(obs.candidates[0]!.account, getAddress(a)); assert.notEqual(obs.candidates[0]!.account, sender); assert.deepEqual(obs.candidates[0]!.roleIds, [zero]);
  assert.equal(extractCandidateAccounts({ ...receipt, logs: [{ ...log, topics: [log.topics[0], zero, zero, word(sender)] }] }).candidates.length, 0);
  for (const changed of [{ ...log, removed: true }, { ...log, topics: log.topics.slice(0, 3) }, { ...log, data: word(a) }, { ...log, transactionHash: otherHash }, { ...log, topics: [log.topics[0], zero, otherHash, word(sender)] }]) assert.throws(() => extractCandidateAccounts({ ...receipt, logs: [changed] }));
  assert.throws(() => extractCandidateAccounts({ ...receipt, logs: [log, log] }));
  const logs = Array.from({ length: 5 }, (_, i) => ({ ...log, logIndex: '0x' + i.toString(16), topics: [log.topics[0], zero, word('0x' + (i + 5).toString(16).repeat(40)), word(sender)] })).reverse();
  const capped = extractCandidateAccounts({ ...receipt, logs }); assert.equal(capped.candidates.length, 3); assert.equal(capped.unselectedUniqueAccounts, 2); assert.equal(capped.candidates[0]!.logIndices[0], '0x0');
});

test('candidate probe qualifies one bounded deployment receipt or records a true empty receipt without scanning', async () => {
  for (const mode of ['success', 'empty', 'wrongEmitter']) await server(mode, async (url, calls) => {
    const r = await probeDeploymentCandidates(url); validateCandidateReport(r); assert.equal(r.stage, mode === 'success' ? 'CANDIDATES_OBSERVED' : 'NO_MATCH_IN_RECEIPT');
    assert.equal(r.requestCount, 5); assert.equal(r.membershipExecution, 'NOT_TESTED'); assert(!JSON.stringify(r).includes('CANARY'));
    assert(!calls.some(c => ['eth_call', 'eth_getLogs', 'eth_sendTransaction'].includes(c.method)));
    if (r.candidates.length) { const changed = structuredClone(r); changed.candidates[0]!.account = sender; assert.throws(() => validateCandidateReport(changed)); }
  });
});

test('missing/rpc/factory/dirty responses are errors, while changed or unavailable postheaders preserve inconsistent candidates', async () => {
  for (const mode of ['chain', 'null', 'nullTx', 'factory', 'secret', 'rpc', 'reorg', 'postError']) await server(mode, async (url, calls) => {
    const r = await probeDeploymentCandidates(url); validateCandidateReport(r); assert.equal(r.stage, ['reorg', 'postError'].includes(mode) ? 'CONSISTENCY_ERROR' : 'ERROR');
    assert(!JSON.stringify(r).includes('CANARY')); if (mode === 'null') { assert.equal(calls.length, 2); assert(r.evidence.every(e => e.observedBlockOrSlot === 'UNKNOWN')); }
  });
});

test('candidate RPC rejects arbitrary hash/block/account calls/log ranges/writes, caps requests and pins source event ABI', async () => {
  await server('success', async (url, calls) => {
    const rpc = new DeploymentCandidateRpc(url);
    for (const [m, p] of [['eth_getTransactionReceipt', [otherHash]], ['eth_getBlockByNumber', ['latest', false]], ['eth_getLogs', []], ['eth_call', []], ['eth_sendTransaction', []]] as [string, any[]][]) await assert.rejects(rpc.request(m, p), /scope/);
    assert.equal(calls.length, 0); for (let i = 0; i < 8; i++) await rpc.request('eth_chainId'); await assert.rejects(rpc.request('eth_chainId'), /budget/);
  });
  const raw = readFileSync(new URL('../docs/research/rlusd-deployment-reference.json', import.meta.url)); validateCandidateSource(raw);
  const changed = JSON.parse(raw.toString()); changed.abi.event.inputs[1].indexed = false; assert.throws(() => validateCandidateSource(Buffer.from(JSON.stringify(changed))));
});

test('candidate CLI saves0600 and preserves existing output on startup error', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rlusd-candidates-')), out = join(directory, 'report.json'), run = promisify(execFile);
  try {
    await server('success', async url => {
      await run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/rlusd-account-candidates.ts', '--out', out], { env: { ...process.env, RPC_URL: url }, timeout: 15000 });
      validateCandidateReport(JSON.parse(await readFile(out, 'utf8'))); assert.equal((await stat(out)).mode & 0o777, 0o600);
    });
    await writeFile(out, 'KEEP'); await assert.rejects(run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/rlusd-account-candidates.ts', '--out', out], { env: { ...process.env, RPC_URL: '' }, timeout: 15000 }));
    assert.equal(await readFile(out, 'utf8'), 'KEEP');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
