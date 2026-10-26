import { createHash } from 'node:crypto';
import { keccak256, toHex } from 'viem';
import { address, chain, hex } from './network.mjs';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function verifyMetadata(files, metadata) {
  const checks = Object.entries(files).map(([file, source]) => {
    const expected = metadata?.sources?.[file]?.keccak256 ?? null, actual = keccak256(toHex(source.content));
    return { file, expected, actual, status: typeof expected === 'string' ? expected.toLowerCase() === actual ? 'PASS' : 'FAIL' : 'UNKNOWN' };
  });
  return { status: checks.some(x => x.status === 'FAIL') ? 'FAIL' : checks.length && checks.every(x => x.status === 'PASS') ? 'PASS' : 'UNKNOWN',
    scope: 'Source content hash versus provider-supplied metadata; metadata authenticity and deployment binding remain separate.', files: checks };
}
function object(x) { return x && typeof x === 'object' && !Array.isArray(x); }
export function sources(value) {
  if (!object(value) || !Object.keys(value).length || Object.keys(value).length > 64) throw Error('SOURCE_COUNT_LIMIT');
  const result = Object.create(null); let total = 0;
  for (const [path, entry] of Object.entries(value)) {
    if (!/^[a-zA-Z0-9_@.$/\-]{1,240}$/.test(path) || path.startsWith('/') || path.split('/').some(p => p === '..' || p === '') || ['__proto__', 'constructor', 'prototype'].includes(path)
      || !object(entry) || typeof entry.content !== 'string') throw Error('INLINE_SOURCE_REQUIRED');
    total += Buffer.byteLength(entry.content); if (total > 1024 * 1024) throw Error('SOURCE_BYTE_LIMIT');
    result[path] = { content: entry.content };
  }
  return result;
}
function abi(value) {
  if (!Array.isArray(value) || value.length > 2048 || value.some(x => !object(x) || !['function', 'event', 'error', 'constructor', 'receive', 'fallback'].includes(x.type))) throw Error('INVALID_ABI');
  return value;
}
export function normalizeSourcify(raw, chainId, target) {
  if (!object(raw) || String(raw.chainId) !== chain(chainId) || address(raw.address) !== address(target)) throw Error('SOURCE_IDENTITY_MISMATCH');
  const files = sources(raw.sources), c = raw.compilation;
  if (!object(c) || c.language !== 'Solidity' || typeof c.fullyQualifiedName !== 'string') throw Error('UNSUPPORTED_SOURCE');
  const colon = c.fullyQualifiedName.lastIndexOf(':'), file = c.fullyQualifiedName.slice(0, colon), name = c.fullyQualifiedName.slice(colon + 1);
  if (!Object.hasOwn(files, file) || !/^[A-Za-z_$][\w$]*$/.test(name)) throw Error('INVALID_CONTRACT_SELECTION');
  const metadataContentCheck = verifyMetadata(files, raw.metadata);
  return { provider: 'sourcify', chainId, address: address(target), providerVerifiedAt: raw.verifiedAt ?? null, claim: String(raw.runtimeMatch ?? raw.match ?? 'UNKNOWN'), sources: files, abi: abi(raw.abi), file, name,
    compilerVersion: String(c.compilerVersion), settings: object(c.compilerSettings) ? c.compilerSettings : {}, metadata: raw.metadata ?? null, metadataContentCheck,
    providerOnchainCode: raw.runtimeBytecode?.onchainBytecode ? hex(raw.runtimeBytecode.onchainBytecode) : null,
    providerRecompiledCode: raw.runtimeBytecode?.recompiledBytecode ? hex(raw.runtimeBytecode.recompiledBytecode) : null };
}
export function normalizeEtherscan(raw, chainId, target) {
  if (raw?.status !== '1' || !Array.isArray(raw.result) || raw.result.length !== 1) throw Error('SOURCE_UNAVAILABLE');
  const r = raw.result[0]; if (typeof r.SourceCode !== 'string' || !r.SourceCode.trim()) throw Error('SOURCE_UNAVAILABLE');
  let text = r.SourceCode.trim(), input;
  if (text.startsWith('{{') && text.endsWith('}}')) text = text.slice(1, -1);
  if (text.startsWith('{')) { input = JSON.parse(text); if (!input.sources) input = { sources: input }; }
  else input = { sources: { 'Contract.sol': { content: text } } };
  if (input.language && input.language !== 'Solidity') throw Error('UNSUPPORTED_SOURCE');
  const files = sources(input.sources), name = String(r.ContractName);
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw Error('INVALID_CONTRACT_SELECTION');
  const file = r.ContractFileName && Object.hasOwn(files, r.ContractFileName) ? r.ContractFileName : Object.keys(files).length === 1 ? Object.keys(files)[0] : null;
  return { provider: 'etherscan', chainId: chain(chainId), address: address(target), claim: r.SimilarMatch ? 'SIMILAR_MATCH_ONLY' : 'PROVIDER_VERIFIED', sources: files,
    abi: abi(JSON.parse(r.ABI)), file, name, compilerVersion: String(r.CompilerVersion).replace(/^v/, ''), settings: input.settings ?? {}, metadata: null,
    providerOnchainCode: null, providerRecompiledCode: null, reportedImplementation: /^0x[0-9a-fA-F]{40}$/.test(r.Implementation ?? '') ? address(r.Implementation) : null };
}
export async function acquire(transport, chainId, target, provider = 'sourcify', apiKey) {
  chain(chainId); address(target);
  if (provider === 'sourcify') {
    const raw = await transport.get(`https://sourcify.dev/server/v2/contract/${chainId}/${target}?fields=all`, provider);
    return { raw, normalized: normalizeSourcify(raw, chainId, target) };
  }
  if (provider !== 'etherscan' || !apiKey || apiKey.length > 256) throw Error('ETHERSCAN_KEY_REQUIRED');
  const query = new URLSearchParams({ chainid: chainId, module: 'contract', action: 'getsourcecode', address: target, apikey: apiKey });
  const raw = await transport.get(`https://api.etherscan.io/v2/api?${query}`, provider);
  return { raw, normalized: normalizeEtherscan(raw, chainId, target) };
}
