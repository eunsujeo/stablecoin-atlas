import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {fixture} from './fixture.mjs';import {initialize,grantAccess,structureHash} from '../../tools/market-db/schema.mjs';
import {initializeSupply,grantSupply,importSupply,readSupply,verifySupplySchema} from '../../tools/market-db/allium-supply.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';import {supplyFixture} from '../allium-supply-fixture.mjs';

test('Allium supply PG17: isolated schema, least privilege, raw archive, replay/concurrency, revisions, null, old imports and atomic rollback',{timeout:120000},async()=>{
 const f=await fixture(),archive=await mkdtemp(join(tmpdir(),'allium-supply-'));let writer,second,reader;
 try{
  await initialize(f.admin);const originalStructure=await structureHash(f.admin,'atlas_market');await initializeSupply(f.admin);assert.equal((await initializeSupply(f.admin)).state,'UNCHANGED');assert.equal(await structureHash(f.admin,'atlas_market'),originalStructure);
  const wu=await f.createUser('atlas_test_supplywriter'),ru=await f.createUser('atlas_test_supplyreader');
  await grantAccess(f.admin,'atlas_test_supplywriter','writer');await grantAccess(f.admin,'atlas_test_supplyreader','reader');
  await grantSupply(f.admin,'atlas_test_supplywriter','writer');await grantSupply(f.admin,'atlas_test_supplyreader','reader');assert.equal((await grantSupply(f.admin,'atlas_test_supplyreader','reader')).state,'UNCHANGED');
  await assert.rejects(grantSupply(f.admin,'atlas_test_supplyreader','writer'));
  writer=await connectDatabase({DATABASE_URL:wu});second=await connectDatabase({DATABASE_URL:wu});reader=await connectDatabase({DATABASE_URL:ru});
  const range={from:'2026-10-16',to:'2026-10-22'},read=()=>readSupply(reader,range),source=()=>f.admin.query('SELECT count(*)::int AS n FROM atlas_supply.source');
  assert.equal((await read()).state,'MISSING');const a=supplyFixture(),opts={...a.options,archiveRoot:archive};
  assert.equal((await importSupply(writer,a.bytes,opts)).rows,14);assert.equal((await importSupply(writer,a.bytes,opts)).rows,0);
  let out=await read();assert.equal(out.series.length,2);assert.equal(out.series[0].points.length,7);assert.equal(out.series[0].points[0].totalSupply,'1000.000000000000000001');assert.equal(out.usdAvailability,'NOT_REQUESTED');assert.equal(out.aggregateTimezone,'UNKNOWN');
  const raw=join(archive,a.options.expectedHash.slice(0,2),a.options.expectedHash+'.json');assert.deepEqual(await readFile(raw),a.bytes);assert.equal((await stat(raw)).mode&0o777,0o600);
  await rm(raw);assert.equal((await importSupply(writer,a.bytes,opts)).rows,0);assert.deepEqual(await readFile(raw),a.bytes);
  const b=supplyFixture({queriedAt:'2026-10-23T04:00:00.000000Z',amount:'2000',mutate:p=>p.data[0].circulating_supply_str=null});
  const parallel=await Promise.all([importSupply(writer,b.bytes,{...b.options,archiveRoot:archive}),importSupply(second,b.bytes,{...b.options,archiveRoot:archive})]);assert.deepEqual(parallel.map(r=>r.rows).sort((a,b)=>a-b),[0,14]);
  out=await read();assert.equal(out.series[0].points[0].totalSupply,'2000');assert.equal(out.series[0].points[0].circulatingSupply,null);
  const older=supplyFixture({queriedAt:'2026-10-23T01:00:00.000000Z',amount:'500'});await importSupply(writer,older.bytes,{...older.options,archiveRoot:archive});assert.equal((await read()).series[0].points[0].totalSupply,'2000');
  const collision=supplyFixture({queriedAt:'2026-10-23T04:00:00.000000Z',amount:'3000'});await assert.rejects(importSupply(writer,collision.bytes,{...collision.options,archiveRoot:archive}),/TIMESTAMP_CONFLICT/);assert.equal((await source()).rows[0].n,3);
  assert.deepEqual((await readSupply(reader,{coinId:'usdc',from:'2026-10-17',to:'2026-10-17'})).series[0].points.map(p=>p.day),['2026-10-17']);assert.equal((await readSupply(reader,{from:'2026-10-23',to:'2026-10-23'})).state,'MISSING');
  await assert.rejects(importSupply(reader,a.bytes,opts));await assert.rejects(importSupply(f.admin,a.bytes,opts));await assert.rejects(importSupply(writer,a.bytes,a.options));
  for(const query of ['DELETE FROM atlas_supply.daily_value',"UPDATE atlas_supply.source SET mapper='bad'",'TRUNCATE atlas_supply.daily_value',"INSERT INTO atlas_supply.access_grant VALUES('intruder','writer')",'SELECT atlas_supply.reject_mutation()'])await assert.rejects(writer.query(query));
  const rollback=supplyFixture({queriedAt:'2026-10-23T05:00:00.000000Z',amount:'4000'});let seen=false;
  const fault={query:async(...args)=>{if(typeof args[0]==='string'&&args[0].startsWith('INSERT INTO atlas_supply.daily_value')){seen=(await writer.query('SELECT count(*)::int AS n FROM atlas_supply.source')).rows[0].n===4;throw Error('INJECTED_FACT_FAILURE');}return writer.query(...args);}};
  await assert.rejects(importSupply(fault,rollback.bytes,{...rollback.options,archiveRoot:archive}),/INJECTED_FACT_FAILURE/);assert(seen);assert.equal((await source()).rows[0].n,3);
  assert.deepEqual(await readFile(join(archive,rollback.options.expectedHash.slice(0,2),rollback.options.expectedHash+'.json')),rollback.bytes);
  assert.equal((await importSupply(writer,rollback.bytes,{...rollback.options,archiveRoot:archive})).rows,14);assert.equal((await read()).series[0].points[0].totalSupply,'4000');
  await f.admin.query('ALTER TABLE atlas_supply.daily_value DISABLE TRIGGER immutable_record');await assert.rejects(read());await f.admin.query('ALTER TABLE atlas_supply.daily_value ENABLE TRIGGER immutable_record');
  await f.admin.query('GRANT UPDATE(payload) ON atlas_supply.daily_value TO atlas_test_supplywriter');await assert.rejects(read());await f.admin.query('REVOKE UPDATE(payload) ON atlas_supply.daily_value FROM atlas_test_supplywriter');
  await f.admin.query('GRANT USAGE ON SCHEMA atlas_supply TO PUBLIC');await assert.rejects(read());await f.admin.query('REVOKE USAGE ON SCHEMA atlas_supply FROM PUBLIC');await verifySupplySchema(f.admin);
  assert(!JSON.stringify(await read()).includes('private'));assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM atlas_supply.daily_value')).rows[0].n,56);
 }finally{await Promise.all([writer,second,reader].filter(Boolean).map(c=>c.end()));await f.stop();await rm(archive,{recursive:true,force:true});}
});
