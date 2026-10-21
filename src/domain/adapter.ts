import type { AssessmentReport, AssetIdentity } from './model.js';

// Chain-specific addresses and execution semantics are interpreted by the adapter.
export interface ReadOnlyAssessmentRequest {
  networkId: string;
  assetAddress: string;
  // XRPL only: assetAddress is issuer; the pair selects the issued currency.
  currencyCode?: string;
  // Solana: explicit Token Account, XRPL: classic holder; each adapter validates its meaning.
  accountAddress?: string;
}
export interface ReadOnlyAdapter {
  readonly chainFamily: AssetIdentity['chainFamily'];
  assessReadOnly(request: ReadOnlyAssessmentRequest): Promise<AssessmentReport>;
}
