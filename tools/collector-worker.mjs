import {resolveArkhamSchedule,collectorScheduleEnvironment} from './arkham-schedule.mjs';
import {mkdir} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {atomic,defaultMarketDirectory} from './market-store.mjs';
import {isCLIEntrypoint} from './cli-entrypoint.mjs';
import {setTimeout as pause} from 'node:timers/promises';
import {workspaceEnvironment} from './workspace-env.mjs';
import {connectDatabase} from './market-db/connection.mjs';
import {claimScheduled,finishScheduled,acquireWorker,releaseWorker,schedulerStatus,pendingScheduled,assertSchedulerPolicy,schedulerConfiguration} from './market-db/scheduler.mjs';
import {periodicJobs,receiptStore} from './periodic-jobs.mjs';
import {safeErrorCode} from './market-db/errors.mjs';
export function parseCollectorArguments(args,env={}){
 const result={command:args[0],once:false,stateDirectory:'.state/collector-state',archiveRoot:'.state/collector-archive'};if(!['run','status'].includes(result.command))throw Error('INVALID_COMMAND');const seen=new Set();
 for(let i=1;i<args.length;i++){const flag=args[i];if(seen.has(flag))throw Error('INVALID_ARGUMENTS');seen.add(flag);
  if(flag==='--skip-daily-history'&&result.command==='run')result.skipDailyHistory=true;
  else if(flag==='--once'&&result.command==='run')result.once=true;
  else if(flag==='--arkham-runs-per-day'&&/^\d{1,3}$/.test(args[i+1]??''))result.arkhamRunsPerDay=Number(args[++i]);
  else if(flag==='--arkham-interval'&&args[i+1]&&!args[i+1].startsWith('--'))result.arkhamInterval=args[++i];
  else if(['--env-file','--schedule-file',...(result.command==='run'?['--state-dir','--archive-dir','--market-dir']:[])].includes(flag)&&args[i+1]&&!args[i+1].startsWith('--'))result[{'--env-file':'envFile','--schedule-file':'scheduleFile','--state-dir':'stateDirectory','--archive-dir':'archiveRoot','--market-dir':'marketDirectory'}[flag]]=args[++i];
  else throw Error('INVALID_ARGUMENTS');
 }if(result.marketDirectory!==undefined&&(result.marketDirectory.length>4096||/[\x00-\x1f]/.test(result.marketDirectory)||basename(resolve(result.marketDirectory))!=='market-store'))throw Error('INVALID_ARGUMENTS');const schedule=resolveArkhamSchedule(result,env);return {...result,arkhamInterval:schedule.interval,arkhamRunsPerDay:schedule.dailyRunLimit};
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
 const schedule=resolveArkhamSchedule(options);options={...options,arkhamInterval:schedule.interval,arkhamRunsPerDay:schedule.dailyRunLimit};
 if(options.arkhamRunsPerDay>0&&!env.ARKM_API_KEY?.trim())throw Error('MISSING_ARGUMENT');const client=await connect(env),lost=new AbortController(),combined=signal?AbortSignal.any([signal,lost.signal]):lost.signal;client.on('error',()=>lost.abort());let locked=false;
 try{
  const pid=await acquireWorker(client);locked=true;if(options.arkhamRunsPerDay>0)await assertSchedulerPolicy(client,schedule);await onState({state:'STARTING'});const receipts=await receiptStore(options.stateDirectory),jobs=jobsFactory({env,receipts,archiveRoot:options.archiveRoot,marketDirectory:options.marketDirectory,signal:combined});
  do{
   if(options.arkhamRunsPerDay>0)await assertSchedulerPolicy(client,schedule);
   for(const reservation of await pendingScheduled(client)){if(reservation.job==='ARKHAM')await assertSchedulerPolicy(client,schedule);if(options.skipDailyHistory&&reservation.job==='DEFILLAMA')throw Error('SCHEDULER_RECONCILE_REQUIRED');if(combined.aborted)break;const result=await processScheduledJob({reservation,jobs,receipts,finish:(...args)=>finishScheduled(client,...args),signal:combined});await onState(result);if(result.state==='UNCONFIRMED'&&result.recoverable!==false)throw Error('SCHEDULER_RECONCILE_REQUIRED');}
   let now=Date.now(),arkhamExhausted=options.arkhamRunsPerDay===0,failed=false;
   for(const [job,budget]of [...(options.skipDailyHistory?[]:[['DEFILLAMA',1]]),...(options.arkhamRunsPerDay?[['ARKHAM',options.arkhamRunsPerDay]]:[])]){
    if(combined.aborted)break;
    if((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid!==pid)throw Error('SCHEDULER_SESSION_CHANGED');
    const reservation=await claimScheduled(client,job,budget,job==='ARKHAM'?schedule:undefined);now=reservation.now;if(job==='ARKHAM'&&reservation.used>=budget)arkhamExhausted=true;const result=await processScheduledJob({reservation,jobs,receipts,finish:(...args)=>finishScheduled(client,...args),signal:combined});await onState(result);if(['FAILED','UNCONFIRMED'].includes(result.state))failed=true;
    if(result.state==='UNCONFIRMED'&&result.recoverable!==false)throw Error('SCHEDULER_RECONCILE_REQUIRED');
   }
   if(combined.aborted)break;
   now=new Date((await client.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime();
   const interval=arkhamExhausted?86400000:schedule.intervalMs,delay=Math.max(1000,interval-now%interval);
   if(options.once)return {state:failed?'FAILED':'COMPLETED',arkhamRunsPerDay:options.arkhamRunsPerDay,nextAt:new Date(now+delay).toISOString()};
   await onState({state:'WAITING',nextAt:new Date(now+delay).toISOString(),arkhamBudgetExhausted:arkhamExhausted});
   // No missed-slot catch-up. Wake on signal; slots and daily budgets remain in PostgreSQL.
   try{await wait(delay,combined);}catch(e){if(!combined.aborted)throw e;}
  }while(!combined.aborted);
  if(lost.signal.aborted)throw Error('SCHEDULER_CONNECTION_LOST');
  return {state:combined.aborted?'STOPPED':'WAITING',arkhamRunsPerDay:options.arkhamRunsPerDay};
 }finally{if(locked)await releaseWorker(client).catch(()=>{});await client.end().catch(()=>{});}
}
export async function main(args,env=process.env){
 // Resolve the schedule file before final parsing, so environment-only legacy budgets
 // are validated against their effective interval rather than the default interval.
 const scheduleFileIndex=args.indexOf('--schedule-file'),scheduleEnv=await collectorScheduleEnvironment(scheduleFileIndex<0?undefined:args[scheduleFileIndex+1],env);
 const options=parseCollectorArguments(args,scheduleEnv),schedule=resolveArkhamSchedule(options),variables=await workspaceEnvironment(options.envFile,options.envFile?{}:env);
 if(options.command==='status'){const client=await connectDatabase(variables);try{return {schedule:await schedulerConfiguration(client,schedule),runs:await schedulerStatus(client)};}finally{await client.end();}}
 const stop=new AbortController(),handler=()=>stop.abort();for(const name of ['SIGINT','SIGTERM'])process.once(name,handler);
 const marketRoot=options.marketDirectory?resolve(options.marketDirectory):fileURLToPath(defaultMarketDirectory);await mkdir(marketRoot,{recursive:true,mode:0o700});
 let ownsStatus=false;const save=async(state,nextAt=null)=>atomic(join(marketRoot,'periodic-state.json'),{state,updatedAt:new Date().toISOString(),nextAt,arkhamRunsPerDay:options.arkhamRunsPerDay});
 try{const result=await runCollector({env:variables,options,signal:stop.signal,onState:async state=>{ownsStatus=true;await save(['STARTING','WAITING'].includes(state.state)?state.state:'RUNNING',state.nextAt??null);console.log(JSON.stringify(state));}});await save(result.state==='FAILED'?'FAILED':'STOPPED');return result;}
 catch(error){if(ownsStatus)await save('FAILED').catch(()=>{});throw error;}
 finally{for(const name of ['SIGINT','SIGTERM'])process.removeListener(name,handler);}

}
if(isCLIEntrypoint(import.meta.url)){try{const result=await main(process.argv.slice(2));console.log(JSON.stringify(result));if(result.state==='FAILED')process.exitCode=1;}catch(error){console.error('COLLECTOR_FAILED ('+safeErrorCode(error)+'): details omitted.');process.exitCode=1;}}
