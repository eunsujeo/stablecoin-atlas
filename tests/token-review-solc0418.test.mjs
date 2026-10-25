import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm, access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { usdtCompiler, stageCachedCompiler, verifyCompilerBytes } from '../src/token-review/compiler-cache.mjs';
import { compilerProfile, compile, prepareInput } from '../src/token-review/compiler.ts';
import { nodes, functionKind } from '../src/token-review/ast.ts';
import { inventory, sourceFindings } from '../src/token-review/source-analysis.ts';
import { analyzeSource } from '../src/token-review/semantic-analysis.ts';
import { keccak256 } from 'viem';
import { compilerVersion } from '../src/token-review/compiler.ts';
import { compareRuntime } from '../src/token-review/runtime-comparison.ts';
import { reviewToken } from '../src/token-review/review.ts';
import { validateReviewReport } from '../src/token-review/report.ts';

// Cache tests run in another Node test process; keep this file's staging private
// so parallel timeout-cleanup checks do not count each other's temporary files.
const stagingRoot = await mkdtemp(join(tmpdir(), 'review-solc0418-test-'));
const tempVariables = process.platform === 'win32' ? ['TEMP', 'TMP'] : ['TMPDIR'];
const previousTemp = new Map(tempVariables.map(name => [name, process.env[name]]));
for (const name of tempVariables) process.env[name] = stagingRoot;
after(async () => {
  for (const [name, value] of previousTemp) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  await rm(stagingRoot, { recursive: true, force: true });
});

const content = `pragma solidity 0.4.18;
  contract Base {
    address public owner; bool public open;
    function Base() public {owner=msg.sender;}
    modifier onlyOwner(){require(msg.sender==owner);_;}
    function inherited() public onlyOwner {}
    function overridden(uint256 x) public returns(uint256){return x;}
  }
  contract Legacy is Base {
    mapping(address=>uint256) public balances;
    function Legacy() public {}
    function mint(address to,uint256 amount) public onlyOwner {balances[to]+=amount;}
    function transfer(address to,uint256 amount) public {balances[to]+=amount;}
    function overloaded(uint256) public {}
    function overloaded(address) public {}
    function overridden(uint256 x) public returns(uint256){return x+1;}
    function denied() public returns(bool){return false;}
    function asserted() public {assert(msg.sender==owner);}
    function bypass() public {require(msg.sender==owner || open);}
    function() public payable {}
  }
  contract Shadow {address public owner;
    function require(bool) internal pure {} function fake() public {require(msg.sender==owner);}}
  contract FakeMsg {struct Message {address sender;} Message internal msg; address public owner;
    function fake() public {require(msg.sender==owner);}}`;
const p = prepareInput(Buffer.from(JSON.stringify({ language: 'Solidity', sources: { 'Legacy.sol': { content } },
  settings: { optimizer: { enabled: false, runs: 0 }, libraries: {} } })), 'Legacy.sol:Legacy');
let fixture;
const compiled = () => fixture ??= compile(p.input, p.file, p.contractName, usdtCompiler.version);

test('missing immutable ranges require the exact legacy version and genuine field absence', () => {
  const runtime = { object: '60006000', linkReferences: {} };
  const hash = keccak256(`0x${runtime.object}`);
  for (const version of [undefined, '0.4.18', '0.4.18+commit.9cf6e910.WRONG', compilerVersion,
    '0.6.12+commit.27d51765.Emscripten.clang']) {
    assert.equal(compareRuntime(runtime, hash, {}, version).reason, 'INVALID_RELOCATION_DATA');
  }
  for (const immutableReferences of [undefined, null, [], 'bad', { '0': [] }, { '7': [] }, { '7': [{ start: -1, length: 32 }] }]) {
    assert.equal(compareRuntime({ ...runtime, immutableReferences }, hash, {}, usdtCompiler.version).reason, 'INVALID_RELOCATION_DATA');
  }
  for (const linkReferences of [undefined, null, [], { 'L.sol': null }]) {
    assert.equal(compareRuntime({ ...runtime, linkReferences }, hash, {}, usdtCompiler.version).reason, 'INVALID_RELOCATION_DATA');
  }
  assert.equal(compareRuntime({ object: runtime.object }, hash, {}, usdtCompiler.version).reason, 'INVALID_RELOCATION_DATA');
  assert.equal(compareRuntime(runtime, hash, { '7': `0x${'00'.repeat(32)}` }, usdtCompiler.version).reason, 'IMMUTABLE_VALUES_MISSING_OR_EXTRA');
  const linked = { object: '00'.repeat(40), linkReferences: { 'L.sol': { L: [{ start: 0, length: 20 }] } } };
  assert.equal(compareRuntime(linked, undefined, {}, usdtCompiler.version).reason, 'UNRESOLVED_LIBRARY_LINKS');
  assert.equal(compareRuntime({ ...linked, object: '__Library__'.padEnd(80, '_') }, undefined, {}, usdtCompiler.version).reason, 'UNRESOLVED_LIBRARY_LINKS');
  assert.equal(compareRuntime({ ...runtime, object: 'zz' }, undefined, {}, usdtCompiler.version).reason, 'INVALID_RELOCATION_DATA');
});

test('private 0.4.18 output compares whole runtime bytes without changing compiler output', async t => {
  if (!await compilerProfile(usdtCompiler.version)) return t.skip('Pinned compiler cache unavailable');
  const r = await compiled(), runtime = r.selected.evm.deployedBytecode;
  const original = JSON.stringify(r);
  assert.equal(Object.hasOwn(runtime, 'immutableReferences'), false);
  const hash = keccak256(`0x${runtime.object}`);
  const match = compareRuntime(runtime, hash, {}, r.compiler);
  assert.equal(match.matched, true); assert.equal(match.kind, 'RAW_RUNTIME');
  assert.equal(match.reason, 'EXACT_RUNTIME_PENDING_CHAIN_RECHECK');
  assert.equal(match.originalRuntime, `0x${runtime.object}`);
  assert.equal(match.reconstructedRuntime, match.originalRuntime);
  assert.deepEqual(match.ranges, []); assert.deepEqual(match.immutableValues, {});
  // Even a final metadata byte difference must remain a full-runtime mismatch.
  const changed = runtime.object.slice(0, -2) + (runtime.object.endsWith('00') ? '01' : '00');
  const mismatch = compareRuntime(runtime, keccak256(`0x${changed}`), {}, r.compiler);
  assert.equal(mismatch.matched, false); assert.equal(mismatch.reason, 'RUNTIME_MISMATCH');
  const absent = compareRuntime(runtime, undefined, {}, r.compiler);
  assert.equal(absent.matched, null); assert.equal(absent.reason, 'ADDRESS_NOT_OBSERVED');
  assert.equal(absent.runtimeHash, hash);
  assert.equal(JSON.stringify(r), original);
});

test('legacy private offline review preserves omitted compiler field and unknown binding with zero HTTP', async t => {
  if (!await compilerProfile(usdtCompiler.version)) return t.skip('Pinned compiler cache unavailable');
  const dir = await mkdtemp(join(stagingRoot, 'offline-'));
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Offline must not fetch'); };
  try {
    await writeFile(join(dir, 'source.json'), JSON.stringify(p.input));
    const address = '0x1111111111111111111111111111111111111111';
    await writeFile(join(dir, 'config.json'), JSON.stringify({ schemaVersion: 'TokenReviewConfig1.1',
      network: { chainId: '31337' }, token: { address }, sources: [{ address, inputFile: 'source.json',
        contract: 'Legacy.sol:Legacy', compilerVersion: usdtCompiler.version }] }));
    const out = join(dir, 'out');
    const report = await reviewToken(join(dir, 'config.json'), undefined, out, { offline: true });
    validateReviewReport(report);
    const source = report.sources[0];
    assert.equal(source.compilerUsed, usdtCompiler.version); assert.equal(source.compilation, 'SUCCEEDED');
    assert.equal(source.binding.confirmation, 'UNKNOWN'); assert.equal(source.binding.reason, 'ADDRESS_NOT_OBSERVED');
    assert.equal(source.runtimeComparison.matched, null);
    assert.equal(source.runtimeComparison.kind, 'RAW_RUNTIME');
    const saved = JSON.parse(await readFile(join(out, 'artifacts/source-0.compile-result.json'), 'utf8'));
    assert.equal(Object.hasOwn(saved.selected.evm.deployedBytecode, 'immutableReferences'), false);
    assert.equal(source.runtimeComparison.originalRuntime, `0x${saved.selected.evm.deployedBytecode.object}`);
    assert.equal(report.block.consistency, 'UNKNOWN'); assert.equal(report.contracts.length, 0);
    assert(!report.evidence.some(e => e.kind === 'RPC')); assert.equal(calls, 0);
    validateReviewReport(JSON.parse(await readFile(join(out, 'report.json'), 'utf8')));
    assert((await readFile(join(out, 'report.md'), 'utf8')).includes('ADDRESS\\_NOT\\_OBSERVED'));
  } finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
});

test('pinned 0.4.18 stages verified private bytes and compiles ABI, runtime and compact AST without downloads', async () => {
  const profile = await compilerProfile(usdtCompiler.version);
  if (!profile) { await assert.rejects(compiled(), /COMPILER_VERSION_UNAVAILABLE/); return; }
  assert.equal(profile.sha256, usdtCompiler.sha256);
  assert.equal(await compilerProfile('0.4.18'), null);
  assert.equal(profile.independentAttestation, 'NOT_TESTED');
  const stage = await stageCachedCompiler(profile.version);
  try {
    assert.equal((await stat(stage.path)).mode & 0o777, 0o600);
    assert.equal((await stat(join(stage.path, '..'))).mode & 0o777, 0o700);
    verifyCompilerBytes(await readFile(stage.path), usdtCompiler.sha256);
  } finally { await stage.cleanup(); }
  await assert.rejects(access(stage.path));
  const r = await compiled();
  assert.equal(r.compiler, usdtCompiler.version);
  assert(!r.errors.some(e => e.severity === 'error'));
  assert(r.selected.abi.some(e => e.type === 'function' && e.name === 'mint'));
  assert.match(r.selected.evm.deployedBytecode.object, /^[0-9a-fA-F]+$/);
  assert(Object.keys(r.selected.evm.methodIdentifiers).length > 1);
  const functions = nodes(r.sources).filter(n => n.nodeType === 'FunctionDefinition');
  assert(functions.length > 10);
  assert(functions.every(n => n.kind === undefined && typeof n.isConstructor === 'boolean'));
  assert(functions.every(n => n.functionSelector === undefined));
});

test('legacy constructors are excluded and selectorless functions, overloads, fallback and overrides remain distinguishable', async () => {
  if (!await compilerProfile(usdtCompiler.version)) return;
  const r = await compiled(), graph = analyzeSource(p.input, r, p.file, p.contractName, () => 'e');
  assert(!graph.entries.some(e => ['Legacy', 'Base'].includes(e.name)));
  for (const name of ['mint', 'transfer', 'inherited', 'denied', 'asserted', 'bypass', 'fallback']) {
    assert(graph.entries.some(e => e.name === name), name);
  }
  assert.equal(graph.entries.filter(e => e.name === 'fallback').length, 1);
  assert.equal(graph.entries.filter(e => e.name === 'overloaded').length, 2);
  assert.equal(graph.entries.filter(e => e.name === 'overridden').length, 2);
  assert.equal(new Set(graph.entries.map(e => e.id)).size, graph.entries.length);
  for (const entry of graph.entries.filter(e => e.name !== 'fallback')) {
    assert.equal(entry.selector, null);
    assert(entry.uncertainties.includes('SELECTOR_NOT_ESTABLISHED'));
    assert(entry.uncertainties.includes('OVERRIDE_ENTRY_SELECTION_NOT_ESTABLISHED'));
    assert.equal(entry.authorityConclusion, 'UNKNOWN');
  }
  assert(graph.entries.find(e => e.name === 'mint').writes.some(w => w.variable?.name === 'balances' || w.expression.includes('balances')));
  assert(graph.entries.find(e => e.name === 'denied').behaviors.some(b => b.pattern === 'FALSE_RETURN'));
  const functions = inventory(p.input, r, p.file, p.contractName, () => 'e');
  assert(functions.some(f => f.name === 'fallback'));
  assert(sourceFindings(functions, r.selected.abi, 'fixture', 'e').some(f => f.id.endsWith('returns-transfer')));
  const ctor = nodes(r.sources).find(n => n.nodeType === 'FunctionDefinition' && n.isConstructor);
  assert.equal(functionKind(ctor, usdtCompiler.version), 'constructor');
  assert.equal(functionKind(ctor, '0.4.18+unregistered'), 'unknown');
});

test('legacy positive builtin IDs require exact types, no source declaration and the pinned version', async () => {
  if (!await compilerProfile(usdtCompiler.version)) return;
  const r = await compiled();
  const analysis = (name, value = r) => analyzeSource(p.input, value, p.file, name, () => 'e');
  const graph = analysis('Legacy');
  for (const name of ['mint', 'inherited']) assert(graph.entries.find(e => e.name === name).conditions.some(c => c.kind === 'REQUIRE' && c.callerEqualityState?.name === 'owner'));
  assert(graph.entries.find(e => e.name === 'asserted').conditions.some(c => c.kind === 'ASSERT' && c.stateReferences.some(r => r.name === 'owner')));
  assert(graph.entries.find(e => e.name === 'asserted').conditions.every(c => c.callerEqualityState === null));
  assert(graph.entries.find(e => e.name === 'bypass').conditions.every(c => c.callerEqualityState === null));
  assert.equal(analysis('Shadow').entries.find(e => e.name === 'fake').conditions.length, 0);
  assert(analysis('FakeMsg').entries.find(e => e.name === 'fake').conditions.every(c => c.callerEqualityState === null));
  assert.equal(analysis('Legacy', { ...r, compiler: '0.4.18+unregistered' }).entries.find(e => e.name === 'mint').conditions.length, 0);
  const owner = nodes(r.sources).find(n => n.nodeType === 'VariableDeclaration' && n.name === 'owner');
  for (const mutate of [
    node => { node.referencedDeclaration = owner.id; },
    node => { node.referencedDeclaration = 0x80000000; },
    node => { node.typeDescriptions.typeIdentifier = 't_function_internal_pure'; },
  ]) {
    const bad = structuredClone(r);
    for (const node of nodes(bad.sources)) if (node.nodeType === 'Identifier' && node.name === 'require') mutate(node);
    assert.equal(analysis('Legacy', bad).entries.find(e => e.name === 'mint').conditions.length, 0);
  }
});

test('0.4.18 worker preserves import and syntax errors and cleans a timed-out stage', async () => {
  if (!await compilerProfile(usdtCompiler.version)) return;
  for (const source of ['pragma solidity 0.4.18; import "https://example.invalid/Remote.sol"; contract Legacy {}',
    'pragma solidity 0.4.18; contract Legacy { function broken( }']) {
    const bad = structuredClone(p.input); bad.sources['Legacy.sol'].content = source;
    const r = await compile(bad, p.file, p.contractName, usdtCompiler.version);
    assert(r.errors.some(e => e.severity === 'error')); assert.equal(r.selected, null);
  }
  const before = new Set(await readdir(tmpdir()));
  await assert.rejects(compile(p.input, p.file, p.contractName, usdtCompiler.version, { timeoutMs: 1 }), /COMPILER_PROCESS_FAILED/);
  assert.deepEqual((await readdir(tmpdir())).filter(n => n.startsWith('token-review-solc-') && !before.has(n)), []);
});

test('0.4.18 worker rejects a full-version mismatch even for bytes matching the SHA pin', async () => {
  if (!await compilerProfile(usdtCompiler.version)) return;
  const dir = await mkdtemp(join(process.cwd(), '.state/solc0418-worker-version-'));
  const stage = await stageCachedCompiler(usdtCompiler.version);
  try {
    await writeFile(join(dir, 'compiler-worker.mjs'), await readFile(new URL('../src/token-review/compiler-worker.mjs', import.meta.url)));
    const registry = await readFile(new URL('../src/token-review/compiler-cache.mjs', import.meta.url), 'utf8');
    const run = () => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--max-old-space-size=256', join(dir, 'compiler-worker.mjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
      const output = []; child.stdout.on('data', b => output.push(b)); child.stderr.resume();
      child.once('error', reject); child.once('close', code => resolve({ code, output: Buffer.concat(output).toString() }));
      child.stdin.end(JSON.stringify({ input: p.input, file: p.file, contract: p.contractName, profile: usdtCompiler.id, stagedCompiler: stage.path }));
    });
    await writeFile(join(dir, 'compiler-cache.mjs'), registry);
    const control = await run(); assert.equal(control.code, 0); assert.equal(JSON.parse(control.output).compiler, usdtCompiler.version);
    await writeFile(join(dir, 'compiler-cache.mjs'), registry.replace(usdtCompiler.version, '0.4.18+commit.9cf6e910.WRONG'));
    const wrong = await run(); assert.equal(wrong.code, 2); assert.equal(wrong.output, '');
  } finally { await stage.cleanup(); await rm(dir, { recursive: true, force: true }); }
});
