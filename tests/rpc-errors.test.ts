import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { Rpc, RpcError, isRevert } from '../src/evm/rpc.js';
import { json } from '../src/domain/evaluator.js';
import { commandErrorMessage } from '../src/diagnostics.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertReportContract } from './helpers/report-contract.js';

type Request = { id: number; method: string };
const secret = 'synthetic-credential-sentinel';
const encoded = Buffer.from(secret).toString('base64');
async function withServer(reply: (request: Request, response: ServerResponse) => void, run: (url: string) => Promise<void>) {
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += String(chunk);
    reply(JSON.parse(raw) as Request, response);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}/synthetic-path?token=${secret}`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
function cli(url: string, token = '0x1111111111111111111111111111111111111111', out?: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'src/cli.ts', 'assess', '--network', '1', '--token', token,
      ...(out ? ['--out', out] : [])],
      { cwd: new URL('..', import.meta.url), env: { ...process.env, RPC_URL: url }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += String(data); });
    child.stderr.on('data', data => { stderr += String(data); });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

test('RPC error evidence omits free-form message, nested data and unexpected diagnostic fields', async () => {
  for (const [code, message, reverted] of [[-32000, `provider password=${secret}`, false],
    [-32000, `execution reverted: ${secret}`, true], [3, `opaque ${secret}`, true],
    [-32015, `execution reverted: ${secret}`, true], [-32603, `execution reverted: ${secret}`, true],
    [-32601, `method not found token=${secret}`, false],
    [-32601, `execution reverted: ${secret}`, false],
    [-32000, `cannot revert pending transaction ${secret}`, false]] as const) {
    await withServer((request, response) => response.end(JSON.stringify({ jsonrpc: '2.0', id: request.id,
      error: { code, message, data: { nested: [{ authorization: `Bearer ${secret}`, encoded }], endpoint: `https://${secret}.example` },
        [secret]: secret } })), async url => {
      const rpc = new Rpc(url);
      await assert.rejects(rpc.request('eth_call', []), error => {
        assert(error instanceof RpcError);
        assert.equal(error.code, code);
        assert.equal(isRevert(error), reverted);
        assert.equal(Object.hasOwn(error, 'data'), false);
        assert.equal(error.category, reverted ? 'REVERT' : 'RPC_ERROR');
        assert(!String(error.stack).includes(secret));
        return true;
      });
      const recorded = rpc.evidence[0]!.data as { error: Record<string, unknown> };
      assert.equal(recorded.error.code, code);
      assert.equal(recorded.error.upstreamDetailsOmitted, true);
      assert(!json(rpc.evidence).includes(secret));
      assert(!json(rpc.evidence).includes(encoded));
      assert(!json(rpc.evidence).includes('https://'));
    });
  }
});

test('revert classification uses code/explicit flag and CLI diagnostics fail closed', async () => {
  assert.equal(isRevert(new RpcError(-32601, 'execution reverted')), false);
  assert.equal(isRevert(new RpcError(-32000, 'sanitized text without keywords', true)), true);
  const error = new Error(secret);
  Object.defineProperty(error, 'message', { get() { throw new Error(secret); } });
  assert.equal(commandErrorMessage(error), 'Unexpected command failure; details omitted.');
  const invalid = `https://%${secret}`;
  assert.throws(() => new Rpc(invalid), error => {
    assert(error instanceof Error); assert.equal(error.message, 'Invalid RPC URL.');
    assert.equal(Object.hasOwn(error, 'input'), false); return true;
  });
  const result = await cli(invalid);
  assert.equal(result.code, 1); assert.equal(result.stdout, '');
  assert(!result.stderr.includes(secret)); assert(result.stderr.includes('Invalid RPC URL.'));
});

test('CLI report files preserve inconclusive error evidence without upstream diagnostic canaries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'compatibility-rpc-errors-'));
  try {
    await withServer((request, response) => {
      const values: Record<string, unknown> = { eth_chainId: '0x1', eth_blockNumber: '0x1',
        eth_getBlockByNumber: { number: '0x1', hash: '0x' + 'ab'.repeat(32) }, eth_getCode: '0x6000', eth_getStorageAt: '0x' + '0'.repeat(64) };
      const envelope = request.method === 'eth_call'
        ? { error: { code: -32000, message: secret, data: { encoded }, [secret]: secret } }
        : { result: values[request.method] };
      response.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, ...envelope }));
    }, async url => {
      const path = join(directory, 'readonly.json');
      const result = await cli(url, undefined, path);
      assert.equal(result.code, 0); assert.equal(result.stdout, '');
      const serialized = await readFile(path, 'utf8');
      for (const value of [secret, encoded, url]) {
        assert(!serialized.includes(value)); assert(!result.stderr.includes(value));
      }
      const report: unknown = JSON.parse(serialized);
      assertReportContract(report);
      assert.equal(report.results.find(r => r.scenarioId === 'ERC20-001')!.verdict, 'INCONCLUSIVE');
      assert(report.results.filter(r => r.scenarioId.startsWith('ERC20-00') && r.scenarioId !== 'ERC20-001')
        .every(r => r.verdict === 'NOT_TESTED'));
      const errors = report.evidence.filter(e => e.kind === 'RPC').map(e => e.data as { error?: { code: number; category: string; upstreamDetailsOmitted: boolean } })
        .flatMap(e => e.error ? [e.error] : []);
      assert.equal(errors.length, 4);
      assert(errors.every(e => e.code === -32000 && e.category === 'RPC_ERROR' && e.upstreamDetailsOmitted));
    });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('malformed RPC envelopes are transport/protocol errors without raw response details', async () => {
  const cases: ((id: number) => unknown)[] = [
    () => null, () => secret, () => [], id => ({ id, result: '0x1' }),
    id => ({ jsonrpc: '2.0', id: id + 1, result: secret }),
    id => ({ jsonrpc: '2.0', id, result: secret, error: { code: 3, message: secret } }),
    id => ({ jsonrpc: '2.0', id, error: null }),
    id => ({ jsonrpc: '2.0', id, error: [] }),
    id => ({ jsonrpc: '2.0', id, error: {} }),
    id => ({ jsonrpc: '2.0', id, error: { code: '3', message: secret } }),
    id => ({ jsonrpc: '2.0', id, error: { code: 1.5, message: secret } }),
    id => ({ jsonrpc: '2.0', id, error: { code: 3, message: { secret } } }),
  ];
  for (const make of cases) await withServer((request, response) => response.end(JSON.stringify(make(request.id))), async url => {
    const rpc = new Rpc(url);
    await assert.rejects(rpc.request('eth_chainId'), error => {
      assert(error instanceof Error);
      assert.equal(error.message, 'RPC transport/protocol failure');
      assert.equal(isRevert(error), false); return true;
    });
    assert.equal(rpc.evidence[0]!.kind, 'RPC_ERROR');
    assert(!json(rpc.evidence).includes(secret));
  });
});

test('HTTP status, invalid JSON and socket failures retain safe diagnostics; successful results remain raw', async () => {
  for (const status of [401, 429, 451]) await withServer((_request, response) => {
    response.writeHead(status); response.end(secret);
  }, async url => {
    const rpc = new Rpc(url);
    await assert.rejects(rpc.request('eth_chainId'), new RegExp(`HTTP ${status}`));
    assert(!json(rpc.evidence).includes(secret));
  });
  for (const close of [false, true]) await withServer((_request, response) => {
    if (close) response.destroy(); else response.end(`{invalid ${secret}`);
  }, async url => {
    await assert.rejects(new Rpc(url).request('eth_chainId'), /RPC transport\/protocol failure/);
  });
  await withServer((request, response) => response.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: '0x1234' })), async url => {
    const rpc = new Rpc(url);
    assert.equal(await rpc.request('eth_getCode'), '0x1234');
    assert.equal((rpc.evidence[0]!.data as { result: string }).result, '0x1234');
  });
});

test('CLI suppresses echoed credentials in upstream failures and unexpected decode/input errors', async () => {
  for (const success of [false, true]) await withServer((request, response) => response.end(JSON.stringify({ jsonrpc: '2.0', id: request.id,
    ...(success ? { result: secret } : { error: { code: -32000, message: secret, data: { secret } } }) })), async url => {
    const result = await cli(url);
    assert.equal(result.code, 1); assert.equal(result.stdout, '');
    assert(!result.stderr.includes(secret)); assert(!result.stderr.includes(url));
    assert(result.stderr.includes('Command failed:'));
    if (!success) assert(result.stderr.includes('RPC error (code -32000)'));
  });
  await withServer((_request, response) => { response.end('{}'); }, async url => {
    const result = await cli(url, secret);
    assert.equal(result.code, 1); assert(!result.stderr.includes(secret));
  });
});
