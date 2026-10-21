import { readFileSync, constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Ajv } from 'ajv';
import { summarize } from './domain/evaluator.js';
import type { AssessmentReport } from './domain/model.js';

const schema = JSON.parse(readFileSync(new URL('../schemas/assessment-report.v1.schema.json', import.meta.url), 'utf8'));
const shape = new Ajv({ strict: true, allErrors: false }).compile(schema);
export const maxReportBytes = 10 * 1024 * 1024, maxReportDepth = 128;
const maxIssues = 32;
type Code = 'INVALID_JSON' | 'INVALID_UTF8' | 'SIZE_LIMIT' | 'DEPTH_LIMIT' | 'DUPLICATE_JSON_KEY' | 'SCHEMA_INVALID'
  | 'DUPLICATE_EVIDENCE_ID' | 'DUPLICATE_SCENARIO_CAPABILITY' | 'ASSESSMENT_ID_MISMATCH' | 'IDENTITY_MISMATCH'
  | 'MISSING_EVIDENCE_REFERENCE' | 'OBSERVED_EVIDENCE_REQUIRED' | 'INVALID_TIMESTAMP' | 'TIME_ORDER_INVALID'
  | 'CAPABILITY_SUMMARY_MISMATCH' | 'INVALID_OPTIONS' | 'FILE_INPUT_ERROR';
export interface ReportValidation {
  kind: 'ASSESSMENT_REPORT_VALIDATION'; scope: 'SCHEMA_AND_INTERNAL_CONSISTENCY_ONLY';
  valid: boolean; issues: { code: Code; location: string }[]; issueLimitReached: boolean;
}
export function reportValidationFailure(code: Code): ReportValidation {
  return { kind: 'ASSESSMENT_REPORT_VALIDATION', scope: 'SCHEMA_AND_INTERNAL_CONSISTENCY_ONLY',
    valid: false, issues: [{ code, location: '$' }], issueLimitReached: false };
}
// Lexical bounds/duplicate-key detection only. JSON.parse remains the grammar authority.
function scan(text: string): Code | undefined {
  const stack: { object: boolean; key: boolean; names: Set<string> }[] = [];
  let quoted = false, escaped = false, start = 0, keyFrame: typeof stack[number] | undefined;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === '"') {
        quoted = false;
        if (keyFrame) {
          const key: unknown = JSON.parse(text.slice(start, i + 1));
          if (typeof key !== 'string') return 'INVALID_JSON';
          if (keyFrame.names.has(key)) return 'DUPLICATE_JSON_KEY';
          keyFrame.names.add(key); keyFrame.key = false; keyFrame = undefined;
        }
      }
      continue;
    }
    if (c === '"') {
      quoted = true; start = i; const top = stack.at(-1);
      keyFrame = top?.object && top.key ? top : undefined;
    } else if (c === '{' || c === '[') {
      stack.push({ object: c === '{', key: c === '{', names: new Set() });
      if (stack.length > maxReportDepth) return 'DEPTH_LIMIT';
    } else if (c === '}' || c === ']') stack.pop();
    else if (c === ',' && stack.at(-1)?.object) stack.at(-1)!.key = true;
  }
  return undefined;
}
// JSON wire objects only: hashing each identity once avoids repeated large-root comparisons.
function fingerprint(value: unknown): string {
  const hash = createHash('sha256');
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) { hash.update('['); for (const x of v) { visit(x); hash.update(','); } hash.update(']'); }
    else if (v !== null && typeof v === 'object') {
      hash.update('{');
      for (const key of Object.keys(v).sort()) { hash.update(JSON.stringify(key) + ':'); visit((v as Record<string, unknown>)[key]); hash.update(','); }
      hash.update('}');
    } else hash.update(typeof v === 'number' && Object.is(v, -0) ? '-0' :
      typeof v === 'number' && !Number.isFinite(v) ? `NONFINITE:${v}` : JSON.stringify(v));
  };
  visit(value); return hash.digest('hex');
}
// Accept strings, not arbitrary JS objects: no getters, toJSON calls or cyclic-object traversal.
export function validateAssessmentReportText(text: string): ReportValidation {
  if (typeof text !== 'string') return reportValidationFailure('INVALID_JSON');
  if (Buffer.byteLength(text, 'utf8') > maxReportBytes) return reportValidationFailure('SIZE_LIMIT');
  let input: unknown;
  try { const issue = scan(text); if (issue) return reportValidationFailure(issue); input = JSON.parse(text); }
  catch { return reportValidationFailure('INVALID_JSON'); }
  if (!shape(input)) return reportValidationFailure('SCHEMA_INVALID');
  const report = input as AssessmentReport;
  const issues: ReportValidation['issues'] = [];
  let issueLimitReached = false;
  const add = (code: Code, location: string): void => {
    if (issues.length < maxIssues) issues.push({ code, location }); else issueLimitReached = true;
  };
  const validTime = (s: string) => Number.isFinite(Date.parse(s));
  const order = (start: string, end: string, location: string): void => {
    if (!validTime(start) || !validTime(end)) add('INVALID_TIMESTAMP', location);
    else if (Date.parse(end) < Date.parse(start)) add('TIME_ORDER_INVALID', location);
  };
  order(report.startedAt, report.completedAt, '$');
  if (!validTime(report.assetIdentity.observedAt)) add('INVALID_TIMESTAMP', '$/assetIdentity/observedAt');
  const evidence = new Map<string, AssessmentReport['evidence'][number]>();
  for (const [i, e] of report.evidence.entries()) {
    if (evidence.has(e.id)) add('DUPLICATE_EVIDENCE_ID', `$/evidence/${i}`);
    evidence.set(e.id, e);
    if (!validTime(e.observedAt)) add('INVALID_TIMESTAMP', `$/evidence/${i}/observedAt`);
  }
  const keys = new Set<string>(), identity = fingerprint(report.assetIdentity);
  for (const [i, result] of report.results.entries()) {
    const at = `$/results/${i}`, key = JSON.stringify([result.scenarioId, result.capability]);
    if (keys.has(key)) add('DUPLICATE_SCENARIO_CAPABILITY', at); keys.add(key);
    if (result.assessmentId !== report.assessmentId) add('ASSESSMENT_ID_MISMATCH', at + '/assessmentId');
    if (fingerprint(result.assetIdentity) !== identity) add('IDENTITY_MISMATCH', at + '/assetIdentity');
    if (result.evidenceReferences.some(id => !evidence.has(id))) add('MISSING_EVIDENCE_REFERENCE', at + '/evidenceReferences');
    if ((result.verdict === 'PASS' || result.verdict === 'FAIL') && !result.evidenceReferences.some(id => evidence.get(id)?.provenance === 'OBSERVED')) {
      add('OBSERVED_EVIDENCE_REQUIRED', at + '/evidenceReferences');
    }
    order(result.startedAt, result.completedAt, at);
  }
  const sorted = (values: AssessmentReport['capabilitySummary']) => values.map(v => ({ ...v, verdicts: [...v.verdicts].sort() }))
    .sort((a, b) => a.capability.localeCompare(b.capability));
  if (!isDeepStrictEqual(sorted(report.capabilitySummary), sorted(summarize(report)))) add('CAPABILITY_SUMMARY_MISMATCH', '$/capabilitySummary');
  return { kind: 'ASSESSMENT_REPORT_VALIDATION', scope: 'SCHEMA_AND_INTERNAL_CONSISTENCY_ONLY', valid: issues.length === 0, issues, issueLimitReached };
}
export class ReportInputError extends Error { constructor() { super('Report validation file could not be read.'); } }
export async function validateAssessmentReportFile(path: string): Promise<ReportValidation> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    // NOFOLLOW protects the final component; NONBLOCK prevents FIFO-open waits.
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const st = await handle.stat(); if (!st.isFile()) throw new ReportInputError();
    if (st.size > maxReportBytes) return reportValidationFailure('SIZE_LIMIT');
    const parts: Buffer[] = []; let total = 0;
    for (;;) {
      const part = Buffer.alloc(Math.min(64 * 1024, maxReportBytes + 1 - total));
      const { bytesRead } = await handle.read(part, 0, part.length, null);
      if (bytesRead === 0) break;
      total += bytesRead; if (total > maxReportBytes) return reportValidationFailure('SIZE_LIMIT');
      parts.push(part.subarray(0, bytesRead));
    }
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(parts)); }
    catch { return reportValidationFailure('INVALID_UTF8'); }
    return validateAssessmentReportText(text);
  } catch { throw new ReportInputError(); }
  finally { if (handle) await handle.close(); }
}
