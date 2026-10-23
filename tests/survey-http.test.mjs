import test from 'node:test';import assert from 'node:assert/strict';import {request} from 'node:http';
import {createPreviewServer} from '../tools/ui-preview.mjs';import {databaseSurveyReader} from '../tools/market-db/survey-preview.mjs';
import {surveyDto} from './survey-fixture.mjs';
test('survey HTTP is fixed local GET/HEAD, strips private fields and hides errors without triggering reads at startup',async()=>{
 let count=0,fail=false;const dto=await surveyDto();dto.sql='private';dto.snapshots[0].rows[0].private='secret';
 const server=createPreviewServer({surveyReader:async()=>{count++;if(fail)throw Error('private credentials');return dto;}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal(count,0);let response=await fetch(url+'/survey-data.json');assert.equal(response.status,200);const text=await response.text();assert(!text.includes('private'));assert(!text.includes('secret'));assert.equal(JSON.parse(text).snapshots.length,2);
  response=await fetch(url+'/survey-data.json',{method:'HEAD'});assert.equal(response.status,200);assert.equal(await response.text(),'');
  for(const suffix of ['?coin=usdc','/','?execute=true'])assert.equal((await fetch(url+'/survey-data.json'+suffix)).status,404);
  assert.equal((await fetch(url+'/survey-data.json',{method:'POST'})).status,405);assert.equal((await fetch(url+'/survey-data.json',{headers:{Origin:'https://example.com'}})).status,403);
  const status=await new Promise((resolve,reject)=>{const r=request(url+'/survey-data.json',{headers:{Host:'example.com'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));});r.on('error',reject);r.end();});assert.equal(status,403);assert.equal(count,2);
  fail=true;response=await fetch(url+'/survey-data.json');assert.equal(response.status,503);assert.equal(await response.text(),'SURVEY_UNAVAILABLE');
  fail=false;dto.snapshots[0].rows[0].values.total_supply=2;assert.equal((await fetch(url+'/survey-data.json')).status,503);
 }finally{await new Promise(r=>server.close(r));}
 const disabled=createPreviewServer();await new Promise(r=>disabled.listen(0,'127.0.0.1',r));try{assert.equal((await fetch('http://127.0.0.1:'+disabled.address().port+'/survey-data.json')).status,404);}finally{await new Promise(r=>disabled.close(r));}
});
test('survey reader coalesces/caches reads, limits failures for 10s and recovers with bounded allowlisted projections',async()=>{
 let calls=0,ended=0,time=0,fail=false;const value=await surveyDto(),reader=databaseSurveyReader({now:()=>time,connect:async()=>({end:async()=>{ended++;}}),read:async()=>{calls++;await new Promise(r=>setTimeout(r,2));if(fail)throw Error('private');return value;}});
 assert.equal(calls,0);const outputs=await Promise.all([reader(),reader(),reader()]);assert(outputs.every(o=>o===outputs[0]));assert.equal(calls,1);assert.equal(ended,1);assert.equal(await reader(),outputs[0]);
 time=10001;fail=true;await assert.rejects(reader(),/^Error: SURVEY_UNAVAILABLE$/);await assert.rejects(reader());assert.equal(calls,2);assert.equal(ended,2);
 time=20002;fail=false;assert.deepEqual(await reader(),outputs[0]);time=30003;value.secret='x'.repeat(131073);await assert.rejects(reader());assert.equal(ended,4);
});
