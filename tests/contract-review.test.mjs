import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { keccak256, toHex } from 'viem';
import { Transport, limits, slots, wordAddress } from '../src/contract-review/network.mjs';
import { normalizeSourcify, normalizeEtherscan, sources } from '../src/contract-review/source.mjs';
import { analyze } from '../src/contract-review/analysis.mjs';
import { syntaxAnalysis } from '../src/contract-review/compiler.mjs';
import { collect, buildReport, compareSource, review, attachExperiments } from '../src/contract-review/review.mjs';
import { inspectBytecode } from '../src/contract-review/bytecode.mjs';
import { sections, dashboard, markdown } from '../src/contract-review/report.mjs';
import { createReportServer } from '../src/contract-review/preview.mjs';

const a = `0x${'11'.repeat(20)}`, b = `0x${'22'.repeat(20)}`, beacon = `0x${'33'.repeat(20)}`, blockHash = `0x${'aa'.repeat(32)}`, zero = `0x${'0'.repeat(64)}`;
const word = at => `0x${'0'.repeat(24)}${at.slice(2)}`;
const sourceText = await readFile(new URL('./fixtures/ContractReview.sol', import.meta.url), 'utf8');
const raw = (at = a, content = sourceText) => ({ chainId: '1', address: at, runtimeMatch: 'exact_match', sources: { 'Fixture.sol': { content } }, abi: [], compilation: { language: 'Solidity', fullyQualifiedName: 'Fixture.sol:VaultFixture', compilerVersion: '0.8.20', compilerSettings: {} }, runtimeBytecode: { onchainBytecode: '0x6000', recompiledBytecode: '0x6000' } });
function gateway({ proxy = false, beaconProxy = false, cycle = false, reorg = false, badChain = false, sourceFailure = false, slotFailure = false, empty = false, missingCode = false, missingBeacon = false } = {}) {
  const requests = [];
  const fetcher = async (url, options) => {
    if (options.method === 'GET') {
      requests.push({ get: true, redirect: options.redirect });
      if (sourceFailure) return new Response('not found', { status: 404 });
      return Response.json(raw(/\/contract\/1\/(0x[0-9a-f]{40})/.exec(url)[1]));
    }
    const request = JSON.parse(options.body); requests.push(request);
    const [at, param] = request.params; let result;
    switch (request.method) {
      case 'eth_chainId': result = badChain ? '0x2' : '0x1'; break;
      case 'eth_getBlockByNumber': result = { number: '0x10', hash: reorg && at !== 'latest' ? `0x${'bb'.repeat(32)}` : blockHash }; break;
      case 'eth_getCode':
        if (missingCode) return Response.json({ jsonrpc: '2.0', id: request.id, error: { code: -1, message: 'key=private-fixture-secret' } });
        result = empty || (missingBeacon && at === beacon) ? '0x' : '0x6000'; break;
      case 'eth_getStorageAt':
        if (slotFailure) return Response.json({ jsonrpc: '2.0', id: request.id, error: { code: -1, message: 'https://secret.invalid/?key=private-fixture-secret' } });
        result = proxy && at === a && param === slots.implementation ? word(cycle ? a : b) : beaconProxy && at === a && param === slots.beacon ? word(beacon) : zero; break;
      case 'eth_call': result = request.params[0].data === '0x52d1902d' ? slots.implementation : word(b); break;
      default: throw Error('UNEXPECTED_METHOD');
    }
    return Response.json({ jsonrpc: '2.0', id: request.id, result });
  };
  return { fetcher, requests };
}
test('source adapters accept inline Sourcify, Etherscan flat and wrapped standard JSON; reject wrong identity and URL-only sources', () => {
  const s = normalizeSourcify(raw(), '1', a); assert.equal(s.name, 'VaultFixture'); assert.equal(s.claim, 'exact_match');
  const e = text => normalizeEtherscan({ status: '1', result: [{ SourceCode: text, ABI: '[]', ContractName: 'VaultFixture', CompilerVersion: 'v0.8.20' }] }, '8453', a);
  assert.equal(e(sourceText).file, 'Contract.sol');
  assert.equal(e(`{${JSON.stringify({ language: 'Solidity', sources: { 'V.sol': { content: sourceText } }, settings: {} })}}`).file, 'V.sol');
  assert.throws(() => normalizeSourcify(raw(b), '1', a)); assert.throws(() => normalizeSourcify(raw(), '8453', a));
  for (const path of ['../escape.sol', '/escape.sol', 'a//b.sol', '__proto__', 'a\\b.sol']) assert.throws(() => sources(Object.fromEntries([[path, { content: 'x' }]])));
  assert.throws(() => sources({ 'A.sol': { urls: ['https://invalid.example/source'] } }));
  assert.throws(() => sources(Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`${i}.sol`, { content: '' }]))));
  assert.throws(() => sources({ 'A.sol': { content: 'a'.repeat(1048577) } }));
  const original = { ...raw(), metadata: { sources: { 'Fixture.sol': { keccak256: keccak256(toHex(sourceText)) } } } };
  assert.equal(normalizeSourcify(original, '1', a).metadataContentCheck.status, 'PASS');
  original.metadata.sources['Fixture.sol'].keccak256 = `0x${'ff'.repeat(32)}`;
  assert.equal(normalizeSourcify(original, '1', a).metadataContentCheck.status, 'FAIL');
});
test('AST inventory resolves selected contract, modifiers, CALL/STATICCALL/DELEGATECALL, state writes and byte locations', async () => {
  const s = normalizeSourcify(raw(), '1', a), result = await analyze(s);
  assert.equal(result.status, 'REVIEW_REQUIRED'); assert.equal(result.functions.length, 5); assert.equal(result.modifiers[0].name, 'onlyOwner');
  assert.deepEqual(result.functions.find(f => f.name === 'forward').modifiers.map(m => m.name), ['onlyOwner']);
  assert(result.callFlow.some(c => c.kind === 'CALL')); assert(result.callFlow.some(c => c.kind === 'STATICCALL')); assert(result.callFlow.some(c => c.kind === 'DELEGATECALL'));
  assert.deepEqual(result.functions.find(f => f.name === 'deposit').directStateWrites, ['balances']);
  assert(result.findings.every(f => f.status === 'REVIEW_REQUIRED' && f.exploitability === 'NOT_PROVEN' && f.location.line > 0));
  assert(!result.functions.some(f => f.contract === 'BatchFixture'));
  assert.equal(s.sources['Fixture.sol'].content, sourceText); assert.equal(result.deploymentRecompile, 'NOT_RUN');
});
test('AST inherited functions and Unicode offsets are preserved; compile incompatibility is UNKNOWN', async () => {
  const text = '// 한국어\npragma solidity ^0.8.20; contract Base { function inherited() public {} } contract VaultFixture is Base { function run() external { inherited(); } }';
  const r = await analyze(normalizeSourcify(raw(a, text), '1', a)); assert.equal(r.functions.length, 2);
  const f = r.functions.find(f => f.name === 'run'); assert.equal(Buffer.from(text).subarray(f.location.byteOffset, f.location.byteOffset + 8).toString(), 'function');
  assert(r.callFlow.some(x => x.kind === 'INTERNAL_CALL'));
  const bad = await analyze(normalizeSourcify(raw(a, 'pragma solidity ^0.8.20; import "missing.sol"; contract VaultFixture {}'), '1', a));
  assert.equal(bad.status, 'UNKNOWN'); assert.equal((await analyze(null)).status, 'UNKNOWN');
});
test('compiler worker terminates under deadline without source diagnostic disclosure', async () => {
  await assert.rejects(syntaxAnalysis({ 'x.sol': { content: sourceText } }, { timeoutMs: 1 }), /COMPILER_FAILED/);
});
test('RPC rejects write methods, unapproved hosts, redirects and oversized responses; consumes budget before sending', async () => {
  const t = new Transport('https://rpc.invalid/?key=fixture-secret', async () => Response.json({}));
  await assert.rejects(t.rpc('eth_sendTransaction')); assert.equal(t.rpcCount, 0);
  assert.throws(() => t.get('https://evil.invalid/server/v2/contract/1/' + a, 'evil')); assert.equal(t.getCount, 0);
  const huge = new Transport('http://127.0.0.1:1', async () => new Response('x'.repeat(1025)), { ...limits, responseBytes: 1024 });
  await assert.rejects(huge.rpc('eth_chainId'), /READ_FAILED/); assert.equal(huge.rpcCount, 1); assert.equal(huge.events[0].status, 'FAILED');
  const capped = new Transport('http://127.0.0.1:1', async (_, init) => { assert.equal(init.redirect, 'error'); return Response.json({ jsonrpc: '2.0', id: 1, result: '0x1' }); }, { ...limits, rpc: 1 });
  assert.equal(await capped.rpc('eth_chainId'), '0x1'); await assert.rejects(capped.rpc('eth_chainId'), /REQUEST_LIMIT/); assert.equal(capped.rpcCount, 1);
  const timeout = new Transport('http://127.0.0.1:1', (_, init) => new Promise((_, reject) => { const timer = setTimeout(() => {}, 100); init.signal.addEventListener('abort', () => { clearTimeout(timer); reject(Error('key=fixture-secret')); }); }), { ...limits, requestMs: 10 });
  await assert.rejects(timeout.rpc('eth_chainId'), /READ_FAILED/);
});
test('EIP1967 implementation and UUPS are candidates, all observations pinned to one canonical hash', async () => {
  const g = gateway({ proxy: true }), s = await collect({ chainId: '1', target: a, rpcURL: 'http://127.0.0.1:1', fetcher: g.fetcher });
  assert.equal(s.canonical, true); assert.equal(s.nodes.length, 2); assert.equal(s.nodes[0].edges[0].address, b); assert.equal(s.nodes[1].uups.status, 'UUID_SIGNAL');
  for (const r of g.requests.filter(r => ['eth_getCode', 'eth_getStorageAt', 'eth_call'].includes(r.method))) assert.deepEqual(r.params.at(-1), { blockHash, requireCanonical: true });
  assert.equal(s.nodes[0].proxyStatus, 'CANDIDATE_REVIEW_REQUIRED');
  const report = await buildReport(s); assert.equal(report.status, 'REVIEW_REQUIRED'); assert.equal(report.contracts[0].verification.status, 'PASS');
});
test('Beacon resolves implementation; cycle, absent beacon code and failed slots remain partial/UNKNOWN', async () => {
  for (const [config, expected] of [[{ beaconProxy: true }, 'OBSERVED'], [{ beaconProxy: true, missingBeacon: true }, 'UNKNOWN']]) {
    const g = gateway(config), s = await collect({ chainId: '1', target: a, rpcURL: 'http://127.0.0.1:1', fetcher: g.fetcher }); assert.equal(s.nodes[0].beacon.status, expected);
  }
  const c = gateway({ proxy: true, cycle: true }); const cycle = await collect({ chainId: '1', target: a, rpcURL: 'http://127.0.0.1:1', fetcher: c.fetcher }); assert(cycle.errors.some(e => e.stage === 'PROXY_CYCLE'));
  const g = gateway({ slotFailure: true }); const partial = await collect({ chainId: '1', target: a, rpcURL: 'http://127.0.0.1:1', fetcher: g.fetcher }); assert.equal(partial.nodes[0].proxyStatus, 'UNKNOWN'); assert(!JSON.stringify(partial).includes('private-fixture-secret'));
});
test('chain mismatch stops further reads, reorg invalidates scoped PASS, missing source never becomes safety PASS', async () => {
  const g = gateway({ badChain: true }); const s = await collect({ chainId: '1', target: a, rpcURL: 'http://127.0.0.1:1', fetcher: g.fetcher }); assert.equal(g.requests.length, 1); assert.equal(s.nodes.length, 0); assert.equal((await buildReport(s)).status, 'UNKNOWN');
  const h = gateway({ reorg: true }); const changed = await collect({ chainId: '1', target: a, rpcURL: 'http://127.0.0.1:1', fetcher: h.fetcher }); assert.equal(changed.canonical, false); assert.equal((await buildReport(changed)).contracts[0].verification.status, 'UNKNOWN');
  const i = gateway({ sourceFailure: true }); const missing = await collect({ chainId: '1', target: a, rpcURL: 'http://127.0.0.1:1', fetcher: i.fetcher }); const r = await buildReport(missing); assert.equal(r.status, 'UNKNOWN'); assert.equal(r.contracts[0].source.status, 'UNKNOWN'); assert.equal(i.requests.filter(x => x.get).length, 1);
});
test('runtime artifact mismatch differs from provider claim and unknown independent recompilation', () => {
  const bundle = normalizeSourcify(raw(), '1', a); assert.equal(compareSource(bundle, '0x6001', true).status, 'FAIL');
  assert.equal(compareSource(bundle, '0x6000', true).localCompiler, 'NOT_RUN'); assert.equal(compareSource(bundle, '0x6000', false).status, 'UNKNOWN');
  assert.equal(compareSource({ ...bundle, providerRecompiledCode: null }, '0x6000', true).status, 'UNKNOWN');
  assert.equal(compareSource(bundle, '0x', true).status, 'UNKNOWN'); assert.equal(wordAddress(zero), null); assert.throws(() => wordAddress(`0x${'ff'.repeat(32)}`));
});
test('total byte/time budgets and source errors preserve private receipts without leaking body into report', async () => {
  const t = new Transport('http://127.0.0.1:1', async () => Response.json({ marker: 'x'.repeat(200) }), { ...limits, totalBytes: 300 });
  await t.get(`https://sourcify.dev/server/v2/contract/1/${a}`, 'sourcify');
  await assert.rejects(t.get(`https://sourcify.dev/server/v2/contract/1/${a}`, 'sourcify'), /READ_FAILED/); assert.equal(t.getCount, 2);
  t.started -= limits.timeoutMs; await assert.rejects(t.rpc('eth_chainId'), /TIME_LIMIT/);
  const bad = new Transport('http://127.0.0.1:1', async () => new Response('provider-private-error', { status: 403 }));
  await assert.rejects(bad.get(`https://sourcify.dev/server/v2/contract/1/${a}`, 'sourcify')); assert.equal(bad.sourceCaptures.length, 1); assert(!JSON.stringify(bad.events).includes('provider-private-error'));
});
test('EIP1167 exact runtime is followed, depth bounded, and snapshot identities are checked offline', async () => {
  const g = gateway(); let levels = 0;
  const fetcher = async (url, options) => {
    if (options.method === 'POST') {
      const r = JSON.parse(options.body);
      if (r.method === 'eth_getCode') {
        levels++; const next = `0x${String(levels + 1).padStart(40, '0')}`;
        return Response.json({ jsonrpc: '2.0', id: r.id, result: `0x363d3d373d3d3d363d73${next.slice(2)}5af43d82803e903d91602b57fd5bf3` });
      }
    }
    return g.fetcher(url, options);
  };
  const s = await collect({ chainId: '1', target: a, rpcURL: 'http://127.0.0.1:1', fetcher }); assert.equal(s.nodes.length, 4); assert.equal(s.nodes[0].edges[0].kind, 'EIP1167_IMPLEMENTATION_CANDIDATE'); assert(s.errors.some(e => e.stage === 'PROXY_DEPTH_OR_NODE_LIMIT')); assert(s.transport.rpc <= 32 && s.transport.get <= 4);
  s.nodes[0].source.address = b; await assert.rejects(buildReport(s), /SNAPSHOT_SOURCE_IDENTITY/);
  assert.throws(() => attachExperiments({ contracts: [] }, {}), /EXPERIMENT_IDENTITY_MISMATCH/);
});
test('opcode fallback skips PUSH data and labels selector/call candidates conservatively', () => {
  const result = inspectBytecode('0x60f463aabbccddf1fa'); assert.deepEqual(result.operations.map(x => x.opcode), ['CALL', 'STATICCALL']); assert.equal(result.selectors[0].candidate, '0xaabbccdd'); assert.equal(inspectBytecode(null).status, 'UNKNOWN');
  const capped = inspectBytecode(`0x${'f1'.repeat(512)}`); assert.equal(capped.operations.length, 256); assert.equal(capped.omittedCandidates, 256);
});
test('reports contain eleven sections, escape untrusted HTML, output is exclusive and never serves snapshot/source', async () => {
  const g = gateway(); const root = await mkdtemp(join(tmpdir(), 'contract-review-')); const out = join(root, 'run');
  let server;
  try {
    const r = await review({ chainId: '1', target: a, rpcURL: 'http://127.0.0.1:1', out, fetcher: g.fetcher }); assert.equal(sections(r).length, 11);
    await assert.rejects(review({ chainId: '1', target: a, rpcURL: 'http://127.0.0.1:1', out, fetcher: g.fetcher }));
    r.errors.push({ test: '</pre><script>evil()</script>' }); const html = dashboard(r); assert(html.includes('&lt;script&gt;evil()&lt;/script&gt;')); assert(!html.includes('<script>evil()')); assert(markdown(r).includes('## Access Control'));
    server = createReportServer(Buffer.from(html)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(url)).status, 200); assert.equal((await fetch(url + '/snapshot.private.json')).status, 404);
    assert.equal((await fetch(url, { method: 'POST' })).status, 405); assert.equal((await fetch(url, { headers: { Origin: 'https://evil.invalid' } })).status, 403);
    const badHost = await new Promise((resolve, reject) => { const req = httpRequest(url, { headers: { Host: 'evil.invalid' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end(); });
    assert.equal(badHost, 403);
    assert(!JSON.stringify(r).includes('http://127.0.0.1:1')); assert.equal(r.tools.slither.execution, 'NOT_RUN');
  } finally { if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); await rm(root, { recursive: true, force: true }); }
});
