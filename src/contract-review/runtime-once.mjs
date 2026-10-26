import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { keccak256 } from 'viem';
import { boundedRead } from '../../tools/evidence-store.mjs';
import { workspaceEnvironment } from '../../tools/workspace-env.mjs';
import { Transport, limits, pin, hex, publicRPC } from './network.mjs';
import { normalizeSourcify, sha256 } from './source.mjs';

export const runtimeReadPlan = Object.freeze({
  id: 'multicall3-runtime-once-20261026-v2', chainId: '1',
  address: '0xca11bde05977b3631167028862be2a173976ca11', endpoint: 'publicRPC[1]',
  slot: '.state/contract-review-multicall3-runtime-once-20261026-v2',
  rpc: 4, get: 0, timeoutMs: 120000, requestMs: 15000, responseBytes: 2097152, totalBytes: 8388608,
  retry: 0, fallback: 0,
});
export const infuraRuntimeReadPlan = Object.freeze({ ...runtimeReadPlan,
  id: 'multicall3-infura-runtime-once-20261026-v3', endpoint: 'RPC_URL:INFURA_ETHEREUM_MAINNET',
  slot: '.state/contract-review-multicall3-infura-runtime-once-20261026-v3',
});
const inputs = [
  ['.state/contract-review-sourcify-initial.json', 'b41da40a4f7fd443aae7bef93e4e3f517ded3ba9cee8db0228c2cf0962fe083c'],
  ['.state/contract-review-multicall3-live-20261026/plan.json', '49c3ae220a91e32412991454d197cbae14545e8c52a61e4d6353c366843ee30f'],
  ['.state/contract-review-multicall3-live-20261026/snapshot.private.json', '43cbafc6524b653c4660b8b8eb5201d0b887e9ef80fdc82219bcfe770c753fc7'],
];
const artifactHash = '0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891';
const v2ReceiptInput = ['.state/contract-review-multicall3-runtime-once-20261026-v2/receipt.json', '6f62fa74a52faa87e15842878296da12f8de992ef80f9897015dae56643f4def'];

export function selectInfuraRPC(environment) {
  try {
    const url = new URL(environment.RPC_URL);
    if (environment.NODE_TLS_REJECT_UNAUTHORIZED === '0' || url.protocol !== 'https:' || url.hostname !== 'mainnet.infura.io'
      || url.port || url.username || url.password || url.href !== `${url.origin}${url.pathname}` || !/^\/v3\/[A-Za-z0-9_-]{1,128}$/.test(url.pathname)) throw Error();
    return url.href; // Private in-memory value; never serialize or hash it.
  } catch { throw Error('INFURA_CONFIGURATION_INVALID'); }
}

export async function prepareRuntimeRead(workspace) {
  const buffers = await Promise.all(inputs.map(async ([path, digest]) => {
    const bytes = await boundedRead(join(workspace, path), 2 * 1024 * 1024);
    if (sha256(bytes) !== digest) throw Error('INPUT_CHANGED');
    return bytes;
  }));
  const bundle = normalizeSourcify(JSON.parse(buffers[0].toString('utf8')), runtimeReadPlan.chainId, runtimeReadPlan.address);
  if (!bundle.providerOnchainCode || !bundle.providerRecompiledCode
    || keccak256(bundle.providerOnchainCode) !== artifactHash || keccak256(bundle.providerRecompiledCode) !== artifactHash) throw Error('INPUT_CHANGED');
  return bundle;
}

export async function prepareInfuraRuntimeRead(workspace) {
  const bundle = await prepareRuntimeRead(workspace);
  const previous = await boundedRead(join(workspace, v2ReceiptInput[0]), 2 * 1024 * 1024);
  if (sha256(previous) !== v2ReceiptInput[1]) throw Error('INPUT_CHANGED');
  const rpcURL = selectInfuraRPC(await workspaceEnvironment(pathToFileURL(join(workspace, '.env.local'))));
  return { bundle, rpcURL };
}

// mkdir is exclusive across processes. Never create a replacement slot after rejection.
export async function claimRuntimeSlot(directory, plan = runtimeReadPlan) {
  if (plan !== runtimeReadPlan && plan !== infuraRuntimeReadPlan) throw Error('UNKNOWN_RUNTIME_PROFILE');
  await mkdir(directory, { mode: 0o700 });
  const pinned = plan === infuraRuntimeReadPlan ? [...inputs, v2ReceiptInput] : inputs;
  await writeFile(join(directory, 'plan.json'), JSON.stringify({ ...plan, inputs: pinned.map(([path, sha256]) => ({ path, sha256 })) }, null, 2), { flag: 'wx', mode: 0o600 });
  await writeFile(join(directory, 'consumed.json'), JSON.stringify({ status: 'CONSUMED_BEFORE_FIRST_SEND', startedAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
}

// A fixed sequence; there is no caller-supplied method, target, endpoint or fallback.
export async function observeRuntime(transport) {
  const result = { status: 'INCONCLUSIVE', block: null, code: null, canonical: false, stage: 'PIN' };
  try {
    result.block = await pin(transport, runtimeReadPlan.chainId);
    result.stage = 'BYTECODE';
    result.code = hex(await transport.rpc('eth_getCode', [runtimeReadPlan.address, result.block.selector]));
    if (result.code === '0x') { result.reason = 'EMPTY_CODE'; return result; }
    result.stage = 'CANONICAL_RECHECK';
    const end = await transport.rpc('eth_getBlockByNumber', [result.block.numberHex, false]);
    if (end?.number !== result.block.numberHex || hex(end.hash, 32) !== result.block.hash) { result.reason = 'BLOCK_CHANGED'; return result; }
    result.canonical = true; result.status = 'OBSERVED'; result.stage = 'COMPLETE';
  } catch {
    result.reason = 'READ_OR_VALIDATION_FAILED';
  }
  return result;
}

async function prepareProfile(workspace, plan) {
  return plan === infuraRuntimeReadPlan ? prepareInfuraRuntimeRead(workspace)
    : { bundle: await prepareRuntimeRead(workspace), rpcURL: publicRPC['1'] };
}

async function runWithPlan(workspace, fetcher, plan) {
  const { bundle, rpcURL } = await prepareProfile(workspace, plan);
  const directory = join(workspace, plan.slot);
  await claimRuntimeSlot(directory, plan);
  const transport = new Transport(rpcURL, fetcher, { ...limits, rpc: 4, get: 0 });
  const observation = await observeRuntime(transport);
  const receipt = { planId: plan.id, chainId: plan.chainId, address: plan.address,
    startedAt: new Date(transport.started).toISOString(), finishedAt: new Date().toISOString(),
    status: observation.status, stage: observation.stage, reason: observation.reason ?? null,
    block: observation.block, canonical: observation.canonical, runtimeHash: observation.code ? keccak256(observation.code) : null,
    inputsUnchanged: false, comparison: { status: 'UNKNOWN', providerOnchainEqual: null, providerRecompiledEqual: null },
    sourceAuthenticity: 'UNKNOWN', originalCompiler: 'NOT_RUN', proxyAndPermissions: 'NOT_TESTED', cost: 'UNKNOWN',
    transport: { rpc: transport.rpcCount, get: transport.getCount, bytes: transport.bytes, events: transport.events } };
  try {
    const after = await prepareProfile(workspace, plan);
    if (after.rpcURL !== rpcURL) throw Error('INPUT_CHANGED');
    receipt.inputsUnchanged = true;
  } catch { receipt.status = 'INCONCLUSIVE'; receipt.reason = 'INPUT_CHANGED'; }
  if (observation.canonical && receipt.inputsUnchanged) {
    const providerOnchainEqual = observation.code === bundle.providerOnchainCode;
    const providerRecompiledEqual = observation.code === bundle.providerRecompiledCode;
    receipt.comparison = { status: providerOnchainEqual && providerRecompiledEqual ? 'PASS' : 'FAIL', providerOnchainEqual, providerRecompiledEqual,
      scope: 'Fixed-block runtime versus two saved provider artifacts only; source/compiler authenticity is unproven.' };
  }
  if (observation.code) await writeFile(join(directory, 'runtime.private.json'), JSON.stringify({ block: observation.block, code: observation.code }), { flag: 'wx', mode: 0o600 });
  await writeFile(join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2), { flag: 'wx', mode: 0o600 });
  await writeFile(join(directory, 'result.md'), `# Multicall3 fixed-block runtime\n\nObservation: ${receipt.status}\n\nArtifact equality: ${receipt.comparison.status}\n\nRuntime hash: ${receipt.runtimeHash ?? 'UNKNOWN'}\n\nRPC attempts: ${receipt.transport.rpc}; source GET: ${receipt.transport.get}.\n\nSource authenticity: UNKNOWN. Original compiler: NOT_RUN. Proxy/permissions: NOT_TESTED.\n\nSee receipt.json for fixed-block identity, timing and failure categories.\n`, { flag: 'wx', mode: 0o600 });
  return receipt;
}

export async function runRuntimeRead(workspace, fetcher = fetch) {
  return runWithPlan(workspace, fetcher, runtimeReadPlan);
}

export async function runInfuraRuntimeRead(workspace, fetcher = fetch) {
  return runWithPlan(workspace, fetcher, infuraRuntimeReadPlan);
}
