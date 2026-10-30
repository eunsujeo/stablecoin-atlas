import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {collectFrankfurterFX,parseFrankfurterFX,storedFrankfurterInputs,frankfurterEndpoint} from '../tools/frankfurter-fx-store.mjs';
import {priceLabel,fxSourceLabel,usableFX,validateFX} from '../web/fx-model.js';
import {databaseFrankfurterFXReader} from '../tools/market-db/frankfurter-fx-preview.mjs';
const at='2026-10-30T11:00:00.000Z';
const body=Buffer.from('{"date":"2026-10-30","base":"USD","quote":"KRW","rate":1432.123456789123456789}');
test('Frankfurter rates retain numeric lexemes and distinct provenance, then convert directly with bigint',()=>{
 const p=parseFrankfurterFX(body,{at});assert.equal(p.krwPerUSD,'1432.123456789123456789');assert.equal(p.provider,'FRANKFURTER');assert.equal(p.base,'USD');assert.equal(p.quote,'KRW');assert.equal(p.importedAt,null);assert.equal(p.fetchedAt,at);assert.equal(p.usdPerEUR,undefined);
 assert.equal(priceLabel('1','KRW',p,Date.parse(at)),'₩1,432.12');assert.equal(priceLabel('9007199254740993','KRW',{...p,krwPerUSD:'1'},Date.parse(at)),'₩9,007,199,254,740,993.00');assert.equal(fxSourceLabel(p),'Frankfurter 일별 참고환율');
 assert(!usableFX(p,Date.parse('2026-11-07T00:00:00.000Z')));
 for(const raw of ['{"date":"2026-10-30","base":"USD","quote":"KRW","rate":0}','{"date":"2026-10-30","base":"USD","quote":"KRW","rate":-1}','{"date":"2026-10-30","base":"USD","quote":"KRW","rate":"1432"}','{"date":"2026-10-30","base":"USD","quote":"KRW","rate":1,"rate":2}','{"date":"2026-10-30","base":"USD","quote":"KRW","rate":1,"r\\u0061te":2}','{"date":"2026-10-31","base":"USD","quote":"KRW","rate":1}','{"date":"2026-10-30","base":"EUR","quote":"KRW","rate":1}'])assert.throws(()=>parseFrankfurterFX(Buffer.from(raw),{at}));
 assert.throws(()=>parseFrankfurterFX(Buffer.from([0xff]),{at}));assert.throws(()=>parseFrankfurterFX(Buffer.alloc(65537),{at}));assert.throws(()=>validateFX({...p,krwPerUSD:1432}));
});
test('Frankfurter daily claim serializes concurrent sends, preserves raw bytes and never resends after failures',{timeout:20000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-frankfurter-'));let calls=0;
 try{
  const fetcher=async(url,o)=>{calls++;assert.equal(url,frankfurterEndpoint);assert.equal(o.redirect,'error');assert(o.signal instanceof AbortSignal);return new Response(body,{status:200});};
  const directoryPath=join(root,'success');const results=await Promise.allSettled([collectFrankfurterFX({directoryPath,at,fetcher}),collectFrankfurterFX({directoryPath,at,fetcher})]);assert.equal(calls,1);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/DAY_CONSUMED/);
  const inputs=await storedFrankfurterInputs(directoryPath);assert.equal(inputs.length,1);assert.deepEqual(inputs[0].raw,body);assert.equal(inputs[0].payload.fetchedAt,at);
  await assert.rejects(collectFrankfurterFX({directoryPath,at,fetcher}),/DAY_CONSUMED/);assert.equal(calls,1);
  for(const [name,fetcher]of [['timeout',async()=>{throw Object.assign(Error('timeout'),{code:'UND_ERR_CONNECT_TIMEOUT'});}],['http',async()=>new Response('no',{status:503})],['invalid',async()=>new Response('{}')],['large',async()=>new Response(Buffer.alloc(65537))]]){
   const directoryPath=join(root,name);let sent=0;const f=async(...args)=>{sent++;return fetcher(...args);};await assert.rejects(collectFrankfurterFX({directoryPath,at,fetcher:f}));await assert.rejects(collectFrankfurterFX({directoryPath,at,fetcher:f}),/DAY_CONSUMED/);assert.equal(sent,1);assert.equal((await readdir(join(directoryPath,'claims'))).length,1);assert.deepEqual(await readdir(join(directoryPath,'snapshots')),[]);
   const failure=JSON.parse(await readFile(join(directoryPath,'failures','2026-10-30.json')));assert.equal(failure.state,'FAILED');if(name==='timeout')assert.equal(failure.errorCode,'UND_ERR_CONNECT_TIMEOUT');if(['http','invalid'].includes(name))assert.equal((await readdir(join(directoryPath,'archive'))).length,1);
  }
  const source=join(directoryPath,'archive',inputs[0].payload.sourceHash+'.json');await writeFile(source,'broken');await assert.rejects(storedFrankfurterInputs(directoryPath));
  await assert.rejects(collectFrankfurterFX({directoryPath,at:'2026-10-31T11:00:00.000Z',fetcher:()=>assert.fail('corruption must stop before sending')}));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('selected Frankfurter reader refuses a valid ECB response instead of falling back',async()=>{
 let closed=0;const p={schemaVersion:1,kind:'ECB_REFERENCE_FX',base:'EUR',date:'2026-10-30',usdPerEUR:'1',krwPerEUR:'1400',sourceHash:'a'.repeat(64),fetchedAt:at,importedAt:null};
 const reader=databaseFrankfurterFXReader({connect:async()=>({end:async()=>{closed++;}}),read:async()=>p,now:()=>Date.parse(at)});
 await assert.rejects(reader(),/^Error: FX_UNAVAILABLE$/);assert.equal(closed,1);
});
