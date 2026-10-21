import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { getAddress, keccak256, type Address, type Hex } from 'viem';
import { Ajv } from 'ajv';
import { Rpc, RpcError, isRevert } from '../../src/evm/rpc.js';
import { inspectProxy, proxySlots } from '../../src/evm/proxy.js';
import { writeReportAtomically } from '../../src/report-output.js';

export const getters = [
  { signature: 'owner()', selector: '0x8da5cb5b', type: 'address' },
  { signature: 'pauser()', selector: '0x9fd0506d', type: 'address' },
  { signature: 'paused()', selector: '0x5c975abb', type: 'bool' },
  { signature: 'blacklister()', selector: '0xbd102430', type: 'address' },
  { signature: 'masterMinter()', selector: '0x35d99f35', type: 'address' },
] as const;
export const caller = '0x0000000000000000000000000000000000000000' as Address;
export interface ProbeReference {
  networkId: string; proxy: Address; implementation: Address; proxyCodeHash: Hex; implementationCodeHash: Hex;
}
export const usdcReference: ProbeReference = {
  networkId: '1', proxy: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  implementation: '0x43506849D7C04F9138D1A2050bbF3A0c054402dd',
  proxyCodeHash: '0xd80d4b7c890cb9d6a4893e6b52bc34b56b25335cb13716e0d1d31383e6b41505',
  implementationCodeHash: '0xcdfb7d322961af3acae7a8f7ee8b69c205b36f576cc5b077f170c7eb8ecbe3ea',
};
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const hexCode = (x: unknown): x is Hex => typeof x === 'string' && /^0x(?:[a-f0-9]{2})+$/i.test(x);
export const roleSignatures = ['owner()', 'pauser()', 'blacklister()', 'masterMinter()'] as const;
export const maxRoleCodeBytes = 131072;
export function decodeRoleCode(raw: unknown) {
  if (typeof raw !== 'string' || raw.length > maxRoleCodeBytes * 2 + 2 || !/^0x(?:[a-f0-9]{2})*$/i.test(raw)) throw new Error('Invalid role code');
  return { codePresence: raw.length === 2 ? 'EMPTY' as const : 'PRESENT' as const,
    codeBytes: (raw.length - 2) / 2, codeHash: keccak256(raw as Hex) };
}

// No send/sign/state-override methods, alternate callers or arbitrary calldata.
export class ControlProbeRpc extends Rpc {
  private readonly roleCodeAddresses = new Set<string>();
  constructor(url: string, private readonly reference: ProbeReference) { super(url); }
  registerRoleCodeAddress(signature: string, address: Address): void {
    if (!roleSignatures.includes(signature as typeof roleSignatures[number]) || !this.evidence.some(e => {
      const d = e.data as { method?: string; params?: any[]; result?: unknown };
      if (e.kind !== 'RPC' || d.method !== 'eth_call' || d.params?.[0]?.data !== getters.find(g => g.signature === signature)?.selector
        || d.params?.[0]?.to !== this.reference.proxy || d.params?.[0]?.from !== caller
        || this.block === 'UNKNOWN' || d.params?.[1] !== '0x' + BigInt(this.block).toString(16)) return false;
      try { return decodeControlWord(d.result, 'address') === address; } catch { return false; }
    })) throw new Error('Role address requires fresh canonical getter evidence');
    this.roleCodeAddresses.add(address.toLowerCase());
  }
  override async request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const tag = this.block === 'UNKNOWN' ? undefined : '0x' + BigInt(this.block).toString(16);
    let allowed = method === 'eth_chainId' && params.length === 0
      || method === 'eth_blockNumber' && params.length === 0
      || method === 'eth_getBlockByNumber' && params.length === 2 && typeof params[0] === 'string'
        && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(params[0]) && params[1] === false;
    if (method === 'eth_getCode') allowed = params.length === 2 && tag !== undefined && params[1] === tag
      && typeof params[0] === 'string' && ([this.reference.proxy, this.reference.implementation].some(a => same(a, params[0] as string))
        || this.roleCodeAddresses.has(params[0].toLowerCase()));
    if (method === 'eth_getStorageAt') allowed = params.length === 3 && tag !== undefined && params[2] === tag
      && params[0] === this.reference.proxy && Object.values(proxySlots).includes(params[1] as typeof proxySlots.implementation);
    if (method === 'eth_call') {
      const tx = params[0] as Record<string, unknown> | undefined;
      allowed = params.length === 2 && tag !== undefined && params[1] === tag && !!tx && typeof tx === 'object'
        && Object.keys(tx).sort().join(',') === 'data,from,to' && tx.from === caller && tx.to === this.reference.proxy
        && getters.some(g => g.selector === tx.data);
    }
    if (!allowed) throw new Error('Disallowed control probe request');
    return this.sendRequest<T>(method, params);
  }
  protected sendRequest<T>(method: string, params: unknown[]): Promise<T> { return super.request<T>(method, params); }
}

export function decodeControlWord(raw: unknown, type: 'address' | 'bool'): string | boolean {
  if (typeof raw !== 'string' || !/^0x[0-9a-f]{64}$/i.test(raw)) throw new Error('Invalid control word');
  if (type === 'bool') {
    if (BigInt(raw) !== 0n && BigInt(raw) !== 1n) throw new Error('Noncanonical bool');
    return BigInt(raw) === 1n;
  }
  if (!/^0x0{24}/i.test(raw)) throw new Error('Dirty address word');
  return getAddress('0x' + raw.slice(-40));
}

type Reading = { signature: string; readStatus: 'NOT_TESTED' | 'OK' | 'READ_FAILED' | 'INVALID_RESPONSE';
  evidenceReferences: string[]; value?: string | boolean; errorKind?: string };
type RoleCodeReading = {
  signature: string; readStatus: Reading['readStatus']; address?: Address; getterEvidenceReferences: string[];
  evidenceReferences: string[]; recheckEvidenceReferences: string[];
  consistency: 'NOT_CHECKED' | 'MATCH' | 'MISMATCH' | 'NOT_ESTABLISHED';
  codePresence?: 'EMPTY' | 'PRESENT'; codeBytes?: number; codeHash?: Hex; errorKind?: string;
};

// A probe is deliberately separate from AssessmentReport and scenario verdicts.
export async function probeControlCandidates(url: string, reference = usdcReference, options: { roleCode?: boolean; rpc?: ControlProbeRpc } = {}) {
  const rpc = options.rpc ?? new ControlProbeRpc(url, reference), startedAt = new Date().toISOString();
  const readings: Reading[] = [...getters.map(g => ({ signature: g.signature, readStatus: 'NOT_TESTED' as const, evidenceReferences: [] })),
    { signature: 'isBlacklisted(address)', readStatus: 'NOT_TESTED', evidenceReferences: [] }];
  const roleCodeReadings: RoleCodeReading[] = options.roleCode ? roleSignatures.map(signature => ({ signature,
    readStatus: 'NOT_TESTED', getterEvidenceReferences: [], evidenceReferences: [], recheckEvidenceReferences: [], consistency: 'NOT_CHECKED' })) : [];
  let stage: 'PRECONDITION_ERROR' | 'READY' | 'OBSERVED' | 'PARTIAL' | 'CONSISTENCY_ERROR' = 'PRECONDITION_ERROR';
  let reason = 'PRECONDITIONS_NOT_ESTABLISHED', initial: unknown = null;
  async function structure(block: Hex) {
    const code = await rpc.request('eth_getCode', [reference.proxy, block]);
    if (!hexCode(code) || keccak256(code) !== reference.proxyCodeHash) throw new Error('Reference mismatch');
    const proxy = await inspectProxy(rpc, reference.proxy, code, block);
    if (proxy.implementationAddress.status !== 'KNOWN' || !same(proxy.implementationAddress.value, reference.implementation)) throw new Error('Reference mismatch');
    const implementation = await rpc.request('eth_getCode', [reference.implementation, block]);
    if (!hexCode(implementation) || keccak256(implementation) !== reference.implementationCodeHash) throw new Error('Reference mismatch');
    return { proxyCodeHash: keccak256(code), implementationCodeHash: keccak256(implementation), proxy };
  }
  try {
    if (await rpc.request('eth_chainId') !== '0x' + BigInt(reference.networkId).toString(16)) throw new Error('Network mismatch');
    const block = await rpc.pin() as Hex;
    const header = rpc.evidence.find(e => e.kind === 'BLOCK_REFERENCE')!.data as { number: string; hash: string };
    initial = { blockNumber: header.number, blockHash: header.hash, ...await structure(block) };
    stage = 'READY';
    for (const [index, getter] of getters.entries()) {
      const reading = readings[index]!, before = rpc.evidence.length;
      let raw: unknown;
      try { raw = await rpc.request('eth_call', [{ to: reference.proxy, from: caller, data: getter.selector }, block]); }
      catch (error) {
        reading.readStatus = 'READ_FAILED';
        reading.errorKind = isRevert(error) ? 'REVERT' : error instanceof RpcError ? 'RPC_ERROR' : 'TRANSPORT_ERROR';
      }
      if (reading.readStatus !== 'READ_FAILED') {
        try { reading.value = decodeControlWord(raw, getter.type); reading.readStatus = 'OK'; }
        catch { reading.readStatus = 'INVALID_RESPONSE'; }
      }
      reading.evidenceReferences = rpc.evidence.slice(before).map(e => e.id);
    }
    for (const role of roleCodeReadings) {
      const reading = readings.find(r => r.signature === role.signature)!;
      if (reading.readStatus !== 'OK' || typeof reading.value !== 'string') continue;
      role.address = reading.value as Address; role.getterEvidenceReferences = [...reading.evidenceReferences];
      rpc.registerRoleCodeAddress(role.signature, role.address);
      const before = rpc.evidence.length;
      let raw: unknown;
      try { raw = await rpc.request('eth_getCode', [role.address, block]); }
      catch (error) { role.readStatus = 'READ_FAILED'; role.errorKind = error instanceof RpcError ? 'RPC_ERROR' : 'TRANSPORT_ERROR'; }
      if (role.readStatus !== 'READ_FAILED') {
        try { Object.assign(role, decodeRoleCode(raw)); role.readStatus = 'OK'; }
        catch { role.readStatus = 'INVALID_RESPONSE'; }
      }
      role.evidenceReferences = rpc.evidence.slice(before).map(e => e.id);
    }
    try {
      const after = await rpc.request<{ number: string; hash: string }>('eth_getBlockByNumber', [block, false]);
      if (!after || after.number !== block || after.hash !== header.hash) throw new Error('Header changed');
      await structure(block);
      let coherent = true;
      for (const role of roleCodeReadings.filter(r => r.readStatus === 'OK')) {
        const before = rpc.evidence.length;
        try {
          const raw = await rpc.request('eth_getCode', [role.address, block]);
          role.consistency = decodeRoleCode(raw).codeHash === role.codeHash ? 'MATCH' : 'MISMATCH';
        } catch { role.consistency = 'NOT_ESTABLISHED'; }
        role.recheckEvidenceReferences = rpc.evidence.slice(before).map(e => e.id);
        coherent &&= role.consistency === 'MATCH';
      }
      if (options.roleCode) {
        const finalHeader = await rpc.request<{ number: string; hash: string }>('eth_getBlockByNumber', [block, false]);
        if (!finalHeader || finalHeader.number !== block || finalHeader.hash !== header.hash) coherent = false;
      }
      if (!coherent) throw new Error('Role code consistency not established');
      stage = readings.slice(0, 5).every(r => r.readStatus === 'OK') && roleCodeReadings.every(r => r.readStatus === 'OK') ? 'OBSERVED' : 'PARTIAL'; reason = 'READ_RESPONSES_ONLY';
    } catch { stage = 'CONSISTENCY_ERROR'; reason = 'POST_READ_HEADER_OR_CODE_NOT_ESTABLISHED'; }
  } catch {
    stage = initial === null ? 'PRECONDITION_ERROR' : 'CONSISTENCY_ERROR';
    reason = initial === null ? 'NETWORK_BLOCK_OR_REFERENCE_NOT_ESTABLISHED' : 'POST_READ_HEADER_OR_CODE_NOT_ESTABLISHED';
  }
  return {
    schemaVersion: '1.0', kind: 'QUALIFIED_CONTROL_READ_PROBE_NOT_ASSESSMENT',
    reference, caller, sourceBinding: 'UNKNOWN', verdict: 'INCONCLUSIVE', support: 'UNKNOWN', authorityState: 'UNKNOWN',
    issuerVerificationStatus: 'UNKNOWN', nativeOrBridged: 'UNKNOWN', behaviorExecution: 'NOT_TESTED',
    stage, reason, initial, readings, ...(options.roleCode ? { roleCodeReadings } : {}), evidence: rpc.evidence, startedAt, completedAt: new Date().toISOString(),
    limitations: ['OK means canonical response decoding only; source binding, dispatch, authorization and asset support are unverified.',
      'Numeric block tags and before/after checks do not establish atomic hash pinning, absence of reorg or finality.',
      'Zero caller is explicit context; isBlacklisted has no account sample and remains NOT_TESTED.',
      'Readings under CONSISTENCY_ERROR are retained as raw evidence and must not be treated as a coherent state snapshot.',
      ...(options.roleCode ? ['Role code EMPTY/PRESENT does not establish EOA status, operator identity, multisig, delegation target or authority.'] : [])],
  };
}

const schema = JSON.parse(readFileSync(new URL('../../schemas/control-read-probe.v1.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);
export function validateControlProbe(probe: unknown): void {
  if (!validate(probe)) throw new Error('Invalid control probe report');
  const p = probe as Awaited<ReturnType<typeof probeControlCandidates>>;
  const ids = new Set(p.evidence.map(e => e.id));
  if (ids.size !== p.evidence.length || p.readings.some((r, i) => r.signature !== [...getters.map(g => g.signature), 'isBlacklisted(address)'][i]
    || r.evidenceReferences.some(id => !ids.has(id)) || (r.readStatus !== 'NOT_TESTED' && r.evidenceReferences.length === 0))
    || p.readings[5]!.readStatus !== 'NOT_TESTED'
    || (p.stage === 'PRECONDITION_ERROR' && p.readings.some(r => r.readStatus !== 'NOT_TESTED'))
    || (p.stage === 'OBSERVED' && p.readings.slice(0, 5).some(r => r.readStatus !== 'OK'))) throw new Error('Inconsistent control probe report');
  for (const [i, reading] of p.readings.entries()) {
    if (reading.readStatus === 'NOT_TESTED') continue;
    const evidence = p.evidence.find(e => reading.evidenceReferences.includes(e.id) && ['RPC', 'RPC_ERROR'].includes(e.kind));
    const data = evidence?.data as { method: string; params: any[]; result?: unknown } | undefined;
    const initial = p.initial as { blockNumber: string } | null;
    if (!data || !initial || data.method !== 'eth_call' || data.params.length !== 2
      || data.params[0].to !== p.reference.proxy || data.params[0].from !== caller || data.params[0].data !== getters[i]?.selector
      || BigInt(data.params[1]).toString() !== initial.blockNumber
      || (reading.readStatus === 'OK' && reading.value !== decodeControlWord(data.result, getters[i]!.type))) throw new Error('Invalid control read evidence');
  }
  if (p.roleCodeReadings) for (const [i, role] of p.roleCodeReadings.entries()) {
    const getter = p.readings.find(r => r.signature === role.signature)!;
    if (role.signature !== roleSignatures[i] || !getter
      || [...role.getterEvidenceReferences, ...role.evidenceReferences, ...role.recheckEvidenceReferences].some(id => !ids.has(id))) throw new Error('Invalid role code mapping');
    if (role.readStatus === 'NOT_TESTED') {
      if (role.address || role.getterEvidenceReferences.length || role.evidenceReferences.length || role.recheckEvidenceReferences.length
        || role.consistency !== 'NOT_CHECKED' || (getter.readStatus === 'OK' && p.stage !== 'CONSISTENCY_ERROR')) throw new Error('Invalid untested role code');
      continue;
    }
    if (getter.readStatus !== 'OK' || getter.value !== role.address
      || JSON.stringify(getter.evidenceReferences) !== JSON.stringify(role.getterEvidenceReferences)) throw new Error('Role code lacks getter provenance');
    function codeEvidence(references: string[]) {
      const e = p.evidence.find(e => references.includes(e.id) && ['RPC', 'RPC_ERROR'].includes(e.kind));
      const d = e?.data as { method: string; params: any[]; result?: unknown } | undefined;
      const initial = p.initial as { blockNumber: string } | null;
      if (!d || !initial || d.method !== 'eth_getCode' || d.params.length !== 2 || d.params[0] !== role.address
        || BigInt(d.params[1]).toString() !== initial.blockNumber) throw new Error('Invalid role code evidence');
      return d.result;
    }
    const raw = codeEvidence(role.evidenceReferences);
    if (role.readStatus === 'OK') {
      const decoded = decodeRoleCode(raw);
      if (decoded.codePresence !== role.codePresence || decoded.codeBytes !== role.codeBytes || decoded.codeHash !== role.codeHash) throw new Error('Role code decoding mismatch');
      if (role.consistency === 'MATCH' || role.consistency === 'MISMATCH') {
        const after = decodeRoleCode(codeEvidence(role.recheckEvidenceReferences));
        if ((after.codeHash === role.codeHash) !== (role.consistency === 'MATCH')
          || p.evidence.findIndex(e => role.recheckEvidenceReferences.includes(e.id)) <= p.evidence.findIndex(e => role.evidenceReferences.includes(e.id))) throw new Error('Role code recheck mismatch');
      }
      if (['OBSERVED', 'PARTIAL'].includes(p.stage) && role.consistency !== 'MATCH') throw new Error('Role code consistency missing');
      if (['MISMATCH', 'NOT_ESTABLISHED'].includes(role.consistency) && p.stage !== 'CONSISTENCY_ERROR') throw new Error('Role code error hidden');
    } else if (role.consistency !== 'NOT_CHECKED' || role.recheckEvidenceReferences.length) throw new Error('Failed role code cannot be rechecked as success');
  }
  if (p.roleCodeReadings && p.stage === 'OBSERVED' && p.roleCodeReadings.some(r => r.readStatus !== 'OK')) throw new Error('Incomplete role code observation');
  if (p.roleCodeReadings && ['OBSERVED', 'PARTIAL'].includes(p.stage)) {
    const last = p.evidence.findLast(e => ['RPC', 'RPC_ERROR'].includes(e.kind))?.data as any;
    const initial = p.initial as { blockNumber: string; blockHash: string } | null;
    if (!initial || last?.method !== 'eth_getBlockByNumber' || last.params.length !== 2 || last.params[1] !== false
      || BigInt(last.params[0]).toString() !== initial.blockNumber || last.result?.number !== last.params[0]
      || last.result?.hash !== initial.blockHash) throw new Error('Missing final role snapshot header');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { values } = parseArgs({ options: { out: { type: 'string' }, 'role-code': { type: 'boolean' } }, strict: true });
    if (!values.out || !process.env.RPC_URL) throw new Error('Missing configuration');
    const binding = readFileSync(new URL('../../docs/research/usdc-source-binding.json', import.meta.url));
    const source = JSON.parse(binding.toString('utf8'));
    for (const getter of getters) {
      const entry = source.verificationServiceStudy.localRecompilation.getterCandidates.find((g: any) => g.signature === getter.signature);
      if (!entry || entry.selector !== getter.selector || entry.outputs.join(',') !== getter.type || entry.stateMutability !== 'view') throw new Error('Candidate ABI mismatch');
    }
    const report = { ...await probeControlCandidates(process.env.RPC_URL, usdcReference, { roleCode: values['role-code'] ?? false }), sourceEvidence: {
      reference: '../docs/research/usdc-source-binding.json', sha256: createHash('sha256').update(binding).digest('hex'),
      scope: 'REGENERATED_CANDIDATE_ABI_NOT_EXACT_SOURCE_BINDING', getters,
    } };
    validateControlProbe(report);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(`Control probe: ${report.stage}; ${report.readings.filter(r => r.readStatus === 'OK').length}/5 decoded.\n`);
    if (!['OBSERVED', 'PARTIAL'].includes(report.stage)) process.exitCode = 1;
  })().catch(() => { process.stderr.write('Control probe failed; details omitted.\n'); process.exitCode = 1; });
}
