import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,symlink,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canonical} from '../tools/market-db/plan.mjs';
import {providerCapabilityPlan,capabilityToken} from '../tools/provider-capability-plan.mjs';
import {priceHash,parsePriceBytes,reviewPriceSource,reviewPriceArchive,savePriceReview,priceByteLimit} from '../tools/provider-price-review.mjs';

const ids=['allium-price','allium-price-history','allium-price-stats'];
const timestamp='2026-10-22T00:00:00Z';
function sample(id){
 const prices={timestamp,price:1,open:1,high:1,close:1,low:1};
 const row={chain:'ethereum',decimals:6,[id==='allium-price'?'address':'mint']:capabilityToken};
 if(id==='allium-price-history')row.prices=[prices];
 else if(id==='allium-price')Object.assign(row,prices);
 else Object.assign(row,{timestamp,latest_price:1,low_24h:1,high_24h:1,low_1h:1,high_1h:1,percent_change_24h:-0.1,percent_change_1h:0});
 return {items:[row]};
}
const bytes=v=>Buffer.from(JSON.stringify(v));
const review=(id,v)=>{const b=Buffer.isBuffer(v)?v:bytes(v);return reviewPriceSource(id,b,priceHash(b));};
test('all three contracts retain numeric lexemes, original timestamps and explicit unknown meanings',()=>{
 for(const id of ids){
  const b=Buffer.from(JSON.stringify(sample(id)).replace('"decimals":6','"decimals":6').replace(/:1([,}])/g,':90071992547409931234.12345678901234567890$1'));
  const r=review(id,b);assert.equal(r.state,'FIELD_CONTRACT_OBSERVED');
  assert.equal(r.sourceHash,priceHash(b));assert.equal(r.observations.points[0].timestamp,timestamp);
  assert.equal(r.observations.points[0][id==='allium-price-stats'?'latest_price':'price'],'90071992547409931234.12345678901234567890');
  for(const key of ['currencyStatus','windowCompleteness','percentChangeUnit','windowDefinition'])assert.equal(r[key],'UNKNOWN');
 }
 const b=Buffer.from(JSON.stringify(sample(ids[0])).replace('"price":1','"price":1.2300e-999'));
 assert.equal(review(ids[0],b).observations.points[0].price,'1.2300e-999');
});
test('identity, decimals, missing/null/quoted numeric fields and error envelopes stay inconclusive',()=>{
 const mutations=[
  [x=>x.items[0].chain='solana','ASSET_IDENTITY_MISMATCH'],
  [x=>x.items[0].address='0x0000000000000000000000000000000000000000','ASSET_IDENTITY_MISMATCH'],
  [x=>x.items[0].decimals=18,'DECIMALS_MISMATCH'],[x=>x.items[0].decimals='6','DECIMALS_MISMATCH'],
  [x=>delete x.items[0].price,'NUMERIC_FIELD_MISSING'],[x=>x.items[0].price=null,'NUMERIC_FIELD_MISSING'],
  [x=>x.items[0].price='1','NUMERIC_FIELD_INVALID'],[x=>x.error='private provider detail','PROVIDER_ERROR_BODY'],
  [x=>x.errors=null,'PROVIDER_ERROR_BODY'],[x=>x.items=[],'ITEMS_EMPTY'],[x=>delete x.items,'ITEMS_MISSING'],
  [x=>x.items.push(x.items[0]),'ITEM_COUNT_UNEXPECTED'],[x=>x.cursor='next','PAGINATION_UNREVIEWED'],
 ];
 for(const [mutate,code]of mutations){const v=sample(ids[0]);mutate(v);const r=review(ids[0],v);assert.equal(r.state,'INCONCLUSIVE');assert.deepEqual(r.issues,[code]);assert.equal(r.observations,null);assert.ok(!JSON.stringify(r).includes('private provider detail'));}
 const b=bytes(sample(ids[0]));assert.deepEqual(reviewPriceSource(ids[0],b,'0'.repeat(64)).issues,['SOURCE_HASH_MISMATCH']);
 for(const id of [ids[1],ids[2]]){const v=sample(id);v.items[0].mint='wrong';assert.deepEqual(review(id,v).issues,['ASSET_IDENTITY_MISMATCH']);}
});
test('history checks every OHLC field, strict UTC, half-open request window and ordered unique points',()=>{
 for(const timestamp of ['2026-02-30T00:00:00Z','2026-10-22T00:00:00+00:00','2026-10-22','2026-10-22T25:00:00Z']){
  const v=sample(ids[1]);v.items[0].prices[0].timestamp=timestamp;assert.deepEqual(review(ids[1],v).issues,['TIMESTAMP_INVALID']);
 }
 for(const timestamp of ['2026-10-21T23:59:59Z','2026-10-22T00:05:00Z']){
  const v=sample(ids[1]);v.items[0].prices[0].timestamp=timestamp;assert.deepEqual(review(ids[1],v).issues,['HISTORY_TIME_RANGE_OR_ORDER_INVALID']);
 }
 for(const field of ['price','open','high','close','low']){const v=sample(ids[1]);delete v.items[0].prices[0][field];assert.deepEqual(review(ids[1],v).issues,['NUMERIC_FIELD_MISSING']);}
 const v=sample(ids[1]);v.items[0].prices.push({...v.items[0].prices[0]});assert.deepEqual(review(ids[1],v).issues,['HISTORY_TIME_RANGE_OR_ORDER_INVALID']);
 v.items[0].prices=[];assert.deepEqual(review(ids[1],v).issues,['PRICES_EMPTY']);
 const fractional=sample(ids[0]);fractional.items[0].timestamp='2026-10-22T00:00:00.01Z';assert.equal(review(ids[0],fractional).state,'FIELD_CONTRACT_OBSERVED');
});
test('strict JSON rejects duplicate/escaped keys, invalid UTF-8, oversized and deep input',()=>{
 for(const input of ['{"items":[],"items":[]}','{"items":[],"\\u0069tems":[]}'])assert.throws(()=>parsePriceBytes(Buffer.from(input)),/SOURCE_DUPLICATE_KEY/);
 for(const input of ['[1,]','{"a":1,}','{"a":01}','{} true','"bad\nstring"'])assert.throws(()=>parsePriceBytes(Buffer.from(input)),/SOURCE_JSON_INVALID/);
 assert.throws(()=>parsePriceBytes(Buffer.from([0xff])),/SOURCE_UTF8_INVALID/);
 assert.throws(()=>parsePriceBytes(Buffer.alloc(priceByteLimit+1)),/SOURCE_SIZE_INVALID/);
 assert.throws(()=>parsePriceBytes(Buffer.from('['.repeat(34)+'0'+']'.repeat(34))),/SOURCE_DEPTH_INVALID/);
});
async function fixture(t){
 const root=await mkdtemp(join(await realpath(tmpdir()),'atlas-price-review-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const archive=join(root,'archive');await mkdir(archive,{mode:0o700});const plan=providerCapabilityPlan();
 const jobs=ids.map(id=>({id,provider:'allium',type:'rest',state:'HTTP_200_JSON',httpStatus:200}));
 const attempts=[];
 for(const [index,id]of ids.entries()){
  const job=plan.jobs.find(j=>j.id===id),b=bytes(sample(id));await writeFile(join(archive,`response-${index}.json`),b,{mode:0o600});
  attempts.push({index,jobId:id,provider:'allium',step:'read',at:timestamp,method:job.method,path:job.path,bodyHash:priceHash(Buffer.from(canonical(job.body))),httpStatus:200,responseHash:priceHash(b),responseBytes:b.length});
 }
 const receipt={version:1,kind:'PROVIDER_CAPABILITY_RECEIPT',planHash:priceHash(Buffer.from(canonical(plan))),jobs,attempts};
 const save=async()=>{const b=bytes(receipt);await writeFile(join(archive,'receipt.json'),b,{mode:0o600});return priceHash(b);};
 return {root,archive,receipt,save,hash:await save()};
}
test('archive binds receipt, exact request and source bytes; writes private exclusive report without changing evidence',async t=>{
 const f=await fixture(t),before=await readFile(join(f.archive,'receipt.json'));
 const report=await reviewPriceArchive(f.archive,f.hash);assert.equal(report.rows.length,3);assert.ok(report.rows.every(r=>r.state==='FIELD_CONTRACT_OBSERVED'&&r.recordedRequestAt===timestamp&&r.receiptHash===f.hash));
 const out=join(f.root,'review');await savePriceReview(out,'fixture.json',report);
 assert.equal((await stat(join(out,'fixture.json'))).mode&0o777,0o600);assert.equal((await stat(out)).mode&0o777,0o700);
 assert.deepEqual(JSON.parse(await readFile(join(out,'fixture.json'),'utf8')),report);
 await assert.rejects(savePriceReview(out,'fixture.json',report));await assert.rejects(savePriceReview(out,'../escape.json',report));
 assert.deepEqual(await readFile(join(f.archive,'receipt.json')),before);
 await assert.rejects(reviewPriceArchive(f.archive,'0'.repeat(64)),/RECEIPT_HASH_MISMATCH/);
 await writeFile(join(f.archive,'response-0.json'),'{}');await assert.rejects(reviewPriceArchive(f.archive,f.hash),/RECEIPT_BYTE_COUNT_MISMATCH/);
});
test('same-length source tampering, changed request, failed/truncated receipt and symlink never produce observed data',async t=>{
 const f=await fixture(t),p=join(f.archive,'response-0.json'),b=await readFile(p);
 await writeFile(p,b.toString().replace('ethereum','ethereux'));let r=await reviewPriceArchive(f.archive,f.hash);assert.deepEqual(r.rows[0].issues,['SOURCE_HASH_MISMATCH']);
 await writeFile(p,b);
 const original=structuredClone(f.receipt);
 for(const mutate of [r=>r.attempts[0].bodyHash='0'.repeat(64),r=>r.attempts[0].path='other',r=>r.attempts[0].httpStatus=500,r=>r.attempts[0].responseTruncated=true,r=>r.jobs[0].state='UNKNOWN',r=>r.attempts.push({...r.attempts[0]}),r=>r.planHash='0'.repeat(64)]){
  Object.assign(f.receipt,structuredClone(original));mutate(f.receipt);await assert.rejects(reviewPriceArchive(f.archive,await f.save()),/RECEIPT_(JOB_)?INVALID/);
 }
 Object.assign(f.receipt,original);const hash=await f.save();await rm(p);await symlink(join(f.archive,'response-1.json'),p);await assert.rejects(reviewPriceArchive(f.archive,hash));
});
