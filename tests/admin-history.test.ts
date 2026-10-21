import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { toEventSelector } from 'viem';
import { historyReference as ref, adminEvents, decodeAdminLog, selectHistoryLogs, corroborateHistoryLog, probeMasterMinterHistory,
  validateHistoryReport, validateHistorySource, HistoryRpc } from '../tools/research/master-minter-history.js';

const blockNumber = '0x' + BigInt(ref.fromBlock).toString(16), blockHash = '0x' + '11'.repeat(32), txHash = '0x' + '22'.repeat(32);
const sender = '0x' + '33'.repeat(20), a = '0x' + '44'.repeat(20), b = '0x' + '55'.repeat(20);
const word = (address: string) => '0x' + '0'.repeat(24) + address.slice(2);
const log = { address: ref.target, blockNumber, blockHash, transactionHash: txHash, transactionIndex: '0x1', logIndex: '0x0', removed: false,
  topics: [toEventSelector(adminEvents[0].signature), word(a), word(b)], data: '0x' };
const input = decodeAdminLog(log).expectedInput;
const transaction = { hash: txHash, blockNumber, blockHash, transactionIndex: '0x1', from: sender, to: ref.target, input };
const receipt = { transactionHash: txHash, blockNumber, blockHash, transactionIndex: '0x1', from: sender, to: ref.target, status: '0x1', logs: [log] };
const block = { number: blockNumber, hash: blockHash, transactions: [ref.deploymentHash, txHash] };

test('admin event decoding keeps non-indexed ownership words distinct and links only calldata-specified values', () => {
  const ownership = { ...log, topics: [toEventSelector(adminEvents[3].signature)], data: word(a) + word(b).slice(2) };
  assert.deepEqual(decodeAdminLog(ownership).values, [a, b]);
  assert.equal(decodeAdminLog({ ...ownership, data: word(sender) + word(b).slice(2) }).expectedInput, decodeAdminLog(ownership).expectedInput,
    'old owner is event-only evidence, not calldata-derived');
  const bad = { ...ownership, topics: [...ownership.topics, word(a)] }; assert.throws(() => decodeAdminLog(bad));
  const sample = corroborateHistoryLog(log, transaction, receipt, block);
  assert.equal(sample.directCall, 'MATCHING_DIRECT_CALL_INPUT'); assert.equal(sample.currentAuthority, 'UNKNOWN');
  assert.equal(corroborateHistoryLog(log, { ...transaction, input: '0x' }, receipt, block).directCall, 'UNKNOWN');
  assert.equal(corroborateHistoryLog(log, { ...transaction, to: sender }, { ...receipt, to: sender }, block).directCall, 'UNKNOWN');
  const creationLog = { ...ownership, transactionHash: ref.deploymentHash, transactionIndex: '0x0' };
  const creationTx = { ...transaction, hash: ref.deploymentHash, transactionIndex: '0x0', to: null, input: '0x6000' };
  const creationReceipt = { ...receipt, transactionHash: ref.deploymentHash, transactionIndex: '0x0', to: null, contractAddress: ref.target, logs: [creationLog] };
  assert.equal(corroborateHistoryLog(creationLog, creationTx, creationReceipt, block).directCall, 'UNKNOWN');
});

test('log and receipt validators reject wrong window, removed/duplicate samples, dirty padding and forged linkage', () => {
  for (const changed of [{ ...log, removed: true }, { ...log, address: sender }, { ...log, blockNumber: '0x1' },
    { ...log, topics: [log.topics[0], '0x' + '01'.repeat(32), word(b)] }]) assert.throws(() => decodeAdminLog(changed));
  assert.throws(() => selectHistoryLogs([log, log])); assert.throws(() => selectHistoryLogs(Array(101).fill(log)));
  for (const r of [{ ...receipt, status: '0x0' }, { ...receipt, blockHash: txHash }, { ...receipt, logs: [{ ...log, data: '0x00' }] }]) assert.throws(() => corroborateHistoryLog(log, transaction, r, block));
  assert.throws(() => corroborateHistoryLog(log, transaction, receipt, { ...block, transactions: [txHash, ref.deploymentHash] }));
});

type Mode = 'success' | 'empty' | 'null' | 'rpc' | 'archive' | 'reorg' | 'postHeaderError' | 'count' | 'oversized' | 'malformed';
async function server(mode: Mode, run: (url: string, calls: any[]) => Promise<void>) {
  const calls: any[] = []; let headers = 0;
  const logs = mode === 'count' ? Array.from({ length: 5 }, (_, i) => ({ ...log, logIndex: '0x' + i.toString(16) })) : [log];
  const http = createServer(async (req, res) => {
    let raw = ''; for await (const part of req) raw += String(part); const body = JSON.parse(raw); calls.push(body);
    const error = (code: number) => res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code, message: 'https://secret.invalid/CANARY' } }));
    if (mode === 'oversized') { res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: 'CANARY'.repeat(400000) })); return; }
    if (mode === 'rpc' && body.method === 'eth_getBlockByNumber') { error(4444); return; }
    let result: any;
    if (body.method === 'eth_chainId') result = '0x1';
    if (body.method === 'eth_getTransactionByHash') result = mode === 'null' ? null : body.params[0] === ref.deploymentHash
      ? { ...transaction, hash: ref.deploymentHash, transactionIndex: '0x0', to: null, input: '0x6000' } : transaction;
    if (body.method === 'eth_getTransactionReceipt') result = mode === 'null' ? null : body.params[0] === ref.deploymentHash
      ? { ...receipt, transactionHash: ref.deploymentHash, transactionIndex: '0x0', to: null,
        contractAddress: mode === 'malformed' ? 'https://secret.invalid/CANARY' : ref.target, logs: [] }
      : { ...receipt, logs, unexpectedSecret: 'CANARY' };
    if (body.method === 'eth_getBlockByNumber') {
      headers++; if (mode === 'postHeaderError' && headers >= 3) { error(4444); return; }
      result = { ...block, hash: mode === 'reorg' && headers >= 3 ? txHash : blockHash };
    }
    if (body.method === 'eth_getLogs') result = mode === 'empty' ? [] : logs;
    if (body.method === 'eth_getCode') { if (mode === 'archive') { error(-32000); return; } result = '0x6000'; }
    res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address(); assert(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`, calls); }
  finally { http.closeAllConnections(); await new Promise<void>(resolve => http.close(() => resolve())); }
}

test('bounded historical scan links direct successful calls without claiming current authority and samples only first three', async () => {
  for (const mode of ['success', 'count'] as Mode[]) await server(mode, async (url, calls) => {
    const r = await probeMasterMinterHistory(url); validateHistoryReport(r);
    assert.equal(r.stage, 'OBSERVED'); assert.equal(r.sampledLogs, mode === 'count' ? 3 : 1);
    assert.equal(r.unverifiedLogs, mode === 'count' ? 2 : 0); assert(r.samples.every(s => s.directCall === 'MATCHING_DIRECT_CALL_INPUT'));
    assert.equal(r.currentAuthority, 'UNKNOWN'); assert(!JSON.stringify(r).includes('CANARY'));
    assert.equal(calls.filter(c => c.method === 'eth_getLogs').length, 1); assert(calls.length <= 32);
    const changed = structuredClone(r); changed.samples[0].event.values[0] = b; assert.throws(() => validateHistoryReport(changed));
  });
});

test('empty window, unavailable deployment, RPC4444, archive failure and reorg remain distinct', async () => {
  const stages = { empty: 'NO_MATCH_IN_WINDOW', null: 'ERROR', rpc: 'ERROR', archive: 'OBSERVED', reorg: 'CONSISTENCY_ERROR', postHeaderError: 'CONSISTENCY_ERROR', malformed: 'ERROR', oversized: 'ERROR' };
  for (const [mode, stage] of Object.entries(stages)) await server(mode as Mode, async (url, calls) => {
    const r = await probeMasterMinterHistory(url); validateHistoryReport(r); assert.equal(r.stage, stage); assert(!JSON.stringify(r).includes('CANARY'));
    if (mode === 'archive') assert.equal(r.samples[0].codeStatus, 'UNKNOWN');
    if (['null', 'rpc', 'malformed', 'oversized'].includes(mode)) assert.equal(calls.filter(c => c.method === 'eth_getLogs').length, 0);
    if (mode === 'empty') assert.equal(r.returnedLogs, 0);
  });
});

test('history RPC never widens target/range/topics, calls arbitrary transaction hashes or sends transactions', async () => {
  const rpc = new HistoryRpc('http://127.0.0.1:1');
  for (const [method, params] of [['eth_sendTransaction', []], ['eth_call', []], ['eth_getTransactionByHash', [txHash]],
    ['eth_getBlockByNumber', ['0x1', false]], ['eth_getLogs', [{ address: sender, fromBlock: '0x1', toBlock: 'latest' }]]] as [string, any[]][]) {
    await assert.rejects(rpc.request(method, params), /scope/);
  }
  assert.equal(rpc.evidence.length, 0);
  const source = JSON.parse(readFileSync(new URL('../docs/research/usdc-master-minter-history-reference.json', import.meta.url), 'utf8'));
  validateHistorySource(source); const changed = structuredClone(source); changed.events[3].indexed = 2; assert.throws(() => validateHistorySource(changed));
});

test('historical CLI saves qualified evidence in0600 and preserves existing output on startup failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'history-probe-')), out = join(directory, 'report.json'), run = promisify(execFile);
  try {
    await server('success', async url => {
      await run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/master-minter-history.ts', '--out', out], { env: { ...process.env, RPC_URL: url }, timeout: 10000 });
      validateHistoryReport(JSON.parse(await readFile(out, 'utf8'))); assert.equal((await stat(out)).mode & 0o777, 0o600);
    });
    await writeFile(out, 'previous');
    await assert.rejects(run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/master-minter-history.ts', '--out', out], { env: { ...process.env, RPC_URL: '' }, timeout: 10000 }));
    assert.equal(await readFile(out, 'utf8'), 'previous');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
