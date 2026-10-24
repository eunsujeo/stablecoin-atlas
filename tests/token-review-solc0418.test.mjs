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
