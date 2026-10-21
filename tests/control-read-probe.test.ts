import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keccak256 } from 'viem';
import { probeControlCandidates, usdcReference, ControlProbeRpc, getters, caller, validateControlProbe, decodeControlWord, decodeRoleCode, maxRoleCodeBytes } from '../tools/research/usdc-control-probe.js';
import { proxySlots } from '../src/evm/proxy.js';

const reference = { ...usdcReference, proxyCodeHash: keccak256('0x6000'), implementationCodeHash: keccak256('0x6001') };
const word = (n: bigint) => '0x' + n.toString(16).padStart(64, '0');
const hash = '0x' + '11'.repeat(32);
type Request = { id: number; method: string; params: any[] };
type Fault = { network?: boolean; code?: boolean; implementation?: boolean; reorg?: boolean; reorgFinal?: boolean; postCode?: boolean; postTransport?: boolean;
  calls?: (body: Request) => unknown; roleCode?: (body: Request, occurrence: number) => unknown };
async function server(fault: Fault, run: (url: string, calls: Request[]) => Promise<void>) {
  const calls: Request[] = []; const roleCalls = new Map<string, number>(); let headers = 0, proxyCodes = 0;
  const http = createServer(async (req, res) => {
    let input = ''; for await (const chunk of req) input += String(chunk);
    const body = JSON.parse(input) as Request; calls.push(body);
    let result: unknown;
    if (body.method === 'eth_chainId') result = fault.network ? '0x2' : '0x1';
    else if (body.method === 'eth_blockNumber') result = '0x20';
    else if (body.method === 'eth_getBlockByNumber') {
      headers++;
      if (headers > 1 && fault.postTransport) { res.statusCode = 503; res.end('https://secret.invalid/token-CANARY'); return; }
      result = { number: '0x20', hash: (headers > 1 && fault.reorg) || (headers > 2 && fault.reorgFinal) ? '0x' + '22'.repeat(32) : hash };
    } else if (body.method === 'eth_getCode') {
      if (body.params[0] === reference.proxy) { proxyCodes++; result = fault.code || (fault.postCode && proxyCodes > 1) ? '0x6002' : '0x6000'; }
      else if (body.params[0] === reference.implementation) result = '0x6001';
      else {
        const count = (roleCalls.get(body.params[0]) ?? 0) + 1; roleCalls.set(body.params[0], count);
        const value = fault.roleCode?.(body, count) ?? '0x6001';
        if (value && typeof value === 'object') { res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: value })); return; }
        result = value;
      }
    } else if (body.method === 'eth_getStorageAt') result = body.params[1] === proxySlots.legacyImplementation
      ? word(fault.implementation ? 123n : BigInt(reference.implementation)) : word(0n);
    else if (body.method === 'eth_call') {
      const response = fault.calls?.(body);
      if (response && typeof response === 'object') { res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: response })); return; }
      result = response ?? (body.params[0].data === getters[2].selector ? word(0n) : word(123n));
    } else { res.statusCode = 500; res.end(); return; }
    res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address(); assert(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`, calls); }
  finally { http.closeAllConnections(); await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve())); }
}

test('qualified control probe reads only five canonical words in one fixed caller/block context', async () => {
  await server({}, async (url, calls) => {
    const result = await probeControlCandidates(url, reference); validateControlProbe(result);
    assert(!('roleCodeReadings' in result));
    assert.equal(result.stage, 'OBSERVED'); assert.equal(result.verdict, 'INCONCLUSIVE'); assert.equal(result.authorityState, 'UNKNOWN');
    assert.equal(result.readings[2]!.value, false); assert.equal(result.readings[5]!.readStatus, 'NOT_TESTED');
    const reads = calls.filter(c => c.method === 'eth_call'); assert.equal(reads.length, 5);
    assert.deepEqual(reads.map(c => c.params), getters.map(g => [{ to: reference.proxy, from: caller, data: g.selector }, '0x20']));
    assert.equal(calls.filter(c => c.method === 'eth_getBlockByNumber').length, 2);
    assert.equal(calls.filter(c => c.method === 'eth_getCode').length, 6, 'Default mode has no additional role code queries');
    assert(calls.every(c => ['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call'].includes(c.method)));
    for (const c of calls.filter(c => ['eth_getCode', 'eth_getStorageAt', 'eth_call'].includes(c.method))) assert.equal(c.params.at(-1), '0x20');
    for (const mutate of [(r: any) => r.readings[0].evidenceReferences.push('e999'), (r: any) => r.readings[5].readStatus = 'OK',
      (r: any) => r.authorityState = 'KNOWN', (r: any) => r.readings[2].value = true]) {
      const changed = structuredClone(result); mutate(changed); assert.throws(() => validateControlProbe(changed));
    }
  });
});

const distinctRoles = (b: Request) => b.params[0].data === getters[2].selector ? word(0n)
  : word(BigInt(123 + getters.findIndex(g => g.selector === b.params[0].data)));
test('optional role-code binds four getter addresses, EMPTY and PRESENT bytes, and final rechecks', async () => {
  await server({ calls: distinctRoles, roleCode: b => BigInt(b.params[0]) === 123n ? '0x' : BigInt(b.params[0]) === 124n ? '0x00' : '0xef0100' + '11'.repeat(20) }, async (url, calls) => {
    const r = await probeControlCandidates(url, reference, { roleCode: true }); validateControlProbe(r);
    assert.equal(r.stage, 'OBSERVED'); const roles = r.roleCodeReadings!;
    assert.equal(roles[0]!.codePresence, 'EMPTY'); assert.equal(roles[0]!.codeBytes, 0); assert.equal(roles[0]!.codeHash, keccak256('0x'));
    assert.equal(roles[1]!.codePresence, 'PRESENT'); assert.equal(roles[1]!.codeBytes, 1);
    assert(roles.every(role => role.consistency === 'MATCH')); assert.equal(r.authorityState, 'UNKNOWN');
    assert.equal(calls.filter(c => c.method === 'eth_getBlockByNumber').length, 3);
    assert.equal(calls.at(-1)!.method, 'eth_getBlockByNumber');
    assert(calls.filter(c => c.method === 'eth_call').every(c => c.params[0].to === reference.proxy));
    for (const role of roles) {
      const reads = calls.filter(c => c.method === 'eth_getCode' && c.params[0] === role.address);
      assert.equal(reads.length, 2); assert(reads.every(c => c.params[1] === '0x20'));
    }
    for (const mutate of [(p: any) => p.roleCodeReadings[0].codeBytes = 1, (p: any) => p.roleCodeReadings[0].codeHash = keccak256('0x00'),
      (p: any) => p.roleCodeReadings[0].signature = 'pauser()', (p: any) => p.roleCodeReadings[0].address = caller,
      (p: any) => p.roleCodeReadings[0].getterEvidenceReferences = p.roleCodeReadings[1].getterEvidenceReferences,
      (p: any) => p.evidence.find((e: any) => e.id === p.roleCodeReadings[0].evidenceReferences[0]).data.params[1] = '0x21',
      (p: any) => p.roleCodeReadings[0].recheckEvidenceReferences = p.roleCodeReadings[0].evidenceReferences]) {
      const changed = structuredClone(r); mutate(changed); assert.throws(() => validateControlProbe(changed));
    }
  });
});

test('failed getter grants no role code read; duplicate getter addresses retain separate role provenance', async () => {
  await server({ calls: b => b.params[0].data === getters[0].selector ? { code: 3, message: 'CANARY' } : distinctRoles(b) }, async (url, calls) => {
    const r = await probeControlCandidates(url, reference, { roleCode: true }); validateControlProbe(r);
    assert.equal(r.stage, 'PARTIAL'); assert.equal(r.roleCodeReadings![0]!.readStatus, 'NOT_TESTED');
    assert(!calls.some(c => c.method === 'eth_getCode' && BigInt(c.params[0]) === 123n));
  });
  await server({}, async url => {
    const r = await probeControlCandidates(url, reference, { roleCode: true }); validateControlProbe(r);
    assert.equal(new Set(r.roleCodeReadings!.map(r => r.address)).size, 1);
    assert.equal(new Set(r.roleCodeReadings!.map(r => r.getterEvidenceReferences[0])).size, 4);
  });
  const rpc = new ControlProbeRpc('http://127.0.0.1:1', reference); rpc.block = '32';
  assert.throws(() => rpc.registerRoleCodeAddress('owner()', caller));
  await assert.rejects(rpc.request('eth_getCode', [caller, '0x20']), /Disallowed/);
});

test('invalid role code and first-read errors remain partial without fabricated EMPTY or recheck', async () => {
  for (const raw of ['0x0', '0xzz', '0x' + '00'.repeat(maxRoleCodeBytes + 1)]) assert.throws(() => decodeRoleCode(raw));
  for (const response of ['0x0', { code: -32000, message: 'https://secret.invalid/CANARY' }]) await server({ calls: distinctRoles, roleCode: b => BigInt(b.params[0]) === 123n ? response : '0x' }, async url => {
    const r = await probeControlCandidates(url, reference, { roleCode: true }); validateControlProbe(r);
    assert.equal(r.stage, 'PARTIAL'); const role = r.roleCodeReadings![0]!;
    assert.notEqual(role.readStatus, 'OK'); assert(!('codePresence' in role)); assert.equal(role.recheckEvidenceReferences.length, 0);
    assert(!JSON.stringify(r).includes('CANARY'));
  });
});

test('post-role code mutation, failure and final-header reorg make the entire snapshot inconclusive', async () => {
  for (const fault of [
    { roleCode: (_b: Request, n: number) => n > 1 ? '0x00' : '0x' },
    { roleCode: (_b: Request, n: number) => n > 1 ? { code: -32000, message: 'CANARY' } : '0x' },
    { roleCode: (_b: Request, n: number) => n > 1 ? '0x0' : '0x' },
    { reorgFinal: true },
  ]) await server({ calls: distinctRoles, ...fault }, async url => {
    const r = await probeControlCandidates(url, reference, { roleCode: true }); validateControlProbe(r);
    assert.equal(r.stage, 'CONSISTENCY_ERROR'); assert.equal(r.verdict, 'INCONCLUSIVE'); assert(!JSON.stringify(r).includes('CANARY'));
    const changed = structuredClone(r); changed.stage = 'OBSERVED';
    assert.throws(() => validateControlProbe(changed));
  });
});

test('network, proxy code or declared implementation mismatch prevents all control calls', async () => {
  for (const fault of [{ network: true }, { code: true }, { implementation: true }]) {
    await server(fault, async (url, calls) => {
      const result = await probeControlCandidates(url, reference); validateControlProbe(result);
      assert.equal(result.stage, 'PRECONDITION_ERROR'); assert(result.readings.every(r => r.readStatus === 'NOT_TESTED'));
      assert.equal(calls.filter(c => c.method === 'eth_call').length, 0);
    });
  }
});

test('reorg, post-read code change and header transport failure retain an inconsistent partial observation', async () => {
  for (const fault of [{ reorg: true }, { postCode: true }, { postTransport: true }]) await server(fault, async url => {
    const result = await probeControlCandidates(url, reference); validateControlProbe(result);
    assert.equal(result.stage, 'CONSISTENCY_ERROR'); assert.equal(result.verdict, 'INCONCLUSIVE');
    assert.equal(result.readings.filter(r => r.readStatus === 'OK').length, 5);
    assert(!JSON.stringify(result).includes('CANARY'));
  });
});

test('dirty/noncanonical/short/long words remain unknown, never coerced to false or an address', async () => {
  for (const raw of ['0x', word(2n), word(0n) + '00', '0x' + '01'.repeat(32)]) assert.throws(() => decodeControlWord(raw, 'bool'));
  assert.throws(() => decodeControlWord('0x' + '01'.repeat(32), 'address'));
  assert.equal(decodeControlWord(word(0n), 'address'), caller);
  await server({ calls: b => b.params[0].data === getters[2].selector ? word(2n) : '0x' + '01'.repeat(32) }, async url => {
    const result = await probeControlCandidates(url, reference); validateControlProbe(result);
    assert.equal(result.stage, 'PARTIAL'); assert(result.readings.slice(0, 5).every(r => r.readStatus === 'INVALID_RESPONSE' && !('value' in r)));
  });
});

test('revert and RPC error preserve other reads and omit upstream endpoint/secret canaries', async () => {
  await server({ calls: b => b.params[0].data === getters[0].selector ? { code: 3, message: 'https://secret.invalid/CANARY' }
    : b.params[0].data === getters[1].selector ? { code: -32601, message: 'CANARY missing method' } : undefined }, async url => {
    const result = await probeControlCandidates(url, reference); validateControlProbe(result);
    assert.equal(result.stage, 'PARTIAL'); assert.equal(result.readings[0]!.errorKind, 'REVERT'); assert.equal(result.readings[1]!.errorKind, 'RPC_ERROR');
    assert.equal(result.readings[2]!.readStatus, 'OK'); assert(!JSON.stringify(result).includes('CANARY'));
    assert(!JSON.stringify(result).includes(url));
  });
});

test('control RPC rejects send, alternate caller, arbitrary calldata, state override and latest before transport', async () => {
  const rpc = new ControlProbeRpc('http://127.0.0.1:1', reference); rpc.block = '32';
  for (const [method, params] of [
    ['eth_sendTransaction', []], ['eth_sign', []],
    ['eth_call', [{ to: reference.proxy, from: reference.proxy, data: getters[0].selector }, '0x20']],
    ['eth_call', [{ to: reference.proxy, from: caller, data: '0xdeadbeef' }, '0x20']],
    ['eth_call', [{ to: reference.proxy, from: caller, data: getters[0].selector }, '0x20', {}]],
    ['eth_call', [{ to: reference.proxy, from: caller, data: getters[0].selector }, 'latest']],
  ] as [string, unknown[]][]) await assert.rejects(rpc.request(method, params), /Disallowed/);
  assert.equal(rpc.evidence.length, 0);
});

test('probe CLI saves precondition error evidence privately and preserves existing output on startup failure', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'control-probe-')), output = join(dir, 'probe.json');
  const run = promisify(execFile);
  try {
    await server({}, async (url, calls) => {
      // Synthetic code differs from the fixed mainnet reference: CLI must save
      // the partial evidence with zero getter calls before returning exit 1.
      await assert.rejects(run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/usdc-control-probe.ts', '--out', output],
        { env: { ...process.env, RPC_URL: url }, timeout: 10_000 }), (e: any) => e.code === 1);
      const partial = JSON.parse(await readFile(output, 'utf8')); validateControlProbe(partial);
      assert.equal(partial.stage, 'PRECONDITION_ERROR'); assert.equal((await stat(output)).mode & 0o777, 0o600);
      assert.equal(calls.filter(c => c.method === 'eth_call').length, 0);
    });
    await writeFile(output, 'previous report');
    await assert.rejects(run(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'tools/research/usdc-control-probe.ts', '--out', output],
      { env: { ...process.env, RPC_URL: '' }, timeout: 10_000 }));
    assert.equal(await readFile(output, 'utf8'), 'previous report');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
