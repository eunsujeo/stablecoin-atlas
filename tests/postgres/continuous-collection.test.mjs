import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture} from './fixture.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {initialize,partition,grantAccess,verifySchema} from '../../tools/market-db/schema.mjs';
import {initializeHistory,normalizeHistory,grantHistoryReader,grantHistoryWriter,enableContinuousHistory,verifyHistoryWriter} from '../../tools/market-db/history.mjs';
import {claimScheduled,finishScheduled,acquireWorker,releaseWorker} from '../../tools/market-db/scheduler.mjs';
import {importPlan} from '../../tools/market-db/plan.mjs';
import {importSources} from '../../tools/market-db/repository.mjs';
import {databaseMarket} from '../../tools/market-db/preview.mjs';
const registry=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url)));

test('continuous schedule migration preserves used slots, immutable guards and least privilege; rolls back atomically and serializes owners',{timeout:120000},async()=>{
 const f=await fixture(),directory=await mkdtemp(join(tmpdir(),'atlas-continuous-'));let writer,reader,second;
 try{
  await initialize(f.admin);await partition(f.admin,'2026-10');await initializeHistory(f.admin);await normalizeHistory(f.admin,registry);
  const writerUrl=await f.createUser('atlas_test_continuouswriter'),readerUrl=await f.createUser('atlas_test_continuousreader');
  await grantAccess(f.admin,'atlas_test_continuouswriter','writer');await grantAccess(f.admin,'atlas_test_continuousreader','reader');await grantHistoryWriter(f.admin,'atlas_test_continuouswriter');await grantHistoryReader(f.admin,'atlas_test_continuousreader');
  writer=await connectDatabase({DATABASE_URL:writerUrl});reader=await connectDatabase({DATABASE_URL:readerUrl});second=await connectDatabase({DATABASE_URL:f.url('postgres')});
  await importSources(writer,{registry,sources:[importPlan(registry,Buffer.from(JSON.stringify({requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-22T00:00:00.000Z',data:{price:'1'}}]})))],archiveDirectory:directory});
  const core=async()=>(await f.admin.query("SELECT (SELECT count(*)::int FROM atlas_market.observation) AS count,encode(structure_hash,'hex') AS hash FROM atlas_market.schema_version")).rows[0],originalCore=await core();
  const reservation=await claimScheduled(writer,'ARKHAM',12);assert.equal(reservation.state,'CLAIMED');await finishScheduled(writer,reservation.job,reservation.slot,'STORED');
  await f.admin.query("INSERT INTO atlas_history.scheduler_day VALUES('ARKHAM',$1::date-1,12),('DEFILLAMA',$1::date,1)",[reservation.slot.slice(0,10)]);
  const runs=async()=>(await f.admin.query('SELECT * FROM atlas_history.scheduler_run ORDER BY job,slot')).rows;
  const before=await runs(),version=async()=>(await f.admin.query('SELECT max(version)::int AS n FROM atlas_history.schema_version')).rows[0].n;
  const budget=async()=>(await f.admin.query("SELECT budget FROM atlas_history.scheduler_day WHERE job='ARKHAM' AND day=$1::date",[reservation.slot.slice(0,10)])).rows[0].budget;
  await assert.rejects(enableContinuousHistory(writer),/DATABASE_OWNER_REQUIRED/);
  await acquireWorker(writer);await assert.rejects(enableContinuousHistory(f.admin),/SCHEDULER_LOCKED/);await releaseWorker(writer);assert.equal(await version(),3);
  const failing={query:async(text,...args)=>{const result=await f.admin.query(text,...args);if(typeof text==='string'&&text.includes('DROP TRIGGER immutable_record ON atlas_history.scheduler_day'))throw Error('SIMULATED_AFTER_UPDATE_FAILURE');return result;}};
  await assert.rejects(enableContinuousHistory(failing),/SIMULATED_AFTER_UPDATE_FAILURE/);assert.equal(await version(),3);assert.equal(await budget(),12);assert.deepEqual(await runs(),before);
  await assert.rejects(f.admin.query("UPDATE atlas_history.scheduler_day SET budget=288 WHERE job='ARKHAM'"),e=>e.code==='23514');
  const results=await Promise.all([enableContinuousHistory(f.admin),enableContinuousHistory(second)]);assert.deepEqual(results.map(r=>r.state).sort(),['UNCHANGED','UPGRADED']);assert.equal(await version(),4);assert.equal(await budget(),288);assert.deepEqual(await runs(),before);
  assert.equal((await f.admin.query("SELECT budget FROM atlas_history.scheduler_day WHERE job='ARKHAM' AND day=$1::date-1",[reservation.slot.slice(0,10)])).rows[0].budget,12);
  assert.equal((await f.admin.query("SELECT budget FROM atlas_history.scheduler_day WHERE job='DEFILLAMA'")).rows[0].budget,1);
  const resumed=await claimScheduled(writer,'ARKHAM',288);assert.equal(resumed.used,resumed.slot===reservation.slot?1:2);await assert.rejects(claimScheduled(writer,'ARKHAM',12),/SCHEDULER_BUDGET_MISMATCH/);
  await assert.rejects(writer.query('UPDATE atlas_history.scheduler_day SET budget=12'),e=>e.code==='42501');await assert.rejects(f.admin.query('DELETE FROM atlas_history.scheduler_day'),e=>e.code==='23514');await verifyHistoryWriter(writer);await verifySchema(f.admin);
  assert.deepEqual(await core(),originalCore);assert.deepEqual((await databaseMarket(reader,registry)).supplyHistory,[]);assert.equal((await normalizeHistory(f.admin,registry)).version,4);
 }finally{await writer?.end();await reader?.end();await second?.end();await f.stop();await rm(directory,{recursive:true,force:true});}
});

test('continuous migration rejects an unexpected existing budget without changing schema, guard or data',{timeout:120000},async()=>{
 const f=await fixture();try{
  await initialize(f.admin);await initializeHistory(f.admin);await normalizeHistory(f.admin,registry);
  await f.admin.query("INSERT INTO atlas_history.scheduler_day VALUES('ARKHAM',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,1)");
  await assert.rejects(enableContinuousHistory(f.admin),/SCHEDULER_BUDGET_MISMATCH/);
  assert.equal((await f.admin.query('SELECT max(version)::int AS n FROM atlas_history.schema_version')).rows[0].n,3);assert.equal((await f.admin.query('SELECT budget FROM atlas_history.scheduler_day')).rows[0].budget,1);
  await assert.rejects(f.admin.query('UPDATE atlas_history.scheduler_day SET budget=288'),e=>e.code==='23514');await verifySchema(f.admin);
 }finally{await f.stop();}
});
