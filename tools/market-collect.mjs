import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { workspaceEnvironment } from './workspace-env.mjs';
import { atomic, boundedJson, defaultMarketDirectory, normalizeSources, withMarketWriter } from './market-store.mjs';
import { decimal, validateRegistry } from '../web/market-model.js';

// One bounded seven-request run; market-watch may schedule it, browser actions never do.
export const collectionEndpoints = Object.freeze(['usd-coin','tether','ripple-usd'].flatMap(id=>[
  `/token/market/${id}`,`/token/holders/${id}`,
]).concat('/networks/status'));
const requireValue = condition=>{if(!condition)throw new Error('INVALID_RESPONSE');};
function amount(value) { requireValue(decimal(value)); return value; }
export function projectResponse(endpoint, raw, registry) {
  requireValue(raw && typeof raw==='object' && !Array.isArray(raw));
  if(endpoint.startsWith('/token/market/')) return {circulatingSupply:amount(raw.circulatingSupply),price:amount(raw.price),...(raw.totalSupply==null?{}:{totalSupply:amount(raw.totalSupply)}),...(raw.totalVolume==null?{}:{totalVolume:amount(raw.totalVolume)})};
  if(endpoint.startsWith('/token/holders/')) {
    requireValue(raw.totalSupply && typeof raw.totalSupply==='object' && !Array.isArray(raw.totalSupply));
    const entries=Object.entries(raw.totalSupply);requireValue(entries.length>0&&entries.length<=256);
    const totalSupply=Object.fromEntries(entries.map(([chain,value])=>{
      requireValue(/^[a-z][a-z0-9_]{0,63}$/.test(chain));return [chain,amount(value)];
    }));
    return {totalSupply}; // Never persist top holders, labels or account data.
  }
  requireValue(endpoint==='/networks/status');
  const rows=[];
  for(const network of registry.networks.filter(n=>n.providerKey)) {
    const row=raw[network.providerKey];if(row===undefined)continue;
    requireValue(row&&typeof row.active==='boolean'&&typeof row.tip==='string'&&/^\d{1,30}$/.test(row.tip));
    const at=row.asOf?.tip??null;
    requireValue(at===null||(typeof at==='string'&&/^\d{4}-\d\d-\d\dT/.test(at)&&Number.isFinite(Date.parse(at))));
    rows.push([network.providerKey,{active:row.active,tip:row.tip,asOf:{tip:at}}]);
  }
  requireValue(rows.length>0);return Object.fromEntries(rows);
}
function parseProvider(bytes) {
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  let depth=0,quoted=false,escaped=false;
  for(const char of text){
    if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;}
    else if(char==='"')quoted=true;
    else if(char==='{'||char==='['){if(++depth>32)throw new Error('RESPONSE_DEPTH');}
    else if(char==='}'||char===']')depth--;
  }
  return JSON.parse(text,(_key,value,context)=>typeof value==='number'?context.source:value);
}
export async function readProvider(endpoint,key,fetcher=fetch) {
  if(!collectionEndpoints.includes(endpoint))throw new Error('INVALID_ENDPOINT');
  const response=await fetcher('https://api.arkm.com'+endpoint,{
    method:'GET',headers:{'API-Key':key},redirect:'error',signal:AbortSignal.timeout(15000),
  });
  if(response.status!==200) {
    const retry=response.headers.get('retry-after');await response.body?.cancel();
    const error=new Error('HTTP_ERROR');error.httpStatus=response.status;
    error.retryAfterSeconds=/^\d{1,8}$/.test(retry??'')?retry:null;throw error;
  }
  let size=0;const parts=[];
  for await(const part of response.body){size+=part.length;if(size>2*1024*1024)throw new Error('RESPONSE_LIMIT');parts.push(part);}
  // Reviver source preserves numeric lexemes before JS can round monetary values.
  return parseProvider(Buffer.concat(parts));
}
export async function collectMarket({key,registryPath=new URL('../data/asset-registry.json',import.meta.url),directory=defaultMarketDirectory,fetcher=fetch,wait=pause,retainHistory=true,now=()=>new Date().toISOString()}={}) {
  return withMarketWriter(directory,async(publish,root)=>{
    const status={state:'RUNNING',attemptedAt:now(),requests:0,completedRequests:0,published:false,httpStatus:null,retryAfterSeconds:null};
    await atomic(join(root,'last-collection.json'),status);
    const deadline=Date.now()+120000;let savedSource;
    try {
      if(typeof retainHistory!=='boolean')throw Error('INVALID_ARGUMENTS');
      if(typeof key!=='string'||!key.trim())throw new Error('KEY_MISSING');
      const registry=validateRegistry((await boundedJson(registryPath,128*1024)).value);
      if(registry.coins.length!==3||!['usd-coin','tether','ripple-usd'].every(id=>registry.coins.some(c=>c.pricingId===id)))throw new Error('COLLECTION_SCOPE');
      const report={kind:'ARKHAM_COLLECTED_PROJECTION_NOT_ASSESSMENT',schemaVersion:1,requests:[]};
      for(const endpoint of collectionEndpoints){
        if(status.requests)await wait(1000);
        if(Date.now()+15000>deadline)throw new Error('RUN_LIMIT');
        status.requests++;const raw=await readProvider(endpoint,key,fetcher);
        report.requests.push({endpoint,state:'SUCCESS',httpStatus:200,observedAt:now(),data:projectResponse(endpoint,raw,registry)});
        status.completedRequests++;
      }
      // Reject malformed groups before saving or changing the published pointer.
      normalizeSources(registry,[{value:report,hash:'0'.repeat(64)}]);
      const archive=join(root,'collected');await mkdir(archive,{recursive:true,mode:0o700});
      const sourceName=randomUUID()+'.json',path=join(archive,sourceName);
      const bytes=Buffer.from(JSON.stringify(report)+'\n'),sourceHash=createHash('sha256').update(bytes).digest('hex');
      const handle=await open(path,'wx',0o600);
      try {await handle.writeFile(bytes);}finally{await handle.close();}
      savedSource={sourceName,sourceHash};
      const data=await publish({registryPath,sourcePaths:[path],retainHistory});
      status.published=true;status.state='SUCCESS';await atomic(join(root,'last-collection.json'),status);
      return {state:status.state,requests:status.requests,observations:data.observations.length,sourceName,sourceHash};
    } catch(error) {
      status.state='FAILED';
      status.httpStatus=Number.isInteger(error.httpStatus)&&error.httpStatus>=100&&error.httpStatus<=599?error.httpStatus:null;
      status.retryAfterSeconds=error.retryAfterSeconds??null;
      await atomic(join(root,'last-collection.json'),status);
      // Never echo fetch exceptions, response bodies, credentials or environment.
      return {state:status.state,requests:status.requests,published:status.published,httpStatus:status.httpStatus,retryAfterSeconds:status.retryAfterSeconds,...savedSource};
    }
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    if(process.argv.length!==2)throw new Error();
    const {ARKM_API_KEY:key}=await workspaceEnvironment();
    const result=await collectMarket({key});console.log(JSON.stringify(result));if(result.state!=='SUCCESS')process.exitCode=1;
  }catch{console.error('Market collection failed or completion could not be recorded. Check the stored state, key file and active writer. Details omitted.');process.exitCode=1;}
}
