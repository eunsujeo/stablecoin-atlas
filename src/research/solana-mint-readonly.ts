import { createHash } from 'node:crypto';
import { encodePublicKey, publicKey, LEGACY_TOKEN_PROGRAM } from '../solana/public-key.js';
export { encodePublicKey, publicKey } from '../solana/public-key.js';
import { observeTokenAccount, type TokenAccountObservation } from '../solana/token-account.js';
import { postResearchJson, ResearchReadError as ReadError, type ResearchFailure as Failure } from './bounded-json-http.js';

export const SOLANA_MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export { LEGACY_TOKEN_PROGRAM } from '../solana/public-key.js';
export const SOLANA_STABLECOIN_MINTS = [
  { profileId: 'solana-usdc', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { profileId: 'solana-usdt', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
] as const;
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
type Authority = { state: 'NONE_IN_MINT' } | { state: 'PRESENT'; address: string };
export function decodeLegacyMint(data: Buffer) {
  if (data.length !== 82) throw new Error('UNREVIEWED_ACCOUNT_LAYOUT');
  const authority = (offset: number): Authority => {
    const tag = data.readUInt32LE(offset);
    if (tag === 0) return { state: 'NONE_IN_MINT' };
    if (tag !== 1) throw new Error('MALFORMED_MINT');
    return { state: 'PRESENT', address: encodePublicKey(data.subarray(offset + 4, offset + 36)) };
  };
  if (data[45] !== 0 && data[45] !== 1) throw new Error('MALFORMED_MINT');
  const mintAuthority = authority(0), freezeAuthority = authority(46);
  return { initialized: data[45] === 1, supplyRaw: data.readBigUInt64LE(36).toString(),
    decimals: data[44]!, mintAuthority, freezeAuthority };
}
type MintObservation = {
  profileId: string; mint: string; status: 'OBSERVED' | 'INCONCLUSIVE'; reason?: string;
  programOwner?: string; dataSha256?: string; dataBase64?: string;
  mintState?: ReturnType<typeof decodeLegacyMint>;
};
function observeAccount(account: unknown, profile: typeof SOLANA_STABLECOIN_MINTS[number]): MintObservation {
  const base: MintObservation = { ...profile, status: 'INCONCLUSIVE' };
  if (account === null) return { ...base, reason: 'NULL_ACCOUNT_AT_RESPONSE_CONTEXT' };
  if (!object(account) || !publicKey(account.owner) || typeof account.executable !== 'boolean') {
    return { ...base, reason: 'MALFORMED_ACCOUNT' };
  }
  base.programOwner = account.owner;
  if (account.owner !== LEGACY_TOKEN_PROGRAM) return { ...base, reason: 'UNREVIEWED_PROGRAM_OWNER' };
  if (account.executable) return { ...base, reason: 'EXECUTABLE_ACCOUNT_NOT_MINT' };
  if (!Array.isArray(account.data) || account.data.length !== 2 || account.data[1] !== 'base64'
    || typeof account.data[0] !== 'string' || account.data[0].length !== 112
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(account.data[0])) return { ...base, reason: 'UNREVIEWED_ACCOUNT_LAYOUT' };
  const data = Buffer.from(account.data[0], 'base64');
  if (data.length !== 82 || data.toString('base64') !== account.data[0]
    || (Object.hasOwn(account, 'space') && account.space !== 82)) return { ...base, reason: 'UNREVIEWED_ACCOUNT_LAYOUT' };
  base.dataSha256 = createHash('sha256').update(data).digest('hex');
  base.dataBase64 = data.toString('base64');
  try {
    const mintState = decodeLegacyMint(data);
    if (!mintState.initialized) return { ...base, reason: 'UNINITIALIZED_MINT' };
    return { ...base, status: 'OBSERVED', mintState };
  } catch { return { ...base, reason: 'MALFORMED_MINT' }; }
}
// Method names and params are fixed by this research reader.
async function readRpc(url: string, id: number, method: 'getGenesisHash' | 'getMultipleAccounts', params: unknown[]) {
  const body = await postResearchJson(url, { jsonrpc: '2.0', id, method, params });
  if (!object(body) || body.jsonrpc !== '2.0' || body.id !== id
    || Object.hasOwn(body, 'result') === Object.hasOwn(body, 'error')) {
    throw new ReadError({ category: 'TRANSPORT_OR_PROTOCOL_ERROR' });
  }
  if (Object.hasOwn(body, 'error')) {
    if (!object(body.error) || !Number.isSafeInteger(body.error.code)) throw new ReadError({ category: 'TRANSPORT_OR_PROTOCOL_ERROR' });
    throw new ReadError({ category: 'RPC_ERROR', rpcCode: body.error.code as number });
  }
  return body.result;
}
async function observeMints(url: string, profiles: readonly typeof SOLANA_STABLECOIN_MINTS[number][], tokenAccountAddress?: string) {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('INVALID_RPC_CONFIGURATION'); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('INVALID_RPC_CONFIGURATION');
  const report = {
    observedAt: new Date().toISOString(),
    requestedCommitment: 'finalized', genesisBinding: 'UNKNOWN', responseContextSlot: 'UNKNOWN',
    snapshotMeaning: 'RPC_CONTEXT_SLOT_NOT_ACCOUNT_LAST_MODIFICATION_SLOT_OR_BLOCK_HASH',
    status: 'INCONCLUSIVE', requestCount: 0,
    expectedGenesisHash: SOLANA_MAINNET_GENESIS,
    observations: profiles.map(p => ({ ...p, status: 'INCONCLUSIVE', reason: 'NOT_OBSERVED' } as MintObservation)),
    requests: [] as { method: string; status: 'OBSERVED' | 'ERROR' }[],
    failure: undefined as Failure | undefined,
    tokenAccount: tokenAccountAddress === undefined ? undefined : { address: tokenAccountAddress, status: 'INCONCLUSIVE', reason: 'NOT_OBSERVED' } as TokenAccountObservation,
  };
  const request = async (id: number, method: 'getGenesisHash' | 'getMultipleAccounts', params: unknown[]) => {
    report.requestCount++;
    try { const result = await readRpc(url, id, method, params); report.requests.push({ method, status: 'OBSERVED' }); return result; }
    catch (error) { report.requests.push({ method, status: 'ERROR' }); throw error; }
  };
  try {
    const genesis = await request(1, 'getGenesisHash', []);
    if (genesis !== SOLANA_MAINNET_GENESIS) {
      report.genesisBinding = typeof genesis === 'string' && publicKey(genesis) ? 'MISMATCH' : 'INVALID_RESPONSE';
      return report;
    }
    report.genesisBinding = 'MATCHED_RPC_REPORTED_GENESIS';
    const result = await request(2, 'getMultipleAccounts', [[...profiles.map(p => p.mint), ...(tokenAccountAddress === undefined ? [] : [tokenAccountAddress])],
      { commitment: 'finalized', encoding: 'base64' }]);
    if (!object(result) || !object(result.context) || !Number.isSafeInteger(result.context.slot)
      || (result.context.slot as number) < 0 || !Array.isArray(result.value) || result.value.length !== profiles.length + (tokenAccountAddress === undefined ? 0 : 1)) {
      throw new ReadError({ category: 'TRANSPORT_OR_PROTOCOL_ERROR' });
    }
    report.responseContextSlot = String(result.context.slot);
    report.observations = profiles.map((p, i) => observeAccount((result.value as unknown[])[i], p));
    if (tokenAccountAddress !== undefined) report.tokenAccount = observeTokenAccount(result.value[profiles.length], tokenAccountAddress, profiles[0]!.mint, report.observations[0]!.status === 'OBSERVED');
    if (report.observations.every(o => o.status === 'OBSERVED') && (!report.tokenAccount || report.tokenAccount.status === 'OBSERVED')) report.status = 'OBSERVED';
  } catch (error) {
    report.failure = error instanceof ReadError ? error.detail : { category: 'TRANSPORT_OR_PROTOCOL_ERROR' };
  }
  return report;
}

// Shared observation core; no Assessment verdict or research metadata is manufactured here.
export async function observeSolanaMint(url: string, mint: string, tokenAccountAddress?: string) {
  const profile = SOLANA_STABLECOIN_MINTS.find(p => p.mint === mint);
  if (!profile) throw new Error('Solana mint is outside the supported read-only set.');
  if (tokenAccountAddress !== undefined && (!publicKey(tokenAccountAddress) || tokenAccountAddress === mint)) throw new Error('Invalid Solana token account address.');
  return observeMints(url, [profile], tokenAccountAddress);
}
export async function readStablecoinMints(url: string) {
  return { schemaVersion: '1.0', kind: 'SOLANA_MINT_RESEARCH_NOT_ASSESSMENT',
    ...await observeMints(url, SOLANA_STABLECOIN_MINTS), productAdapter: 'AVAILABLE_SEPARATELY_MINT_ONLY',
    actualAuthorityExercise: 'NOT_TESTED', transferAndDelegateExecution: 'NOT_TESTED', issuerAuthentication: 'UNKNOWN' };
}
