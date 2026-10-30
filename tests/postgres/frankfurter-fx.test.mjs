import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {initialize,grantAccess,structureHash} from '../../tools/market-db/schema.mjs';
import {connectDatabase,transaction} from '../../tools/market-db/connection.mjs';
import {initializeFrankfurterFX,grantFrankfurterFX,importFrankfurterFX,readFrankfurterFXSnapshot,verifyFrankfurterFXSchema} from '../../tools/market-db/frankfurter-fx.mjs';
import {verifySupplyApiBoundary} from '../../tools/market-db/supply-api-boundary.mjs';
import {verifyProductionReader} from '../../tools/production-database.mjs';
import {parseFrankfurterFX} from '../../tools/frankfurter-fx-store.mjs';
import {databaseFrankfurterFXReader} from '../../tools/market-db/frankfurter-fx-preview.mjs';
import {startPreviewServer} from '../../tools/ui-preview.mjs';
import {startProduction} from '../../tools/production-web.mjs';
import {request} from 'node:http';
const at='2026-10-23T01:46:21.297Z',now=Date.parse(at);
function input(date='2026-10-22',observed=at,usd='1.234567890123456789'){
 const raw=Buffer.from(`{"date":"${date}","base":"USD","quote":"KRW","rate":${usd}}`);
 return {raw,payload:parseFrankfurterFX(raw,{at:observed})};
}
const get=(server,headers={})=>new Promise((resolve,reject)=>{const r=request({host:'127.0.0.1',port:server.address().port,path:'/fx-data.json',headers},res=>{let body='';res.on('data',b=>body+=b);res.on('end',()=>resolve({status:res.statusCode,body}));});r.on('error',reject);r.end();});
test('Frankfurter PG17 preserves raw/decimal/time, serializes immutable imports and denies unsafe access and corruption',{timeout:120000},async()=>{
 const f=await fixture();let writer,reader,second,local,production;const one=input();
 try{
  await initialize(f.admin);const before=await structureHash(f.admin);
  await f.admin.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE authenticator NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS');
  await initializeFrankfurterFX(f.admin);assert.equal((await initializeFrankfurterFX(f.admin)).state,'UNCHANGED');
  const wu=await f.createUser('atlas_test_fxwriter'),ru=await f.createUser('atlas_test_fxreader');
  await grantAccess(f.admin,'atlas_test_fxwriter','writer');await grantAccess(f.admin,'atlas_test_fxreader','reader');
  await grantFrankfurterFX(f.admin,'atlas_test_fxwriter','writer');await grantFrankfurterFX(f.admin,'atlas_test_fxreader','reader');
  writer=await connectDatabase({DATABASE_URL:wu});second=await connectDatabase({DATABASE_URL:wu});reader=await connectDatabase({DATABASE_URL:ru});
  await assert.rejects(readFrankfurterFXSnapshot(reader,{now}),/NOT_AVAILABLE/);
  const both=await Promise.all([writer,second].map(c=>importFrankfurterFX(c,one.payload,one.raw)));assert.deepEqual(both.map(r=>r.inserted).sort(),[0,1]);
  assert.equal((await importFrankfurterFX(writer,one.payload,one.raw)).inserted,0);assert.deepEqual(await readFrankfurterFXSnapshot(reader,{now}),one.payload);
  const conflict=input('2026-10-22',at,'9');await assert.rejects(importFrankfurterFX(writer,conflict.payload,conflict.raw),/ID_CONFLICT/);
  await assert.rejects(importFrankfurterFX(writer,{...one.payload,krwPerUSD:'1'},one.raw));
  await assert.rejects(importFrankfurterFX(writer,one.payload,Buffer.from('bad')));
  const later=input('2026-10-23','2026-10-24T01:00:00.000Z');
  const faulty={query:async(...args)=>{const r=await writer.query(...args);if(args[0].startsWith('INSERT INTO atlas_fx_frankfurter.snapshot'))throw Error('INJECT_AFTER_INSERT');return r;}};
  await assert.rejects(importFrankfurterFX(faulty,later.payload,later.raw),/INJECT_AFTER_INSERT/);assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM atlas_fx_frankfurter.snapshot')).rows[0].n,1);
  await importFrankfurterFX(writer,later.payload,later.raw);
  await assert.rejects(readFrankfurterFXSnapshot(reader,{now}),/FUTURE/);
  const backfill=input('2026-10-21','2026-10-25T01:00:00.000Z');await importFrankfurterFX(writer,backfill.payload,backfill.raw);
  const current=Date.parse('2026-10-25T01:00:00.000Z');assert.deepEqual(await readFrankfurterFXSnapshot(reader,{now:current}),later.payload);
  const expired=Date.parse('2026-11-01T00:00:00.000Z');await assert.rejects(readFrankfurterFXSnapshot(reader,{now:expired}),/EXPIRED/);assert.deepEqual(await readFrankfurterFXSnapshot(reader,{now:expired,allowExpired:true}),later.payload);
  await assert.rejects(importFrankfurterFX(reader,one.payload,one.raw));await assert.rejects(importFrankfurterFX(f.admin,one.payload,one.raw));await assert.rejects(readFrankfurterFXSnapshot(writer,{now}));
  for(const sql of ['DELETE FROM atlas_fx_frankfurter.snapshot','TRUNCATE atlas_fx_frankfurter.snapshot',"UPDATE atlas_fx_frankfurter.snapshot SET payload='{}'",'SELECT atlas_fx_frankfurter.reject_mutation()',"INSERT INTO atlas_fx_frankfurter.access_grant VALUES('intruder','writer')"])await assert.rejects(writer.query(sql));
  for(const sql of ['CREATE TABLE atlas_fx_frankfurter.bad(id int)','INSERT INTO atlas_fx_frankfurter.snapshot SELECT * FROM atlas_fx_frankfurter.snapshot'])await assert.rejects(reader.query(sql));
  const boundary=()=>transaction(f.admin,()=>verifySupplyApiBoundary(f.admin,{schema:'atlas_fx_frankfurter'}),{repeatableRead:true});await boundary();
  await f.admin.query('GRANT SELECT(payload) ON atlas_fx_frankfurter.snapshot TO anon');await assert.rejects(boundary());await assert.rejects(readFrankfurterFXSnapshot(reader,{now:current}));await f.admin.query('REVOKE SELECT(payload) ON atlas_fx_frankfurter.snapshot FROM anon');
  await f.admin.query('GRANT atlas_test_fxwriter TO authenticator WITH INHERIT FALSE');await assert.rejects(boundary());await f.admin.query('REVOKE atlas_test_fxwriter FROM authenticator');
  await f.admin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA atlas_fx_frankfurter GRANT SELECT ON TABLES TO PUBLIC');await assert.rejects(boundary());await f.admin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA atlas_fx_frankfurter REVOKE SELECT ON TABLES FROM PUBLIC');
  await f.admin.query('ALTER TABLE atlas_fx_frankfurter.snapshot DISABLE TRIGGER immutable_record');await assert.rejects(readFrankfurterFXSnapshot(reader,{now:current}));await f.admin.query('ALTER TABLE atlas_fx_frankfurter.snapshot ENABLE TRIGGER immutable_record');
  await f.admin.query('GRANT UPDATE(payload) ON atlas_fx_frankfurter.snapshot TO atlas_test_fxreader');await assert.rejects(readFrankfurterFXSnapshot(reader,{now:current}));await f.admin.query('REVOKE UPDATE(payload) ON atlas_fx_frankfurter.snapshot FROM atlas_test_fxreader');
  await verifyProductionReader(reader);
  const connect=()=>connectDatabase({DATABASE_URL:ru}),fxReader=databaseFrankfurterFXReader({connect,now:()=>current});
  local=await startPreviewServer(0,{fxDirectory:'/does-not-exist',fxReader});
  production=await startProduction({config:{port:0,hosts:['atlas.example.com']},env:{},commit:'a'.repeat(40)},{connector:{connect,close:async()=>{}},fxReader});
  for(const [s,h]of [[local,{}],[production.server,{host:'atlas.example.com'}]]){const r=await get(s,h);assert.equal(r.status,200);assert.deepEqual(JSON.parse(r.body),later.payload);assert(!r.body.includes('raw_json'));}
  const expiredReader=databaseFrankfurterFXReader({connect,now:()=>expired});await assert.rejects(expiredReader(),/^Error: FX_UNAVAILABLE$/);
  await f.admin.query('ALTER TABLE atlas_fx_frankfurter.snapshot DISABLE TRIGGER immutable_record');await f.admin.query("UPDATE atlas_fx_frankfurter.snapshot SET raw_json=convert_to('corrupt','UTF8') WHERE rate_date='2026-10-23'");await f.admin.query('ALTER TABLE atlas_fx_frankfurter.snapshot ENABLE TRIGGER immutable_record');await assert.rejects(readFrankfurterFXSnapshot(reader,{now:current}));
  assert.equal((await get(local)).status,503);await verifyFrankfurterFXSchema(f.admin);assert.equal(await structureHash(f.admin),before);
 }finally{await production?.stop();if(local){local.closeAllConnections();await new Promise(r=>local.close(r));}await Promise.all([writer,reader,second].filter(Boolean).map(c=>c.end()));await f.stop();}
});
