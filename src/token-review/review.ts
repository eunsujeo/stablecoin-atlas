import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { keccak256, type Hex } from 'viem';
import { compilerVersion, compilerProfile, compile, prepareInput, prepareSourceBundle, type CompilerInput } from './compiler.js';
import { collect, prepareProbe, recheck } from './collector.js';
import { parseConfig, readBounded, relativeInput, sha256 } from './input.js';
import type { ReviewReport, SourceReview } from './model.js';
import { ReviewRpc } from './rpc.js';
import { checklist, inventory, sourceFindings } from './source-analysis.js';
import { markdown, validateReviewReport } from './report.js';
import { writeReportAtomically } from '../report-output.js';
import { analyzeSource, semanticFindings } from './semantic-analysis.js';
import { compareRuntime } from './runtime-comparison.js';
import { compareAuditSources } from './audit-comparison.js';
import { readArchivedObservations } from './archived-observations.js';

export const serialize = (value: unknown): string => JSON.stringify(value, (_, v: unknown) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n';
export async function reviewToken(configFile: string, rpcUrl: string | undefined, outputDirectory: string, options: { offline?: boolean; observations?: string } = {}): Promise<ReviewReport> {
  const configBytes = await readBounded(configFile, 64 * 1024);
  const config = parseConfig(configBytes);
  // Reject unsupported calls before any RPC request or output mutation.
  for (const probe of config.probes ?? []) prepareProbe(probe);
  if (options.observations && !options.offline) throw new Error('ARCHIVE_REQUIRES_OFFLINE');
  const archiveBytes = options.observations ? await readBounded(options.observations, 32 * 1024 * 1024) : null;
  const archive = archiveBytes ? readArchivedObservations(archiveBytes, config) : null;
  if (!options.offline && !rpcUrl) throw new Error('RPC_URL_REQUIRED');
  const rpc = new ReviewRpc(options.offline ? 'http://127.0.0.1' : rpcUrl!, [config.token.address, ...config.dependencies ?? []]);
  const directory = resolve(outputDirectory);
  await mkdir(directory, { mode: 0o700 }); // Exclusive: never replace an existing evidence bundle.
  await mkdir(join(directory, 'artifacts'), { mode: 0o700 });
  const { sources: _sources, audits: _audits, ...publicConfig } = config;
  const report: ReviewReport = {
    schemaVersion: 'TokenTechnicalReview1.2', archive: null, mode: options.offline ? 'OFFLINE' : 'READ_ONLY', startedAt: new Date().toISOString(), finishedAt: '', execution: 'COMPLETED',
    config: publicConfig,
    tools: { analyzer: 'token-review/1.2.0', rules: 'token-review-rules/1.2.0', compiler: compilerVersion, ai: 'NOT_RUN', slither: 'NOT_RUN' },
    block: { number: null, hash: null, consistency: 'UNKNOWN' }, contracts: [], proxy: null, sources: [], audits: [],
    findings: [], failures: [], evidence: rpc.evidence, artifacts: [], limitations: [
      '기술 특성의 근거 수집·검토 보조 도구입니다. 보안 감사·자산 안전성·지원 승인·지갑 시스템 검증이 아닙니다.',
      '소스 AST는 선택 계약의 정적 진입/호출/상속/modifier·조건·저장값 변경과 동작 패턴을 기록합니다. 경로 도달성·권한 보장·동적 dispatch·의존성 완전성은 자동 증명하지 않습니다.',
      '소스 사실은 제공된 소스에 한정됩니다. 정확한 runtime 일치와 기준 블록 일관성이 확인된 주소만 배포 연결을 확인합니다. 구현체 연결도 프록시 실제 dispatch 증명은 아닙니다.',
      '인식되지 않은 프록시·중첩 구현체·diamond·동적 외부 의존성·비열거 역할·생성자/immutable 및 라이브러리 재현 미확정은 UNKNOWN입니다.',
      'EIP-1898 blockHash/requireCanonical 조회만 사용합니다. 미지원 RPC는 실패하며 높이/latest로 대체하지 않습니다. 응답 진실성·합의·최종성은 평가하지 않습니다.',
      '감사 자료는 제공된 바이트와 제출자가 기재한 메타데이터만 보존합니다. 진위·감사 대상 버전·현재 배포 대응은 UNKNOWN입니다. 미제공은 미감사라는 뜻이 아닙니다.',
      '관리 기능·EOA 주소·getter 실패·분석 누락·도구 성공을 취약점 또는 안전성으로 판정하지 않습니다. AI/Slither/거래·서명·외부 빌드 스크립트는 실행하지 않습니다.',
      'Trail of Bits token-integration-analyzer의 관리자·비표준 동작 항목을 체크리스트 참고로만 사용했습니다. 전체 스킬·등급·감사 결과를 적용하지 않았습니다.',
      '제출 immutable 값으로 재구성한 runtime이 전체 일치해도 생성자·값 출처는 증명되지 않아 배포 연결 UNKNOWN입니다. 감사 snapshot의 경로/바이트 일치는 감사 문서의 진위·실제 대상 범위·현재 배포 대응 증명이 아닙니다.',
      '저장 관측은 원래 블록/시각/원본 hash를 보존한 대조 자료입니다. 오프라인 대조는 새 체인 조회나 원본 보고서의 진위 인증이 아니며 배포 연결은 UNKNOWN입니다.',
    ],
  };
  const configuration = rpc.record('REVIEW_CONFIGURATION', { configSha256: sha256(configBytes), ...publicConfig });
  const analyzedInputs = new Map<string, { input: CompilerInput; evidenceRef: string; compilerVersion: string }>();
  let sourceEvidenceBytes = 0;
  function sourceEvidence(kind: string, data: unknown): string {
    sourceEvidenceBytes += Buffer.byteLength(serialize(data));
    if (sourceEvidenceBytes > 4 * 1024 * 1024) throw new Error('SOURCE_EVIDENCE_LIMIT');
    return rpc.record(kind, data).id;
  }
  async function artifact(name: string, bytes: Buffer, kind: string): Promise<string> {
    const path = `artifacts/${name}`;
    await writeFile(join(directory, path), bytes, { flag: 'wx', mode: 0o600 });
    const record = { path, sha256: sha256(bytes), bytes: bytes.length, kind };
    report.artifacts.push(record);
    return rpc.record('LOCAL_ARTIFACT', record).id;
  }
  function failure(stage: string, code: string) {
    const ev = rpc.record('ANALYSIS_FAILURE', { stage, code });
    report.failures.push({ stage, code, evidenceRefs: [ev.id] });
  }
  const archiveContracts = new Map<string, { address: string; runtimeHash: string; evidenceRef: string }>();
  if (archive && archiveBytes) {
    const evidenceRef = await artifact('observations.json', archiveBytes, 'SUPPLIED_ARCHIVED_OBSERVATIONS');
    report.archive = { ...archive.descriptor, evidenceRef };
    for (const value of archive.contracts.values()) {
      const ev = rpc.record('ARCHIVED_CONTRACT_CODE', { ...value, archiveEvidenceRef: evidenceRef,
        originalBlock: archive.descriptor.block, originalObservedAt: archive.descriptor.sourceFinishedAt });
      archiveContracts.set(value.address, { address: value.address, runtimeHash: value.runtimeHash, evidenceRef: ev.id });
    }
  }
  let collected = false;
  if (options.offline) rpc.record('CHAIN_COLLECTION_NOT_RUN', { reason: 'EXPLICIT_OFFLINE_MODE' });
  else try { await collect(config, report, rpc); collected = true; }
  catch { failure('chain-collection', 'CHAIN_COLLECTION_INCOMPLETE'); }
  // Compile local input and preserve supplied documents even when the chain is unavailable.
  for (const [index, supplied] of (config.sources ?? []).entries()) {
    const source: SourceReview = { address: supplied.address, contract: supplied.contract, inputEvidence: configuration.id,
      compilation: 'NOT_RUN', compilerRequested: supplied.compilerVersion, compilerUsed: 'NOT_RUN',
      binding: { confirmation: 'UNKNOWN', reason: 'SOURCE_NOT_BOUND' }, functions: [], staticAnalysis: null, runtimeComparison: null };
    report.sources.push(source);
    try {
      const bytes = await readBounded(relativeInput(configFile, supplied.inputFile), 1024 * 1024);
      source.inputEvidence = await artifact(`source-${index}.input.json`, bytes, 'SUPPLIED_STANDARD_JSON');
      const prepared = prepareInput(bytes, supplied.contract, supplied.compilerVersion);
      analyzedInputs.set(supplied.address, { input: prepared.input, evidenceRef: source.inputEvidence, compilerVersion: supplied.compilerVersion });
      rpc.record('SOURCE_FILES', { address: supplied.address, files: Object.entries(prepared.input.sources).map(([file, s]) => ({ file,
        sha256: sha256(Buffer.from(s.content)), bytes: Buffer.byteLength(s.content) })), inputEvidence: source.inputEvidence });
      let profile;
      try { profile = await compilerProfile(supplied.compilerVersion); }
      catch { source.binding.reason = 'COMPILER_CACHE_UNVERIFIED'; failure(`source:${index}`, 'COMPILER_CACHE_UNVERIFIED'); continue; }
      if (!profile) {
        source.binding.reason = 'COMPILER_VERSION_UNAVAILABLE';
        failure(`source:${index}`, 'COMPILER_VERSION_UNAVAILABLE'); continue;
      }
      rpc.record('COMPILER_PROFILE', profile);
      await artifact(`source-${index}.compile-request.json`, Buffer.from(serialize(prepared)), 'EFFECTIVE_COMPILER_REQUEST');
      source.compilation = 'FAILED'; source.compilerUsed = 'UNCONFIRMED';
      const compiled = await compile(prepared.input, prepared.file, prepared.contractName, profile.version);
      source.compilerUsed = compiled.compiler;
      const compilationEvidence = await artifact(`source-${index}.compile-result.json`, Buffer.from(serialize(compiled)), 'COMPILER_RESULT');
      if (compiled.compiler !== profile.version || compiled.errors.some(e => e.severity === 'error') || !compiled.selected) {
        source.compilation = 'FAILED'; source.binding.reason = 'COMPILATION_FAILED';
        failure(`source:${index}`, 'COMPILATION_FAILED'); continue;
      }
      source.compilation = 'SUCCEEDED';
      const runtime = compiled.selected.evm.deployedBytecode;
      const observed = report.contracts.find(c => c.address === supplied.address) ?? archiveContracts.get(supplied.address);
      const comparison = compareRuntime(runtime, observed?.runtimeHash, supplied.immutableValues, compiled.compiler);
      if (archive && comparison.reason === 'EXACT_RUNTIME_PENDING_CHAIN_RECHECK') comparison.reason = 'EXACT_ARCHIVED_RUNTIME_MATCH_NOT_CURRENT_BINDING';
      source.binding.reason = comparison.reason;
      if (/^(?:[0-9a-fA-F]{2})+$/.test(runtime.object)) source.binding.runtimeHash = keccak256(`0x${runtime.object}` as Hex);
      if (observed) source.binding.observedRuntimeHash = observed.runtimeHash;
      const bindingEvidence = rpc.record('SOURCE_RUNTIME_COMPARISON', { address: supplied.address, contract: supplied.contract,
        inputEvidence: source.inputEvidence, compilationEvidence, observedEvidence: observed?.evidenceRef ?? null, ...source.binding, comparison });
      source.runtimeComparison = { ...comparison, evidenceRef: bindingEvidence.id };
      report.findings.push({ id: `binding-${index}`, rule: 'exact-runtime-binding-v1', scope: 'CHAIN', categories: [], confirmation: 'UNKNOWN',
        summary: `${supplied.contract}: ${source.binding.reason}. metadata를 제거하거나 부분 일치로 배포 연결을 확정하지 않습니다.`, evidenceRefs: [bindingEvidence.id] });
      if (!['ADDRESS_NOT_OBSERVED', 'EXACT_RUNTIME_PENDING_CHAIN_RECHECK', 'EXACT_ARCHIVED_RUNTIME_MATCH_NOT_CURRENT_BINDING', 'SUBMITTED_IMMUTABLE_RUNTIME_MATCH_CONSTRUCTOR_UNPROVEN'].includes(source.binding.reason)) failure(`source-binding:${index}`, source.binding.reason);
      source.functions = inventory(prepared.input, compiled, prepared.file, prepared.contractName, sourceEvidence);
      report.findings.push(...sourceFindings(source.functions, compiled.selected.abi, `source-${index}`, compilationEvidence));
      source.staticAnalysis = analyzeSource(prepared.input, compiled, prepared.file, prepared.contractName, sourceEvidence);
      report.findings.push(...semanticFindings(source.staticAnalysis, `source-${index}`));
      if (source.staticAnalysis.coverage.entryLimitReached || source.staticAnalysis.coverage.stateVariableLimitReached
        || source.staticAnalysis.entries.some(e => e.uncertainties.some(u => u.endsWith('_LIMIT')))) failure(`source-graph:${index}`, 'STATIC_GRAPH_TRUNCATED');
    } catch { failure(`source:${index}`, 'SOURCE_ANALYSIS_INCOMPLETE'); }
  }
  for (const [index, audit] of (config.audits ?? []).entries()) {
    try {
      const bytes = await readBounded(relativeInput(configFile, audit.file), 2 * 1024 * 1024);
      const evidenceRef = await artifact(`audit-${index}.bin`, bytes, 'SUPPLIED_AUDIT_DOCUMENT');
      const entry: ReviewReport['audits'][number] = { evidenceRef, title: audit.title ?? '제출된 감사 자료', publisher: audit.publisher ?? 'UNKNOWN',
        reference: audit.reference ?? null, declaredTarget: audit.declaredTarget ?? null, authenticity: 'UNKNOWN', deploymentMapping: 'UNKNOWN', sourceComparison: null };
      report.audits.push(entry);
      if (audit.sourceSnapshotFile && audit.compareToAddress) {
        try {
          const snapshotBytes = await readBounded(relativeInput(configFile, audit.sourceSnapshotFile), 1024 * 1024);
          const snapshotEvidence = await artifact(`audit-${index}.source-snapshot.json`, snapshotBytes, 'SUBMITTED_AUDIT_SOURCE_SNAPSHOT');
          const analyzed = analyzedInputs.get(audit.compareToAddress);
          if (!analyzed) throw new Error('AUDIT_COMPARISON_TARGET_UNAVAILABLE');
          const snapshot = prepareSourceBundle(snapshotBytes, analyzed.compilerVersion);
          const compared = compareAuditSources(analyzed.input, snapshot);
          const ev = rpc.record('AUDIT_SOURCE_COMPARISON', { address: audit.compareToAddress, ...compared,
            analyzedInputEvidence: analyzed.evidenceRef, snapshotEvidence, auditDocumentEvidence: evidenceRef, associationWithAudit: 'UNKNOWN' });
          entry.sourceComparison = { address: audit.compareToAddress, ...compared, analyzedInputEvidence: analyzed.evidenceRef,
            snapshotEvidence, evidenceRef: ev.id, associationWithAudit: 'UNKNOWN' };
          report.findings.push({ id: `audit-snapshot-${index}`, rule: 'audit-source-bytes-v1', scope: 'AUDIT', categories: [], confirmation: 'CONFIRMED',
            summary: `제출된 감사 동봉 소스 대조: 파일 경로/바이트 ${compared.sourceMatch}, 빌드 설정 ${compared.settingsMatch}. 문서가 이 소스를 감사했다는 관계·진위·현재 배포 대응은 확인 불가입니다.`, evidenceRefs: [ev.id] });
          if (compared.sourceMatch !== 'MATCH' || compared.settingsMatch !== 'MATCH') failure(`audit-snapshot:${index}`, 'AUDIT_SOURCE_SNAPSHOT_MISMATCH');
        } catch { failure(`audit-snapshot:${index}`, 'AUDIT_SOURCE_COMPARISON_UNAVAILABLE'); }
      }
    } catch { failure(`audit:${index}`, 'AUDIT_DOCUMENT_UNAVAILABLE'); }
  }
  if (!options.offline) try { await recheck(config, report, rpc); }
  catch { failure('chain-recheck', 'CHAIN_REFERENCE_UNCONFIRMED'); }
  if (!collected) report.block.consistency = 'UNKNOWN';
  const consistent = report.block.consistency === 'HASH_PINNED_RECHECKED';
  for (const [index, source] of report.sources.entries()) {
    if (consistent && source.binding.reason === 'EXACT_RUNTIME_PENDING_CHAIN_RECHECK') {
      source.binding = { ...source.binding, confirmation: 'CONFIRMED', reason: 'EXACT_RUNTIME_AT_PINNED_BLOCK' };
      const finding = report.findings.find(f => f.id === `binding-${index}`);
      if (finding) { finding.confirmation = 'CONFIRMED'; finding.summary = `${source.contract}: 제공한 설정·설치 compiler로 재현한 runtime 전체가 해당 주소의 기준 블록 코드와 정확히 일치합니다.`; }
    }
  }
  if (!consistent) {
    for (const source of report.sources) if (source.binding.reason === 'EXACT_RUNTIME_PENDING_CHAIN_RECHECK') source.binding.reason = 'CHAIN_REFERENCE_UNCONFIRMED';
    for (const finding of report.findings) if (finding.scope === 'CHAIN') {
      finding.confirmation = 'UNKNOWN'; finding.summary += options.offline ? ' 오프라인 모드로 체인 조회를 실행하지 않았습니다.' : ' 기준 체인/블록의 일관성을 확정하지 못해 체인 결론을 보류합니다.';
    }
  }
  for (const [id, title] of checklist) report.findings.push({ id: `coverage-${id}`, rule: 'manual-coverage-v1', scope: 'COVERAGE', categories: [], confirmation: 'UNKNOWN',
    summary: `${title}: 자동 의미 분석·완전성 증명은 수행하지 않았습니다. 관련 소스·조회 결과가 있어도 전체 항목의 부재/안전으로 판정하지 않습니다.`, evidenceRefs: [configuration.id] });
  // Proxy probing deliberately tolerates individual failures. Preserve them as failures,
  // rather than allowing a successful outer call to hide an incomplete collection.
  for (const ev of report.evidence) if (ev.kind === 'RPC_ERROR') {
    const data = ev.data as { method: string; code: string };
    report.failures.push({ stage: `rpc:${data.method}`, code: data.code, evidenceRefs: [ev.id] });
  }
  report.execution = report.failures.length ? 'PARTIAL' : 'COMPLETED'; report.finishedAt = new Date().toISOString();
  validateReviewReport(report);
  const json = serialize(report), md = markdown(report);
  if (Buffer.byteLength(json) > 32 * 1024 * 1024) throw new Error('REPORT_SIZE_LIMIT');
  await writeReportAtomically(join(directory, 'report.json'), json);
  await writeReportAtomically(join(directory, 'report.md'), md);
  await writeReportAtomically(join(directory, 'bundle.json'), serialize({ schemaVersion: 'TokenReviewBundle1.0',
    files: [...report.artifacts, { path: 'report.json', sha256: sha256(json), bytes: Buffer.byteLength(json), kind: 'REPORT_JSON' },
      { path: 'report.md', sha256: sha256(md), bytes: Buffer.byteLength(md), kind: 'REPORT_MARKDOWN' }] }));
  return report;
}
