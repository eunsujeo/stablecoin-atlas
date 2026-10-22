import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {registeredCollectorArguments,processRegisteredCoin} from '../tools/registered-collector.mjs';
import {receiptStore} from '../tools/periodic-jobs.mjs';
import {fetchRegisteredHistorySource,hashHistory} from '../tools/supply-history-source.mjs';
import {archiveCompressedSources} from '../tools/history-archive.mjs';
import {parseCollectorArguments} from '../tools/collector-worker.mjs';
const selectionId='a'.repeat(64),metadata_id='b'.repeat(64),day='2026-10-22',slot=day+'T00:00:00.000Z';
const reservation={coinId:'jpyc',selectionId,day,slot,job:'REGISTERED_JPYC',state:'CLAIMED'};
test('registered worker pins explicit selection, daily scope and fixed provider endpoints with no retries',async()=>{
 assert.equal(registeredCollectorArguments(['run','--selection',selectionId,'--once']).once,true);
 assert.equal(parseCollectorArguments(['run','--skip-daily-history']).skipDailyHistory,true);
 for(const args of [['run'],['run','--selection',selectionId,'--interval','1'],['run','--selection',selectionId,'--url','https://private.test'],['run','--selection',selectionId,'--once','--once']])assert.throws(()=>registeredCollectorArguments(args));
 let calls=0;const urls=[];for(const coin of ['usdt','usdc','rlusd','jpyc','jpysc'])await fetchRegisteredHistorySource(coin,async(url,options)=>{calls++;urls.push(url);assert.equal(options.redirect,'error');assert(options.signal);return new Response('{}');});
 assert.equal(calls,5);assert.deepEqual(urls.map(u=>u.split('/').at(-1)),['1','2','250','355','427']);
 await assert.rejects(fetchRegisteredHistorySource('constructor',()=>assert.fail('must not fetch')));
 await assert.rejects(fetchRegisteredHistorySource('jpyc',async()=>{calls++;return new Response('',{status:404});}),/HISTORY_HTTP_FAILED/);assert.equal(calls,6);
});
test('coin receipts bind metadata/selection; import response loss recovers without GET and preserves request time',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-registered-'));try{
  const receipts=await receiptStore(join(root,'receipts'));let requests=0,imports=0,finished=0;
  const common={reservation,context:{metadata_id},receipts,archiveRoot:root,request:async()=>{requests++;return Buffer.from('{}');},stamp:async()=>slot,guard:async()=>{},importRegistered:async input=>{assert.equal(input.fetchedAt,slot);imports++;if(imports===1)throw Error('COMMIT receipt lost');return {state:'IMPORTED',valuesInserted:0};},importLegacy:()=>assert.fail('JPY is not legacy'),finish:async()=>{finished++;}};
  assert.equal((await processRegisteredCoin(common)).state,'UNCONFIRMED');assert.equal(finished,0);
  assert.equal((await processRegisteredCoin({...common,reservation:{...reservation,state:'RECOVER'}})).state,'STORED');assert.equal(requests,1);assert.equal(imports,2);assert.equal(finished,1);
  const wrong=await processRegisteredCoin({...common,context:{metadata_id:'c'.repeat(64)},reservation:{...reservation,state:'RECOVER'}});assert.equal(wrong.errorCode,'REGISTRATION_DB_CONTENT_CONFLICT');assert.equal(imports,2);assert.equal(requests,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('missing receipts and day/session guard failures never fetch; isolated HTTP failure consumes only its coin',async()=>{
 let requests=0;const finishes=[];const common={reservation,context:{metadata_id},receipts:{read:async()=>null},archiveRoot:'unused',request:async()=>{requests++;throw Error('HISTORY_HTTP_FAILED');},guard:async()=>{},finish:async(...args)=>finishes.push(args)};
 const missing=await processRegisteredCoin({...common,reservation:{...reservation,state:'RECOVER'}});assert.equal(missing.errorCode,'SOURCE_RECEIPT_MISSING');assert.equal(requests,0);
 for(const code of ['SCHEDULER_DAY_CHANGED','SCHEDULER_SESSION_CHANGED']){const r=await processRegisteredCoin({...common,guard:async()=>{throw Error(code);}});assert.equal(r.errorCode,code);assert.equal(requests,0);}
 const failed=await processRegisteredCoin(common);assert.equal(failed.state,'FAILED');assert.equal(requests,1);assert.equal(finishes.length,4);
});

test('cutover reuses legacy raw receipt and recovers a later legacy/finish commit loss with no new request',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-cutover-'));try{
  const receipts=await receiptStore(join(root,'receipts')),legacy=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url)));
  const raw=Buffer.from(JSON.stringify({id:'1',symbol:'USDT',gecko_id:'tether',pegType:'peggedUSD',chainBalances:{Ethereum:{tokens:[{date:Date.parse(day)/1000,circulating:{peggedUSD:'10'},minted:{peggedUSD:'20'}}]}}}));
  const sourceHash=hashHistory(raw);await archiveCompressedSources([{hash:sourceHash,bytes:raw}],join(root,'history'));
  await receipts.save('DEFILLAMA',slot,['usdt','usdc','rlusd'].map(coinId=>({coinId,sourceHash,fetchedAt:slot})));
  const r={...reservation,coinId:'usdt',job:'REGISTERED_USDT'};let imported=0,legacyCalls=0,finished=0;
  const common={reservation:r,context:{metadata_id,legacy},receipts,archiveRoot:root,request:()=>assert.fail('must reuse raw'),stamp:()=>assert.fail('must keep original time'),guard:async()=>{},importRegistered:async input=>{imported++;assert.equal(input.fetchedAt,slot);return {valuesInserted:0};},importLegacy:async()=>{legacyCalls++;if(legacyCalls===1)throw Error('legacy COMMIT response lost');},finish:async()=>{finished++;if(finished===1)throw Error('finish COMMIT response lost');}};
  assert.equal((await processRegisteredCoin(common)).state,'UNCONFIRMED');
  assert.equal((await processRegisteredCoin({...common,reservation:{...r,state:'RECOVER'}})).state,'UNCONFIRMED');
  assert.equal((await processRegisteredCoin({...common,reservation:{...r,state:'RECOVER'}})).state,'STORED');
  assert.equal(imported,3);assert.equal(legacyCalls,3);assert.equal(finished,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
