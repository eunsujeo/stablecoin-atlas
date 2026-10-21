import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Ajv } from 'ajv';
import { getAddress, toEventSelector } from 'viem';
import { writeReportAtomically } from '../../src/report-output.js';
import { RLUSDRpc, rlusdReference, rlusdSource } from './rlusd-control-probe.js';
export const deploymentReference = {
  networkId: '1', proxy: rlusdReference.proxy, transactionHash: '0x811c963004b19c2e3724850cda6bffd7cab7ff8f34d5670f86b51a9e1390327d',
  blockNumber: '20492031', transactionIndex: '276', maxCandidates: 3,
};
export const deploymentSource = { reference: '../docs/research/rlusd-deployment-reference.json', sha256: 'f1a9a77083c85e4177828b18689c63005234626ef1afd48e1ac6bcadcb1614ba',
  abiStudySha256: rlusdSource.sha256, abiSha256: '1c6162c1c6c910396f782747b2efef57b6ae97fb3d93e13f86be4246f9c6630d' };
const topic = toEventSelector('RoleGranted(bytes32,address,address)');
const tag = '0x' + BigInt(deploymentReference.blockNumber).toString(16);
const index = '0x' + BigInt(deploymentReference.transactionIndex).toString(16);
const isHash = (x: unknown): x is string => typeof x === 'string' && /^0x[0-9a-f]{64}$/i.test(x);
const isAddress = (x: unknown): x is string => typeof x === 'string' && /^0x[0-9a-f]{40}$/i.test(x);
const quantity = (x: unknown): x is string => typeof x === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i.test(x);
const byteString = (x: unknown): x is string => typeof x === 'string' && x.length <= 16386 && /^0x(?:[0-9a-f]{2})*$/i.test(x);
const eq = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
function safe(key: string, x: unknown): unknown {
  if (['from', 'to', 'contractAddress', 'address'].includes(key)) return x === null ? null : isAddress(x) ? x : 'INVALID';
  if (['hash', 'blockHash', 'transactionHash'].includes(key)) return isHash(x) ? x : 'INVALID';
  if (['number', 'blockNumber', 'transactionIndex', 'logIndex', 'status'].includes(key)) return quantity(x) ? x : 'INVALID';
  if (key === 'data') return byteString(x) ? x : 'INVALID';
  if (key === 'removed') return typeof x === 'boolean' ? x : 'INVALID';
  if (key === 'topics') return Array.isArray(x) && x.length <= 4 && x.every(isHash) ? x : 'INVALID';
  return 'INVALID';
}
function pick(x: any, keys: string[]) {
  return x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(keys.filter(k => Object.hasOwn(x, k)).map(k => [k, safe(k, x[k])])) : null;
}
function allowed(method: string, params: unknown[]) {
  return method === 'eth_chainId' && params.length === 0
    || ['eth_getTransactionReceipt', 'eth_getTransactionByHash'].includes(method) && params.length === 1 && params[0] === deploymentReference.transactionHash
    || method === 'eth_getBlockByNumber' && params.length === 2 && params[0] === tag && params[1] === false;
}
export class DeploymentCandidateRpc extends RLUSDRpc {
  constructor(url: string) { super(url, rlusdReference); }
  protected override get requestBudget(): number { return 8; }
  protected override projectResult(method: string, raw: any): unknown {
    if (method === 'eth_getBlockByNumber') {
      const h = pick(raw, ['number', 'hash']);
      return h ? { ...h, transactions: Array.isArray(raw.transactions) && raw.transactions.length <= 4096 && raw.transactions.every(isHash) ? raw.transactions : null } : null;
    }
    if (method === 'eth_getTransactionByHash') return pick(raw, ['hash', 'blockNumber', 'blockHash', 'transactionIndex', 'from', 'to']);
    if (method === 'eth_getTransactionReceipt') {
      const r = pick(raw, ['transactionHash', 'blockNumber', 'blockHash', 'transactionIndex', 'from', 'to', 'status', 'contractAddress']);
      return r ? { ...r, logs: Array.isArray(raw.logs) && raw.logs.length <= 128 ? raw.logs.map((l: any) => pick(l,
        ['address', 'topics', 'data', 'blockNumber', 'blockHash', 'transactionHash', 'transactionIndex', 'logIndex', 'removed'])) : null } : null;
    }
    return super.projectResult(method, raw);
  }
  override request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    if (!allowed(method, params)) return Promise.reject(new Error('Deployment candidate request outside scope'));
    return this.transmit<T>(method, params);
  }
}
export function corroborateDeployment(receipt: any, tx: any, header: any) {
  if (!receipt || !tx || !header || !isHash(receipt.blockHash) || receipt.status !== '0x1'
    || !eq(receipt.transactionHash, deploymentReference.transactionHash) || !eq(tx.hash, receipt.transactionHash)
    || receipt.blockNumber !== tag || tx.blockNumber !== tag || header.number !== tag
    || !eq(tx.blockHash, receipt.blockHash) || !eq(header.hash, receipt.blockHash)
    || receipt.transactionIndex !== index || tx.transactionIndex !== index || !Array.isArray(header.transactions)
    || !eq(header.transactions[Number(BigInt(deploymentReference.transactionIndex))], receipt.transactionHash)
    || !isAddress(receipt.from) || !eq(tx.from, receipt.from) || tx.to !== null || receipt.to !== null
    || !eq(receipt.contractAddress, deploymentReference.proxy)) throw new Error('Deployment reference not corroborated');
  return { blockHash: receipt.blockHash as string, transactionSender: getAddress(receipt.from), creationContext: 'TOP_LEVEL_DEPLOYMENT_RECEIPT_NOT_DIRECT_ROLE_CALL' };
}
const accountWord = (x: unknown) => {
  if (!isHash(x) || !/^0x0{24}/i.test(x)) throw new Error('Invalid indexed address word');
  return getAddress('0x' + x.slice(-40));
};
export function extractCandidateAccounts(receipt: any) {
  if (!Array.isArray(receipt.logs) || receipt.logs.length > 128) throw new Error('Invalid receipt logs');
  const seen = new Set<string>();
  const events: { account: string; eventSender: string; roleId: string; logIndex: string }[] = [];
  for (const log of receipt.logs) {
    if (!log || !isAddress(log.address) || !Array.isArray(log.topics) || log.topics.length > 4 || !log.topics.every(isHash) || !byteString(log.data)
      || log.removed !== false || !quantity(log.logIndex) || !eq(log.transactionHash, deploymentReference.transactionHash)
      || log.blockNumber !== tag || log.transactionIndex !== index || !eq(log.blockHash, receipt.blockHash) || seen.has(BigInt(log.logIndex).toString())) throw new Error('Invalid log linkage');
    seen.add(BigInt(log.logIndex).toString());
    if (!eq(log.address, deploymentReference.proxy) || !eq(log.topics[0], topic)) continue;
    if (log.topics.length !== 4 || log.data !== '0x') throw new Error('RoleGranted layout mismatch');
    events.push({ account: accountWord(log.topics[2]), eventSender: accountWord(log.topics[3]), roleId: log.topics[1].toLowerCase(), logIndex: log.logIndex });
  }
  events.sort((a, b) => BigInt(a.logIndex) < BigInt(b.logIndex) ? -1 : BigInt(a.logIndex) > BigInt(b.logIndex) ? 1 : 0);
  const unique = [...new Set(events.filter(e => !/^0x0{40}$/i.test(e.account)).map(e => e.account))];
  const candidates = unique.slice(0, 3).map(account => ({ account, selectionReason: 'NONZERO_ROLE_GRANTED_ACCOUNT_IN_CORROBORATED_DEPLOYMENT_RECEIPT',
    roleIds: [...new Set(events.filter(e => e.account === account).map(e => e.roleId))], logIndices: events.filter(e => e.account === account).map(e => e.logIndex),
    evidenceReferences: [{ namespace: 'deployment', id: 'e2' }], membershipState: 'UNKNOWN', accountFreezeState: 'UNKNOWN', operatorIdentity: 'UNKNOWN' }));
  return { events, candidates, eligibleUniqueAccounts: unique.length, unselectedUniqueAccounts: unique.length - candidates.length };
}
export async function probeDeploymentCandidates(url: string) {
  const startedAt = new Date().toISOString(), rpc = new DeploymentCandidateRpc(url);
  let stage: 'ERROR' | 'CANDIDATES_OBSERVED' | 'NO_MATCH_IN_RECEIPT' | 'CONSISTENCY_ERROR' = 'ERROR';
  let deployment: ReturnType<typeof corroborateDeployment> | null = null;
  let observations: ReturnType<typeof extractCandidateAccounts> = { events: [], candidates: [], eligibleUniqueAccounts: 0, unselectedUniqueAccounts: 0 };
  try {
    if (await rpc.request('eth_chainId') !== '0x1') throw new Error('Wrong chain');
    const receipt = await rpc.request<any>('eth_getTransactionReceipt', [deploymentReference.transactionHash]);
    if (!receipt) throw new Error('Receipt unavailable');
    const tx = await rpc.request('eth_getTransactionByHash', [deploymentReference.transactionHash]);
    if (!tx) throw new Error('Transaction unavailable');
    const header = await rpc.request('eth_getBlockByNumber', [tag, false]);
    deployment = corroborateDeployment(receipt, tx, header);
    rpc.block = deploymentReference.blockNumber;
    observations = extractCandidateAccounts(receipt);
    try {
      const after = await rpc.request<any>('eth_getBlockByNumber', [tag, false]);
      if (!after || after.number !== tag || !eq(after.hash, deployment.blockHash)) throw new Error('Header consistency failed');
      stage = observations.candidates.length ? 'CANDIDATES_OBSERVED' : 'NO_MATCH_IN_RECEIPT';
    } catch { stage = 'CONSISTENCY_ERROR'; }
  } catch { /* Preserve partial sanitized evidence, never infer no events from a failure. */ }
  return { schemaVersion: '1.0', kind: 'QUALIFIED_RLUSD_ACCOUNT_CANDIDATES_NOT_ASSESSMENT', reference: deploymentReference, sourceEvidence: deploymentSource,
    stage, deployment, ...observations, evidenceNamespace: 'deployment', evidence: rpc.evidence, requestCount: rpc.evidence.length,
    sourceBinding: 'UNKNOWN', authorityState: 'UNKNOWN', support: 'UNKNOWN', verdict: 'INCONCLUSIVE', membershipExecution: 'NOT_TESTED',
    accountFreezeExecution: 'NOT_TESTED', behaviorExecution: 'NOT_TESTED', startedAt, completedAt: new Date().toISOString(),
    limitations: ['Only nonzero event.account is selected; event.sender and transaction.from are separate observations, not role holders.',
      'Deployment/constructor/initializer logs are not direct privileged-call or current membership evidence.',
      'Third-party deployment claims are corroborated only to the extent of the RPC evidence; source binding remains unknown.',
      'No range scan, recursive discovery, account calls, issuer identity or customer/service wallet ownership inference.',
      'Maximum3 unique accounts in canonical log order; omitted candidates do not imply an exhaustive role census.',
      'Numeric block/header checks are provider observations, not independent finality; inconsistent candidates are not qualified for later reads.'] };
}
export function validateCandidateSource(bytes: Buffer) {
  if (createHash('sha256').update(bytes).digest('hex') !== deploymentSource.sha256) throw new Error('Deployment source hash mismatch');
  const p = JSON.parse(bytes.toString()), e = p.abi.event;
  if (p.networkId !== '1' || !eq(p.proxy, deploymentReference.proxy) || p.deployment.transactionHash !== deploymentReference.transactionHash
    || p.deployment.blockNumber !== deploymentReference.blockNumber || p.deployment.transactionIndex !== deploymentReference.transactionIndex
    || p.abi.sha256 !== deploymentSource.abiSha256 || p.abiStudy.sha256 !== rlusdSource.sha256 || e.anonymous !== false || e.type !== 'event' || e.name !== 'RoleGranted'
    || e.inputs.map((i: any) => i.type).join(',') !== 'bytes32,address,address' || !e.inputs.every((i: any) => i.indexed === true)
    || toEventSelector(e) !== topic) throw new Error('Event/deployment candidate source mismatch');
}
const schema = JSON.parse(readFileSync(new URL('../../schemas/rlusd-account-candidates.v1.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);
export function validateCandidateReport(report: unknown) {
  if (!validate(report)) throw new Error('Invalid candidate report');
  const p = report as Awaited<ReturnType<typeof probeDeploymentCandidates>>;
  if (JSON.stringify(p.reference) !== JSON.stringify(deploymentReference) || JSON.stringify(p.sourceEvidence) !== JSON.stringify(deploymentSource)
    || p.requestCount !== p.evidence.length || p.evidence.some((e, i) => e.id !== `e${i + 1}` || !['RPC', 'RPC_ERROR'].includes(e.kind)
      || !allowed((e.data as any).method, (e.data as any).params))) throw new Error('Invalid candidate scope');
  if (p.stage === 'ERROR') { if (p.candidates.length || p.events.length) throw new Error('Error cannot claim qualified candidates'); return; }
  const get = (m: string) => (p.evidence.find(e => e.kind === 'RPC' && (e.data as any).method === m)?.data as any)?.result;
  if (get('eth_chainId') !== '0x1' || p.evidence[1]?.kind !== 'RPC' || (p.evidence[1].data as any).method !== 'eth_getTransactionReceipt') throw new Error('Invalid chain/receipt evidence');
  const receipt = get('eth_getTransactionReceipt'), tx = get('eth_getTransactionByHash'), header = get('eth_getBlockByNumber');
  const deployment = corroborateDeployment(receipt, tx, header), observations = extractCandidateAccounts(receipt);
  if (JSON.stringify(deployment) !== JSON.stringify(p.deployment)) throw new Error('Invalid deployment linkage');
  for (const key of Object.keys(observations) as (keyof typeof observations)[]) if (JSON.stringify(p[key]) !== JSON.stringify(observations[key])) throw new Error('Invalid candidate selection');
  if (p.stage !== 'CONSISTENCY_ERROR') {
    const last = p.evidence.at(-1)!, d = last.data as any;
    if (last.kind !== 'RPC' || d.method !== 'eth_getBlockByNumber' || d.result?.number !== tag || !eq(d.result?.hash, deployment.blockHash)
      || (p.stage === 'CANDIDATES_OBSERVED') !== (p.candidates.length > 0)) throw new Error('Invalid candidate consistency');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { values } = parseArgs({ options: { out: { type: 'string' } }, strict: true });
    if (!values.out || !process.env.RPC_URL) throw new Error('Missing configuration');
    validateCandidateSource(readFileSync(new URL('../../docs/research/rlusd-deployment-reference.json', import.meta.url)));
    const report = await probeDeploymentCandidates(process.env.RPC_URL); validateCandidateReport(report);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(`RLUSD candidates: ${report.stage}; ${report.candidates.length} selected; ${report.requestCount} requests.\n`);
    if (['ERROR', 'CONSISTENCY_ERROR'].includes(report.stage)) process.exitCode = 1;
  })().catch(() => { process.stderr.write('RLUSD candidate probe failed; details omitted.\n'); process.exitCode = 1; });
}
