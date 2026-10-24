import type { ReviewReport } from './model.js';
import { Ajv } from 'ajv';
import { reportSchema } from './schema.js';
import { readFileSync } from 'node:fs';
import { keccak256, type Hex } from 'viem';

const shape = new Ajv({ strict: true }).compile(reportSchema);
const legacyShape = new Ajv({ strict: true }).compile(JSON.parse(readFileSync(new URL('../../schemas/token-technical-review.v1.schema.json', import.meta.url), 'utf8')));
const shape11 = new Ajv({ strict: true }).compile(JSON.parse(readFileSync(new URL('../../schemas/token-technical-review.v1.1.schema.json', import.meta.url), 'utf8')));

const confirmations = { CONFIRMED: '확인됨', NOT_FOUND_IN_SCOPE: '분석 범위에서 미발견', UNKNOWN: '확인 불가', NOT_APPLICABLE: '해당 없음' };
const categories = { INTENDED_ADMIN_FUNCTION: '의도된 관리 기능', NONSTANDARD_BEHAVIOR: '비표준 동작', VULNERABILITY_CANDIDATE: '취약점 후보', CURRENT_STATE: '현재 운영 상태' };
// Untrusted text is always plain content, never Markdown links, HTML, or instructions.
const escape = (v: unknown): string => String(v).replace(/[\r\n\u0000-\u001f\u007f]/g, ' ')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_[\]{}()#!|])/g, '\\$1');
export function validateReviewReport(report: ReviewReport): void {
  const validator = report.schemaVersion === 'TokenTechnicalReview1.0' ? legacyShape : report.schemaVersion === 'TokenTechnicalReview1.1' ? shape11 : shape;
  if (!validator(report)) throw new Error('REVIEW_SCHEMA_INVALID');
  if (report.mode === 'OFFLINE' && (report.block.consistency !== 'UNKNOWN' || report.block.number !== null || report.block.hash !== null
    || report.contracts.length || report.proxy !== null || report.evidence.some(e => e.kind === 'RPC' || e.kind === 'GETTER_RESULT'))) throw new Error('INVALID_OFFLINE_OBSERVATION');
  const ids = new Set(report.evidence.map(e => e.id));
  if (report.archive && (report.mode !== 'OFFLINE' || !ids.has(report.archive.evidenceRef)
    || report.archive.chainId !== report.config.network.chainId || report.archive.tokenAddress !== report.config.token.address
    || report.sources.some(s => s.binding.confirmation === 'CONFIRMED'))) throw new Error('INVALID_ARCHIVE_CONTEXT');
  if (report.archive) {
    const evidence = report.evidence.find(e => e.id === report.archive!.evidenceRef);
    const artifact = evidence?.data as { path?: string; sha256?: string; bytes?: number } | undefined;
    if (evidence?.kind !== 'LOCAL_ARTIFACT' || artifact?.sha256 !== report.archive.sha256
      || !report.artifacts.some(a => a.path === artifact.path && a.sha256 === artifact.sha256 && a.bytes === artifact.bytes)) throw new Error('ARCHIVE_ARTIFACT_MISMATCH');
  }
  if (ids.size !== report.evidence.length) throw new Error('DUPLICATE_EVIDENCE');
  const findingIds = new Set(report.findings.map(f => f.id));
  if (findingIds.size !== report.findings.length) throw new Error('DUPLICATE_FINDING');
  for (const finding of report.findings) {
    if (!finding.evidenceRefs.length || finding.evidenceRefs.some(id => !ids.has(id))) throw new Error('DANGLING_EVIDENCE');
    if (finding.scope === 'CHAIN' && finding.confirmation === 'CONFIRMED' && report.block.consistency !== 'HASH_PINNED_RECHECKED') throw new Error('UNCONFIRMED_CHAIN_FINDING');
  }
  for (const source of report.sources) {
    if (!ids.has(source.inputEvidence) || source.functions.some(f => !ids.has(f.evidenceRef))) throw new Error('DANGLING_SOURCE');
    if (source.binding.confirmation === 'CONFIRMED' && (report.block.consistency !== 'HASH_PINNED_RECHECKED'
      || source.binding.runtimeHash !== source.binding.observedRuntimeHash
      || !report.contracts.some(c => c.address === source.address && c.runtimeHash === source.binding.observedRuntimeHash))) throw new Error('INVALID_SOURCE_BINDING');
    for (const entry of source.staticAnalysis?.entries ?? []) if (!ids.has(entry.evidenceRef) || entry.authorityConclusion !== 'UNKNOWN') throw new Error('INVALID_STATIC_CONCLUSION');
    const comparison = source.runtimeComparison;
    if (comparison) {
      if (!ids.has(comparison.evidenceRef)) throw new Error('DANGLING_RUNTIME_COMPARISON');
      if (comparison.kind === 'RAW_RUNTIME' && comparison.reconstructedRuntime !== null
        && (comparison.originalRuntime.toLowerCase() !== comparison.reconstructedRuntime.toLowerCase()
          || Object.keys(comparison.immutableValues).length || comparison.ranges.length)) throw new Error('RAW_RUNTIME_WAS_PATCHED');
      if (comparison.reconstructedRuntime && keccak256(comparison.reconstructedRuntime as Hex) !== comparison.runtimeHash) throw new Error('INVALID_RUNTIME_HASH');
      if (comparison.matched === true && comparison.runtimeHash !== source.binding.observedRuntimeHash) throw new Error('INVALID_RUNTIME_MATCH');
      if (source.binding.confirmation === 'CONFIRMED' && (comparison.kind !== 'RAW_RUNTIME' || comparison.matched !== true)) throw new Error('CONDITIONAL_RUNTIME_NOT_PROVEN');
    }
  }
  for (const entry of [...report.contracts, ...report.audits]) if (!ids.has(entry.evidenceRef)) throw new Error('DANGLING_OBSERVATION');
  for (const audit of report.audits) if (audit.sourceComparison) {
    const c = audit.sourceComparison;
    if ([c.evidenceRef, c.analyzedInputEvidence, c.snapshotEvidence].some(id => !ids.has(id))) throw new Error('DANGLING_AUDIT_COMPARISON');
    if (new Set(c.files.map(f => f.path)).size !== c.files.length
      || c.sourceMatch !== (c.files.every(f => f.status === 'SAME') ? 'MATCH' : 'MISMATCH')
      || c.files.some(f => f.status === 'SAME' && (!f.analyzedSha256 || f.analyzedSha256 !== f.snapshotSha256))) throw new Error('INVALID_AUDIT_COMPARISON');
  }
  for (const failure of report.failures) if (!failure.evidenceRefs.length || failure.evidenceRefs.some(id => !ids.has(id))) throw new Error('DANGLING_FAILURE');
}
export function markdown(report: ReviewReport): string {
  const lines = ['# 토큰 기술 특성 검토', '',
    `- 모드: ${report.mode ?? 'READ_ONLY'}${report.mode === 'OFFLINE' ? ' (체인 조회 미실행)' : ''}`,
    `- 네트워크 chainId: ${escape(report.config.network.chainId)}`,
    `- 토큰: ${escape(report.config.token.address)}${report.config.token.label ? ` / ${escape(report.config.token.label)}` : ''}`,
    `- 분석 시간: ${escape(report.startedAt)} ~ ${escape(report.finishedAt)}`,
    `- 기준 블록: ${escape(report.block.number ?? 'UNKNOWN')} / ${escape(report.block.hash ?? 'UNKNOWN')}`,
    `- 일관성: ${report.block.consistency}; 실행: ${report.execution} (분석 절차의 완료 여부이며 안전성 판정이 아닙니다.)`,
    `- 도구: ${escape(JSON.stringify(report.tools))}`, '',
    ...(report.archive ? [`- 저장 관측 대조: 원래 ${escape(report.archive.sourceStartedAt)} ~ ${escape(report.archive.sourceFinishedAt)}, 블록 ${escape(report.archive.block.number)} / ${escape(report.archive.block.hash)}. 원본 SHA256 ${report.archive.sha256}, 근거 ${report.archive.evidenceRef}. 새 체인 관측·원본 진위 인증이 아닙니다.`, ''] : []),
    '## 배포 코드', '', '| 주소 | runtime keccak256 | 근거 |', '|---|---|---|',
    ...report.contracts.map(c => `| ${escape(c.address)} | ${escape(c.runtimeHash)} | ${c.evidenceRef} |`), '',
    `프록시 포인터: ${escape(report.proxy?.pattern ?? 'UNKNOWN')} / ${escape(report.proxy?.resolution ?? 'UNRESOLVED')}`,
    `구현체: ${escape(report.proxy?.implementationAddress.status === 'KNOWN' ? report.proxy.implementationAddress.value : 'UNKNOWN')}`, '',
    `Beacon: ${escape(report.proxy?.beaconAddress.status === 'KNOWN' ? report.proxy.beaconAddress.value : 'UNKNOWN')}; 관리자 슬롯: ${escape(report.proxy?.adminAddress.status === 'KNOWN' ? report.proxy.adminAddress.value : 'UNKNOWN')} (슬롯 값이며 실제 권한 증명이 아닙니다.)`, '',
    '## 소스와 배포 연결', '',
    ...report.sources.map(s => `- ${escape(s.address)} / ${escape(s.contract)}: 컴파일 ${s.compilation}, 배포 연결 ${confirmations[s.binding.confirmation]} (${escape(s.binding.reason)}). 근거 ${s.inputEvidence}`),
    ...report.sources.flatMap(s => s.runtimeComparison ? [`- ${escape(s.contract)} runtime 대조: ${s.runtimeComparison.kind} / ${s.runtimeComparison.matched ?? '미확인'}. ${s.runtimeComparison.kind === 'SUBMITTED_IMMUTABLE_VALUES' ? '제출한 immutable 값의 치환 결과이며 생성자·값 근거·배포 연결은 미증명입니다.' : 'metadata를 포함한 전체 바이트 대조입니다.'} 근거 ${s.runtimeComparison.evidenceRef}`] : []),
    ...(report.sources.length ? [] : ['소스 자료가 제공되지 않았습니다. 소스 분석·배포 연결은 확인 불가입니다.']), '',
    '## 확인 사항과 검토 후보', '', '| ID / 범위 | 분류 | 확인 상태 | 내용 | 근거 |', '|---|---|---|---|---|',
    ...report.findings.map(f => `| ${escape(f.id)} / ${f.scope} | ${f.categories.map(c => categories[c]).join(', ') || '근거·검토 범위'} | ${confirmations[f.confirmation]} | ${escape(f.summary)} | ${f.evidenceRefs.join(', ')} |`), '',
    '## 소스 함수·권한 경로 검토 자료', '',
  ];
  for (const source of report.sources) for (const fn of source.functions) {
    lines.push(`### ${escape(source.contract)} / ${escape(fn.contract)}.${escape(fn.name)}`, '',
      `위치: ${escape(fn.location.file)}:${fn.location.line}–${fn.location.endLine}; 근거 ${fn.evidenceRef}. 제공된 소스의 선언이며 현재 배포 적용은 위 연결 상태를 따릅니다.`, '',
      `- Selector: ${escape(fn.selector ?? '해당 선언에서 없음')}; 매개변수 ${escape(fn.parameters)}; 반환 선언 ${escape(fn.returnParameters)}; 상속 선언 ${fn.inherited}`,
      `- Modifier: ${fn.modifiers.map(m => `${escape(m.name)} (${m.declaration ? `${escape(m.declaration.file)}:${m.declaration.line}` : '선언 미확인'}): ${escape(m.text)}`).join(', ') || '선언 없음 (권한 없음의 증거가 아님)'}`,
      `- 조건: ${fn.conditions.map(escape).join('; ') || '함수 본문에서 추출한 조건 없음'}`,
      `- 호출: ${fn.calls.map(c => `${escape(c.expression)} → ${c.declaration ? `${escape(c.declaration.file)}:${c.declaration.line}` : '선언 미확인/내장 호출'}`).join('; ') || '추출 없음'}`,
      `- 대입·증감·삭제: ${fn.writes.map(escape).join('; ') || '추출 없음'}`,
      `- 반환문: ${fn.returns.map(escape).join('; ') || '추출 없음'}; assembly: ${fn.assembly}`, '');
  }
  lines.push('## 진입 함수별 정적 권한·저장값 변경 경로', '');
  for (const source of report.sources) {
    if (!source.staticAnalysis) { lines.push(`- ${escape(source.contract)}: 정적 경로 분석 미확보.`, ''); continue; }
    const analysis = source.staticAnalysis;
    for (const entry of analysis.entries) {
      lines.push(`### ${escape(source.contract)} / ${escape(entry.name)} ${escape(entry.selector ?? '')}`, '',
        `위치 ${escape(entry.location.file)}:${entry.location.line}; 근거 ${entry.evidenceRef}; 실제 권한 보장 ${confirmations[entry.authorityConclusion]}.`, '',
        `- 연관 선언: ${entry.declarations.map(d => `${escape(d.name)} #${d.id} (${escape(d.location.file)}:${d.location.line})`).join(', ')}`,
        ...entry.calls.map(c => `- 호출 #${c.from} → ${c.to ?? '미확인'} (${c.kind}): ${escape(c.expression)} @ ${escape(c.location.file)}:${c.location.line}`),
        ...entry.conditions.map(c => `- 조건 ${c.kind}: ${escape(c.expression)} @ ${escape(c.location.file)}:${c.location.line}; 저장 참조 ${c.stateReferences.map(r => escape(r.name)).join(', ') || '추출 없음'}`),
        ...entry.writes.map(w => `- 저장값 ${escape(w.variable.name)} (${escape(w.variable.type)}): ${escape(w.expression)} @ ${escape(w.location.file)}:${w.location.line}`),
        ...entry.behaviors.map(b => `- 동작 검토 ${b.pattern}: ${escape(b.expression)} @ ${escape(b.location.file)}:${b.location.line} (실행 의미 미확인)`),
        `- 미확정: ${entry.uncertainties.map(escape).join(', ') || '추가 구조적 미확정 표시는 없음. 권한·경로 의미 증명은 미수행.'}`, '');
    }
    const writers = new Map<number, { name: string; entries: Set<string> }>();
    for (const entry of analysis.entries) for (const w of entry.writes) {
      const row = writers.get(w.variable.id) ?? { name: w.variable.name, entries: new Set<string>() };
      row.entries.add(`${entry.name} ${entry.selector ?? ''}`); writers.set(w.variable.id, row);
    }
    lines.push('저장값 변경 진입점 (정적 선언 참조이며 실제 도달성·권한 미확인):', '',
      ...[...writers.values()].map(w => `- ${escape(w.name)} ← ${[...w.entries].map(escape).join(', ')}`), '',
      ...analysis.limitations.map(l => `- ${escape(l)}`), '');
  }
  lines.push('## 제출된 감사 자료', '',
    ...report.audits.map(a => `- ${escape(a.title)} / 제출자 기재 발행자 ${escape(a.publisher)} / ${escape(a.reference ?? '참조 미제공')}: 진위·배포 대응 UNKNOWN. 제출자가 기재한 대상 버전·commit·범위: ${escape(JSON.stringify(a.declaredTarget ?? '미제공'))}. 근거 ${a.evidenceRef}`),
    ...report.audits.flatMap(a => a.sourceComparison ? [
      `- 동봉 소스 ${escape(a.sourceComparison.address)}: 경로·바이트 ${a.sourceComparison.sourceMatch}, 빌드 설정 ${a.sourceComparison.settingsMatch}; 감사 문서와의 관계 UNKNOWN. 근거 ${a.sourceComparison.evidenceRef}`,
      ...a.sourceComparison.files.map(f => `  - ${escape(f.path)}: ${f.status}; 분석 SHA256 ${escape(f.analyzedSha256 ?? '없음')}; 동봉 SHA256 ${escape(f.snapshotSha256 ?? '없음')}`),
    ] : []),
    ...(report.audits.length ? [] : ['감사 자료 미확보. 미감사로 판정하지 않습니다.']), '',
    '## 분석 실패', '', ...report.failures.map(f => `- ${escape(f.stage)}: ${f.code}; 근거 ${f.evidenceRefs.join(', ')}`),
    ...(report.failures.length ? [] : ['기록된 실행 실패 없음. 미확인 항목의 해소를 뜻하지 않습니다.']), '',
    '## 한계', '', ...report.limitations.map(l => `- ${escape(l)}`), '',
    '## 근거', '', '원문·컴파일 입출력은 artifacts/, RPC·소스 위치·반환값은 report.json의 evidence에 보존합니다. bundle.json은 파일별 SHA-256을 기록합니다.', '',
    ...report.evidence.map(e => `- ${e.id}: ${escape(e.kind)}; ${escape(e.observedAt)}; 블록 ${escape(e.observedBlockOrSlot)}`), '');
  return lines.join('\n');
}
