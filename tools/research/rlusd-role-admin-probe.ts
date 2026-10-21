import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Ajv } from 'ajv';
import { toFunctionSelector } from 'viem';
import { RpcError, isRevert } from '../../src/evm/rpc.js';
import { writeReportAtomically } from '../../src/report-output.js';
import { caller, type ProbeReference } from './usdc-control-probe.js';
import { RLUSDRpc, rlusdReference, rlusdSource, rlusdGetters, rlusdSlots, checkRLUSDStructure, probeRLUSD,
  validateRLUSDReport, validateRLUSDSource, decodeRLUSDWord } from './rlusd-control-probe.js';
export const roleAdminGetter = { signature: 'getRoleAdmin(bytes32)', selector: '0x248a9ca3', inputs: ['bytes32'], outputs: ['bytes32'], stateMutability: 'view' } as const;
type Base = Awaited<ReturnType<typeof probeRLUSD>>;
const roles = rlusdGetters.slice(1);
const tagOf = (n: string) => '0x' + BigInt(n).toString(16);
const hashBase = (base: Base) => createHash('sha256').update(JSON.stringify(base)).digest('hex');
type Ref = { namespace: 'baseProbe' | 'roleAdmin'; id: string };
const references = (ids: string[], namespace: Ref['namespace']): Ref[] => ids.map(id => ({ namespace, id }));
function observedRoles(base: Base) {
  return roles.map(g => {
    const r = base.readings.find(r => r.signature === g.signature)!;
    return { signature: g.signature, selector: g.selector, roleId: r.readStatus === 'OK' && typeof r.value === 'string' ? r.value : undefined,
      baseEvidenceReferences: references(r.evidenceReferences, 'baseProbe') };
  });
}
function gated(base: Base) { return ['OBSERVED', 'PARTIAL'].includes(base.stage) && observedRoles(base).every(r => r.roleId !== undefined); }
function allowed(base: Base, method: string, params: unknown[]) {
  if (!gated(base) || !base.initial) return false;
  const tag = tagOf(base.initial.blockNumber), ref = base.reference, tx = params[0] as any;
  return method === 'eth_chainId' && params.length === 0
    || method === 'eth_getBlockByNumber' && params.length === 2 && params[0] === tag && params[1] === false
    || method === 'eth_getCode' && params.length === 2 && [ref.proxy, ref.implementation].includes(params[0] as any) && params[1] === tag
    || method === 'eth_getStorageAt' && params.length === 3 && params[0] === ref.proxy && rlusdSlots.includes(params[1] as any) && params[2] === tag
    || method === 'eth_call' && params.length === 2 && params[1] === tag && tx && typeof tx === 'object'
      && Object.keys(tx).sort().join(',') === 'data,from,to' && tx.to === ref.proxy && tx.from === caller
      && (roles.some(g => tx.data === g.selector) || observedRoles(base).some(r => tx.data === roleAdminGetter.selector + r.roleId!.slice(2)));
}
// Only this subclass can use the protected bounded transport; base mode stays unchanged.
export class RoleAdminRpc extends RLUSDRpc {
  private readonly snapshot: Base;
  constructor(url: string, base: Base, expectedReference = rlusdReference) {
    validateRLUSDReport(base, expectedReference);
    if (!gated(base)) throw new Error('Fresh coherent role IDs required');
    super(url, base.reference); this.snapshot = structuredClone(base);
    this.block = this.snapshot.initial!.blockNumber;
  }
  protected override get requestBudget(): number { return 32; }
  override request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    if (!allowed(this.snapshot, method, params)) return Promise.reject(new Error('Role-admin request outside scope'));
    return this.transmit<T>(method, params);
  }
}
type Row = { signature: string; roleId?: string; baseEvidenceReferences: Ref[]; readStatus: 'NOT_TESTED' | 'OK' | 'READ_FAILED' | 'INVALID_RESPONSE';
  evidenceReferences: Ref[]; adminRoleId?: string; selfAdmin?: boolean; adminRoleMatches?: string[]; errorKind?: string;
  recheckEvidenceReferences: Ref[]; roleIdConsistency: 'NOT_CHECKED' | 'MATCH' | 'MISMATCH' | 'NOT_ESTABLISHED' };
export async function probeRoleAdmins(url: string, reference = rlusdReference) {
  const startedAt = new Date().toISOString(), baseProbe = await probeRLUSD(url, reference);
  validateRLUSDReport(baseProbe, reference);
  const sourceRoles = observedRoles(baseProbe);
  const rows: Row[] = sourceRoles.map(r => ({ signature: r.signature, ...(r.roleId !== undefined ? { roleId: r.roleId } : {}),
    baseEvidenceReferences: r.baseEvidenceReferences, readStatus: 'NOT_TESTED', evidenceReferences: [], recheckEvidenceReferences: [], roleIdConsistency: 'NOT_CHECKED' }));
  const precheckEvidenceReferences: Ref[] = [], postcheckEvidenceReferences: Ref[] = [];
  let stage: 'PRECONDITION_ERROR' | 'OBSERVED' | 'PARTIAL' | 'CONSISTENCY_ERROR' = 'PRECONDITION_ERROR';
  let rpc: RoleAdminRpc | undefined;
  if (gated(baseProbe)) {
    rpc = new RoleAdminRpc(url, baseProbe, reference);
    const tag = tagOf(baseProbe.initial!.blockNumber), active = rpc;
    async function header() {
      const h = await active.request<any>('eth_getBlockByNumber', [tag, false]);
      if (!h || h.number !== tag || h.hash !== baseProbe.initial!.blockHash) throw new Error('Header mismatch');
    }
    async function chain() { if (await active.request('eth_chainId') !== tagOf(reference.networkId)) throw new Error('Chain mismatch'); }
    async function structure() {
      const before = active.evidence.length;
      await active.request('eth_getCode', [reference.proxy, tag]);
      for (const slot of rlusdSlots) await active.request('eth_getStorageAt', [reference.proxy, slot, tag]);
      await active.request('eth_getCode', [reference.implementation, tag]);
      checkRLUSDStructure(active.evidence.slice(before), reference, tag);
    }
    try {
      await chain(); await header(); await structure();
      precheckEvidenceReferences.push(...references(active.evidence.map(e => e.id), 'roleAdmin'));
      for (const row of rows) {
        const before = active.evidence.length;
        let raw: unknown;
        try { raw = await active.request('eth_call', [{ to: reference.proxy, from: caller, data: roleAdminGetter.selector + row.roleId!.slice(2) }, tag]); }
        catch (e) { row.readStatus = 'READ_FAILED'; row.errorKind = isRevert(e) ? 'REVERT' : e instanceof RpcError ? 'RPC_ERROR' : 'TRANSPORT_ERROR'; }
        if (row.readStatus !== 'READ_FAILED') {
          try {
            row.adminRoleId = decodeRLUSDWord(raw, 'bytes32') as string; row.readStatus = 'OK'; row.selfAdmin = row.adminRoleId === row.roleId;
            row.adminRoleMatches = sourceRoles.filter(r => r.roleId === row.adminRoleId).map(r => r.signature);
          } catch { row.readStatus = 'INVALID_RESPONSE'; }
        }
        row.evidenceReferences = references(active.evidence.slice(before).map(e => e.id), 'roleAdmin');
      }
      const before = active.evidence.length;
      try {
        for (const [i, row] of rows.entries()) {
          const start = active.evidence.length;
          try {
            const raw = await active.request('eth_call', [{ to: reference.proxy, from: caller, data: roles[i]!.selector }, tag]);
            row.roleIdConsistency = decodeRLUSDWord(raw, 'bytes32') === row.roleId ? 'MATCH' : 'MISMATCH';
          } catch { row.roleIdConsistency = 'NOT_ESTABLISHED'; }
          row.recheckEvidenceReferences = references(active.evidence.slice(start).map(e => e.id), 'roleAdmin');
        }
        await structure(); await chain(); await header();
        if (rows.some(r => r.roleIdConsistency !== 'MATCH')) throw new Error('Role ID consistency failed');
        stage = rows.every(r => r.readStatus === 'OK') ? 'OBSERVED' : 'PARTIAL';
      } catch { stage = 'CONSISTENCY_ERROR'; }
      postcheckEvidenceReferences.push(...references(active.evidence.slice(before).map(e => e.id), 'roleAdmin'));
    } catch { precheckEvidenceReferences.push(...references(active.evidence.map(e => e.id), 'roleAdmin')); }
  }
  const evidence = rpc?.evidence ?? [];
  return { schemaVersion: '1.0', kind: 'QUALIFIED_RLUSD_ROLE_ADMIN_PROBE_NOT_ASSESSMENT', sourceEvidence: rlusdSource, getter: roleAdminGetter,
    stage, baseProbe, baseProbeSha256: hashBase(baseProbe), caller, rows, precheckEvidenceReferences, postcheckEvidenceReferences, evidence,
    requestCount: evidence.length, totalRequestCount: baseProbe.requestCount + evidence.length, requestLimits: { base: 24, roleAdmin: 32, total: 56 },
    sourceBinding: 'UNKNOWN', authorityState: 'UNKNOWN', support: 'UNKNOWN', issuerVerificationStatus: 'UNKNOWN', nativeOrBridged: 'UNKNOWN',
    verdict: 'INCONCLUSIVE', membershipExecution: 'NOT_TESTED', behaviorExecution: 'NOT_TESTED', startedAt, completedAt: new Date().toISOString(),
    limitations: ['Admin role IDs and self relations are response observations, not holders, signatures, key control, or authority exercise.',
      'Zero ID is a valid role identifier; no absent-authority/root-owner inference is made.',
      'No recursive traversal, account sampling, role membership, initialization, upgrade, signing or broadcast.',
      'Evidence namespaces baseProbe and roleAdmin are distinct; baseProbeSha256 hashes JSON.stringify(baseProbe) UTF-8.',
      'Numeric block tags and before/after checks do not establish an atomic hash-pinned snapshot or finality.',
      'Source/ABI initialization-name differences, missing inherited dependencies and user-provided ABI provenance remain unresolved.'] };
}
export function validateRoleAdminSource(bytes: Buffer) {
  validateRLUSDSource(bytes);
  const study = JSON.parse(bytes.toString()), hits = study.getterCandidates.filter((c: any) => c.signature === roleAdminGetter.signature);
  const c = hits[0];
  if (hits.length !== 1 || c.selector !== roleAdminGetter.selector || toFunctionSelector(c.abiEntry) !== roleAdminGetter.selector
    || toFunctionSelector(roleAdminGetter.signature) !== roleAdminGetter.selector || c.inputs.join(',') !== 'bytes32' || c.outputs.join(',') !== 'bytes32'
    || c.stateMutability !== 'view' || c.abiEntry.inputs.map((x: any) => x.type).join(',') !== 'bytes32'
    || c.abiEntry.outputs.map((x: any) => x.type).join(',') !== 'bytes32' || c.abiEntry.stateMutability !== 'view') throw new Error('Role admin ABI mismatch');
}
const schema = JSON.parse(readFileSync(new URL('../../schemas/rlusd-role-admin-probe.v1.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);
export function validateRoleAdminReport(report: unknown, reference = rlusdReference) {
  if (!validate(report)) throw new Error('Invalid role admin report');
  const p = report as Awaited<ReturnType<typeof probeRoleAdmins>>;
  validateRLUSDReport(p.baseProbe, reference);
  if (p.baseProbeSha256 !== hashBase(p.baseProbe) || JSON.stringify(p.sourceEvidence) !== JSON.stringify(rlusdSource)
    || JSON.stringify(p.getter) !== JSON.stringify(roleAdminGetter) || p.requestCount !== p.evidence.length
    || p.totalRequestCount !== p.baseProbe.requestCount + p.requestCount || Date.parse(p.baseProbe.startedAt) < Date.parse(p.startedAt)
    || Date.parse(p.baseProbe.completedAt) > Date.parse(p.completedAt)) throw new Error('Invalid base binding/count');
  const observed = observedRoles(p.baseProbe);
  const primary = [...p.precheckEvidenceReferences, ...p.rows.flatMap(r => r.evidenceReferences), ...p.postcheckEvidenceReferences];
  if (JSON.stringify(primary) !== JSON.stringify(references(p.evidence.map(e => e.id), 'roleAdmin'))) throw new Error('Invalid namespace/partition');
  for (const [i, e] of p.evidence.entries()) if (e.id !== `e${i + 1}` || !['RPC', 'RPC_ERROR'].includes(e.kind)
    || !allowed(p.baseProbe, (e.data as any).method, (e.data as any).params)) throw new Error('Invalid scoped evidence');
  const select = (refs: Ref[]) => refs.map(r => {
    if (r.namespace !== 'roleAdmin') throw new Error('Namespace mismatch');
    const e = p.evidence.find(e => e.id === r.id); if (!e) throw new Error('Missing evidence'); return e;
  });
  const tag = p.baseProbe.initial ? tagOf(p.baseProbe.initial.blockNumber) : '0x0';
  function checkFrame(refs: Ref[]) {
    const ev = select(refs); checkRLUSDStructure(ev, reference, tag);
    if (!ev.some(e => e.kind === 'RPC' && (e.data as any).method === 'eth_chainId' && (e.data as any).result === tagOf(reference.networkId))
      || !ev.some(e => e.kind === 'RPC' && (e.data as any).method === 'eth_getBlockByNumber' && (e.data as any).result?.number === tag
        && (e.data as any).result?.hash === p.baseProbe.initial!.blockHash)) throw new Error('Invalid frame');
  }
  if (p.stage === 'PRECONDITION_ERROR') {
    if (p.rows.some(r => r.readStatus !== 'NOT_TESTED' || r.evidenceReferences.length || r.recheckEvidenceReferences.length || r.roleIdConsistency !== 'NOT_CHECKED')
      || p.postcheckEvidenceReferences.length) throw new Error('Precondition cannot claim reads');
  } else {
    if (!gated(p.baseProbe)) throw new Error('Missing role gate'); checkFrame(p.precheckEvidenceReferences);
    if (['OBSERVED', 'PARTIAL'].includes(p.stage)) {
      checkFrame(p.postcheckEvidenceReferences);
      const last = p.evidence.at(-1)?.data as any;
      if (last?.method !== 'eth_getBlockByNumber' || last.result?.hash !== p.baseProbe.initial!.blockHash
        || p.rows.some(r => r.roleIdConsistency !== 'MATCH' || r.readStatus === 'NOT_TESTED')) throw new Error('Final consistency missing');
    }
  }
  for (const [i, row] of p.rows.entries()) {
    const origin = observed[i]!;
    if (row.signature !== origin.signature || row.roleId !== origin.roleId || JSON.stringify(row.baseEvidenceReferences) !== JSON.stringify(origin.baseEvidenceReferences)) throw new Error('Role provenance mismatch');
    const reads = select(row.evidenceReferences);
    if (row.readStatus === 'NOT_TESTED') { if (reads.length) throw new Error('Unexpected untested read'); continue; }
    if (!row.roleId || reads.length !== 1) throw new Error('Invalid role read');
    const e = reads[0]!, d = e.data as any;
    if (JSON.stringify(d.params) !== JSON.stringify([{ to: reference.proxy, from: caller, data: roleAdminGetter.selector + row.roleId.slice(2) }, tag])) throw new Error('Wrong role calldata');
    if (row.readStatus === 'OK') {
      if (e.kind !== 'RPC' || decodeRLUSDWord(d.result, 'bytes32') !== row.adminRoleId || row.selfAdmin !== (row.roleId === row.adminRoleId)
        || JSON.stringify(row.adminRoleMatches) !== JSON.stringify(observed.filter(r => r.roleId === row.adminRoleId).map(r => r.signature))) throw new Error('Wrong admin interpretation');
    } else if (row.readStatus === 'READ_FAILED') {
      if (e.kind !== 'RPC_ERROR' || row.errorKind !== (d.category ?? 'TRANSPORT_ERROR')) throw new Error('Wrong read error');
    } else {
      let invalid = false; try { decodeRLUSDWord(d.result, 'bytes32'); } catch { invalid = true; }
      if (e.kind !== 'RPC' || !invalid) throw new Error('Wrong invalid status');
    }
    const recheck = select(row.recheckEvidenceReferences);
    if (!recheck.length) { if (row.roleIdConsistency !== 'NOT_CHECKED') throw new Error('Missing role recheck'); continue; }
    const check = recheck[0]!, raw = check.data as any;
    if (recheck.length !== 1 || !p.postcheckEvidenceReferences.some(r => r.namespace === 'roleAdmin' && r.id === check.id)
      || p.evidence.indexOf(check) <= p.evidence.indexOf(e)
      || JSON.stringify(raw.params) !== JSON.stringify([{ to: reference.proxy, from: caller, data: roles[i]!.selector }, tag])) throw new Error('Wrong role recheck context');
    let expected = 'NOT_ESTABLISHED';
    try { if (check.kind === 'RPC') expected = decodeRLUSDWord(raw.result, 'bytes32') === row.roleId ? 'MATCH' : 'MISMATCH'; } catch { /* Invalid recheck is not a changed role ID. */ }
    if (row.roleIdConsistency !== expected) throw new Error('Wrong role consistency');
  }
  if (p.stage === 'OBSERVED' && p.rows.some(r => r.readStatus !== 'OK') || p.stage === 'PARTIAL' && p.rows.every(r => r.readStatus === 'OK')) throw new Error('Wrong report stage');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { values } = parseArgs({ options: { out: { type: 'string' } }, strict: true });
    if (!values.out || !process.env.RPC_URL) throw new Error('Missing configuration');
    validateRoleAdminSource(readFileSync(new URL('../../docs/research/rlusd-control-abi-study.json', import.meta.url)));
    const report = await probeRoleAdmins(process.env.RPC_URL); validateRoleAdminReport(report);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(`RLUSD role-admin probe: ${report.stage}; ${report.rows.filter(r => r.readStatus === 'OK').length}/6 decoded; ${report.totalRequestCount} requests.\n`);
    if (!['OBSERVED', 'PARTIAL'].includes(report.stage)) process.exitCode = 1;
  })().catch(() => { process.stderr.write('RLUSD role-admin probe failed; details omitted.\n'); process.exitCode = 1; });
}
