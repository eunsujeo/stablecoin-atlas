import {fetchJSON,defaultJSONByteLimit} from './browser-json.js';
import {createResponseStore} from './browser-idb.js';
const maxDate=8640000000000000;
export function retryDeadline(value,now=Date.now(),serverDate){
 if(typeof value!=='string'||value.length>128)return now+60000;
 value=value.trim();if(/^\d+$/.test(value)){const deadline=BigInt(Math.trunc(now))+BigInt(value)*1000n;return Number(deadline>BigInt(maxDate)?BigInt(maxDate):deadline);}
 // HTTP dates use the server clock when supplied, avoiding an early retry on a fast device clock.
 const httpDate=s=>typeof s==='string'&&/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(s)?Date.parse(s):NaN;
 const at=httpDate(value),basis=httpDate(serverDate);return Number.isFinite(at)?Math.max(now,Math.min(maxDate,Number.isFinite(basis)?now+at-basis:at)):now+60000;
}
const aborted=signal=>signal?.reason??new DOMException('The request was aborted.','AbortError');
const rateError=until=>Object.assign(Error('RATE_LIMITED'),{status:429,retryAt:until});
const encode=s=>new TextEncoder().encode(s);
export async function cacheDigest(text){
 if(!globalThis.crypto?.subtle)throw Error('CACHE_CRYPTO_UNAVAILABLE');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
}
const entryDigest=entry=>cacheDigest(JSON.stringify([entry.schema,entry.key,entry.url,entry.version,entry.storedAt,entry.bytes])+'\n'+entry.text);
export function createJSONClient({store=createResponseStore(),fetcher=fetchJSON,now=Date.now,concurrency=2,queueLimit=32,spacingMs=250,channel=null,sessionStorage}={}){
 if(sessionStorage===undefined){try{sessionStorage=typeof window==='undefined'?null:globalThis.sessionStorage;}catch{sessionStorage=null;}}
 const cooldownKey='atlas-json-cooldown-v1';
 if(!Number.isInteger(queueLimit)||queueLimit<1||queueLimit>128||!Number.isInteger(concurrency)||concurrency<1||concurrency>2||!Number.isFinite(spacingMs)||spacingMs<0)throw Error('REQUEST_POLICY_INVALID');
 const memory=new Map(),pending=new Map(),loads=new Map(),listeners=new Set(),states=new Map(),sequences=new Map();
 let closed=false,persistentCrypto=true,active=0,lastStart=-Infinity,timer,cooldown=0,sequence=0,nextSend=0,epoch=0;
 const queue=[];
 const emit=(job,state,extra={})=>{
  if(closed)return;
  if(job.sequence< (sequences.get(job.url)??0))return;
  const event={url:job.url,label:job.label,state,hasData:!!memory.get(job.key)||!!job.hadCache,storedAt:memory.get(job.key)?.storedAt??job.lastGoodAt??null,expiresAt:(memory.get(job.key)?.storedAt??job.lastGoodAt)===undefined?null:(memory.get(job.key)?.storedAt??job.lastGoodAt)+job.ttl,retryAt:cooldown>now()?cooldown:null,persistent:store.persistent&&persistentCrypto,...extra};
  states.set(job.url,event);for(const fn of listeners){try{fn(event);}catch{}}
 };
 async function readCooldown(){
  const entries=[];try{entries.push({entry:await store.meta(),session:false});}catch{}
  try{const raw=sessionStorage?.getItem(cooldownKey);if(raw&&raw.length<=1024)entries.push({entry:JSON.parse(raw),session:true});else if(raw)sessionStorage.removeItem(cooldownKey);}catch{try{sessionStorage?.removeItem(cooldownKey);}catch{}}
  for(const {entry,session}of entries)try{if(entry){if(entry.schema===1&&entry.key==='cooldown'&&Number.isFinite(entry.until)&&entry.until>=0&&entry.until<=maxDate&&await cacheDigest(String(entry.until))===entry.digest)cooldown=Math.max(cooldown,entry.until);else if(session)sessionStorage.removeItem(cooldownKey);else await store.removeMeta?.(entry.digest);}}catch{}
  return cooldown;
 }

 async function block(until){
  cooldown=Math.max(cooldown,until);try{channel?.postMessage({type:'cooldown',until:cooldown});}catch{}
  await readCooldown();
  try{const meta={key:'cooldown',schema:1,until:cooldown,digest:await cacheDigest(String(cooldown))};try{sessionStorage?.setItem(cooldownKey,JSON.stringify(meta));}catch{}await store.saveMeta(meta);}catch{}
 }
 if(channel)channel.onmessage=e=>{if(e.data?.type==='cooldown'&&Number.isFinite(e.data.until)&&e.data.until>=0&&e.data.until<=maxDate){cooldown=Math.max(cooldown,e.data.until);pump();}};
 function pump(){
  clearTimeout(timer);timer=undefined;
  while(queue.length&&active<concurrency){
   const item=queue[0];if(item.signal.aborted){queue.shift();item.reject(aborted(item.signal));continue;}
   if(cooldown>now()){queue.shift();item.reject(rateError(cooldown));continue;}
   const wait=spacingMs-(now()-lastStart);if(wait>0){timer=setTimeout(pump,wait);return;}
   queue.shift();active++;lastStart=now();
   Promise.resolve().then(async()=>{await readCooldown();if(item.signal.aborted)throw aborted(item.signal);if(cooldown>now())throw rateError(cooldown);const sendAt=Math.max(now(),nextSend);nextSend=sendAt+spacingMs;
    if(sendAt>now())await new Promise((resolve,reject)=>{const done=()=>{clearTimeout(waitTimer);item.signal.removeEventListener('abort',stop);resolve();};const stop=()=>{clearTimeout(waitTimer);item.signal.removeEventListener('abort',stop);reject(aborted(item.signal));};const waitTimer=setTimeout(done,sendAt-now());item.signal.addEventListener('abort',stop,{once:true});if(item.signal.aborted)stop();});
    if(item.signal.aborted)throw aborted(item.signal);if(cooldown>now())throw rateError(cooldown);return item.run();})
    .then(item.resolve,item.reject).finally(()=>{active--;pump();});
  }
 }
 const schedule=(run,signal)=>new Promise((resolve,reject)=>{for(let i=queue.length-1;i>=0;i--)if(queue[i].signal.aborted){const [old]=queue.splice(i,1);old.reject(aborted(old.signal));}if(queue.length>=queueLimit){reject(Error('REQUEST_QUEUE_FULL'));return;}queue.push({run,signal,resolve,reject});pump();});
 function trim(){let total=[...memory.values()].reduce((n,e)=>n+e.bytes,0);for(const [key,entry]of memory){if(memory.size<=32&&total<=8*1024*1024)break;memory.delete(key);total-=entry.bytes;}}
 async function valid(entry,job){
  if(!entry||entry.schema!==1||entry.key!==job.key||entry.url!==job.url||entry.version!==job.version||typeof entry.text!=='string'||entry.text.length>job.limit||!Number.isFinite(entry.storedAt)||entry.storedAt<0||entry.storedAt>now()+5000)return false;
  const bytes=encode(entry.text).byteLength;if(bytes>job.limit||bytes!==entry.bytes)return false;
  try{if(await entryDigest(entry)!==entry.digest)return false;job.validate(JSON.parse(entry.text));return true;}catch{return false;}
 }
 async function cached(job){
  const existing=memory.get(job.key);if(existing){try{job.validate(JSON.parse(existing.text));return existing;}catch{memory.delete(job.key);await store.remove(job.key,existing.digest).catch(()=>{});return null;}}
  let load=loads.get(job.key);if(!load){load=Promise.resolve().then(()=>store.get(job.key)).catch(()=>undefined);loads.set(job.key,load);load.finally(()=>{if(loads.get(job.key)===load)loads.delete(job.key);}).catch(()=>{});}
  const entry=await load;if(job.epoch!==epoch)return null;if(memory.has(job.key))return memory.get(job.key);
  if(await valid(entry,job)){if(job.epoch!==epoch)return null;if(!memory.has(job.key)){memory.set(job.key,entry);trim();}return memory.get(job.key)??entry;}
  if(job.epoch!==epoch)return null;if(memory.has(job.key))return memory.get(job.key);
  if(entry)await store.remove(job.key,entry.digest).catch(()=>{});return memory.get(job.key)??null;
 }
 function attach(job,signal){
  job.users++;
  return new Promise((resolve,reject)=>{
   let done=false;const finish=(fn,value)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);job.users--;if(job.users===0&&!job.finished)job.controller.abort();fn(value);};
   const abort=()=>finish(reject,aborted(signal));
   if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
   job.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
  });
 }
 function refresh(job,options){
  let running=pending.get(job.key);if(running&&!running.controller.signal.aborted){running.sequence=job.sequence;return running;}
  running={...job,controller:new AbortController(),users:0,finished:false};pending.set(job.key,running);
  running.promise=schedule(async()=>{
   running.started=true;const previous=memory.get(job.key)||job.hadCache;emit(running,previous?'refreshing':'loading');
   try{
    const data=await fetcher(job.url,{...options,signal:running.controller.signal,limit:job.limit,optional:false});
    job.validate(data);const text=JSON.stringify(data);if(typeof text!=='string')throw Error('READ_JSON_INVALID');const bytes=encode(text).byteLength;if(bytes>job.limit)throw Error('READ_LIMIT');
    const entry={schema:1,key:job.key,url:job.url,version:job.version,storedAt:now(),text,bytes,digest:null};
    try{entry.digest=await entryDigest(entry);}catch{persistentCrypto=false;}
    if(running.controller.signal.aborted)throw aborted(running.controller.signal);
    memory.delete(job.key);memory.set(job.key,entry);trim();
    if(entry.digest)await store.put(entry).catch(()=>{});
    emit(running,'fresh',{updated:!!previous,source:'network'});return text;
   }catch(error){
    if(error?.status===404&&options.optional&&!previous){emit(running,'missing');return null;}
    if(error?.status===429){const until=error.retryAt??retryDeadline(error.retryAfter,now(),error.serverDate);await block(until);error=rateError(cooldown);}
    emit(running,error?.status===429?'rate-limited':error?.name==='AbortError'?'cancelled':'error');throw error;
   }
  },running.controller.signal).catch(error=>{if(!running.started)emit(running,error?.status===429?'rate-limited':error?.name==='AbortError'?'cancelled':'error');throw error;}).finally(()=>{running.finished=true;if(pending.get(job.key)===running)pending.delete(job.key);});
  return running;
 }
 async function read(url,{validate,ttl,version='1',limit=defaultJSONByteLimit,label=url,context='',signal,...options}={}){
  if(closed)throw Error('CLIENT_CLOSED');
  if(typeof validate!=='function'||!Number.isFinite(ttl)||ttl<1||!Number.isSafeInteger(limit)||limit<1||limit>defaultJSONByteLimit||typeof context!=='string'||context.length>200)throw Error('CACHE_POLICY_INVALID');
  if(signal?.aborted)throw aborted(signal);
  const job={epoch,url,validate,ttl,version,limit,label,key:JSON.stringify([url,version,options.credentials??'same-origin',context]),sequence:++sequence};sequences.set(url,job.sequence);if(pending.has(job.key))pending.get(job.key).sequence=job.sequence;
  const entry=await cached(job);if(closed||job.epoch!==epoch)throw new DOMException('The cache request was superseded.','AbortError');if(signal?.aborted)throw aborted(signal);
  if(entry){
   job.hadCache=true;job.lastGoodAt=entry.storedAt;
   const value=JSON.parse(entry.text);validate(value);
   if(now()-entry.storedAt<ttl){emit(job,'fresh',{source:'cache'});return value;}
   emit(job,cooldown>now()?'rate-limited':'stale',{source:'cache'});
   if(cooldown<=now())attach(refresh(job,options),signal).catch(()=>{});
   return value;
  }
  if(cooldown>now()){emit(job,'rate-limited');throw rateError(cooldown);}
  const text=await attach(refresh(job,options),signal);if(signal?.aborted)throw aborted(signal);if(text===null)return null;
  const result=JSON.parse(text);validate(result);return result;
 }
 return {read,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},states:()=>[...states.values()],clear:async()=>{epoch++;loads.clear();for(const job of pending.values())job.controller.abort();for(const item of queue.splice(0))item.reject(aborted(item.signal));await Promise.allSettled([...pending.values()].map(j=>j.promise));memory.clear();await store.clear();},close:()=>{closed=true;epoch++;loads.clear();clearTimeout(timer);for(const job of pending.values())job.controller.abort();for(const item of queue.splice(0))item.reject(aborted(item.signal));store.close?.();channel?.close();},stats:()=>({active,queued:queue.length,pending:pending.size,cooldown})};
}
