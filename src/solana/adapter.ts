import { randomUUID } from 'node:crypto';
import type { ReadOnlyAdapter, ReadOnlyAssessmentRequest } from '../domain/adapter.js';
import { known, na, unknown, type AssetIdentity, type AssessmentReport, type Capability, type Evidence, type ScenarioResult } from '../domain/model.js';
import { summarize } from '../domain/evaluator.js';
import { observeSolanaMint, SOLANA_MAINNET_GENESIS, SOLANA_STABLECOIN_MINTS } from '../research/solana-mint-readonly.js';

const limits = [
  'Selected mint and optional explicit Token Account at one finalized RPC context; no transaction, signature or actual authority exercise.',
  'RPC-reported genesis and context slot are not independent network/finality proof or account last-modification slot.',
  'Observed mint layout/authority fields do not establish transfer conformance, issuer, origin, key control or asset approval.',
];
export const solanaDeferred: readonly [string, Capability][] = [
  ['SOLANA-005', 'TRANSFER'], ['SOLANA-006', 'BALANCE'], ['SOLANA-007', 'DELEGATION'],
  ['SOLANA-008', 'MINT'], ['SOLANA-009', 'BURN'], ['SOLANA-010', 'FREEZE'],
  ['SOLANA-011', 'UNFREEZE'], ['SOLANA-012', 'AUTHORITY_CHANGE'],
  ['SOLANA-013', 'UPGRADEABILITY'], ['SOLANA-014', 'TRANSFER_FEE'],
  ['SOLANA-015', 'FINALITY'], ['SOLANA-016', 'RESOURCE_CONSUMPTION'],
];
export class SolanaReadOnlyAdapter implements ReadOnlyAdapter {
  readonly chainFamily = 'SOLANA' as const;
  constructor(private readonly rpcUrl: string) {}
  async assessReadOnly(request: ReadOnlyAssessmentRequest): Promise<AssessmentReport> {
    if (request.currencyCode !== undefined) throw new Error('Currency code requires XRPL.');
    if (request.networkId !== SOLANA_MAINNET_GENESIS) throw new Error('Invalid Solana network reference.');
    if (!SOLANA_STABLECOIN_MINTS.some(p => p.mint === request.assetAddress)) throw new Error('Solana mint is outside the supported read-only set.');
    const startedAt = new Date().toISOString(), assessmentId = randomUUID();
    const observation = await observeSolanaMint(this.rpcUrl, request.assetAddress, request.accountAddress);
    const account = observation.observations[0]!;
    const valid = account.status === 'OBSERVED' && account.mintState !== undefined;
    const slot = observation.responseContextSlot;
    const identity: AssetIdentity = { chainFamily: 'SOLANA', networkId: request.networkId,
      assetStandard: unknown('Mint layout is observed separately; token behavior conformance is not tested'),
      contractAddress: na('Solana mint account, not an EVM/TVM token contract'),
      mintAddress: valid ? known(account.mint) : unknown('Requested candidate was not validated as an initialized legacy mint'),
      tokenProgramId: valid ? known(account.programOwner!) : unknown('Validated mint token program not established'),
      name: unknown('Mint account contains no validated name'), symbol: unknown('Mint account contains no validated symbol'),
      decimals: valid ? known(account.mintState!.decimals) : unknown('Validated mint decimals not available'),
      issuer: unknown('No issuer authentication'), issuerVerificationStatus: 'UNKNOWN',
      nativeOrBridged: unknown('Mint data does not authenticate origin'),
      implementationAddress: na('EVM implementation address does not apply to this mint account'),
      observedBlockOrSlot: slot, observedAt: new Date().toISOString() };
    const evidence: Evidence[] = [];
    const record = (kind: string, data: unknown, atSlot = slot): string => {
      const id = `e${evidence.length + 1}`;
      evidence.push({ id, provenance: 'OBSERVED', kind, data, observedAt: identity.observedAt, observedBlockOrSlot: atSlot }); return id;
    };
    const networkRef = record('SOLANA_RPC_NETWORK_COMPARISON', { expectedGenesisHash: SOLANA_MAINNET_GENESIS,
      comparison: observation.genesisBinding, requests: observation.requests,
      ...(observation.failure ? { failure: observation.failure } : {}) }, 'UNKNOWN');
    const accountRequested = observation.requests.some(r => r.method === 'getMultipleAccounts');
    const refs = [networkRef];
    if (accountRequested) refs.push(record('SOLANA_MINT_READ_RESULT', { requestedMint: request.assetAddress,
      commitment: observation.requestedCommitment, responseContextSlot: slot, snapshotMeaning: observation.snapshotMeaning,
      account, ...(observation.failure ? { failure: observation.failure } : {}) }));
    const token = observation.tokenAccount;
    const tokenRefs = accountRequested && token ? [...refs, record('SOLANA_TOKEN_ACCOUNT_READ_RESULT', { commitment: observation.requestedCommitment, responseContextSlot: slot, tokenAccount: token })] : [];
    const results: ScenarioResult[] = [];
    const add = (id: string, capability: Capability, observations: Record<string, unknown>, executionStatus: ScenarioResult['executionStatus'],
      verdict: ScenarioResult['verdict'], evidenceReferences: string[]) => {
      results.push({ assessmentId, assetIdentity: identity, scenarioId: id, scenarioVersion: '1.0.0', capability,
        support: 'UNKNOWN', executionStatus, verdict, observations, evidenceReferences, observedBlockOrSlot: slot,
        startedAt, completedAt: new Date().toISOString(), limitations: [...limits] });
    };
    const error = observation.failure !== undefined || ['MALFORMED_ACCOUNT', 'MALFORMED_MINT'].includes(account.reason ?? '');
    add('SOLANA-001', 'IDENTITY', { requestedMint: request.assetAddress, genesisBinding: observation.genesisBinding,
      mintReadStatus: account.status, ...(account.reason ? { reason: account.reason } : {}) }, error ? 'ERROR' : 'COMPLETED', 'INCONCLUSIVE', refs);
    for (const [id, capability, data] of [
      ['SOLANA-002', 'DECIMAL_HANDLING', valid ? { decimals: account.mintState!.decimals } : {}],
      ['SOLANA-003', 'SUPPLY_TRACKING', valid ? { supplyRaw: account.mintState!.supplyRaw } : {}],
      ['SOLANA-004', 'ACCOUNT_INITIALIZATION', valid ? { initialized: true, mintAuthority: account.mintState!.mintAuthority,
        freezeAuthority: account.mintState!.freezeAuthority } : {}],
    ] as [string, Capability, Record<string, unknown>][]) {
      add(id, capability, { ...data, ...(account.reason ? { readReason: account.reason } : {}) },
        !accountRequested ? 'NOT_EXECUTED' : error ? 'ERROR' : 'COMPLETED', !accountRequested ? 'NOT_TESTED' : 'INCONCLUSIVE', accountRequested ? refs : []);
    }
    for (const [id, capability] of solanaDeferred) {
      if (token && (capability === 'BALANCE' || capability === 'DELEGATION')) {
        const state = token.tokenState;
        add(id, capability, { tokenAccountAddress: token.address, readStatus: token.status,
          ...(token.reason ? { readReason: token.reason } : {}),
          ...(state ? { balance: state.amountRaw, ownerAuthority: state.ownerAuthority, accountState: state.accountState,
            delegate: state.delegate, delegatedAmountRaw: state.delegatedAmountRaw, closeAuthority: state.closeAuthority } : {}),
          actualAuthorityExercise: 'NOT_TESTED' }, !accountRequested ? 'NOT_EXECUTED' : token.status === 'OBSERVED' ? 'COMPLETED' : 'ERROR',
          accountRequested ? 'INCONCLUSIVE' : 'NOT_TESTED', tokenRefs);
      } else add(id, capability, {}, 'NOT_EXECUTED', 'NOT_TESTED', []);
    }
    add('SOLANA-017', 'ALLOWANCE', { meaning: 'ERC-20 owner/spender allowance does not apply; Token Account delegation is a separate optional settings read; actual exercise is NOT_TESTED.' },
      'COMPLETED', 'NOT_APPLICABLE', []);
    return { schemaVersion: '1.0', assessmentId, mode: 'READ_ONLY', profile: 'baseline', assetIdentity: identity,
      results, evidence, capabilitySummary: summarize({ results }), startedAt, completedAt: new Date().toISOString(), limitations: [...limits] };
  }
}
