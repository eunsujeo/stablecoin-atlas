import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {startPreviewServer} from '../tools/ui-preview.mjs';

const read=(server,path,{method='GET',host}={})=>new Promise((resolve,reject)=>{
  const req=request({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{host:host??`127.0.0.1:${server.address().port}`}},res=>{
    let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));
  });req.on('error',reject);req.end();
});
const stop=server=>new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});
const assets=['/contract-review.js','/contract-review-data.js','/contract-review.css'];

test('local dashboard serves reviewed contract excerpts and never serves raw report or snapshot paths',async()=>{
  const server=await startPreviewServer(0);
  try{
    const home=await read(server,'/');assert.equal(home.status,200);assert.match(home.body,/data-screen="contracts"/);
    for(const path of assets){
      const response=await read(server,path);assert.equal(response.status,200);assert.match(response.headers['content-security-policy'],/connect-src 'self'/);
      assert.equal((await read(server,path,{method:'HEAD'})).body,'');
      assert.equal((await read(server,path,{method:'POST'})).status,405);
      assert.equal((await read(server,path,{host:'evil.example'})).status,403);
    }
    const summary=await read(server,'/contract-review-data.js');
    for(const value of ['UNKNOWN','NOT_TESTED','NOT_RUN','2026-10-26T00:33:22.564Z','docs/research/2026-10-26-contract-review-multicall3.md'])assert(summary.body.includes(value));
    assert(!/\.state\/|snapshot\.private\.json|RPC_URL|API_KEY|0x[a-f0-9]{64}.*privateKey/.test(summary.body));
    for(const path of ['/review.json','/snapshot.private.json','/.state/contract-review-multicall3-reviewed-20261026/review.json','/contract-review-data.js?file=../snapshot.private.json'])assert.equal((await read(server,path)).status,404,path);
  }finally{await stop(server);}
});

test('production omits contract UI and denies all new assets for GET/HEAD without calling readers',async()=>{
  let calls=0;const reader=async()=>{calls++;throw Error('SHOULD_NOT_READ');};
  const server=await startPreviewServer(0,{production:{hosts:['atlas.example.com'],commit:'a'.repeat(40)},marketReader:reader,registrationReader:reader,activityReader:reader,reviewedSupplyReader:reader,surveyReader:reader,fxReader:reader});
  try{
    for(const path of ['/','/index.html','/?section=contracts','/index.html?section=contracts']){
      const response=await read(server,path,{host:'atlas.example.com'});assert.equal(response.status,200);
      assert(!/local-contract|contract-review|contracts-screen|data-screen="contracts"|Multicall3/.test(response.body),path);
    }
    for(const method of ['GET','HEAD'])for(const path of assets.flatMap(p=>[p,p+'?x=1']))assert.equal((await read(server,path,{method,host:'atlas.example.com'})).status,404,path);
    assert.equal(calls,0);
  }finally{await stop(server);}
});
