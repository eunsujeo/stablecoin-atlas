import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Ajv } from 'ajv';
import { keccak256, toFunctionSelector, type Hex } from 'viem';
import { RpcError, isRevert } from '../../src/evm/rpc.js';
import { writeReportAtomically } from '../../src/report-output.js';
import { caller, decodeRoleCode } from './usdc-control-probe.js';
import { BoundedReadRpc } from './bounded-read-rpc.js';
import { usdtReference, usdtSource, probeUSDT, validateUSDTReport, validateUSDTSource, decodeUSDTWord } from './usdt-control-probe.js';
export const sampleGetters = [
  { signature: 'isBlackListed(address)', selector: '0xe47d6060' },
  { signature: 'getBlackListStatus(address)', selector: '0x59bf1abe' },
] as const;
type Base = Awaited<ReturnType<typeof probeUSDT>>;
type Ref = { namespace: 'baseProbe' | 'ownerSample'; id: string };
const refs = (ids: string[], namespace: Ref['namespace'] = 'ownerSample'): Ref[] => ids.map(id => ({ namespace, id }));
const hashBase = (base: Base) => createHash('sha256').update(JSON.stringify(base)).digest('hex');
const tagOf = (n: string) => '0x' + BigInt(n).toString(16);
export function ownerSample(base: Base) {
  const a = base.readings[0]!, b = base.readings[1]!;
  return ['OBSERVED', 'PARTIAL'].includes(base.stage) && a.readStatus === 'OK' && b.readStatus === 'OK' && typeof a.value === 'string'
    && a.value === b.value && !/^0x0{40}$/i.test(a.value) ? { address: a.value, classification: 'CONTROL_ADDRESS_SAMPLE_NOT_SERVICE_OR_CUSTOMER_ACCOUNT',
      selectionReason: 'FRESH_MATCHING_NONZERO_OWNER_GETTER_RESPONSES', baseEvidenceReferences: refs([...a.evidenceReferences, ...b.evidenceReferences], 'baseProbe') } : null;
}
const argument = (address: string) => address.slice(2).toLowerCase().padStart(64, '0');
function allowed(base: Base, method: string, params: unknown[]) {
  const sample = ownerSample(base); if (!sample || !base.initial) return false;
  const fixed = tagOf(base.initial.blockNumber), tx = params[0] as any;
  return method === 'eth_chainId' && params.length === 0
    || method === 'eth_getBlockByNumber' && params.length === 2 && params[0] === fixed && params[1] === false
    || method === 'eth_getCode' && params.length === 2 && [base.reference.target, sample.address].includes(params[0] as string) && params[1] === fixed
    || method === 'eth_call' && params.length === 2 && params[1] === fixed && tx && typeof tx === 'object' && Object.keys(tx).sort().join(',') === 'data,from,to'
      && tx.to === base.reference.target && tx.from === caller
      && (['0x8da5cb5b', '0x893d20e8'].includes(tx.data) || sampleGetters.some(g => tx.data === g.selector + argument(sample.address)));
}
export class OwnerSampleRpc extends BoundedReadRpc {
  private readonly snapshot: Base;
  constructor(url: string, base: Base, reference = usdtReference) {
    validateUSDTReport(base, reference); if (!ownerSample(base)) throw new Error('Fresh matching nonzero owner evidence required');
    super(url); this.snapshot = structuredClone(base); this.block = base.initial!.blockNumber;
  }
  protected override get requestBudget(): number { return 16; }
  override request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    if (!allowed(this.snapshot, method, params)) return Promise.reject(new Error('Owner sample request outside scope'));
    return this.transmit<T>(method, params);
  }
}
type Reading = { signature: string; readStatus: 'NOT_TESTED' | 'OK' | 'READ_FAILED' | 'INVALID_RESPONSE'; evidenceReferences: Ref[]; value?: boolean; errorKind?: string };
type Code = { readStatus: Reading['readStatus']; evidenceReferences: Ref[]; recheckEvidenceReferences: Ref[];
  consistency: 'NOT_CHECKED' | 'MATCH' | 'MISMATCH' | 'NOT_ESTABLISHED'; codePresence?: 'EMPTY' | 'PRESENT'; codeBytes?: number; codeHash?: string; errorKind?: string };
const comparison = (readings: Reading[]) => readings.every(r => r.readStatus === 'OK') ? readings[0]!.value === readings[1]!.value ? 'MATCH' : 'MISMATCH' : 'UNKNOWN';
export async function probeOwnerSample(url: string, reference = usdtReference) {
  const startedAt = new Date().toISOString(), baseProbe = await probeUSDT(url, reference); validateUSDTReport(baseProbe, reference);
  const sample = ownerSample(baseProbe), readings: Reading[] = sampleGetters.map(g => ({ signature: g.signature, readStatus: 'NOT_TESTED', evidenceReferences: [] }));
  const sampleCode: Code = { readStatus: 'NOT_TESTED', evidenceReferences: [], recheckEvidenceReferences: [], consistency: 'NOT_CHECKED' };
  const precheckEvidenceReferences: Ref[] = [], postcheckEvidenceReferences: Ref[] = [], ownerRecheckEvidenceReferences: Ref[] = [];
  let rpc: OwnerSampleRpc | undefined, stage: 'PRECONDITION_ERROR' | 'OBSERVED' | 'PARTIAL' | 'CONSISTENCY_ERROR' = 'PRECONDITION_ERROR';
  let ownerConsistency: 'NOT_CHECKED' | 'MATCH' | 'MISMATCH' | 'NOT_ESTABLISHED' = 'NOT_CHECKED';
  if (sample) {
    rpc = new OwnerSampleRpc(url, baseProbe, reference); const active = rpc, tag = tagOf(baseProbe.initial!.blockNumber);
    async function chain() { if (await active.request('eth_chainId') !== tagOf(reference.networkId)) throw new Error('Chain mismatch'); }
    async function header() { const h = await active.request<any>('eth_getBlockByNumber', [tag, false]); if (!h || h.number !== tag || h.hash !== baseProbe.initial!.blockHash) throw new Error('Header mismatch'); }
    async function tokenCode() { const raw = await active.request('eth_getCode', [reference.target, tag]); if (decodeRoleCode(raw).codePresence !== 'PRESENT' || decodeRoleCode(raw).codeHash !== reference.codeHash) throw new Error('Token code mismatch'); }
    try {
      await chain(); await header(); await tokenCode(); precheckEvidenceReferences.push(...refs(active.evidence.map(e => e.id)));
      let raw: unknown; const before = active.evidence.length;
      try { raw = await active.request('eth_getCode', [sample.address, tag]); }
      catch (e) { sampleCode.readStatus = 'READ_FAILED'; sampleCode.errorKind = e instanceof RpcError ? 'RPC_ERROR' : 'TRANSPORT_ERROR'; }
      if (sampleCode.readStatus !== 'READ_FAILED') { try { Object.assign(sampleCode, decodeRoleCode(raw)); sampleCode.readStatus = 'OK'; } catch { sampleCode.readStatus = 'INVALID_RESPONSE'; } }
      sampleCode.evidenceReferences = refs(active.evidence.slice(before).map(e => e.id));
      for (const [i, g] of sampleGetters.entries()) {
        const r = readings[i]!, start = active.evidence.length; let raw: unknown;
        try { raw = await active.request('eth_call', [{ to: reference.target, from: caller, data: g.selector + argument(sample.address) }, tag]); }
        catch (e) { r.readStatus = 'READ_FAILED'; r.errorKind = isRevert(e) ? 'REVERT' : e instanceof RpcError ? 'RPC_ERROR' : 'TRANSPORT_ERROR'; }
        if (r.readStatus !== 'READ_FAILED') { try { r.value = decodeUSDTWord(raw, 'bool') as boolean; r.readStatus = 'OK'; } catch { r.readStatus = 'INVALID_RESPONSE'; } }
        r.evidenceReferences = refs(active.evidence.slice(start).map(e => e.id));
      }
      const postStart = active.evidence.length;
      try {
        const states: string[] = [];
        for (const selector of ['0x8da5cb5b', '0x893d20e8']) {
          const start = active.evidence.length;
          try { const raw = await active.request('eth_call', [{ to: reference.target, from: caller, data: selector }, tag]); states.push(decodeUSDTWord(raw, 'address') === sample.address ? 'MATCH' : 'MISMATCH'); }
          catch { states.push('NOT_ESTABLISHED'); }
          ownerRecheckEvidenceReferences.push(...refs(active.evidence.slice(start).map(e => e.id)));
        }
        ownerConsistency = states.includes('NOT_ESTABLISHED') ? 'NOT_ESTABLISHED' : states.includes('MISMATCH') ? 'MISMATCH' : 'MATCH';
        if (sampleCode.readStatus === 'OK') {
          const start = active.evidence.length;
          try { const raw = await active.request('eth_getCode', [sample.address, tag]); sampleCode.consistency = decodeRoleCode(raw).codeHash === sampleCode.codeHash ? 'MATCH' : 'MISMATCH'; }
          catch { sampleCode.consistency = 'NOT_ESTABLISHED'; }
          sampleCode.recheckEvidenceReferences = refs(active.evidence.slice(start).map(e => e.id));
        }
        await tokenCode(); await chain(); await header();
        if (ownerConsistency !== 'MATCH' || sampleCode.readStatus === 'OK' && sampleCode.consistency !== 'MATCH') throw new Error('Post consistency failed');
        stage = readings.every(r => r.readStatus === 'OK') && sampleCode.readStatus === 'OK' ? 'OBSERVED' : 'PARTIAL';
      } catch { stage = 'CONSISTENCY_ERROR'; }
      postcheckEvidenceReferences.push(...refs(active.evidence.slice(postStart).map(e => e.id)));
    } catch { precheckEvidenceReferences.push(...refs(active.evidence.map(e => e.id))); }
  }
  const evidence = rpc?.evidence ?? [];
  return { schemaVersion: '1.0', kind: 'QUALIFIED_USDT_OWNER_SAMPLE_PROBE_NOT_ASSESSMENT', sourceEvidence: usdtSource, baseProbe, baseProbeSha256: hashBase(baseProbe),
    sample, stage, caller, sampleCode, readings, blacklistResponseComparison: comparison(readings), ownerConsistency, ownerRecheckEvidenceReferences,
    precheckEvidenceReferences, postcheckEvidenceReferences, evidence, requestCount: evidence.length, totalRequestCount: baseProbe.requestCount + evidence.length,
    requestLimits: { base: 16, ownerSample: 16, total: 32 }, sourceBinding: 'UNKNOWN', authorityState: 'UNKNOWN', support: 'UNKNOWN', issuerVerificationStatus: 'UNKNOWN',
    nativeOrBridged: 'UNKNOWN', verdict: 'INCONCLUSIVE', behaviorExecution: 'NOT_TESTED', startedAt, completedAt: new Date().toISOString(),
    limitations: ['One control-address sample, not a service/customer account or authenticated operator.',
      'Blacklist responses do not establish transfer/approval behavior, universal account policy or future state.',
      'EMPTY/PRESENT code does not establish EOA status, multisig, signer policy, identity or key control.',
      'Evidence namespaces baseProbe and ownerSample differ; base snapshot hash uses JSON.stringify(baseProbe) UTF-8.',
      'No owner function calls, arbitrary accounts, target recursion, storage, overrides, signing or transactions.',
      'Numeric tag/provider checks are not atomic hash pinning/finality; inconsistent responses are not a coherent snapshot.'] };
}
export function validateOwnerSampleSource(raw: Buffer) {
  validateUSDTSource(raw); const s = JSON.parse(raw.toString());
  for (const g of sampleGetters) {
    const hits = s.getterCandidates.filter((c: any) => c.signature === g.signature), c = hits[0];
    if (hits.length !== 1 || c.selector !== g.selector || toFunctionSelector(c.abiEntry) !== g.selector || toFunctionSelector(g.signature) !== g.selector
      || c.inputs.join(',') !== 'address' || c.outputs.join(',') !== 'bool' || c.stateMutability !== 'view' || c.legacyConstant !== true
      || c.abiEntry.constant !== true || c.abiEntry.stateMutability !== 'view' || c.abiEntry.inputs.map((i: any) => i.type).join(',') !== 'address'
      || c.abiEntry.outputs.map((o: any) => o.type).join(',') !== 'bool') throw new Error('Blacklist candidate mismatch');
  }
}
const schema = JSON.parse(readFileSync(new URL('../../schemas/usdt-owner-sample-probe.v1.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);
export function validateOwnerSampleReport(report: unknown, reference = usdtReference) {
  if (!validate(report)) throw new Error('Invalid owner sample report');
  const p = report as Awaited<ReturnType<typeof probeOwnerSample>>; validateUSDTReport(p.baseProbe, reference);
  if (p.baseProbeSha256 !== hashBase(p.baseProbe) || JSON.stringify(p.sourceEvidence) !== JSON.stringify(usdtSource) || JSON.stringify(p.sample) !== JSON.stringify(ownerSample(p.baseProbe))
    || p.requestCount !== p.evidence.length || p.totalRequestCount !== p.baseProbe.requestCount + p.requestCount || p.blacklistResponseComparison !== comparison(p.readings)
    || Date.parse(p.baseProbe.startedAt) < Date.parse(p.startedAt) || Date.parse(p.baseProbe.completedAt) > Date.parse(p.completedAt)) throw new Error('Owner sample/base binding mismatch');
  const primary = [...p.precheckEvidenceReferences, ...p.sampleCode.evidenceReferences, ...p.readings.flatMap(r => r.evidenceReferences), ...p.postcheckEvidenceReferences];
  if (JSON.stringify(primary) !== JSON.stringify(refs(p.evidence.map(e => e.id)))) throw new Error('Owner sample namespace/partition mismatch');
  for (const [i, e] of p.evidence.entries()) if (e.id !== `e${i + 1}` || !['RPC', 'RPC_ERROR'].includes(e.kind) || !allowed(p.baseProbe, (e.data as any).method, (e.data as any).params)) throw new Error('Owner sample scope mismatch');
  const select = (references: Ref[]) => references.map(r => { const e = p.evidence.find(e => r.namespace === 'ownerSample' && e.id === r.id); if (!e) throw new Error('Invalid sample reference'); return e; });
  const tag = p.baseProbe.initial ? tagOf(p.baseProbe.initial.blockNumber) : '0x0';
  function frame(references: Ref[], post: boolean) {
    const ev = select(references).slice(-3), methods = post ? ['eth_getCode', 'eth_chainId', 'eth_getBlockByNumber'] : ['eth_chainId', 'eth_getBlockByNumber', 'eth_getCode'];
    if (ev.length !== 3 || ev.some((e, i) => e.kind !== 'RPC' || (e.data as any).method !== methods[i])) throw new Error('Missing sample frame');
    for (const e of ev) {
      const d = e.data as any;
      if (d.method === 'eth_chainId' && d.result !== tagOf(reference.networkId)) throw new Error('Wrong sample chain');
      if (d.method === 'eth_getBlockByNumber' && (d.result?.number !== tag || d.result?.hash !== p.baseProbe.initial!.blockHash)) throw new Error('Wrong sample header');
      if (d.method === 'eth_getCode' && (d.params[0] !== reference.target || decodeRoleCode(d.result).codeHash !== reference.codeHash)) throw new Error('Wrong sample token code');
    }
  }
  if (p.stage === 'PRECONDITION_ERROR') {
    if (p.sampleCode.readStatus !== 'NOT_TESTED' || p.sampleCode.evidenceReferences.length || p.readings.some(r => r.readStatus !== 'NOT_TESTED' || r.evidenceReferences.length)
      || p.postcheckEvidenceReferences.length || p.ownerRecheckEvidenceReferences.length || p.ownerConsistency !== 'NOT_CHECKED') throw new Error('Invalid untested sample');
  } else {
    if (!p.sample) throw new Error('Missing sample'); frame(p.precheckEvidenceReferences, false);
    if (['OBSERVED', 'PARTIAL'].includes(p.stage)) {
      frame(p.postcheckEvidenceReferences, true);
      if (p.ownerConsistency !== 'MATCH' || p.readings.some(r => r.readStatus === 'NOT_TESTED') || p.sampleCode.readStatus === 'NOT_TESTED'
        || p.sampleCode.readStatus === 'OK' && p.sampleCode.consistency !== 'MATCH') throw new Error('Missing sample consistency');
    }
  }
  const checkRead = (references: Ref[], method: string, params: unknown[]) => {
    const ev = select(references); if (ev.length !== 1 || (ev[0]!.data as any).method !== method || JSON.stringify((ev[0]!.data as any).params) !== JSON.stringify(params)) throw new Error('Wrong sample read context'); return ev[0]!;
  };
  for (const [i, r] of p.readings.entries()) {
    if (r.signature !== sampleGetters[i]!.signature) throw new Error('Wrong sample getter');
    if (r.readStatus === 'NOT_TESTED') continue;
    const e = checkRead(r.evidenceReferences, 'eth_call', [{ to: reference.target, from: caller, data: sampleGetters[i]!.selector + argument(p.sample!.address) }, tag]), d = e.data as any;
    if (r.readStatus === 'OK' && (e.kind !== 'RPC' || r.value !== decodeUSDTWord(d.result, 'bool'))) throw new Error('Wrong sample bool');
    if (r.readStatus === 'READ_FAILED' && (e.kind !== 'RPC_ERROR' || r.errorKind !== (d.category ?? 'TRANSPORT_ERROR'))) throw new Error('Wrong sample error');
    if (r.readStatus === 'INVALID_RESPONSE') { let bad = false; try { decodeUSDTWord(d.result, 'bool'); } catch { bad = true; } if (e.kind !== 'RPC' || !bad) throw new Error('Wrong invalid sample bool'); }
  }
  const c = p.sampleCode;
  if (c.readStatus !== 'NOT_TESTED') {
    const e = checkRead(c.evidenceReferences, 'eth_getCode', [p.sample!.address, tag]), d = e.data as any;
    if (c.readStatus === 'OK') {
      const decoded = decodeRoleCode(d.result);
      if (e.kind !== 'RPC' || decoded.codePresence !== c.codePresence || decoded.codeBytes !== c.codeBytes || decoded.codeHash !== c.codeHash) throw new Error('Sample code decoding mismatch');
      if (c.recheckEvidenceReferences.length) {
        const re = checkRead(c.recheckEvidenceReferences, 'eth_getCode', [p.sample!.address, tag]); let expected = 'NOT_ESTABLISHED';
        try { if (re.kind === 'RPC') expected = decodeRoleCode((re.data as any).result).codeHash === c.codeHash ? 'MATCH' : 'MISMATCH'; } catch { /* Invalid code is not EMPTY. */ }
        if (c.consistency !== expected) throw new Error('Sample code consistency mismatch');
      } else if (c.consistency !== 'NOT_CHECKED') throw new Error('Missing code recheck');
    } else {
      if (c.consistency !== 'NOT_CHECKED' || c.recheckEvidenceReferences.length) throw new Error('Failed code cannot claim recheck');
      if (c.readStatus === 'READ_FAILED' && (e.kind !== 'RPC_ERROR' || c.errorKind !== (d.category === 'REVERT' ? 'RPC_ERROR' : d.category ?? 'TRANSPORT_ERROR'))) throw new Error('Wrong code error');
      if (c.readStatus === 'INVALID_RESPONSE') { let bad = false; try { decodeRoleCode(d.result); } catch { bad = true; } if (e.kind !== 'RPC' || !bad) throw new Error('Wrong invalid code'); }
    }
  }
  if (p.ownerRecheckEvidenceReferences.length) {
    if (p.ownerRecheckEvidenceReferences.length !== 2) throw new Error('Wrong owner recheck count');
    const states = ['0x8da5cb5b', '0x893d20e8'].map((data, i) => {
      const e = checkRead([p.ownerRecheckEvidenceReferences[i]!], 'eth_call', [{ to: reference.target, from: caller, data }, tag]);
      try { return e.kind === 'RPC' ? decodeUSDTWord((e.data as any).result, 'address') === p.sample!.address ? 'MATCH' : 'MISMATCH' : 'NOT_ESTABLISHED'; } catch { return 'NOT_ESTABLISHED'; }
    });
    const expected = states.includes('NOT_ESTABLISHED') ? 'NOT_ESTABLISHED' : states.includes('MISMATCH') ? 'MISMATCH' : 'MATCH';
    if (p.ownerConsistency !== expected) throw new Error('Wrong owner consistency');
  } else if (p.ownerConsistency !== 'NOT_CHECKED') throw new Error('Missing owner rechecks');
  const postIds = new Set(p.postcheckEvidenceReferences.map(r => r.id));
  for (const r of [...c.recheckEvidenceReferences, ...p.ownerRecheckEvidenceReferences]) if (!postIds.has(r.id) || p.evidence.findIndex(e => e.id === r.id) <= p.evidence.findIndex(e => e.id === c.evidenceReferences[0]?.id)) throw new Error('Wrong post sample namespace/order');
  const allOK = c.readStatus === 'OK' && p.readings.every(r => r.readStatus === 'OK');
  if (p.stage === 'OBSERVED' && !allOK || p.stage === 'PARTIAL' && allOK) throw new Error('Wrong sample stage');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { values } = parseArgs({ options: { out: { type: 'string' } }, strict: true });
    if (!values.out || !process.env.RPC_URL) throw new Error('Missing configuration');
    validateOwnerSampleSource(readFileSync(new URL('../../docs/research/usdt-control-provenance.json', import.meta.url)));
    const report = await probeOwnerSample(process.env.RPC_URL); validateOwnerSampleReport(report);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(`USDT owner sample: ${report.stage}; ${report.readings.filter(r => r.readStatus === 'OK').length}/2 decoded; ${report.totalRequestCount} requests.\n`);
    if (!['OBSERVED', 'PARTIAL'].includes(report.stage)) process.exitCode = 1;
  })().catch(() => { process.stderr.write('USDT owner sample failed; details omitted.\n'); process.exitCode = 1; });
}
