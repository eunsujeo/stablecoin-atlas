import { randomUUID } from 'node:crypto';
import { decodeFunctionResult, encodeFunctionData, parseAbi, type Hex } from 'viem';
import type { ReadOnlyAdapter, ReadOnlyAssessmentRequest } from '../domain/adapter.js';
import { known, na, unknown, type AssessmentReport, type AssetIdentity, type ScenarioResult, type Capability } from '../domain/model.js';
import { summarize } from '../domain/evaluator.js';
import { JsonRpc, JsonRpcError } from '../rpc/json-rpc.js';
import { tronAddress } from './address.js';
const abi = parseAbi(['function name() view returns (string)', 'function symbol() view returns (string)',
  'function decimals() view returns (uint8)', 'function totalSupply() view returns (uint256)', 'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)']);
const allowed = new Set(['eth_chainId', 'eth_getBlockByNumber', 'eth_getCode', 'eth_call']);
class TronRpc extends JsonRpc {
  constructor(url: string, private readonly transport?: JsonRpc) { super(url); }
  override async request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    if (!allowed.has(method)) throw new Error('Unsupported TRON read method.');
    if (!this.transport) return super.request<T>(method, params);
    const before = this.transport.evidence.length;
    try { return await this.transport.request<T>(method, params); }
    finally { for (const e of this.transport.evidence.slice(before)) this.record(e.kind, structuredClone(e.data)); }
  }
  async head() {
    const raw = await this.request<unknown>('eth_getBlockByNumber', ['latest', false]);
    const head = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    if (typeof head.number !== 'string' || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(head.number)
      || typeof head.hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(head.hash)
      || BigInt(head.number) > 0xffffffffffffffffn || BigInt('0x' + head.hash.slice(2, 18)) !== BigInt(head.number)) {
      this.record('TRON_HEAD_ERROR', { reason: 'INVALID_HEADER' }); throw new Error('Invalid TRON head reference.');
    }
    const observation = { number: BigInt(head.number).toString(), hash: head.hash };
    this.record('TRON_HEAD_REFERENCE', observation, observation.number); return observation;
  }
}
type Field = { status: 'OK'; value: string | number | bigint } | { status: 'INVALID_RESPONSE' }
  | { status: 'READ_FAILED'; errorKind: 'RPC_ERROR' | 'TRANSPORT_ERROR' };
const deferred: [string, Capability][] = [['TRC20-002', 'TRANSFER'], ['TRC20-003', 'ALLOWANCE'],
  ['TRC20-004', 'UPGRADEABILITY'], ['TRC20-005', 'RESOURCE_CONSUMPTION'], ['TRC20-006', 'TRANSFER_FEE']];
const limitations = [
  'TRON state queries use latest. Exact response blocks are UNKNOWN; observed heads do not pin state, even if unchanged.',
  'Read/decode outcomes are INCONCLUSIVE under Report 1.0 until response-block binding is established; they are not asset approval.',
  'Provider-reported chainId is compared, not independent network authentication. Issuer, origin, authority, finality and transaction behavior remain unverified.',
];
export interface TronReadOnlyAssessmentRequest extends ReadOnlyAssessmentRequest { spenderAddress?: string }
export class TronReadOnlyAdapter implements ReadOnlyAdapter {
  readonly chainFamily = 'TRON' as const;
  constructor(private readonly rpcUrl: string, private readonly rpcFactory?: (url: string) => JsonRpc) {}
  async assessReadOnly(request: TronReadOnlyAssessmentRequest): Promise<AssessmentReport> {
    if (request.currencyCode !== undefined) throw new Error('Currency code requires XRPL.');
    const token = tronAddress(request.assetAddress), holder = request.accountAddress !== undefined ? tronAddress(request.accountAddress) : undefined;
    const spender = request.spenderAddress !== undefined ? tronAddress(request.spenderAddress) : undefined;
    if (spender && !holder) throw new Error('TRON spender requires holder.');
    if (!/^[1-9][0-9]*$/.test(request.networkId) || BigInt(request.networkId) > 0xffffffffn) throw new Error('Invalid TRON network id.');
    const rpc = new TronRpc(this.rpcUrl, this.rpcFactory?.(this.rpcUrl)), startedAt = new Date().toISOString(), assessmentId = randomUUID();
    const chain = await rpc.request<unknown>('eth_chainId');
    if (typeof chain !== 'string' || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(chain) || BigInt(chain) > 0xffffffffn) throw new Error('Invalid TRON network id.');
    if (BigInt(chain).toString() !== request.networkId) throw new Error(`Network mismatch: expected ${request.networkId}, observed ${BigInt(chain)}`);
    const headBefore = await rpc.head();
    const code = await rpc.request<unknown>('eth_getCode', [token.rpc, 'latest']);
    if (typeof code !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(code)) throw new Error('Token address has no contract code.');
    async function read(fn: 'name' | 'symbol' | 'decimals' | 'totalSupply' | 'balanceOf' | 'allowance'): Promise<Field> {
      let raw: Hex;
      try {
        const data = encodeFunctionData({ abi, functionName: fn, ...(fn === 'balanceOf' ? { args: [holder!.rpc] } : fn === 'allowance' ? { args: [holder!.rpc, spender!.rpc] } : {}) } as Parameters<typeof encodeFunctionData>[0]);
        raw = await rpc.request<Hex>('eth_call', [{ to: token.rpc, data }, 'latest']);
      } catch (error) { return { status: 'READ_FAILED', errorKind: error instanceof JsonRpcError ? 'RPC_ERROR' : 'TRANSPORT_ERROR' }; }
      try {
        const value = decodeFunctionResult({ abi, functionName: fn, data: raw }) as string | number | bigint;
        if (fn === 'decimals' && (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 255)) return { status: 'INVALID_RESPONSE' };
        return { status: 'OK', value };
      } catch { return { status: 'INVALID_RESPONSE' }; }
    }
    const metadataStart = rpc.evidence.length, metadata: Record<string, Field> = {};
    for (const fn of ['name', 'symbol', 'decimals', 'totalSupply'] as const) metadata[fn] = await read(fn);
    rpc.record('TRON_METADATA_DECODE', metadata);
    const metadataRefs = rpc.evidence.slice(metadataStart).map(e => e.id);
    const balanceStart = rpc.evidence.length, balance = holder ? await read('balanceOf') : undefined;
    if (balance) rpc.record('TRON_BALANCE_DECODE', { holder: holder!.base58, ...balance });
    const balanceRefs = rpc.evidence.slice(balanceStart).map(e => e.id);
    const allowanceStart = rpc.evidence.length, allowance = spender ? await read('allowance') : undefined;
    if (allowance) rpc.record('TRON_ALLOWANCE_DECODE', { owner: holder!.base58, spender: spender!.base58, ...allowance });
    const allowanceRefs = rpc.evidence.slice(allowanceStart).map(e => e.id);
    let headAfter: Awaited<ReturnType<TronRpc['head']>> | undefined;
    try { headAfter = await rpc.head(); } catch { /* Decode observations survive a failed closing context read. */ }
    const context = rpc.record('TRON_STATE_CONTEXT', { stateTag: 'latest', responseBlockKnown: false, headBefore, headAfter,
      closingHeadAvailable: headAfter !== undefined, headChanged: headAfter ? headAfter.hash !== headBefore.hash : 'UNKNOWN' });
    const field = <T extends string | number>(name: string) => metadata[name]?.status === 'OK'
      ? known(metadata[name].value as T) : unknown(metadata[name]?.status ?? 'Missing response');
    const identity: AssetIdentity = { chainFamily: 'TRON', networkId: request.networkId,
      assetStandard: unknown('TRC-20 candidate; read-only metadata is not interface conformance'), contractAddress: known(token.base58),
      mintAddress: na('TRON contract asset'), tokenProgramId: na('TRON contract asset'), name: field<string>('name'),
      symbol: field<string>('symbol'), decimals: field<number>('decimals'), issuer: unknown('No issuer verification'),
      issuerVerificationStatus: 'UNKNOWN', nativeOrBridged: unknown('Metadata does not establish origin'),
      implementationAddress: unknown('TRON proxy inspection is not implemented'), observedBlockOrSlot: 'UNKNOWN', observedAt: new Date().toISOString() };
    const results: ScenarioResult[] = [];
    const add = (id: string, capability: Capability, observations: Record<string, unknown>, refs: string[], tested: boolean, error = false) => {
      results.push({ assessmentId, assetIdentity: identity, scenarioId: id, scenarioVersion: '1.0.0', capability, support: 'UNKNOWN',
        executionStatus: tested ? error ? 'ERROR' : 'COMPLETED' : 'NOT_EXECUTED', verdict: tested ? 'INCONCLUSIVE' : 'NOT_TESTED',
        observations, evidenceReferences: tested ? [...refs, context.id] : [], observedBlockOrSlot: 'UNKNOWN',
        startedAt, completedAt: new Date().toISOString(), limitations: tested ? [...limitations] : ['TRON execution/proxy/resource checks were not performed.'] });
    };
    add('TRC20-001', 'IDENTITY', { metadata, decodeComplete: Object.values(metadata).every(f => f.status === 'OK') }, metadataRefs, true);
    add('TRC20-000', 'BALANCE', balance?.status === 'OK' ? { holder: holder!.base58, balance: balance.value, readStatus: 'OK' }
      : balance ? { holder: holder!.base58, readStatus: balance.status, ...(balance.status === 'READ_FAILED' ? { errorKind: balance.errorKind } : {}) } : {},
    balanceRefs, !!balance, balance?.status === 'READ_FAILED');
    add('TRC20-007', 'ALLOWANCE', allowance ? { owner: holder!.base58, spender: spender!.base58,
      ...(allowance.status === 'OK' ? { allowance: allowance.value, readStatus: 'OK' }
        : { readStatus: allowance.status, ...(allowance.status === 'READ_FAILED' ? { errorKind: allowance.errorKind } : {}) }) } : {},
    allowanceRefs, !!allowance, allowance?.status === 'READ_FAILED');
    for (const [id, capability] of deferred) add(id, capability, {}, [], false);
    return { schemaVersion: '1.0', assessmentId, mode: 'READ_ONLY', profile: 'baseline', assetIdentity: identity, results,
      evidence: rpc.evidence, capabilitySummary: summarize({ results }), startedAt, completedAt: new Date().toISOString(), limitations };
  }
}
