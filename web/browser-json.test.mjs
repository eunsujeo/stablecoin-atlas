import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fetchJSON,readResponseJSON,defaultJSONByteLimit} from './browser-json.js';
const encode=value=>new TextEncoder().encode(value);
function body(chunks,{cancel=()=>{}}={}){
 let index=0;const stream=new ReadableStream({pull(c){if(index<chunks.length)c.enqueue(chunks[index++]);else c.close();},cancel});
 // Reproduce the API available on the affected iPhone, without modifying globals.
 Object.defineProperty(stream,Symbol.asyncIterator,{value:undefined});return stream;
}
const mockFetch=(t,fn)=>t.mock.method(globalThis,'fetch',fn);
test('Safari-shaped getReader-only response decodes split Korean UTF-8 JSON without async iteration',async()=>{
 const expected={asset:'스테이블코인',fx:'₩1,000',amount:'1000000000000000000000000000000'};
 const bytes=encode(JSON.stringify(expected)),stream=body(Array.from(bytes,b=>Uint8Array.of(b)));
 assert.equal(stream[Symbol.asyncIterator],undefined);assert.deepEqual(await readResponseJSON({body:stream}),expected);assert.equal(stream.locked,false);
});
test('2MiB is an encoded byte boundary and oversized multi-byte responses cancel and unlock',async()=>{
 const value='x'.repeat(defaultJSONByteLimit-encode(JSON.stringify({value:''})).length),bytes=encode(JSON.stringify({value}));
 assert.equal(bytes.byteLength,2097152);const exact=body([bytes]);assert.equal((await readResponseJSON({body:exact})).value.length,value.length);assert.equal(exact.locked,false);
 let cancelled=0;const over=body([bytes,Uint8Array.of(32)],{cancel:()=>{cancelled++;}});await assert.rejects(readResponseJSON({body:over}),/READ_LIMIT/);assert.equal(cancelled,1);assert.equal(over.locked,false);
 const korean=body([encode('"가"')]);await assert.rejects(readResponseJSON({body:korean},{limit:4}),/READ_LIMIT/);assert.equal(korean.locked,false);
});
test('fatal UTF-8, malformed JSON, absent bodies and stream errors cannot become successful data',async()=>{
 for(const [chunks,type]of [[[Uint8Array.of(34,0xc3,34)],TypeError],[[encode('{broken')],SyntaxError]]){const stream=body(chunks);await assert.rejects(readResponseJSON({body:stream}),type);assert.equal(stream.locked,false);}
 await assert.rejects(readResponseJSON({body:null}),/READ_BODY_UNAVAILABLE/);
 const failed=new ReadableStream({start(c){c.error(Error('STREAM_FAILED'));}});await assert.rejects(readResponseJSON({body:failed}),/STREAM_FAILED/);assert.equal(failed.locked,false);
});
test('abort before headers makes no request and mid-body abort cancels/unlocks without masking the reason',async t=>{
 const aborted=new AbortController();aborted.abort();let calls=0;mockFetch(t,async()=>{calls++;throw Error('UNREACHABLE');});
 await assert.rejects(fetchJSON('/market-data.json',{signal:aborted.signal}),{name:'AbortError'});assert.equal(calls,0);
 let cancelled=0,reading;const started=new Promise(r=>reading=r),controller=new AbortController();
 const stream=new ReadableStream({pull(){reading();return new Promise(()=>{});},cancel(){cancelled++;return Promise.reject(Error('CANCEL_FAILED'));}});
 const pending=readResponseJSON({body:stream},{signal:controller.signal});await started;controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(cancelled,1);assert.equal(stream.locked,false);
});
test('timeout covers the body after HTTP200 for the full existing 15 seconds',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let started,cancelled=0,signal;
 const reading=new Promise(r=>started=r),stream=new ReadableStream({pull(){started();return new Promise(()=>{});},cancel(){cancelled++;}});
 mockFetch(t,async(_url,options)=>{signal=options.signal;return {ok:true,status:200,body:stream};});
 const request=fetchJSON('/fx-data.json');await reading;assert.equal(signal.aborted,false);
 t.mock.timers.tick(14999);assert.equal(signal.aborted,false);t.mock.timers.tick(1);
 await assert.rejects(request,{name:'TimeoutError'});assert.equal(cancelled,1);assert.equal(stream.locked,false);
});
test('timeout also aborts stalled headers and external abort remains linked during a body read',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 mockFetch(t,(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));
 const stalled=fetchJSON('/market-data.json');t.mock.timers.tick(15000);await assert.rejects(stalled,{name:'TimeoutError'});
 let started;const reading=new Promise(r=>started=r),controller=new AbortController(),stream=new ReadableStream({pull(){started();return new Promise(()=>{});}});
 globalThis.fetch=async()=>({ok:true,status:200,body:stream});const pending=fetchJSON('/registration-history.json',{signal:controller.signal});await reading;controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(stream.locked,false);
});
test('cache/credentials, optional404 and HTTP errors preserve semantics and cancel unread bodies',async t=>{
 let called,signal,cancelled=0;mockFetch(t,async(url,options)=>{called={url,...options};signal=options.signal;return {ok:true,status:200,body:body([encode('{"ok":true}')])};});
 const controller=new AbortController();assert.deepEqual(await fetchJSON('/registration-history.json',{signal:controller.signal,cache:'no-cache',credentials:'omit'}),{ok:true});
 assert.equal(called.cache,'no-cache');assert.equal(called.credentials,'omit');assert.equal(called.url,'/registration-history.json');controller.abort();assert.equal(signal.aborted,false,'completed requests detach external abort listeners');
 for(const [status,optional]of [[404,true],[404,false],[503,true]]){
  const stream=new ReadableStream({cancel(){cancelled++;}});globalThis.fetch=async()=>({ok:false,status,body:stream});
  if(optional&&status===404)assert.equal(await fetchJSON('/optional',{optional}),null);else await assert.rejects(fetchJSON('/optional',{optional}),/READ_FAILED/);assert.equal(stream.locked,false);
 }
 assert.equal(cancelled,3);
});
test('completion clears timeout and Safari does not need AbortSignal.any or AbortSignal.timeout',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const originals=new Map(['any','timeout'].map(k=>[k,Object.getOwnPropertyDescriptor(AbortSignal,k)]));
 for(const k of originals.keys())Object.defineProperty(AbortSignal,k,{value:undefined,configurable:true});
 t.after(()=>{for(const [k,descriptor]of originals)Object.defineProperty(AbortSignal,k,descriptor);});
 assert.equal(AbortSignal.any,undefined);assert.equal(AbortSignal.timeout,undefined);
 let signal;mockFetch(t,async(_url,options)=>{signal=options.signal;return {ok:true,status:200,body:body([encode('{"value":"정상"}')])};});
 assert.deepEqual(await fetchJSON('/asset-review-data.json'),{value:'정상'});t.mock.timers.tick(15001);assert.equal(signal.aborted,false);
});
test('smaller asset limit is enforced and cancellation promises never delay the original limit failure',async t=>{
 const stream=body([encode(' '.repeat(262145))],{cancel:()=>new Promise(()=>{})});mockFetch(t,async()=>({ok:true,status:200,body:stream}));
 await assert.rejects(fetchJSON('/asset-review-data.json',{limit:262144}),/READ_LIMIT/);assert.equal(stream.locked,false);
});
test('all browser loaders use the validated request layer above the Safari reader',async()=>{
 for(const file of (await readdir(new URL('.',import.meta.url))).filter(f=>f.endsWith('.js'))){const text=await readFile(new URL(file,import.meta.url),'utf8');assert.doesNotMatch(text,/for\s+await\s*\(/,file);assert.doesNotMatch(text,/\[Symbol\.asyncIterator\]/,file);}
 for(const file of ['overview.js','market-view.js','asset-review-store.js','app.js','evidence.js','contract-review.js'])assert.match(await readFile(new URL(file,import.meta.url),'utf8'),/cachedJSON/);
 assert.match(await readFile(new URL('overview.js',import.meta.url),'utf8'),/timeoutMs:15000/);
 assert.match(await readFile(new URL('asset-review-store.js',import.meta.url),'utf8'),/limit:assetReviewByteLimit,timeoutMs:15000/);
 assert.match(await readFile(new URL('market-view.js',import.meta.url),'utf8'),/timeoutMs:30000/);
 assert.match(await readFile(new URL('browser-cache.js',import.meta.url),'utf8'),/fetchJSON/);
});
test('429 carries only bounded retry metadata to the request policy and cancels its unread body',async t=>{
 let cancelled=0;const stream=new ReadableStream({cancel(){cancelled++;}});
 mockFetch(t,async()=>({ok:false,status:429,body:stream,headers:new Headers({'Retry-After':'120','Date':'Tue, 27 Oct 2026 00:00:00 GMT'})}));
 await assert.rejects(fetchJSON('/market-data.json'),e=>e.message==='READ_FAILED'&&e.status===429&&e.retryAfter==='120'&&e.serverDate==='Tue, 27 Oct 2026 00:00:00 GMT');assert.equal(cancelled,1);assert.equal(stream.locked,false);
});
