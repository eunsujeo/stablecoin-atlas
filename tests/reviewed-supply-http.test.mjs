import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createPreviewServer} from '../tools/ui-preview.mjs';
import {databaseReviewedSupplyReader} from '../tools/market-db/allium-supply-preview.mjs';
import {reviewedSupplyFixture} from './reviewed-supply-fixture.mjs';
test('reviewed supply HTTP exposes only the fixed projection, honors local read-only boundary and hides failures',async()=>{
 let count=0,fail=false;const dto=reviewedSupplyFixture();dto.sql='private SQL';dto.series[0].points[0].secret='private token';
 const server=createPreviewServer({reviewedSupplyReader:async()=>{count++;if(fail)throw Error('private host token');return dto;}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal(count,0);const res=await fetch(url+'/reviewed-supply-data.json');assert.equal(res.status,200);const value=await res.json();assert.equal(value.series[0].points.length,7);assert(!JSON.stringify(value).includes('private'));
  const head=await fetch(url+'/reviewed-supply-data.json',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  for(const suffix of ['?coin=usdc','/','?from=2026-10-15'])assert.equal((await fetch(url+'/reviewed-supply-data.json'+suffix)).status,404);
  assert.equal((await fetch(url+'/reviewed-supply-data.json',{method:'POST'})).status,405);
  assert.equal((await fetch(url+'/reviewed-supply-data.json',{headers:{Origin:'https://example.com'}})).status,403);
  const hostStatus=await new Promise((resolve,reject)=>{const req=request(url+'/reviewed-supply-data.json',{headers:{Host:'example.com'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});
  assert.equal(hostStatus,403);assert.equal(count,2);
  fail=true;const bad=await fetch(url+'/reviewed-supply-data.json');assert.equal(bad.status,503);assert.equal(await bad.text(),'REVIEWED_SUPPLY_UNAVAILABLE');
  fail=false;dto.networkId='other';assert.equal((await fetch(url+'/reviewed-supply-data.json')).status,503);
 }finally{await new Promise(r=>server.close(r));}
 const disabled=createPreviewServer();await new Promise(r=>disabled.listen(0,'127.0.0.1',r));try{assert.equal((await fetch('http://127.0.0.1:'+disabled.address().port+'/reviewed-supply-data.json')).status,404);}finally{await new Promise(r=>disabled.close(r));}
});
test('reviewed supply reader pins range, coalesces/cache reads, rate limits failures and recovers without writes',async()=>{
 let calls=0,ended=0,connections=0,time=0,fail=false;const value=reviewedSupplyFixture();
 const reader=databaseReviewedSupplyReader({now:()=>time,connect:async()=>{connections++;return {end:async()=>{ended++;}};},read:async(c,range)=>{calls++;assert.deepEqual(range,{from:'2026-10-16',to:'2026-10-22'});await new Promise(r=>setTimeout(r,2));if(fail)throw Error('private');return value;}});
 assert.equal(connections,0);const results=await Promise.all([reader(),reader(),reader()]);assert(results.every(r=>r===results[0]));assert.equal(calls,1);assert.equal(ended,1);assert.equal(await reader(),results[0]);
 time=10001;fail=true;await assert.rejects(reader(),/^Error: REVIEWED_SUPPLY_UNAVAILABLE$/);await assert.rejects(reader());assert.equal(calls,2);assert.equal(ended,2);
 time=20002;fail=false;assert.deepEqual(await reader(),results[0]);assert.equal(calls,3);
 time=30003;value.private='x'.repeat(33000);await assert.rejects(reader());assert.equal(ended,4);
 time=40004;delete value.private;value.series.push(value.series[0]);await assert.rejects(reader());assert.equal(ended,5);
});
