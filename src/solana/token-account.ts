import { createHash } from 'node:crypto';
import { encodePublicKey, LEGACY_TOKEN_PROGRAM } from './public-key.js';

type Authority = { state: 'NONE_IN_ACCOUNT' } | { state: 'PRESENT'; address: string };
export function decodeLegacyTokenAccount(data: Buffer) {
  if (data.length !== 165) throw new Error('UNREVIEWED_TOKEN_ACCOUNT_LAYOUT');
  const option = (offset: number) => {
    const tag = data.readUInt32LE(offset);
    if (tag !== 0 && tag !== 1) throw new Error('MALFORMED_TOKEN_ACCOUNT');
    return tag;
  };
  const authority = (offset: number): Authority => option(offset) === 0 ? { state: 'NONE_IN_ACCOUNT' }
    : { state: 'PRESENT', address: encodePublicKey(data.subarray(offset + 4, offset + 36)) };
  const state = data[108];
  if (state !== 0 && state !== 1 && state !== 2) throw new Error('MALFORMED_TOKEN_ACCOUNT');
  return { mint: encodePublicKey(data.subarray(0, 32)), ownerAuthority: encodePublicKey(data.subarray(32, 64)),
    amountRaw: data.readBigUInt64LE(64).toString(), delegate: authority(72),
    accountState: state === 0 ? 'UNINITIALIZED' as const : state === 1 ? 'INITIALIZED' as const : 'FROZEN' as const,
    nativeReserve: option(109) === 0 ? { state: 'NONE_IN_ACCOUNT' as const }
      : { state: 'PRESENT' as const, amountRaw: data.readBigUInt64LE(113).toString() },
    delegatedAmountRaw: data.readBigUInt64LE(121).toString(), closeAuthority: authority(129) };
}
export interface TokenAccountObservation {
  address: string; status: 'OBSERVED' | 'INCONCLUSIVE'; reason?: string;
  programOwner?: string; dataBase64?: string; dataSha256?: string;
  tokenState?: ReturnType<typeof decodeLegacyTokenAccount>;
}
export function observeTokenAccount(account: unknown, address: string, mint: string, mintValid: boolean): TokenAccountObservation {
  const base: TokenAccountObservation = { address, status: 'INCONCLUSIVE' };
  const bad = (reason: string) => ({ ...base, reason });
  if (!mintValid) return bad('MINT_NOT_VALIDATED');
  if (account === null) return bad('NULL_ACCOUNT_AT_RESPONSE_CONTEXT');
  if (!account || typeof account !== 'object' || Array.isArray(account)) return bad('MALFORMED_ACCOUNT');
  const a = account as Record<string, unknown>;
  if (a.owner !== LEGACY_TOKEN_PROGRAM) return bad('UNREVIEWED_PROGRAM_OWNER');
  base.programOwner = LEGACY_TOKEN_PROGRAM;
  if (a.executable !== false) return bad('EXECUTABLE_OR_MALFORMED_ACCOUNT');
  if (!Array.isArray(a.data) || a.data.length !== 2 || a.data[1] !== 'base64' || typeof a.data[0] !== 'string'
    || a.data[0].length !== 220 || !/^[A-Za-z0-9+/]+$/.test(a.data[0])
    || (Object.hasOwn(a, 'space') && a.space !== 165)) return bad('UNREVIEWED_TOKEN_ACCOUNT_LAYOUT');
  const data = Buffer.from(a.data[0], 'base64');
  if (data.length !== 165 || data.toString('base64') !== a.data[0]) return bad('UNREVIEWED_TOKEN_ACCOUNT_LAYOUT');
  base.dataBase64 = data.toString('base64');base.dataSha256 = createHash('sha256').update(data).digest('hex');
  try {
    const state = decodeLegacyTokenAccount(data);
    if (state.mint !== mint) return bad('TOKEN_ACCOUNT_MINT_MISMATCH');
    if (state.accountState === 'UNINITIALIZED') return bad('UNINITIALIZED_TOKEN_ACCOUNT');
    if (state.nativeReserve.state === 'PRESENT') return bad('UNEXPECTED_NATIVE_TOKEN_ACCOUNT');
    return { ...base, status: 'OBSERVED', tokenState: state };
  } catch { return bad('MALFORMED_TOKEN_ACCOUNT'); }
}
