import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, stat, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Transport, limits } from '../src/contract-review/network.mjs';
import { observeRuntime, claimRuntimeSlot, runRuntimeRead, runtimeReadPlan, infuraRuntimeReadPlan, selectInfuraRPC } from '../src/contract-review/runtime-once.mjs';

const hash = `0x${'aa'.repeat(32)}`;
function gateway({ badChain, empty, reorg, wrongHeight, denied, failed } = {}) {
  const requests = [];
  const t = new Transport('http://127.0.0.1:1', async (_, init) => {
    const r = JSON.parse(init.body); requests.push(r);
    assert.equal(init.redirect, 'error');
    if (failed) throw Error('fixture-secret');
    if (r.method === 'eth_getCode' && denied) return Response.json({ jsonrpc: '2.0', id: r.id, error: { message: 'fixture-secret' } });
    const result = r.method === 'eth_chainId' ? (badChain ? '0x2' : '0x1')
      : r.method === 'eth_getCode' ? (empty ? '0x' : '0x6000')
        : { number: wrongHeight && r.params[0] !== 'latest' ? '0x11' : '0x10', hash: reorg && r.params[0] !== 'latest' ? `0x${'bb'.repeat(32)}` : hash };
    return Response.json({ jsonrpc: '2.0', id: r.id, result });
  }, { ...limits, rpc: 4, get: 0 });
  return { t, requests };
}

test('runtime-only sequence reads one fixed address/hash and verifies the original height in four calls', async () => {
  const { t, requests } = gateway();
  const r = await observeRuntime(t);
  assert.equal(r.status, 'OBSERVED'); assert.equal(r.canonical, true); assert.equal(r.code, '0x6000');
  assert.deepEqual(requests.map(x => [x.method, x.params]), [
    ['eth_chainId', []], ['eth_getBlockByNumber', ['latest', false]],
    ['eth_getCode', [runtimeReadPlan.address, { blockHash: hash, requireCanonical: true }]],
    ['eth_getBlockByNumber', ['0x10', false]],
  ]);
  await assert.rejects(t.rpc('eth_chainId'), /REQUEST_LIMIT/);
  await assert.rejects(t.get('https://sourcify.dev/server/v2/contract/1/' + runtimeReadPlan.address, 'sourcify'), /REQUEST_LIMIT/);
  assert.equal(requests.length, 4); assert.equal(t.getCount, 0);
});

test('runtime-only failures stop without retries, number fallback or further address reads', async () => {
  for (const [config, count] of [[{ badChain: true }, 1], [{ failed: true }, 1], [{ empty: true }, 3], [{ denied: true }, 3], [{ reorg: true }, 4], [{ wrongHeight: true }, 4]]) {
    const { t, requests } = gateway(config);
    const r = await observeRuntime(t);
    assert.equal(r.status, 'INCONCLUSIVE'); assert.equal(r.canonical, false); assert.equal(requests.length, count);
    assert(!JSON.stringify({ r, events: t.events }).includes('fixture-secret'));
  }
});

test('one-use slot is exclusive across competing claims and preserves its permanent consumption marker', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contract-runtime-slot-'));
  try {
    const slot = join(root, 'one-use');
    const results = await Promise.allSettled([claimRuntimeSlot(slot), claimRuntimeSlot(slot)]);
    assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(results.filter(x => x.status === 'rejected').length, 1);
    const marker = await readFile(join(slot, 'consumed.json'), 'utf8');
    assert.equal(JSON.parse(marker).status, 'CONSUMED_BEFORE_FIRST_SEND');
    await assert.rejects(claimRuntimeSlot(slot));
    assert.equal(await readFile(join(slot, 'consumed.json'), 'utf8'), marker);
    assert.equal((await stat(slot)).mode & 0o777, 0o700);
    for (const file of ['plan.json', 'consumed.json']) assert.equal((await stat(join(slot, file))).mode & 0o777, 0o600);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('missing or changed pinned inputs stop before claiming a slot or sending any request', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contract-runtime-input-'));
  let calls = 0;
  try {
    const fetcher = async () => { calls++; throw Error(); };
    await assert.rejects(runRuntimeRead(root, fetcher));
    await mkdir(join(root, '.state'));
    await mkdir(join(root, '.state/contract-review-multicall3-live-20261026'));
    for (const file of ['contract-review-sourcify-initial.json', 'contract-review-multicall3-live-20261026/plan.json', 'contract-review-multicall3-live-20261026/snapshot.private.json']) await writeFile(join(root, '.state', file), '{}');
    await assert.rejects(runRuntimeRead(root, fetcher), /INPUT_CHANGED/);
    assert.equal(calls, 0);
    await assert.rejects(stat(join(root, runtimeReadPlan.slot)), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Infura selector accepts only the fixed HTTPS mainnet route and rejects insecure or unrelated configurations', () => {
  const key = 'fixture-private-key-marker', url = `https://mainnet.infura.io/v3/${key}`;
  assert.equal(selectInfuraRPC({ RPC_URL: url }), url);
  for (const invalid of [undefined, 'invalid', `http://mainnet.infura.io/v3/${key}`, `https://mainnet.infura.io:8443/v3/${key}`,
    `https://user:${key}@mainnet.infura.io/v3/${key}`, `${url}?key=${key}`, `${url}#${key}`, `${url}?`, `${url}#`, `${url}/extra`,
    `https://mainnet.infura.io.evil.invalid/v3/${key}`, `https://polygon-mainnet.infura.io/v3/${key}`, 'https://mainnet.infura.io/v3/']) {
    assert.throws(() => selectInfuraRPC({ RPC_URL: invalid }), { message: 'INFURA_CONFIGURATION_INVALID' });
  }
  assert.throws(() => selectInfuraRPC({ RPC_URL: url, NODE_TLS_REJECT_UNAUTHORIZED: '0' }), { message: 'INFURA_CONFIGURATION_INVALID' });
});

test('Infura profile has its own exclusive slot and four pinned inputs without changing the v2 plan', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contract-runtime-profiles-'));
  try {
    assert.notEqual(infuraRuntimeReadPlan.slot, runtimeReadPlan.slot);
    assert.equal(runtimeReadPlan.endpoint, 'publicRPC[1]');
    assert.equal(infuraRuntimeReadPlan.endpoint, 'RPC_URL:INFURA_ETHEREUM_MAINNET');
    assert.equal(infuraRuntimeReadPlan.rpc, 4); assert.equal(infuraRuntimeReadPlan.get, 0);
    const v2 = join(root, 'v2'), v3 = join(root, 'v3');
    await claimRuntimeSlot(v2);
    await claimRuntimeSlot(v3, infuraRuntimeReadPlan);
    const oldBytes = await readFile(join(v2, 'plan.json'), 'utf8');
    const plan = JSON.parse(await readFile(join(v3, 'plan.json'), 'utf8'));
    assert.equal(JSON.parse(oldBytes).inputs.length, 3);
    assert.equal(plan.inputs.length, 4);
    assert(plan.inputs.some(x => x.path.endsWith('v2/receipt.json') && x.sha256 === '6f62fa74a52faa87e15842878296da12f8de992ef80f9897015dae56643f4def'));
    assert(!JSON.stringify(plan).includes('https://'));
    await assert.rejects(claimRuntimeSlot(v3, infuraRuntimeReadPlan));
    await assert.rejects(claimRuntimeSlot(join(root, 'forged'), { ...infuraRuntimeReadPlan, endpoint: 'fixture-private-key-marker' }), /UNKNOWN_RUNTIME_PROFILE/);
    assert.equal(await readFile(join(v2, 'plan.json'), 'utf8'), oldBytes);
    await assert.rejects(stat(join(root, 'forged')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Infura CLI rejects missing, ambiguous and arbitrary modes before reading configuration', () => {
  const cli = new URL('../tools/contract-review-infura-runtime-read.mjs', import.meta.url);
  for (const args of [[], ['--preflight', '--execute'], ['--endpoint', 'fixture-private-key-marker']]) {
    const result = spawnSync(process.execPath, [cli.pathname, ...args], { encoding: 'utf8', env: { ...process.env, RPC_URL: 'https://mainnet.infura.io/v3/fixture-private-key-marker' } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /INFURA_RUNTIME_READ_STOPPED/);
    assert(!`${result.stdout}${result.stderr}`.includes('fixture-private-key-marker'));
  }
});
