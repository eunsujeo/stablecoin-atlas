import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Ajv } from 'ajv';
import { toFunctionSelector } from 'viem';
import { writeReportAtomically } from '../../src/report-output.js';
import { proxySlots } from '../../src/evm/proxy.js';
import { BoundedReadRpc } from './bounded-read-rpc.js';
import { caller, getters, ControlProbeRpc, probeControlCandidates, validateControlProbe, decodeControlWord, decodeRoleCode, usdcReference, type ProbeReference } from './usdc-control-probe.js';
type Base = Awaited<ReturnType<typeof probeControlCandidates>>;
type Ref = { namespace: 'baseProbe' | 'ownerSample'; id: string };
type Step = { method: string; params: unknown[]; expected?: unknown };
const digest = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const tagOf = (s: string) => '0x' + BigInt(s).toString(16);
export const ownerSampleSource = { reference: '../docs/research/usdc-source-binding.json', sha256: '381ca255492df62b9491901d16b9a129a3523f71d228c89e6eef8b7b5b8c5484', scope: 'REGENERATED_CANDIDATE_ABI_NOT_EXACT_SOURCE_BINDING',
  signature: 'isBlacklisted(address)', selector: '0xfe575a87', input: 'address', output: 'bool', stateMutability: 'view' };
function baseAllowed(reference: ProbeReference, block: string, method: string, params: unknown[]) {
  const tag = block === 'UNKNOWN' ? null : tagOf(block), tx = params[0] as any;
  return ['eth_chainId', 'eth_blockNumber'].includes(method) && params.length === 0
    || method === 'eth_getBlockByNumber' && params.length === 2 && typeof params[0] === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(params[0]) && params[1] === false && (tag === null || params[0] === tag)
    || method === 'eth_getCode' && params.length === 2 && params[1] === tag && [reference.proxy, reference.implementation].includes(params[0] as any)
    || method === 'eth_getStorageAt' && params.length === 3 && params[0] === reference.proxy && Object.values(proxySlots).includes(params[1] as any) && params[2] === tag
    || method === 'eth_call' && params.length === 2 && params[1] === tag && tx && Object.keys(tx).sort().join(',') === 'data,from,to' && tx.to === reference.proxy && tx.from === caller && getters.some(g => g.selector === tx.data);
}
// Both the existing control guard and this mode's fixed bounded guard apply.
export class BoundedOwnerBaseRpc extends ControlProbeRpc {
  private readonly transport: BoundedReadRpc;
  constructor(url: string, reference = usdcReference) {
    const snapshot = structuredClone(reference); super(url, snapshot); const parent = this;
    this.transport = new class extends BoundedReadRpc {
      protected override get requestBudget() { return 32; }
      override request<T>(method: string, params: unknown[] = []): Promise<T> {
        if (!baseAllowed(snapshot, parent.block, method, params)) return Promise.reject(new Error('Base request outside scope'));
        this.block = parent.block; return this.transmit<T>(method, params);
      }
    }(url);
  }
  protected override async sendRequest<T>(method: string, params: unknown[]): Promise<T> {
    const before = this.transport.evidence.length;
    try { return await this.transport.request<T>(method, params); }
    finally { for (const e of this.transport.evidence.slice(before)) this.record(e.kind, structuredClone(e.data), e.observedBlockOrSlot); }
  }
}
const rpcEvents = (base: Base) => base.evidence.filter(e => ['RPC', 'RPC_ERROR'].includes(e.kind));
function validateBase(base: Base, reference: ProbeReference) {
  validateControlProbe(base);
  if (!equal(base.reference, reference) || base.roleCodeReadings || rpcEvents(base).length > 32) throw new Error('Invalid owner sample base');
}
export function selectOwnerSample(base: Base) {
  const r = base.readings[0]!;
  return ['OBSERVED', 'PARTIAL'].includes(base.stage) && r.readStatus === 'OK' && typeof r.value === 'string' && !/^0x0{40}$/i.test(r.value)
    ? { address: r.value, classification: 'CONTROL_ADDRESS_SAMPLE_NOT_SERVICE_OR_CUSTOMER_ACCOUNT', selectionReason: 'FRESH_NONZERO_OWNER_GETTER_RESPONSE',
      baseEvidenceReferences: r.evidenceReferences.map(id => ({ namespace: 'baseProbe' as const, id })) } : null;
}
function plan(base: Base): { pre: Step[]; read: Step; post: Step[] } {
  const initial = base.initial as { blockNumber: string; blockHash: string }, tag = tagOf(initial.blockNumber), ref = base.reference, owner = selectOwnerSample(base)!;
  const header: Step = { method: 'eth_getBlockByNumber', params: [tag, false], expected: { number: tag, hash: initial.blockHash } };
  const chain: Step = { method: 'eth_chainId', params: [], expected: tagOf(ref.networkId) };
  const code: Step[] = [{ method: 'eth_getCode', params: [ref.proxy, tag], expected: ref.proxyCodeHash }, { method: 'eth_getCode', params: [ref.implementation, tag], expected: ref.implementationCodeHash }];
  const storage = Object.values(proxySlots).map(slot => {
    const e = base.evidence.find(e => e.kind === 'RPC' && (e.data as any).method === 'eth_getStorageAt' && (e.data as any).params[1] === slot);
    const raw = (e?.data as any)?.result;
    if (typeof raw !== 'string' || !/^0x[0-9a-f]{64}$/i.test(raw)) throw new Error('Missing canonical source slot');
    return { method: 'eth_getStorageAt', params: [ref.proxy, slot, tag], expected: raw };
  });
  const call = (data: string): Step => ({ method: 'eth_call', params: [{ to: ref.proxy, from: caller, data }, tag] });
  const ownerStep = { ...call('0x8da5cb5b'), expected: owner.address };
  return { pre: [chain, header, ...code, ...storage, ownerStep], read: call(ownerSampleSource.selector + owner.address.slice(2).toLowerCase().padStart(64, '0')),
    post: [ownerStep, ...code, ...storage, chain, header] };
}
function matches(step: Step, raw: unknown) {
  try {
    if (step.method === 'eth_getCode') return decodeRoleCode(raw).codePresence === 'PRESENT' && decodeRoleCode(raw).codeHash === step.expected;
    if (step.method === 'eth_call') return decodeControlWord(raw, 'address') === step.expected;
    return equal(raw, step.expected);
  } catch { return false; }
}
export class OwnerBlacklistRpc extends BoundedReadRpc {
  private readonly steps: Step[];
  constructor(url: string, base: Base, reference = usdcReference) {
    validateBase(base, reference); if (!selectOwnerSample(base)) throw new Error('Fresh nonzero owner required');
    super(url); const frozen = structuredClone(base), p = plan(frozen); this.steps = [...p.pre, p.read, ...p.post]; this.block = (frozen.initial as any).blockNumber;
  }
  protected override get requestBudget() { return 24; }
  override request<T>(method: string, params: unknown[] = []): Promise<T> {
    if (!this.steps.some(s => s.method === method && equal(s.params, params))) return Promise.reject(new Error('Sample request outside scope'));
    return this.transmit<T>(method, params);
  }
}
function derive(base: Base, evidence: BoundedReadRpc['evidence']) {
  const sample = selectOwnerSample(base), none = { stage: 'PRECONDITION_ERROR', readStatus: 'NOT_TESTED', evidenceReferences: [] as Ref[], precheckEvidenceReferences: [] as Ref[], postcheckEvidenceReferences: [] as Ref[] };
  if (!sample) { if (evidence.length) throw new Error('Unadmitted sample evidence'); return none; }
  const p = plan(base), refs = (start: number, end: number): Ref[] => evidence.slice(start, end).map(e => ({ namespace: 'ownerSample', id: e.id }));
  const all = [...p.pre, p.read, ...p.post]; if (evidence.length > all.length) throw new Error('Excess sample evidence');
  for (const [i, e] of evidence.entries()) {
    const d = e.data as any, step = all[i]!;
    if (e.id !== `e${i + 1}` || !['RPC', 'RPC_ERROR'].includes(e.kind) || d.method !== step.method || !equal(d.params, step.params)) throw new Error('Wrong sample scope/order');
  }
  const frameOK = (i: number) => evidence[i]?.kind === 'RPC' && matches(all[i]!, (evidence[i]!.data as any).result);
  const failedPre = p.pre.findIndex((_, i) => !frameOK(i));
  if (failedPre !== -1) {
    if (evidence.length !== failedPre && evidence.length !== failedPre + 1) throw new Error('Calls after precondition failure');
    return { ...none, precheckEvidenceReferences: refs(0, evidence.length) };
  }
  const read = evidence[p.pre.length];
  if (!read) throw new Error('Missing sample read');
  const reading: { readStatus: string; value?: boolean; errorKind?: string } = { readStatus: 'INVALID_RESPONSE' };
  if (read.kind === 'RPC_ERROR') { reading.readStatus = 'READ_FAILED'; reading.errorKind = (read.data as any).category ?? 'TRANSPORT_ERROR'; }
  else { try { reading.value = decodeControlWord((read.data as any).result, 'bool') as boolean; reading.readStatus = 'OK'; } catch { /* Keep malformed distinct from false. */ } }
  const postStart = p.pre.length + 1;
  const failedPost = p.post.findIndex((_, i) => !frameOK(postStart + i));
  if (failedPost !== -1 && evidence.length !== postStart + failedPost && evidence.length !== postStart + failedPost + 1) throw new Error('Calls after consistency failure');
  return { stage: failedPost === -1 ? reading.readStatus === 'OK' ? 'OBSERVED' : 'PARTIAL' : 'CONSISTENCY_ERROR', ...reading,
    evidenceReferences: refs(p.pre.length, postStart), precheckEvidenceReferences: refs(0, p.pre.length), postcheckEvidenceReferences: refs(postStart, evidence.length) };
}
export async function probeUSDCOwnerSample(url: string, reference = usdcReference) {
  const startedAt = new Date().toISOString(), baseProbe = await probeControlCandidates(url, reference, { rpc: new BoundedOwnerBaseRpc(url, reference) }); validateBase(baseProbe, reference);
  const sample = selectOwnerSample(baseProbe); let rpc: OwnerBlacklistRpc | undefined;
  if (sample) {
    rpc = new OwnerBlacklistRpc(url, baseProbe, reference); const p = plan(baseProbe);
    try {
      for (const s of p.pre) if (!matches(s, await rpc.request(s.method, s.params))) throw new Error('Precondition failed');
      try { await rpc.request(p.read.method, p.read.params); } catch { /* Preserve individual failure, still check frame. */ }
      for (const s of p.post) if (!matches(s, await rpc.request(s.method, s.params))) throw new Error('Consistency failed');
    } catch { /* Derive stage from ordered bounded evidence. */ }
  }
  const evidence = rpc?.evidence ?? [], result = derive(baseProbe, evidence);
  return { schemaVersion: '1.0', kind: 'QUALIFIED_USDC_OWNER_SAMPLE_PROBE_NOT_ASSESSMENT', sourceEvidence: ownerSampleSource,
    baseProbe, baseProbeSha256: digest(JSON.stringify(baseProbe)), sample, ...result, evidence,
    requestCount: evidence.length, baseRequestCount: rpcEvents(baseProbe).length, totalRequestCount: rpcEvents(baseProbe).length + evidence.length,
    requestLimits: { base: 32, ownerSample: 24, total: 56 }, caller, sourceBinding: 'UNKNOWN', authorityState: 'UNKNOWN', support: 'UNKNOWN', issuerVerificationStatus: 'UNKNOWN', nativeOrBridged: 'UNKNOWN', verdict: 'INCONCLUSIVE', behaviorExecution: 'NOT_TESTED',
    startedAt, completedAt: new Date().toISOString(), limitations: ['Owner response selects one control-address sample; it does not authenticate an operator or a service/customer account.',
      'Blacklist response does not prove transfer/approval permission, actual restriction execution or future state.', 'Numeric tag/provider checks are not atomic hash pinning or finality.',
      'No owner-target functions, arbitrary accounts, role membership, recursive discovery, overrides, signing or transactions.', 'baseProbe and ownerSample evidence namespaces differ; base hash is JSON.stringify(baseProbe) UTF-8 SHA-256.'] };
}
export function validateUSDCBlacklistSource(raw: Buffer) {
  if (digest(raw) !== ownerSampleSource.sha256 || toFunctionSelector(ownerSampleSource.signature) !== ownerSampleSource.selector) throw new Error('Source binding changed');
  const candidates = JSON.parse(raw.toString()).verificationServiceStudy.localRecompilation.getterCandidates;
  for (const g of [...getters, { signature: ownerSampleSource.signature, selector: ownerSampleSource.selector, type: 'bool' }]) {
    const hits = candidates.filter((g2: any) => g2.signature === g.signature);
    if (hits.length !== 1 || hits[0].selector !== g.selector || hits[0].outputs.join(',') !== g.type || hits[0].stateMutability !== 'view') throw new Error('Source candidate mismatch');
  }
}
const schema = JSON.parse(readFileSync(new URL('../../schemas/usdc-owner-sample-probe.v1.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);
export function validateUSDCOwnerSample(report: unknown, reference = usdcReference) {
  if (!validate(report)) throw new Error('Invalid USDC owner sample schema');
  const p = report as Awaited<ReturnType<typeof probeUSDCOwnerSample>>; validateBase(p.baseProbe, reference);
  const expected = derive(p.baseProbe, p.evidence);
  for (const [key, value] of Object.entries(expected)) if (!equal((p as any)[key], value)) throw new Error('Wrong sample derivation');
  if (!equal(p.sample, selectOwnerSample(p.baseProbe)) || !equal(p.sourceEvidence, ownerSampleSource) || p.baseProbeSha256 !== digest(JSON.stringify(p.baseProbe))
    || p.requestCount !== p.evidence.length || p.baseRequestCount !== rpcEvents(p.baseProbe).length || p.totalRequestCount !== p.baseRequestCount + p.requestCount
    || Date.parse(p.startedAt) > Date.parse(p.baseProbe.startedAt) || Date.parse(p.baseProbe.completedAt) > Date.parse(p.completedAt)
    || (Object.hasOwn(p, 'value') !== Object.hasOwn(expected, 'value')) || (Object.hasOwn(p, 'errorKind') !== Object.hasOwn(expected, 'errorKind'))) throw new Error('Wrong sample/base binding');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { values } = parseArgs({ options: { out: { type: 'string' } }, strict: true });
    if (!values.out || !process.env.RPC_URL) throw new Error('Missing configuration');
    validateUSDCBlacklistSource(readFileSync(new URL('../../docs/research/usdc-source-binding.json', import.meta.url)));
    const report = await probeUSDCOwnerSample(process.env.RPC_URL); validateUSDCOwnerSample(report);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(`USDC owner sample: ${report.stage}; ${report.readStatus}; ${report.totalRequestCount} requests.\n`);
    if (!['OBSERVED', 'PARTIAL'].includes(report.stage)) process.exitCode = 1;
  })().catch(() => { process.stderr.write('USDC owner sample failed; details omitted.\n'); process.exitCode = 1; });
}
