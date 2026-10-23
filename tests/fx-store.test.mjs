import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {parseFX,storeFX,readFX} from '../tools/fx-store.mjs';
import {startPreviewServer} from '../tools/ui-preview.mjs';
const at='2026-10-23T10:00:00.000Z';
const xml=(day='2026-10-22',rates="<Cube currency='USD' rate='2'/><Cube currency='KRW' rate='2000'/>")=>Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><gesmes:subject>Reference rates</gesmes:subject><gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender><Cube><Cube time='${day}'>${rates}</Cube></Cube></gesmes:Envelope>`);
test('ECB parser binds one reference day, exact positive quotes and explicit import/fetch clocks',()=>{
 const p=parseFX(xml(),{at,imported:true});assert.equal(p.usdPerEUR,'2');assert.equal(p.krwPerEUR,'2000');assert.equal(p.fetchedAt,null);assert.equal(p.importedAt,at);
 for(const bytes of [xml('2026-10-24'),xml('2026-02-30'),xml(undefined,"<Cube currency='USD' rate='0'/><Cube currency='KRW' rate='1'/>"),xml(undefined,"<Cube currency='USD' rate='2'/><Cube currency='USD' rate='3'/><Cube currency='KRW' rate='1'/>"),xml(undefined,"<Cube currency='USD' rate='-2'/><Cube currency='KRW' rate='1'/>"),xml(undefined,"<Cube currency='JPY' rate='1'/>"),Buffer.from(xml().toString().replace('<Cube>','<!DOCTYPE foo><Cube>')),Buffer.alloc(65537)])assert.throws(()=>parseFX(bytes,{at}));
});
test('daily claim precedes HTTP; concurrent run and imported seed never cause a second request; receipt resumes publication',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-fx-'));try{
  const directory=join(root,'store');let requests=0,start,release;const started=new Promise(r=>start=r),gate=new Promise(r=>release=r);
  const first=storeFX({directory,at,fetcher:async(url,o)=>{requests++;assert.equal(url,'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');assert.equal(o.redirect,'error');start();await gate;return new Response(xml());}});await started;
  await assert.rejects(storeFX({directory,at,fetcher:()=>assert.fail('must not fetch')}),/FX_UNCONFIRMED/);release();assert.equal((await first).providerRequests,1);assert.equal(requests,1);
  const original=await readFX(directory,{now:Date.parse(at)});await rm(join(directory,'snapshots',at.slice(0,10)+'.json'));
  assert.equal((await storeFX({directory,at,fetcher:()=>assert.fail('must recover')})).providerRequests,0);assert.deepEqual(await readFX(directory,{now:Date.parse(at)}),original);
  const source=join(root,'seed.xml');await writeFile(source,xml(),{mode:0o600});const seeded=join(root,'seeded');assert.equal((await storeFX({directory:seeded,source,at})).providerRequests,0);assert.equal((await storeFX({directory:seeded,at,fetcher:()=>assert.fail('seed already reserved today')})).providerRequests,0);
  await writeFile(join(directory,'archive',original.sourceHash+'.xml'),xml(undefined,"<Cube currency='USD' rate='9'/><Cube currency='KRW' rate='2'/>"));await assert.rejects(readFX(directory,{now:Date.parse(at)}));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('failed day preserves previous snapshot and cannot retry its HTTP request',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-fx-failure-'));try{
  await storeFX({directory:root,at,fetcher:async()=>new Response(xml())});let calls=0;const tomorrow='2026-10-24T10:00:00.000Z';
  await assert.rejects(storeFX({directory:root,at:tomorrow,fetcher:async()=>{calls++;return new Response('',{status:503});}}),/FX_HTTP_FAILED/);
  await assert.rejects(storeFX({directory:join(root,'oversize'),at,fetcher:async()=>new Response(Buffer.alloc(65537))}),/FX_RESPONSE_LIMIT/);
  await assert.rejects(storeFX({directory:root,at:tomorrow,fetcher:()=>assert.fail('failed day must not retry')}),/FX_UNCONFIRMED/);assert.equal(calls,1);assert.equal((await readFX(root,{now:Date.parse(tomorrow)})).date,'2026-10-22');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('FX HTTP serves only verified stored projection; reads, startup and HEAD do not collect',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-fx-http-'));let server;try{
  const now=new Date().toISOString(),source=join(root,'seed.xml'),directory=join(root,'store');await writeFile(source,xml(now.slice(0,10)),{mode:0o600});await storeFX({directory,source,at:now});
  server=await startPreviewServer(0,{fxDirectory:directory});const get=(path,method='GET')=>new Promise((resolve,reject)=>{const r=request({host:'127.0.0.1',port:server.address().port,path,method},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));});r.on('error',reject);r.end();});
  const response=await get('/fx-data.json');assert.equal(response.status,200);assert.equal(JSON.parse(response.body).kind,'ECB_REFERENCE_FX');assert(!response.body.includes('<Cube'));assert.equal((await get('/fx-data.json','HEAD')).body,'');assert.equal((await get('/fx-data.json?path=secret')).status,404);
 }finally{if(server){server.closeIdleConnections();await new Promise(r=>server.close(r));}await rm(root,{recursive:true,force:true});}
});
