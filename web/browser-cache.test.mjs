import test from 'node:test';import assert from 'node:assert/strict';
import {createJSONClient,retryDeadline,cacheDigest} from './browser-cache.js';
import {createResponseStore} from './browser-idb.js';
import {apiRequestPolicy} from './browser-data.js';
import {cacheStatusText} from './browser-cache-ui.js';
const clone=x=>x===undefined?undefined:structuredClone(x);
function storage(){const entries=new Map();let meta;return {entries,persistent:true,get:async k=>clone(entries.get(k)),put:async e=>{entries.set(e.key,clone(e));return true;},remove:async(k,d)=>{if(d===undefined||entries.get(k)?.digest===d)entries.delete(k);},clear:async()=>entries.clear(),meta:async()=>clone(meta),saveMeta:async e=>{if(!meta||meta.until<e.until)meta=clone(e);},removeMeta:async d=>{if(meta?.digest===d)meta=undefined;},close(){}};}
const data=amount=>({amount,observedAt:'2026-10-20T00:00:00.000Z',source:'stored fixture'});
const validate=x=>{assert.equal(typeof x.amount,'string');assert.match(x.amount,/^\d+$/);assert.equal(x.source,'stored fixture');};
const options={validate,ttl:300000,label:'시장'};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const idle=async client=>{for(let i=0;i<1000;i++){if(client.stats().pending===0)return;await new Promise(r=>setTimeout(r,1));}throw Error('not idle');};
test('validated JSON survives a new page with unchanged observation/source/precision and TTL never slides on hits',async()=>{
 const store=storage();let now=1000000,calls=0;const original=data('123456789012345678901234567890');
 const make=()=>createJSONClient({store,now:()=>now,spacingMs:0,fetcher:async()=>{calls++;return original;}});
 const first=make();assert.deepEqual(await first.read('/market-data.json',options),original);await idle(first);const saved=[...store.entries.values()][0].storedAt;
 now+=299999;const second=make();const got=await second.read('/market-data.json',options);assert.deepEqual(got,original);got.amount='7';assert.deepEqual(await second.read('/market-data.json',options),original);assert.equal(calls,1);assert.equal([...store.entries.values()][0].storedAt,saved);first.close();second.close();
});
test('expired data is immediate, refreshes once, and a failed refresh preserves both last-good bytes and time',async()=>{
 const store=storage();let now=1000,calls=0,gate;
 const client=createJSONClient({store,now:()=>now,spacingMs:0,fetcher:async()=>{calls++;return gate?gate.promise:data('10');}});const events=[];client.subscribe(e=>events.push(e));
 await client.read('/market-data.json',options);await idle(client);const saved=[...store.entries.values()][0];now+=300001;gate=deferred();
 assert.deepEqual(await client.read('/market-data.json',options),data('10'));while(calls<2)await new Promise(r=>setTimeout(r,1));assert.equal(calls,2);assert(events.some(e=>e.state==='stale'));
 gate.reject(Error('offline'));await idle(client);assert.deepEqual([...store.entries.values()][0],saved);assert.equal(client.states()[0].state,'error');assert.match(cacheStatusText(client.states()[0]),/오래된 캐시.*갱신 실패/);client.close();
});
test('same URL requests merge and one subscriber abort cannot cancel another; queued cancelled work is never sent',async()=>{
 const gate=deferred(),store=storage();let calls=0;
 const client=createJSONClient({store,spacingMs:0,concurrency:1,fetcher:async(_url,{signal})=>{calls++;return new Promise((resolve,reject)=>{gate.promise.then(resolve,reject);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});}});
 const abort=new AbortController();const first=client.read('/a',{...options,signal:abort.signal}),second=client.read('/a',options);
 while(calls!==1)await new Promise(r=>setTimeout(r,1));abort.abort();await assert.rejects(first,{name:'AbortError'});
 const queuedAbort=new AbortController();const queued=client.read('/b',{...options,signal:queuedAbort.signal});queuedAbort.abort();await assert.rejects(queued,{name:'AbortError'});
 gate.resolve(data('10'));assert.deepEqual(await second,data('10'));await idle(client);assert.equal(calls,1);assert.equal(client.stats().active,0);client.close();
});
test('at most two physical requests start and successful/error paths return queue slots',async()=>{
 const gates=Array.from({length:5},deferred),started=[];let active=0,peak=0;
 const client=createJSONClient({store:storage(),spacingMs:0,fetcher:async url=>{const index=Number(url.slice(1));started.push(index);active++;peak=Math.max(peak,active);try{return await gates[index].promise;}finally{active--;}}});
 const tasks=gates.map((_,i)=>client.read('/'+i,options));while(started.length<2)await new Promise(r=>setTimeout(r,1));assert.equal(started.length,2);
 gates[0].resolve(data('1'));gates[1].reject(Error('fixture failure'));const caught=Promise.allSettled(tasks);for(let i=2;i<5;i++){while(!started.includes(i))await new Promise(r=>setTimeout(r,1));gates[i].resolve(data('2'));}
 await caught;await idle(client);assert.equal(peak,2);assert.equal(client.stats().active,0);client.close();
});
test('429 pauses all queued URLs, survives reload, respects Retry-After and performs zero automatic retries',async()=>{
 let now=1000000,calls=0;const store=storage();
 const client=createJSONClient({store,now:()=>now,spacingMs:0,concurrency:1,fetcher:async()=>{calls++;throw Object.assign(Error('limited'),{status:429,retryAfter:'120'});}});
 const results=await Promise.allSettled(['/a','/b','/c'].map(url=>client.read(url,options)));assert(results.every(r=>r.status==='rejected'));assert.equal(calls,1);await idle(client);client.close();
 const next=createJSONClient({store,now:()=>now,spacingMs:0,fetcher:async()=>{calls++;return data('3');}});await assert.rejects(next.read('/d',options),{status:429});assert.equal(calls,1);
 now+=119999;await assert.rejects(next.read('/d',options),{status:429});now++;assert.deepEqual(await next.read('/d',options),data('3'));assert.equal(calls,2);await idle(next);next.close();
});
test('Retry-After supports delta/date/server clock, huge values and conservative invalid fallback',()=>{
 const now=Date.parse('2026-10-27T00:00:00Z');assert.equal(retryDeadline('12',now),now+12000);assert.equal(retryDeadline('Tue, 27 Oct 2026 00:01:00 GMT',now),now+60000);
 assert.equal(retryDeadline('Tue, 27 Oct 2026 00:01:00 GMT',now+3600000,'Tue, 27 Oct 2026 00:00:00 GMT'),now+3660000);
 for(const value of [null,'bad','-1','1.5'])assert.equal(retryDeadline(value,now),now+60000);assert.equal(retryDeadline('9'.repeat(100),now),8640000000000000);
});
test('corrupt cache, schema mismatch, over-limit data and validator failures never replace valid last-good',async()=>{
 const store=storage();let calls=0;const client=createJSONClient({store,spacingMs:0,fetcher:async()=>{calls++;return data('10');}});await client.read('/a',options);await idle(client);client.close();
 const entry=[...store.entries.values()][0];entry.text=entry.text.replace('"10"','"99"');store.entries.set(entry.key,entry);
 const fresh=createJSONClient({store,spacingMs:0,fetcher:async()=>{calls++;return data('11');}});assert.deepEqual(await fresh.read('/a',options),data('11'));await idle(fresh);assert.equal(calls,2);fresh.close();
 const wrong=createJSONClient({store,spacingMs:0,fetcher:async()=>({amount:12,source:'stored fixture'})});await assert.rejects(wrong.read('/bad',options));assert(![...store.entries.values()].some(e=>e.url==='/bad'));
 await assert.rejects(wrong.read('/large',{...options,limit:5}));await idle(wrong);wrong.close();
});
test('quota/blocked/unavailable IndexedDB degrade to bounded memory rather than losing valid JSON',async()=>{
 const store=storage();store.put=async()=>{store.persistent=false;throw new DOMException('quota','QuotaExceededError');};let calls=0;
 const client=createJSONClient({store,spacingMs:0,fetcher:async()=>{calls++;return data('9');}});assert.deepEqual(await client.read('/a',options),data('9'));assert.deepEqual(await client.read('/a',options),data('9'));assert.equal(calls,1);assert.equal(client.states()[0].persistent,false);client.close();
 const blocked=createResponseStore({indexedDB:{open(){const q={};queueMicrotask(()=>q.onblocked());return q;}},timeoutMs:10});assert.equal(await blocked.get('x'),undefined);assert.equal(blocked.persistent,false);
 const unavailable=createResponseStore({indexedDB:null});assert.equal(await unavailable.get('x'),undefined);const hung=createResponseStore({indexedDB:{open:()=>({})},timeoutMs:5});assert.equal(await hung.get('x'),undefined);assert.equal(hung.persistent,false);
});
test('optional 404 is not persisted and HTTP200 null/malformed data is not treated as success',async()=>{
 const store=storage(),client=createJSONClient({store,spacingMs:0,fetcher:async url=>{if(url==='/404')throw Object.assign(Error('missing'),{status:404});return null;}});
 assert.equal(await client.read('/404',{...options,optional:true}),null);await assert.rejects(client.read('/null',{...options,optional:true}));assert.equal(store.entries.size,0);await idle(client);client.close();
});
test('API TTLs and cache URL/credential security scopes are explicit',()=>{
 const origin='https://atlas.example.com';assert.equal(apiRequestPolicy('/market-data.json',origin).ttl,300000);assert.equal(apiRequestPolicy('/asset-review-data.json',origin).ttl,3600000);assert.equal(apiRequestPolicy('/fx-data.json',origin).ttl,3600000);
 for(const path of ['https://evil.example/market-data.json','//evil.example/a','/.env.local','/market-data.json?key=secret','/market-data.json#fragment','/%2e%2e/market-data.json','/registration-history.json?coin=usdc'])assert.throws(()=>apiRequestPolicy(path,origin));
});
test('cache schema/version/size/future-time corruption is discarded before adoption',async()=>{
 const initial=storage(),writer=createJSONClient({store:initial,spacingMs:0,fetcher:async()=>data('1')});await writer.read('/a',options);await idle(writer);writer.close();const original=[...initial.entries.values()][0];
 for(const mutate of [e=>e.schema=2,e=>e.version='old',e=>e.bytes=99999999,e=>e.storedAt=Date.now()+60000,e=>e.storedAt-=1]){
  const store=storage(),entry=clone(original);mutate(entry);store.entries.set(entry.key,entry);let calls=0;const client=createJSONClient({store,spacingMs:0,fetcher:async()=>{calls++;return data('2');}});
  assert.deepEqual(await client.read('/a',options),data('2'));assert.equal(calls,1);await idle(client);client.close();
 }
});
test('a throwing IndexedDB property getter cannot stop client startup',async t=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');Object.defineProperty(globalThis,'indexedDB',{configurable:true,get(){throw new DOMException('denied','SecurityError');}});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'indexedDB',original);else delete globalThis.indexedDB;});
 const store=createResponseStore();assert.equal(store.persistent,false);assert.equal(await store.get('x'),undefined);
});
test('request starts remain spaced after delayed storage checks',async()=>{
 const store=storage(),meta=deferred();let checks=0;store.meta=async()=>{checks++;await meta.promise;return undefined;};const times=[];
 const client=createJSONClient({store,spacingMs:15,fetcher:async()=>{times.push(Date.now());return data('1');}});const reads=[client.read('/a',options),client.read('/b',options)];
 await new Promise(r=>setTimeout(r,35));meta.resolve();await Promise.all(reads);assert.equal(times.length,2);assert(times[1]-times[0]>=12);await idle(client);client.close();
});
test('a tiny session cooldown preserves Retry-After on reload even when IndexedDB writes fail',async()=>{
 const values=new Map(),session={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},store=storage();store.meta=async()=>undefined;store.saveMeta=async()=>{};store.persistent=false;let calls=0;
 const make=()=>createJSONClient({store,sessionStorage:session,spacingMs:0,now:()=>10000,fetcher:async()=>{calls++;throw Object.assign(Error('limited'),{status:429,retryAfter:'60'});}});
 const first=make();await assert.rejects(first.read('/a',options),{status:429});await idle(first);first.close();const next=make();await assert.rejects(next.read('/b',options),{status:429});assert.equal(calls,1);next.close();
});
test('late IndexedDB reads cannot resurrect old data or start a request after cache clear',async()=>{
 const store=storage(),initial=createJSONClient({store,spacingMs:0,fetcher:async()=>data('1')});await initial.read('/a',options);await idle(initial);initial.close();
 const old=clone([...store.entries.values()][0]),gate=deferred();let calls=0;store.get=async()=>gate.promise;
 const client=createJSONClient({store,spacingMs:0,fetcher:async()=>{calls++;return data('2');}});const pending=client.read('/a',options);await new Promise(r=>setTimeout(r,1));await client.clear();gate.resolve(old);await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,0);assert.equal(store.entries.size,0);client.close();
});
test('a new subscriber never joins an already-aborted queued job for the same URL',async()=>{
 const gate=deferred(),started=[];const client=createJSONClient({store:storage(),spacingMs:0,concurrency:1,fetcher:async url=>{started.push(url);return url==='/hold'?gate.promise:data('2');}});
 const hold=client.read('/hold',options);while(started.length===0)await new Promise(r=>setTimeout(r,1));
 const signal=new AbortController(),old=client.read('/next',{...options,signal:signal.signal});while(client.stats().queued===0)await new Promise(r=>setTimeout(r,1));signal.abort();await assert.rejects(old,{name:'AbortError'});
 const next=client.read('/next',options);gate.resolve(data('1'));await hold;assert.deepEqual(await next,data('2'));await idle(client);assert.deepEqual(started,['/hold','/next']);client.close();
});
test('background completion still updates an existing view if its old memory entry was evicted meanwhile',async()=>{
 const gate=deferred(),store=storage();let now=1000,calls=0;
 const client=createJSONClient({store,spacingMs:0,now:()=>now,fetcher:async url=>{if(url==='/a'&&++calls===2)return gate.promise;return data('1');}}),events=[];client.subscribe(e=>events.push(e));
 await client.read('/a',options);await idle(client);now+=300001;await client.read('/a',options);
 for(let i=0;i<33;i++)await client.read('/other-'+i,options);
 gate.resolve(data('2'));await idle(client);assert(events.some(e=>e.url==='/a'&&e.updated&&e.state==='fresh'));assert.deepEqual(await client.read('/a',options),data('2'));client.close();
});
test('a fresh in-memory hit never waits for IndexedDB cooldown reads',async()=>{
 const store=storage();let reads=0;const client=createJSONClient({store,spacingMs:0,fetcher:async()=>data('1')});await client.read('/a',options);await idle(client);
 store.meta=async()=>{reads++;return new Promise(()=>{});};assert.deepEqual(await client.read('/a',options),data('1'));assert.equal(reads,0);client.close();
});
test('queue capacity is bounded and rejection does not leak slots or permanently poison a URL',async()=>{
 const gate=deferred();let started=0;const client=createJSONClient({store:storage(),spacingMs:0,concurrency:1,queueLimit:1,fetcher:async url=>{started++;return url==='/hold'?gate.promise:data('2');}});
 const hold=client.read('/hold',options);while(started===0)await new Promise(r=>setTimeout(r,1));const queued=client.read('/queued',options);while(client.stats().queued===0)await new Promise(r=>setTimeout(r,1));
 await assert.rejects(client.read('/overflow',options),/REQUEST_QUEUE_FULL/);gate.resolve(data('1'));await Promise.all([hold,queued]);await idle(client);assert.deepEqual(await client.read('/overflow',options),data('2'));await idle(client);assert.equal(client.stats().active,0);client.close();
});
test('cache freshness notices age without rewriting the original observation or saved time',()=>{
 const row={label:'시장',state:'fresh',hasData:true,storedAt:1000,expiresAt:301000,persistent:true};assert.equal(cacheStatusText(row,300999),'');assert.match(cacheStatusText(row,301000),/오래된 캐시/);assert.equal(row.state,'fresh');assert.equal(row.storedAt,1000);
});
