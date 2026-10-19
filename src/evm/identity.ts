import { decodeFunctionResult, encodeFunctionData, getAddress, type Address, type Hex } from 'viem';
import { known, na, unknown, type AssetIdentity, type Knowledge } from '../domain/model.js';
import { abi } from './abi.js';
import { inspectProxy } from './proxy.js';
import { isRevert, Rpc, RpcError } from './rpc.js';
export interface MetadataField { status: 'OK' | 'READ_FAILED' | 'INVALID_RESPONSE'; value?: string | number | bigint; errorKind?: 'REVERT' | 'RPC_ERROR' | 'TRANSPORT_ERROR' }
export async function resolveIdentity(rpc: Rpc, tokenInput: string, networkId: string) {
  const token = getAddress(tokenInput);
  const actual = BigInt(await rpc.request<string>('eth_chainId')).toString();
  if (actual !== networkId) throw new Error(`Network mismatch: expected ${networkId}, observed ${actual}`);
  const block = await rpc.pin();
  const code = await rpc.request<string>('eth_getCode', [token, block]);
  if (code === '0x' || !/^0x[0-9a-f]+$/i.test(code)) throw new Error('Token address has no contract code.');
  const metadata: Record<string, MetadataField> = {};
  for (const fn of ['name', 'symbol', 'decimals', 'totalSupply'] as const) {
    let raw: Hex;
    try { raw = await rpc.request<Hex>('eth_call', [{ to: token, data: encodeFunctionData({ abi, functionName: fn }) }, block]); }
    catch (error) {
      metadata[fn] = { status: 'READ_FAILED', errorKind: isRevert(error) ? 'REVERT' : error instanceof RpcError ? 'RPC_ERROR' : 'TRANSPORT_ERROR' }; continue;
    }
    try {
      const value = decodeFunctionResult({ abi, functionName: fn, data: raw });
      // The ABI decoder can return a whole word outside the declared uint8 range.
      if (fn === 'decimals' && (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 255)) {
        metadata[fn] = { status: 'INVALID_RESPONSE' }; continue;
      }
      metadata[fn] = { status: 'OK', value };
    } catch { metadata[fn] = { status: 'INVALID_RESPONSE' }; }
  }
  const field = <T extends string | number>(key: string): Knowledge<T> => metadata[key]?.status === 'OK'
    ? known(metadata[key]!.value as T) : unknown(metadata[key]?.status ?? 'Missing response');
  rpc.record('METADATA_DECODE', metadata);
  const proxyEvidenceStart = rpc.evidence.length;
  const proxyStartedAt = new Date().toISOString();
  const proxy = await inspectProxy(rpc, token, code, block as Hex);
  const identity: AssetIdentity = {
    chainFamily: 'EVM', networkId: actual, assetStandard: unknown('ERC-20 candidate; interface conformance is assessed by scenarios.'),
    contractAddress: known(token), mintAddress: na('EVM contract asset'), tokenProgramId: na('EVM contract asset'),
    name: field<string>('name'), symbol: field<string>('symbol'), decimals: field<number>('decimals'),
    issuer: unknown('No trusted issuer source supplied'), issuerVerificationStatus: 'UNKNOWN',
    nativeOrBridged: unknown('Metadata does not establish origin'),
    implementationAddress: proxy.implementationAddress,
    observedBlockOrSlot: BigInt(block).toString(), observedAt: new Date().toISOString(),
  };
  return { identity, metadata, token: token as Address, block, proxy, proxyEvidenceStart, proxyStartedAt };
}
