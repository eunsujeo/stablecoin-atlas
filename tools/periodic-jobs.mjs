import {requireLegacyHistoryCollection} from './market-db/registration-scheduler.mjs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,lstat,realpath,open,link,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {boundedRead} from './evidence-store.mjs';
import {archiveSources} from './market-db/files.mjs';
import {importPlan,digest} from './market-db/plan.mjs';
import {boundedJson,atomic,defaultMarketDirectory} from './market-store.mjs';
import {connectDatabase} from './market-db/connection.mjs';
import {verifyHistoryWriter,importHistory} from './market-db/history.mjs';
import {historyAssets,validateSupplyHistory} from '../web/supply-history-model.js';
import {validateRegistry} from '../web/market-model.js';
import {fetchHistorySource,historyProjection} from './supply-history-source.mjs';
import {archiveCompressedSources,readCompressedSource} from './history-archive.mjs';
import {databaseCollector} from './market-db/collect.mjs';
import {collectMarket} from './market-collect.mjs';
import {loadSources} from './market-db/files.mjs';
import {importSources} from './market-db/repository.mjs';
import {checkDatabase} from './market-db/health.mjs';
const registryPath=new URL('../data/asset-registry.json',import.meta.url);
const invalid=()=>{throw Error('SCHEDULER_INVALID');};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function validateReceipt(receipt,job,slot){
 if(!exact(receipt,['schemaVersion','job','slot','payload'])||receipt.schemaVersion!==1||receipt.job!==job||receipt.slot!==slot)invalid();
 const p=receipt.payload;
 if(job==='ARKHAM'){if(!exact(p,['sourceName','sourceHash'])||!hash(p.sourceHash)||!/[a-f0-9-]{36}\.json$/.test(p.sourceName)||p.sourceName.length!==41)invalid();}
 else if(job==='DEFILLAMA'){
  if(!Array.isArray(p)||p.length!==3||new Set(p.map(s=>s?.coinId)).size!==3)invalid();
  for(const source of p)if(!exact(source,['coinId','sourceHash','fetchedAt'])||!Object.hasOwn(historyAssets,source.coinId)||!hash(source.sourceHash)||typeof source.fetchedAt!=='string'||!Number.isFinite(Date.parse(source.fetchedAt))||new Date(source.fetchedAt).toISOString()!==source.fetchedAt)invalid();
 }else if(/^REGISTERED_(USDT|USDC|RLUSD|JPYC|JPYSC)$/.test(job)){
  if(!exact(p,['coinId','metadataId','selectionId','sourceHash','fetchedAt'])||p.coinId!==job.slice(11).toLowerCase()||![p.metadataId,p.selectionId,p.sourceHash].every(hash)||typeof p.fetchedAt!=='string'||!Number.isFinite(Date.parse(p.fetchedAt))||new Date(p.fetchedAt).toISOString()!==p.fetchedAt||!slot.endsWith('T00:00:00.000Z'))invalid();
 }else invalid();return receipt;
}
export async function receiptStore(root){
 await mkdir(root,{recursive:true,mode:0o700});const s=await lstat(root);if(!s.isDirectory()||s.isSymbolicLink()||process.platform!=='win32'&&((s.mode&0o077)!==0||s.uid!==process.getuid()))invalid();const base=await realpath(root);
 const path=(job,slot)=>{if(!['ARKHAM','DEFILLAMA'].includes(job)&&!/^REGISTERED_(USDT|USDC|RLUSD|JPYC|JPYSC)$/.test(job)||typeof slot!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(slot))invalid();return join(base,job.toLowerCase()+'-'+slot.replace(/\D/g,'')+'.json');};
 return {async read(job,slot){try{const file=path(job,slot),s=await lstat(file);if(!s.isFile()||s.isSymbolicLink()||process.platform!=='win32'&&((s.mode&0o077)!==0||s.uid!==process.getuid()))invalid();return validateReceipt((await boundedJson(file,8192)).value,job,slot);}catch(e){if(e.code==='ENOENT')return null;throw e;}},async save(job,slot,payload){
  const r=validateReceipt({schemaVersion:1,job,slot,payload},job,slot),file=path(job,slot),temporary=file+'.'+randomUUID()+'.tmp';let f;
  try{f=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);await f.writeFile(JSON.stringify(r));await f.sync();await f.close();f=null;try{await link(temporary,file);}catch(e){if(e.code!=='EEXIST')throw e;}}
  finally{await f?.close();await unlink(temporary).catch(()=>{});}const dir=await open(base,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{await dir.sync();}finally{await dir.close();}
  if(JSON.stringify(await this.read(job,slot))!==JSON.stringify(r))invalid();
 }};
}
export function periodicJobs({env,receipts,archiveRoot='.state/collector-archive',marketDirectory=defaultMarketDirectory,signal,fetcher=fetch,connect=connectDatabase}={}){
 const marketRoot=resolve(marketDirectory instanceof URL?fileURLToPath(marketDirectory):marketDirectory),compressed=join(archiveRoot,'history'),marketArchive=join(archiveRoot,'market');
 const guardedFetch=async(url,options)=>{signal?.throwIfAborted();return fetcher(url,{...options,signal:signal?AbortSignal.any([signal,options.signal].filter(Boolean)):options.signal});};
 async function history(job,slot,receipt){
  const client=await connect(env);try{
   await verifyHistoryWriter(client);if(!receipt)await requireLegacyHistoryCollection(client);const registry=validateRegistry((await boundedJson(registryPath,128*1024)).value),sources=[],snapshots=[],proof=[];
   for(const coinId of Object.keys(historyAssets)){
    signal?.throwIfAborted();const saved=receipt?.payload.find(s=>s.coinId===coinId),bytes=saved?await readCompressedSource(compressed,saved.sourceHash):await fetchHistorySource(coinId,guardedFetch),fetchedAt=saved?.fetchedAt??new Date().toISOString();
    const circulating=historyProjection(bytes,coinId,registry,fetchedAt),minted=historyProjection(bytes,coinId,registry,fetchedAt,{metric:'NETWORK_MINTED'});if(saved&&saved.sourceHash!==circulating.sourceHash)invalid();snapshots.push(circulating,minted);sources.push({hash:circulating.sourceHash,bytes});proof.push({coinId,sourceHash:circulating.sourceHash,fetchedAt});
   }
   validateSupplyHistory(snapshots,registry);if(!receipt){await archiveCompressedSources(sources,compressed);await receipts.save(job,slot,proof);}signal?.throwIfAborted();return {...await importHistory(client,registry,snapshots),state:'SUCCESS'};
  }finally{await client.end().catch(()=>{});}
 }
 async function resumeArkham(receipt){
  const {sourceName,sourceHash}=receipt.payload,client=await connect(env);try{
   const registry=validateRegistry((await boundedJson(registryPath,128*1024)).value),bytes=await boundedRead(join(marketArchive,sourceHash.slice(0,2),sourceHash+'.json'),2*1024*1024);if(digest(bytes)!==sourceHash)invalid();const input={registry,sources:[importPlan(registry,bytes,{kind:'PROJECTION'})]};const times=input.sources[0].units.map(u=>Date.parse(u.observedAt));await checkDatabase(client,{at:Math.min(...times),through:Math.max(...times)});signal?.throwIfAborted();const stored=await importSources(client,{...input,archiveDirectory:marketArchive});
   await atomic(join(marketRoot,'database-state.json'),{state:'STORED',updatedAt:new Date().toISOString(),localPublished:true,sourceName,sourceHash,errorCode:null});return {state:'SUCCESS',database:stored.state};
  }finally{await client.end().catch(()=>{});}
 }
 return {ARKHAM:{collect:async slot=>{const collect=databaseCollector({env,connect,archiveDirectory:marketArchive,collect:options=>collectMarket({...options,fetcher:guardedFetch}),onCollected:async proof=>{const input=await loadSources({reportsDirectory:dirname(marketRoot),registryPath,names:['market-store/collected/'+proof.sourceName]});if(input.sources[0].hash!==proof.sourceHash)invalid();await archiveSources(input.sources.flatMap(p=>[p,{hash:p.bindingHash,bytes:p.bindingBytes}]),marketArchive);await receipts.save('ARKHAM',slot,proof);}});return collect({directory:marketRoot,key:env.ARKM_API_KEY});},resume:resumeArkham},DEFILLAMA:{collect:slot=>history('DEFILLAMA',slot),resume:receipt=>history('DEFILLAMA',receipt.slot,receipt)}};
}
