import {registeredCollectorStatus} from './market-db/registration-status.mjs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as pause} from 'node:timers/promises';
import {workspaceEnvironment} from './workspace-env.mjs';
import {connectDatabase} from './market-db/connection.mjs';
import {safeErrorCode} from './market-db/errors.mjs';
import {importCoinMarket} from './market-db/registration-coin-market.mjs';
import {verifyRegistration} from './market-db/registration-access.mjs';
import {transaction} from './market-db/connection.mjs';
import {importRegistrationHistory} from './market-db/registration.mjs';
import {importHistory,verifyHistoryWriter} from './market-db/history.mjs';
import {acquireRegisteredWorker,releaseRegisteredWorker,registeredContext,claimRegistered,pendingRegistered,beforeRegisteredRequest,finishRegistered} from './market-db/registration-scheduler.mjs';
import {receiptStore} from './periodic-jobs.mjs';
import {fetchRegisteredHistorySource,hashHistory,historyProjection} from './supply-history-source.mjs';
import {archiveCompressedSources,readCompressedSource} from './history-archive.mjs';
const coins=['usdt','usdc','rlusd','jpyc','jpysc'];
export function registeredCollectorArguments(args){
 if(!['run','status'].includes(args[0]))throw Error('INVALID_COMMAND');
 const options={command:args[0],once:false,stateDirectory:'.state/collector-state',archiveRoot:'.state/collector-archive'};const seen=new Set();
 for(let i=1;i<args.length;i++){
  const flag=args[i];if(seen.has(flag))throw Error('INVALID_ARGUMENTS');seen.add(flag);
  if(options.command==='status'&&!['--env-file','--selection'].includes(flag))throw Error('INVALID_ARGUMENTS');
  if(flag==='--once')options.once=true;
  else if(['--env-file','--selection','--state-dir','--archive-dir'].includes(flag)&&args[i+1]&&!args[i+1].startsWith('--'))options[{'--env-file':'envFile','--selection':'selectionId','--state-dir':'stateDirectory','--archive-dir':'archiveRoot'}[flag]]=args[++i];
  else throw Error('INVALID_ARGUMENTS');
 }
 if(!/^[a-f0-9]{64}$/.test(options.selectionId??''))throw Error('INVALID_ARGUMENTS');return options;
}
// Each stage is idempotent. A receipt remains authoritative after any COMMIT response loss.
export async function processRegisteredCoin({reservation,context,receipts,archiveRoot,request,stamp=()=>new Date().toISOString(),guard,importRegistered,importLegacy,finish,signal}={}){
 const {job,slot,coinId,selectionId}=reservation;if(['STORED','FAILED','UNCONFIRMED','ALREADY_RESERVED'].includes(reservation.state))return {...reservation};
 let receipt,providerRequests=0;
 try{
  signal?.throwIfAborted();receipt=await receipts.read(job,slot);
  if(reservation.state==='RECOVER'&&!receipt){await finish(reservation,'UNCONFIRMED','SOURCE_RECEIPT_MISSING');return {...reservation,state:'UNCONFIRMED',recoverable:false,errorCode:'SOURCE_RECEIPT_MISSING'};}
  let bytes;
  if(receipt){
   if(receipt.payload.selectionId!==selectionId||receipt.payload.metadataId!==context.metadata_id||receipt.payload.coinId!==coinId)throw Error('REGISTRATION_DB_CONTENT_CONFLICT');
   bytes=await readCompressedSource(join(archiveRoot,'history'),receipt.payload.sourceHash);
  }else{
   signal?.throwIfAborted();
   // A cutover during the UTC day reuses the legacy worker's durable raw receipt.
   const old=['usdt','usdc','rlusd'].includes(coinId)?await receipts.read('DEFILLAMA',slot):null;
   const saved=old?.payload.find(s=>s.coinId===coinId);
   if(saved)bytes=await readCompressedSource(join(archiveRoot,'history'),saved.sourceHash);
   else{await guard(reservation);signal?.throwIfAborted();providerRequests++;bytes=await request(coinId);}
   const fetchedAt=saved?.fetchedAt??await stamp();
   const proof={coinId,metadataId:context.metadata_id,selectionId,sourceHash:hashHistory(bytes),fetchedAt};
   await archiveCompressedSources([{hash:proof.sourceHash,bytes}],join(archiveRoot,'history'));
   await receipts.save(job,slot,proof);receipt=await receipts.read(job,slot);
  }
  signal?.throwIfAborted();const input={selectionId,coinId,bytes,fetchedAt:receipt.payload.fetchedAt,requestDay:reservation.day};
  const stats=await importRegistered(input);
  if(['usdt','usdc','rlusd'].includes(coinId))await importLegacy(context.legacy,[historyProjection(bytes,coinId,context.legacy,input.fetchedAt),historyProjection(bytes,coinId,context.legacy,input.fetchedAt,{metric:'NETWORK_MINTED'})]);
  signal?.throwIfAborted();await finish(reservation,'STORED');return {...stats,providerRequests,coinId,day:reservation.day,state:'STORED',recovered:reservation.state==='RECOVER'};
 }catch(error){
  if(signal?.aborted)throw error;
  // A corrupted/uncertain receipt is never treated as permission to fetch again.
  try{receipt??=await receipts.read(job,slot);}catch{receipt=true;}
  if(receipt)return {coinId,day:reservation.day,providerRequests,state:'UNCONFIRMED',recoverable:true,errorCode:safeErrorCode(error)};
  await finish(reservation,'FAILED',safeErrorCode(error));return {coinId,day:reservation.day,providerRequests,state:'FAILED',errorCode:safeErrorCode(error)};
 }
}
export async function runRegisteredCollector({env,options,signal,connect=connectDatabase,fetcher=fetch,wait=(ms,s)=>pause(ms,undefined,{signal:s}),onState=()=>{}}={}){
 const client=await connect(env),lost=new AbortController(),combined=signal?AbortSignal.any([signal,lost.signal]):lost.signal;client.on('error',()=>lost.abort());let locked=false;
 try{
  const pid=await acquireRegisteredWorker(client,options.selectionId);locked=true;await verifyHistoryWriter(client);
  const marketEnabled=await transaction(client,async()=>await verifyRegistration(client)>=3,{repeatableRead:true});
  const receipts=await receiptStore(options.stateDirectory),context=await registeredContext(client,options.selectionId);
  if(context.metadata.coins.map(c=>c.id).sort().join(',')!==[...coins].sort().join(','))throw Error('REGISTRATION_METADATA_INVALID');
  const process=reservation=>processRegisteredCoin({reservation,context,receipts,archiveRoot:options.archiveRoot,signal:combined,
   request:coin=>fetchRegisteredHistorySource(coin,(url,o)=>{combined.throwIfAborted();return fetcher(url,{...o,signal:AbortSignal.any([combined,o.signal])});}),
   stamp:async()=>new Date((await client.query('SELECT clock_timestamp() AS now')).rows[0].now).toISOString(),
   guard:r=>beforeRegisteredRequest(client,r,pid),importRegistered:async input=>{const stats=await importRegistrationHistory(client,input);return marketEnabled?{...stats,...await importCoinMarket(client,input)}:stats;},importLegacy:(legacy,snapshots)=>importHistory(client,legacy,snapshots),finish:(...a)=>finishRegistered(client,...a)});
  do{
   combined.throwIfAborted();const handled=new Set();let failed=false;
   const recoveries=await pendingRegistered(client,options.selectionId,pid);
   for(const r of recoveries){combined.throwIfAborted();handled.add(r.day+':'+r.coinId);const result=await process(r);await onState(result);if(result.state!=='STORED')failed=true;}
   for(const coinId of coins){
    combined.throwIfAborted();const r=await claimRegistered(client,{coinId,selectionId:options.selectionId,pid});
    if(handled.has(r.day+':'+coinId))continue;
    const result=await process(r);await onState(result);if(['FAILED','UNCONFIRMED'].includes(result.state))failed=true;
   }
   const now=new Date((await client.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime(),delay=86400000-now%86400000;
   const result={state:failed?'PARTIAL':'COMPLETED',nextAt:new Date(now+delay).toISOString()};if(options.once)return result;
   await onState({...result,state:'WAITING'});try{await wait(delay,combined);}catch(e){if(!combined.aborted)throw e;}
  }while(!combined.aborted);
  return {state:'STOPPED'};
 }catch(error){if(signal?.aborted&&!lost.signal.aborted)return {state:'STOPPED'};throw error;}
 finally{if(locked)await releaseRegisteredWorker(client).catch(()=>{});await client.end().catch(()=>{});}
}
export async function main(args,env=process.env){
 const options=registeredCollectorArguments(args),variables=await workspaceEnvironment(options.envFile,options.envFile?{}:env),stop=new AbortController(),handler=()=>stop.abort();
 if(options.command==='status'){const client=await connectDatabase(variables);try{return await registeredCollectorStatus(client,options.selectionId);}finally{await client.end().catch(()=>{});}}
 for(const event of ['SIGINT','SIGTERM'])process.once(event,handler);
 try{return await runRegisteredCollector({env:variables,options,signal:stop.signal,onState:state=>console.log(JSON.stringify(state))});}
 finally{for(const event of ['SIGINT','SIGTERM'])process.removeListener(event,handler);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const result=await main(process.argv.slice(2));console.log(JSON.stringify(result));if(result.state==='PARTIAL')process.exitCode=1;}catch(error){console.error('REGISTERED_COLLECTOR_FAILED ('+safeErrorCode(error)+'): details omitted.');process.exitCode=1;}}
