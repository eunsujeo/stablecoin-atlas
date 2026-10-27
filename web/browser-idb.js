export const responseCacheDatabase='stablecoin-atlas-response-cache-v1';
export function createResponseStore({indexedDB,timeoutMs=1000,maxEntries=32,maxBytes=8*1024*1024}={}){
 if(indexedDB===undefined){try{indexedDB=globalThis.indexedDB;}catch{indexedDB=null;}}
 let opened,disabled=false;const connections=new Set();
 const disable=()=>{disabled=true;for(const db of connections)db.close();connections.clear();};
 const open=()=>{
  if(disabled||!indexedDB)return Promise.resolve(null);
  return opened??=new Promise(resolve=>{
   let request,done=false;const finish=db=>{if(done){db?.close();return;}done=true;clearTimeout(timer);resolve(db);};
   const timer=setTimeout(()=>{disable();finish(null);},timeoutMs);
   try{
    request=indexedDB.open(responseCacheDatabase,1);
    request.onupgradeneeded=()=>{try{if(done||disabled){request.transaction.abort();return;}const db=request.result;for(const name of ['entries','meta'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'key'});}catch{try{request.transaction.abort();}catch{}disable();finish(null);}};
    request.onblocked=request.onerror=event=>{event?.preventDefault?.();disable();finish(null);};
    request.onsuccess=()=>{const db=request.result;if(done||disabled){db.close();return;}
     if(!['entries','meta'].every(n=>db.objectStoreNames.contains(n))){db.close();disable();finish(null);return;}
     connections.add(db);db.onversionchange=()=>{db.close();connections.delete(db);opened=undefined;};finish(db);
    };
   }catch{disable();finish(null);}
  });
 };
 async function operation(name,mode,work){
  const db=await open();if(!db)return undefined;
  return new Promise(resolve=>{
   let tx,done=false,result;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
   const timer=setTimeout(()=>{try{tx?.abort();}catch{}disable();finish(undefined);},timeoutMs);
   try{tx=db.transaction(name,mode);tx.oncomplete=()=>finish(result);const failed=event=>{event?.preventDefault?.();try{tx.abort();}catch{}disable();finish(undefined);};tx.onabort=tx.onerror=failed;
    work(tx.objectStore(name),value=>{result=value;},fn=>()=>{try{fn();}catch{failed();}});
   }catch{try{tx?.abort();}catch{}disable();finish(undefined);}
  });
 }
 return {
  get persistent(){return !disabled&&!!indexedDB;},
  get:(key)=>operation('entries','readonly',(s,set,guard)=>{const q=s.get(key);q.onsuccess=guard(()=>set(q.result));}),
  remove:(key,digest)=>operation('entries','readwrite',(s,set,guard)=>{const q=s.get(key);q.onsuccess=guard(()=>{if(digest===undefined||q.result?.digest===digest)s.delete(key);set(true);});}),
  clear:()=>operation('entries','readwrite',(s,set)=>{s.clear();set(true);}),
  put:entry=>operation('entries','readwrite',(s,set,guard)=>{
   const q=s.getAll(null,maxEntries+1);q.onsuccess=guard(()=>{
    const rows=q.result.filter(r=>r.key!==entry.key),valid=r=>typeof r.text==='string'&&r.text.length<=2*1024*1024&&Number.isSafeInteger(r.bytes)&&r.bytes>0&&r.bytes<=2*1024*1024&&new TextEncoder().encode(r.text).byteLength===r.bytes&&Number.isFinite(r.storedAt);
    if(q.result.length>maxEntries||rows.some(r=>!valid(r))){s.clear();rows.length=0;}
    let bytes=rows.reduce((n,r)=>n+r.bytes,0)+entry.bytes;rows.sort((a,b)=>a.storedAt-b.storedAt);
    while(rows.length&&(rows.length>=maxEntries||bytes>maxBytes)){const old=rows.shift();s.delete(old.key);bytes-=old.bytes;}
    if(entry.bytes>maxBytes)return; s.put(entry);set(true);
   });
  }),
  meta:()=>operation('meta','readonly',(s,set,guard)=>{const q=s.get('cooldown');q.onsuccess=guard(()=>set(q.result));}),
  removeMeta:digest=>operation('meta','readwrite',(s,set,guard)=>{const q=s.get('cooldown');q.onsuccess=guard(()=>{if(q.result?.digest===digest)s.delete('cooldown');set(true);});}),
  saveMeta:entry=>operation('meta','readwrite',(s,set,guard)=>{const q=s.get('cooldown');q.onsuccess=guard(()=>{if(!q.result||!Number.isFinite(q.result.until)||q.result.until<entry.until)s.put(entry);set(true);});}),
  close:()=>{for(const db of connections)db.close();connections.clear();opened=undefined;}
 };
}
