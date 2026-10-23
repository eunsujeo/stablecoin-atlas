import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm,realpath,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canonical} from '../tools/market-db/plan.mjs';
import {providerCapabilityPlan} from '../tools/provider-capability-plan.mjs';
import {priceHash,savePriceReview} from '../tools/provider-price-review.mjs';
import {arkhamPriceIds,marketFields,reviewArkhamPriceSource,reviewArkhamPriceArchive} from '../tools/arkham-price-review.mjs';
const timestamp='2026-10-22T00:00:00Z';
const history=()=>[{time:timestamp,usd:1,volume24h:0,marketCap:1}];
const market=()=>Object.fromEntries(marketFields.map(key=>[key,1]));
const bytes=v=>Buffer.from(JSON.stringify(v));
function review(id,value){const b=Buffer.isBuffer(value)?value:bytes(value);return reviewArkhamPriceSource(id,b,priceHash(b));}
test('market keeps all numeric lexemes and whole-coin supply categories without inventing source time or identity',()=>{
 const b=Buffer.from(JSON.stringify(market()).replace('"circulatingSupply":1','"circulatingSupply":90071992547409931234.12345678901234567890').replace('"totalSupply":1','"totalSupply":1.2300e99'));
 const r=review(arkhamPriceIds[0],b);assert.equal(r.state,'FIELD_CONTRACT_OBSERVED');
 assert.equal(r.observations.fields.circulatingSupply,'90071992547409931234.12345678901234567890');
 assert.equal(r.observations.fields.totalSupply,'1.2300e99');assert.equal(r.observations.supplyScope,'WHOLE_COIN_NOT_CHAIN');
 assert.equal(r.chainSupply,'NOT_OBSERVED');assert.equal(r.observations.sourceTimestamp,null);assert.equal(r.marketAsOf,'UNKNOWN');
 for(const k of ['currencyStatus','responseAssetIdentity','providerDefinitions','historyCompleteness'])assert.equal(r[k],'UNKNOWN');
 assert.equal(r.identityBasis,'PINNED_REQUEST_PATH_ONLY');
});
test('history keeps original UTC timestamps, exact amounts, observed endpoints and unspecified request window',()=>{
 const v=history();v.push({...v[0],time:'2026-10-24T00:00:00.01Z'});
 const b=Buffer.from(JSON.stringify(v).replace('"usd":1','"usd":1.000000000000000000000000000001'));
 const r=review(arkhamPriceIds[1],b);assert.equal(r.state,'FIELD_CONTRACT_OBSERVED');
 assert.equal(r.observations.points[0].usd,'1.000000000000000000000000000001');
 assert.equal(r.observations.points[0].volume24h,'0');assert.equal(r.observations.points[0].time,timestamp);
 assert.equal(r.observations.observedWindow.last,v[1].time);assert.equal(r.observations.requestedWindow,null);
 assert.equal(r.observations.currencyFieldLabel,'usd');assert.equal(r.currencyStatus,'UNKNOWN');assert.equal(r.historyCompleteness,'UNKNOWN');
});
test('every required field rejects missing/null/quoted amounts and preserves inconclusive observations',()=>{
 for(const [id,sample,keys] of [[arkhamPriceIds[0],market,marketFields],[arkhamPriceIds[1],history,['usd','volume24h','marketCap']]]){
  for(const key of keys)for(const value of [undefined,null,'1']){
   const v=sample(),row=Array.isArray(v)?v[0]:v;row[key]=value;
   const r=review(id,v);assert.equal(r.state,'INCONCLUSIVE');assert.equal(r.observations,null);
   assert.deepEqual(r.issues,[value==='1'?'NUMERIC_FIELD_INVALID':'NUMERIC_FIELD_MISSING']);
  }
 }
});
test('invalid/duplicate/reversed UTC, empty history, error body and tampering do not become observations',()=>{
 for(const time of ['2026-02-30T00:00:00Z','2026-10-22','2026-10-22T00:00:00+00:00',null]){
  const v=history();v[0].time=time;assert.deepEqual(review(arkhamPriceIds[1],v).issues,['TIMESTAMP_INVALID']);
 }
 for(const time of [timestamp,'2026-10-21T00:00:00Z']){
  const v=history();v.push({...v[0],time});assert.deepEqual(review(arkhamPriceIds[1],v).issues,['HISTORY_TIME_ORDER_INVALID']);
 }
 assert.deepEqual(review(arkhamPriceIds[1],[]).issues,['HISTORY_EMPTY']);
 assert.deepEqual(review(arkhamPriceIds[1],{}).issues,['HISTORY_ARRAY_MISSING']);
 for(const id of arkhamPriceIds){assert.deepEqual(review(id,{error:'private detail'}).issues,['PROVIDER_ERROR_BODY']);
  assert.deepEqual(reviewArkhamPriceSource(id,bytes(market()),'0'.repeat(64)).issues,['SOURCE_HASH_MISMATCH']);}
 assert.deepEqual(review(arkhamPriceIds[0],Buffer.from('{"price":1,"price":2}')).issues,['SOURCE_DUPLICATE_KEY']);
});
async function fixture(t){
 const root=await mkdtemp(join(await realpath(tmpdir()),'arkham-price-review-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const archive=join(root,'archive');await mkdir(archive,{mode:0o700});const plan=providerCapabilityPlan();
 const jobs=[],attempts=[];
 for(const [index,id]of arkhamPriceIds.entries()){
  const job=plan.jobs.find(j=>j.id===id),b=bytes(index===0?market():history());
  await writeFile(join(archive,`response-${index}.json`),b,{mode:0o600});
  jobs.push({id,provider:'arkham',type:'rest',state:'HTTP_200_JSON',httpStatus:200});
  attempts.push({index,jobId:id,provider:'arkham',step:'read',method:'GET',path:job.path,bodyHash:null,at:timestamp,httpStatus:200,responseHash:priceHash(b),responseBytes:b.length});
 }
 // No unrelated response file exists: only the selected pair may be read.
 jobs.push({id:'allium-price',state:'UNKNOWN'});
 const receipt={version:1,kind:'PROVIDER_CAPABILITY_RECEIPT',planHash:priceHash(Buffer.from(canonical(plan))),jobs,attempts};
 const save=async()=>{const b=bytes(receipt);await writeFile(join(archive,'receipt.json'),b,{mode:0o600});return priceHash(b);};
 return {root,archive,receipt,save,hash:await save()};
}
test('archive binds the exact GET pair, receipt and bytes and writes a private exclusive report',async t=>{
 const f=await fixture(t),before=await readFile(join(f.archive,'receipt.json'));
 const report=await reviewArkhamPriceArchive(f.archive,f.hash);assert.equal(report.kind,'OFFLINE_ARKHAM_PRICE_REVIEW');
 assert.equal(report.costStatus,'UNCONFIRMED');assert.equal(report.rows.length,2);
 assert.ok(report.rows.every(r=>r.state==='FIELD_CONTRACT_OBSERVED'&&r.recordedRequestAt===timestamp&&r.receiptHash===f.hash));
 const out=join(f.root,'out');await savePriceReview(out,'report.json',report);
 assert.equal((await stat(join(out,'report.json'))).mode&0o777,0o600);assert.equal((await stat(out)).mode&0o777,0o700);
 assert.deepEqual(JSON.parse(await readFile(join(out,'report.json'),'utf8')),report);await assert.rejects(savePriceReview(out,'report.json',report));
 assert.deepEqual(await readFile(join(f.archive,'receipt.json')),before);
 await assert.rejects(reviewArkhamPriceArchive(f.archive,'0'.repeat(64)),/RECEIPT_HASH_MISMATCH/);
});
test('changed provider/path/body, duplicate attempt, truncation, source tampering and symlinks are rejected',async t=>{
 const f=await fixture(t),original=structuredClone(f.receipt);
 for(const mutate of [r=>r.attempts[0].provider='allium',r=>r.attempts[0].path='/other',r=>r.attempts[0].bodyHash=priceHash(Buffer.from('null')),r=>r.attempts[0].responseTruncated=true,r=>r.jobs[0].state='UNKNOWN',r=>r.attempts.push({...r.attempts[0]})]){
  Object.assign(f.receipt,structuredClone(original));mutate(f.receipt);
  await assert.rejects(reviewArkhamPriceArchive(f.archive,await f.save()),/RECEIPT_JOB_INVALID/);
 }
 Object.assign(f.receipt,original);const hash=await f.save(),p=join(f.archive,'response-0.json'),b=await readFile(p);
 await writeFile(p,b.toString().replace('"price":1','"price":2'));
 assert.deepEqual((await reviewArkhamPriceArchive(f.archive,hash)).rows[0].issues,['SOURCE_HASH_MISMATCH']);
 await writeFile(p,'{}');await assert.rejects(reviewArkhamPriceArchive(f.archive,hash),/RECEIPT_BYTE_COUNT_MISMATCH/);
 await rm(p);await symlink(join(f.archive,'response-1.json'),p);await assert.rejects(reviewArkhamPriceArchive(f.archive,hash));
});
