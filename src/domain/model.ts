export type Knowledge<T> = { status: 'KNOWN'; value: T } | { status: 'UNKNOWN' | 'NOT_APPLICABLE'; reason: string };
export const known = <T>(value: T): Knowledge<T> => ({ status: 'KNOWN', value });
export const unknown = (reason: string): Knowledge<never> => ({ status: 'UNKNOWN', reason });
export const na = (reason: string): Knowledge<never> => ({ status: 'NOT_APPLICABLE', reason });
export interface AssetIdentity {
  chainFamily: 'EVM' | 'TRON' | 'SOLANA'; networkId: string;
  assetStandard: Knowledge<string>; contractAddress: Knowledge<string>;
  mintAddress: Knowledge<string>; tokenProgramId: Knowledge<string>;
  symbol: Knowledge<string>; name: Knowledge<string>; decimals: Knowledge<number>;
  issuer: Knowledge<string>; issuerVerificationStatus: 'UNKNOWN' | 'VERIFIED' | 'UNVERIFIED';
  nativeOrBridged: Knowledge<'NATIVE' | 'BRIDGED'>; implementationAddress: Knowledge<string>;
  observedBlockOrSlot: string; observedAt: string;
}
export const capabilities = [
  'IDENTITY', 'TRANSFER', 'BALANCE', 'ALLOWANCE', 'DELEGATION', 'MINT', 'BURN',
  'FREEZE', 'UNFREEZE', 'BLACKLIST', 'PAUSE', 'CLAWBACK', 'AUTHORITY_CHANGE',
  'UPGRADEABILITY', 'TRANSFER_FEE', 'DECIMAL_HANDLING', 'EVENT_TRACKING',
  'SUPPLY_TRACKING', 'ACCOUNT_INITIALIZATION', 'FINALITY', 'RESOURCE_CONSUMPTION', 'SWEEP_COMPATIBILITY',
] as const;
export type Capability = typeof capabilities[number];
export type Support = 'SUPPORTED' | 'NOT_SUPPORTED' | 'UNKNOWN';
export type Verdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'UNSUPPORTED' | 'NOT_TESTED' | 'NOT_APPLICABLE';
export interface Evidence {
  id: string; provenance: 'DOCUMENTED' | 'OBSERVED' | 'INFERRED';
  observedAt: string; observedBlockOrSlot: string; kind: string; data: unknown;
}
export interface ScenarioResult {
  assessmentId: string; assetIdentity: AssetIdentity; scenarioId: string; scenarioVersion: string;
  capability: Capability; support: Support;
  executionStatus: 'COMPLETED' | 'ERROR' | 'NOT_EXECUTED'; verdict: Verdict;
  evidenceReferences: string[]; observedBlockOrSlot: string;
  startedAt: string; completedAt: string; limitations: string[];
  observations: Record<string, unknown>;
}
export type Profile = 'baseline' | 'exact-receipt';
export interface AssessmentReport {
  schemaVersion: '1.0'; assessmentId: string; mode: 'READ_ONLY' | 'SIMULATION'; profile: Profile;
  assetIdentity: AssetIdentity; results: ScenarioResult[]; evidence: Evidence[];
  capabilitySummary: { capability: Capability; support: Support; verdicts: Verdict[] }[];
  startedAt: string; completedAt: string; limitations: string[];
}
export interface ScenarioOutcome {
  verdict: Verdict; support: Support; observations: Record<string, unknown>; limitations?: string[];
}
