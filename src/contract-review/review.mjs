import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { keccak256 } from 'viem';
import { Transport, address, chain, hex, pin, limits, slots, wordAddress } from './network.mjs';
import { acquire, normalizeSourcify, normalizeEtherscan, sources, verifyMetadata } from './source.mjs';
import { analyze } from './analysis.mjs';
import { usageProfile } from './profiles.mjs';
import { markdown, dashboard } from './report.mjs';
import { inspectBytecode } from './bytecode.mjs';

export const version = 'ContractReview1.0';
const reason = error => ['REQUEST_LIMIT', 'TIME_LIMIT', 'BYTE_LIMIT', 'SOURCE_HOST_NOT_ALLOWED'].includes(error?.message) ? error.message : 'READ_OR_VALIDATION_FAILED';
export async function boundedJSON(path, maximum = 2 * 1024 * 1024) {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 32 * 1024 * 1024) throw Error('INPUT_LIMIT');
  const { open } = await import('node:fs/promises'); const handle = await open(path, 'r');
  try { const stat = await handle.stat(); if (!stat.isFile() || stat.size > maximum) throw Error('INPUT_LIMIT');
    const buf = Buffer.alloc(maximum + 1); let bytesRead = 0;
    while (bytesRead < buf.length) { const read = await handle.read(buf, bytesRead, buf.length - bytesRead, bytesRead); if (!read.bytesRead) break; bytesRead += read.bytesRead; }
    if (bytesRead > maximum) throw Error('INPUT_LIMIT'); return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, bytesRead)));
  } finally { await handle.close(); }
}
export function compareSource(bundle, code, canonical) {
  const artifacts = { localCompiler: 'NOT_RUN', providerClaim: bundle?.claim ?? 'UNKNOWN', providerRuntimeHash: bundle?.providerOnchainCode ? keccak256(bundle.providerOnchainCode) : null,
    providerRecompiledHash: bundle?.providerRecompiledCode ? keccak256(bundle.providerRecompiledCode) : null };
  if (!canonical || !code || code === '0x' || !bundle) return { ...artifacts, status: 'UNKNOWN', matchesProviderCode: null, matchesProviderRecompile: null };
  const matchesProviderCode = bundle.providerOnchainCode ? code === bundle.providerOnchainCode : null;
  const matchesProviderRecompile = bundle.providerRecompiledCode ? code === bundle.providerRecompiledCode : null;
  return { status: matchesProviderCode === false || matchesProviderRecompile === false ? 'FAIL' : matchesProviderCode && matchesProviderRecompile ? 'PASS' : 'UNKNOWN',
    scope: 'Exact byte equality of fixed-block RPC runtime and provider-supplied runtime artifacts; provider compiler/source authenticity is not independently proven.',
    matchesProviderCode, matchesProviderRecompile, providerClaim: bundle.claim, localCompiler: 'NOT_RUN',
    providerRuntimeHash: bundle.providerOnchainCode ? keccak256(bundle.providerOnchainCode) : null,
    providerRecompiledHash: bundle.providerRecompiledCode ? keccak256(bundle.providerRecompiledCode) : null };
}
export async function collect({ chainId, target, rpcURL, provider = 'sourcify', apiKey, suppliedSource, fetcher }) {
  chain(chainId); target = address(target);
  const transport = new Transport(rpcURL, fetcher), result = { version, chainId, address: target, observedAt: new Date().toISOString(), block: null, canonical: false, nodes: [], errors: [], rawSources: {}, limits };
  try { result.block = await pin(transport, chainId); } catch (e) { result.errors.push({ stage: 'PIN', reason: reason(e) }); }
  const seen = new Set();
  async function visit(at, depth, ancestors = new Set()) {
    if (ancestors.has(at)) { result.errors.push({ stage: 'PROXY_CYCLE', address: at }); return; }
    if (seen.has(at)) return;
    if (depth > limits.depth || seen.size >= limits.nodes) { result.errors.push({ stage: 'PROXY_DEPTH_OR_NODE_LIMIT', address: at }); return; }
    seen.add(at);
    const node = { address: at, depth, code: null, codeHash: null, source: null, sourceStatus: 'UNKNOWN', slotObservations: {}, proxyStatus: 'UNKNOWN', edges: [], uups: { status: 'UNKNOWN' }, errors: [] };
    result.nodes.push(node);
    if (result.block) {
      try { node.code = hex(await transport.rpc('eth_getCode', [at, result.block.selector])); node.codeHash = keccak256(node.code); } catch (e) { node.errors.push({ stage: 'BYTECODE', reason: reason(e) }); }
    }
    try {
      let source;
      if (at === target && suppliedSource) {
        source = { raw: suppliedSource, normalized: provider === 'sourcify' ? normalizeSourcify(suppliedSource, chainId, at) : normalizeEtherscan(suppliedSource, chainId, at) };
        node.sourceOrigin = 'SUPPLIED_CAPTURE_NO_GET';
      } else { source = await acquire(transport, chainId, at, provider, apiKey); node.sourceOrigin = 'LIVE_GET'; }
      result.rawSources[at] = source.raw; node.source = source.normalized; node.sourceStatus = 'RECEIVED';
    } catch (e) { node.errors.push({ stage: 'SOURCE', reason: reason(e) }); }
    if (!result.block || !node.code || node.code === '0x') return;
    for (const [name, value] of Object.entries(slots)) {
      try { const raw = hex(await transport.rpc('eth_getStorageAt', [at, value, result.block.selector]), 32); node.slotObservations[name] = { status: 'OBSERVED', word: raw, address: wordAddress(raw) }; }
      catch (e) { node.slotObservations[name] = { status: 'UNKNOWN' }; node.errors.push({ stage: `SLOT_${name.toUpperCase()}`, reason: reason(e) }); }
    }
    const implementation = node.slotObservations.implementation?.address;
    const beacon = node.slotObservations.beacon?.address;
    if (implementation) node.edges.push({ kind: 'EIP1967_IMPLEMENTATION_CANDIDATE', address: implementation });
    if (beacon) {
      try {
        const code = hex(await transport.rpc('eth_getCode', [beacon, result.block.selector]));
        if (code === '0x') throw Error('EMPTY_BEACON');
        const resolved = wordAddress(await transport.rpc('eth_call', [{ to: beacon, data: '0x5c60da1b', gas: '0xc350' }, result.block.selector]));
        if (!resolved) throw Error('ZERO_BEACON_IMPLEMENTATION');
        node.beacon = { address: beacon, codeHash: keccak256(code), implementation: resolved, status: 'OBSERVED' };
        node.edges.push({ kind: 'BEACON_IMPLEMENTATION_CANDIDATE', address: resolved });
      } catch (e) { node.beacon = { address: beacon, status: 'UNKNOWN' }; node.errors.push({ stage: 'BEACON', reason: reason(e) }); }
    }
    const minimal = /^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/.exec(node.code);
    if (minimal) node.edges.push({ kind: 'EIP1167_IMPLEMENTATION_CANDIDATE', address: `0x${minimal[1]}` });
    node.proxyStatus = node.edges.length ? 'CANDIDATE_REVIEW_REQUIRED' : Object.values(node.slotObservations).every(x => x.status === 'OBSERVED') ? 'NO_STANDARD_SLOT_OR_MINIMAL_PROXY_SIGNAL' : 'UNKNOWN';
    if (depth > 0 || implementation) {
      try {
        const uuid = hex(await transport.rpc('eth_call', [{ to: at, data: '0x52d1902d', gas: '0xc350' }, result.block.selector]), 32);
        node.uups = { status: uuid === slots.implementation ? 'UUID_SIGNAL' : 'NONSTANDARD_UUID', uuid };
      } catch { node.uups = { status: 'UNKNOWN', reason: 'PROBE_FAILED_NOT_PROOF_OF_ABSENCE' }; }
    }
    for (const edge of node.edges) await visit(edge.address, depth + 1, new Set([...ancestors, at]));
  }
  // Identity mismatch never triggers more external calls.
  if (result.block) await visit(target, 0);
  else if (suppliedSource) {
    const source = provider === 'sourcify' ? normalizeSourcify(suppliedSource, chainId, target) : normalizeEtherscan(suppliedSource, chainId, target);
    result.nodes.push({ address: target, depth: 0, code: null, codeHash: null, source, sourceStatus: 'RECEIVED', slotObservations: {}, proxyStatus: 'UNKNOWN', edges: [], uups: { status: 'UNKNOWN' }, errors: [] });
  }
  if (result.block) {
    try {
      const final = await transport.rpc('eth_getBlockByNumber', [result.block.numberHex, false]);
      result.canonical = hex(final?.hash, 32) === result.block.hash && final?.number?.toLowerCase() === result.block.numberHex.toLowerCase();
      if (!result.canonical) result.errors.push({ stage: 'CANONICAL_RECHECK', reason: 'BLOCK_CHANGED' });
    } catch (e) { result.errors.push({ stage: 'CANONICAL_RECHECK', reason: reason(e) }); }
  }
  result.transport = { rpc: transport.rpcCount, get: transport.getCount, bytes: transport.bytes, events: transport.events };
  result.sourceCapturesPrivate = transport.sourceCaptures;
  return result;
}
export async function buildReport(snapshot) {
  if (snapshot?.version !== version || !Array.isArray(snapshot.nodes) || snapshot.nodes.length > limits.nodes) throw Error('SNAPSHOT_INVALID');
  chain(snapshot.chainId); address(snapshot.address);
  if (typeof snapshot.canonical !== 'boolean') throw Error('SNAPSHOT_INVALID');
  if (snapshot.block) { hex(snapshot.block.hash, 32); if (!/^(?:0|[1-9][0-9]*)$/.test(snapshot.block.number)) throw Error('SNAPSHOT_INVALID'); }
  const contracts = [];
  for (const node of snapshot.nodes) {
    address(node.address); if (node.code !== null) hex(node.code);
    if (node.source) {
      if (node.source.chainId !== snapshot.chainId || address(node.source.address) !== address(node.address)) throw Error('SNAPSHOT_SOURCE_IDENTITY');
      sources(node.source.sources);
      if (node.source.provider === 'sourcify') node.source.metadataContentCheck = verifyMetadata(node.source.sources, node.source.metadata);
    }
    const analysis = await analyze(node.source), verification = compareSource(node.source, node.code, snapshot.canonical);
    contracts.push({ address: node.address, codeHash: node.code ? keccak256(node.code) : null, bytecodeAnalysis: inspectBytecode(node.code), source: node.source ? { status: node.sourceStatus, origin: node.sourceOrigin ?? 'SUPPLIED_CAPTURE', provider: node.source.provider, providerVerifiedAt: node.source.providerVerifiedAt ?? null, claim: node.source.claim, metadataContentCheck: node.source.metadataContentCheck ?? { status: 'UNKNOWN' }, compilerVersion: node.source.compilerVersion,
      selectedContract: `${node.source.file ?? '?'}:${node.source.name}`, abi: node.source.abi, settings: node.source.settings, sourceHashes: analysis.hashes ?? {} } : { status: 'UNKNOWN' },
    verification, architecture: { status: node.proxyStatus, slots: node.slotObservations, edges: node.edges, beacon: node.beacon ?? null, uups: node.uups, caveat: 'Slot/UUID signals are observations, not proof of dispatch, upgrade authorization or complete proxy absence.' },
    analysis, usage: usageProfile(node.source, analysis), errors: node.errors });
  }
  const failedBinding = contracts.some(c => c.verification.status === 'FAIL' || c.source.metadataContentCheck?.status === 'FAIL');
  return { schemaVersion: version, analyzedAt: new Date().toISOString(), observedAt: snapshot.observedAt, chainId: snapshot.chainId, address: snapshot.address,
    block: snapshot.block ? { number: snapshot.block.number, hash: snapshot.block.hash, canonicalRecheck: snapshot.canonical } : null,
    status: failedBinding ? 'FAIL' : !snapshot.canonical || !contracts.length || contracts.every(c => c.analysis.status === 'UNKNOWN') ? 'UNKNOWN' : 'REVIEW_REQUIRED',
    statusMeaning: 'FAIL can mean an artifact mismatch; REVIEW_REQUIRED is not a proven vulnerability. PASS applies only to scoped equality checks, never overall safety.',
    contracts, tools: { engine: version, node: process.version, slither: { execution: 'NOT_RUN', result: 'UNKNOWN', reason: 'No sandboxed offline Slither runner is installed/configured. No auto-install or build scripts executed.' }, ai: 'NOT_USED' },
    limits: snapshot.limits, transport: snapshot.transport, errors: snapshot.errors,
    references: ['https://docs.sourcify.dev/docs/api/', 'https://docs.etherscan.io/api-reference/endpoint/getsourcecode', 'https://eips.ethereum.org/EIPS/eip-1967', 'https://eips.ethereum.org/EIPS/eip-1822', 'https://eips.ethereum.org/EIPS/eip-1167', 'https://github.com/mds1/multicall3'] };
}
export async function review(options) {
  // Exclusive output directory is the single-run boundary. Never overwrite previous observations.
  await mkdir(options.out, { mode: 0o700 });
  await writeFile(join(options.out, 'plan.json'), JSON.stringify({ version, chainId: chain(options.chainId), address: address(options.target), provider: options.provider ?? 'sourcify', limits, methods: ['eth_chainId', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call'], writes: false, retries: 0, endpointSwitches: 0 }, null, 2), { flag: 'wx', mode: 0o600 });
  const snapshot = await collect(options);
  await writeFile(join(options.out, 'snapshot.private.json'), JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
  const report = await buildReport(snapshot);
  await writeReports(options.out, report);
  return report;
}
export async function writeReports(out, report) {
  await writeFile(join(out, 'review.json'), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  await writeFile(join(out, 'review.md'), markdown(report), { flag: 'wx', mode: 0o600 });
  await writeFile(join(out, 'index.html'), dashboard(report), { flag: 'wx', mode: 0o600 });
}
export function attachExperiments(report, record) {
  const expected = ['direct-call-context', 'simulation-state', 'atomic-revert', 'partial-failure', 'aggregate3-residual', 'failed-value-retained', 'value-mismatch-rollback', 'delegated-batch-context', 'delegate-storage-control', 'fixture-approval-misuse'];
  if (record?.schemaVersion !== 'ContractReviewExperiments1.0' || record.status !== 'PASS' || record.environment !== 'PROGRAM_OWNED_NEW_LOOPBACK_ANVIL'
    || record.sourceMode !== 'ACTUAL_CAPTURE_PRAGMA_RELAXED_LOCAL_BUILD' || !Array.isArray(record.checks) || record.checks.length !== expected.length
    || expected.some(id => record.checks.filter(c => c.id === id && c.status === 'PASS').length !== 1)
    || !report.contracts.some(c => Object.values(c.source.sourceHashes ?? {}).includes(record.sourceSHA256))) throw Error('EXPERIMENT_IDENTITY_MISMATCH');
  report.privateExperiments = { provenance: 'SUPPLIED_LOCAL_RECORD_NOT_AUTHENTICATED', sourceSHA256: record.sourceSHA256, compiler: String(record.compiler),
    sourceMode: record.sourceMode, timestamp: String(record.timestamp), deploymentEquivalence: 'NOT_PROVEN', checks: record.checks.map(c => ({ id: c.id, status: c.status })) };
  return report;
}
