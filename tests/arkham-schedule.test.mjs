import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {arkhamSchedule,arkhamIntervals,collectorScheduleEnvironment} from '../tools/arkham-schedule.mjs';
import {parseCollectorArguments,main} from '../tools/collector-worker.mjs';
import {scheduleSlot} from '../tools/market-db/scheduler.mjs';

test('hourly defaults, UTC grids, midnight and independent bounded reservation limits',()=>{
 assert.equal(arkhamSchedule().interval,'1h');assert.equal(arkhamSchedule().dailyRunLimit,24);assert.equal(arkhamSchedule().maxRequestsPerDay,168);
 for(const [interval,ms] of Object.entries(arkhamIntervals)){
  const limit=86400000/ms,config=arkhamSchedule({interval,dailyRunLimit:limit});assert.equal(config.slotsPerDay,limit);
  const at=Date.parse('2026-10-25T23:59:59.999Z');assert.equal(Date.parse(scheduleSlot('ARKHAM',at,interval)),Math.floor(at/ms)*ms);
  assert.equal(scheduleSlot('ARKHAM',Date.parse('2026-10-26T00:00:00Z'),interval),'2026-10-26T00:00:00.000Z');
  assert.equal(arkhamSchedule({interval,dailyRunLimit:1}).maxRequestsPerDay,7);
  assert.throws(()=>arkhamSchedule({interval,dailyRunLimit:limit+1}),/SCHEDULER_CONFIG_INVALID/);
 }
 assert.equal(scheduleSlot('ARKHAM',Date.parse('2026-10-25T13:20:00Z')),'2026-10-25T13:00:00.000Z');
 for(const interval of ['0m','-1h','1.5h','60m','1d','7m','',null])assert.throws(()=>arkhamSchedule({interval}));
 for(const dailyRunLimit of ['','1.5','-1','01','289',-1,NaN,Infinity,1.5])assert.throws(()=>arkhamSchedule({dailyRunLimit}));
});
test('CLI > inherited schedule environment > explicit schedule file > defaults; credentials never enter schedule settings',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-schedule-'));try{
  const path=join(root,'schedule.env');await writeFile(path,'ARKHAM_COLLECTION_INTERVAL=15m\nARKHAM_DAILY_RUN_LIMIT=72\n');
  const env=await collectorScheduleEnvironment(path,{ARKHAM_COLLECTION_INTERVAL:'30m',ARKHAM_DAILY_RUN_LIMIT:'48',DATABASE_URL:'private-not-used'});
  assert.deepEqual(env,{ARKHAM_COLLECTION_INTERVAL:'30m',ARKHAM_DAILY_RUN_LIMIT:'48'});
  assert.equal(parseCollectorArguments(['run'],env).arkhamRunsPerDay,48);
  const cli=parseCollectorArguments(['run','--arkham-interval','1h','--arkham-runs-per-day','12'],env);assert.equal(cli.arkhamInterval,'1h');assert.equal(cli.arkhamRunsPerDay,12);
  assert.equal(parseCollectorArguments(['status'],await collectorScheduleEnvironment(path,{})).arkhamInterval,'15m');
  // Explicit writer file must not discard the process schedule. Invalid schedule
  // fails before opening writer credentials or any database/network connection.
  await assert.rejects(main(['run','--env-file',join(root,'absent.env')],{ARKHAM_COLLECTION_INTERVAL:'bad'}),/SCHEDULER_CONFIG_INVALID/);
  await writeFile(path,'DATABASE_URL=private-not-used\n');await assert.rejects(collectorScheduleEnvironment(path,{}),/SCHEDULER_CONFIG_INVALID/);
  await assert.rejects(collectorScheduleEnvironment(join(root,'missing'),{}));
  assert.throws(()=>parseCollectorArguments(['run','--arkham-runs-per-day','288']),/SCHEDULER_CONFIG_INVALID/);
  assert.equal(parseCollectorArguments(['run','--arkham-interval','5m','--arkham-runs-per-day','288']).arkhamRunsPerDay,288);
 }finally{await rm(root,{recursive:true,force:true});}
});
