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
