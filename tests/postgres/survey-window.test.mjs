import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {fixture} from './fixture.mjs';import {initialize,grantAccess,structureHash} from '../../tools/market-db/schema.mjs';
import {initializeSurvey,upgradeSurvey,grantSurvey,importSurvey,readSurvey,verifySurveySchema,surveyStructures} from '../../tools/market-db/survey.mjs';
import {transaction,connectDatabase} from '../../tools/market-db/connection.mjs';
import {verifySupplyApiBoundary} from '../../tools/market-db/supply-api-boundary.mjs';
import {surveyFixture,liveSurveyFixture} from '../survey-fixture.mjs';
import {surveyRows} from '../../web/survey-model.js';

test('explicit window upgrade is atomic/pinned and preserves v1 while selecting whole snapshots within one window',{timeout:120000},async()=>{
 const f=await fixture(),archive=await mkdtemp(join(tmpdir(),'survey-window-'));const clients=[];
 try {
  await initialize(f.admin);await f.admin.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE authenticator NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS');
  await initializeSurvey(f.admin);const baseStructure=await structureHash(f.admin,'atlas_market');
  const writerUrl=await f.createUser('atlas_test_windowwriter'),readerUrl=await f.createUser('atlas_test_windowreader');
  for(const [role,mode]of [['atlas_test_windowwriter','writer'],['atlas_test_windowreader','reader']]){await grantAccess(f.admin,role,mode);await grantSurvey(f.admin,role,mode);}
  for(const url of [writerUrl,writerUrl,readerUrl,f.url('postgres')])clients.push(await connectDatabase({DATABASE_URL:url}));
  const [writer,second,reader,otherAdmin]=clients,options=s=>({...s.options,archiveRoot:archive});
  for(const kind of ['supply','volume']){for(const source of [await surveyFixture({kind}),await liveSurveyFixture({kind})])await importSurvey(writer,source.bytes,options(source));}
  const records=async()=>(await f.admin.query("SELECT encode(id,'hex') AS id,row_to_json(s)::text AS row FROM atlas_survey.source s ORDER BY id")).rows;
  const old=await records(),oldRead=await readSurvey(reader),v1=(await f.admin.query('SELECT row_to_json(v)::text AS row FROM atlas_survey.schema_version v WHERE version=1')).rows[0];
  const day1=await liveSurveyFixture({asOfDay:'2026-10-24'});
  await assert.rejects(importSurvey(writer,day1.bytes,options(day1)),/UPGRADE_REQUIRED/);
  const faulty={query:async(...args)=>{const result=await f.admin.query(...args);if(typeof args[0]==='string'&&args[0].startsWith('INSERT INTO atlas_survey.schema_version VALUES(2'))throw Error('INJECT_UPGRADE_ROLLBACK');return result;}};
  await assert.rejects(upgradeSurvey(faulty),/INJECT_UPGRADE_ROLLBACK/);assert.equal(await verifySurveySchema(f.admin),1);assert.deepEqual(await records(),old);
  let entered,release;const ready=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
  const reading=transaction(reader,async()=>{const result=await reader.query('SELECT count(*)::int AS n FROM atlas_survey.source');entered();await hold;return result.rows[0].n;},{repeatableRead:true});
  await ready;const upgrading=upgradeSurvey(f.admin);await new Promise(r=>setTimeout(r,50));release();assert.equal(await reading,4);assert.equal((await upgrading).version,2);
  const raced=await Promise.all([upgradeSurvey(f.admin),upgradeSurvey(otherAdmin)]);assert(raced.every(r=>r.state==='UNCHANGED'));
  assert.equal(await verifySurveySchema(f.admin),2);assert.equal((await initializeSurvey(f.admin)).version,2);
  assert.deepEqual((await f.admin.query('SELECT row_to_json(v)::text AS row FROM atlas_survey.schema_version v WHERE version=1')).rows[0],v1);
  assert.deepEqual(await records(),old);assert.deepEqual(await readSurvey(reader),oldRead);
  await assert.rejects(upgradeSurvey(reader));
  assert.deepEqual((await Promise.all([importSurvey(writer,day1.bytes,options(day1)),importSurvey(second,day1.bytes,options(day1))])).map(r=>r.rows).sort((a,b)=>a-b),[0,70]);
  let read=await readSurvey(reader);assert.equal(read.schemaVersion,2);assert.equal(read.window.untilExclusive,'2026-10-24');assert.deepEqual(read.snapshots.map(s=>s.survey),['supply']);
  assert(surveyRows(undefined,{window:read.window}).every(r=>r.state==='MISSING'));
  const volume=await liveSurveyFixture({asOfDay:'2026-10-24',kind:'volume',mutate:p=>{p.data=p.data.filter(r=>r.deployment_id!=='jpysc-ethereum'||r.provider_day>='2026-10-20');}});
  assert.equal((await importSurvey(writer,volume.bytes,options(volume))).rows,67);assert.equal((await importSurvey(writer,volume.bytes,options(volume))).rows,0);
  const month=await liveSurveyFixture({asOfDay:'2026-11-01'});await importSurvey(writer,month.bytes,options(month));
  read=await readSurvey(reader);assert.equal(read.window.untilExclusive,'2026-11-01');assert.equal(read.snapshots.length,1);assert.equal(surveyRows(read.snapshots[0]).at(-1).day,'2026-10-31');
  const historical=await readSurvey(reader,{asOfDay:'2026-10-24'});assert.equal(historical.snapshots.length,2);assert.equal(surveyRows(historical.snapshots[1]).filter(r=>r.state==='MISSING').length,3);
  assert.deepEqual((await readSurvey(reader,{asOfDay:'2026-10-23'})).snapshots,oldRead.snapshots);
  const empty=await readSurvey(reader,{asOfDay:'2026-12-01'});assert.equal(empty.snapshots.length,0);assert.equal(empty.window.untilExclusive,'2026-12-01');
  const clash=await liveSurveyFixture({asOfDay:'2026-10-24',amount:'999'});await assert.rejects(importSurvey(writer,clash.bytes,options(clash)),/TIMESTAMP_CONFLICT/);
  const latestBefore=await readSurvey(reader);await importSurvey(writer,day1.bytes,options(day1));assert.deepEqual(await readSurvey(reader),latestBefore);
  for(const sql of ['DELETE FROM atlas_survey.source','TRUNCATE atlas_survey.source',"UPDATE atlas_survey.source SET mapper='x'"])await assert.rejects(writer.query(sql));
  const all=await records();for(const row of old)assert.deepEqual(all.find(r=>r.id===row.id),row);assert.equal(all.length,7);
  // Neither an unexpected DDL change nor an owner-updated stored hash is accepted as the expected structure.
  await f.admin.query('ALTER TABLE atlas_survey.source ADD COLUMN rogue text');
  const tampered=await structureHash(f.admin,'atlas_survey');
  await f.admin.query('ALTER TABLE atlas_survey.schema_version DISABLE TRIGGER immutable_record');
  await f.admin.query('UPDATE atlas_survey.schema_version SET structure_hash=$1 WHERE version=2',[Buffer.from(tampered,'hex')]);
  await f.admin.query('ALTER TABLE atlas_survey.schema_version ENABLE TRIGGER immutable_record');
  await assert.rejects(readSurvey(reader));await assert.rejects(upgradeSurvey(f.admin));
  await f.admin.query('ALTER TABLE atlas_survey.source DROP COLUMN rogue');
  await f.admin.query('ALTER TABLE atlas_survey.schema_version DISABLE TRIGGER immutable_record');
  await f.admin.query('UPDATE atlas_survey.schema_version SET structure_hash=$1 WHERE version=2',[Buffer.from(surveyStructures[2],'hex')]);
  await f.admin.query('ALTER TABLE atlas_survey.schema_version ENABLE TRIGGER immutable_record');
  // Fixture-only repair restores the pinned shape; production never adopts a new observed hash.
  assert.equal(await structureHash(f.admin,'atlas_survey'),surveyStructures[2]);
  assert.equal(await verifySurveySchema(f.admin),2);assert.equal(await structureHash(f.admin,'atlas_market'),baseStructure);
  assert.equal((await transaction(f.admin,()=>verifySupplyApiBoundary(f.admin,{schema:'atlas_survey'}),{repeatableRead:true})).state,'VERIFIED_EFFECTIVE_ACCESS_DENIED');
 }finally{await Promise.all(clients.map(c=>c.end().catch(()=>{})));await f.stop();await rm(archive,{recursive:true,force:true});}
});
