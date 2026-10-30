import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {initialize,grantAccess,structureHash} from '../../tools/market-db/schema.mjs';
import {connectDatabase,transaction} from '../../tools/market-db/connection.mjs';
import {initializeFX,grantFX,importFX,readFXSnapshot,verifyFXSchema} from '../../tools/market-db/fx.mjs';
import {verifySupplyApiBoundary} from '../../tools/market-db/supply-api-boundary.mjs';
import {verifyProductionReader} from '../../tools/production-database.mjs';
import {parseFX} from '../../tools/fx-store.mjs';
import {databaseFXReader} from '../../tools/market-db/fx-preview.mjs';
import {startPreviewServer} from '../../tools/ui-preview.mjs';
import {startProduction} from '../../tools/production-web.mjs';
import {request} from 'node:http';
const at='2026-10-23T01:46:21.297Z',now=Date.parse(at);
function input(date='2026-10-22',observed=at,usd='1.234567890123456789'){
 const raw=Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><gesmes:subject>Reference rates</gesmes:subject><gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender><Cube><Cube time='${date}'><Cube currency='USD' rate='${usd}'/><Cube currency='KRW' rate='1500.123456789123456789'/></Cube></Cube></gesmes:Envelope>`);
 return {raw,payload:parseFX(raw,{at:observed,imported:true})};
}
const get=(server,headers={})=>new Promise((resolve,reject)=>{const r=request({host:'127.0.0.1',port:server.address().port,path:'/fx-data.json',headers},res=>{let body='';res.on('data',b=>body+=b);res.on('end',()=>resolve({status:res.statusCode,body}));});r.on('error',reject);r.end();});
test('FX PG17 preserves raw/decimal/time, serializes immutable imports and denies unsafe access and corruption',{timeout:120000},async()=>{
 const f=await fixture();let writer,reader,second,local,production;const one=input();
 try{
  await initialize(f.admin);const before=await structureHash(f.admin);
  await f.admin.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE authenticator NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS');
  await initializeFX(f.admin);assert.equal((await initializeFX(f.admin)).state,'UNCHANGED');
  const wu=await f.createUser('atlas_test_fxwriter'),ru=await f.createUser('atlas_test_fxreader');
  await grantAccess(f.admin,'atlas_test_fxwriter','writer');await grantAccess(f.admin,'atlas_test_fxreader','reader');
  await grantFX(f.admin,'atlas_test_fxwriter','writer');await grantFX(f.admin,'atlas_test_fxreader','reader');
  writer=await connectDatabase({DATABASE_URL:wu});second=await connectDatabase({DATABASE_URL:wu});reader=await connectDatabase({DATABASE_URL:ru});
  await assert.rejects(readFXSnapshot(reader,{now}),/NOT_AVAILABLE/);
  const both=await Promise.all([writer,second].map(c=>importFX(c,one.payload,one.raw)));assert.deepEqual(both.map(r=>r.inserted).sort(),[0,1]);
  assert.equal((await importFX(writer,one.payload,one.raw)).inserted,0);assert.deepEqual(await readFXSnapshot(reader,{now}),one.payload);
  const conflict=input('2026-10-22',at,'9');await assert.rejects(importFX(writer,conflict.payload,conflict.raw),/ID_CONFLICT/);
  await assert.rejects(importFX(writer,{...one.payload,krwPerEUR:'1'},one.raw));
  await assert.rejects(importFX(writer,one.payload,Buffer.from('bad')));
  const later=input('2026-10-23','2026-10-24T01:00:00.000Z');
  const faulty={query:async(...args)=>{const r=await writer.query(...args);if(args[0].startsWith('INSERT INTO atlas_fx.snapshot'))throw Error('INJECT_AFTER_INSERT');return r;}};
  await assert.rejects(importFX(faulty,later.payload,later.raw),/INJECT_AFTER_INSERT/);assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM atlas_fx.snapshot')).rows[0].n,1);
  await importFX(writer,later.payload,later.raw);
  await assert.rejects(readFXSnapshot(reader,{now}),/FUTURE/);
  const backfill=input('2026-10-21','2026-10-25T01:00:00.000Z');await importFX(writer,backfill.payload,backfill.raw);
  const current=Date.parse('2026-10-25T01:00:00.000Z');assert.deepEqual(await readFXSnapshot(reader,{now:current}),later.payload);
  const expired=Date.parse('2026-11-01T00:00:00.000Z');await assert.rejects(readFXSnapshot(reader,{now:expired}),/EXPIRED/);assert.deepEqual(await readFXSnapshot(reader,{now:expired,allowExpired:true}),later.payload);
  await assert.rejects(importFX(reader,one.payload,one.raw));await assert.rejects(importFX(f.admin,one.payload,one.raw));await assert.rejects(readFXSnapshot(writer,{now}));
  for(const sql of ['DELETE FROM atlas_fx.snapshot','TRUNCATE atlas_fx.snapshot',"UPDATE atlas_fx.snapshot SET payload='{}'",'SELECT atlas_fx.reject_mutation()',"INSERT INTO atlas_fx.access_grant VALUES('intruder','writer')"])await assert.rejects(writer.query(sql));
  for(const sql of ['CREATE TABLE atlas_fx.bad(id int)','INSERT INTO atlas_fx.snapshot SELECT * FROM atlas_fx.snapshot'])await assert.rejects(reader.query(sql));
  const boundary=()=>transaction(f.admin,()=>verifySupplyApiBoundary(f.admin,{schema:'atlas_fx'}),{repeatableRead:true});await boundary();
  await f.admin.query('GRANT SELECT(payload) ON atlas_fx.snapshot TO anon');await assert.rejects(boundary());await assert.rejects(readFXSnapshot(reader,{now:current}));await f.admin.query('REVOKE SELECT(payload) ON atlas_fx.snapshot FROM anon');
  await f.admin.query('GRANT atlas_test_fxwriter TO authenticator WITH INHERIT FALSE');await assert.rejects(boundary());await f.admin.query('REVOKE atlas_test_fxwriter FROM authenticator');
  await f.admin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA atlas_fx GRANT SELECT ON TABLES TO PUBLIC');await assert.rejects(boundary());await f.admin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA atlas_fx REVOKE SELECT ON TABLES FROM PUBLIC');
  await f.admin.query('ALTER TABLE atlas_fx.snapshot DISABLE TRIGGER immutable_record');await assert.rejects(readFXSnapshot(reader,{now:current}));await f.admin.query('ALTER TABLE atlas_fx.snapshot ENABLE TRIGGER immutable_record');
  await f.admin.query('GRANT UPDATE(payload) ON atlas_fx.snapshot TO atlas_test_fxreader');await assert.rejects(readFXSnapshot(reader,{now:current}));await f.admin.query('REVOKE UPDATE(payload) ON atlas_fx.snapshot FROM atlas_test_fxreader');
  await verifyProductionReader(reader);
  const connect=()=>connectDatabase({DATABASE_URL:ru}),fxReader=databaseFXReader({connect,now:()=>current});
  local=await startPreviewServer(0,{fxDirectory:'/does-not-exist',fxReader});
  production=await startProduction({config:{port:0,hosts:['atlas.example.com']},env:{},commit:'a'.repeat(40)},{connector:{connect,close:async()=>{}},fxReader});
  for(const [s,h]of [[local,{}],[production.server,{host:'atlas.example.com'}]]){const r=await get(s,h);assert.equal(r.status,200);assert.deepEqual(JSON.parse(r.body),later.payload);assert(!r.body.includes('Envelope'));}
  const expiredReader=databaseFXReader({connect,now:()=>expired});await assert.rejects(expiredReader(),/^Error: FX_UNAVAILABLE$/);
  await f.admin.query('ALTER TABLE atlas_fx.snapshot DISABLE TRIGGER immutable_record');await f.admin.query("UPDATE atlas_fx.snapshot SET raw_xml=convert_to('corrupt','UTF8') WHERE rate_date='2026-10-23'");await f.admin.query('ALTER TABLE atlas_fx.snapshot ENABLE TRIGGER immutable_record');await assert.rejects(readFXSnapshot(reader,{now:current}));
  assert.equal((await get(local)).status,503);await verifyFXSchema(f.admin);assert.equal(await structureHash(f.admin),before);
 }finally{await production?.stop();if(local){local.closeAllConnections();await new Promise(r=>local.close(r));}await Promise.all([writer,reader,second].filter(Boolean).map(c=>c.end()));await f.stop();}
});
