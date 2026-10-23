import test from 'node:test';import assert from 'node:assert/strict';
import {createPreviewServer} from '../tools/ui-preview.mjs';
import {databaseActivityReader} from '../tools/market-db/activity-preview.mjs';
test('activity HTTP serves stored projection only, exact route/HEAD/errors are sanitized and never collect',async()=>{
 let count=0,fail=false;const dto={schemaVersion:1,kind:'DAILY_TRANSFERS',provider:'ALLIUM',metric:'TRANSFER_VOLUME',networkId:'ethereum',dateBasis:'PROVIDER_DAY',state:'MISSING',series:[]};
 const server=createPreviewServer({activityReader:async()=>{count++;if(fail)throw Error('private SQL, host and token must never escape');return dto;}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;try{
  assert.deepEqual(await(await fetch(url+'/activity-data.json')).json(),dto);const head=await fetch(url+'/activity-data.json',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(url+'/activity-data.json?coin=usdc')).status,404);assert.equal((await fetch(url+'/activity-data.json',{method:'POST'})).status,405);assert.equal(count,2);
  fail=true;const bad=await fetch(url+'/activity-data.json');assert.equal(bad.status,503);assert.equal(await bad.text(),'ACTIVITY_UNAVAILABLE');
 }finally{await new Promise(r=>server.close(r));}
});
test('activity DB reader coalesces reads, expires cache and surfaces failures without rewriting data',async()=>{
 let calls=0,ended=0,time=0,fail=false;const value={series:[]};const read=databaseActivityReader({now:()=>time,connect:async()=>({end:async()=>{ended++;}}),read:async()=>{calls++;if(fail)throw Error('unavailable');await new Promise(r=>setTimeout(r,2));return value;}});
 const rs=await Promise.all([read(),read(),read()]);assert(rs.every(r=>r===value));assert.equal(calls,1);assert.equal(ended,1);assert.equal(await read(),value);time=10001;fail=true;await assert.rejects(read());assert.equal(calls,2);assert.equal(ended,2);
});
