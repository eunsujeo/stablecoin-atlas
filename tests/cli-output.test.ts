import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertLabContract, assertReportContract } from './helpers/report-contract.js';

function cli(args: string[], rpcUrl: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'src/cli.ts', ...args],
      { cwd: new URL('..', import.meta.url), env: { ...process.env, RPC_URL: rpcUrl }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += String(data); });
    child.stderr.on('data', data => { stderr += String(data); });
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

test('CLI publishes read-only reports, keeps stdout JSON-only, and preserves prior output on command failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'compatibility-cli-output-'));
  const methods: string[] = [];
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += String(chunk);
    const body = JSON.parse(raw) as { id: number; method: string };
    methods.push(body.method);
    const results: Record<string, unknown> = { eth_chainId: '0x1', eth_blockNumber: '0x1', eth_getBlockByNumber: { number: '0x1', hash: '0x' + 'ab'.repeat(32) },
      eth_getCode: '0x6000', eth_getStorageAt: '0x' + '0'.repeat(64) };
    response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, ...(body.method === 'eth_call'
      ? { error: { code: -32000, message: 'Synthetic unavailable metadata' } } : { result: results[body.method] }) }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const rpcUrl = `http://127.0.0.1:${address.port}`;
  const args = ['assess', '--network', '1', '--token', '0x1111111111111111111111111111111111111111'];
  try {
    const path = join(directory, 'readonly.json');
    const saved = await cli([...args, '--out', path], rpcUrl);
    assert.equal(saved.code, 0); assert.equal(saved.stdout, '');
    const contents = await readFile(path, 'utf8'); assertReportContract(JSON.parse(contents));
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    const streamed = await cli(args, rpcUrl);
    assert.equal(streamed.code, 0); assertReportContract(JSON.parse(streamed.stdout));
    assert(!streamed.stdout.includes('Assessments:')); assert(streamed.stderr.includes('Assessments:'));
    const failed = await cli(['assess', '--network', '2', '--token', args.at(-1)!, '--out', path], rpcUrl);
    assert.equal(failed.code, 1); assert.equal(failed.stdout, '');
    assert.equal(await readFile(path, 'utf8'), contents);
    const blocked = join(directory, 'existing-directory'); await mkdir(blocked);
    await writeFile(join(blocked, 'sentinel'), 'untouched');
    const badOutput = await cli([...args, '--out', blocked], rpcUrl);
    assert.equal(badOutput.code, 1); assert.equal(badOutput.stdout, '');
    assert(badOutput.stderr.includes('Report output must be a regular file path.'));
    assert(!badOutput.stderr.includes(blocked)); assert(!badOutput.stderr.includes(rpcUrl));
    assert.equal(await readFile(join(blocked, 'sentinel'), 'utf8'), 'untouched');
    assert.deepEqual((await readdir(directory)).sort(), ['existing-directory', 'readonly.json']);
    assert(methods.every(method => ['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call'].includes(method)));
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI saves the complete private local lab report before returning expected scenario FAIL exit 2', { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'compatibility-cli-lab-output-'));
  try {
    const path = join(directory, 'baseline.json');
    // lab must ignore an unusable external endpoint and start its own private Anvil.
    const result = await cli(['lab', '--out', path], 'invalid-synthetic-endpoint');
    assert.equal(result.code, 2); assert.equal(result.stdout, '');
    const report: unknown = JSON.parse(await readFile(path, 'utf8')); assertLabContract(report);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert(result.stderr.includes('"FAIL":5'));
    assert(result.stderr.includes('"PASS":64'));
    assert(result.stderr.includes('"INCONCLUSIVE":22'));
    assert.deepEqual(await readdir(directory), ['baseline.json']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
