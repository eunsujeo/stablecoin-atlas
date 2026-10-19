import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Rpc } from '../src/evm/rpc.js';
import { assessReadOnly } from '../src/assessment.js';

const hash = '0x' + 'ab'.repeat(32);
const token = '0x1111111111111111111111111111111111111111';
type Request = { id: number; method: string; params: unknown[] };
async function serverFor(run: (context: {
  url: string; requests: Request[]; response: { number: unknown; header: unknown; failure?: string };
}) => Promise<void>) {
  const requests: Request[] = [];
  const response: { number: unknown; header: unknown; failure?: string } = { number: '0x1', header: { number: '0x1', hash } };
  const server = createServer(async (request, reply) => {
    let raw = ''; for await (const chunk of request) raw += String(chunk);
    const body = JSON.parse(raw) as Request; requests.push(body);
    const result = body.method === 'eth_chainId' ? '0x1' : body.method === 'eth_blockNumber' ? response.number : response.header;
    reply.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, ...(body.method === response.failure
      ? { error: { code: -32000, message: 'Injected local unavailability' } } : { result }) }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  try { await run({ url: `http://127.0.0.1:${address.port}`, requests, response }); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('block reference validates genesis/large heights and publishes exact decimal height and observed hash', async () => {
  await serverFor(async ({ url, requests, response }) => {
    const rpc = new Rpc(url);
    for (const number of ['0x0', '0xa', '0x20000000000001']) {
      const previousEvidence = structuredClone(rpc.evidence);
      response.number = number; response.header = { number: number === '0xa' ? '0xA' : number, hash };
      assert.equal(await rpc.pin(), number);
      assert.deepEqual(rpc.evidence.slice(0, previousEvidence.length), previousEvidence);
      assert.equal(rpc.block, BigInt(number).toString());
      const reference = rpc.evidence.at(-1)!;
      assert.equal(reference.kind, 'BLOCK_REFERENCE');
      assert.equal(reference.observedBlockOrSlot, BigInt(number).toString());
      assert.deepEqual(reference.data, { number: BigInt(number).toString(), hash });
      assert.deepEqual(requests.at(-1)!.params, [number, false]);
    }
  });
});

test('malformed block quantities fail before header lookup without retaining a prior block', async () => {
  await serverFor(async ({ url, requests, response }) => {
    for (const number of [null, 1, -1, true, {}, [], '', '1', '0x', '0x01', '-0x1', '+0x1', ' 0x1', '0x1 ', '0x1.0', '0X1', 'latest', '0xgg']) {
      const rpc = new Rpc(url); rpc.block = '42'; response.number = number;
      const from = requests.length;
      await assert.rejects(rpc.pin(), /Invalid RPC block reference/);
      assert.equal(rpc.block, 'UNKNOWN');
      assert.deepEqual(requests.slice(from).map(r => r.method), ['eth_blockNumber']);
      assert(!rpc.evidence.some(e => e.kind === 'BLOCK_REFERENCE'));
      assert.equal(rpc.evidence.at(-1)!.kind, 'BLOCK_REFERENCE_ERROR');
    }
  });
});

test('null/mismatched/malformed headers prevent identity reads and cannot produce an assessment', async () => {
  const headers = [null, [], 'invalid', {}, { hash }, { number: '0x1' }, { number: null, hash }, { number: '0x2', hash },
    { number: '0x01', hash }, { number: 1, hash }, { number: '0x1', hash: null },
    { number: '0x1', hash: 1 }, { number: '0x1', hash: '0x' }, { number: '0x1', hash: '0x' + 'ab'.repeat(31) },
    { number: '0x1', hash: '0x' + 'ab'.repeat(33) }, { number: '0x1', hash: '0x' + 'zz'.repeat(32) }];
  await serverFor(async ({ url, requests, response }) => {
    for (const header of headers) {
      response.header = header; const from = requests.length;
      await assert.rejects(assessReadOnly({ rpcUrl: url, networkId: '1', token }), /Invalid RPC block reference/);
      assert.deepEqual(requests.slice(from).map(r => r.method), ['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber']);
    }
  });
});

test('RPC failure and invalid header clear prior pin state and allow later recovery on the same client', async () => {
  await serverFor(async ({ url, response }) => {
    const rpc = new Rpc(url); await rpc.pin();
    for (const method of ['eth_blockNumber', 'eth_getBlockByNumber']) {
      response.failure = method;
      await assert.rejects(rpc.pin()); assert.equal(rpc.block, 'UNKNOWN');
      delete response.failure; await rpc.pin(); assert.equal(rpc.block, '1');
    }
    response.header = null;
    await assert.rejects(rpc.pin()); assert.equal(rpc.block, 'UNKNOWN');
    response.header = { number: '0x1', hash }; await rpc.pin();
    assert.equal(rpc.block, '1');
    assert.equal(rpc.evidence.filter(e => e.kind === 'BLOCK_REFERENCE').length, 4);
  });
});

test('CLI invalid block reference returns exit 1, no JSON, and preserves an existing report', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'compatibility-block-reference-'));
  try {
    const path = join(directory, 'report.json'); await writeFile(path, 'prior complete report');
    await serverFor(async ({ url, response, requests }) => {
      response.header = null;
      const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'src/cli.ts', 'assess',
          '--network', '1', '--token', token, '--out', path],
        { cwd: new URL('..', import.meta.url), env: { ...process.env, RPC_URL: url }, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        child.stdout.on('data', data => { stdout += String(data); }); child.stderr.on('data', data => { stderr += String(data); });
        child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
      });
      assert.equal(result.code, 1); assert.equal(result.stdout, '');
      assert(result.stderr.includes('Invalid RPC block reference.'));
      assert(!result.stderr.includes(url));
      assert.equal(await readFile(path, 'utf8'), 'prior complete report');
      assert.deepEqual(await readdir(directory), ['report.json']);
      assert(!requests.some(r => ['eth_getCode', 'eth_call', 'eth_getStorageAt'].includes(r.method)));
    });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
