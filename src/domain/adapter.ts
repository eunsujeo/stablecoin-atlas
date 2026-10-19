import type { AssessmentReport, AssetIdentity } from './model.js';

// Chain-specific addresses and execution semantics are interpreted by the adapter.
export interface ReadOnlyAssessmentRequest {
  networkId: string;
  assetAddress: string;
  accountAddress?: string;
}
export interface ReadOnlyAdapter {
  readonly chainFamily: AssetIdentity['chainFamily'];
  assessReadOnly(request: ReadOnlyAssessmentRequest): Promise<AssessmentReport>;
}
