import { getAddress, keccak256, type Hex } from 'viem';
import { validateReviewReport } from './report.js';
import { sha256 } from './input.js';
import type { ReviewConfig, ReviewReport } from './model.js';

export interface ArchivedObservation {
  evidenceRef: string; sha256: string; sourceSchema: string; sourceStartedAt: string; sourceFinishedAt: string;
  chainId: string; tokenAddress: string;
  block: { number: string; hash: string; consistency: 'HASH_PINNED_RECHECKED' };
  provenance: 'SUPPLIED_REPORT_NOT_INDEPENDENTLY_ATTESTED';
}
export function readArchivedObservations(bytes: Buffer, config: ReviewConfig) {
  if (bytes.length > 32 * 1024 * 1024) throw new Error('ARCHIVE_SIZE_LIMIT');
  const report = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as ReviewReport;
  const pending = [{ value: report as unknown, depth: 0 }]; let count = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++count > 500_000 || depth > 128) throw new Error('ARCHIVE_STRUCTURE_LIMIT');
    if (value && typeof value === 'object') for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 });
  }
  validateReviewReport(report);
  if (report.mode === 'OFFLINE' || report.archive || report.block.consistency !== 'HASH_PINNED_RECHECKED'
    || !report.block.number || !/^(0|[1-9][0-9]*)$/.test(report.block.number)
    || !report.block.hash || !/^0x[0-9a-fA-F]{64}$/.test(report.block.hash)
    || report.config.network.chainId !== config.network.chainId || getAddress(report.config.token.address) !== config.token.address
    || config.network.blockNumber !== undefined && config.network.blockNumber !== report.block.number) throw new Error('ARCHIVE_IDENTITY_OR_BLOCK_MISMATCH');
  const start = Date.parse(report.startedAt), end = Date.parse(report.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new Error('ARCHIVE_TIME_INVALID');
  const headers = report.evidence.filter(e => {
    const value = e.data as { method?: string; result?: { number?: string; hash?: string } } | undefined;
    return e.kind === 'RPC' && value?.method === 'eth_getBlockByNumber'
      && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value.result?.number ?? '')
      && BigInt(value.result!.number!) === BigInt(report.block.number!)
      && value.result?.hash?.toLowerCase() === report.block.hash?.toLowerCase();
  });
  const chains = report.evidence.filter(e => {
    const value = e.data as { method?: string; result?: string } | undefined;
    return e.kind === 'RPC' && value?.method === 'eth_chainId'
      && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value.result ?? '') && BigInt(value.result!) === BigInt(config.network.chainId);
  });
  if (headers.length < 2 || chains.length < 2) throw new Error('ARCHIVE_HEADER_RECHECK_MISSING');
  if (report.contracts.length > 32) throw new Error('ARCHIVE_CODE_LIMIT');
  const contracts = new Map<string, { address: string; runtimeHash: string; originalEvidenceRef: string }>();
  for (const contract of report.contracts) {
    const address = getAddress(contract.address);
    if (contracts.has(address)) throw new Error('DUPLICATE_ARCHIVE_CONTRACT');
    const evidence = report.evidence.find(e => e.id === contract.evidenceRef);
    const data = evidence?.data as { address?: string; code?: string; runtimeHash?: string } | undefined;
    if (evidence?.kind !== 'CONTRACT_CODE' || evidence.observedBlockOrSlot !== report.block.number
      || !data?.address || getAddress(data.address) !== address || !data.code || !/^0x(?:[0-9a-fA-F]{2})+$/.test(data.code)
      || keccak256(data.code as Hex) !== contract.runtimeHash || data.runtimeHash !== contract.runtimeHash) throw new Error('ARCHIVE_CODE_HASH_MISMATCH');
    const rpc = report.evidence.some(e => {
      const value = e.data as { method?: string; params?: unknown[]; result?: string } | undefined;
      const block = value?.params?.[1] as { blockHash?: string; requireCanonical?: boolean } | undefined;
      return e.kind === 'RPC' && e.observedBlockOrSlot === report.block.number && value?.method === 'eth_getCode'
        && typeof value.params?.[0] === 'string' && value.params[0].toLowerCase() === address.toLowerCase()
        && value.result?.toLowerCase() === data.code?.toLowerCase()
        && block?.blockHash?.toLowerCase() === report.block.hash?.toLowerCase() && block?.requireCanonical === true;
    });
    if (!rpc) throw new Error('ARCHIVE_CODE_RPC_MISSING');
    contracts.set(address, { address, runtimeHash: contract.runtimeHash, originalEvidenceRef: contract.evidenceRef });
  }
  if (!contracts.has(config.token.address)) throw new Error('ARCHIVE_TOKEN_CODE_MISSING');
  const descriptor: Omit<ArchivedObservation, 'evidenceRef'> = { sha256: sha256(bytes), sourceSchema: report.schemaVersion,
    sourceStartedAt: report.startedAt, sourceFinishedAt: report.finishedAt, chainId: config.network.chainId, tokenAddress: config.token.address,
    block: { number: report.block.number, hash: report.block.hash, consistency: 'HASH_PINNED_RECHECKED' },
    provenance: 'SUPPLIED_REPORT_NOT_INDEPENDENTLY_ATTESTED' };
  return { descriptor, contracts };
}
