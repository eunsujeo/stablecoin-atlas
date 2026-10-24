import type { Evidence } from '../domain/model.js';
import type { ProxyObservation } from '../evm/proxy.js';
import type { StaticAnalysis } from './semantic-model.js';
import type { RuntimeComparison } from './runtime-comparison.js';
import type { AuditSourceComparison } from './audit-comparison.js';

export type Confirmation = 'CONFIRMED' | 'NOT_FOUND_IN_SCOPE' | 'UNKNOWN' | 'NOT_APPLICABLE';
export type Category = 'INTENDED_ADMIN_FUNCTION' | 'NONSTANDARD_BEHAVIOR' | 'VULNERABILITY_CANDIDATE' | 'CURRENT_STATE';
export interface ReviewConfig {
  schemaVersion: 'TokenReviewConfig1.0' | 'TokenReviewConfig1.1';
  network: { chainId: string; blockNumber?: string };
  token: { address: string; label?: string };
  dependencies?: string[];
  sources?: { address: string; contract: string; compilerVersion: string; inputFile: string; immutableValues?: Record<string, string> }[];
  audits?: { file: string; title?: string; publisher?: string; reference?: string;
    declaredTarget?: { version?: string; commit?: string; scope?: string[] }; sourceSnapshotFile?: string; compareToAddress?: string }[];
  probes?: { id: string; address: string; signature: string; args: (string | boolean)[] }[];
}
export interface Finding {
  id: string; rule: string; scope: 'SOURCE' | 'CHAIN' | 'AUDIT' | 'COVERAGE';
  categories: Category[]; confirmation: Confirmation; summary: string; evidenceRefs: string[];
}
export interface Artifact {
  path: string; sha256: string; bytes: number; kind: string;
}
export interface SourceReview {
  address: string; contract: string; inputEvidence: string;
  compilation: 'SUCCEEDED' | 'FAILED' | 'NOT_RUN';
  compilerRequested: string; compilerUsed: string;
  binding: { confirmation: Confirmation; reason: string; runtimeHash?: string; observedRuntimeHash?: string };
  functions: FunctionReview[];
  staticAnalysis?: StaticAnalysis | null;
  runtimeComparison?: RuntimeComparison | null;
}
export interface SourceLocation { file: string; line: number; endLine: number; start: number; length: number }
export interface FunctionReview {
  name: string; contract: string; visibility: string; mutability: string;
  selector: string | null; parameters: string; returnParameters: string; inherited: boolean;
  location: SourceLocation; implemented: boolean; evidenceRef: string;
  modifiers: { name: string; declaration: SourceLocation | null; text: string; evidenceRef: string | null }[];
  calls: { expression: string; declaration: SourceLocation | null }[];
  conditions: string[]; writes: string[]; returns: string[]; assembly: boolean;
}
export interface ReviewReport {
  schemaVersion: 'TokenTechnicalReview1.0' | 'TokenTechnicalReview1.1';
  mode?: 'OFFLINE' | 'READ_ONLY';
  startedAt: string; finishedAt: string;
  execution: 'COMPLETED' | 'PARTIAL';
  config: Omit<ReviewConfig, 'sources' | 'audits'>;
  tools: { analyzer: string; rules: string; compiler: string; ai: 'NOT_RUN'; slither: 'NOT_RUN' };
  block: { number: string | null; hash: string | null; consistency: 'UNKNOWN' | 'HASH_PINNED_RECHECKED' };
  contracts: { address: string; runtimeHash: string; evidenceRef: string }[];
  proxy: ProxyObservation | null;
  sources: SourceReview[];
  audits: { evidenceRef: string; title: string; publisher: string; reference: string | null;
    declaredTarget: NonNullable<ReviewConfig['audits']>[number]['declaredTarget'] | null; authenticity: 'UNKNOWN'; deploymentMapping: 'UNKNOWN';
    sourceComparison?: AuditSourceComparison | null }[];
  findings: Finding[];
  failures: { stage: string; code: string; evidenceRefs: string[] }[];
  evidence: Evidence[];
  artifacts: Artifact[];
  limitations: string[];
}
