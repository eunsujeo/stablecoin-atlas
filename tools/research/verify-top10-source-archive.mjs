// Offline verification only. Never sends a request or executes acquired source.
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {registrationHash} from '../market-registration/planner.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const d=await json('data/source-review-top10-results.json');
let requests=0,bytes=0;
for(const run of d.runs){
 const {planSha256,...plan}=await json(run.plan);
 assert.equal(registrationHash(plan),planSha256);
 assert.equal(planSha256,run.planSha256);
 const original=await json(run.slot+'/result.json');
 assert.equal(original.planSha256,planSha256);
 assert.equal(original.attempts,run.attempts);
 assert.equal(original.state,run.state);
 assert.equal(original.bytes,run.bytes);
 assert.equal(original.completedAt,run.completedAt);
 requests+=run.attempts;bytes+=run.bytes;
 const entries=d.artifacts.filter(a=>a.id.startsWith(run.id+':'));
 assert.equal(entries.length,run.attempts);
 for(const a of entries){
  const path=resolve(root,a.localPath);
  assert.ok(path.startsWith(resolve(root,run.slot)+sep));
  const raw=await readFile(path),receipt=await json(a.localPath.replace(/-response\.bin$/,'-receipt.json'));
  assert.equal(sha(raw),a.sha256);
  assert.equal(receipt.sourceHash,a.sha256);
  assert.equal(receipt.state,a.state);
  assert.equal(receipt.status,a.httpStatus);
  assert.equal(raw.length,a.bytes);
  if(a.units){
   const acquired=JSON.parse(raw);
   assert.equal(Object.keys(acquired.sources).length,a.units.length);
   for(const unit of a.units){
    const entry=Object.entries(acquired.sources).find(([key])=>sha(key)===unit.sourceUnitHash);
    assert.ok(entry);assert.equal(sha(entry[1].content),unit.contentSha256);
   }
  }
 }
}
assert.equal(requests,d.externalRequests);assert.equal(bytes,d.receivedBytes);
const selected=await json('data/source-review-top10-candidates.json');
const additional=new Set(selected.coins.flatMap(c=>c.selected.filter(n=>n.sourceReviewScope!=='EXISTING_SELECTED_SOURCE').map(n=>c.coinId+'-'+n.networkId)));
assert.equal(additional.size,18);assert.equal(d.cases.length,18);
assert.deepEqual(new Set(d.cases.map(c=>c.id)),additional);
for(const c of d.cases){
 assert.equal(c.productVerdictChanged,false);
 for(const id of c.evidenceIds)assert.ok(d.artifacts.some(a=>a.id===id));
}
console.log(JSON.stringify({state:'PASS',cases:d.cases.length,rawHashes:d.artifacts.length,requests,bytes,newRequests:0}));
