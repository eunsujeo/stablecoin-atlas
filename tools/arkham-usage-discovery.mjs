// Exactly the separately approved four metadata requests; no histogram or DB.
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {alliumExecutionStorage as io,withAlliumSendLock} from './allium-executor.mjs';
import {networkUsagePriorManifest} from './arkham-network-usage.mjs';
import {parsePriceBytes} from './provider-price-review.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const stop=code=>{throw Error(code);};
export const discoveryPlanHash='175d14a1bc2c6324808d3b66116bc247bec6109f7d83ac469258329136c9a011';
export function discoveryMetadata(bytes,id){
 const value=parsePriceBytes(bytes);
 if(!value||(!Array.isArray(value)&&Object.getPrototypeOf(value)!==null))stop('METADATA_SHAPE_UNKNOWN');
 const entries=Object.keys(value).length;
 if(id==='chains'){
  if(!entries||entries>10000)stop('METADATA_SHAPE_UNKNOWN');
 }else if(Array.isArray(value)||entries>1000||Object.entries(value).some(([chain,address])=>!/^[-a-z0-9_]{1,80}$/.test(chain)||typeof address!=='string'||!address.length||address.length>512))stop('METADATA_SHAPE_UNKNOWN');
 return {entries,shape:Array.isArray(value)?'ARRAY':'OBJECT'};
}
export async function collectUsageDiscovery({root,planBytes,expectedPlanHash,key,approvalBytes,expectedApprovalHash,fetcher=fetch,clock=()=>performance.now(),now=()=>new Date().toISOString(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 if(!Buffer.isBuffer(planBytes)||hash(planBytes)!==discoveryPlanHash||expectedPlanHash!==discoveryPlanHash||typeof key!=='string'||!key||!Buffer.isBuffer(approvalBytes)||!approvalBytes.length||hash(approvalBytes)!==expectedApprovalHash)stop('INPUT_REJECTED');
 const plan=JSON.parse(planBytes),{slot}=plan,planHash=discoveryPlanHash;
 return withAlliumSendLock(root,async()=>{
  const previousHash=await networkUsagePriorManifest(root,slot),dir=join(root,slot);
  await io.exclusiveDirectory(dir);
  const start=clock(),authorization={planHash,approvalHash:hash(approvalBytes),keyHash:hash(key),previousHash,authorizedAt:now(),maxHTTP:4,maxBytes:8388608,maxSeconds:120,costStatus:'UNKNOWN'};
  await io.durableFile(join(dir,'plan.json'),planBytes);
  await io.durableFile(join(dir,'approval'),approvalBytes);
  await io.durableFile(join(dir,'authorization.json'),Buffer.from(JSON.stringify(authorization)));
  const r={kind:'ARKHAM_USAGE_DISCOVERY_RECEIPT',authorizationHash:hash(JSON.stringify(authorization)),state:'RUNNING',planHash,costStatus:'UNKNOWN',attempts:[],jobs:plan.jobs.map(j=>({id:j.id,state:'NOT_TESTED'})),responseBytes:0,databaseWrites:0};
  const save=()=>io.snapshot(join(dir,'receipt.json'),r);
  let lastSend=null;await save();
  try{
   for(const [i,j]of plan.jobs.entries()){
    if(lastSend!==null)await sleep(Math.max(0,1000-(clock()-lastSend)));
    const remaining=120000-(clock()-start);
    if(remaining<=0)stop('LEASE_EXPIRED');
    if(r.attempts.length>=4||r.responseBytes>=8388608)stop('BUDGET_EXHAUSTED');
    const a={index:i,jobId:j.id,at:now(),httpStatus:null,responseBytes:0,responseHash:null};
    r.attempts.push(a);r.jobs[i].state='UNKNOWN';
    await io.durableFile(join(dir,`intent-${i}.json`),Buffer.from(JSON.stringify({a,method:'GET',path:j.path,query:j.query})));
    await save();
    const afterIntent=120000-(clock()-start);if(afterIntent<=0)stop('LEASE_EXPIRED');
    lastSend=clock();
    let response;try{response=await fetcher(plan.origin+j.path,{method:'GET',headers:{'API-Key':key,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.floor(Math.min(20000,afterIntent))))});}catch(error){
     a.transportClass=['TimeoutError','AbortError'].includes(error.name)?error.name:'TRANSPORT_UNKNOWN';
     const code=error.cause?.code??error.code;if(typeof code==='string'&&/^[A-Z0-9_-]{1,80}$/.test(code))a.transportCode=code;
     await save();stop('TRANSPORT_FAILURE');
    }
    a.httpStatus=response.status;
    if(response.headers.has('x-squid-error'))a.proxyError=response.headers.get('x-squid-error');
    const reader=response.body?.getReader();const chunks=[];let exceeded=false,bodyReadFailed=false;
    try{
     if(reader)while(true){
      const {done,value}=await reader.read();if(done)break;
      const allowed=Math.min(2097152-a.responseBytes,8388608-r.responseBytes),n=Math.min(allowed,value.byteLength);
      if(n){chunks.push(Buffer.from(value.subarray(0,n)));a.responseBytes+=n;r.responseBytes+=n;}
      if(n<value.byteLength){exceeded=true;await reader.cancel();break;}
     }
    }catch{bodyReadFailed=true;await reader?.cancel().catch(()=>{});}
    finally{reader?.releaseLock();}
    const b=Buffer.concat(chunks);a.responseHash=hash(b);a.truncated=exceeded;a.partial=exceeded||bodyReadFailed;a.bodyReadFailed=bodyReadFailed;
    await io.durableFile(join(dir,`response-${i}.json`),b);await save();
    if(exceeded)stop('RESPONSE_LIMIT');
    if(bodyReadFailed)stop('BODY_READ_FAILED');
    if(a.proxyError)stop('PROXY_ERROR');
    if(response.status!==200)stop('HTTP_'+response.status);
    if(clock()-start>=120000)stop('LEASE_EXPIRED');
    let p;try{p=discoveryMetadata(b,j.id);}catch{stop('METADATA_SHAPE_UNKNOWN');}
    r.jobs[i].entries=p.entries;r.jobs[i].shape=p.shape;r.jobs[i].state=p.entries?'HTTP_200_JSON_OBSERVED':'HTTP_200_EMPTY';
    await save();
   }
   r.state='COMPLETE';
  }catch(e){r.state='STOPPED_UNKNOWN';r.stopReason=/^(LEASE_EXPIRED|BUDGET_EXHAUSTED|PROXY_ERROR|RESPONSE_LIMIT|BODY_READ_FAILED|HTTP_[0-9]{3}|METADATA_SHAPE_UNKNOWN|TRANSPORT_FAILURE)$/.test(e.message)?e.message:'TRANSPORT_OR_LOCAL_ERROR';}
  r.previousPreserved=previousHash===await networkUsagePriorManifest(root,slot);
  if(!r.previousPreserved){r.state='STOPPED_UNKNOWN';r.stopReason='PRIOR_EVIDENCE_CHANGED';}
  r.finishedAt=now();await save();return r;
 },{live:true});
}
