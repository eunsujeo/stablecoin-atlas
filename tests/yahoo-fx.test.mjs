import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseYahooFX,collectYahooFX,storedYahooInputs,publishYahooFX,readYahooFX,yahooByteLimit} from '../tools/yahoo-fx-store.mjs';
import {referenceFXReader,optionalFXStatus} from '../tools/reference-fx-reader.mjs';
import {availableFX,usableFX,priceLabel,fxDisplayNote} from '../web/fx-model.js';
const at='2026-11-07T00:00:00.000Z',now=Date.parse(at);
const raw=(price='1363.650000000000000001',timestamp='1794002398',symbol='USDKRW=X')=>Buffer.from(`{"chart":{"error":null,"result":[{"meta":{"symbol":"${symbol}","currency":"KRW","instrumentType":"CURRENCY","regularMarketTime":${timestamp},"regularMarketPrice":${price}}}]}}`);
test('Yahoo preserves decimal tokens and market time; refuses future, incorrect pair, duplicate and invalid values',()=>{
 const p=parseYahooFX(raw(),{at});assert.equal(p.krwPerUSD,'1363.650000000000000001');assert.equal(p.date,'2026-11-06');assert.equal(p.fetchedAt,at);
 assert(availableFX(p,now));assert(usableFX(p,now));assert.equal(priceLabel('1','KRW',p,now),'₩1,363.65');
 for(const b of [raw('0'),raw('-1'),raw('1','1794096000'),raw('1','1794002398','JPY=X'),Buffer.from('{"chart":null,"chart":null}'),Buffer.alloc(yahooByteLimit+1)])assert.throws(()=>parseYahooFX(b,{at}));
 assert.equal(parseYahooFX(raw('1363.65','1794002398','KRW=X'),{at}).symbol,'USDKRW=X');
 const later=now+10*86400000;assert(!usableFX(p,later));assert(availableFX(p,later));assert.match(fxDisplayNote(p,later),/갱신 지연.*마지막 정상/);assert.equal(priceLabel('1','KRW',p,later),'₩1,363.65');assert.equal(priceLabel('1','KRW',null,now),'$1');assert.match(fxDisplayNote(null,now),/달러/);
});
test('daily Yahoo evidence is immutable, failed future data preserves last good; no retries or web network fetch',async t=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-yahoo-'));t.after(()=>rm(root,{recursive:true,force:true}));
 let sends=0;const fetcher=async(url,o)=>{sends++;assert.equal(o.redirect,'error');assert(o.signal);return new Response(raw());};
 await collectYahooFX({directoryPath:root,at,fetcher});assert.equal(sends,1);
 const p=(await storedYahooInputs(root))[0].payload;const publicFile=join(root,'public.json');await publishYahooFX(root,publicFile);const before=await readFile(publicFile);
 await assert.rejects(collectYahooFX({directoryPath:root,at,fetcher}),/DAY_CONSUMED/);assert.equal(sends,1);
 await assert.rejects(collectYahooFX({directoryPath:root,at:'2026-11-08T00:00:00.000Z',fetcher:async()=>{sends++;return new Response(raw('1360','1794182400'));}}));assert.equal(sends,2);assert.deepEqual(await readFile(publicFile),before);
 assert.equal((await storedYahooInputs(root)).length,1);assert.equal((await readYahooFX(publicFile,{now})).date,p.date);
 let fallback=0;const reader=referenceFXReader({file:publicFile,read:f=>readYahooFX(f,{now}),legacy:async()=>{fallback++;return p;}});assert.deepEqual(await reader(),p);assert.equal(fallback,0);
 await writeFile(publicFile,'broken');assert.deepEqual(await reader(),p);assert.equal(fallback,1);
 const unavailable=await optionalFXStatus(async()=>{throw Error('FX_UNAVAILABLE');});assert.equal(unavailable.impact,'KRW_ONLY');await assert.rejects(optionalFXStatus(async()=>{throw Error('DB_PERMISSION');}),/DB_PERMISSION/);
});
test('oversized, aborted and HTTP failure bodies consume once and never publish; symlink roots rejected',async t=>{
 for(const mode of ['size','abort','http']){
  const root=await mkdtemp(join(tmpdir(),'atlas-yahoo-fail-'));t.after(()=>rm(root,{recursive:true,force:true}));let sends=0;
  await assert.rejects(collectYahooFX({directoryPath:root,at,fetcher:async()=>{sends++;if(mode==='abort')throw new DOMException('Cancelled','AbortError');return new Response(mode==='size'?Buffer.alloc(yahooByteLimit+1):'denied',{status:mode==='http'?429:200});}}));
  assert.equal(sends,1);assert.equal(JSON.parse(await readFile(join(root,'failures','2026-11-07.json'))).state,'FAILED');await assert.rejects(storedYahooInputs(root));
 }
 const parent=await mkdtemp(join(tmpdir(),'atlas-yahoo-link-'));t.after(()=>rm(parent,{recursive:true,force:true}));await mkdir(join(parent,'real'));await symlink(join(parent,'real'),join(parent,'link'));
 await assert.rejects(collectYahooFX({directoryPath:join(parent,'link'),at,fetcher:()=>assert.fail('must not fetch')}));
});
test('body interruption and timeout preserve a consumed day without a snapshot',async t=>{
 for(const code of ['AbortError','TimeoutError']){
  const root=await mkdtemp(join(tmpdir(),'atlas-yahoo-body-'));t.after(()=>rm(root,{recursive:true,force:true}));let sends=0;
  const fetcher=async()=>{sends++;return {status:200,body:(async function*(){yield Buffer.from('{"chart":');throw new DOMException('interrupted',code);})()};};
  await assert.rejects(collectYahooFX({directoryPath:root,at,fetcher}));
  await assert.rejects(collectYahooFX({directoryPath:root,at,fetcher}),/DAY_CONSUMED/);assert.equal(sends,1);
  assert.equal(JSON.parse(await readFile(join(root,'failures','2026-11-07.json'))).bytes,9);await assert.rejects(storedYahooInputs(root));
 }
});
