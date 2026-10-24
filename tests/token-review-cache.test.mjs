import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat, readdir, rm, symlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cachedCompiler, verifyCompilerBytes, readVerifiedCompiler, stageCachedCompiler } from '../src/token-review/compiler-cache.mjs';
import { compilerVersion, compilerProfile, compile, prepareInput } from '../src/token-review/compiler.ts';
import { inventory } from '../src/token-review/source-analysis.ts';
import { analyzeSource } from '../src/token-review/semantic-analysis.ts';

const sample = version => prepareInput(Buffer.from(JSON.stringify({ language: 'Solidity', sources: { 'Legacy.sol': { content:
  `pragma solidity ${version}; contract Legacy { address public owner; mapping(address=>uint256) public balances; modifier onlyOwner(){require(msg.sender==owner);_;} function setOwner(address next) external onlyOwner {owner=next;} function mint(address to,uint256 amount) external onlyOwner {balances[to]+=amount;} }` } } })), 'Legacy.sol:Legacy');

test('compiler cache bytes, ownership/type bounds and nofollow checks reject unverified executables', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'review-cache-test-'));
  try {
    const bytes = Buffer.from('module.exports = {};'); const hash = createHash('sha256').update(bytes).digest('hex');
    const file = join(dir, 'cache.cjs'); await writeFile(file, bytes, { mode: 0o600 });
    assert.deepEqual(await readVerifiedCompiler(file, hash), bytes);
    assert.throws(() => verifyCompilerBytes(bytes, '0'.repeat(64)));
    await assert.rejects(readVerifiedCompiler(file, cachedCompiler.sha256));
    await symlink(file, join(dir, 'linked.cjs')); await assert.rejects(readVerifiedCompiler(join(dir, 'linked.cjs'), hash));
    await assert.rejects(readVerifiedCompiler(dir, hash));
    assert.equal(await compilerProfile('0.6.12-arbitrary'), null);
    await assert.rejects(compile(sample('0.8.37').input, 'Legacy.sol', 'Legacy', 'file:///arbitrary.cjs'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('worker rejects an unverified cache before executable content runs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'review-cache-malicious-'));
  try {
    const marker = join(dir, 'executed'), file = join(dir, 'untrusted.cjs');
    await writeFile(file, `require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad');module.exports={};`);
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [fileURLToPath(new URL('../src/token-review/compiler-worker.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdout.resume(); child.stderr.resume(); child.once('error', reject); child.once('close', resolve);
      child.stdin.end(JSON.stringify({ profile: cachedCompiler.id, stagedCompiler: file, ...sample('0.8.37'), contract: 'Legacy' }));
    });
    assert.equal(result, 2); await assert.rejects(access(marker));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('compiler child strips preload/module injection and enforces a non-extendable timeout', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'review-cache-preload-'));
  const oldOptions = process.env.NODE_OPTIONS, oldPath = process.env.NODE_PATH;
  try {
    const marker = join(dir, 'executed'); const preload = join(dir, 'preload.mjs');
    await writeFile(preload, `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'bad');`);
    process.env.NODE_OPTIONS = `--import=${preload}`; process.env.NODE_PATH = dir;
    const p = sample('0.8.37'); const result = await compile(p.input, p.file, p.contractName);
    assert.equal(result.compiler, compilerVersion); await assert.rejects(access(marker));
    await assert.rejects(compile(p.input, p.file, p.contractName, compilerVersion, { timeoutMs: 1 }), /COMPILER_PROCESS_FAILED/);
    await assert.rejects(compile(p.input, p.file, p.contractName, compilerVersion, { timeoutMs: 20_001 }), /INVALID_COMPILER_BUDGET/);
  } finally {
    if (oldOptions === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = oldOptions;
    if (oldPath === undefined) delete process.env.NODE_PATH; else process.env.NODE_PATH = oldPath;
    await rm(dir, { recursive: true, force: true });
  }
});

test('pinned cached 0.6.12 compiles legacy AST with guards or remains unavailable without downloads; staged files are private and cleaned', async () => {
  const profile = await compilerProfile(cachedCompiler.version);
  const p = sample('0.6.12');
  if (!profile) { await assert.rejects(compile(p.input, p.file, p.contractName, cachedCompiler.version)); return; }
  assert.equal(profile.sha256, cachedCompiler.sha256);
  assert.equal(profile.independentAttestation, 'NOT_TESTED');
  const stage = await stageCachedCompiler();
  assert.equal((await stat(stage.path)).mode & 0o777, 0o600);
  assert.equal((await stat(join(stage.path, '..'))).mode & 0o777, 0o700);
  verifyCompilerBytes(await readFile(stage.path), cachedCompiler.sha256); await stage.cleanup(); await assert.rejects(access(stage.path));
  const result = await compile(p.input, p.file, p.contractName, cachedCompiler.version);
  assert.equal(result.compiler, cachedCompiler.version); assert(!result.errors.some(e => e.severity === 'error'));
  let id = 0; const evidence = () => `e${++id}`;
  const functions = inventory(p.input, result, p.file, p.contractName, evidence);
  assert(functions.some(f => f.name === 'setOwner' && f.selector === '0x13af4035'));
  const graph = analyzeSource(p.input, result, p.file, p.contractName, evidence);
  assert(graph.entries.find(e => e.name === 'mint').conditions.some(c => c.callerEqualityState?.name === 'owner'));
  const before = new Set(await readdir(tmpdir()));
  await assert.rejects(compile(p.input, p.file, p.contractName, cachedCompiler.version, { timeoutMs: 1 }));
  assert.deepEqual((await readdir(tmpdir())).filter(n => n.startsWith('token-review-solc-') && !before.has(n)), []);
});
