import { createHash } from 'node:crypto';
import { ResearchReadError, type ResearchFailure } from '../research/bounded-json-http.js';
const alphabet = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
// Classic addresses only; no destination tags, X-addresses, seeds or private keys.
export function isClassicAddress(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 25 || value.length > 35 || value[0] !== 'r') return false;
  let n = 0n, zeros = 0;
  for (const c of value) { const digit = alphabet.indexOf(c); if (digit < 0) return false; n = n * 58n + BigInt(digit); }
  for (const c of value) { if (c !== alphabet[0]) break; zeros++; }
  const hex = n.toString(16), bytes = Buffer.concat([Buffer.alloc(zeros), n === 0n ? Buffer.alloc(0) : Buffer.from(hex.padStart(Math.ceil(hex.length / 2) * 2, '0'), 'hex')]);
  if (bytes.length !== 25 || bytes[0] !== 0) return false;
  const checksum = createHash('sha256').update(createHash('sha256').update(bytes.subarray(0, 21)).digest()).digest().subarray(0, 4);
  let encoded = '', raw = BigInt('0x' + bytes.toString('hex'));
  while (raw > 0n) { encoded = alphabet[Number(raw % 58n)]! + encoded; raw /= 58n; }
  let leading = 0;for (const b of bytes) { if (b !== 0) break;leading++; }
  return checksum.equals(bytes.subarray(21)) && alphabet[0]!.repeat(leading) + encoded === value;
}
// Preserve the provider's exact string; grammar check only, not STAmount range/precision certification.
export function isXrplAmountString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 100 && /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]{1,2})?$/.test(value);
}
const flagNames = ['authorized', 'peer_authorized', 'freeze', 'freeze_peer', 'no_ripple', 'no_ripple_peer', 'deep_freeze', 'deep_freeze_peer'] as const;
type Flag = { state: 'NOT_PRESENT' } | { state: 'PRESENT'; value: boolean };
export interface TrustLineObservation {
  holder: string; issuer: string; currency: string; status: 'OBSERVED' | 'INCONCLUSIVE';
  lineState: 'PRESENT' | 'NOT_PRESENT' | 'UNKNOWN'; pagesRead: number; complete: boolean;
  reason?: string; failure?: ResearchFailure;
  line?: { balanceValue: string; holderLimitValue: string; issuerLimitValue: string; flags: Record<typeof flagNames[number], Flag> };
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export async function observeTrustLines(
  request: (params: Record<string, unknown>) => Promise<Record<string, unknown>>,
  holder: string, issuer: string, currency: string, ledgerHash: string, ledgerIndex: string,
): Promise<TrustLineObservation> {
  const base: TrustLineObservation = { holder, issuer, currency, status: 'INCONCLUSIVE', lineState: 'UNKNOWN', pagesRead: 0, complete: false };
  const bad = (reason: string): TrustLineObservation => ({ ...base, reason });
  let marker: string | undefined, selected: TrustLineObservation['line'];
  const markers = new Set<string>(), currencies = new Set<string>();
  try {
    for (let page = 0; page < 3; page++) {
      base.pagesRead++;
      const result = await request({ account: holder, peer: issuer, ledger_hash: ledgerHash, limit: 20, ignore_default: false,
        ...(marker !== undefined ? { marker } : {}) });
      if (result.account !== holder || result.validated !== true || typeof result.ledger_hash !== 'string'
        || result.ledger_hash.toUpperCase() !== ledgerHash || String(result.ledger_index) !== ledgerIndex
        || !Array.isArray(result.lines) || result.lines.length > 20) return bad('TRUST_LINE_CONTEXT_MISMATCH');
      for (const item of result.lines) {
        if (!object(item) || item.account !== issuer || typeof item.currency !== 'string'
          || !/^([\x21-\x7E]{3}|[A-Fa-f0-9]{40})$/.test(item.currency)) return bad('MALFORMED_TRUST_LINE');
        const code = item.currency.length === 40 ? item.currency.toUpperCase() : item.currency;
        if (currencies.has(code)) return bad('DUPLICATE_TRUST_LINE');
        currencies.add(code);
        if (!isXrplAmountString(item.balance) || !isXrplAmountString(item.limit) || !isXrplAmountString(item.limit_peer)
          || item.limit.startsWith('-') || item.limit_peer.startsWith('-')) return bad('MALFORMED_TRUST_LINE_AMOUNT');
        const flags = {} as NonNullable<TrustLineObservation['line']>['flags'];
        for (const name of flagNames) {
          if (Object.hasOwn(item, name) && typeof item[name] !== 'boolean') return bad('MALFORMED_TRUST_LINE_FLAG');
          flags[name] = Object.hasOwn(item, name) ? { state: 'PRESENT', value: item[name] as boolean } : { state: 'NOT_PRESENT' };
        }
        if (code === currency) selected = { balanceValue: item.balance, holderLimitValue: item.limit, issuerLimitValue: item.limit_peer, flags };
      }
      if (!Object.hasOwn(result, 'marker')) return { ...base, status: 'OBSERVED', complete: true,
        lineState: selected ? 'PRESENT' : 'NOT_PRESENT', ...(selected ? { line: selected } : {}) };
      if (typeof result.marker !== 'string' || result.marker.length === 0 || result.marker.length > 512) return bad('UNREVIEWED_PAGINATION_MARKER');
      if (markers.has(result.marker)) return bad('REPEATED_PAGINATION_MARKER');
      markers.add(result.marker);marker = result.marker;
    }
    return bad('PAGINATION_LIMIT');
  } catch (error) {
    return { ...bad('READ_FAILED'), failure: error instanceof ResearchReadError ? error.detail : { category: 'TRANSPORT_OR_PROTOCOL_ERROR' } };
  }
}
