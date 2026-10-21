import { constants } from 'node:fs';
import { open, mkdir, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMarket, validateRegistry, METRICS } from '../web/market-model.js';
export const defaultMarketDirectory = new URL('../reports/market-store/', import.meta.url);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function boundedJson(path, limit = 2 * 1024 * 1024) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat(); if (!stat.isFile() || stat.size > limit) throw new Error('INVALID_INPUT');
    const bytes = Buffer.alloc(limit + 1); let size = 0;
    while (size <= limit) { const read = await handle.read(bytes,size,bytes.length-size,null); if (!read.bytesRead) break; size += read.bytesRead; }
    if (size > limit) throw new Error('INPUT_LIMIT');
    const raw = bytes.subarray(0,size); return { value: JSON.parse(raw.toString('utf8')), hash: digest(raw) };
  } finally { await handle.close(); }
}
async function atomic(path, value) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  try { const f = await open(tmp,'wx',0o600); try { await f.writeFile(JSON.stringify(value)+'\n'); } finally { await f.close(); } await rename(tmp,path); }
  finally { await unlink(tmp).catch(()=>{}); }
}
export async function publishedMarket(directory = defaultMarketDirectory) {
  const root = directory instanceof URL ? fileURLToPath(directory) : String(directory);
  const {value:index} = await boundedJson(join(root,'index.json'),1024);
  if (index.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(index.hash)) throw new Error('INVALID_INDEX');
  const snapshot = await boundedJson(join(root,`${index.hash}.json`));
  if (snapshot.hash !== index.hash) throw new Error('HASH_MISMATCH');
  const data = validateMarket(snapshot.value);
  let lastBuildState = 'UNKNOWN';
  try { const build = (await boundedJson(join(root,'last-build.json'),1024)).value; if (['SUCCESS','FAILED'].includes(build.state)) lastBuildState = build.state; } catch {}
  return {...data,lastBuildState};
}
export function normalizeSources(registry, sources, previous = null) {
  validateRegistry(registry); const observations = [];
  if(previous) {
    for(const old of previous.registry.coins) { const current=registry.coins.find(c=>c.id===old.id); if(!current||current.pricingId!==old.pricingId) throw new Error('COIN_ID_REASSIGNED'); }
    for(const old of previous.registry.networks) { const current=registry.networks.find(n=>n.id===old.id); if(!current||current.family!==old.family||current.networkId!==old.networkId||current.providerKey!==old.providerKey) throw new Error('NETWORK_ID_REASSIGNED'); }
    for(const old of previous.registry.deployments) { const current=registry.deployments.find(d=>d.id===old.id); if(!current||current.coinId!==old.coinId||current.networkId!==old.networkId||JSON.stringify(current.identity)!==JSON.stringify(old.identity)) throw new Error('DEPLOYMENT_ID_REASSIGNED'); }
  }
  let omittedSupplyEntries = 0; const networks = [];
  for (const source of sources) {
    const {value:report,hash:sourceHash} = source;
    const add = (coin, deployment, metric, amount, endpoint, selector, request, sourceAt = null) => {
      if (amount === undefined || amount === null) return;
      const observedAt = request.observedAt ?? report.observedAt;
      const o = {coinId:coin.id,networkId:deployment?.networkId??null,deploymentId:deployment?.id??null,metric,unit:METRICS[metric].unit,amount,provider:metric==='OBLIGATIONS'?'XRPL_RPC':'ARKHAM',endpoint,selector,sourceHash,groupId:digest(sourceHash+endpoint+observedAt),observedAt,sourceAt,observationClock:request.observedAt?'REQUEST':'REPORT_FALLBACK'};
      if(metric==='OBLIGATIONS') { o.ledgerHash=report.ledgerHash; o.ledgerIndex=report.ledgerIndex; }
      o.id = digest(JSON.stringify(o)); observations.push(o);
    };
    const requests = [...(report.additionalRequests??[]).map((request,i)=>({request,prefix:`$.additionalRequests[${i}]`})),...(report.requests??[]).map((request,i)=>({request,prefix:`$.requests[${i}]`}))];
    for (const {request,prefix} of requests) {
      if (request.state !== 'SUCCESS' || request.httpStatus !== 200) continue;
      for (const coin of registry.coins) {
        if (request.endpoint === `/token/market/${coin.pricingId}`) {
          add(coin,null,'CIRCULATING',request.data?.circulatingSupply,request.endpoint,prefix+'.data.circulatingSupply',request);
          add(coin,null,'PRICE',request.data?.price,request.endpoint,prefix+'.data.price',request);
        }
        if (request.endpoint === `/token/holders/${coin.pricingId}`) {
          for (const [chain,amount] of Object.entries(request.data?.totalSupply??{})) {
            const n = registry.networks.find(n=>n.providerKey===chain), d = registry.deployments.find(d=>d.coinId===coin.id&&d.networkId===n?.id);
            if (!d) { omittedSupplyEntries++; continue; }
            add(coin,d,'CHAIN_TOTAL',amount,request.endpoint,`${prefix}.data.totalSupply.${chain}`,request);
          }
        }
      }
      if (request.endpoint === '/networks/status') for (const n of registry.networks) {
        const row = request.data?.[n.providerKey];
        if (row) networks.push({networkId:n.id,active:row.active,tip:row.tip,observedAt:request.observedAt??report.observedAt,sourceAt:row.asOf?.tip??null,sourceHash});
      }
    }
    if (report.kind === 'XRPL_GATEWAY_OBLIGATIONS_RESEARCH_NOT_ASSESSMENT') {
      if (!/^[A-Fa-f0-9]{64}$/.test(report.ledgerHash) || !/^\d+$/.test(report.ledgerIndex)) throw new Error('INVALID_LEDGER');
      for (const [index,observation] of (report.observations??[]).entries()) {
        if (observation.status !== 'OBSERVED') continue;
        const d = registry.deployments.find(d=>d.identity.kind==='ISSUED'&&d.identity.issuer===observation.issuer&&d.identity.currency===observation.currency);
        if (!d) continue;
        if (observation.metric !== 'gateway_balances.obligations' || observation.ledgerHash!==report.ledgerHash || observation.ledgerIndex!==report.ledgerIndex) throw new Error('INVALID_LEDGER_BINDING');
        add(registry.coins.find(c=>c.id===d.coinId),d,'OBLIGATIONS',observation.value,'/gateway_balances',`$.observations[${index}].value`,{});
      }
    }
  }
  const merged = new Map((previous?.observations??[]).map(o=>[o.id,o])); for (const o of observations) merged.set(o.id,o);
  const networkMap = new Map(); for (const row of [...(previous?.networks??[]),...networks]) if (!networkMap.has(row.networkId) || row.observedAt >= networkMap.get(row.networkId).observedAt) networkMap.set(row.networkId,row);
  return validateMarket({schemaVersion:1,kind:'STORED_PROVIDER_OBSERVATIONS_NOT_ASSESSMENT',publishedAt:new Date().toISOString(),registry,observations:[...merged.values()].sort((a,b)=>a.id.localeCompare(b.id)),networks:[...networkMap.values()],omittedSupplyEntries});
}
export async function buildMarket({registryPath, sourcePaths, directory = defaultMarketDirectory}) {
  const root = directory instanceof URL ? fileURLToPath(directory) : String(directory);
  await mkdir(root,{recursive:true,mode:0o700});
  try {
    // An absent index means a first build. A corrupt existing index is never silently reset.
    let previous = null, exists = false;
    try { await boundedJson(join(root,'index.json'),1024); exists = true; } catch (error) { if (error.code!=='ENOENT') throw error; }
    if (exists) previous = await publishedMarket(root);
    if (!Array.isArray(sourcePaths) || sourcePaths.length > 12) throw new Error('SOURCE_LIMIT');
    const {value:registry} = await boundedJson(registryPath,128*1024);
    const sources = []; for (const path of sourcePaths) sources.push(await boundedJson(path,2*1024*1024));
    const data = normalizeSources(registry,sources,previous);
    const bytes = Buffer.from(JSON.stringify(data)+'\n'); if (bytes.length>2*1024*1024) throw new Error('SNAPSHOT_LIMIT');
    const hash = digest(bytes), path = join(root,`${hash}.json`);
    try { const f = await open(path,'wx',0o600); try { await f.writeFile(bytes); } finally { await f.close(); } }
    catch(error) { if(error.code!=='EEXIST'||(await boundedJson(path)).hash!==hash) throw error; }
    await atomic(join(root,'last-build.json'),{state:'SUCCESS'});
    await atomic(join(root,'index.json'),{schemaVersion:1,hash}); return data;
  } catch (error) { await atomic(join(root,'last-build.json'),{state:'FAILED'}); throw error; }
}
