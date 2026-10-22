import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,chmod,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {parseCollectorArguments,processScheduledJob} from '../tools/collector-worker.mjs';import {receiptStore,validateReceipt} from '../tools/periodic-jobs.mjs';
const slot='2026-10-22T06:00:00.000Z',reservation={job:'ARKHAM',slot,state:'CLAIMED'};
const proof={sourceName:'12345678-1234-1234-1234-123456789012.json',sourceHash:'a'.repeat(64)};
test('worker arguments have explicit finite daily credit budgets, disable switch and no interval/retry/URL overrides',()=>{
 assert.equal(parseCollectorArguments(['run']).arkhamRunsPerDay,12);assert.equal(parseCollectorArguments(['run','--once','--arkham-runs-per-day','0']).once,true);assert.equal(parseCollectorArguments(['run','--arkham-runs-per-day','288']).arkhamRunsPerDay,288);
 for(const args of [['run','--arkham-runs-per-day','289'],['run','--arkham-runs-per-day','-1'],['run','--once','--once'],['run','--interval','1'],['run','--url','https://example.com'],['status','--once']])assert.throws(()=>parseCollectorArguments(args));
});
test('durable receipts are private, immutable and scoped; invalid paths, wrong jobs and changed contents fail before recovery',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-receipt-'));try{const store=await receiptStore(root);assert.equal(await store.read('ARKHAM',slot),null);await store.save('ARKHAM',slot,proof);await store.save('ARKHAM',slot,proof);assert.deepEqual((await store.read('ARKHAM',slot)).payload,proof);await assert.rejects(store.save('ARKHAM',slot,{...proof,sourceHash:'b'.repeat(64)}));assert.throws(()=>validateReceipt({schemaVersion:1,job:'ARKHAM',slot,payload:{...proof,sourceName:'../'+proof.sourceName}},'ARKHAM',slot));assert.throws(()=>validateReceipt({schemaVersion:1,job:'ARKHAM',slot,payload:proof},'DEFILLAMA',slot));await chmod(root,0o755);await assert.rejects(receiptStore(root));}finally{await rm(root,{recursive:true,force:true});}
});
test('reservation replay, persisted-source recovery and response loss never repeat provider collection',async()=>{
 let collected=0,resumed=0,receipt=null,stored=0;const receipts={read:async()=>receipt},jobs={ARKHAM:{collect:async()=>{collected++;receipt={schemaVersion:1,job:'ARKHAM',slot,payload:proof};return {state:'SUCCESS'};},resume:async()=>{resumed++;return {state:'SUCCESS'};}}},finish=async()=>{stored++;};
 assert.equal((await processScheduledJob({reservation,jobs,receipts,finish})).state,'STORED');assert.equal(collected,1);assert.equal(stored,1);
 for(const state of ['ALREADY_RESERVED','BUDGET_EXHAUSTED'])await processScheduledJob({reservation:{...reservation,state},jobs,receipts,finish});assert.equal(collected,1);assert.equal(resumed,0);
 assert.equal((await processScheduledJob({reservation:{...reservation,state:'RECOVER'},jobs,receipts,finish})).state,'STORED');assert.equal(collected,1);assert.equal(resumed,1);
 const uncertain=await processScheduledJob({reservation:{...reservation,state:'RECOVER'},jobs,receipts,finish:async()=>{throw Error('private database details');}});assert.equal(uncertain.state,'UNCONFIRMED');assert.equal(collected,1);assert.equal(uncertain.errorCode,'DATABASE_COMMAND_FAILED');
});
test('missing crash receipts and provider failures consume their reservation without retrying; abort preserves recoverable sources',async()=>{
 let collected=0,finished;const jobs={ARKHAM:{collect:async()=>{collected++;return {state:'FAILED'};},resume:async()=>{throw Error('must not recover');}}},receipts={read:async()=>null},finish=async(...args)=>{finished=args;};
 const missing=await processScheduledJob({reservation:{...reservation,state:'RECOVER'},jobs,receipts,finish});assert.equal(missing.state,'UNCONFIRMED');assert.equal(missing.recoverable,false);assert.equal(collected,0);assert.equal(finished[2],'UNCONFIRMED');
 assert.equal((await processScheduledJob({reservation,jobs,receipts,finish})).state,'FAILED');assert.equal(collected,1);assert.equal(finished[2],'FAILED');
 const control=new AbortController();control.abort();assert.equal((await processScheduledJob({reservation,jobs,receipts,finish,signal:control.signal})).state,'STOPPED');assert.equal(collected,1);
});
