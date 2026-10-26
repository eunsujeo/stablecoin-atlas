import test from 'node:test';import assert from 'node:assert/strict';
import {reviewedContractStore} from '../web/contract-review-reviewed.js';
import {validateContractReviewStore} from '../web/contract-review-model.js';
import {reviewedImport} from '../tools/market-db/contract-review.mjs';
import {contractReviewArguments,main} from '../tools/market-db/contract-review-cli.mjs';
import {databaseContractReviewReader,contractReviewCacheTtlMs} from '../tools/market-db/contract-review-preview.mjs';
import {digest} from '../tools/market-db/plan.mjs';

test('reviewed contract store keeps artifact PASS separate from overall UNKNOWN and rejects private or malformed input',()=>{
 assert.equal(validateContractReviewStore(reviewedContractStore).reports.length,2);
 assert.equal(reviewedContractStore.reports[0].runtime.equality,'PASS');assert.equal(reviewedContractStore.reports[0].status,'UNKNOWN');assert.equal(reviewedContractStore.reports[1].runtime,undefined);
 for(const mutate of [s=>s.reports[0].status='PASS',s=>s.reports[0].runtime.proxy='PASS',s=>s.reports[0].runtime.blockNumber=26275729,s=>s.reports[0].runtime.codeBytes=0,s=>s.reports[0].observedAt='invalid',s=>s.reports[0].snapshot={},s=>s.reports.push(s.reports[0]),s=>s.reports[0].purpose='https://rpc.example/v3/secret',s=>s.reports[0].source='../private.json',s=>s.reports[0].sections[0].notes=['.state/private'],s=>s.reports[0].sections[0].notes=['RPC_URL']]){
  const s=structuredClone(reviewedContractStore);mutate(s);assert.throws(()=>validateContractReviewStore(s));
 }
 const b=Buffer.from(JSON.stringify(reviewedContractStore));assert.deepEqual(reviewedImport(b,digest(b)),reviewedContractStore);assert.throws(()=>reviewedImport(b,'0'.repeat(64)));
});
test('contract DB CLI rejects ambiguous commands and unpinned imports before connecting',async()=>{
 for(const args of [['grant','--role','postgres','--mode','admin'],['read','--source','x'],['import','--source','x'],['read','--env-file','x','--env-file','y'],['boundary','--reviewed-definers','x']])assert.throws(()=>contractReviewArguments(args));
 await assert.rejects(main(['import','--source','package.json','--expected-sha256','0'.repeat(64),'--env-file','/missing']),/INPUT_HASH_MISMATCH/);
});
test('contract DB reader coalesces sessions, expires cache and surfaces failures without static fallback',async()=>{
 let clock=0,opens=0,closes=0,fail=false;
 const read=databaseContractReviewReader({now:()=>clock,connect:async()=>{opens++;return {end:async()=>{closes++;}};},read:async()=>{if(fail)throw Error('sensitive');return reviewedContractStore;}});
 await Promise.all([read(),read()]);assert.equal(opens,1);assert.equal(closes,1);await read();assert.equal(opens,1);
 assert.equal(contractReviewCacheTtlMs,3600000);clock=3599999;await read();assert.equal(opens,1);
 clock=3600000;fail=true;await assert.rejects(read(),/CONTRACT_REVIEW_UNAVAILABLE/);assert.equal(opens,2);assert.equal(closes,2);
 fail=false;assert.deepEqual(await read(),reviewedContractStore);
});
