import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,access,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {probe,slot} from '../tools/arkham-usage-probe.mjs';
const planBytes=await readFile(new URL('../data/arkham-usage-probe-plan.json',import.meta.url));
async function fixture(t){const root=await realpath(await mkdtemp(join(tmpdir(),'atlas-arkham-probe-')));t.after(()=>rm(root,{recursive:true,force:true}));return {root,planBytes,key:'fixture-key',approvalBytes:Buffer.from('fixture approval'),sleep:async()=>{},clock:()=>0};}
test('two fixed GETs, raw decimal precision, prior preservation and permanent consumption',async t=>{
 const o=await fixture(t);await writeFile(join(o.root,'prior.json'),'{}',{mode:0o600});const urls=[],delays=[];
 const r=await probe({...o,sleep:async ms=>delays.push(ms),fetcher:async(url,opts)=>{urls.push(url);assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');assert(opts.signal);return new Response(urls.length===1?'[{"count":9007199254740993,"usd":1.234567890123456789}]':'{"swaps":[],"count":0}');}});
 assert.deepEqual(delays,[1000]);assert.equal(r.state,'COMPLETE');assert.equal(r.attempts.length,2);assert(r.previousPreserved);assert.equal(urls[0],'https://api.arkm.com/transfers/histogram?base=all&chains=ethereum&granularity=1d&timeGte=2026-10-22T00%3A00%3A00Z&timeLte=2026-10-22T23%3A59%3A59Z&tokens=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
 assert((await readFile(join(o.root,slot,'response-0.json'),'utf8')).includes('1.234567890123456789'));
 await assert.rejects(probe({...o,fetcher:()=>assert.fail('must not send')}));
});
for(const status of [403,429])test('HTTP '+status+' stops without later request or retry',async t=>{const o=await fixture(t);let calls=0;const r=await probe({...o,fetcher:async()=>{calls++;await access(join(o.root,slot,'intent-0.json'));return new Response('{}',{status});}});assert.equal(calls,1);assert.equal(r.stopReason,'HTTP_'+status);assert.equal(r.jobs[1].state,'NOT_TESTED');});
test('transport uncertainty consumes intent and blocks later requests',async t=>{const o=await fixture(t);let calls=0;const r=await probe({...o,fetcher:async()=>{calls++;throw Error('private upstream message');}});assert.equal(calls,1);assert.equal(r.state,'STOPPED_UNKNOWN');assert(!JSON.stringify(r).includes('private upstream'));await access(join(o.root,slot,'intent-0.json'));});
test('oversize response stops at 2MiB and cancels stream',async t=>{const o=await fixture(t);let canceled=false;const r=await probe({...o,fetcher:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(2097153));},cancel(){canceled=true;}}))});assert.equal(r.stopReason,'RESPONSE_LIMIT');assert.equal(r.responseBytes,2097152);assert(canceled);assert.equal(r.attempts.length,1);});
test('invalid UTF8 stops and preserves raw response',async t=>{const o=await fixture(t);const r=await probe({...o,fetcher:async()=>new Response(new Uint8Array([0xff]))});assert.equal(r.stopReason,'INVALID_UTF8_JSON');assert.equal((await readFile(join(o.root,slot,'response-0.json')))[0],255);});
test('total lease expiry stops before any dispatch',async t=>{const o=await fixture(t);let n=0;const r=await probe({...o,clock:()=>n++?120001:0,fetcher:()=>assert.fail('expired')});assert.equal(r.stopReason,'LEASE_EXPIRED');assert.equal(r.attempts.length,0);});
test('plan modification is rejected before consumption or dispatch',async t=>{const o=await fixture(t);await assert.rejects(probe({...o,planBytes:Buffer.from('{}'),fetcher:()=>assert.fail('tampered')}));});
for(const name of ['Error','TimeoutError'])test('partial body survives '+name+' and consumes only one request',async t=>{
 const o=await fixture(t);let calls=0,pulls=0;const chunk=Buffer.from('[{"count":123');
 const r=await probe({...o,fetcher:async()=>{calls++;return new Response(new ReadableStream({pull(c){if(!pulls++)c.enqueue(chunk);else c.error(Object.assign(Error('private failure'),{name}));}}));}});
 assert.equal(calls,1);assert.equal(r.stopReason,'BODY_READ_FAILED');assert.equal(r.attempts[0].partial,true);assert.equal(r.responseBytes,chunk.length);assert(r.attempts[0].responseHash);assert.equal(r.jobs[1].state,'NOT_TESTED');assert.deepEqual(await readFile(join(o.root,slot,'response-0.json')),chunk);
 await assert.rejects(probe({...o,fetcher:()=>assert.fail('no replay')}));
});
