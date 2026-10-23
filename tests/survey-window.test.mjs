import test from 'node:test';import assert from 'node:assert/strict';
import {liveSurveyFixture,surveyFixture,surveyDto} from './survey-fixture.mjs';
import {surveyWindowForDay,surveyWindowDays,validateStoredSurvey,validateSurveySnapshot,surveyRows} from '../web/survey-model.js';
import {surveySource} from '../tools/allium-survey-source.mjs';
import {surveyArguments} from '../tools/market-db/survey-cli.mjs';
import {createPreviewServer} from '../tools/ui-preview.mjs';

test('windowed source validates exact dated plans across leap/month/year boundaries while fixed v1 stays fixed',async()=>{
 for(const asOfDay of ['2026-11-01','2027-01-01','2024-03-01']) {
  const f=await liveSurveyFixture({asOfDay}),source=f.source(),days=surveyWindowDays(source.snapshot.window);
  assert.equal(source.mapper,'allium-stored-survey-window-v2');assert.equal(source.snapshot.schemaVersion,2);
  assert.equal(days.length,7);assert.equal(source.to,days.at(-1));assert.equal(surveyRows(source.snapshot).length,77);
  assert.equal(source.snapshot.rows.filter(r=>r.state==='OBSERVED').length,70);
  assert.equal(source.snapshot.rows[0].values.total_supply,'200.000000000000000001');
  const raw=structuredClone(source.snapshot);raw.schemaVersion=1;raw.mapper='allium-survey-v1';assert.throws(()=>validateSurveySnapshot(raw));
  const wrong=await liveSurveyFixture({asOfDay:'2026-11-02'});assert.throws(()=>surveySource(f.bytes,{...f.options,plan:wrong.options.plan}));
  const legacy=await surveyFixture({asOfDay,queriedAt:asOfDay+'T13:00:05.123456Z'});assert.throws(legacy.source);
 }
 assert.deepEqual(surveyWindowDays(surveyWindowForDay('2024-03-01')),['2024-02-23','2024-02-24','2024-02-25','2024-02-26','2024-02-27','2024-02-28','2024-02-29']);
 for(const day of ['2026-02-30','2026-2-01','2000-01-07','2026-11-01T00:00:00Z'])assert.throws(()=>surveyWindowForDay(day));
 const old=await surveyDto();assert.deepEqual(validateStoredSurvey(old),old);
 assert.equal(surveyArguments(['read','--day','2026-11-01'])['--day'],'2026-11-01');assert.throws(()=>surveyArguments(['read','--day','2026-02-30']));
});

test('a selected window cannot mix old snapshots or fill an unobserved kind from another period',async()=>{
 const a=await liveSurveyFixture({asOfDay:'2026-11-01'}),snapshot=a.source().snapshot,window=surveyWindowForDay('2026-11-01');
 const dto=validateStoredSurvey({schemaVersion:2,kind:'ALLIUM_STORED_SURVEY',provider:'ALLIUM',window,snapshots:[snapshot]});
 const missing=surveyRows(undefined,{window:dto.window});assert.equal(missing.length,77);assert(missing.every(r=>r.state==='MISSING'));
 assert.equal(missing.at(-1).day,'2026-10-31');
 const older=(await liveSurveyFixture({asOfDay:'2026-10-31',kind:'volume'})).source().snapshot;
 assert.throws(()=>validateStoredSurvey({...dto,snapshots:[snapshot,older]}));
 assert.throws(()=>surveyRows(older,{window}));assert.throws(()=>validateStoredSurvey({...dto,schemaVersion:1}));
 const bad=structuredClone(snapshot);bad.rows[0].providerDay='2026-11-01';assert.throws(()=>validateSurveySnapshot(bad));
 assert.throws(()=>validateStoredSurvey({...dto,window:{from:'2026-10-24',untilExclusive:'2026-11-01'}}));
});

test('fixed local HTTP serves a stripped windowed DTO without adding URL commands or exposing execution evidence',async()=>{
 const f=await liveSurveyFixture({asOfDay:'2026-11-01'}),snapshot=f.source().snapshot;
 const dto={schemaVersion:2,kind:'ALLIUM_STORED_SURVEY',provider:'ALLIUM',window:surveyWindowForDay('2026-11-01'),snapshots:[snapshot],authorization:'PRIVATE'};
 let reads=0;const server=createPreviewServer({surveyReader:async()=>{reads++;return dto;}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  assert.equal(reads,0);const base='http://127.0.0.1:'+server.address().port,response=await fetch(base+'/survey-data.json'),text=await response.text();
  assert.equal(response.status,200);assert(!text.includes('PRIVATE'));assert(!text.includes('private-live'));
  assert.deepEqual(JSON.parse(text).window,dto.window);
  assert.equal((await fetch(base+'/survey-data.json?day=2026-11-01')).status,404);
  assert.equal((await fetch(base+'/survey-data.json',{method:'POST'})).status,405);assert.equal(reads,1);
 }finally{await new Promise(r=>server.close(r));}
});
