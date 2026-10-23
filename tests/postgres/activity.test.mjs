import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';import {initialize,grantAccess} from '../../tools/market-db/schema.mjs';
import {initializeActivity,grantActivity,importActivity,readActivity} from '../../tools/market-db/activity.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';import {activityFixture} from '../activity-fixture.mjs';
test('activity PG17: safe roles, idempotent/concurrent imports, revisions, old-time imports, conflict rollback and schema tamper',{timeout:120000},async()=>{
 const f=await fixture();let writer,writer2,reader;try{
  await initialize(f.admin);await initializeActivity(f.admin);assert.equal((await initializeActivity(f.admin)).state,'UNCHANGED');
  const wu=await f.createUser('atlas_test_activitywriter'),ru=await f.createUser('atlas_test_activityreader');await grantAccess(f.admin,'atlas_test_activitywriter','writer');await grantAccess(f.admin,'atlas_test_activityreader','reader');await grantActivity(f.admin,'atlas_test_activitywriter','writer');await grantActivity(f.admin,'atlas_test_activityreader','reader');
  writer=await connectDatabase({DATABASE_URL:wu});writer2=await connectDatabase({DATABASE_URL:wu});reader=await connectDatabase({DATABASE_URL:ru});assert.equal((await readActivity(reader)).state,'MISSING');
  const a=activityFixture();assert.equal((await importActivity(writer,a.bytes,a.options)).rows,1);assert.equal((await importActivity(writer,a.bytes,a.options)).rows,0);assert.equal((await readActivity(reader)).series[0].points[0].volume,'1000.000000000000000001');
  const b=activityFixture({queriedAt:'2026-10-23T01:00:00.000000Z',amount:'2000'});const results=await Promise.all([importActivity(writer,b.bytes,b.options),importActivity(writer2,b.bytes,b.options)]);assert.deepEqual(results.map(r=>r.rows).sort(),[0,1]);
  const old=activityFixture({queriedAt:'2026-10-22T23:00:00.000000Z',amount:'500'});await importActivity(writer,old.bytes,{...old.options,to:'2026-10-21'});assert.equal((await readActivity(reader)).series[0].points[0].volume,'2000');
  const collision=activityFixture({queriedAt:'2026-10-23T01:00:00.000000Z',amount:'3000'});await assert.rejects(importActivity(writer,collision.bytes,collision.options),/TIMESTAMP_CONFLICT/);assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM atlas_activity.source')).rows[0].n,3);
  await assert.rejects(importActivity(reader,a.bytes,a.options));await assert.rejects(importActivity(f.admin,a.bytes,a.options));await assert.rejects(reader.query('DELETE FROM atlas_activity.daily_value'));await assert.rejects(writer.query("UPDATE atlas_activity.source SET mapper='bad'"));await assert.rejects(writer.query("INSERT INTO atlas_activity.access_grant VALUES('intruder','writer')"));
  await f.admin.query('ALTER TABLE atlas_activity.daily_value DISABLE TRIGGER immutable_record');await assert.rejects(readActivity(reader));await f.admin.query('ALTER TABLE atlas_activity.daily_value ENABLE TRIGGER immutable_record');assert.equal((await readActivity(reader)).series[0].points[0].volume,'2000');
  const rollback=activityFixture({queriedAt:'2026-10-23T02:00:00.000000Z',amount:'4000'});let insertedSourceSeen=false;
  const fault={query:async(...args)=>{if(typeof args[0]==='string'&&args[0].startsWith('INSERT INTO atlas_activity.daily_value')){insertedSourceSeen=(await writer.query('SELECT count(*)::int AS n FROM atlas_activity.source')).rows[0].n===4;throw Error('INJECTED_FACT_FAILURE');}return writer.query(...args);}};
  await assert.rejects(importActivity(fault,rollback.bytes,rollback.options),/INJECTED_FACT_FAILURE/);assert(insertedSourceSeen);assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM atlas_activity.source')).rows[0].n,3);
 }finally{await Promise.all([writer,writer2,reader].filter(Boolean).map(c=>c.end()));await f.stop();}
});
