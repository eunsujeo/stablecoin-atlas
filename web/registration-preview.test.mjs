import test from 'node:test';import assert from 'node:assert/strict';import {request} from 'node:http';
import {startPreviewServer} from '../tools/ui-preview.mjs';
const get=(port,path,options={})=>new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port,path,...options},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));});req.on('error',reject);req.end();});
test('supply HTTP reads enforce same origin, fixed arguments, GET/HEAD, byte bounds and sanitized failures',async()=>{
 let calls=0,response={kind:'test'},reject=false;
 const server=await startPreviewServer(0,{registrationReader:async()=>{calls++;if(reject)throw Error('password=SECRET');return response;}}),port=server.address().port;
 try{
  assert.equal((await get(port,'/registration-index.json')).status,200);assert.equal((await get(port,'/registration-index.json',{method:'HEAD'})).body,'');
  const before=calls;for(const path of ['/registration-index.json?x=1','/registration-history.json?coin=usdt','/registration-history.json?url=https://private.test'])assert.equal((await get(port,path)).status,400);
  assert.equal((await get(port,'/registration-index.json',{headers:{origin:'https://evil.test'}})).status,403);assert.equal((await get(port,'/registration-index.json',{method:'POST'})).status,405);assert.equal(calls,before);
  reject=true;const failure=await get(port,'/registration-index.json');assert.equal(failure.status,503);assert.doesNotMatch(failure.body,/SECRET/);
  reject=false;response='x'.repeat(2*1024*1024);assert.equal((await get(port,'/registration-index.json')).status,503);
 }finally{server.closeIdleConnections();await new Promise(r=>server.close(r));}
 const disabled=await startPreviewServer(0);try{assert.equal((await get(disabled.address().port,'/registration-index.json')).status,404);}finally{disabled.closeIdleConnections();await new Promise(r=>disabled.close(r));}
});

test('daily history HTTP revalidates before 304, changes ETag with bytes, supports HEAD and never masks failures',async()=>{
 let response={sourceId:'a'.repeat(64)},failed=false;
 const server=await startPreviewServer(0,{registrationReader:async()=>{if(failed)throw Error('private');return response;}}),port=server.address().port,path='/registration-history.json?'+new URLSearchParams({selection:'b'.repeat(64),coin:'jpyc',metric:'NETWORK_CIRCULATING'});
 try{
  const first=await get(port,path);assert.equal(first.status,200);assert.equal(first.headers['cache-control'],'private, no-cache');assert.match(first.headers.etag,/^"[a-f0-9]{64}"$/);
  const same=await get(port,path,{headers:{'if-none-match':first.headers.etag}});assert.equal(same.status,304);assert.equal(same.body,'');
  assert.equal((await get(port,path,{method:'HEAD',headers:{'if-none-match':first.headers.etag}})).status,304);
  response={sourceId:'c'.repeat(64)};const fresh=await get(port,path,{headers:{'if-none-match':first.headers.etag}});assert.equal(fresh.status,200);assert.notEqual(fresh.headers.etag,first.headers.etag);
  failed=true;const failure=await get(port,path,{headers:{'if-none-match':fresh.headers.etag}});assert.equal(failure.status,503);assert.equal(failure.headers['cache-control'],'no-store');assert.equal(failure.headers.etag,undefined);
 }finally{server.closeIdleConnections();await new Promise(r=>server.close(r));}
});
