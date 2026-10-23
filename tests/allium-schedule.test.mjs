import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {simulationSchedule,scheduleSimulation} from '../tools/allium-schedule-simulation.mjs';
import {simulationOrg as org} from './allium-daily-fixture.mjs';
const config={organizationHash:org,days:['2026-10-23','2026-10-25'],utcMinute:600};
test('finite schedule pins explicit ordered UTC dates and rejects activation, extra fields and tampering',()=>{
 const s=simulationSchedule(config);assert.equal(s.maxTicks,128);assert.equal(s.executionEnabled,false);
 for(const change of [{days:[]},{days:['2026-02-30']},{days:['2026-10-25','2026-10-23']},
  {days:['2026-10-23','2026-10-23']},{days:Array(32).fill('2026-10-23')},{utcMinute:1426},{utcMinute:0.5},{organizationHash:'bad'}]){
  assert.throws(()=>simulationSchedule({...config,...change}),/OFFLINE_BLOCKED/);
 }
 for(const change of [{executionEnabled:true},{maxTicks:129},{apiKey:'FORBIDDEN'},{windowMinutes:60}]){
  assert.throws(()=>scheduleSimulation({}, {...s,...change}),/OFFLINE_BLOCKED/);
 }
});
test('ticks never catch up missed days, obey strict UTC, reject reversal and stop at a finite bound',async()=>{
 let at='2026-10-23T09:59:59Z',reads=0;
 const ledger={simulationTime:async()=>at,read:async()=>{reads++;return {kind:'ALLIUM_DAILY_OFFLINE_SIMULATION',executionEnabled:false,
  providerRequests:0,lastEventAt:null,usages:[],reservations:[]};}};
 const run=scheduleSimulation(ledger,simulationSchedule(config));
 assert.equal((await run.tick()).state,'NOT_DUE');
 at='2026-10-23T10:15:00Z';assert.equal((await run.tick()).state,'MISSED_WINDOW');
 at='2026-10-24T10:00:00Z';assert.equal((await run.tick()).state,'UNLISTED_DAY');
 at='2026-10-23T10:00:00Z';assert.equal((await run.tick()).state,'BLOCKED');
 at='2026-10-24T10:00:00+00:00';assert.equal((await run.tick()).state,'BLOCKED');
 at='2026-10-24T10:00:00Z';for(let i=5;i<128;i++)await run.tick();
 await assert.rejects(run.tick(),/OFFLINE_BLOCKED/);assert.equal(reads,126);
});
test('persisted event time blocks reversal after restart before any write; concurrent tick is rejected',async()=>{
 let release;const ready=new Promise(r=>{release=r;});let wait=false;
 const ledger={simulationTime:async()=>{if(wait)await ready;return '2026-10-23T10:00:00Z';},read:async()=>({
  kind:'ALLIUM_DAILY_OFFLINE_SIMULATION',executionEnabled:false,providerRequests:0,
  lastEventAt:'2026-10-24T10:00:00Z',usages:[],reservations:[]})};
 assert.equal((await scheduleSimulation(ledger,simulationSchedule(config)).tick()).state,'BLOCKED');
 const run=scheduleSimulation(ledger,simulationSchedule(config));wait=true;const pending=run.tick();
 await assert.rejects(run.tick(),/OFFLINE_BLOCKED/);release();assert.equal((await pending).state,'BLOCKED');
});
test('schedule has no timer, environment loader, network client, virtual DB clock or live executor',async()=>{
 const source=await readFile(new URL('../tools/allium-schedule-simulation.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/setTimeout|setInterval|process\.env|fetch\(|https?:|executeAllium|allium-live|clock_timestamp/);
});
