import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {fixture} from './fixture.mjs';import {initialize,grantAccess,structureHash} from '../../tools/market-db/schema.mjs';
import {initializeSurvey,grantSurvey,importSurvey,readSurvey,verifySurveySchema} from '../../tools/market-db/survey.mjs';
import {verifySupplyApiBoundary} from '../../tools/market-db/supply-api-boundary.mjs';
import {connectDatabase,transaction} from '../../tools/market-db/connection.mjs';import {surveyFixture} from '../survey-fixture.mjs';
test('survey PG17 stores immutable whole snapshots with least privileges, atomic rollback, replay/races and latest missing days',{timeout:120000},async()=>{
 const f=await fixture(),archive=await mkdtemp(join(tmpdir(),'allium-survey-'));let writer,reader,second;
 try{
  await initialize(f.admin);const before=await structureHash(f.admin,'atlas_market');await f.admin.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE authenticator NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS');
  await initializeSurvey(f.admin);assert.equal((await initializeSurvey(f.admin)).state,'UNCHANGED');
  const wu=await f.createUser('atlas_test_surveywriter'),ru=await f.createUser('atlas_test_surveyreader');
  await grantAccess(f.admin,'atlas_test_surveywriter','writer');await grantAccess(f.admin,'atlas_test_surveyreader','reader');
  await grantSurvey(f.admin,'atlas_test_surveywriter','writer');await grantSurvey(f.admin,'atlas_test_surveyreader','reader');assert.equal((await grantSurvey(f.admin,'atlas_test_surveyreader','reader')).state,'UNCHANGED');
  writer=await connectDatabase({DATABASE_URL:wu});second=await connectDatabase({DATABASE_URL:wu});reader=await connectDatabase({DATABASE_URL:ru});
  const boundary=()=>transaction(f.admin,()=>verifySupplyApiBoundary(f.admin,{schema:'atlas_survey'}),{repeatableRead:true});assert.equal((await boundary()).state,'VERIFIED_EFFECTIVE_ACCESS_DENIED');
  const options=a=>({...a.options,archiveRoot:archive}),count=async()=>(await f.admin.query('SELECT count(*)::int AS n FROM atlas_survey.source')).rows[0].n;
  const a=await surveyFixture();assert.equal((await readSurvey(reader)).snapshots.length,0);
  assert.equal((await importSurvey(writer,a.bytes,options(a))).rows,70);assert.equal((await importSurvey(writer,a.bytes,options(a))).rows,0);
  for(const [bytes,hash]of [[a.bytes,a.options.expectedHash],[a.options.reviewBytes,a.options.reviewHash],[a.options.receiptBytes,a.source().receiptHash]]){const path=join(archive,hash.slice(0,2),hash+'.json');assert.deepEqual(await readFile(path),bytes);assert.equal((await stat(path)).mode&0o777,0o600);}
  const raw=join(archive,a.options.expectedHash.slice(0,2),a.options.expectedHash+'.json');await rm(raw);assert.equal((await importSurvey(writer,a.bytes,options(a))).rows,0);assert.deepEqual(await readFile(raw),a.bytes);
  const b=await surveyFixture({queriedAt:'2026-10-23T11:00:00.000000Z',amount:'2000',mutate:p=>{p.data=p.data.filter(r=>r.deployment_id!=='jpysc-ethereum'||r.provider_day>='2026-10-19');}});
  assert.deepEqual((await Promise.all([importSurvey(writer,b.bytes,options(b)),importSurvey(second,b.bytes,options(b))])).map(r=>r.rows).sort((a,b)=>a-b),[0,67]);
  let read=await readSurvey(reader);assert.equal(read.snapshots[0].rows.filter(r=>r.deploymentId==='jpysc-ethereum').length,4);assert.equal(read.snapshots[0].rows[0].values.total_supply,'2000');
  const old=await surveyFixture({queriedAt:'2026-10-23T10:00:00.000000Z',amount:'500'});await importSurvey(writer,old.bytes,options(old));assert.equal((await readSurvey(reader)).snapshots[0].rows[0].values.total_supply,'2000');
  const clash=await surveyFixture({queriedAt:'2026-10-23T11:00:00.000000Z',amount:'3000'});await assert.rejects(importSurvey(writer,clash.bytes,options(clash)),/TIMESTAMP_CONFLICT/);assert.equal(await count(),3);
  const volume=await surveyFixture({kind:'volume'});let inserted=false;
  const faulty={query:async(...args)=>{const result=await writer.query(...args);if(typeof args[0]==='string'&&args[0].startsWith('INSERT INTO atlas_survey.source')){inserted=true;throw Error('INJECT_AFTER_INSERT');}return result;}};
  await assert.rejects(importSurvey(faulty,volume.bytes,options(volume)),/INJECT_AFTER_INSERT/);assert(inserted);assert.equal(await count(),3);assert.equal((await importSurvey(writer,volume.bytes,options(volume))).rows,70);
  await assert.rejects(importSurvey(reader,a.bytes,options(a)));await assert.rejects(importSurvey(f.admin,a.bytes,options(a)));await assert.rejects(grantSurvey(f.admin,'atlas_test_surveyreader','writer'));
  for(const sql of ['DELETE FROM atlas_survey.source',"UPDATE atlas_survey.source SET kind='supply'",'TRUNCATE atlas_survey.source',"INSERT INTO atlas_survey.access_grant VALUES('intruder','writer')",'SELECT atlas_survey.reject_mutation()'])await assert.rejects(writer.query(sql));
  await f.admin.query('GRANT SELECT(payload) ON atlas_survey.source TO anon');await assert.rejects(boundary());await f.admin.query('REVOKE SELECT(payload) ON atlas_survey.source FROM anon');
  await f.admin.query('GRANT atlas_test_surveywriter TO authenticator WITH INHERIT FALSE');await assert.rejects(boundary());await f.admin.query('REVOKE atlas_test_surveywriter FROM authenticator');
  await f.admin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA atlas_survey GRANT SELECT ON TABLES TO PUBLIC');await assert.rejects(boundary());await f.admin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA atlas_survey REVOKE SELECT ON TABLES FROM PUBLIC');
  await f.admin.query('ALTER TABLE atlas_survey.source DISABLE TRIGGER immutable_record');await assert.rejects(readSurvey(reader));await f.admin.query('ALTER TABLE atlas_survey.source ENABLE TRIGGER immutable_record');
  await f.admin.query('GRANT UPDATE(payload) ON atlas_survey.source TO atlas_test_surveywriter');await assert.rejects(readSurvey(reader));await f.admin.query('REVOKE UPDATE(payload) ON atlas_survey.source FROM atlas_test_surveywriter');
  await f.admin.query('GRANT USAGE ON SCHEMA atlas_survey TO PUBLIC');await assert.rejects(readSurvey(reader));await f.admin.query('REVOKE USAGE ON SCHEMA atlas_survey FROM PUBLIC');
  // Bypassing the immutable trigger as fixture owner still cannot hide corrupted payload from the reader.
  await f.admin.query('ALTER TABLE atlas_survey.source DISABLE TRIGGER immutable_record');
  await f.admin.query("UPDATE atlas_survey.source SET payload=jsonb_set(payload,'{rows,0,values,total_supply}','\"999\"') WHERE kind='supply' AND queried_at='2026-10-23T11:00:00Z'");
  await f.admin.query('ALTER TABLE atlas_survey.source ENABLE TRIGGER immutable_record');await assert.rejects(readSurvey(reader));
  await verifySurveySchema(f.admin);assert.equal(await structureHash(f.admin,'atlas_market'),before);assert.equal((await boundary()).dashboardExposedSchemas,'UNKNOWN');
 }finally{await Promise.all([writer,second,reader].filter(Boolean).map(c=>c.end()));await f.stop();await rm(archive,{recursive:true,force:true});}
});
