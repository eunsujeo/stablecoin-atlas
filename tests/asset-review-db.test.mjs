import {request} from 'node:http';
import test from 'node:test';import assert from 'node:assert/strict';
import {reviewedAssetSnapshot} from '../tools/asset-review-source.mjs';
import {sourceReviewProfiles,sourceFeaturesFor,sourceProfileKey} from '../web/source-review-data.js';
import {validateAssetReview} from '../web/asset-review-model.js';
import {reviewedAssetImport} from '../tools/market-db/asset-review.mjs';
import {assetReviewArguments,main} from '../tools/market-db/asset-review-cli.mjs';
import {databaseAssetReviewReader,assetReviewCacheTtlMs} from '../tools/market-db/asset-review-preview.mjs';
import {digest} from '../tools/market-db/plan.mjs';
import {startPreviewServer} from '../tools/ui-preview.mjs';
test('asset snapshot preserves all 26 identities and 179 source feature states with existing research limits',()=>{
 assert.equal(validateAssetReview(reviewedAssetSnapshot).profiles.length,26);assert.equal(reviewedAssetSnapshot.profiles.reduce((n,p)=>n+p.features.length,0),179);
 for(const original of sourceReviewProfiles){const p=reviewedAssetSnapshot.profiles.find(p=>p.id===original.id);assert.deepEqual(p,{...original,features:sourceFeaturesFor(original.coinId,sourceProfileKey(original))});}
 for(const mutate of [s=>s.profiles.pop(),s=>s.profiles.push(s.profiles[0]),s=>s.profiles[0].features[0].status='PASS',s=>s.profiles[0].features.pop(),s=>s.profiles[0].features[0].profileId='wrong',s=>s.profiles[0].rpcUrl='https://private',s=>s.profiles[0].functions=['.state/private'],s=>s.profiles[0].chainId=1,s=>s.reviewedAt='2026-02-30']){
  const s=structuredClone(reviewedAssetSnapshot);mutate(s);
  assert.throws(()=>validateAssetReview(s));
 }
 const b=Buffer.from(JSON.stringify(reviewedAssetSnapshot));assert.deepEqual(reviewedAssetImport(b,digest(b)),reviewedAssetSnapshot);
});
test('asset CLI rejects malformed imports before connecting and cache retains successful snapshots for one hour',async()=>{
 for(const args of [['grant','--role','postgres','--mode','admin'],['read','--source','x'],['import','--source','x'],['boundary','--reviewed-definers','x']])assert.throws(()=>assetReviewArguments(args));
 await assert.rejects(main(['import','--source','package.json','--expected-sha256','0'.repeat(64)]),/HASH_MISMATCH/);
 let clock=0,opens=0,closes=0,broken=false;
 const read=databaseAssetReviewReader({now:()=>clock,connect:async()=>{opens++;return {end:async()=>{closes++;}};},read:async()=>{if(broken)throw Error('private');return reviewedAssetSnapshot;}});
 await Promise.all([read(),read()]);assert.equal(opens,1);assert.equal(closes,1);assert.equal(assetReviewCacheTtlMs,3600000);
 clock=3599999;await read();assert.equal(opens,1);clock=3600000;broken=true;await assert.rejects(read(),/ASSET_REVIEW_UNAVAILABLE/);assert.equal(opens,2);broken=false;assert.deepEqual(await read(),reviewedAssetSnapshot);
});
test('asset API provides exact shared snapshot and sanitized failures with strict GET/HEAD and host boundaries',async()=>{
 let broken=false,calls=0;const server=await startPreviewServer(0,{assetReviewReader:async()=>{calls++;if(broken)throw Error('postgresql://private');return reviewedAssetSnapshot;}});const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const r=await fetch(base+'/asset-review-data.json');assert.equal(r.status,200);assert.deepEqual(await r.json(),reviewedAssetSnapshot);assert.equal(r.headers.get('cache-control'),'no-store');
  const head=await fetch(base+'/asset-review-data.json',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  for(const [path,options,status]of [['/asset-review-data.json?file=private',{},404],['/asset-review-data.json',{method:'POST'},405]])assert.equal((await fetch(base+path,options)).status,status);
  const denied=await new Promise((resolve,reject)=>{const q=request(base+'/asset-review-data.json',{headers:{host:'evil.example'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));});q.on('error',reject);q.end();});assert.equal(denied,403);
  assert.equal(calls,2);broken=true;const bad=await fetch(base+'/asset-review-data.json');assert.equal(bad.status,503);assert.equal(await bad.text(),'ASSET_REVIEW_UNAVAILABLE');
 }finally{await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});}
});
