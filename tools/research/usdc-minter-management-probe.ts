import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Ajv } from 'ajv';
import { type Address, type Hex, keccak256 } from 'viem';
import { Rpc, RpcError, isRevert } from '../../src/evm/rpc.js';
import { writeReportAtomically } from '../../src/report-output.js';
import { probeControlCandidates, validateControlProbe, decodeControlWord, decodeRoleCode, caller, usdcReference, type ProbeReference } from './usdc-control-probe.js';

export const managementGetters = [
  { signature: 'owner()', selector: '0x8da5cb5b' },
  { signature: 'getMinterManager()', selector: '0x9398608b' },
] as const;
export const masterMinterReference = {
  target: '0xE982615d461DD5cD06575BbeA87624fda4e3de17' as Address,
  codeHash: '0x02fdd843a6e0369ab3914b7f7900a2198234700330badd0c59912f81661bb811' as Hex, codeBytes: 7667,
};
type Reference = typeof masterMinterReference;
type Reading = { signature: string; readStatus: 'NOT_TESTED' | 'OK' | 'READ_FAILED' | 'INVALID_RESPONSE'; evidenceReferences: string[]; value?: string; errorKind?: string };

export class ManagementRpc extends Rpc {
  constructor(url: string, private readonly reference: Reference, private readonly proxy: Address, block: string) { super(url); this.block = block; }
  override request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const tag = '0x' + BigInt(this.block).toString(16);
    let allowed = method === 'eth_chainId' && params.length === 0
      || method === 'eth_getBlockByNumber' && params.length === 2 && params[0] === tag && params[1] === false
      || method === 'eth_getCode' && params.length === 2 && params[0] === this.reference.target && params[1] === tag;
    if (method === 'eth_call') {
      const tx = params[0] as any;
      allowed = params.length === 2 && params[1] === tag && tx && Object.keys(tx).sort().join(',') === 'data,from,to' && tx.from === caller
        && ((tx.to === this.reference.target && managementGetters.some(g => g.selector === tx.data))
          || (tx.to === this.proxy && tx.data === '0x35d99f35'));
    }
    if (!allowed) return Promise.reject(new Error('Disallowed management probe request'));
    return super.request<T>(method, params);
  }
}

// Explicit standalone management mode; the original and role-code modes gain
// no calls to role addresses. Evidence IDs in baseProbe and evidence are local.
export async function probeMasterMinterManagement(url: string, options: { baseReference?: ProbeReference; reference?: Reference } = {}) {
  const startedAt = new Date().toISOString(), reference = options.reference ?? masterMinterReference;
  const baseProbe = await probeControlCandidates(url, options.baseReference ?? usdcReference, { roleCode: true });
  validateControlProbe(baseProbe);
  const readings: Reading[] = [...managementGetters.map(g => ({ signature: g.signature, readStatus: 'NOT_TESTED' as const, evidenceReferences: [] })),
    { signature: 'getWorker(address)', readStatus: 'NOT_TESTED', evidenceReferences: [] }];
  const blockNumber = (baseProbe.initial as { blockNumber: string } | null)?.blockNumber ?? '0';
  const rpc = new ManagementRpc(url, reference, baseProbe.reference.proxy, blockNumber);
  let stage: 'PRECONDITION_ERROR' | 'OBSERVED' | 'PARTIAL' | 'CONSISTENCY_ERROR' = 'PRECONDITION_ERROR';
  let reason = 'FRESH_MASTER_MINTER_NOT_ESTABLISHED';
  const role = baseProbe.roleCodeReadings?.find(r => r.signature === 'masterMinter()');
  const gate = ['OBSERVED', 'PARTIAL'].includes(baseProbe.stage) && role?.readStatus === 'OK' && role.consistency === 'MATCH'
    && role.address === reference.target && role.codeHash === reference.codeHash && role.codeBytes === reference.codeBytes;
  if (gate) {
    const initial = baseProbe.initial as { blockNumber: string; blockHash: string }, tag = '0x' + BigInt(initial.blockNumber).toString(16);
    const header = async () => {
      const h = await rpc.request<{ number: string; hash: string }>('eth_getBlockByNumber', [tag, false]);
      if (!h || h.number !== tag || h.hash !== initial.blockHash) throw new Error('Header mismatch');
    };
    const code = async () => {
      const value = decodeRoleCode(await rpc.request('eth_getCode', [reference.target, tag]));
      if (value.codeHash !== reference.codeHash || value.codeBytes !== reference.codeBytes) throw new Error('Code mismatch');
    };
    try {
      if (await rpc.request('eth_chainId') !== '0x' + BigInt(baseProbe.reference.networkId).toString(16)) throw new Error('Network mismatch');
      await header(); await code();
      for (const [i, getter] of managementGetters.entries()) {
        const reading = readings[i]!, before = rpc.evidence.length;
        let raw: unknown;
        try { raw = await rpc.request('eth_call', [{ to: reference.target, from: caller, data: getter.selector }, tag]); }
        catch (error) { reading.readStatus = 'READ_FAILED'; reading.errorKind = isRevert(error) ? 'REVERT' : error instanceof RpcError ? 'RPC_ERROR' : 'TRANSPORT_ERROR'; }
        if (reading.readStatus !== 'READ_FAILED') {
          try { reading.value = decodeControlWord(raw, 'address') as string; reading.readStatus = 'OK'; }
          catch { reading.readStatus = 'INVALID_RESPONSE'; }
        }
        reading.evidenceReferences = rpc.evidence.slice(before).map(e => e.id);
      }
      try {
        const master = await rpc.request('eth_call', [{ to: baseProbe.reference.proxy, from: caller, data: '0x35d99f35' }, tag]);
        if (decodeControlWord(master, 'address') !== reference.target) throw new Error('Role changed');
        await code(); await header();
        stage = readings.slice(0, 2).every(r => r.readStatus === 'OK') ? 'OBSERVED' : 'PARTIAL'; reason = 'RESPONSES_ONLY';
      } catch { stage = 'CONSISTENCY_ERROR'; reason = 'POST_READ_ROLE_CODE_OR_HEADER_NOT_ESTABLISHED'; }
    } catch { reason = 'MANAGEMENT_PRECONDITION_NOT_ESTABLISHED'; }
  }
  return { schemaVersion: '1.0', kind: 'QUALIFIED_MINTER_MANAGEMENT_PROBE_NOT_ASSESSMENT',
    stage, reason, reference, baseProbe, caller, readings, evidence: rpc.evidence, sourceBinding: 'UNKNOWN', authorityState: 'UNKNOWN',
    support: 'UNKNOWN', verdict: 'INCONCLUSIVE', behaviorExecution: 'NOT_TESTED', startedAt, completedAt: new Date().toISOString(),
    limitations: ['Token owner and MasterMinter owner are separate response namespaces; neither authenticates operators or signatures.',
      'getMinterManager returns a pointer, not proof of controller/worker/minter authorization, mint execution or support.',
      'Numeric block tags and before/after checks do not establish atomic hash pinning or finality.',
      'Evidence IDs are local to baseProbe.evidence or evidence; source binding remains UNKNOWN.'] };
}

const schema = JSON.parse(readFileSync(new URL('../../schemas/minter-management-probe.v1.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);
export function validateMinterManagementProbe(report: unknown) {
  if (!validate(report)) throw new Error('Invalid management probe report');
  const p = report as Awaited<ReturnType<typeof probeMasterMinterManagement>>;
  validateControlProbe(p.baseProbe);
  const initial = p.baseProbe.initial as { blockNumber: string; blockHash: string } | null;
  const ids = new Set(p.evidence.map(e => e.id));
  if (ids.size !== p.evidence.length || p.readings[2]!.readStatus !== 'NOT_TESTED') throw new Error('Invalid management evidence');
  for (const [i, reading] of p.readings.entries()) {
    if (reading.signature !== [...managementGetters.map(g => g.signature), 'getWorker(address)'][i]
      || reading.evidenceReferences.some(id => !ids.has(id))) throw new Error('Invalid management reading mapping');
    if (reading.readStatus === 'NOT_TESTED') continue;
    const e = p.evidence.find(e => reading.evidenceReferences.includes(e.id));
    const d = e?.data as any;
    if (!initial || d?.method !== 'eth_call' || d.params?.length !== 2 || d.params[0].to !== p.reference.target
      || d.params[0].from !== caller || d.params[0].data !== managementGetters[i]?.selector
      || BigInt(d.params[1]).toString() !== initial.blockNumber
      || (reading.readStatus === 'OK' && reading.value !== decodeControlWord(d.result, 'address'))) throw new Error('Invalid management read context');
  }
  if (p.stage === 'PRECONDITION_ERROR' && p.readings.some(r => r.readStatus !== 'NOT_TESTED')) throw new Error('Invalid management precondition outcome');
  if (['OBSERVED', 'PARTIAL'].includes(p.stage)) {
    const role = p.baseProbe.roleCodeReadings?.find(r => r.signature === 'masterMinter()');
    const tail = p.evidence.slice(-3).map(e => e.data as any);
    if (!initial || !['OBSERVED', 'PARTIAL'].includes(p.baseProbe.stage) || role?.address !== p.reference.target || role.readStatus !== 'OK' || role.consistency !== 'MATCH'
      || role.codeHash !== p.reference.codeHash || role.codeBytes !== p.reference.codeBytes
      || tail[0]?.method !== 'eth_call' || tail[0].params[0].to !== p.baseProbe.reference.proxy || tail[0].params[0].from !== caller
      || tail[0].params[0].data !== '0x35d99f35' || decodeControlWord(tail[0].result, 'address') !== p.reference.target
      || tail[1]?.method !== 'eth_getCode' || tail[1].params[0] !== p.reference.target || keccak256(tail[1].result) !== p.reference.codeHash
      || tail[2]?.method !== 'eth_getBlockByNumber' || tail[2].result?.hash !== initial.blockHash
      || tail.some(d => BigInt(d.params.at(-1) === false ? d.params[0] : d.params.at(-1)).toString() !== initial.blockNumber)) throw new Error('Missing coherent management recheck');
    if (p.stage === 'OBSERVED' && p.readings.slice(0, 2).some(r => r.readStatus !== 'OK')) throw new Error('Incomplete management result');
  }
}

export function validateManagementSource(proof: any): void {
  if (proof.reference.address !== masterMinterReference.target || proof.reference.runtimeKeccak256 !== masterMinterReference.codeHash
    || proof.service.compilerVersion !== '0.4.24+commit.e67f0147') throw new Error('Source identity mismatch');
  for (const g of managementGetters) if (!proof.getters.some((a: any) => a.signature === g.signature && a.selector === g.selector && a.output === 'address' && a.stateMutability === 'view')) throw new Error('Source ABI mismatch');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { values } = parseArgs({ options: { out: { type: 'string' } }, strict: true });
    if (!values.out || !process.env.RPC_URL) throw new Error('Missing configuration');
    const source = readFileSync(new URL('../../docs/research/usdc-master-minter-source.json', import.meta.url));
    const proof = JSON.parse(source.toString('utf8'));
    validateManagementSource(proof);
    const report = { ...await probeMasterMinterManagement(process.env.RPC_URL), sourceEvidence: {
      reference: '../docs/research/usdc-master-minter-source.json', sha256: createHash('sha256').update(source).digest('hex'),
      scope: 'THIRD_PARTY_0_4_24_ABI_NOT_CURRENT_OFFICIAL_0_6_12_DEPLOYMENT_BINDING' } };
    validateMinterManagementProbe(report);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(`Minter management probe: ${report.stage}; ${report.readings.filter(r => r.readStatus === 'OK').length}/2 decoded.\n`);
    if (!['OBSERVED', 'PARTIAL'].includes(report.stage)) process.exitCode = 1;
  })().catch(() => { process.stderr.write('Minter management probe failed; details omitted.\n'); process.exitCode = 1; });
}
