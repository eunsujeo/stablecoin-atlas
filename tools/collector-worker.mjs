import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {atomic,defaultMarketDirectory} from './market-store.mjs';
import {pathToFileURL} from 'node:url';
import {setTimeout as pause} from 'node:timers/promises';
import {workspaceEnvironment} from './workspace-env.mjs';
import {connectDatabase} from './market-db/connection.mjs';
import {claimScheduled,finishScheduled,acquireWorker,releaseWorker,schedulerStatus,pendingScheduled} from './market-db/scheduler.mjs';
import {periodicJobs,receiptStore} from './periodic-jobs.mjs';
import {safeErrorCode} from './market-db/errors.mjs';
export function parseCollectorArguments(args){
 const result={command:args[0],once:false,arkhamRunsPerDay:288,stateDirectory:'.state/collector-state',archiveRoot:'.state/collector-archive'};if(!['run','status'].includes(result.command))throw Error('INVALID_COMMAND');const seen=new Set();
 for(let i=1;i<args.length;i++){const flag=args[i];if(seen.has(flag))throw Error('INVALID_ARGUMENTS');seen.add(flag);
  if(flag==='--once'&&result.command==='run')result.once=true;
  else if(flag==='--arkham-runs-per-day'&&result.command==='run'&&/^\d{1,3}$/.test(args[i+1]??''))result.arkhamRunsPerDay=Number(args[++i]);
  else if(['--env-file',...(result.command==='run'?['--state-dir','--archive-dir']:[])].includes(flag)&&args[i+1]&&!args[i+1].startsWith('--'))result[{'--env-file':'envFile','--state-dir':'stateDirectory','--archive-dir':'archiveRoot'}[flag]]=args[++i];
  else throw Error('INVALID_ARGUMENTS');
 }if(result.arkhamRunsPerDay>288)throw Error('INVALID_ARGUMENTS');return result;
}
export async function processScheduledJob({reservation,jobs,receipts,finish,signal}={}){
 const {job,slot}=reservation;if(!['CLAIMED','RECOVER'].includes(reservation.state))return {job,slot,state:reservation.state,used:reservation.used,budget:reservation.budget};
 let receipt;try{
  signal?.throwIfAborted();receipt=await receipts.read(job,slot);
  if(reservation.state==='RECOVER'&&!receipt){await finish(job,slot,'UNCONFIRMED','SOURCE_RECEIPT_MISSING');return {job,slot,state:'UNCONFIRMED',errorCode:'SOURCE_RECEIPT_MISSING',recoverable:false};}
  const result=receipt?await jobs[job].resume(receipt):await jobs[job].collect(slot);
  if(result.state!=='SUCCESS')throw Error('COLLECTION_FAILED');signal?.throwIfAborted();await finish(job,slot,'STORED');return {job,slot,state:'STORED',recovered:!!receipt,valuesInserted:result.valuesInserted??null,unchanged:result.unchanged??null};
 }catch(error){
  // A durable receipt may already be committed. Reconcile by import only, never fetch again.
  try{receipt??=await receipts.read(job,slot);}catch{receipt=true;}
  if(receipt)return {job,slot,state:'UNCONFIRMED',errorCode:safeErrorCode(error)};
  if(!signal?.aborted)try{await finish(job,slot,'FAILED',safeErrorCode(error));}catch{}
  return {job,slot,state:signal?.aborted?'STOPPED':'FAILED',errorCode:safeErrorCode(error)};
 }
}
export async function runCollector({env,options,signal,connect=connectDatabase,jobsFactory=periodicJobs,wait=(ms,s)=>pause(ms,undefined,{signal:s}),onState=()=>{}}={}){
 if(options.arkhamRunsPerDay>0&&!env.ARKM_API_KEY?.trim())throw Error('MISSING_ARGUMENT');const client=await connect(env),lost=new AbortController(),combined=signal?AbortSignal.any([signal,lost.signal]):lost.signal;client.on('error',()=>lost.abort());let locked=false;
 try{
  const pid=await acquireWorker(client);locked=true;await onState({state:'STARTING'});const receipts=await receiptStore(options.stateDirectory),jobs=jobsFactory({env,receipts,archiveRoot:options.archiveRoot,signal:combined});
  do{
   for(const reservation of await pendingScheduled(client)){if(combined.aborted)break;const result=await processScheduledJob({reservation,jobs,receipts,finish:(...args)=>finishScheduled(client,...args),signal:combined});await onState(result);if(result.state==='UNCONFIRMED'&&result.recoverable!==false)throw Error('SCHEDULER_RECONCILE_REQUIRED');}
   let now=Date.now(),arkhamExhausted=options.arkhamRunsPerDay===0,failed=false;
   for(const [job,budget]of [['DEFILLAMA',1],...(options.arkhamRunsPerDay?[['ARKHAM',options.arkhamRunsPerDay]]:[])]){
    if(combined.aborted)break;
    if((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid!==pid)throw Error('SCHEDULER_SESSION_CHANGED');
    const reservation=await claimScheduled(client,job,budget);now=reservation.now;if(job==='ARKHAM'&&reservation.used>=budget)arkhamExhausted=true;const result=await processScheduledJob({reservation,jobs,receipts,finish:(...args)=>finishScheduled(client,...args),signal:combined});await onState(result);if(['FAILED','UNCONFIRMED'].includes(result.state))failed=true;
    if(result.state==='UNCONFIRMED'&&result.recoverable!==false)throw Error('SCHEDULER_RECONCILE_REQUIRED');
   }
   if(combined.aborted)break;
   now=new Date((await client.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime();
   const interval=arkhamExhausted?86400000:300000,delay=Math.max(1000,interval-now%interval);
   if(options.once)return {state:failed?'FAILED':'COMPLETED',arkhamRunsPerDay:options.arkhamRunsPerDay,nextAt:new Date(now+delay).toISOString()};
   await onState({state:'WAITING',nextAt:new Date(now+delay).toISOString(),arkhamBudgetExhausted:arkhamExhausted});
   // No missed-slot catch-up. Wake on signal; slots and daily budgets remain in PostgreSQL.
   try{await wait(delay,combined);}catch(e){if(!combined.aborted)throw e;}
  }while(!combined.aborted);
  if(lost.signal.aborted)throw Error('SCHEDULER_CONNECTION_LOST');
  return {state:combined.aborted?'STOPPED':'WAITING',arkhamRunsPerDay:options.arkhamRunsPerDay};
 }finally{if(locked)await releaseWorker(client).catch(()=>{});await client.end().catch(()=>{});}
}
export async function main(args,env=process.env){const options=parseCollectorArguments(args),variables=await workspaceEnvironment(options.envFile,options.envFile?{}:env);
 if(options.command==='status'){const client=await connectDatabase(variables);try{return {runs:await schedulerStatus(client)};}finally{await client.end();}}
 const stop=new AbortController(),handler=()=>stop.abort();for(const name of ['SIGINT','SIGTERM'])process.once(name,handler);
 const marketRoot=fileURLToPath(defaultMarketDirectory);await mkdir(marketRoot,{recursive:true,mode:0o700});
 let ownsStatus=false;const save=async(state,nextAt=null)=>atomic(join(marketRoot,'periodic-state.json'),{state,updatedAt:new Date().toISOString(),nextAt,arkhamRunsPerDay:options.arkhamRunsPerDay});
 try{const result=await runCollector({env:variables,options,signal:stop.signal,onState:async state=>{ownsStatus=true;await save(['STARTING','WAITING'].includes(state.state)?state.state:'RUNNING',state.nextAt??null);console.log(JSON.stringify(state));}});await save(result.state==='FAILED'?'FAILED':'STOPPED');return result;}
 catch(error){if(ownsStatus)await save('FAILED').catch(()=>{});throw error;}
 finally{for(const name of ['SIGINT','SIGTERM'])process.removeListener(name,handler);}

}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const result=await main(process.argv.slice(2));console.log(JSON.stringify(result));if(result.state==='FAILED')process.exitCode=1;}catch(error){console.error('COLLECTOR_FAILED ('+safeErrorCode(error)+'): details omitted.');process.exitCode=1;}}
