import { readFileSync } from 'node:fs';
import { BoundedReadRpc } from './bounded-read-rpc.js';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Ajv } from 'ajv';
import { keccak256, toFunctionSelector, type Hex } from 'viem';
import { RpcError, isRevert } from '../../src/evm/rpc.js';
import { proxySlots, decodeAddressWord } from '../../src/evm/proxy.js';
import { writeReportAtomically } from '../../src/report-output.js';
import { caller, decodeControlWord, type ProbeReference } from './usdc-control-probe.js';

export const rlusdReference: ProbeReference = {
  networkId: '1', proxy: '0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD',
  implementation: '0x9747a0d261c2d56Eb93f542068e5d1E23170fa9e',
  proxyCodeHash: '0x23fd38dfee1f350e13b663717d03529920d67bb8f2582203b4b29b1e0bfd06b7',
  implementationCodeHash: '0x77598e1b7a230cd9034edb3e524d6faf036110e996acd9f24c20c872ca7a1807',
};
export const rlusdSource = {
  reference: '../docs/research/rlusd-control-abi-study.json',
  sha256: 'b4673375590e26ad013f7b27802b3c95ac38c9460aafce1416ebe2ebf368f6fe',
  priorReport: '../reports/rlusd-readonly.json', priorReportSha256: 'b164f5a99ff8ba3c6248e08e616f45cec113052c0ae8cc0f1c25aa449b6575ba',
  abiProvenance: 'USER_PROVIDED_CANDIDATE_NOT_DEPLOYMENT_VERIFIED', fullSourceAbiIdentity: 'UNKNOWN',
} as const;
export const rlusdGetters = [
  { signature: 'paused()', selector: '0x5c975abb', type: 'bool' },
  { signature: 'DEFAULT_ADMIN_ROLE()', selector: '0xa217fddf', type: 'bytes32' },
  { signature: 'MINTER_ROLE()', selector: '0xd5391393', type: 'bytes32' },
  { signature: 'BURNER_ROLE()', selector: '0x282c51f3', type: 'bytes32' },
  { signature: 'PAUSER_ROLE()', selector: '0xe63ab1e9', type: 'bytes32' },
  { signature: 'CLAWBACKER_ROLE()', selector: '0x475ca324', type: 'bytes32' },
  { signature: 'UPGRADER_ROLE()', selector: '0xf72c0d8b', type: 'bytes32' },
] as const;
export const roleConstants: Record<string, string> = {
  "MINTER_ROLE()": "0xf0887ba65ee2024ea881d91b74c2450ef19e1557f03bed3ea9f16b037cbe2dc9",
  "BURNER_ROLE()": "0x9667e80708b6eeeb0053fa0cca44e028ff548e2a9f029edfeac87c118b08b7c8",
  "PAUSER_ROLE()": "0x539440820030c4994db4e31b6b800deafd503688728f932addfe7a410515c14c",
  "CLAWBACKER_ROLE()": "0x715bacafb7a853b9b91b59ae724920a9eb0c006c5b318ac393fa1bc8974edd98",
  "UPGRADER_ROLE()": "0xa615a8afb6fffcb8c6809ac0997b5c9c12b8cc97651150f14c8f6203168cff4c"
};
const skipped = [
  { signature: 'getRoleAdmin(bytes32)', execution: 'NOT_TESTED', reason: 'ROLE_ARGUMENT_OUTSIDE_NO_ARGUMENT_SCOPE' },
  { signature: 'hasRole(bytes32,address)', execution: 'NOT_TESTED', reason: 'NO_JUSTIFIED_ACCOUNT_SAMPLE' },
  { signature: 'accountPaused(address)', execution: 'NOT_TESTED', reason: 'NO_JUSTIFIED_ACCOUNT_SAMPLE' },
] as const;
const slots = [proxySlots.implementation, proxySlots.beacon, proxySlots.legacyImplementation];
const quantity = (x: unknown): x is string => typeof x === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i.test(x);
const word = (x: unknown): x is Hex => typeof x === 'string' && /^0x[0-9a-f]{64}$/i.test(x);
const bytes = (x: unknown): x is Hex => typeof x === 'string' && x.length <= 262146 && /^0x(?:[0-9a-f]{2})*$/i.test(x);
const tagOf = (n: string) => '0x' + BigInt(n).toString(16);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export function decodeRLUSDWord(raw: unknown, type: 'bool' | 'bytes32'): boolean | string {
  if (!word(raw)) throw new Error('Invalid word');
  return type === 'bool' ? decodeControlWord(raw, 'bool') : raw.toLowerCase();
}

function requestAllowed(method: string, params: unknown[], reference: ProbeReference, tag: string | undefined): boolean {
  const tx = params[0] as any;
  return !!(method === 'eth_chainId' && params.length === 0
      || method === 'eth_blockNumber' && params.length === 0 && tag === undefined
      || method === 'eth_getBlockByNumber' && tag !== undefined && params.length === 2 && params[0] === tag && params[1] === false
      || method === 'eth_getCode' && tag !== undefined && params.length === 2 && params[1] === tag && [reference.proxy, reference.implementation].includes(params[0] as any)
      || method === 'eth_getStorageAt' && tag !== undefined && params.length === 3 && params[0] === reference.proxy && slots.includes(params[1] as any) && params[2] === tag
      || method === 'eth_call' && tag !== undefined && params.length === 2 && params[1] === tag && tx && typeof tx === 'object'
        && Object.keys(tx).sort().join(',') === 'data,from,to' && tx.to === reference.proxy && tx.from === caller && rlusdGetters.some(g => g.selector === tx.data));
}

// One endpoint; no redirects, caller variants, overrides, arbitrary targets or calldata.
export class RLUSDRpc extends BoundedReadRpc {
  private selectedTag: string | undefined;
  constructor(url: string, private readonly reference: ProbeReference) { super(url); }
  override async request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    if (!requestAllowed(method, params, this.reference, this.selectedTag)) throw new Error('RLUSD request outside scope/budget');
    const result = await this.transmit<T>(method, params);
    if (method === 'eth_blockNumber' && quantity(result)) this.selectedTag = result;
    return result;
  }
}
type Reading = { signature: string; readStatus: 'NOT_TESTED' | 'OK' | 'READ_FAILED' | 'INVALID_RESPONSE';
  evidenceReferences: string[]; value?: string | boolean; errorKind?: string; candidateConsistency?: string };
type Snapshot = { blockNumber: string; blockHash: string; proxyCodeHash: string; implementationCodeHash: string; declaredImplementation: string };
function checkStructure(data: any[], reference: ProbeReference, tag: string): Omit<Snapshot, 'blockNumber' | 'blockHash'> {
  const result = (method: string, params: any[]) => {
    const e = data.find(e => e.kind === 'RPC' && e.data.method === method && JSON.stringify(e.data.params) === JSON.stringify(params));
    if (!e) throw new Error('Missing structure evidence'); return e.data.result;
  };
  const proxyCode = result('eth_getCode', [reference.proxy, tag]), code = result('eth_getCode', [reference.implementation, tag]);
  if (!bytes(proxyCode) || proxyCode === '0x' || !bytes(code) || code === '0x'
    || keccak256(proxyCode) !== reference.proxyCodeHash || keccak256(code) !== reference.implementationCodeHash) throw new Error('Code mismatch');
  const declared = decodeAddressWord(result('eth_getStorageAt', [reference.proxy, proxySlots.implementation, tag]));
  if (declared.status !== 'VALUE' || !same(declared.address, reference.implementation)
    || [proxySlots.beacon, proxySlots.legacyImplementation].some(slot => decodeAddressWord(result('eth_getStorageAt', [reference.proxy, slot, tag])).status !== 'ZERO')) throw new Error('Slot mismatch');
  return { proxyCodeHash: keccak256(proxyCode), implementationCodeHash: keccak256(code), declaredImplementation: declared.address };
}
export { checkStructure as checkRLUSDStructure, slots as rlusdSlots };
export async function probeRLUSD(url: string, reference = rlusdReference) {
  const startedAt = new Date().toISOString(), rpc = new RLUSDRpc(url, reference);
  const readings: Reading[] = rlusdGetters.map(g => ({ signature: g.signature, readStatus: 'NOT_TESTED', evidenceReferences: [] }));
  let initial: Snapshot | null = null, stage: 'PRECONDITION_ERROR' | 'OBSERVED' | 'PARTIAL' | 'CONSISTENCY_ERROR' = 'PRECONDITION_ERROR';
  const precheckEvidenceReferences: string[] = [], postcheckEvidenceReferences: string[] = [];
  async function structure(tag: string) {
    const before = rpc.evidence.length;
    await rpc.request('eth_getCode', [reference.proxy, tag]);
    for (const slot of slots) await rpc.request('eth_getStorageAt', [reference.proxy, slot, tag]);
    await rpc.request('eth_getCode', [reference.implementation, tag]);
    return checkStructure(rpc.evidence.slice(before), reference, tag);
  }
  try {
    if (await rpc.request('eth_chainId') !== tagOf(reference.networkId)) throw new Error('Wrong chain');
    const tag = await rpc.pin(), header = rpc.evidence.find(e => e.kind === 'BLOCK_REFERENCE')!.data as { number: string; hash: string };
    const verified = await structure(tag);
    initial = { blockNumber: header.number, blockHash: header.hash, ...verified };
    precheckEvidenceReferences.push(...rpc.evidence.map(e => e.id));
    for (const [i, g] of rlusdGetters.entries()) {
      const reading = readings[i]!, before = rpc.evidence.length;
      let raw: unknown;
      try { raw = await rpc.request('eth_call', [{ to: reference.proxy, from: caller, data: g.selector }, tag]); }
      catch (error) { reading.readStatus = 'READ_FAILED'; reading.errorKind = isRevert(error) ? 'REVERT' : error instanceof RpcError ? 'RPC_ERROR' : 'TRANSPORT_ERROR'; }
      if (reading.readStatus !== 'READ_FAILED') {
        try { reading.value = decodeRLUSDWord(raw, g.type); reading.readStatus = 'OK';
          if (roleConstants[g.signature]) reading.candidateConsistency = reading.value === roleConstants[g.signature] ? 'MATCH' : 'MISMATCH';
        } catch { reading.readStatus = 'INVALID_RESPONSE'; }
      }
      reading.evidenceReferences = rpc.evidence.slice(before).map(e => e.id);
    }
    const before = rpc.evidence.length;
    try {
      await structure(tag);
      if (await rpc.request('eth_chainId') !== tagOf(reference.networkId)) throw new Error('Chain changed');
      const header = await rpc.request<any>('eth_getBlockByNumber', [tag, false]);
      if (!header || header.number !== tag || header.hash !== initial.blockHash) throw new Error('Header changed');
      stage = readings.every(r => r.readStatus === 'OK') ? 'OBSERVED' : 'PARTIAL';
    } catch { stage = 'CONSISTENCY_ERROR'; }
    postcheckEvidenceReferences.push(...rpc.evidence.slice(before).map(e => e.id));
  } catch { if (initial) stage = 'CONSISTENCY_ERROR'; }
  if (!initial) precheckEvidenceReferences.push(...rpc.evidence.map(e => e.id));
  return { schemaVersion: '1.0', kind: 'QUALIFIED_RLUSD_CONTROL_PROBE_NOT_ASSESSMENT', reference, caller, sourceEvidence: rlusdSource,
    stage, initial, precheckEvidenceReferences, postcheckEvidenceReferences, readings, skipped, evidence: rpc.evidence,
    requestCount: rpc.evidence.filter(e => ['RPC', 'RPC_ERROR'].includes(e.kind)).length,
    sourceBinding: 'UNKNOWN', authorityState: 'UNKNOWN', support: 'UNKNOWN', issuerVerificationStatus: 'UNKNOWN', nativeOrBridged: 'UNKNOWN',
    verdict: 'INCONCLUSIVE', behaviorExecution: 'NOT_TESTED', startedAt, completedAt: new Date().toISOString(),
    limitations: ['OK means canonical response decoding only, not dispatch, authority, support or behavior verification.',
      'Role IDs are bytes32 responses, not holder addresses; zero is not absence of authority.',
      'User-provided ABI and source differ in initialization names; inherited dependency sources are missing.',
      'Numeric block tags and before/after checks are provider observations, not atomic hash pinning or finality.',
      'Readings under CONSISTENCY_ERROR must not be treated as a coherent snapshot.',
      'Transport keeps only allowlisted hex fields/header fields; malformed success payloads are redacted to null.'] };
}

export function validateRLUSDSource(bytes: Buffer) {
  if (createHash('sha256').update(bytes).digest('hex') !== rlusdSource.sha256) throw new Error('Study hash mismatch');
  const s = JSON.parse(bytes.toString('utf8'));
  if (s.networkId !== '1' || !same(s.proxy, rlusdReference.proxy) || !same(s.historicalDeclaredImplementation, rlusdReference.implementation)
    || s.abi.provenance !== 'USER_PROVIDED_AS_IMPLEMENTATION_ABI' || s.comparison.status !== 'FULL_SOURCE_ABI_IDENTITY_NOT_ESTABLISHED') throw new Error('Study scope mismatch');
  for (const g of rlusdGetters) {
    const c = s.getterCandidates.filter((c: any) => c.signature === g.signature);
    if (c.length !== 1 || c[0].selector !== g.selector || toFunctionSelector(c[0].abiEntry) !== g.selector || toFunctionSelector(g.signature) !== g.selector
      || c[0].inputs.length !== 0 || c[0].outputs.join(',') !== g.type || c[0].stateMutability !== 'view'
      || c[0].abiEntry.inputs.length !== 0 || c[0].abiEntry.outputs.map((o: any) => o.type).join(',') !== g.type || c[0].abiEntry.stateMutability !== 'view') throw new Error('Candidate mismatch');
  }
}
const schema = JSON.parse(readFileSync(new URL('../../schemas/rlusd-control-probe.v1.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);
export function validateRLUSDReport(report: unknown, expectedReference = rlusdReference) {
  if (!validate(report)) throw new Error('Invalid RLUSD probe report');
  const p = report as Awaited<ReturnType<typeof probeRLUSD>>, ids = new Set(p.evidence.map(e => e.id));
  if (JSON.stringify(p.reference) !== JSON.stringify(expectedReference)) throw new Error('Reference mismatch');
  if (ids.size !== p.evidence.length || p.requestCount !== p.evidence.filter(e => ['RPC', 'RPC_ERROR'].includes(e.kind)).length
    || JSON.stringify(p.sourceEvidence) !== JSON.stringify(rlusdSource) || JSON.stringify(p.skipped) !== JSON.stringify(skipped)) throw new Error('Invalid scope/references');
  const refs = [...p.precheckEvidenceReferences, ...p.readings.flatMap(r => r.evidenceReferences), ...p.postcheckEvidenceReferences];
  if (JSON.stringify(refs) !== JSON.stringify(p.evidence.map(e => e.id)) || refs.length !== ids.size || new Set(refs).size !== refs.length || refs.some(id => !ids.has(id))) throw new Error('Unmapped evidence');
  let selectedTag: string | undefined;
  for (const [i, e] of p.evidence.entries()) {
    if (e.id !== `e${i + 1}`) throw new Error('Invalid evidence order');
    if (['RPC', 'RPC_ERROR'].includes(e.kind)) {
      const d = e.data as any;
      if (!d || !Array.isArray(d.params) || !requestAllowed(d.method, d.params, p.reference, selectedTag)) throw new Error('Evidence request outside scope');
      if (e.kind === 'RPC' && d.method === 'eth_blockNumber' && quantity(d.result)) selectedTag = d.result;
    }
  }
  if (p.stage === 'PRECONDITION_ERROR') {
    if (p.initial || p.postcheckEvidenceReferences.length || p.readings.some(r => r.readStatus !== 'NOT_TESTED' || r.evidenceReferences.length)) throw new Error('Invalid precondition failure');
  } else {
    if (!p.initial) throw new Error('Missing initial snapshot');
    const tag = tagOf(p.initial.blockNumber), pre = p.evidence.filter(e => p.precheckEvidenceReferences.includes(e.id));
    const structure = checkStructure(pre, p.reference, tag);
    for (const key of Object.keys(structure) as (keyof typeof structure)[]) if (p.initial[key] !== structure[key]) throw new Error('Invalid structure');
    if (!(pre.some(e => e.kind === 'BLOCK_REFERENCE' && (e.data as any).number === p.initial!.blockNumber && (e.data as any).hash === p.initial!.blockHash)
      && pre.some(e => e.kind === 'RPC' && (e.data as any).method === 'eth_getBlockByNumber' && (e.data as any).params[0] === tag && (e.data as any).result?.number === tag && (e.data as any).result?.hash === p.initial!.blockHash)
      && pre.some(e => e.kind === 'RPC' && (e.data as any).method === 'eth_chainId' && (e.data as any).result === tagOf(p.reference.networkId)))) throw new Error('Invalid block/chain');
    if (['OBSERVED', 'PARTIAL'].includes(p.stage)) {
      const post = p.evidence.filter(e => p.postcheckEvidenceReferences.includes(e.id)); checkStructure(post, p.reference, tag);
      const last = post.at(-1)?.data as any;
      if (last?.method !== 'eth_getBlockByNumber' || last.params[0] !== tag || last.result?.number !== tag || last.result?.hash !== p.initial.blockHash
        || !post.some(e => e.kind === 'RPC' && (e.data as any).method === 'eth_chainId' && (e.data as any).result === tagOf(p.reference.networkId))) throw new Error('Missing final header/chain');
    }
  }
  for (const [i, r] of p.readings.entries()) {
    if (r.signature !== rlusdGetters[i]!.signature) throw new Error('Invalid getter order');
    if (r.readStatus === 'NOT_TESTED') continue;
    const expectedComparison = r.readStatus === 'OK' && roleConstants[r.signature] ? r.value === roleConstants[r.signature] ? 'MATCH' : 'MISMATCH' : undefined;
    if (r.candidateConsistency !== expectedComparison) throw new Error('Invalid candidate comparison');
    const e = p.evidence.find(e => r.evidenceReferences.includes(e.id)), d = e?.data as any, g = rlusdGetters[i]!;
    if (!p.initial || r.evidenceReferences.length !== 1 || d?.method !== 'eth_call'
      || JSON.stringify(d.params) !== JSON.stringify([{ to: p.reference.proxy, from: caller, data: g.selector }, tagOf(p.initial.blockNumber)])) throw new Error('Invalid read context');
    if (r.readStatus === 'OK' && (e?.kind !== 'RPC' || r.value !== decodeRLUSDWord(d.result, g.type))) throw new Error('Invalid decoded value');
    if (r.readStatus === 'READ_FAILED' && (e?.kind !== 'RPC_ERROR' || r.errorKind !== (d.category ?? 'TRANSPORT_ERROR'))) throw new Error('Invalid read failure');
    if (r.readStatus === 'INVALID_RESPONSE') { let invalid = false; try { decodeRLUSDWord(d.result, g.type); } catch { invalid = true; } if (e?.kind !== 'RPC' || !invalid) throw new Error('Invalid response claim'); }
  }
  if (['OBSERVED', 'PARTIAL'].includes(p.stage) && p.readings.some(r => r.readStatus === 'NOT_TESTED')) throw new Error('Missing attempted reads');
  if (p.stage === 'OBSERVED' && p.readings.some(r => r.readStatus !== 'OK') || p.stage === 'PARTIAL' && p.readings.every(r => r.readStatus === 'OK')) throw new Error('Invalid stage');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { values } = parseArgs({ options: { out: { type: 'string' } }, strict: true });
    if (!values.out || !process.env.RPC_URL) throw new Error('Missing configuration');
    validateRLUSDSource(readFileSync(new URL('../../docs/research/rlusd-control-abi-study.json', import.meta.url)));
    const report = await probeRLUSD(process.env.RPC_URL); validateRLUSDReport(report);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(`RLUSD probe: ${report.stage}; ${report.readings.filter(r => r.readStatus === 'OK').length}/7 decoded; ${report.requestCount} requests.\n`);
    if (!['OBSERVED', 'PARTIAL'].includes(report.stage)) process.exitCode = 1;
  })().catch(() => { process.stderr.write('RLUSD probe failed; details omitted.\n'); process.exitCode = 1; });
}
