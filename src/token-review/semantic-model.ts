import type { SourceLocation } from './model.js';

export interface StateReference { id: number; name: string; type: string; location: SourceLocation }
export interface ConditionObservation {
  context: number; kind: 'REQUIRE' | 'ASSERT' | 'BRANCH'; expression: string; location: SourceLocation; stateReferences: StateReference[];
  callerEqualityState: StateReference | null;
}
export interface StorageWrite {
  context: number; operation: string; expression: string; location: SourceLocation; variable: StateReference;
}
export interface CallEdge {
  from: number; to: number | null; expression: string; location: SourceLocation;
  kind: 'MODIFIER' | 'INTERNAL_DECLARATION' | 'VIRTUAL_DECLARATION' | 'EXTERNAL' | 'UNRESOLVED';
  targetLocation: SourceLocation | null;
}
export interface BehaviorSite {
  pattern: 'FALSE_RETURN' | 'NESTED_MAPPING_ZERO_CONDITION' | 'ADDRESS_CONDITION' | 'MULTIPLY_DIVIDE_EXPRESSION' | 'EXTERNAL_CALL' | 'ASSEMBLY' | 'NON_TRANSFER_MAPPING_WRITE';
  expression: string; location: SourceLocation; context: number;
}
export interface EntryAnalysis {
  id: number; name: string; selector: string | null; location: SourceLocation;
  declarations: { id: number; name: string; location: SourceLocation }[];
  conditions: ConditionObservation[]; writes: StorageWrite[]; calls: CallEdge[]; behaviors: BehaviorSite[];
  uncertainties: string[]; authorityConclusion: 'UNKNOWN'; evidenceRef: string;
}
export interface StaticAnalysis {
  schemaVersion: 'SourceStaticAnalysis1.0';
  entries: EntryAnalysis[];
  stateVariables: StateReference[];
  coverage: { entryLimitReached: boolean; stateVariableLimitReached: boolean; semantics: 'NOT_PROVEN'; scope: 'SELECTED_CONTRACT_EXPLICIT_FUNCTIONS' };
  limitations: string[];
}
