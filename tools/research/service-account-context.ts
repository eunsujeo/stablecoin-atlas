import { constants } from 'node:fs';
import { open, lstat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Ajv } from 'ajv';
import { getAddress, isAddress } from 'viem';
import { tronAddress } from '../../src/tron/address.js';
import { writeReportAtomically } from '../../src/report-output.js';

export const maxContextBytes = 16384;
export const contextProfiles = {
  'ethereum-usdc': { chainFamily: 'EVM', networkId: '1', assetAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  'ethereum-usdt': { chainFamily: 'EVM', networkId: '1', assetAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
  'ethereum-rlusd': { chainFamily: 'EVM', networkId: '1', assetAddress: '0x8292bb45bf1ee4d140127049757c2e0ff06317ed' },
  'tron-usdt': { chainFamily: 'TRON', networkId: '728126428', assetAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
} as const;
for (const profile of Object.values(contextProfiles)) Object.freeze(profile);
Object.freeze(contextProfiles);
type ProfileId = keyof typeof contextProfiles;
type Provenance = { kind: 'USER_STATEMENT' | 'PUBLIC_REFERENCE'; referenceId: string; recordedAt: string; scope: 'ACCOUNT_PURPOSE_ONLY' };
type Account = { address: string; purpose: 'DEPOSIT_REVIEW' | 'WITHDRAWAL_REVIEW' | 'SWEEP_REVIEW' | 'ALLOWANCE_REVIEW'; provenance: Provenance };
type Input = { schemaVersion: '1.0'; contextKind: 'SERVICE_ACCOUNT_PURPOSE_CLAIM'; profileId: ProfileId; chainFamily: 'EVM' | 'TRON'; network: 'MAINNET'; networkId: string; assetAddress: string;
  query: { kind: 'BALANCE'; holder: Account } | { kind: 'ALLOWANCE'; owner: Account; spender: Account } };
const hash = (raw: string | Uint8Array) => createHash('sha256').update(raw).digest('hex');
const fail = (): never => { throw new Error('Invalid local account context; details omitted.'); };
const inputSchema = JSON.parse(readFileSync(new URL('../../schemas/service-account-context-input.v1.schema.json', import.meta.url), 'utf8'));
const checkInput = new Ajv({ strict: true }).compile(inputSchema);

// JSON.parse first checks grammar. This second bounded token walk rejects duplicate
// decoded member names, including escaped aliases, rather than silently taking the last.
function parseUniqueJSON(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g) ?? [];
  let at = 0;
  function value(depth: number) {
    if (depth > 16) fail(); const token = tokens[at++];
    if (token === '{') {
      const keys = new Set<string>();
      if (tokens[at] !== '}') for (;;) {
        const key = JSON.parse(tokens[at++]!); if (keys.has(key)) fail(); keys.add(key);
        if (tokens[at++] !== ':') fail(); value(depth + 1);
        if (tokens[at] !== ',') break; at++;
      }
      if (tokens[at++] !== '}') fail();
    } else if (token === '[') {
      if (tokens[at] !== ']') for (;;) { value(depth + 1); if (tokens[at] !== ',') break; at++; }
      if (tokens[at++] !== ']') fail();
    } else if (!token) fail();
  }
  value(0); if (at !== tokens.length) fail(); return parsed;
}
function normalize(family: 'EVM' | 'TRON', address: string) {
  if (family === 'EVM') {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address) || (!/^0x[a-f0-9]{40}$/.test(address)
      && !/^0x[A-F0-9]{40}$/.test(address) && !isAddress(address, { strict: true }))) fail();
    return getAddress(address);
  }
  return tronAddress(address).base58;
}
function utc(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail();
  return Date.parse(value);
}
export function validateServiceAccountContext(raw: Uint8Array, validatedAt = new Date().toISOString()) {
  try {
    const now = utc(validatedAt); if (!raw.byteLength || raw.byteLength > maxContextBytes) fail();
    const parsed = parseUniqueJSON(new TextDecoder('utf-8', { fatal: true }).decode(raw)); if (!checkInput(parsed)) fail();
    const input = parsed as Input, profile = contextProfiles[input.profileId];
    if (input.chainFamily !== profile.chainFamily || input.networkId !== profile.networkId) fail();
    const assetAddress = normalize(input.chainFamily, input.assetAddress);
    if (assetAddress !== normalize(input.chainFamily, profile.assetAddress)) fail();
    const accounts = (input.query.kind === 'BALANCE' ? [['holder', input.query.holder] as const] : [['owner', input.query.owner] as const, ['spender', input.query.spender] as const]).map(([role, account]) => {
      if (input.query.kind === 'ALLOWANCE' ? account.purpose !== 'ALLOWANCE_REVIEW' : account.purpose === 'ALLOWANCE_REVIEW') fail();
      const address = normalize(input.chainFamily, account.address), p = account.provenance;
      const zero = input.chainFamily === 'EVM' ? /^0x0{40}$/i.test(address) : /^0x0{40}$/i.test(tronAddress(address).rpc);
      if (zero || address === assetAddress || utc(p.recordedAt) > now) fail();
      return { role, address, purpose: account.purpose, provenance: { kind: p.kind, recordedAt: p.recordedAt, scope: p.scope, referenceIdSha256: hash(p.referenceId), authenticity: 'UNKNOWN' as const } };
    });
    return { schemaVersion: '1.0', kind: 'LOCAL_SERVICE_ACCOUNT_CONTEXT_VALIDATION_NOT_ASSESSMENT', inputStatus: 'LOCAL_INPUT_VALIDATED_NOT_ACCOUNT_VERIFIED',
      inputSha256: hash(raw), inputHashEncoding: 'SHA256_RAW_UTF8_BYTES', profileId: input.profileId, chainFamily: input.chainFamily, network: input.network, networkId: input.networkId, assetAddress,
      profileReferenceStatus: 'STORED_RESEARCH_REFERENCE_NOT_FRESH_NETWORK_VERIFICATION', queryKind: input.query.kind, accounts,
      pairRelation: input.query.kind === 'BALANCE' ? 'NOT_APPLICABLE' : accounts[0]!.address === accounts[1]!.address ? 'SAME_ACCOUNT' : 'DISTINCT_ACCOUNTS',
      validatedAt, rpcAdmission: 'NOT_GRANTED', queryExecution: 'NOT_TESTED', accountExistence: 'UNKNOWN', serviceAccountIdentity: 'UNKNOWN', ownership: 'UNKNOWN', authorityState: 'UNKNOWN', support: 'UNKNOWN', verdict: 'INCONCLUSIVE',
      limitations: ['Local syntax and purpose/provenance-field validation only; references are never opened or fetched.',
        'Addresses do not establish network membership, account existence, ownership, key control, role membership or service approval.',
        'Same-account allowance context is permitted but does not prove delegation or authority.',
        'Input/reference digests are integrity references, not anonymization or a guarantee against secret-bearing input.',
        'No network access, signing, transactions, automatic RPC admission or account discovery.'] };
  } catch { return fail(); }
}
const reportSchema = JSON.parse(readFileSync(new URL('../../schemas/service-account-context-report.v1.schema.json', import.meta.url), 'utf8'));
const checkReport = new Ajv({ strict: true }).compile(reportSchema);
export function validateServiceAccountContextReport(report: unknown, raw: Uint8Array) {
  if (!checkReport(report)) fail();
  const r = report as ReturnType<typeof validateServiceAccountContext>;
  if (!isDeepStrictEqual(r, validateServiceAccountContext(raw, r.validatedAt))) fail();
}
export async function readContextInput(path: string, out: string) {
  if (resolve(path) === resolve(out)) fail();
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const source = await handle.stat(); if (!source.isFile() || source.size < 1 || source.size > maxContextBytes) fail();
    try { const target = await lstat(out); if (target.dev === source.dev && target.ino === source.ino) fail(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const buffer = Buffer.alloc(maxContextBytes + 1); let size = 0;
    while (size < buffer.length) { const r = await handle.read(buffer, size, buffer.length - size, null); if (!r.bytesRead) break; size += r.bytesRead; }
    if (size > maxContextBytes) fail(); return buffer.subarray(0, size);
  } finally { await handle.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { values } = parseArgs({ options: { input: { type: 'string' }, out: { type: 'string' } }, strict: true });
    if (!values.input || !values.out) return fail();
    const raw = await readContextInput(values.input, values.out), report = validateServiceAccountContext(raw); validateServiceAccountContextReport(report, raw);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write('Local account context validated; account verification and RPC admission not granted.\n');
  })().catch(() => { process.stderr.write('Local account context validation failed; details omitted.\n'); process.exitCode = 1; });
}
