import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {request} from 'node:http';
import {once} from 'node:events';
import {createPreviewServer} from '../tools/ui-preview.mjs';
import {productionDocument} from '../tools/production-policy.mjs';
const read=(port,path,host)=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path,headers:{host}},res=>{let body='';res.setEncoding('utf8');res.on('data',b=>body+=b);res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.end();});
test('selected Pop Outline loads in both modes while candidate controls and private routes stay unpublished',async()=>{
 const source=await readFile(new URL('../web/index.html',import.meta.url));
 const reader=async()=>{throw Error('NOT_USED');};
 for(const production of [undefined,{hosts:['atlas.example.com'],commit:'a'.repeat(40)}]){
  const server=createPreviewServer({production,marketReader:reader,registrationReader:reader,activityReader:reader,reviewedSupplyReader:reader,surveyReader:reader,fxReader:reader});server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=server.address().port,host=production?'atlas.example.com':`127.0.0.1:${port}`;
  try{
   for(const path of ['/','/index.html','/?review=design']){
    const page=await read(port,path,host);assert.equal(page.status,200);
    if(production)assert.equal(page.body,productionDocument(source).toString());
    else assert.equal(page.body,source.toString());
    assert(page.body.includes('href="/pop-outline.css"'));assert(page.body.includes('data-theme="light"'));assert(page.body.includes('data-visual="pop-outline"'));assert(!page.body.includes('/dev-design.'));
   }
   for(const path of ['/dev-design.js','/dev-design.css'])assert.equal((await read(port,path,host)).status,404);
   assert.equal((await read(port,'/dev-design.js?x=1',host)).status,404);
   const style=await read(port,'/pop-outline.css',host);assert.equal(style.status,200);assert(!/soft-pastel|pastel-geometry|dev-design-bar/.test(style.body));
   assert.equal((await read(port,'/pop-outline.css?x=1',host)).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
 }
});
