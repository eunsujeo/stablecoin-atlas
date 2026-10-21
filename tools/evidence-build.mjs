import { mkdir, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validateAssessmentReportText } from '../src/report-contract.ts';
import { boundedRead, digest, evidenceRoot, publishedIndex } from './evidence-store.mjs';
export const sources = [
  ['dashboard-local-validation.json', 'LOCAL_FIXTURE', 'EVM', '31337', null, null],
  ['usdc-readonly.json', 'STORED_READ_ONLY', 'EVM', '1', 'USDC', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
  ['usdt-readonly.json', 'STORED_READ_ONLY', 'EVM', '1', 'USDT', '0xdAC17F958D2ee523a2206206994597C13D831ec7'],
  ['rlusd-readonly.json', 'STORED_READ_ONLY', 'EVM', '1', 'RLUSD', '0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD'],
  ['tron-usdt-allowance-readonly.json', 'STORED_READ_ONLY', 'TRON', '728126428', 'USDT', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'],
  ['solana-usdc-account-public-readonly.json', 'STORED_READ_ONLY', 'SOLANA', '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d', 'USDC', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'],
  ['solana-usdt-account-public-readonly.json', 'STORED_READ_ONLY', 'SOLANA', '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d', 'USDT', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'],
  ['xrpl-usdc-account-public-readonly.json', 'STORED_READ_ONLY', 'XRPL', '0', 'USDC', 'rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE'],
  ['xrpl-rlusd-account-public-readonly.json', 'STORED_READ_ONLY', 'XRPL', '0', 'RLUSD', 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'],
];
const forbidden = /private.?key|mnemonic|authorization|password|rpc.?url|api.?key|access.?token/i;
const fixtures = ['StandardToken', 'NoReturnToken', 'FalseReturnToken', 'FeeToken', 'ZeroResetToken', 'PausableToken', 'BlacklistToken'];
function guard(value, depth = 0) {
  if (depth > 120) throw new Error('DEPTH_LIMIT');
  if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) throw new Error('UNSAFE_NUMBER');
  if (typeof value === 'string' && (/https?:\/\/|bearer\s+\S+/i.test(value) || value.length > 2000000)) throw new Error('PUBLICATION_POLICY');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { if (forbidden.test(key)) throw new Error('PUBLICATION_POLICY'); guard(child, depth + 1); }
}
function projection(value, depth = 0) {
  if (depth > 16) return '[omitted: depth]';
  if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) throw new Error('UNSAFE_NUMBER');
  if (typeof value === 'string') return value.length > 24000 ? '[omitted: length]' : value;
  if (Array.isArray(value)) return value.length > 200 ? '[omitted: array length]' : value.map(v => projection(v, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !['environment', 'build'].includes(k) && !forbidden.test(k)).map(([k, v]) => [k, projection(v, depth + 1)]));
  return value;
}
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function documentFor(view) {
  const r = view.report;
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(view.label)} 검증 근거</title><style>body{font:15px/1.7 system-ui;max-width:1000px;margin:40px auto;padding:0 24px;color:#17243a}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f5fa;padding:16px;font-size:12px}article{border-top:1px solid #ccd4df;margin-top:24px;padding-top:16px}small{color:#53637b}h1{font-size:27px}dt{font-weight:bold}dd{margin:0 0 12px;overflow-wrap:anywhere}@media print{article{break-inside:avoid}body{margin:0}}</style><h1>${esc(view.label)} 검증 근거 문서</h1><p>${view.scope === 'LOCAL_FIXTURE' ? '사설 로컬 Fixture 실행 결과이며 실제 스테이블코인의 동작 증거가 아닙니다.' : '기존 저장된 실제 자산 읽기 결과입니다. 이번 문서 생성은 공개망 재조회가 아닙니다.'}</p><p>PASS는 개별 시나리오 성공입니다. 검증기 통과와 해시는 자산 안전성이나 진위를 인증하지 않습니다. 이 문서는 화면용 허용 필드 발췌본이며 원본 파일은 로컬에 별도 보존합니다.</p><dl><dt>원본 완료 시각</dt><dd>${esc(r.completedAt)}</dd><dt>원본 입력 SHA-256</dt><dd>${esc(view.sourceSha256)}</dd><dt>내장 보고서 선택 위치</dt><dd>${esc(view.selector)}</dd><dt>보고서 SHA-256 · ${esc(view.hashKind)}</dt><dd>${esc(view.id)}</dd></dl>${r.results.map(s => `<article><h2>${esc(s.scenarioId)} · ${esc(s.capability)}</h2><p>판정 ${esc(s.verdict)} / 지원 ${esc(s.support)} / 실행 ${esc(s.executionStatus)}</p><p>${esc(s.startedAt)} ~ ${esc(s.completedAt)} / block·slot·ledger ${esc(s.observedBlockOrSlot)}</p><h3>관측값</h3><pre>${esc(JSON.stringify(s.observations, null, 2))}</pre><h3>제약</h3><pre>${esc(JSON.stringify([...r.limitations, ...s.limitations], null, 2))}</pre><h3>참조 근거</h3>${s.evidenceReferences.map(id => { const e = r.evidence.find(v => v.id === id); return `<pre>${esc(JSON.stringify(e, null, 2))}</pre>`; }).join('')}</article>`).join('')}</html>`;
}
async function atomic(root, name, bytes) {
  const temporary = new URL(`.${randomUUID()}.tmp`, root); await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' }); await rename(temporary, new URL(name, root));
}
async function immutable(url, bytes) {
  try { await writeFile(url, bytes, { mode: 0o600, flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST' || digest(await boundedRead(url)) !== digest(bytes)) throw new Error('ARTIFACT_CONFLICT'); }
}
export async function buildEvidence({ root = evidenceRoot, readSource = name => boundedRead(new URL(`../reports/${name}`, import.meta.url)), sourceList = sources } = {}) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const at = new Date().toISOString();
  try {
    const reports = [], items = []; let totalBytes = 0;
    await mkdir(new URL('sources/', root), { recursive: true, mode: 0o700 }); await mkdir(new URL('artifacts/', root), { recursive: true, mode: 0o700 });
    if (sourceList.length > 16) throw new Error('SOURCE_LIMIT');
    for (const [file, scope, chain, network, asset, expected] of sourceList) {
      const bytes = await readSource(file); if (bytes.length > 10 * 1024 * 1024 || (totalBytes += bytes.length) > 32 * 1024 * 1024) throw new Error('INPUT_LIMIT');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes), parsed = JSON.parse(text); guard(parsed);
      const parentSha = digest(bytes);
      const entries = scope === 'LOCAL_FIXTURE' ? parsed.assessments?.map((a, i) => ({ report: a.report, label: a.fixture, selector: `$.assessments[${i}].report` })) : [{ report: parsed, label: `${asset} · ${chain}`, selector: '$' }];
      if (!entries || (scope === 'LOCAL_FIXTURE' && (parsed.mode !== 'SIMULATION' || entries.length !== 7 || new Set(entries.map(e => e.label)).size !== 7 || entries.some(e => !fixtures.includes(e.label))))) throw new Error('ENVELOPE_MISMATCH');
      for (const entry of entries) {
        const original = entry.selector === '$' ? bytes : Buffer.from(JSON.stringify(entry.report));
        const result = validateAssessmentReportText(original.toString('utf8')); if (!result.valid) throw new Error('REPORT_INVALID');
        const report = entry.report, identity = report.assetIdentity;
        const field = chain === 'SOLANA' ? 'mintAddress' : chain === 'XRPL' ? 'issuer' : 'contractAddress';
        if (identity.chainFamily !== chain || identity.networkId !== network || report.mode !== (scope === 'LOCAL_FIXTURE' ? 'SIMULATION' : 'READ_ONLY') || (expected && identity[field]?.value !== expected)) throw new Error('IDENTITY_MISMATCH');
        const id = digest(original); if (reports.some(r => r.id === id)) throw new Error('DUPLICATE_REPORT');
        const allowed = Object.fromEntries(['schemaVersion', 'assessmentId', 'mode', 'profile', 'assetIdentity', 'startedAt', 'completedAt', 'limitations', 'capabilitySummary'].map(k => [k, projection(report[k])]));
        const identityView = Object.fromEntries(['chainFamily','networkId','issuedCurrency','assetStandard','contractAddress','mintAddress','tokenProgramId','symbol','name','decimals','issuer','issuerVerificationStatus','nativeOrBridged','implementationAddress','observedBlockOrSlot','observedAt'].filter(k => identity[k] !== undefined).map(k => [k, projection(identity[k])]));
        allowed.assetIdentity = identityView;
        allowed.results = report.results.map(s => Object.fromEntries(['scenarioId','scenarioVersion','capability','support','executionStatus','verdict','observations','limitations','evidenceReferences','observedBlockOrSlot','startedAt','completedAt'].map(k => [k, projection(s[k])])));
        allowed.evidence = report.evidence.map(e => Object.fromEntries(['id','kind','provenance','observedAt','observedBlockOrSlot','data'].map(k => [k, projection(e[k])])));
        const view = { kind: 'ASSESSMENT_EVIDENCE_PROJECTION', projection: 'BOUNDED_ALLOWLIST_NOT_ORIGINAL_REPORT', id, label: entry.label, scope, sourceSha256: parentSha, selector: entry.selector, hashKind: entry.selector === '$' ? 'ORIGINAL_BYTES' : 'RESERIALIZED_EMBEDDED_REPORT', report: allowed };
        const viewBytes = Buffer.from(JSON.stringify(view)), htmlBytes = Buffer.from(documentFor(view));
        if (viewBytes.length > 4 * 1024 * 1024 || htmlBytes.length > 4 * 1024 * 1024) throw new Error('ARTIFACT_LIMIT');
        await immutable(new URL(`artifacts/${digest(viewBytes)}.json`, root), viewBytes); await immutable(new URL(`artifacts/${digest(htmlBytes)}.html`, root), htmlBytes);
        reports.push({ id, label: entry.label, scope, asset: asset ?? entry.label, chain, networkId: network, sourceName: file, sourceSha256: parentSha, selector: entry.selector, hashKind: view.hashKind, assessmentId: report.assessmentId, identity: identityView, completedAt: report.completedAt, startedAt: report.startedAt, viewSha256: digest(viewBytes), documentSha256: digest(htmlBytes), itemCount: report.results.length });
        for (const s of allowed.results) items.push({ key: `${id}:${report.assessmentId}:${s.scenarioId}:${s.capability}`, reportId: id, scenarioId: s.scenarioId, scenarioVersion: s.scenarioVersion, capability: s.capability, verdict: s.verdict, support: s.support, executionStatus: s.executionStatus, startedAt: s.startedAt, completedAt: s.completedAt, observedBlockOrSlot: s.observedBlockOrSlot, evidenceCount: s.evidenceReferences.length, limitationCount: s.limitations.length });
      }
      // Exact input snapshot is local-only and is never in the web route allowlist.
      await immutable(new URL(`sources/${parentSha}.json`, root), bytes);
    }
    try {
      const previous = (await publishedIndex(root)).index;
      for (const r of previous.reports) if (!reports.some(next => next.id === r.id)) { reports.push(r); items.push(...previous.items.filter(item => item.reportId === r.id)); }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const index = { kind: 'LOCAL_EVIDENCE_INDEX', version: 1, generatedAt: at, validationScope: 'SCHEMA_AND_INTERNAL_CONSISTENCY_ONLY', reports, items };
    if (items.length > 2000 || reports.length > 64) throw new Error('INDEX_LIMIT');
    const indexText = JSON.stringify(index); if (Buffer.byteLength(indexText) > 2 * 1024 * 1024) throw new Error('INDEX_LIMIT');
    await atomic(root, 'last-build.json', JSON.stringify({ state: 'SUCCESS', at }));
    await atomic(root, 'index.json', indexText);
    return index;
  } catch { await atomic(root, 'last-build.json', JSON.stringify({ state: 'FAILED', at })); throw new Error('EVIDENCE_BUILD_FAILED'); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { if (process.argv.length > 2) throw new Error(); const index = await buildEvidence(); console.log(`Evidence saved: ${index.reports.length} reports, ${index.items.length} items. Offline validation only.`); }
  catch { console.error('EVIDENCE_BUILD_FAILED: previous published index preserved. Check the fixed source reports locally.'); process.exitCode = 1; }
}
