import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { keccak256 } from 'viem';
import { proxySlots } from '../src/evm/proxy.js';
import { caller } from '../tools/research/usdc-control-probe.js';
import { rlusdGetters, rlusdReference, roleConstants, probeRLUSD, validateRLUSDReport } from '../tools/research/rlusd-control-probe.js';
import { roleAdminGetter, RoleAdminRpc, probeRoleAdmins, validateRoleAdminReport, validateRoleAdminSource } from '../tools/research/rlusd-role-admin-probe.js';
const zero = '0x' + '00'.repeat(32), other = '0x' + 'ab'.repeat(32), hash = '0x' + '11'.repeat(32), tag = '0x123';
const code = '0x6000', impl = '0x6001';
const ref = { ...rlusdReference, proxyCodeHash: keccak256(code), implementationCodeHash: keccak256(impl) };
async function server(mode: string, run: (url: string, calls: any[]) => Promise<void>) {
  const calls: any[] = []; let chains = 0, headers = 0, proxyCodes = 0; const roleReads = new Map<string, number>();
  const http = createServer(async (req, res) => {
    let raw = ''; for await (const p of req) raw += String(p); const b = JSON.parse(raw); calls.push(b);
    const { method: m, params: p, id } = b;
    const error = () => res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: 3, message: 'execution reverted https://secret.invalid/CANARY' } }));
    let result: any = null;
    if (m === 'eth_chainId') { chains++; result = mode === 'baseChain' || mode === 'preChain' && chains === 3 ? '0x2' : '0x1'; }
    if (m === 'eth_blockNumber') result = tag;
    if (m === 'eth_getBlockByNumber') {
      headers++; if (mode === 'postHeaderError' && headers === 4) { error(); return; }
      result = { number: tag, hash: mode === 'postHeader' && headers === 4 ? other : hash, secret: 'CANARY' };
    }
    if (m === 'eth_getCode') {
      if (p[0] === ref.proxy) { proxyCodes++; result = mode === 'postCode' && proxyCodes === 4 ? '0x6002' : code; } else result = impl;
    }
    if (m === 'eth_getStorageAt') result = p[1] === proxySlots.implementation ? '0x' + '0'.repeat(24) + ref.implementation.slice(2).toLowerCase() : zero;
    if (m === 'eth_call') {
      const data = p[0].data;
      if (data.startsWith(roleAdminGetter.selector)) {
        result = mode === 'otherAdmin' ? other : zero;
        if (mode === 'adminError') { error(); return; }
        if (mode === 'short') result = '0x00';
        if (mode === 'secret') result = 'https://secret.invalid/CANARY';
        if (mode === 'oversized') result = 'CANARY'.repeat(200000);
      } else {
        const g = rlusdGetters.find(g => g.selector === data)!;
        const n = (roleReads.get(g.signature) ?? 0) + 1; roleReads.set(g.signature, n);
        result = g.type === 'bool' ? zero : roleConstants[g.signature] ?? zero;
        if (mode === 'baseRoleError' && g.signature === 'MINTER_ROLE()') { error(); return; }
        if (mode === 'basePausedError' && g.signature === 'paused()') { error(); return; }
        if (mode === 'aliases' && g.signature === 'MINTER_ROLE()') result = zero;
        if (mode === 'postRole' && n === 2 && g.signature === 'MINTER_ROLE()') result = other;
        if (mode === 'postRoleError' && n === 2 && g.signature === 'MINTER_ROLE()') { error(); return; }
      }
    }
    res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve)); const a = http.address(); assert(a && typeof a !== 'string');
  try { await run(`http://127.0.0.1:${a.port}`, calls); }
  finally { http.closeAllConnections(); await new Promise<void>(resolve => http.close(() => resolve())); }
}

test('role-admin probe binds fresh role words, exact calldata, two namespaces and final rechecks without inferring holders', async () => {
  for (const mode of ['success', 'basePausedError', 'aliases', 'otherAdmin']) await server(mode, async (url, calls) => {
    const r = await probeRoleAdmins(url, ref); validateRoleAdminReport(r, ref);
    assert.equal(r.stage, 'OBSERVED'); assert.equal(r.rows.length, 6); assert.equal(r.totalRequestCount, 48); assert.equal(r.requestCount, 26);
    assert.equal(r.membershipExecution, 'NOT_TESTED'); assert.equal(r.authorityState, 'UNKNOWN'); assert.equal(r.verdict, 'INCONCLUSIVE');
    const reads = calls.filter(c => c.method === 'eth_call' && c.params[0].data.startsWith(roleAdminGetter.selector)); assert.equal(reads.length, 6);
    for (const [i, c] of reads.entries()) assert.deepEqual(c.params, [{ to: ref.proxy, from: caller, data: roleAdminGetter.selector + r.rows[i]!.roleId!.slice(2) }, tag]);
    assert.equal(calls.filter(c => c.method === 'eth_blockNumber').length, 1); assert.equal(calls.at(-1).method, 'eth_getBlockByNumber');
    assert(r.rows.every(row => row.roleIdConsistency === 'MATCH')); assert(!JSON.stringify(r).includes('CANARY'));
    assert.equal(r.rows[0]!.selfAdmin, mode !== 'otherAdmin');
    if (mode === 'aliases') assert.deepEqual(r.rows[0]!.adminRoleMatches, ['DEFAULT_ADMIN_ROLE()', 'MINTER_ROLE()']);
    if (mode === 'otherAdmin') assert(r.rows.every(row => row.adminRoleMatches!.length === 0));
    for (const mutate of [(x: any) => x.baseProbeSha256 = 'a'.repeat(64), (x: any) => x.rows[0].baseEvidenceReferences[0].namespace = 'roleAdmin',
      (x: any) => x.rows[0].evidenceReferences[0].namespace = 'baseProbe', (x: any) => x.rows[0].roleId = other,
      (x: any) => x.rows[0].selfAdmin = !x.rows[0].selfAdmin, (x: any) => x.rows[0].adminRoleId = x.rows[0].adminRoleId === other ? zero : other,
      (x: any) => x.rows[0].recheckEvidenceReferences = x.rows[1].recheckEvidenceReferences,
      (x: any) => x.evidence.at(-1).data.result.hash = other]) {
      const changed = structuredClone(r); mutate(changed); assert.throws(() => validateRoleAdminReport(changed, ref));
    }
  });
});

test('missing base role IDs and failed fresh frames prevent all role-admin calls; default base mode remains bounded', async () => {
  for (const mode of ['baseChain', 'baseRoleError', 'preChain']) await server(mode, async (url, calls) => {
    const r = await probeRoleAdmins(url, ref); validateRoleAdminReport(r, ref); assert.equal(r.stage, 'PRECONDITION_ERROR');
    assert(r.rows.every(row => row.readStatus === 'NOT_TESTED'));
    assert(!calls.some(c => c.method === 'eth_call' && c.params[0].data.startsWith(roleAdminGetter.selector)));
    if (mode !== 'preChain') assert.equal(r.evidence.length, 0);
  });
  await server('success', async (url, calls) => { const b = await probeRLUSD(url, ref); validateRLUSDReport(b, ref); assert.equal(b.requestCount, 22); assert.equal(calls.filter(c => c.method === 'eth_call').length, 7); });
});

test('role-admin malformed/reverted/oversized responses stay partial and post-role/code/header errors stay inconsistent', async () => {
  for (const mode of ['short', 'secret', 'adminError', 'oversized', 'postRole', 'postRoleError', 'postCode', 'postHeader', 'postHeaderError']) await server(mode, async url => {
    const r = await probeRoleAdmins(url, ref); validateRoleAdminReport(r, ref);
    assert.equal(r.stage, mode.startsWith('post') ? 'CONSISTENCY_ERROR' : 'PARTIAL'); assert(!JSON.stringify(r).includes('CANARY'));
    if (mode === 'short' || mode === 'secret') assert(r.rows.every(row => row.readStatus === 'INVALID_RESPONSE' && !Object.hasOwn(row, 'adminRoleId')));
    if (mode === 'adminError') assert(r.rows.every(row => row.errorKind === 'REVERT'));
    if (mode === 'postRole') assert.equal(r.rows[1]!.roleIdConsistency, 'MISMATCH');
    if (mode === 'postRoleError') assert.equal(r.rows[1]!.roleIdConsistency, 'NOT_ESTABLISHED');
  });
});

test('role-admin transport freezes observed IDs and rejects arbitrary roles, callers, blocks, selectors, overrides and writes with32request cap', async () => {
  await server('success', async (url, calls) => {
    const b = await probeRLUSD(url, ref), rpc = new RoleAdminRpc(url, b, ref); const roleId = b.readings[1]!.value as string;
    b.readings[1]!.value = other;
    const tx = { to: ref.proxy, from: caller, data: roleAdminGetter.selector + roleId.slice(2) };
    const denied: [string, any[]][] = [['eth_blockNumber', []], ['eth_sendTransaction', []], ['eth_sendRawTransaction', ['0x00']],
      ['eth_call', [{ ...tx, data: roleAdminGetter.selector + other.slice(2) }, tag]], ['eth_call', [{ ...tx, data: tx.data + '00' }, tag]],
      ['eth_call', [{ ...tx, data: '0x91d14854' }, tag]], ['eth_call', [{ ...tx, to: ref.implementation }, tag]], ['eth_call', [{ ...tx, from: ref.proxy }, tag]],
      ['eth_call', [tx, 'latest']], ['eth_call', [tx, tag, {}]], ['eth_call', [{ ...tx, value: '0x0' }, tag]], ['eth_getBlockByNumber', ['0x124', false]]];
    for (const [m, p] of denied) await assert.rejects(rpc.request(m, p), /scope/); assert.equal(calls.length, 22);
    await rpc.request('eth_call', [tx, tag]); for (let i = 0; i < 31; i++) await rpc.request('eth_chainId');
    await assert.rejects(rpc.request('eth_chainId'), /budget/); assert.equal(rpc.evidence.length, 32); assert.equal(calls.length, 54);
  });
});

test('role-admin source hash and canonical getRoleAdmin view signature are fixed', () => {
  const raw = readFileSync(new URL('../docs/research/rlusd-control-abi-study.json', import.meta.url)); validateRoleAdminSource(raw);
  const altered = JSON.parse(raw.toString()); altered.getterCandidates.find((g: any) => g.signature === roleAdminGetter.signature).outputs = ['address'];
  assert.throws(() => validateRoleAdminSource(Buffer.from(JSON.stringify(altered))));
});

test('role-admin CLI preserves failed-gate evidence in0600 and existing output on configuration failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'role-admin-')), out = join(directory, 'report.json'), run = promisify(execFile);
  try {
    await server('success', async url => {
      await assert.rejects(run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/rlusd-role-admin-probe.ts', '--out', out], { env: { ...process.env, RPC_URL: url }, timeout: 15000 }));
      const r = JSON.parse(await readFile(out, 'utf8')); validateRoleAdminReport(r); assert.equal(r.stage, 'PRECONDITION_ERROR'); assert.equal((await stat(out)).mode & 0o777, 0o600);
    });
    await writeFile(out, 'KEEP');
    await assert.rejects(run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/rlusd-role-admin-probe.ts', '--out', out], { env: { ...process.env, RPC_URL: '' }, timeout: 15000 }));
    assert.equal(await readFile(out, 'utf8'), 'KEEP');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
