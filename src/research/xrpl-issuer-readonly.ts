import { isClassicAddress, observeTrustLines, type TrustLineObservation } from '../xrpl/trust-lines.js';
import { postResearchJson, ResearchReadError, type ResearchFailure } from './bounded-json-http.js';

export const XRPL_STABLECOIN_ISSUERS = [
  { profileId: 'xrpl-usdc', currency: '5553444300000000000000000000000000000000', issuer: 'rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE' },
  { profileId: 'xrpl-rlusd', currency: '524C555344000000000000000000000000000000', issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De' },
] as const;
// AccountRoot lsf bits, NOT AccountSet asf flag numbers. Source pin: ADR0028.
export const ISSUER_FLAG_MASKS = {
  requireAuth: 0x00040000n, disableMaster: 0x00100000n, noFreeze: 0x00200000n,
  globalFreeze: 0x00400000n, defaultRipple: 0x00800000n, allowTrustLineClawback: 0x80000000n,
} as const;
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function uint32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}
export function decodeIssuerFlags(value: unknown) {
  if (!uint32(value)) throw new Error('INVALID_FLAGS');
  const raw = BigInt(value); let interpreted = 0n;
  const bits = {} as Record<keyof typeof ISSUER_FLAG_MASKS, boolean>;
  for (const [key, mask] of Object.entries(ISSUER_FLAG_MASKS)) {
    bits[key as keyof typeof ISSUER_FLAG_MASKS] = (raw & mask) !== 0n; interpreted |= mask;
  }
  return { flagsRaw: raw.toString(), bits, uninterpretedFlagBits: (raw & (0xffffffffn ^ interpreted)).toString() };
}
function hash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-fA-F]{64}$/.test(value) && !/^0{64}$/.test(value);
}
function ledgerIndex(value: unknown): string | undefined {
  if (uint32(value) && value > 0) return value.toString();
  if (typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value) && BigInt(value) <= 0xffffffffn) return value;
  return undefined;
}
type Method = 'server_info' | 'ledger' | 'account_info' | 'account_lines';
async function rpc(url: string, method: Method, params: Record<string, unknown>) {
  const body = await postResearchJson(url, { method, params: [{ api_version: 2, ...params }] });
  if (!object(body) || Object.hasOwn(body, 'error') || !object(body.result)) {
    throw new ResearchReadError({ category: 'TRANSPORT_OR_PROTOCOL_ERROR' });
  }
  const result = body.result;
  if (result.status === 'error' || Object.hasOwn(result, 'error')) {
    throw new ResearchReadError({ category: 'RPC_ERROR', ...(Number.isSafeInteger(result.error_code) ? { rpcCode: result.error_code as number } : {}) });
  }
  if (result.status !== 'success') throw new ResearchReadError({ category: 'TRANSPORT_OR_PROTOCOL_ERROR' });
  return result;
}
type IssuerObservation = {
  profileId: string; issuer: string; currency: string; status: 'OBSERVED' | 'INCONCLUSIVE'; reason?: string;
  ledgerHash?: string; ledgerIndex?: string; accountRoot?: {
    Account: string; LedgerEntryType: 'AccountRoot'; flags: ReturnType<typeof decodeIssuerFlags>;
    transferRate: { state: 'NOT_PRESENT' } | { state: 'PRESENT'; raw: string };
  }; failure?: ResearchFailure;
};
async function observeIssuers(url: string, profiles: readonly typeof XRPL_STABLECOIN_ISSUERS[number][], holder?: string) {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('INVALID_RPC_CONFIGURATION'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('INVALID_RPC_CONFIGURATION');
  const report = {
    observedAt: new Date().toISOString(),
    networkBinding: 'UNKNOWN', expectedNetworkId: '0', ledgerHash: 'UNKNOWN', ledgerIndex: 'UNKNOWN',
    ledgerValidation: 'UNKNOWN', status: 'INCONCLUSIVE', requestCount: 0,
    observations: profiles.map(p => ({ ...p, status: 'INCONCLUSIVE', reason: 'NOT_OBSERVED' } as IssuerObservation)),
    trustLine: holder === undefined ? undefined : { holder, issuer: profiles[0]!.issuer, currency: profiles[0]!.currency, status: 'INCONCLUSIVE', lineState: 'UNKNOWN', complete: false, pagesRead: 0, reason: 'NOT_OBSERVED' } as TrustLineObservation,
    requests: [] as { method: Method; status: 'OBSERVED' | 'ERROR' }[], failure: undefined as ResearchFailure | undefined,
  };
  const request = async (method: Method, params: Record<string, unknown>) => {
    report.requestCount++;
    try { const result = await rpc(url, method, params); report.requests.push({ method, status: 'OBSERVED' }); return result; }
    catch (error) { report.requests.push({ method, status: 'ERROR' }); throw error; }
  };
  try {
    const server = await request('server_info', {});
    if (!object(server.info) || server.info.network_id !== 0) {
      report.networkBinding = object(server.info) && uint32(server.info.network_id) ? 'MISMATCH' : 'INVALID_OR_MISSING_NETWORK_ID';
      return report;
    }
    report.networkBinding = 'MATCHED_SERVER_REPORTED_MAINNET_ID';
    const ledger = await request('ledger', { ledger_index: 'validated', transactions: false, expand: false });
    const index = ledgerIndex(ledger.ledger_index);
    if (ledger.validated !== true || !hash(ledger.ledger_hash) || !index || !object(ledger.ledger) || ledger.ledger.closed !== true
      || (Object.hasOwn(ledger.ledger, 'ledger_hash') && (!hash(ledger.ledger.ledger_hash) || ledger.ledger.ledger_hash.toUpperCase() !== ledger.ledger_hash.toUpperCase()))
      || (Object.hasOwn(ledger.ledger, 'ledger_index') && ledgerIndex(ledger.ledger.ledger_index) !== index)) {
      throw new ResearchReadError({ category: 'TRANSPORT_OR_PROTOCOL_ERROR' });
    }
    report.ledgerHash = ledger.ledger_hash.toUpperCase(); report.ledgerIndex = index;
    report.ledgerValidation = 'RPC_REPORTED_VALIDATED';
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i]!;
      try {
        const result = await request('account_info', { account: profile.issuer, ledger_hash: report.ledgerHash, strict: true });
        const a = result.account_data;
        if (result.validated !== true || !hash(result.ledger_hash) || result.ledger_hash.toUpperCase() !== report.ledgerHash
          || ledgerIndex(result.ledger_index) !== report.ledgerIndex || !object(a) || a.Account !== profile.issuer
          || a.LedgerEntryType !== 'AccountRoot' || !uint32(a.Flags)
          || (Object.hasOwn(a, 'TransferRate') && !uint32(a.TransferRate))) {
          report.observations[i] = { ...profile, status: 'INCONCLUSIVE', reason: 'ACCOUNT_OR_LEDGER_RESPONSE_MISMATCH' }; continue;
        }
        report.observations[i] = { ...profile, status: 'OBSERVED', ledgerHash: report.ledgerHash, ledgerIndex: report.ledgerIndex,
          accountRoot: { Account: profile.issuer, LedgerEntryType: 'AccountRoot', flags: decodeIssuerFlags(a.Flags),
            transferRate: Object.hasOwn(a, 'TransferRate') ? { state: 'PRESENT', raw: String(a.TransferRate) } : { state: 'NOT_PRESENT' } } };
      } catch (error) {
        report.observations[i] = { ...profile, status: 'INCONCLUSIVE', reason: 'READ_FAILED',
          failure: error instanceof ResearchReadError ? error.detail : { category: 'TRANSPORT_OR_PROTOCOL_ERROR' } };
        // Stop on transport/HTTP failures, including proxy denials. Never switch endpoints or retry.
        if (!(error instanceof ResearchReadError) || error.detail.category !== 'RPC_ERROR') break;
      }
    }
    if (holder !== undefined && report.observations[0]!.status === 'OBSERVED') report.trustLine = await observeTrustLines(
      params => request('account_lines', params), holder, profiles[0]!.issuer, profiles[0]!.currency, report.ledgerHash, report.ledgerIndex);
    if (report.observations.every(o => o.status === 'OBSERVED') && (!report.trustLine || report.trustLine.status === 'OBSERVED')) report.status = 'OBSERVED';
  } catch (error) {
    report.failure = error instanceof ResearchReadError ? error.detail : { category: 'TRANSPORT_OR_PROTOCOL_ERROR' };
  }
  return report;
}

export async function observeXrplIssuer(url: string, issuer: string, currency: string | undefined, holder?: string) {
  const profile = XRPL_STABLECOIN_ISSUERS.find(p => p.issuer === issuer && p.currency === currency);
  if (!profile) throw new Error('Unsupported XRPL currency and issuer pair.');
  if (holder !== undefined && (!isClassicAddress(holder) || holder === issuer)) throw new Error('Invalid XRPL holder address.');
  return observeIssuers(url, [profile], holder);
}
export async function readStablecoinIssuers(url: string) {
  return { schemaVersion: '1.0', kind: 'XRPL_ISSUER_RESEARCH_NOT_ASSESSMENT',
    ...await observeIssuers(url, XRPL_STABLECOIN_ISSUERS), productAdapter: 'AVAILABLE_SEPARATELY_ISSUER_ONLY',
    actualAuthorityExercise: 'NOT_TESTED', trustLineAndPaymentExecution: 'NOT_TESTED', amendmentActivation: 'UNKNOWN', issuerAuthentication: 'UNKNOWN' };
}
