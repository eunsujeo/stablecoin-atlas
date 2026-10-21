import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Ajv } from 'ajv';
import { encodeFunctionData, parseAbi, toEventSelector, keccak256, type Hex } from 'viem';
import { Rpc } from '../../src/evm/rpc.js';
import { decodeControlWord, decodeRoleCode } from './usdc-control-probe.js';
import { masterMinterReference } from './usdc-minter-management-probe.js';
import { writeReportAtomically } from '../../src/report-output.js';

export const historyReference = { networkId: '1', target: masterMinterReference.target, codeHash: masterMinterReference.codeHash,
  fromBlock: '7439432', toBlock: '7440431', deploymentHash: '0x9a20409c717d56fa630f64f9a2fc6d07e26308cf37de5f1833c24e348fa6d4ed', maxSamples: 3 };
export const adminEvents = [
  { name: 'ControllerConfigured', signature: 'ControllerConfigured(address,address)', method: 'configureController', indexed: 2, selected: [0, 1] },
  { name: 'ControllerRemoved', signature: 'ControllerRemoved(address)', method: 'removeController', indexed: 1, selected: [0] },
  { name: 'MinterManagerSet', signature: 'MinterManagerSet(address,address)', method: 'setMinterManager', indexed: 2, selected: [1] },
  { name: 'OwnershipTransferred', signature: 'OwnershipTransferred(address,address)', method: 'transferOwnership', indexed: 0, selected: [1] },
] as const;
const abi = parseAbi(['function configureController(address,address)', 'function removeController(address)', 'function setMinterManager(address)', 'function transferOwnership(address)']);
const topics = adminEvents.map(e => toEventSelector(e.signature));
const hex = (n: string) => '0x' + BigInt(n).toString(16);
const eq = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const hash = (x: unknown): x is string => typeof x === 'string' && /^0x[0-9a-f]{64}$/i.test(x);
const quantity = (x: unknown): x is string => typeof x === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(x);
const logFields = ['address', 'topics', 'data', 'blockNumber', 'blockHash', 'transactionHash', 'transactionIndex', 'logIndex', 'removed'];
const address = (x: unknown): x is string => typeof x === 'string' && /^0x[0-9a-f]{40}$/i.test(x);
const byteString = (x: unknown): x is string => typeof x === 'string' && /^0x(?:[0-9a-f]{2})*$/i.test(x);
function safeField(key: string, x: unknown): unknown {
  if (['address', 'from', 'to', 'contractAddress'].includes(key)) return address(x) ? x : null;
  if (['hash', 'blockHash', 'transactionHash'].includes(key)) return hash(x) ? x : null;
  if (['number', 'blockNumber', 'transactionIndex', 'logIndex', 'status'].includes(key)) return quantity(x) ? x : null;
  if (['data', 'input'].includes(key)) return byteString(x) ? x : null;
  if (['topics', 'transactions'].includes(key)) return Array.isArray(x) && x.every(hash) ? x : null;
  if (key === 'removed') return typeof x === 'boolean' ? x : null;
  return null;
}
const pick = (x: any, keys: string[]) => x && typeof x === 'object' ? Object.fromEntries(keys.filter(k => Object.hasOwn(x, k)).map(k => [k, safeField(k, x[k])])) : null;
function project(method: string, raw: any): any {
  if (method === 'eth_getLogs') return Array.isArray(raw) ? raw.map(x => pick(x, logFields)) : null;
  if (method === 'eth_getTransactionReceipt') {
    const p = pick(raw, ['transactionHash', 'blockNumber', 'blockHash', 'transactionIndex', 'status', 'from', 'to', 'contractAddress']);
    return p ? { ...p, logs: Array.isArray(raw.logs) ? raw.logs.map((x: any) => pick(x, logFields)) : null } : null;
  }
  if (method === 'eth_getTransactionByHash') return pick(raw, ['hash', 'blockNumber', 'blockHash', 'transactionIndex', 'from', 'to', 'input']);
  if (method === 'eth_getBlockByNumber') return pick(raw, ['number', 'hash', 'transactions']);
  if (method === 'eth_chainId') return quantity(raw) ? raw : null;
  if (method === 'eth_getCode') return typeof raw === 'string' && /^0x(?:[0-9a-f]{2})*$/i.test(raw) ? raw : null;
  return null;
}

// Read-only JSON-RPC POST transport, streamed 2MiB cap and 32-request budget.
// This is not a verification-service POST or a transaction broadcast.
export class HistoryRpc extends Rpc {
  private nextId = 0;
  private readonly admittedHashes = new Set<string>([historyReference.deploymentHash]);
  constructor(private readonly endpoint: string) { super(endpoint); }
  admitSamples(logs: any[]) { for (const log of logs.slice(0, 3)) this.admittedHashes.add(log.transactionHash.toLowerCase()); }
  override async request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const id = ++this.nextId;
    const allowed = method === 'eth_chainId' && params.length === 0
      || ['eth_getTransactionByHash', 'eth_getTransactionReceipt'].includes(method) && params.length === 1 && typeof params[0] === 'string' && this.admittedHashes.has(params[0].toLowerCase())
      || method === 'eth_getBlockByNumber' && params.length === 2 && quantity(params[0]) && BigInt(params[0]) >= BigInt(historyReference.fromBlock) && BigInt(params[0]) <= BigInt(historyReference.toBlock) && params[1] === false
      || method === 'eth_getCode' && params.length === 2 && params[0] === historyReference.target && quantity(params[1]) && BigInt(params[1]) >= BigInt(historyReference.fromBlock) && BigInt(params[1]) <= BigInt(historyReference.toBlock)
      || method === 'eth_getLogs' && JSON.stringify(params) === JSON.stringify([{ address: historyReference.target,
        fromBlock: hex(historyReference.fromBlock), toBlock: hex(historyReference.toBlock), topics: [topics] }]);
    if (!allowed || id > 32) throw new Error('Historical request outside fixed budget/scope');
    try {
      const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
      while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length;
        if (size > 2097152) { await reader.cancel(); throw new Error('Response size limit'); } chunks.push(chunk.value); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (body.jsonrpc !== '2.0' || body.id !== id || Object.hasOwn(body, 'result') === Object.hasOwn(body, 'error')) throw new Error('Invalid envelope');
      if (body.error) {
        if (!Number.isSafeInteger(body.error.code)) throw new Error('Invalid RPC error');
        throw new Error(`RPC error (code ${body.error.code})`);
      }
      const result = project(method, body.result);
      this.record('RPC', { method, params, result }); return result as T;
    } catch (error) {
      const message = error instanceof Error && /^(HTTP [1-5][0-9]{2}|RPC error \(code -?[0-9]+\)|Response size limit)$/.test(error.message)
        ? error.message : 'Historical RPC transport/protocol failure';
      this.record('RPC_ERROR', { method, params, error: message }); throw new Error(message);
    }
  }
}

export function decodeAdminLog(log: any) {
  if (!log || !eq(log.address, historyReference.target) || log.removed !== false || !quantity(log.blockNumber)
    || BigInt(log.blockNumber) < BigInt(historyReference.fromBlock) || BigInt(log.blockNumber) > BigInt(historyReference.toBlock)
    || !hash(log.blockHash) || !hash(log.transactionHash) || !quantity(log.transactionIndex) || !quantity(log.logIndex)
    || !Array.isArray(log.topics)) throw new Error('Invalid historical log context');
  const event = adminEvents.find(e => eq(toEventSelector(e.signature), log.topics[0]));
  if (!event || log.topics.length !== event.indexed + 1) throw new Error('Unexpected event topics');
  let values: string[];
  if (event.indexed) {
    if (log.data !== '0x') throw new Error('Unexpected indexed event data');
    values = log.topics.slice(1).map((x: unknown) => decodeControlWord(x, 'address') as string);
  } else {
    if (typeof log.data !== 'string' || !/^0x[0-9a-f]{128}$/i.test(log.data)) throw new Error('Invalid ownership data');
    values = [log.data.slice(2, 66), log.data.slice(66)].map(x => decodeControlWord('0x' + x, 'address') as string);
  }
  const expectedInput = encodeFunctionData({ abi, functionName: event.method, args: event.selected.map(i => values[i]) } as any);
  return { name: event.name, values, method: event.method, expectedInput };
}
export function selectHistoryLogs(logs: unknown) {
  if (!Array.isArray(logs) || logs.length > 100) throw new Error('Historical log count limit');
  const seen = new Set<string>();
  for (const log of logs) { decodeAdminLog(log); const key = log.blockHash.toLowerCase() + ':' + BigInt(log.logIndex).toString();
    if (seen.has(key)) throw new Error('Duplicate historical log'); seen.add(key); }
  return [...logs].sort((a, b) => {
    for (const k of ['blockNumber', 'transactionIndex', 'logIndex']) if (BigInt(a[k]) !== BigInt(b[k])) return BigInt(a[k]) < BigInt(b[k]) ? -1 : 1;
    return 0;
  }).slice(0, 3);
}

function linkTransaction(tx: any, receipt: any, block: any, transactionHash: string, blockNumber: string, blockHash: string, index: string) {
  if (!tx || !receipt || !block || !quantity(index) || !hash(blockHash) || !address(tx.from) || !address(receipt.from)
    || !(tx.to === null || address(tx.to)) || !(receipt.to === null || address(receipt.to)) || !byteString(tx.input)
    || !eq(tx.hash, transactionHash) || !eq(receipt.transactionHash, transactionHash)
    || tx.blockNumber !== blockNumber || receipt.blockNumber !== blockNumber || block.number !== blockNumber
    || !eq(tx.blockHash, blockHash) || !eq(receipt.blockHash, blockHash) || !eq(block.hash, blockHash)
    || tx.transactionIndex !== index || receipt.transactionIndex !== index || receipt.status !== '0x1'
    || !Array.isArray(block.transactions) || !eq(block.transactions[Number(BigInt(index))], transactionHash)
    || !eq(tx.from, receipt.from) || !eq(tx.to ?? '0x', receipt.to ?? '0x')) throw new Error('Historical transaction linkage failed');
}
export function corroborateHistoryLog(log: any, tx: any, receipt: any, block: any) {
  const event = decodeAdminLog(log);
  linkTransaction(tx, receipt, block, log.transactionHash, log.blockNumber, log.blockHash, log.transactionIndex);
  if (!Array.isArray(receipt.logs) || !receipt.logs.some((r: any) => r.logIndex === log.logIndex && r.transactionIndex === log.transactionIndex
    && eq(r.transactionHash, log.transactionHash) && r.blockNumber === log.blockNumber && eq(r.blockHash, log.blockHash)
    && eq(r.address, log.address) && eq(r.data, log.data) && JSON.stringify(r.topics).toLowerCase() === JSON.stringify(log.topics).toLowerCase())) throw new Error('Receipt does not contain exact sampled log');
  return { event: { name: event.name, values: event.values }, transactionHash: log.transactionHash, blockNumber: BigInt(log.blockNumber).toString(),
    blockHash: log.blockHash, topLevelSender: tx.from,
    directCall: eq(tx.to, historyReference.target) && eq(tx.input, event.expectedInput) ? 'MATCHING_DIRECT_CALL_INPUT' : 'UNKNOWN',
    receiptStatus: 'SUCCESS', currentAuthority: 'UNKNOWN' };
}

export async function probeMasterMinterHistory(url: string) {
  const rpc = new HistoryRpc(url), startedAt = new Date().toISOString();
  const samples: any[] = []; let stage = 'ERROR', reason = 'HISTORICAL_READ_NOT_ESTABLISHED', returnedLogs: number | null = null;
  try {
    if (await rpc.request('eth_chainId') !== '0x1') throw new Error('Network mismatch');
    const receipt = await rpc.request<any>('eth_getTransactionReceipt', [historyReference.deploymentHash]);
    const tx = await rpc.request<any>('eth_getTransactionByHash', [historyReference.deploymentHash]);
    const block = await rpc.request<any>('eth_getBlockByNumber', [hex(historyReference.fromBlock), false]);
    linkTransaction(tx, receipt, block, historyReference.deploymentHash, hex(historyReference.fromBlock), receipt?.blockHash, receipt?.transactionIndex);
    if (tx.to !== null || receipt.to !== null || !eq(receipt.contractAddress, historyReference.target)) throw new Error('Deployment reference mismatch');
    const logs = await rpc.request<any>('eth_getLogs', [{ address: historyReference.target, fromBlock: hex(historyReference.fromBlock), toBlock: hex(historyReference.toBlock), topics: [topics] }]);
    const selected = selectHistoryLogs(logs); returnedLogs = logs.length; rpc.admitSamples(selected);
    for (const log of selected) {
      const start = rpc.evidence.length;
      try {
        const r = await rpc.request('eth_getTransactionReceipt', [log.transactionHash]);
        const t = await rpc.request('eth_getTransactionByHash', [log.transactionHash]);
        const b = await rpc.request<any>('eth_getBlockByNumber', [log.blockNumber, false]);
        const sample: any = { ...corroborateHistoryLog(log, t, r, b), codeStatus: 'UNKNOWN', headerConsistency: 'UNKNOWN' };
        try { const code = decodeRoleCode(await rpc.request('eth_getCode', [historyReference.target, log.blockNumber]));
          sample.codeStatus = code.codeHash === historyReference.codeHash ? 'MATCH_CURRENT_REFERENCE' : 'MISMATCH_CURRENT_REFERENCE'; sample.observedCodeHash = code.codeHash;
        } catch { /* Archive/RPC absence is not historical code absence. */ }
        try {
          const after = await rpc.request<any>('eth_getBlockByNumber', [log.blockNumber, false]);
          sample.headerConsistency = after?.number === log.blockNumber && eq(after?.hash, b.hash) ? 'MATCH' : 'MISMATCH';
        } catch { sample.headerConsistency = 'NOT_ESTABLISHED'; }
        samples.push({ ...sample, evidenceReferences: rpc.evidence.slice(start).map(e => e.id) });
      } catch { samples.push({ transactionHash: log.transactionHash, stage: 'UNCONFIRMED', evidenceReferences: rpc.evidence.slice(start).map(e => e.id) }); }
    }
    let consistent = false;
    try { const after = await rpc.request<any>('eth_getBlockByNumber', [hex(historyReference.fromBlock), false]);
      consistent = after?.number === hex(historyReference.fromBlock) && eq(after?.hash, block.hash);
    } catch { /* Failure to establish the final header is a consistency error. */ }
    stage = !consistent || samples.some(s => ['MISMATCH', 'NOT_ESTABLISHED'].includes(s.headerConsistency)) ? 'CONSISTENCY_ERROR'
      : !selected.length ? 'NO_MATCH_IN_WINDOW' : samples.some(s => s.stage === 'UNCONFIRMED') ? 'PARTIAL' : 'OBSERVED';
    reason = 'BOUNDED_HISTORY_ONLY';
  } catch { /* RPC evidence retains sanitized errors; no range or endpoint fallback. */ }
  return { schemaVersion: '1.0', kind: 'QUALIFIED_ADMIN_HISTORY_NOT_ASSESSMENT', reference: historyReference,
    stage, reason, returnedLogs, sampledLogs: samples.length, unverifiedLogs: returnedLogs === null ? null : returnedLogs - samples.length,
    selection: 'FIRST_THREE_SORTED_BY_BLOCK_TRANSACTION_LOG_INDEX', samples, evidence: rpc.evidence, startedAt, completedAt: new Date().toISOString(),
    verdict: 'INCONCLUSIVE', currentAuthority: 'UNKNOWN', support: 'UNKNOWN', sourceBinding: 'UNKNOWN', newTransactionExecution: 'NOT_TESTED',
    limitations: ['Only one inclusive 1000-block window and at most three samples; no full-history/current-controller completeness claim.',
      'Success receipts and matching inputs/events are historical RPC observations, not key/operator identity or current authority proof.',
      'ABI is a third-party 0.4.24 candidate; current code/source cannot be assumed for unobserved historical code.',
      'Block/transaction/receipt linkage uses one provider; no independent signature, trie inclusion, consensus or finality validation.'] };
}

export function validateHistorySource(proof: any) {
  if (JSON.stringify(proof.reference) !== JSON.stringify(historyReference) || JSON.stringify(proof.events) !== JSON.stringify(adminEvents)
    || proof.compilerVersion !== '0.4.24+commit.e67f0147') throw new Error('History source mismatch');
}
const schema = JSON.parse(readFileSync(new URL('../../schemas/admin-history-probe.v1.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);
export function validateHistoryReport(report: unknown) {
  if (!validate(report)) throw new Error('Invalid historical report');
  const p = report as Awaited<ReturnType<typeof probeMasterMinterHistory>>;
  const ids = new Set(p.evidence.map(e => e.id));
  if (JSON.stringify(p.reference) !== JSON.stringify(historyReference) || ids.size !== p.evidence.length || p.evidence.length > 32
    || p.sampledLogs !== p.samples.length || p.unverifiedLogs !== (p.returnedLogs === null ? null : p.returnedLogs - p.sampledLogs)) throw new Error('Invalid history scope/counts');
  if (p.stage === 'NO_MATCH_IN_WINDOW' && (p.returnedLogs !== 0 || p.samples.length !== 0)) throw new Error('Invalid empty-window claim');
  if (p.stage === 'OBSERVED' && !p.samples.length) throw new Error('Missing historical samples');
  const logsEvidence = p.evidence.find(e => e.kind === 'RPC' && (e.data as any).method === 'eth_getLogs');
  const query = (logsEvidence?.data as any)?.params;
  if (p.stage !== 'ERROR') {
    if (JSON.stringify(query) !== JSON.stringify([{ address: historyReference.target, fromBlock: hex(historyReference.fromBlock), toBlock: hex(historyReference.toBlock), topics: [topics] }])) throw new Error('Invalid historical filter');
    const logs = (logsEvidence!.data as any).result;
    const selected = selectHistoryLogs(logs);
    if (logs.length !== p.returnedLogs || selected.length !== p.samples.length) throw new Error('Invalid historical sampling');
    const before = p.evidence.slice(0, p.evidence.indexOf(logsEvidence!));
    const receipt = (before.find(e => (e.data as any).method === 'eth_getTransactionReceipt')?.data as any)?.result;
    const tx = (before.find(e => (e.data as any).method === 'eth_getTransactionByHash')?.data as any)?.result;
    const block = (before.find(e => (e.data as any).method === 'eth_getBlockByNumber')?.data as any)?.result;
    linkTransaction(tx, receipt, block, historyReference.deploymentHash, hex(historyReference.fromBlock), receipt?.blockHash, receipt?.transactionIndex);
    if (tx.to !== null || receipt.to !== null || !eq(receipt.contractAddress, historyReference.target)) throw new Error('Invalid deployment anchor');
    for (const [i, sample] of p.samples.entries()) {
      if (!eq(sample.transactionHash, selected[i].transactionHash) || sample.evidenceReferences.some((id: string) => !ids.has(id))) throw new Error('Invalid sample provenance');
      if (sample.stage === 'UNCONFIRMED') continue;
      const evidence = p.evidence.filter(e => sample.evidenceReferences.includes(e.id));
      const result = (method: string) => (evidence.find(e => e.kind === 'RPC' && (e.data as any).method === method)?.data as any)?.result;
      const expected = corroborateHistoryLog(selected[i], result('eth_getTransactionByHash'), result('eth_getTransactionReceipt'), result('eth_getBlockByNumber'));
      for (const k of Object.keys(expected)) if (JSON.stringify(sample[k]) !== JSON.stringify((expected as any)[k])) throw new Error('Historical corroboration mismatch');
      const code = result('eth_getCode'); let codeHash: string | undefined;
      try { codeHash = decodeRoleCode(code).codeHash; } catch { /* Unknown archive code is not EMPTY. */ }
      const status = codeHash ? codeHash === historyReference.codeHash ? 'MATCH_CURRENT_REFERENCE' : 'MISMATCH_CURRENT_REFERENCE' : 'UNKNOWN';
      if (sample.codeStatus !== status || sample.observedCodeHash !== codeHash) throw new Error('Invalid historical code claim');
      const headers = evidence.filter(e => (e.data as any).method === 'eth_getBlockByNumber');
      const last = headers.length > 1 ? headers.at(-1) : undefined;
      const data = last?.data as any;
      const expectedConsistency = !last || last.kind === 'RPC_ERROR' ? 'NOT_ESTABLISHED'
        : data.result?.number === selected[i].blockNumber && eq(data.result?.hash, selected[i].blockHash) ? 'MATCH' : 'MISMATCH';
      if (sample.headerConsistency !== expectedConsistency) throw new Error('Invalid historical header claim');
    }
    if (['OBSERVED', 'PARTIAL', 'NO_MATCH_IN_WINDOW'].includes(p.stage)) {
      const last = p.evidence.at(-1)?.data as any;
      if (last?.method !== 'eth_getBlockByNumber' || last.params[0] !== hex(historyReference.fromBlock) || last.result?.number !== hex(historyReference.fromBlock)
        || !eq(last.result?.hash, block.hash) || p.samples.some(s => ['MISMATCH', 'NOT_ESTABLISHED'].includes(s.headerConsistency))) throw new Error('Historical consistency not established');
    }
    if (p.stage === 'OBSERVED' && p.samples.some(s => s.stage === 'UNCONFIRMED' || s.headerConsistency !== 'MATCH')) throw new Error('Unconfirmed historical success');
  } else if (p.samples.length) throw new Error('Error report cannot claim confirmed samples');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const { values } = parseArgs({ options: { out: { type: 'string' } }, strict: true });
    if (!values.out || !process.env.RPC_URL) throw new Error('Missing configuration');
    const proof = readFileSync(new URL('../../docs/research/usdc-master-minter-history-reference.json', import.meta.url));
    const expected = JSON.parse(proof.toString('utf8'));
    validateHistorySource(expected);
    const report = { ...await probeMasterMinterHistory(process.env.RPC_URL), sourceEvidence: {
      reference: '../docs/research/usdc-master-minter-history-reference.json', sha256: createHash('sha256').update(proof).digest('hex') } };
    validateHistoryReport(report);
    await writeReportAtomically(values.out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(`Historical probe: ${report.stage}; ${report.sampledLogs} sampled.\n`);
    if (['ERROR', 'CONSISTENCY_ERROR'].includes(report.stage)) process.exitCode = 1;
  })().catch(() => { process.stderr.write('Historical probe failed; details omitted.\n'); process.exitCode = 1; });
}
