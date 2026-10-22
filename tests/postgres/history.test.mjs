import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture} from './fixture.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {initialize,partition,grantAccess,verifySchema,structureHash} from '../../tools/market-db/schema.mjs';
import {initializeHistory,upgradeHistory,importHistory,grantHistoryReader} from '../../tools/market-db/history.mjs';
import {importSources} from '../../tools/market-db/repository.mjs';
import {importPlan,canonical,digest} from '../../tools/market-db/plan.mjs';
import {databaseMarket} from '../../tools/market-db/preview.mjs';
import {historyProjection} from '../../tools/supply-history-source.mjs';
const registry=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url)));
const snapshot=(coin='rlusd',amount='1448674399.0854678')=>historyProjection(Buffer.from(JSON.stringify({id:coin==='rlusd'?'250':'2',symbol:coin==='rlusd'?'RLUSD':'USDC',gecko_id:coin==='rlusd'?'ripple-usd':'usd-coin',pegType:'peggedUSD',chainBalances:{Ethereum:{tokens:[{date:'1792627200',circulating:{peggedUSD:amount}}]}}})),coin,registry,'2026-10-22T05:00:00.000Z');
test('history PG17: isolated immutable snapshots, reader RLS, source/period idempotency, rollback/concurrency and read-only snapshot consistency',{timeout:120000},async()=>{
 const f=await fixture(),directory=await mkdtemp(join(tmpdir(),'atlas-history-'));let reader,writer,second;
 try{
  await initialize(f.admin);await partition(f.admin,'2026-10');
  const readerUrl=await f.createUser('atlas_test_historyreader'),writerUrl=await f.createUser('atlas_test_historywriter');await grantAccess(f.admin,'atlas_test_historyreader','reader');await grantAccess(f.admin,'atlas_test_historywriter','writer');reader=await connectDatabase({DATABASE_URL:readerUrl});writer=await connectDatabase({DATABASE_URL:writerUrl});
  await importSources(writer,{registry,sources:[importPlan(registry,Buffer.from(JSON.stringify({requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-22T00:00:00.000Z',data:{price:'1'}}]})))],archiveDirectory:join(directory,'core')});
  const read=()=>databaseMarket(reader,registry,{now:Date.parse('2026-10-22T06:00:00.000Z')});assert.deepEqual((await read()).supplyHistory,[]);
  const fingerprint=(await f.admin.query("SELECT encode(structure_hash,'hex') AS hash FROM atlas_market.schema_version")).rows[0].hash;
  assert.equal((await initializeHistory(f.admin)).state,'INITIALIZED');assert.equal((await initializeHistory(f.admin)).state,'UNCHANGED');await verifySchema(f.admin);
  await assert.rejects(read());await assert.rejects(initializeHistory(writer),/DATABASE_OWNER_REQUIRED/);await assert.rejects(importHistory(writer,registry,[snapshot()]),/DATABASE_OWNER_REQUIRED/);await assert.rejects(grantHistoryReader(f.admin,'atlas_test_historywriter'),/HISTORY_READER_REQUIRED/);
  assert.equal((await grantHistoryReader(f.admin,'atlas_test_historyreader')).state,'GRANTED');assert.equal((await grantHistoryReader(f.admin,'atlas_test_historyreader')).state,'UNCHANGED');
  const p=snapshot();assert.equal((await importHistory(f.admin,registry,[p])).inserted,1);assert.equal((await importHistory(f.admin,registry,[{...p,fetchedAt:'2026-10-22T05:01:00.000Z'}])).unchanged,1);assert.deepEqual((await read()).supplyHistory,[p]);
  for(const sql of ["UPDATE atlas_history.snapshot SET projection='{}'",'DELETE FROM atlas_history.snapshot','TRUNCATE atlas_history.snapshot','SELECT atlas_history.reject_mutation()'])await assert.rejects(reader.query(sql),e=>e.code==='42501');await assert.rejects(f.admin.query('DELETE FROM atlas_history.snapshot'),e=>e.code==='23514');
  const conflict=structuredClone(p);conflict.networks[0].points[0].amount='5';await assert.rejects(importHistory(f.admin,registry,[snapshot('usdc'),conflict]),/HISTORY_CONTENT_CONFLICT/);assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM atlas_history.snapshot')).rows[0].n,1);
  second=await connectDatabase({DATABASE_URL:f.url('postgres')});const newer={...snapshot('rlusd','1500000000'),fetchedAt:'2026-10-22T05:10:00.000Z'};const imports=await Promise.all([importHistory(f.admin,registry,[newer]),importHistory(second,registry,[newer])]);assert.equal(imports.reduce((n,r)=>n+r.inserted,0),1);assert.deepEqual((await read()).supplyHistory,[newer]);
  await f.admin.query('GRANT UPDATE(projection) ON atlas_history.snapshot TO atlas_test_historyreader');await assert.rejects(read(),/HISTORY_PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE UPDATE(projection) ON atlas_history.snapshot FROM atlas_test_historyreader');
  await f.admin.query('GRANT EXECUTE ON FUNCTION atlas_history.reject_mutation() TO PUBLIC');await assert.rejects(read(),/HISTORY_/);await f.admin.query('REVOKE ALL ON FUNCTION atlas_history.reject_mutation() FROM PUBLIC');
  await f.admin.query('ALTER TABLE atlas_history.snapshot DISABLE TRIGGER immutable_record');await assert.rejects(read(),/HISTORY_SCHEMA_MISMATCH/);await f.admin.query('ALTER TABLE atlas_history.snapshot ENABLE TRIGGER immutable_record');
  const query=reader.query.bind(reader);let changed=false;const latest={...snapshot('rlusd','1600000000'),fetchedAt:'2026-10-22T05:20:00.000Z'};reader.query=async(...args)=>{if(typeof args[0]==='string'&&args[0].includes('SELECT DISTINCT ON (s.coin_id')&&!changed){changed=true;await importHistory(f.admin,registry,[latest]);}return query(...args);};assert.deepEqual((await read()).supplyHistory,[newer]);reader.query=query;assert.deepEqual((await read()).supplyHistory,[latest]);
  assert.equal((await f.admin.query("SELECT encode(structure_hash,'hex') AS hash FROM atlas_market.schema_version")).rows[0].hash,fingerprint);await verifySchema(f.admin);
 }finally{await reader?.end();await writer?.end();await second?.end();await f.stop();await rm(directory,{recursive:true,force:true});}
});

test('history v1 upgrade preserves existing immutable circulating payloads and enables distinct minted snapshots atomically',{timeout:120000},async()=>{
 const f=await fixture(),directory=await mkdtemp(join(tmpdir(),'atlas-history-upgrade-'));let reader,writer,second;
 try{
  await initialize(f.admin);await partition(f.admin,'2026-10');
  const readerUrl=await f.createUser('atlas_test_upgradereader'),writerUrl=await f.createUser('atlas_test_upgradewriter');await grantAccess(f.admin,'atlas_test_upgradereader','reader');await grantAccess(f.admin,'atlas_test_upgradewriter','writer');reader=await connectDatabase({DATABASE_URL:readerUrl});writer=await connectDatabase({DATABASE_URL:writerUrl});
  await importSources(writer,{registry,sources:[importPlan(registry,Buffer.from(JSON.stringify({requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-22T00:00:00.000Z',data:{price:'1'}}]})))],archiveDirectory:join(directory,'core')});
  const sql=await readFile(new URL('../../db/history/001-initial.sql',import.meta.url));await f.admin.query(sql.toString());for(const table of ['schema_version','reader_grant','snapshot'])await f.admin.query('CREATE POLICY installer ON atlas_history.'+table+' TO postgres USING(true) WITH CHECK(true)');
  await f.admin.query('INSERT INTO atlas_history.schema_version VALUES(1,$1,$2)',[Buffer.from(digest(sql),'hex'),Buffer.from(await structureHash(f.admin,'atlas_history'),'hex')]);
  const p=snapshot(),coin=(await f.admin.query("SELECT id FROM atlas_market.coin WHERE code='rlusd'")).rows[0].id;
  await f.admin.query('INSERT INTO atlas_history.snapshot VALUES($1,$2,$3,$4,$5,$6)',[coin,Buffer.from(p.sourceHash,'hex'),p.to,p.fetchedAt,JSON.stringify(p),Buffer.from(digest(canonical(p)),'hex')]);await grantHistoryReader(f.admin,'atlas_test_upgradereader');
  const read=()=>databaseMarket(reader,registry,{now:Date.parse('2026-10-22T06:00:00.000Z')});assert.deepEqual((await read()).supplyHistory,[p]);await assert.rejects(importHistory(f.admin,registry,[p]),/HISTORY_UPGRADE_REQUIRED/);
  second=await connectDatabase({DATABASE_URL:f.url('postgres')});const upgrades=await Promise.all([upgradeHistory(f.admin),upgradeHistory(second)]);assert.equal(upgrades.filter(r=>r.state==='UPGRADED').length,1);assert.deepEqual((await read()).supplyHistory,[p]);
  const minted={...structuredClone(p),metric:'NETWORK_MINTED'};minted.networks[0].points[0].amount='2000000000';assert.equal((await importHistory(f.admin,registry,[p,minted])).inserted,1);assert.deepEqual((await read()).supplyHistory,[p,minted]);assert.equal((await importHistory(f.admin,registry,[p,minted])).unchanged,2);await verifySchema(f.admin);
 }finally{await reader?.end();await writer?.end();await second?.end();await f.stop();await rm(directory,{recursive:true,force:true});}
});
