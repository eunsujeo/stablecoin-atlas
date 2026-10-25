import {verifySchedulerSchema} from './scheduler-policy.mjs';
import {arkhamSchedule} from '../arkham-schedule.mjs';
import {transaction} from './connection.mjs';
import {requireHistoryRuntime} from './history.mjs';
import {fail} from './plan.mjs';
const jobs=new Set(['ARKHAM','DEFILLAMA']);
export function scheduleSlot(job,now,interval='1h'){if(!jobs.has(job)||!Number.isFinite(now))fail('SCHEDULER_INVALID');const ms=job==='ARKHAM'?arkhamSchedule({interval,dailyRunLimit:0}).intervalMs:86400000;return new Date(Math.floor(now/ms)*ms).toISOString();}
export async function schedulerStatus(client){return transaction(client,async()=>{await requireHistoryRuntime(client);return (await client.query(`SELECT r.job,to_char(r.slot AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS slot,r.state,r.error_code,
  d.budget,(SELECT count(*)::int FROM atlas_history.scheduler_run x WHERE x.job=r.job AND x.day=r.day) AS used
  FROM atlas_history.scheduler_run r JOIN atlas_history.scheduler_day d USING(job,day) ORDER BY r.slot DESC,r.job LIMIT 24`)).rows;},{readonly:true});}
export async function claimScheduled(client,job,budget,schedule){
 if(schedule)schedule=arkhamSchedule({interval:schedule.interval,dailyRunLimit:schedule.dailyRunLimit});
 if(!jobs.has(job)||!Number.isInteger(budget)||budget<1||budget>(job==='ARKHAM'?288:1))fail('SCHEDULER_INVALID');
 return transaction(client,async()=>{
  await requireHistoryRuntime(client);await client.query('SELECT pg_advisory_xact_lock(18471234,404)');
  const now=new Date((await client.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime();
  if(job==='ARKHAM'&&!schedule&&(await client.query("SELECT to_regnamespace('atlas_scheduler') IS NOT NULL AS present")).rows[0].present)fail('SCHEDULER_POLICY_MISMATCH');
  if(job==='ARKHAM'&&schedule){if(budget!==schedule.dailyRunLimit)fail('SCHEDULER_CONFIG_INVALID');await checkPolicy(client,schedule,now);await client.query("SELECT set_config('atlas.arkham_interval_ms',$1,true),set_config('atlas.arkham_daily_limit',$2,true)",[String(schedule.intervalMs),String(schedule.dailyRunLimit)]);}
  const slot=scheduleSlot(job,now,schedule?.interval??'5m'),day=slot.slice(0,10);
  await client.query('INSERT INTO atlas_history.scheduler_day VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[job,day,budget]);
  const row=(await client.query(`SELECT d.budget,(SELECT count(*)::int FROM atlas_history.scheduler_run r WHERE r.job=d.job AND r.day=d.day) AS used FROM atlas_history.scheduler_day d WHERE d.job=$1 AND d.day=$2::date`,[job,day])).rows[0];
  if(row.budget!==budget)fail('SCHEDULER_BUDGET_MISMATCH');
  const old=(await client.query('SELECT state FROM atlas_history.scheduler_run WHERE job=$1 AND slot=$2::timestamptz',[job,slot])).rows[0];
  if(old)return {state:old.state==='CLAIMED'?'RECOVER':'ALREADY_RESERVED',job,slot,used:row.used,budget,now};
  if(row.used>=budget)return {state:'BUDGET_EXHAUSTED',job,slot,used:row.used,budget,now};
  await client.query('INSERT INTO atlas_history.scheduler_run(job,slot) VALUES($1,$2)',[job,slot]);
  return {state:'CLAIMED',job,slot,used:row.used+1,budget,now};
 });
}
export async function finishScheduled(client,job,slot,state,errorCode=null){
 if(!jobs.has(job)||!['STORED','FAILED','UNCONFIRMED'].includes(state)||typeof slot!=='string'||slot!==scheduleSlot(job,Date.parse(slot),'5m')||errorCode!==null&&!/^[A-Z_]{1,64}$/.test(errorCode))fail('SCHEDULER_INVALID');
 return transaction(client,async()=>{await requireHistoryRuntime(client);await client.query('SELECT pg_advisory_xact_lock(18471234,404)');
  const current=(await client.query('SELECT state,error_code FROM atlas_history.scheduler_run WHERE job=$1 AND slot=$2::timestamptz',[job,slot])).rows[0];if(!current)fail('SCHEDULER_INVALID');
  if(current.state!=='CLAIMED'){if(current.state===state&&current.error_code===errorCode)return {state:'UNCHANGED'};fail('SCHEDULER_INVALID');}
  await client.query('UPDATE atlas_history.scheduler_run SET state=$3,finished_at=clock_timestamp(),error_code=$4 WHERE job=$1 AND slot=$2::timestamptz',[job,slot,state,errorCode]);return {state};
 });
}
export async function acquireWorker(client){return transaction(client,async()=>{await requireHistoryRuntime(client);const {rows:[r]}=await client.query('SELECT pg_try_advisory_lock(18471234,405) AS locked,pg_backend_pid() AS pid');if(!r.locked)fail('SCHEDULER_LOCKED');return r.pid;},{readonly:true});}
export async function releaseWorker(client){await client.query('SELECT pg_advisory_unlock(18471234,405)');}

export async function pendingScheduled(client){return transaction(client,async()=>{
 await requireHistoryRuntime(client);const rows=(await client.query(`SELECT job,to_char(slot AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS slot FROM atlas_history.scheduler_run WHERE state='CLAIMED' ORDER BY slot,job LIMIT 25`)).rows;
 if(rows.length>24)fail('SCHEDULER_RECOVERY_LIMIT');return rows.map(r=>({...r,state:'RECOVER'}));
},{readonly:true});}

async function checkPolicy(client,schedule,now){
 await verifySchedulerSchema(client);
 const policy=(await client.query("SELECT to_char(effective_day,'YYYY-MM-DD') AS effective_day,interval_ms,budget FROM atlas_scheduler.arkham_policy WHERE effective_day<=$1::date ORDER BY effective_day DESC LIMIT 1",[new Date(now).toISOString().slice(0,10)])).rows[0];
 if(!policy||policy.interval_ms!==schedule.intervalMs||policy.budget!==schedule.dailyRunLimit)fail('SCHEDULER_POLICY_MISMATCH');
 const day=(await client.query("SELECT budget FROM atlas_history.scheduler_day WHERE job='ARKHAM' AND day=$1::date",[new Date(now).toISOString().slice(0,10)])).rows[0];
 if(day&&day.budget!==schedule.dailyRunLimit)fail('SCHEDULER_BUDGET_MISMATCH');
 return policy;
}
export async function assertSchedulerPolicy(client,schedule){schedule=arkhamSchedule({interval:schedule.interval,dailyRunLimit:schedule.dailyRunLimit});return transaction(client,async()=>{
 await requireHistoryRuntime(client);
 const now=new Date((await client.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime();
 return checkPolicy(client,schedule,now);
},{readonly:true});}
export async function schedulerConfiguration(client,schedule){return transaction(client,async()=>{
 await requireHistoryRuntime(client);const now=new Date((await client.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime(),day=new Date(now).toISOString().slice(0,10);
 const installed=await verifySchedulerSchema(client,{required:false});
 const policies=installed?(await client.query("SELECT to_char(effective_day,'YYYY-MM-DD') AS effective_day,interval_ms,budget FROM atlas_scheduler.arkham_policy ORDER BY effective_day")).rows:[];
 const active=policies.filter(p=>p.effective_day<=day).at(-1)??null;
 const budget=(await client.query("SELECT budget,(SELECT count(*)::int FROM atlas_history.scheduler_run WHERE job='ARKHAM' AND day=$1::date) AS used FROM atlas_history.scheduler_day WHERE job='ARKHAM' AND day=$1::date",[day])).rows[0]??null;
 const latest=(await client.query("SELECT to_char(slot AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS slot FROM atlas_history.scheduler_run WHERE job='ARKHAM' AND state='STORED' ORDER BY slot DESC LIMIT 1")).rows[0]?.slot??null;
 const pending=(await client.query("SELECT to_char(slot AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS slot,state FROM atlas_history.scheduler_run WHERE job='ARKHAM' AND state='CLAIMED' ORDER BY slot LIMIT 25")).rows;
 const currentSlot=scheduleSlot('ARKHAM',now,schedule.interval),current=(await client.query("SELECT state,error_code FROM atlas_history.scheduler_run WHERE job='ARKHAM' AND slot=$1::timestamptz",[currentSlot])).rows[0]??null;
 const matches=!!active&&active.interval_ms===schedule.intervalMs&&active.budget===schedule.dailyRunLimit&&(!budget||budget.budget===schedule.dailyRunLimit);
 return {runtime:schedule,databaseNow:new Date(now).toISOString(),activePolicy:active,futurePolicies:policies.filter(p=>p.effective_day>day),policyState:!installed?'UPGRADE_REQUIRED':matches?'MATCH':'MISMATCH',dayBudget:budget,latestStoredSlot:latest,pending,currentSlot,currentJobState:current,nextScheduledSlot:matches&&schedule.dailyRunLimit>0?new Date((budget?.used??0)>=schedule.dailyRunLimit?Math.floor(now/86400000)*86400000+86400000:Math.floor(now/schedule.intervalMs)*schedule.intervalMs+schedule.intervalMs).toISOString():null,providerSuccess:'NOT_OBSERVED_BY_STATUS'};
},{readonly:true,repeatableRead:true});}
