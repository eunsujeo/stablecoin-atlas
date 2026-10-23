import test from 'node:test';import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,realpath,chmod,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {fixture} from './fixture.mjs';import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {dailyLab,initializeDailyLab,checkpointDailyLab} from '../../tools/market-db/allium-daily-lab.mjs';
import {createCheckpointStore,checkpointPublisher} from '../../tools/allium-checkpoint.mjs';
import {dailyHash} from '../../tools/allium-daily-plan.mjs';
import {simulationSchedule,scheduleSimulation} from '../../tools/allium-schedule-simulation.mjs';
import {simulation,simulationOrg as org,dailyResponse} from '../allium-daily-fixture.mjs';

async function setup(t,days=['2026-10-23','2026-10-24','2026-10-25']){
 const f=await fixture(),clients=[],publishers=[],fixtureHash=dailyHash(randomBytes(32));
 t.after(async()=>{for(const p of publishers)await p.close().catch(()=>{});for(const c of clients)await c.end().catch(()=>{});await f.stop();});
 const name='atlas_daily_fixture_'+randomBytes(8).toString('hex');
 await f.admin.query(`CREATE DATABASE ${name}`);await f.admin.query(`COMMENT ON DATABASE ${name} IS 'ALLIUM_DAILY_OFFLINE:${fixtureHash}'`);
 const urls={};for(const [key,role]of [['writer','atlas_test_dailywriter'],['reader','atlas_test_dailyreader']]){
  const u=new URL(await f.createUser(role));u.pathname='/'+name;urls[key]=u.href;
 }
 const adminUrl=new URL(f.url('postgres'));adminUrl.pathname='/'+name;
 const admin=await connectDatabase({DATABASE_URL:adminUrl.href});clients.push(admin);
 await initializeDailyLab(admin,{fixtureHash,writer:'atlas_test_dailywriter',reader:'atlas_test_dailyreader'});
 const root=await mkdtemp(join(await realpath(tmpdir()),'allium-schedule-'));await chmod(root,0o700);
 t.after(()=>rm(root,{recursive:true,force:true}));
 const path=join(root,'checkpoint'),identity=await createCheckpointStore(path,{fixtureHash,organizationHash:org});
 const clock={at:days[0]+'T10:00:00.000000Z'},fault={};
 let trustedCheckpoint={count:0,hash:'0'.repeat(64)},publisherTrust=identity.trusted;
 const schedule=simulationSchedule({organizationHash:org,days,utcMinute:600});
 async function connection({published=true}={}){
  const c=await connectDatabase({DATABASE_URL:urls.writer});clients.push(c);let inserted;
  // Virtual time exists only in this owned-fixture test harness. Production DB clock is unchanged.
  const wrapped={connectionParameters:c.connectionParameters,async query(...args){
   const sql=String(args[0]);
   if(sql.startsWith('SELECT to_char(clock_timestamp()'))return {rows:[{at:clock.at}],rowCount:1};
   const result=await c.query(...args);
   if(sql.startsWith('INSERT INTO atlas_allium_daily_lab.entry')){
    inserted=JSON.parse(args[1][4]).type;
    if(fault.event&&fault.event===inserted&&fault.phase==='rollback'){delete fault.event;throw Error('SIMULATED_INSERT_FAILURE');}
   }
   if(sql==='COMMIT'||sql==='ROLLBACK'){
    const event=inserted;inserted=null;
    if(sql==='COMMIT'&&fault.event&&fault.event===event&&fault.phase==='ack'){delete fault.event;throw Error('SIMULATED_COMMIT_ACK_LOSS');}
   }
   return result;
  }};
  const owner=published?await checkpointPublisher(path,{...identity,trusted:publisherTrust}):undefined;if(owner)publishers.push(owner);
  const publisher=owner?{...owner,async publish(...args){const result=await owner.publish(...args);
   trustedCheckpoint=structuredClone(result.checkpoint);publisherTrust=structuredClone(result.trusted);
   if(fault.advanceOnPublish){clock.at=fault.advanceOnPublish;delete fault.advanceOnPublish;}
   if(fault.dropWorkerOnPublish){delete fault.dropWorkerOnPublish;await c.query('SELECT pg_advisory_unlock_all()');}
   return result;}}:undefined;
  const ledger=published?await checkpointDailyLab(wrapped,{fixtureHash,publisher}):dailyLab(wrapped,{fixtureHash});
  return {c,ledger,runner:scheduleSimulation(ledger,schedule),publisher};
 }
 const read=async()=>{const c=await connectDatabase({DATABASE_URL:urls.reader});clients.push(c);
  // Reader uses the same independently retained checkpoint; no send/worker rights.
  return dailyLab(c,{fixtureHash,checkpoints:{[org]:trustedCheckpoint}}).read(org);
 };
 // Restart retains the latest independent trust; it never reconstructs trust from the directory.
 let current=await connection();
 const restart=async()=>{await current.publisher.close();await current.c.end();current=await connection();return current;};
 const count=async()=>(await admin.query('SELECT count(*)::int AS n FROM atlas_allium_daily_lab.entry')).rows[0].n;
 return {f,admin,clock,fault,read,count,restart,connection,get current(){return current;},schedule};
}
function inputs(at,mutate){
 const f=simulation(at,mutate),ok=JSON.stringify({state:'OK',referenceHash:dailyHash('SIMULATED CONTROL')});
 const exchanges=['supply','volume'].flatMap(job=>[
  {job,operation:'create',body:ok},{job,operation:'run',body:ok},
  {job,operation:'status',body:JSON.stringify({status:'success'})},{job,operation:'result',body:dailyResponse(f.plan,job)}]);
 return {...f,exchanges};
}
test('schedule PG17 repeats only explicit UTC days; restart and duplicate ticks preserve pending and exact published head',{timeout:120000},async t=>{
 const l=await setup(t);assert.equal((await l.current.runner.tick(inputs(l.clock.at))).state,'SIMULATED_SUCCEEDED');
 let v=await l.read();assert.equal(v.pendingUnits,'0.5');assert.equal(v.reservations[0].fakeSends,8);
 const count=await l.count();await l.restart();
 assert.equal((await l.current.runner.tick(inputs(l.clock.at))).state,'DAY_CONSUMED');assert.equal(await l.count(),count);
 l.clock.at='2026-10-24T10:00:00.000000Z';
 assert.equal((await l.current.runner.tick(inputs(l.clock.at))).state,'SIMULATED_SUCCEEDED');
 v=await l.read();assert.equal(v.pendingUnits,'1');assert.equal(v.usages.length,2);
 assert.deepEqual(v.reservations.map(r=>r.state),['SUCCEEDED','SUCCEEDED']);assert.equal(v.providerRequests,0);
 // Persisted time protects a restarted process against virtual clock rollback.
 await l.restart();l.clock.at='2026-10-23T10:00:00.000000Z';
 assert.equal((await l.current.runner.tick(inputs(l.clock.at))).state,'BLOCKED');assert.equal((await l.read()).pendingUnits,'1');
});
test('schedule PG17 missed windows do not backfill; next listed day needs fresh explicit authorization',{timeout:120000},async t=>{
 const l=await setup(t,['2026-10-23','2026-10-25']);
 l.clock.at='2026-10-23T10:15:00.000000Z';assert.equal((await l.current.runner.tick()).state,'MISSED_WINDOW');
 l.clock.at='2026-10-24T10:00:00.000000Z';assert.equal((await l.current.runner.tick()).state,'UNLISTED_DAY');assert.equal(await l.count(),0);
 l.clock.at='2026-10-25T10:00:00.000000Z';
 assert.equal((await l.current.runner.tick(inputs('2026-10-23T10:00:00.000000Z'))).state,'BLOCKED');assert.equal(await l.count(),0);
 assert.equal((await l.current.runner.tick(inputs(l.clock.at))).state,'SIMULATED_SUCCEEDED');
 assert.deepEqual((await l.read()).usages.map(u=>u.day),['2026-10-25']);
});
test('schedule PG17 committed usage ACK loss consumes day; rolled back usage has no durable intent and sends nothing',{timeout:120000},async t=>{
 const l=await setup(t);l.fault.event='USAGE_INTENT';l.fault.phase='ack';
 assert.equal((await l.current.runner.tick(inputs(l.clock.at))).state,'BLOCKED');
 assert.equal(await l.count(),1);await l.restart();
 assert.equal((await l.current.runner.tick(inputs(l.clock.at))).state,'DAY_CONSUMED');
 assert.equal((await l.read()).usages[0].state,'UNKNOWN');assert.equal((await l.read()).reservations.length,0);
 l.clock.at='2026-10-24T10:00:00.000000Z';l.fault.event='USAGE_INTENT';l.fault.phase='rollback';
 assert.equal((await l.current.runner.tick(inputs(l.clock.at))).state,'BLOCKED');assert.equal(await l.count(),1);
 // No automatic retry occurred. An explicit later tick can use a fully rolled-back day.
 assert.equal((await l.current.runner.tick(inputs(l.clock.at))).state,'SIMULATED_SUCCEEDED');
});
test('schedule PG17 fake-send commit ACK loss survives restart as UNKNOWN and blocks later dates without releasing budget',{timeout:120000},async t=>{
 const l=await setup(t);l.fault.event='FAKE_SEND';l.fault.phase='ack';
 assert.equal((await l.current.runner.tick(inputs(l.clock.at))).state,'BLOCKED');
 let v=await l.read();assert.equal(v.reservations[0].state,'UNKNOWN');assert.equal(v.reservations[0].fakeSends,1);
 await assert.rejects(l.current.publisher.inspect(),/OFFLINE_BLOCKED/);
 // The poisoned publisher retains its lock. Do not reclaim it to force a restart.
 await assert.rejects(l.restart(),/OFFLINE_BLOCKED/);
 const other=await l.connection({published:false});
 assert.equal((await other.runner.tick(inputs(l.clock.at))).state,'DAY_CONSUMED');
 const n=await l.count();l.clock.at='2026-10-24T10:00:00.000000Z';
 assert.equal((await other.runner.tick(inputs(l.clock.at))).state,'PRIOR_INCOMPLETE');assert.equal(await l.count(),n);
 v=await l.read();assert.equal(v.pendingUnits,'0.5');assert.equal(v.reservations[0].fakeSends,1);
});
test('schedule PG17 cumulative budget and allocation boundaries never reset pending',{timeout:120000},async t=>{
 const l=await setup(t,['2026-10-30','2026-10-31','2026-11-01']);
 const input=()=>inputs(l.clock.at,a=>{a.periodBudgetUnits='0.75';});
 assert.equal((await l.current.runner.tick(input())).state,'SIMULATED_SUCCEEDED');
 l.clock.at='2026-10-31T10:00:00.000000Z';assert.equal((await l.current.runner.tick(input())).state,'BLOCKED');
 assert.equal((await l.read()).pendingUnits,'0.5');assert.equal((await l.read()).reservations.length,1);
 l.clock.at='2026-11-01T10:00:00.000000Z';assert.equal((await l.current.runner.tick(input())).state,'BLOCKED');
 assert.equal((await l.read()).pendingUnits,'0.5');assert.equal((await l.read()).reservations.length,1);
});
test('schedule PG17 separate connection worker conflict and disconnected session cause zero sends',{timeout:120000},async t=>{
 const l=await setup(t);await l.current.ledger.claimWorker(org);
 // Another connection uses the same fixture but an independent ledger worker token.
 const other=await l.connection({published:false});
 assert.equal((await other.runner.tick(inputs(l.clock.at))).state,'BLOCKED');assert.equal(await l.count(),0);
 await l.current.ledger.releaseWorker(org);await l.current.c.end();
 assert.equal((await l.current.runner.tick(inputs(l.clock.at))).state,'BLOCKED');assert.equal(await l.count(),0);
});
test('schedule PG17 expiry, UTC rollover and worker lock loss after publication forbid fake sends',{timeout:120000},async t=>{
 for(const scenario of ['expiry','rollover','lost-worker']){
  const l=await setup(t),input=inputs(l.clock.at,a=>{a.expiresAt='2026-10-23T10:00:01.000000Z';});
  if(scenario==='lost-worker')l.fault.dropWorkerOnPublish=true;
  else l.fault.advanceOnPublish=scenario==='expiry'?'2026-10-23T10:00:01.000000Z':'2026-10-24T00:00:00.000000Z';
  assert.equal((await l.current.runner.tick(input)).state,'BLOCKED');
  const v=await l.read();assert.equal(v.reservations[0].state,'UNKNOWN');
  assert.equal(v.reservations[0].fakeSends,0);assert.equal(v.pendingUnits,'0.5');
  await assert.rejects(l.current.publisher.inspect(),/OFFLINE_BLOCKED/);
 }
});
