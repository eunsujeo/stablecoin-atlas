import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Ajv } from 'ajv';
import { keccak256, toFunctionSelector, type Address, type Hex } from 'viem';
import { RpcError, isRevert } from '../../src/evm/rpc.js';
import { writeReportAtomically } from '../../src/report-output.js';
import { caller, decodeControlWord } from './usdc-control-probe.js';
import { BoundedReadRpc } from './bounded-read-rpc.js';
export const usdtReference = { networkId: '1', target: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address,
  codeHash: '0xb44fb4e949d0f78f87f79ee46428f23a2a5713ce6fc6e0beb3dda78c2ac1ea55' as Hex };
export const usdtSource = { reference: '../docs/research/usdt-control-provenance.json', sha256: '5bdaf4b373d249e7ba850c7691139f69a3bd108a61c5f1d3198858fb15472baa',
  priorReport: '../reports/usdt-readonly.json', priorReportSha256: 'af78a1cf4d8d0ac3f8cb50f785044d21670932e7cf7b8c5c1473be4ad8991709',
  abiSha256: '7045e6cf869135de86aba06de0c35962a9643395134037168fa34369213ad9ba', provenance: 'THIRD_PARTY_CANDIDATE_NOT_REGISTERED_DEPLOYMENT_ABI' };
export const usdtGetters = [
  { signature: 'owner()', selector: '0x8da5cb5b', type: 'address' },
  { signature: 'getOwner()', selector: '0x893d20e8', type: 'address' },
  { signature: 'paused()', selector: '0x5c975abb', type: 'bool' },
  { signature: 'deprecated()', selector: '0x0e136b19', type: 'bool' },
  { signature: 'upgradedAddress()', selector: '0x26976e3f', type: 'address' },
  { signature: 'basisPointsRate()', selector: '0xdd644f72', type: 'uint256' },
  { signature: 'maximumFee()', selector: '0x35390714', type: 'uint256' },
] as const;
const skipped = [
  { signature: 'isBlackListed(address)', execution: 'NOT_TESTED', reason: 'NO_JUSTIFIED_ACCOUNT_SAMPLE' },
  { signature: 'getBlackListStatus(address)', execution: 'NOT_TESTED', reason: 'NO_JUSTIFIED_ACCOUNT_SAMPLE' },
] as const;
const tagOf = (n: string) => '0x' + BigInt(n).toString(16);
const quantity = (x: unknown): x is string => typeof x === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i.test(x);
export function decodeUSDTWord(raw: unknown, type: 'address' | 'bool' | 'uint256'): string | boolean {
  if (typeof raw !== 'string' || !/^0x[0-9a-f]{64}$/i.test(raw)) throw new Error('Invalid USDT word');
  return type === 'uint256' ? BigInt(raw).toString() : decodeControlWord(raw, type);
}
function allowed(method: string, params: unknown[], ref: typeof usdtReference, tag: string | undefined) {
  const tx = params[0] as any;
  return method === 'eth_chainId' && params.length === 0
    || method === 'eth_blockNumber' && params.length === 0 && tag === undefined
    || method === 'eth_getBlockByNumber' && tag !== undefined && params.length === 2 && params[0] === tag && params[1] === false
    || method === 'eth_getCode' && tag !== undefined && params.length === 2 && params[0] === ref.target && params[1] === tag
    || method === 'eth_call' && tag !== undefined && params.length === 2 && params[1] === tag && tx && typeof tx === 'object'
      && Object.keys(tx).sort().join(',') === 'data,from,to' && tx.to === ref.target && tx.from === caller && usdtGetters.some(g => tx.data === g.selector);
}
export class USDTRpc extends BoundedReadRpc {
  private selectedTag: string | undefined;
  constructor(url: string, private readonly reference = usdtReference) { super(url); }
  protected override get requestBudget(): number { return 16; }
  override async request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    if (!allowed(method, params, this.reference, this.selectedTag)) throw new Error('USDT request outside scope');
    const result = await this.transmit<T>(method, params);
    if (method === 'eth_blockNumber' && quantity(result)) this.selectedTag = result;
    return result;
  }
}
type Reading = { signature: string; readStatus: 'NOT_TESTED' | 'OK' | 'READ_FAILED' | 'INVALID_RESPONSE'; evidenceReferences: string[]; value?: string | boolean; errorKind?: string };
type Initial = { blockNumber: string; blockHash: string; codeHash: string };
const ownerComparison = (readings: Reading[]) => readings[0]!.readStatus === 'OK' && readings[1]!.readStatus === 'OK'
  ? readings[0]!.value === readings[1]!.value ? 'MATCH' : 'MISMATCH' : 'UNKNOWN';
export async function probeUSDT(url: string, reference = usdtReference) {
  const startedAt = new Date().toISOString(), rpc = new USDTRpc(url, reference);
  const readings: Reading[] = usdtGetters.map(g => ({ signature: g.signature, readStatus: 'NOT_TESTED', evidenceReferences: [] }));
  let initial: Initial | null = null, stage: 'PRECONDITION_ERROR' | 'OBSERVED' | 'PARTIAL' | 'CONSISTENCY_ERROR' = 'PRECONDITION_ERROR';
  const precheckEvidenceReferences: string[] = [], postcheckEvidenceReferences: string[] = [];
  async function code(tag: string) {
    const raw = await rpc.request<unknown>('eth_getCode', [reference.target, tag]);
    if (typeof raw !== 'string' || !/^0x(?:[0-9a-f]{2})+$/i.test(raw) || keccak256(raw as Hex) !== reference.codeHash) throw new Error('Code mismatch');
  }
  try {
    if (await rpc.request('eth_chainId') !== tagOf(reference.networkId)) throw new Error('Chain mismatch');
    const tag = await rpc.pin(), header = rpc.evidence.find(e => e.kind === 'BLOCK_REFERENCE')!.data as { number: string; hash: string };
    await code(tag); initial = { blockNumber: header.number, blockHash: header.hash, codeHash: reference.codeHash };
    precheckEvidenceReferences.push(...rpc.evidence.map(e => e.id));
    for (const [i, g] of usdtGetters.entries()) {
      const r = readings[i]!, before = rpc.evidence.length; let raw: unknown;
      try { raw = await rpc.request('eth_call', [{ to: reference.target, from: caller, data: g.selector }, tag]); }
      catch (e) { r.readStatus = 'READ_FAILED'; r.errorKind = isRevert(e) ? 'REVERT' : e instanceof RpcError ? 'RPC_ERROR' : 'TRANSPORT_ERROR'; }
      if (r.readStatus !== 'READ_FAILED') {
        try { r.value = decodeUSDTWord(raw, g.type); r.readStatus = 'OK'; } catch { r.readStatus = 'INVALID_RESPONSE'; }
      }
      r.evidenceReferences = rpc.evidence.slice(before).map(e => e.id);
    }
    const before = rpc.evidence.length;
    try {
      await code(tag);
      if (await rpc.request('eth_chainId') !== tagOf(reference.networkId)) throw new Error('Chain changed');
      const header = await rpc.request<any>('eth_getBlockByNumber', [tag, false]);
      if (!header || header.number !== tag || header.hash !== initial.blockHash) throw new Error('Header changed');
      stage = readings.every(r => r.readStatus === 'OK') ? 'OBSERVED' : 'PARTIAL';
    } catch { stage = 'CONSISTENCY_ERROR'; }
    postcheckEvidenceReferences.push(...rpc.evidence.slice(before).map(e => e.id));
  } catch { if (initial) stage = 'CONSISTENCY_ERROR'; }
  if (!initial) precheckEvidenceReferences.push(...rpc.evidence.map(e => e.id));
  return { schemaVersion: '1.0', kind: 'QUALIFIED_USDT_CONTROL_PROBE_NOT_ASSESSMENT', reference, sourceEvidence: usdtSource, caller, initial, stage,
    readings, ownerResponseComparison: ownerComparison(readings), skipped, precheckEvidenceReferences, postcheckEvidenceReferences, evidence: rpc.evidence,
    requestCount: rpc.evidence.filter(e => ['RPC', 'RPC_ERROR'].includes(e.kind)).length, sourceBinding: 'UNKNOWN', authorityState: 'UNKNOWN', support: 'UNKNOWN',
    issuerVerificationStatus: 'UNKNOWN', nativeOrBridged: 'UNKNOWN', verdict: 'INCONCLUSIVE', behaviorExecution: 'NOT_TESTED',
    startedAt, completedAt: new Date().toISOString(), limitations: [
      'OK and owner response equality are observations, not operator identity, key control, authorization or asset support.',
      'Deprecated/paused/zero addresses and fee settings do not establish transfer behavior, immutability or effective forwarding.',
      'upgradedAddress is not followed; no account samples, target calls, storage probes, signing or broadcast.',
      'Source ABI is a third-party candidate with metadata replacement/full recompilation mismatch; source binding remains unknown.',
      'Numeric block tags and before/after provider checks do not establish atomic hash pinning or finality.',
      'CONSISTENCY_ERROR responses are retained but must not be treated as a coherent snapshot; uint256 settings use decimal strings.'] };
}
export function validateUSDTSource(bytes: Buffer) {
  if (createHash('sha256').update(bytes).digest('hex') !== usdtSource.sha256) throw new Error('USDT source hash mismatch');
  const s = JSON.parse(bytes.toString());
  if (s.networkId !== '1' || s.assetAddress !== usdtReference.target || s.historicalRuntime.keccak256 !== usdtReference.codeHash
    || s.historicalRuntime.reportSha256 !== usdtSource.priorReportSha256 || s.abi.sha256 !== usdtSource.abiSha256) throw new Error('USDT source scope mismatch');
  for (const g of usdtGetters) {
    const hits = s.getterCandidates.filter((c: any) => c.signature === g.signature), c = hits[0];
    if (hits.length !== 1 || c.selector !== g.selector || toFunctionSelector(c.abiEntry) !== g.selector || toFunctionSelector(g.signature) !== g.selector
      || c.inputs.length || c.outputs.join(',') !== g.type || c.stateMutability !== 'view' || c.legacyConstant !== true || c.abiEntry.constant !== true
      || c.abiEntry.stateMutability !== 'view' || c.abiEntry.inputs.length || c.abiEntry.outputs.map((o: any) => o.type).join(',') !== g.type) throw new Error('USDT ABI mismatch');
  }
}
const schema = JSON.parse(readFileSync(new URL('../../schemas/usdt-control-probe.v1.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);
export function validateUSDTReport(report: unknown, reference = usdtReference) {
  if (!validate(report)) throw new Error('Invalid USDT probe report');
  const p = report as Awaited<ReturnType<typeof probeUSDT>>;
  if (JSON.stringify(p.reference) !== JSON.stringify(reference) || JSON.stringify(p.sourceEvidence) !== JSON.stringify(usdtSource)
    || JSON.stringify(p.skipped) !== JSON.stringify(skipped) || p.ownerResponseComparison !== ownerComparison(p.readings)
    || p.requestCount !== p.evidence.filter(e => ['RPC', 'RPC_ERROR'].includes(e.kind)).length) throw new Error('Invalid USDT scope');
  const refs = [...p.precheckEvidenceReferences, ...p.readings.flatMap(r => r.evidenceReferences), ...p.postcheckEvidenceReferences];
  if (JSON.stringify(refs) !== JSON.stringify(p.evidence.map(e => e.id))) throw new Error('USDT evidence partition mismatch');
  let tag: string | undefined;
  for (const [i, e] of p.evidence.entries()) {
    if (e.id !== `e${i + 1}`) throw new Error('USDT evidence order');
    if (['RPC', 'RPC_ERROR'].includes(e.kind)) {
      const d = e.data as any;
      if (!d || !Array.isArray(d.params) || !allowed(d.method, d.params, reference, tag)) throw new Error('USDT request outside scope');
      if (e.kind === 'RPC' && d.method === 'eth_blockNumber' && quantity(d.result)) tag = d.result;
    }
  }
  const select = (ids: string[]) => p.evidence.filter(e => ids.includes(e.id));
  function frame(ids: string[], final: boolean) {
    if (!p.initial) throw new Error('Missing USDT snapshot');
    const ev = select(ids), fixed = tagOf(p.initial.blockNumber);
    const result = (method: string) => (ev.find(e => e.kind === 'RPC' && (e.data as any).method === method)?.data as any);
    const c = result('eth_getCode'), h = result('eth_getBlockByNumber');
    if (!c || c.params[0] !== reference.target || c.params[1] !== fixed || typeof c.result !== 'string' || !/^0x(?:[0-9a-f]{2})+$/i.test(c.result)
      || keccak256(c.result) !== reference.codeHash || p.initial.codeHash !== reference.codeHash
      || result('eth_chainId')?.result !== tagOf(reference.networkId) || h?.result?.number !== fixed || h.result.hash !== p.initial.blockHash) throw new Error('Invalid USDT frame');
    if (!final && !ev.some(e => e.kind === 'BLOCK_REFERENCE' && (e.data as any).number === p.initial!.blockNumber && (e.data as any).hash === p.initial!.blockHash)) throw new Error('Missing USDT pin');
    if (final && (ev.at(-1)?.data as any)?.method !== 'eth_getBlockByNumber') throw new Error('Missing final USDT header');
  }
  if (p.stage === 'PRECONDITION_ERROR') {
    if (p.initial || p.postcheckEvidenceReferences.length || p.readings.some(r => r.readStatus !== 'NOT_TESTED' || r.evidenceReferences.length)) throw new Error('Invalid USDT precondition report');
  } else { frame(p.precheckEvidenceReferences, false); if (['OBSERVED', 'PARTIAL'].includes(p.stage)) frame(p.postcheckEvidenceReferences, true); }
  for (const [i, r] of p.readings.entries()) {
    const g = usdtGetters[i]!;
    if (r.signature !== g.signature) throw new Error('Wrong USDT getter');
    if (r.readStatus === 'NOT_TESTED') continue;
    const ev = select(r.evidenceReferences), e = ev[0]!, d = e?.data as any;
    if (!p.initial || ev.length !== 1 || d?.method !== 'eth_call'
      || JSON.stringify(d.params) !== JSON.stringify([{ to: reference.target, from: caller, data: g.selector }, tagOf(p.initial.blockNumber)])) throw new Error('Invalid USDT read context');
    if (r.readStatus === 'OK' && (e.kind !== 'RPC' || r.value !== decodeUSDTWord(d.result, g.type))) throw new Error('Invalid USDT decoded value');
    if (r.readStatus === 'READ_FAILED' && (e.kind !== 'RPC_ERROR' || r.errorKind !== (d.category ?? 'TRANSPORT_ERROR'))) throw new Error('Invalid USDT read failure');
    if (r.readStatus === 'INVALID_RESPONSE') { let invalid = false; try { decodeUSDTWord(d.result, g.type); } catch { invalid = true; } if (e.kind !== 'RPC' || !invalid) throw new Error('Invalid USDT malformed status'); }
  }
  if (['OBSERVED', 'PARTIAL'].includes(p.stage) && p.readings.some(r => r.readStatus === 'NOT_TESTED')
    || p.stage === 'OBSERVED' && p.readings.some(r => r.readStatus !== 'OK') || p.stage === 'PARTIAL' && p.readings.every(r => r.readStatus === 'OK')) throw new Error('Invalid USDT stage');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { values } = parseArgs({ options: { out: { type: 'string' } }, strict: true });
    if (!values.out || !process.env.RPC_URL) throw new Error('Missing configuration');
    validateUSDTSource(readFileSync(new URL('../../docs/research/usdt-control-provenance.json', import.meta.url)));
    const report = await probeUSDT(process.env.RPC_URL); validateUSDTReport(report);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(`USDT probe: ${report.stage}; ${report.readings.filter(r => r.readStatus === 'OK').length}/7 decoded; ${report.requestCount} requests.\n`);
    if (!['OBSERVED', 'PARTIAL'].includes(report.stage)) process.exitCode = 1;
  })().catch(() => { process.stderr.write('USDT probe failed; details omitted.\n'); process.exitCode = 1; });
}
