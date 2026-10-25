import {readHistory as legacyReadHistory} from '../fixtures/history-v4-reader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fixture} from './fixture.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {initialize,grantAccess} from '../../tools/market-db/schema.mjs';
import {initializeHistory,normalizeHistory,enableContinuousHistory,upgradeScheduler,configureScheduler,grantHistoryWriter,grantHistoryReader,verifyHistoryWriter,readHistory} from '../../tools/market-db/history.mjs';
import {claimScheduled,finishScheduled,acquireWorker,releaseWorker,schedulerConfiguration} from '../../tools/market-db/scheduler.mjs';
import {arkhamSchedule} from '../../tools/arkham-schedule.mjs';
import {runCollector,processScheduledJob,main as collectorMain} from '../../tools/collector-worker.mjs';
import {receiptStore} from '../../tools/periodic-jobs.mjs';
const registry=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url)));

// Harness only: the real PostgreSQL executes every query/constraint/lock. Only
// the exact application clock query is supplied a synthetic UTC timestamp.
function harnessClock(client,clock){const query=client.query.bind(client);client.query=(sql,...args)=>sql==='SELECT clock_timestamp() AS now'?query('SELECT $1::timestamptz AS now',[clock()]):query(sql,...args);return client;}

test('configurable policies preserve legacy history, serialize owners, guard direct SQL and keep read-only status free of reservations',{timeout:120000},async()=>{
 const f=await fixture(),root=await mkdtemp(join(tmpdir(),'atlas-configurable-'));let writer,second,owner2,reader;
 try{
  await initialize(f.admin);await initializeHistory(f.admin);await normalizeHistory(f.admin,registry);await enableContinuousHistory(f.admin);
  const url=await f.createUser('atlas_test_schedulewriter'),readerUrl=await f.createUser('atlas_test_schedulereader');
  await grantAccess(f.admin,'atlas_test_schedulewriter','writer');await grantHistoryWriter(f.admin,'atlas_test_schedulewriter');await grantAccess(f.admin,'atlas_test_schedulereader','reader');await grantHistoryReader(f.admin,'atlas_test_schedulereader');
  writer=await connectDatabase({DATABASE_URL:url});second=await connectDatabase({DATABASE_URL:url});owner2=await connectDatabase({DATABASE_URL:f.url('postgres')});reader=await connectDatabase({DATABASE_URL:readerUrl});
  const today=(await f.admin.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day")).rows[0].day;
  const day=n=>new Date(Date.parse(today)+n*86400000).toISOString().slice(0,10),oldSlot=day(-1)+'T04:25:00.000Z';
  await f.admin.query("INSERT INTO atlas_history.scheduler_day VALUES('ARKHAM',$1,288)",[day(-1)]);
  for(let i=0;i<54;i++){const slot=new Date(Date.parse(day(-1))+i*300000).toISOString();await f.admin.query("INSERT INTO atlas_history.scheduler_run(job,slot) VALUES('ARKHAM',$1)",[slot]);await finishScheduled(writer,'ARKHAM',slot,i===0?'UNCONFIRMED':'STORED',i===0?'SOURCE_RECEIPT_MISSING':null);}
  const original=async()=>(await f.admin.query('SELECT * FROM atlas_history.scheduler_run WHERE day=$1 ORDER BY slot',[day(-1)])).rows;
  const before=await original();assert.equal(before.at(-1).slot.toISOString(),oldSlot);
  const historyPins=async()=>(await f.admin.query("SELECT version,encode(migration_hash,'hex') AS migration,encode(structure_hash,'hex') AS structure FROM atlas_history.schema_version ORDER BY version")).rows,pinsBefore=await historyPins();
  const pending=await claimScheduled(writer,'ARKHAM',288);
  await assert.rejects(upgradeScheduler(f.admin),/SCHEDULER_RECONCILE_REQUIRED/);await finishScheduled(writer,'ARKHAM',pending.slot,'STORED');
  await acquireWorker(writer);await assert.rejects(upgradeScheduler(f.admin),/SCHEDULER_LOCKED/);await releaseWorker(writer);
  const failing={query:async(sql,...args)=>{const result=await f.admin.query(sql,...args);if(typeof sql==='string'&&sql.includes('CREATE TABLE atlas_scheduler.arkham_policy'))throw Error('SIMULATED_MIGRATION_FAILURE');return result;}};
  await assert.rejects(upgradeScheduler(failing),/SIMULATED_MIGRATION_FAILURE/);
  assert.equal((await f.admin.query("SELECT to_regclass('atlas_scheduler.arkham_policy') AS table")).rows[0].table,null);
  const upgrades=await Promise.all([upgradeScheduler(f.admin),upgradeScheduler(owner2)]);assert.deepEqual(upgrades.map(r=>r.state).sort(),['UNCHANGED','UPGRADED']);
  const pinsAfter=await historyPins();assert.equal(pinsAfter.length,4);assert.deepEqual(pinsAfter.map(p=>p.migration),pinsBefore.map(p=>p.migration));assert.deepEqual(pinsAfter.slice(0,3),pinsBefore.slice(0,3));
  assert.equal((await f.admin.query("SELECT encode(original_history_hash,'hex') AS original,encode(history_hash,'hex') AS current FROM atlas_scheduler.schema_version")).rows[0].original,pinsBefore[3].structure);
  assert.deepEqual(await original(),before);assert.equal((await f.admin.query('SELECT budget FROM atlas_history.scheduler_day WHERE day=$1',[day(-1)])).rows[0].budget,288);
  await verifyHistoryWriter(writer);assert.deepEqual(await readHistory(reader,registry),[]);assert.deepEqual(await legacyReadHistory(reader,registry),[]);
  // New grants after scheduler migration also get SELECT-only policy access.
  const newUrl=await f.createUser('atlas_test_newschedulewriter');await grantAccess(f.admin,'atlas_test_newschedulewriter','writer');await grantHistoryWriter(f.admin,'atlas_test_newschedulewriter');assert(newUrl);
  const hourly=arkhamSchedule(),legacy=arkhamSchedule({interval:'5m',dailyRunLimit:288}),config={effectiveDay:day(1),schedule:hourly};
  const count=async()=>(await f.admin.query('SELECT count(*)::int AS n FROM atlas_history.scheduler_run')).rows[0].n,n=await count();
  assert.equal((await schedulerConfiguration(writer,hourly)).policyState,'MISMATCH');assert.equal(await count(),n);
  const writerFile=join(root,'writer.env');await writeFile(writerFile,'DATABASE_URL='+url+'\n',{mode:0o600});
  const inheritedSchedule=await collectorMain(['status','--env-file',writerFile],{DATABASE_URL:'ignored-private-invalid',ARKHAM_COLLECTION_INTERVAL:'5m',ARKHAM_DAILY_RUN_LIMIT:'288'});
  assert.equal(inheritedSchedule.schedule.policyState,'MATCH');assert.equal(inheritedSchedule.schedule.runtime.interval,'5m');assert.equal(await count(),n);
  let jobsCreated=0;await assert.rejects(runCollector({env:{DATABASE_URL:url,ARKM_API_KEY:'fixture'},options:{once:true,skipDailyHistory:true,stateDirectory:join(root,'receipts')},jobsFactory:()=>{jobsCreated++;}}),/SCHEDULER_POLICY_MISMATCH/);assert.equal(jobsCreated,0);assert.equal(await count(),n);
  await assert.rejects(configureScheduler(writer,config),/DATABASE_OWNER_REQUIRED/);
  await assert.rejects(configureScheduler(f.admin,{...config,effectiveDay:today}),/SCHEDULER_POLICY_CONFLICT/);
  await acquireWorker(writer);await assert.rejects(configureScheduler(f.admin,config),/SCHEDULER_LOCKED/);await releaseWorker(writer);
  const configured=await Promise.all([configureScheduler(f.admin,config),configureScheduler(owner2,config)]);assert.deepEqual(configured.map(r=>r.state).sort(),['CONFIGURED','UNCHANGED']);
  await assert.rejects(configureScheduler(f.admin,{...config,schedule:arkhamSchedule({interval:'30m'})}),/SCHEDULER_POLICY_CONFLICT/);
  for(const sql of ["UPDATE atlas_scheduler.arkham_policy SET budget=1",'DELETE FROM atlas_scheduler.arkham_policy'])await assert.rejects(f.admin.query(sql),e=>e.code==='23514');
  await assert.rejects(writer.query("INSERT INTO atlas_scheduler.arkham_policy VALUES($1,3600000,24,clock_timestamp())",[day(2)]),e=>e.code==='42501');
  await assert.rejects(f.admin.query("INSERT INTO atlas_scheduler.arkham_policy(effective_day,interval_ms,budget) VALUES($1,3600000,24)",[today]),e=>e.code==='23514');
  await f.admin.query('BEGIN');await f.admin.query("SELECT set_config('atlas.arkham_interval_ms','3600000',true),set_config('atlas.arkham_daily_limit','24',true)");await f.admin.query("INSERT INTO atlas_history.scheduler_day VALUES('ARKHAM',$1,24)",[day(2)]);await f.admin.query('COMMIT');
  await assert.rejects(configureScheduler(f.admin,{...config,effectiveDay:day(2)}),/SCHEDULER_POLICY_CONFLICT/);
  await assert.rejects(f.admin.query("INSERT INTO atlas_history.scheduler_day VALUES('ARKHAM',$1,288)",[day(2)]),e=>e.code==='23514');
  await assert.rejects(f.admin.query("INSERT INTO atlas_scheduler.arkham_policy(effective_day,interval_ms,budget) VALUES($1,3600000,25)",[day(2)]),e=>e.code==='23514');
  await assert.rejects(writer.query("INSERT INTO atlas_history.scheduler_run(job,slot) VALUES('ARKHAM',$1)",[day(2)+'T13:00:00Z']),e=>e.code==='23514');
  // The transaction marker blocks old clients; it is not an authorization token.
  // A writer can forge it, but cannot bypass the actual stored grid or budget.
  await writer.query('BEGIN');await writer.query("SELECT set_config('atlas.arkham_interval_ms','300000',true),set_config('atlas.arkham_daily_limit','288',true)");
  await assert.rejects(writer.query("INSERT INTO atlas_history.scheduler_run(job,slot) VALUES('ARKHAM',$1)",[day(2)+'T13:00:00Z']),e=>e.code==='23514');await writer.query('ROLLBACK');
  await writer.query('BEGIN');await writer.query("SELECT set_config('atlas.arkham_interval_ms','3600000',true),set_config('atlas.arkham_daily_limit','24',true)");
  await assert.rejects(writer.query("INSERT INTO atlas_history.scheduler_run(job,slot) VALUES('ARKHAM',$1)",[day(2)+'T13:05:00Z']),e=>e.code==='23514');await writer.query('ROLLBACK');
  await writer.query('BEGIN');await writer.query("SELECT set_config('atlas.arkham_interval_ms','3600000',true),set_config('atlas.arkham_daily_limit','24',true)");
  await writer.query("INSERT INTO atlas_history.scheduler_run(job,slot) VALUES('ARKHAM',$1)",[day(2)+'T13:00:00Z']);await writer.query('COMMIT');await finishScheduled(writer,'ARKHAM',day(2)+'T13:00:00.000Z','FAILED','COLLECTION_FAILED');
  await assert.rejects(writer.query("INSERT INTO atlas_history.scheduler_run(job,slot) VALUES('ARKHAM',$1)",[day(2)+'T14:00:00Z']),e=>e.code==='23514');
  let now=day(1)+'T13:20:00.000Z';harnessClock(writer,()=>now);harnessClock(second,()=>now);
  const states=await Promise.all([claimScheduled(writer,'ARKHAM',24,hourly),claimScheduled(second,'ARKHAM',24,hourly)]);
  assert.deepEqual(states.map(r=>r.state).sort(),['CLAIMED','RECOVER']);assert.equal(states[0].slot,day(1)+'T13:00:00.000Z');
  await assert.rejects(configureScheduler(f.admin,{...config,effectiveDay:day(3)}),/SCHEDULER_RECONCILE_REQUIRED/);
  // Legacy 5m receipt and identity remain usable after policy migration.
  const store=await receiptStore(join(root,'receipts')),proof={sourceName:'12345678-1234-1234-1234-123456789012.json',sourceHash:'a'.repeat(64)};
  await store.save('ARKHAM',oldSlot,proof);const bytes=await readFile(join(root,'receipts','arkham-'+oldSlot.replace(/\D/g,'')+'.json'));
  let imports=0;assert.equal((await processScheduledJob({reservation:{job:'ARKHAM',slot:oldSlot,state:'RECOVER'},receipts:store,jobs:{ARKHAM:{resume:async()=>{imports++;return {state:'SUCCESS'};},collect:()=>assert.fail('no collection during recovery')}},finish:async()=>{}})).state,'STORED');assert.equal(imports,1);
  assert.deepEqual(await readFile(join(root,'receipts','arkham-'+oldSlot.replace(/\D/g,'')+'.json')),bytes);
  await finishScheduled(writer,'ARKHAM',states[0].slot,'STORED');assert.equal((await claimScheduled(second,'ARKHAM',24,hourly)).state,'ALREADY_RESERVED');
  await assert.rejects(claimScheduled(writer,'ARKHAM',24,arkhamSchedule({interval:'30m'})),/SCHEDULER_POLICY_MISMATCH/);
  await assert.rejects(writer.query("INSERT INTO atlas_history.scheduler_run(job,slot) VALUES('ARKHAM',$1)",[day(1)+'T13:05:00Z']),e=>e.code==='23514');
  const status=await schedulerConfiguration(writer,hourly);assert.equal(status.policyState,'MATCH');assert.deepEqual(status.dayBudget,{budget:24,used:1});assert.equal(status.nextScheduledSlot,day(1)+'T14:00:00.000Z');assert.equal(status.latestStoredSlot,day(1)+'T13:00:00.000Z');assert.equal(status.providerSuccess,'NOT_OBSERVED_BY_STATUS');
  now=day(1)+'T14:20:00Z';const race=await Promise.allSettled([configureScheduler(f.admin,{effectiveDay:day(3),schedule:arkhamSchedule({interval:'30m'})}),claimScheduled(writer,'ARKHAM',24,hourly)]);
  assert.equal(race[1].status,'fulfilled');if(race[0].status==='rejected')assert.match(race[0].reason.message,/SCHEDULER_RECONCILE_REQUIRED/);else assert.equal(race[0].value.state,'CONFIGURED');await finishScheduled(writer,'ARKHAM',race[1].value.slot,'STORED');
  await configureScheduler(f.admin,{effectiveDay:day(3),schedule:arkhamSchedule({interval:'30m'})});
  // Simulated restart at 16:20 claims only 16:00, never missed 14:00/15:00.
  now=day(1)+'T16:20:00Z';const restarted=await claimScheduled(second,'ARKHAM',24,hourly);assert.equal(restarted.slot,day(1)+'T16:00:00.000Z');assert.equal(restarted.used,3);await finishScheduled(second,'ARKHAM',restarted.slot,'STORED');
  // Simulate a lost COMMIT acknowledgement, then a fresh connection sees RECOVER.
  now=day(1)+'T17:20:00Z';const query=writer.query.bind(writer);let lose=true;writer.query=async(...args)=>{const result=await query(...args);if(args[0]==='COMMIT'&&lose){lose=false;throw Error('LOST_COMMIT_RESPONSE');}return result;};
  await assert.rejects(claimScheduled(writer,'ARKHAM',24,hourly),/LOST_COMMIT_RESPONSE/);assert.equal((await claimScheduled(second,'ARKHAM',24,hourly)).state,'RECOVER');await finishScheduled(second,'ARKHAM',day(1)+'T17:00:00.000Z','UNCONFIRMED','SOURCE_RECEIPT_MISSING');
  now=day(1)+'T23:59:59.999Z';const last=await claimScheduled(writer,'ARKHAM',24,hourly);await finishScheduled(writer,'ARKHAM',last.slot,'STORED');now=day(2)+'T00:00:00Z';assert.equal((await claimScheduled(writer,'ARKHAM',24,hourly)).slot,day(2)+'T00:00:00.000Z');
  now=day(3)+'T00:00:00Z';await assert.rejects(claimScheduled(second,'ARKHAM',24,hourly),/SCHEDULER_POLICY_MISMATCH/);
  assert.deepEqual(await original(),before);assert.equal((await schedulerConfiguration(second,legacy)).policyState,'MISMATCH');
  // Existing immutable day budgets cannot shrink, even for an owner.
  await assert.rejects(f.admin.query("UPDATE atlas_history.scheduler_day SET budget=24 WHERE day=$1",[day(-1)]),e=>e.code==='23514');
  await f.admin.query('GRANT UPDATE(budget) ON atlas_scheduler.arkham_policy TO atlas_test_schedulewriter');await assert.rejects(schedulerConfiguration(second,hourly),/SCHEDULER_PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE UPDATE(budget) ON atlas_scheduler.arkham_policy FROM atlas_test_schedulewriter');
  await f.admin.query('ALTER TABLE atlas_scheduler.arkham_policy ADD COLUMN synthetic integer');await assert.rejects(schedulerConfiguration(second,hourly),/SCHEDULER_SCHEMA_MISMATCH/);await f.admin.query('ALTER TABLE atlas_scheduler.arkham_policy DROP COLUMN synthetic');
  assert.equal((await schedulerConfiguration(second,arkhamSchedule({interval:'30m'}))).policyState,'MATCH');
 }finally{await writer?.end();await second?.end();await owner2?.end();await reader?.end();await f.stop();await rm(root,{recursive:true,force:true});}
});

test('hourly worker restarts use the same receipts; midnight rechecks policy before collection and smaller daily budgets do not reset',{timeout:120000},async()=>{
 const f=await fixture(),root=await mkdtemp(join(tmpdir(),'atlas-hourly-worker-'));let adminWriter;
 try{
  await initialize(f.admin);await initializeHistory(f.admin);await normalizeHistory(f.admin,registry);await enableContinuousHistory(f.admin);await upgradeScheduler(f.admin);
  const url=await f.createUser('atlas_test_hourlywriter');await grantAccess(f.admin,'atlas_test_hourlywriter','writer');await grantHistoryWriter(f.admin,'atlas_test_hourlywriter');
  const today=(await f.admin.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day")).rows[0].day,day=n=>new Date(Date.parse(today)+n*86400000).toISOString().slice(0,10);
  const hourly=arkhamSchedule(),small=arkhamSchedule({dailyRunLimit:2});await configureScheduler(f.admin,{effectiveDay:day(1),schedule:hourly});await configureScheduler(f.admin,{effectiveDay:day(2),schedule:small});
  let now=day(1)+'T13:20:00Z',collected=0,resumed=0,delays=[];
  const connect=async env=>harnessClock(await connectDatabase(env),()=>now),env={DATABASE_URL:url,ARKM_API_KEY:'fixture-not-live'},options={once:true,skipDailyHistory:true,stateDirectory:join(root,'receipts')};
  const jobsFactory=({receipts})=>({ARKHAM:{collect:async slot=>{collected++;await receipts.save('ARKHAM',slot,{sourceName:'12345678-1234-1234-1234-123456789012.json',sourceHash:'b'.repeat(64)});return {state:'SUCCESS'};},resume:async()=>{resumed++;return {state:'SUCCESS'};}}});
  const first=await runCollector({env,options,connect,jobsFactory});assert.equal(first.nextAt,day(1)+'T14:00:00.000Z');assert.equal(first.state,'COMPLETED');assert.equal(collected,1);
  await runCollector({env,options,connect,jobsFactory});assert.equal(collected,1);assert.equal(resumed,0);
  // A crashed prior slot is reconciled by its durable original receipt only.
  adminWriter=await connect(env);now=day(1)+'T12:20:00Z';const crash=await claimScheduled(adminWriter,'ARKHAM',24,hourly);const receipts=await receiptStore(options.stateDirectory);await receipts.save('ARKHAM',crash.slot,{sourceName:'12345678-1234-1234-1234-123456789012.json',sourceHash:'b'.repeat(64)});
  now=day(1)+'T13:20:00Z';await runCollector({env,options,connect,jobsFactory});assert.equal(collected,1);assert.equal(resumed,1);
  now=day(1)+'T23:20:00Z';await assert.rejects(runCollector({env,options:{...options,once:false},connect,jobsFactory,wait:async ms=>{delays.push(ms);now=day(2)+'T00:00:00Z';}}),/SCHEDULER_POLICY_MISMATCH/);assert.deepEqual(delays,[40*60000]);assert.equal(collected,2);
  const smallOptions={...options,arkhamRunsPerDay:2};await runCollector({env,options:smallOptions,connect,jobsFactory});now=day(2)+'T01:00:00Z';await runCollector({env,options:smallOptions,connect,jobsFactory});assert.equal(collected,4);
  now=day(2)+'T02:00:00Z';const exhausted=await runCollector({env,options:smallOptions,connect,jobsFactory});assert.equal(collected,4);assert.equal(exhausted.nextAt,day(3)+'T00:00:00.000Z');
  assert.equal((await claimScheduled(adminWriter,'ARKHAM',2,small)).state,'BUDGET_EXHAUSTED');
  const status=await schedulerConfiguration(adminWriter,small);assert.deepEqual(status.dayBudget,{budget:2,used:2});
  now=day(3)+'T00:00:00Z';await runCollector({env,options:smallOptions,connect,jobsFactory});assert.equal(collected,5);
 }finally{await adminWriter?.end();await f.stop();await rm(root,{recursive:true,force:true});}
});
