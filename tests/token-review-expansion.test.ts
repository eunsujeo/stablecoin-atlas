import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import solc from 'solc';
import { keccak256, type Hex } from 'viem';
import { prepareInput, compilerVersion, type CompileResult, type CompilerInput } from '../src/token-review/compiler.js';
import { analyzeSource, semanticFindings } from '../src/token-review/semantic-analysis.js';
import { compareRuntime } from '../src/token-review/runtime-comparison.js';
import { reviewToken, serialize } from '../src/token-review/review.js';
import { parseConfig } from '../src/token-review/input.js';
import { validateReviewReport, markdown } from '../src/token-review/report.js';
import type { ReviewConfig } from '../src/token-review/model.js';

let root: string, input: CompilerInput, compiled: CompileResult;
const address = '0x1111111111111111111111111111111111111111';
let index = 0;
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'token-review-expanded-'));
  const content = await readFile(new URL('./fixtures/TokenReviewRules.sol', import.meta.url), 'utf8');
  input = prepareInput(Buffer.from(serialize({ language: 'Solidity', sources: { 'Rules.sol': { content } }, settings: { optimizer: { enabled: true }, evmVersion: 'shanghai' } })), 'Rules.sol:ReviewRuleToken').input;
  const result = JSON.parse(solc.compile(serialize(input)));
  assert(!result.errors?.some((e: { severity: string }) => e.severity === 'error'));
  compiled = { compiler: compilerVersion, errors: [], sources: result.sources, selected: result.contracts['Rules.sol'].ReviewRuleToken };
});
after(async () => { if (root) await rm(root, { recursive: true, force: true }); });
function analysis(contract = 'ReviewRuleToken') {
  let id = 0;
  return analyzeSource(input, compiled, 'Rules.sol', contract, () => `proof-${++id}`);
}
async function offline(auditSnapshot?: object, options: { missingTarget?: boolean; missingSource?: boolean } = {}) {
  const dir = join(root, `case-${++index}`); await mkdir(dir);
  await writeFile(join(dir, 'source.json'), serialize(input));
  const config: ReviewConfig = { schemaVersion: 'TokenReviewConfig1.1', network: { chainId: '31337' }, token: { address },
    sources: [{ address, inputFile: options.missingSource ? 'missing.json' : 'source.json', contract: 'Rules.sol:ReviewRuleToken', compilerVersion }] };
  if (auditSnapshot) {
    await writeFile(join(dir, 'audit.txt'), 'A supplied audit document. No verified association with source.');
    await writeFile(join(dir, 'snapshot.json'), serialize(auditSnapshot));
    config.audits = [{ file: 'audit.txt', sourceSnapshotFile: 'snapshot.json', compareToAddress: options.missingTarget ? '0x2222222222222222222222222222222222222222' : address }];
  }
  const file = join(dir, 'config.json'); await writeFile(file, serialize(config));
  const report = await reviewToken(file, undefined, join(dir, 'out'), { offline: true });
  return { report, dir };
}

test('static source graph follows inherited modifiers/internal guards and distinguishes unguarded declaration paths without certifying authority', () => {
  const a = analysis();
  const guarded = a.entries.find(e => e.name === 'guardedMint')!, open = a.entries.find(e => e.name === 'openMint')!;
  assert(guarded.declarations.some(d => d.name === 'checked')); assert(guarded.declarations.some(d => d.name === '_checkOwner'));
  assert(guarded.conditions.some(c => c.expression === 'msg.sender == owner' && c.stateReferences.some(s => s.name === 'owner')));
  assert(guarded.conditions.some(c => c.callerEqualityState?.name === 'owner'));
  assert(guarded.writes.some(w => w.variable.name === 'balances')); assert(guarded.writes.some(w => w.variable.name === 'totalSupply'));
  assert.equal(open.conditions.length, 0); assert(open.writes.some(w => w.variable.name === 'totalSupply'));
  assert.equal(open.authorityConclusion, 'UNKNOWN'); assert.equal(guarded.authorityConclusion, 'UNKNOWN');
  const change = a.entries.find(e => e.name === 'changeOwner')!;
  assert(change.writes.some(w => w.variable.name === 'owner' && w.expression === 'owner = next'));
  const facts = semanticFindings(a, 'src');
  assert(facts.some(f => f.rule === 'permission-write-review-v1' && f.confirmation === 'UNKNOWN'));
  assert(facts.some(f => f.rule === 'caller-storage-equality-require-v1' && f.confirmation === 'CONFIRMED' && f.summary.includes('모든 경로')));
  assert(!facts.some(f => f.confirmation === 'NOT_FOUND_IN_SCOPE'));
});

test('typed AST behavior rules locate false return, fee arithmetic, approval condition, address condition, callback and non-transfer mapping write', () => {
  const a = analysis();
  const transfer = a.entries.find(e => e.name === 'transfer')!;
  for (const p of ['FALSE_RETURN', 'MULTIPLY_DIVIDE_EXPRESSION', 'EXTERNAL_CALL', 'ADDRESS_CONDITION']) assert(transfer.behaviors.some(b => b.pattern === p), p);
  const approve = a.entries.find(e => e.name === 'approve')!;
  assert(approve.behaviors.some(b => b.pattern === 'NESTED_MAPPING_ZERO_CONDITION'));
  assert(a.entries.find(e => e.name === 'openMint')!.behaviors.some(b => b.pattern === 'NON_TRANSFER_MAPPING_WRITE'));
  assert(transfer.calls.some(c => c.kind === 'EXTERNAL'));
  const candidates = semanticFindings(a, 'src').filter(f => f.rule === 'typed-ast-behavior-review-v1');
  assert(candidates.length > 0 && candidates.every(f => f.confirmation === 'UNKNOWN'));
});

test('overrides, super-related dispatch, modifier order/repetition, alias, assembly and cycles keep explicit uncertainty', () => {
  const base = analysis(), overridden = analysis('ReviewRuleOverride');
  assert(overridden.entries.find(e => e.name === 'guardedMint')!.uncertainties.includes('VIRTUAL_DISPATCH_NOT_PROVEN'));
  assert(overridden.entries.find(e => e.name === 'superCheck')!.uncertainties.includes('VIRTUAL_DISPATCH_NOT_PROVEN'));
  assert(base.entries.find(e => e.name === 'changeAfter')!.uncertainties.includes('MODIFIER_EXECUTION_ORDER_NOT_PROVEN'));
  assert(base.entries.find(e => e.name === 'repeated')!.uncertainties.includes('MODIFIER_PLACEHOLDERS_2'));
  assert(base.entries.find(e => e.name === 'aliasWrite')!.uncertainties.includes('STORAGE_ALIAS_NOT_MODELED'));
  assert(base.entries.find(e => e.name === 'rawStore')!.uncertainties.includes('ASSEMBLY_NOT_MODELED'));
  assert(base.entries.find(e => e.name === 'cycle')!.uncertainties.includes('CALL_CYCLE'));
  assert(overridden.entries.every(e => e.authorityConclusion === 'UNKNOWN'));
  assert(base.entries.find(e => e.name === 'bypass')!.conditions.every(c => c.callerEqualityState === null));
  const shadow = analysis('ReviewFakeGuard').entries.find(e => e.name === 'update')!;
  assert(shadow.declarations.some(d => d.name === 'require')); assert.equal(shadow.conditions.length, 0);
});

test('graph declaration and entry limits are explicit and never converted into feature absence', () => {
  const content = 'pragma solidity 0.8.37; contract Many {' + Array.from({ length: 40 }, (_, i) => `function f${i}() ${i === 0 ? 'external' : 'internal'} {${i < 39 ? `f${i + 1}();` : ''}}`).join('') + '}';
  const prepared = prepareInput(Buffer.from(serialize({ language: 'Solidity', sources: { 'Many.sol': { content } } })), 'Many.sol:Many');
  const result = JSON.parse(solc.compile(serialize(prepared.input)));
  const a = analyzeSource(prepared.input, { ...compiled, sources: result.sources }, 'Many.sol', 'Many', () => 'proof');
  assert(a.entries[0]!.uncertainties.includes('DECLARATION_LIMIT')); assert.equal(a.entries[0]!.authorityConclusion, 'UNKNOWN');
  const many = 'pragma solidity 0.8.37; contract Many {' + Array.from({ length: 65 }, (_, i) => `function f${i}() external {}`).join('') + '}';
  const b = prepareInput(Buffer.from(serialize({ language: 'Solidity', sources: { 'Many.sol': { content: many } } })), 'Many.sol:Many');
  const r = JSON.parse(solc.compile(serialize(b.input)));
  const limited = analyzeSource(b.input, { ...compiled, sources: r.sources }, 'Many.sol', 'Many', () => 'proof');
  assert.equal(limited.entries.length, 64); assert(limited.coverage.entryLimitReached);
});

test('runtime reconstruction validates compiler ranges and exact values without pretending constructor proof', () => {
  const original = '60' + '00'.repeat(32) + 'ff';
  const value = `0x${'0'.repeat(62)}2a`;
  const runtime = { object: original, immutableReferences: { '7': [{ start: 1, length: 32 }] }, linkReferences: {} };
  const observed = keccak256(`0x60${value.slice(2)}ff`);
  const result = compareRuntime(runtime, observed, { '7': value });
  assert.equal(result.matched, true); assert.equal(result.kind, 'SUBMITTED_IMMUTABLE_VALUES');
  assert.equal(result.reason, 'SUBMITTED_IMMUTABLE_RUNTIME_MATCH_CONSTRUCTOR_UNPROVEN');
  assert.equal(result.originalRuntime, `0x${original}`); assert.equal(result.reconstructedRuntime, `0x60${value.slice(2)}ff`);
  assert.equal(compareRuntime(runtime, observed).reason, 'IMMUTABLE_VALUES_MISSING_OR_EXTRA');
  assert.equal(compareRuntime(runtime, observed, { '7': value, '8': value }).reason, 'IMMUTABLE_VALUES_MISSING_OR_EXTRA');
  assert.equal(compareRuntime(runtime, observed, { '7': `0x${'00'.repeat(32)}` }).matched, false);
  for (const r of [{ start: -1, length: 32 }, { start: 1, length: 31 }, { start: 1000, length: 32 }]) assert.equal(compareRuntime({ ...runtime, immutableReferences: { '7': [r] } }, observed, { '7': value }).reason, 'INVALID_RELOCATION_DATA');
  assert.equal(compareRuntime({ ...runtime, immutableReferences: { '7': [{ start: 1, length: 32 }], '8': [{ start: 2, length: 32 }] } }, observed, { '7': value, '8': value }).reason, 'INVALID_RELOCATION_DATA');
  assert.equal(compareRuntime({ ...runtime, linkReferences: { 'Lib.sol': { Lib: [{ start: 1, length: 20 }] } } }, observed, { '7': value }).reason, 'INVALID_RELOCATION_DATA');
  assert.equal(compareRuntime({ object: '00'.repeat(40), immutableReferences: {}, linkReferences: { 'Lib.sol': { Lib: [{ start: 0, length: 20 }] } } }, undefined).reason, 'UNRESOLVED_LIBRARY_LINKS');
});

test('offline mode emits source graph, behavior and writer reports with zero HTTP even without RPC_URL', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Offline must not fetch'); };
  try {
    const { report, dir } = await offline();
    assert.equal(calls, 0); assert.equal(report.execution, 'COMPLETED'); assert.equal(report.mode, 'OFFLINE');
    assert.equal(report.block.number, null); assert.equal(report.contracts.length, 0);
    assert.equal(report.sources[0]!.binding.confirmation, 'UNKNOWN'); assert(report.sources[0]!.staticAnalysis?.entries.length);
    assert(report.evidence.some(e => e.kind === 'CHAIN_COLLECTION_NOT_RUN')); assert(!report.evidence.some(e => e.kind === 'RPC'));
    const md = await readFile(join(dir, 'out/report.md'), 'utf8');
    assert(md.includes('저장값 변경 진입점')); assert(md.includes('msg.sender == owner')); assert(md.includes('NESTED_MAPPING_ZERO_CONDITION'));
    validateReviewReport(report);
  } finally { globalThis.fetch = originalFetch; }
  const missing = await offline(undefined, { missingSource: true });
  assert.equal(missing.report.sources[0]!.compilation, 'NOT_RUN'); assert.equal(missing.report.sources[0]!.compilerUsed, 'NOT_RUN');
  assert.equal(missing.report.execution, 'PARTIAL');
});

test('audit source snapshot exact bytes/settings equality never proves document association or deployment audit', async () => {
  const { report } = await offline(input);
  const c = report.audits[0]!.sourceComparison!;
  assert.equal(c.sourceMatch, 'MATCH'); assert.equal(c.settingsMatch, 'MATCH'); assert.equal(c.associationWithAudit, 'UNKNOWN');
  assert.equal(report.audits[0]!.deploymentMapping, 'UNKNOWN'); assert.equal(report.audits[0]!.authenticity, 'UNKNOWN');
  assert(report.findings.some(f => f.scope === 'AUDIT' && f.confirmation === 'CONFIRMED' && f.summary.includes('확인 불가')));
  const md = markdown(report); assert(md.includes('동봉 소스')); assert(md.includes('SAME'));
});

test('audit comparison preserves changed/missing/extra paths, settings differences and unavailable comparison targets', async () => {
  const changed = structuredClone(input); changed.sources['Rules.sol']!.content += '\n';
  const result = await offline(changed); assert.equal(result.report.audits[0]!.sourceComparison!.sourceMatch, 'MISMATCH');
  assert.equal(result.report.execution, 'PARTIAL'); assert.equal(result.report.audits[0]!.sourceComparison!.files[0]!.status, 'DIFFERENT');
  const renamed = structuredClone(input); renamed.sources = { 'Renamed.sol': renamed.sources['Rules.sol']! };
  const paths = (await offline(renamed)).report.audits[0]!.sourceComparison!.files;
  assert(paths.some(f => f.status === 'MISSING_IN_SNAPSHOT')); assert(paths.some(f => f.status === 'EXTRA_IN_SNAPSHOT'));
  const settings = structuredClone(input); settings.settings.optimizer = { enabled: false };
  const build = (await offline(settings)).report.audits[0]!.sourceComparison!;
  assert.equal(build.sourceMatch, 'MATCH'); assert.equal(build.settingsMatch, 'MISMATCH');
  const missing = await offline(input, { missingTarget: true }); assert.equal(missing.report.audits[0]!.sourceComparison, null);
  assert(missing.report.failures.some(f => f.code === 'AUDIT_SOURCE_COMPARISON_UNAVAILABLE'));
});

test('1.1 reports validate nested evidence and preserve 1.0 input/schema interpretation', async () => {
  const { report } = await offline(input);
  const broken = structuredClone(report); broken.sources[0]!.staticAnalysis!.entries[0]!.evidenceRef = 'absent'; assert.throws(() => validateReviewReport(broken));
  const authority = structuredClone(report); (authority.sources[0]!.staticAnalysis!.entries[0]! as { authorityConclusion: string }).authorityConclusion = 'CONFIRMED'; assert.throws(() => validateReviewReport(authority));
  const missing = structuredClone(report); missing.audits[0]!.sourceComparison!.snapshotEvidence = 'absent'; assert.throws(() => validateReviewReport(missing));
  const legacy = structuredClone(report); legacy.schemaVersion = 'TokenTechnicalReview1.0'; delete legacy.mode;
  legacy.config.schemaVersion = 'TokenReviewConfig1.0';
  for (const s of legacy.sources) { delete s.staticAnalysis; delete s.runtimeComparison; }
  for (const a of legacy.audits) delete a.sourceComparison;
  validateReviewReport(legacy);
  const oldConfig = { schemaVersion: 'TokenReviewConfig1.0', network: { chainId: '31337' }, token: { address } };
  assert.equal(parseConfig(Buffer.from(serialize(oldConfig))).schemaVersion, 'TokenReviewConfig1.0');
  assert.throws(() => parseConfig(Buffer.from(serialize({ ...oldConfig, audits: [{ file: 'audit.txt', sourceSnapshotFile: 'snapshot.json', compareToAddress: address }] }))));
  assert.throws(() => parseConfig(Buffer.from(serialize({ ...oldConfig, schemaVersion: 'TokenReviewConfig1.1', audits: [{ file: 'audit.txt', sourceSnapshotFile: 'snapshot.json' }] }))));
});
