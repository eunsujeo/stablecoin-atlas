// ReadableStream async iteration is unavailable on some supported Safari versions.
export const defaultJSONByteLimit=2*1024*1024;
const abortReason=signal=>signal.reason??new DOMException('The request was aborted.','AbortError');
const cancel=reader=>{try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}};
const byteLimit=limit=>{if(!Number.isSafeInteger(limit)||limit<1)throw Error('READ_LIMIT_INVALID');};
export async function readResponseJSON(response,{limit=defaultJSONByteLimit,signal}={}){
 byteLimit(limit);
 if(!response.body?.getReader)throw Error('READ_BODY_UNAVAILABLE');
 const reader=response.body.getReader(),chunks=[];let size=0,complete=false;
 const abort=()=>cancel(reader);
 signal?.addEventListener('abort',abort,{once:true});
 try{
  while(true){
   if(signal?.aborted)throw abortReason(signal);
   const {done,value}=await reader.read();
   if(signal?.aborted)throw abortReason(signal);
   if(done){complete=true;break;}
   if(!(value instanceof Uint8Array))throw Error('READ_BODY_INVALID');
   size+=value.byteLength;if(size>limit)throw Error('READ_LIMIT');chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }finally{
  signal?.removeEventListener('abort',abort);
  if(!complete)cancel(reader);
  reader.releaseLock();
 }
}
export async function fetchJSON(url,{limit=defaultJSONByteLimit,timeoutMs=15000,signal,optional=false,...options}={}){
 byteLimit(limit);if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>2147483647)throw Error('READ_TIMEOUT_INVALID');
 const controller=new AbortController(),abort=()=>controller.abort(abortReason(signal));let timer;
 try{
  if(signal?.aborted)throw abortReason(signal);
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>controller.abort(new DOMException('The request timed out.','TimeoutError')),timeoutMs);
  const response=await fetch(url,{...options,signal:controller.signal});
  if(controller.signal.aborted){if(response.body)cancel(response.body);throw abortReason(controller.signal);}
  if(!response.ok){if(response.body)cancel(response.body);if(optional&&response.status===404)return null;throw Object.assign(Error('READ_FAILED'),{status:response.status,...(response.status===429?{retryAfter:response.headers?.get('Retry-After')??null,serverDate:response.headers?.get('Date')??null}:{})});}
  return await readResponseJSON(response,{limit,signal:controller.signal});
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
