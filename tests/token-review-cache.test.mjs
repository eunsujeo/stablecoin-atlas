import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat, readdir, rm, symlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cachedCompiler, jpycCompiler, usdtCompiler, cachedCompilers, cachedCompilerById, verifyCompilerBytes, readVerifiedCompiler, stageCachedCompiler } from '../src/token-review/compiler-cache.mjs';
import { compilerVersion, compilerProfile, compile, prepareInput } from '../src/token-review/compiler.ts';
import { inventory } from '../src/token-review/source-analysis.ts';
import { analyzeSource } from '../src/token-review/semantic-analysis.ts';
import { nodes } from '../src/token-review/ast.ts';

const sample = version => prepareInput(Buffer.from(JSON.stringify({ language: 'Solidity', sources: { 'Legacy.sol': { content:
  `pragma solidity ${version}; contract Legacy { address public owner; mapping(address=>uint256) public balances; modifier onlyOwner(){require(msg.sender==owner);_;} function setOwner(address next) external onlyOwner {owner=next;} function mint(address to,uint256 amount) external onlyOwner {balances[to]+=amount;} }` } } })), 'Legacy.sol:Legacy');

test('compiler cache bytes, ownership/type bounds and nofollow checks reject unverified executables', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'review-cache-test-'));
  try {
    const bytes = Buffer.from('module.exports = {};'); const hash = createHash('sha256').update(bytes).digest('hex');
    const file = join(dir, 'cache.cjs'); await writeFile(file, bytes, { mode: 0o600 });
    assert.deepEqual(await readVerifiedCompiler(file, hash), bytes);
    const getuid = process.getuid;
    try {
      process.getuid = () => -1;
      await assert.rejects(readVerifiedCompiler(file, hash), /COMPILER_CACHE_UNVERIFIED/);
    } finally { process.getuid = getuid; }
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
    for (const profile of cachedCompilers) {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [fileURLToPath(new URL('../src/token-review/compiler-worker.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'] });
        child.stdout.resume(); child.stderr.resume(); child.once('error', reject); child.once('close', resolve);
        child.stdin.end(JSON.stringify({ profile: profile.id, stagedCompiler: file, ...sample('0.8.37'), contract: 'Legacy' }));
      });
      assert.equal(result, 2); await assert.rejects(access(marker));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('cached profile registry stays frozen and isolated caches reject missing, changed, symlink and oversized bytes', async () => {
  assert(Object.isFrozen(cachedCompilers));
  for (const profile of cachedCompilers) {
    assert(Object.isFrozen(profile)); assert.equal(cachedCompilerById(profile.id), profile);
  }
  assert.equal(cachedCompilerById('arbitrary'), null);
  await assert.rejects(stageCachedCompiler('arbitrary'), /COMPILER_VERSION_UNAVAILABLE/);
  const dir = await mkdtemp(join(tmpdir(), 'review-profile-registry-'));
  try {
    const { mkdir, truncate } = await import('node:fs/promises');
    await mkdir(join(dir, 'src/token-review'), { recursive: true });
    const registryFile = join(dir, 'src/token-review/compiler-cache.mjs');
    await writeFile(registryFile, await readFile(new URL('../src/token-review/compiler-cache.mjs', import.meta.url)));
    const isolated = await import(new URL(`file://${registryFile}`));
    for (const [profile, relative] of [[cachedCompiler, '.state/usdc-source/compiler'], [jpycCompiler, '.state/jpyc-solc-browser-artifact'],
      [usdtCompiler, '.state/usdt-solc-0418-visible-browser-v2']]) {
      assert.equal(await isolated.inspectCachedCompiler(profile.version), null);
      const path = join(dir, relative, 'soljson.js'); await mkdir(join(dir, relative), { recursive: true });
      await writeFile(path, 'unverified');
      await assert.rejects(isolated.inspectCachedCompiler(profile.version), /COMPILER_CACHE_UNVERIFIED/);
      await rm(path); await symlink(registryFile, path);
      await assert.rejects(isolated.inspectCachedCompiler(profile.version), /COMPILER_CACHE_UNVERIFIED/);
      await rm(path); await writeFile(path, ''); await truncate(path, 32 * 1024 * 1024 + 1);
      await assert.rejects(isolated.inspectCachedCompiler(profile.version), /COMPILER_CACHE_UNVERIFIED/);
    }
    assert.equal(await isolated.inspectCachedCompiler('0.8.11'), null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('pinned 0.8.11 stages private bytes, compiles a guarded fixture, rejects remote imports and cleans timeout staging', async () => {
  const profile = await compilerProfile(jpycCompiler.version);
  const p = sample('0.8.11');
  if (!profile) { await assert.rejects(compile(p.input, p.file, p.contractName, jpycCompiler.version)); return; }
  assert.equal(profile.sha256, jpycCompiler.sha256);
  assert.equal(profile.independentAttestation, 'NOT_TESTED');
  const stage = await stageCachedCompiler(jpycCompiler.version);
  try {
    assert.equal((await stat(stage.path)).mode & 0o777, 0o600);
    assert.equal((await stat(join(stage.path, '..'))).mode & 0o777, 0o700);
    verifyCompilerBytes(await readFile(stage.path), jpycCompiler.sha256);
  } finally { await stage.cleanup(); }
  await assert.rejects(access(stage.path));
  const result = await compile(p.input, p.file, p.contractName, jpycCompiler.version);
  assert.equal(result.compiler, jpycCompiler.version); assert(result.selected);
  assert(!result.errors.some(e => e.severity === 'error'));
  let id = 0; const evidence = () => `e${++id}`;
  const graph = analyzeSource(p.input, result, p.file, p.contractName, evidence);
  assert(graph.entries.find(e => e.name === 'mint').conditions.some(c => c.callerEqualityState?.name === 'owner'));
  const external = structuredClone(p.input);
  external.sources['Legacy.sol'].content = 'pragma solidity 0.8.11; import "https://example.invalid/Remote.sol"; contract Legacy {}';
  const rejected = await compile(external, p.file, p.contractName, jpycCompiler.version);
  assert(rejected.errors.some(e => e.severity === 'error')); assert.equal(rejected.selected, null);
  const before = new Set(await readdir(tmpdir()));
  await assert.rejects(compile(p.input, p.file, p.contractName, jpycCompiler.version, { timeoutMs: 1 }));
  assert.deepEqual((await readdir(tmpdir())).filter(n => n.startsWith('token-review-solc-') && !before.has(n)), []);
});

test('cached worker rejects a full-version mismatch even when the staged 0.8.11 hash matches', async () => {
  if (!await compilerProfile(jpycCompiler.version)) return;
  const dir = await mkdtemp(join(process.cwd(), '.state/review-worker-version-'));
  const stage = await stageCachedCompiler(jpycCompiler.version);
  try {
    await writeFile(join(dir, 'compiler-worker.mjs'), await readFile(new URL('../src/token-review/compiler-worker.mjs', import.meta.url)));
    const registry = await readFile(new URL('../src/token-review/compiler-cache.mjs', import.meta.url), 'utf8');
    const run = () => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--max-old-space-size=256', join(dir, 'compiler-worker.mjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
      const output = []; child.stdout.on('data', chunk => output.push(chunk)); child.stderr.resume();
      child.once('error', reject); child.once('close', code => resolve({ code, output: Buffer.concat(output).toString() }));
      child.stdin.end(JSON.stringify({ profile: jpycCompiler.id, stagedCompiler: stage.path, ...sample('0.8.11'), contract: 'Legacy' }));
    });
    await writeFile(join(dir, 'compiler-cache.mjs'), registry);
    const control = await run(); assert.equal(control.code, 0);
    assert.equal(JSON.parse(control.output).compiler, jpycCompiler.version);
    await writeFile(join(dir, 'compiler-cache.mjs'), registry.replace(jpycCompiler.version, '0.8.11+commit.d7f03943.WRONG'));
    assert.equal((await run()).code, 2);
  } finally { await stage.cleanup(); await rm(dir, { recursive: true, force: true }); }
});

test('0.8.11 unsigned builtin references preserve real guards while shadow functions, fake msg and OR remain distinct', async () => {
  if (!await compilerProfile(jpycCompiler.version)) return;
  const content = `pragma solidity 0.8.11;
    contract Builtin {address public owner; bool public open;
      function guarded() external {require(msg.sender==owner);}
      function asserted() external {assert(msg.sender==owner);}
      function bypass() external {require(msg.sender==owner || open);}}
    contract Shadow {address public owner;
      function require(bool) internal pure {} function fake() external {require(msg.sender==owner);}}
    contract FakeMsg {struct Message {address sender;} Message internal msg; address public owner;
      function fake() external {require(msg.sender==owner);}}`;
  const p = prepareInput(Buffer.from(JSON.stringify({ language: 'Solidity', sources: { 'Builtins.sol': { content } } })), 'Builtins.sol:Builtin');
  const result = await compile(p.input, p.file, p.contractName, jpycCompiler.version);
  assert(!result.errors.some(e => e.severity === 'error'));
  const analysis = (name, compiled = result) => analyzeSource(p.input, compiled, p.file, name, () => 'e');
  const graph = analysis('Builtin');
  assert(graph.entries.find(e => e.name === 'guarded').conditions.some(c => c.kind === 'REQUIRE' && c.callerEqualityState?.name === 'owner'));
  assert(graph.entries.find(e => e.name === 'asserted').conditions.some(c => c.kind === 'ASSERT'));
  assert(graph.entries.find(e => e.name === 'bypass').conditions.every(c => c.callerEqualityState === null));
  assert.equal(analysis('Shadow').entries.find(e => e.name === 'fake').conditions.length, 0);
  assert(analysis('FakeMsg').entries.find(e => e.name === 'fake').conditions.every(c => c.callerEqualityState === null));
  const unknownCompiler = { ...result, compiler: '0.8.11+unregistered' };
  assert.equal(analysis('Builtin', unknownCompiler).entries.find(e => e.name === 'guarded').conditions.length, 0);
  for (const mutate of [
    node => { node.referencedDeclaration = 0x100000000; },
    node => { node.typeDescriptions.typeIdentifier = 't_function_internal_pure'; },
  ]) {
    const invalid = structuredClone(result);
    for (const node of nodes(invalid.sources)) if (node.nodeType === 'Identifier' && node.name === 'require') mutate(node);
    assert.equal(analysis('Builtin', invalid).entries.find(e => e.name === 'guarded').conditions.length, 0);
  }
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
