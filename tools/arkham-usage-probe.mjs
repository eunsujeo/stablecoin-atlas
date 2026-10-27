// Manual fixed two-request probe; never called by web, startup or collector.
import {readFile,readdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {alliumExecutionStorage as io,withAlliumSendLock} from './allium-executor.mjs';
import {workspaceEnvironment} from './workspace-env.mjs';
import {parseHistorySource} from './supply-history-source.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const planHash='b4417a672f690d5deb9d1cd7a05d05fea325049332ecbeb5f965021ce8156202';
export const slot='arkham-usage-once-20261027-v1';
const stop=code=>{throw Error(code);};
async function manifest(root){
 const rows=[];let bytes=0;
 async function walk(dir=''){
  for(const name of (await readdir(join(root,dir))).sort()){
   if(!dir&&[slot,'reservation-lock'].includes(name))continue;
   const rel=dir?dir+'/'+name:name,p=join(root,rel),s=await lstat(p);
   if(s.isSymbolicLink()||s.uid!==process.getuid()||s.mode&0o077||rows.length>=10000)stop('PRIOR_EVIDENCE_UNSAFE');
   if(s.isDirectory()){rows.push([rel,'directory',s.mode&0o777]);await walk(rel);}
   else{if(!s.isFile()||s.size>2097152||(bytes+=s.size)>268435456)stop('PRIOR_EVIDENCE_LIMIT');rows.push([rel,s.mode&0o777,hash(await readFile(p))]);}
  }
 }
 await walk();return hash(JSON.stringify(rows));
}
export async function probe({root,planBytes,key,approvalBytes,fetcher=fetch,clock=()=>performance.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 if(hash(planBytes)!==planHash||!key||!Buffer.isBuffer(approvalBytes)||!approvalBytes.length)stop('INPUT_REJECTED');
 const plan=JSON.parse(planBytes);
 return withAlliumSendLock(root,async()=>{
  const previousHash=await manifest(root),dir=join(root,slot);
  await io.exclusiveDirectory(dir);
  const start=clock(),authorization={planHash,approvalHash:hash(approvalBytes),keyHash:hash(key),previousHash,authorizedAt:new Date().toISOString(),maxHTTP:2,maxBytes:4194304,maxSeconds:120,costStatus:'UNCONFIRMED'};
  await io.durableFile(join(dir,'plan.json'),planBytes);
  await io.durableFile(join(dir,'approval'),approvalBytes);
  await io.durableFile(join(dir,'authorization.json'),Buffer.from(JSON.stringify(authorization)));
  const r={kind:'ARKHAM_USAGE_ONCE_RECEIPT',state:'RUNNING',planHash,costStatus:'UNCONFIRMED',attempts:[],jobs:plan.jobs.map(j=>({id:j.id,state:'NOT_TESTED'})),responseBytes:0,databaseWrites:0};
  const save=()=>io.snapshot(join(dir,'receipt.json'),r);
  let lastSend=null;await save();
  try{
   for(const [i,j]of plan.jobs.entries()){
    if(lastSend!==null)await sleep(Math.max(0,1000-(clock()-lastSend)));
    const remaining=120000-(clock()-start);
    if(remaining<=0)stop('LEASE_EXPIRED');
    if(r.attempts.length>=2||r.responseBytes>=4194304)stop('BUDGET_EXHAUSTED');
    const a={index:i,jobId:j.id,at:new Date().toISOString(),httpStatus:null,responseBytes:0,responseHash:null};
    r.attempts.push(a);r.jobs[i].state='UNKNOWN';
    await io.durableFile(join(dir,`intent-${i}.json`),Buffer.from(JSON.stringify({a,method:'GET',path:j.path,query:j.query})));
    await save();
    const afterIntent=120000-(clock()-start);if(afterIntent<=0)stop('LEASE_EXPIRED');
    lastSend=clock();
    const response=await fetcher('https://api.arkm.com'+j.path+'?'+new URLSearchParams(j.query),{method:'GET',headers:{'API-Key':key,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.floor(Math.min(20000,afterIntent))))});
    a.httpStatus=response.status;
    if(response.headers.has('x-squid-error')){await response.body?.cancel();stop('PROXY_ERROR');}
    const reader=response.body?.getReader();const chunks=[];let exceeded=false,bodyReadFailed=false;
    try{
     if(reader)while(true){
      const {done,value}=await reader.read();if(done)break;
      const allowed=Math.min(2097152-a.responseBytes,4194304-r.responseBytes),n=Math.min(allowed,value.byteLength);
      if(n){chunks.push(Buffer.from(value.subarray(0,n)));a.responseBytes+=n;r.responseBytes+=n;}
      if(n<value.byteLength){exceeded=true;await reader.cancel();break;}
     }
    }catch{bodyReadFailed=true;await reader?.cancel().catch(()=>{});}
    finally{reader?.releaseLock();}
    const b=Buffer.concat(chunks);a.responseHash=hash(b);a.truncated=exceeded;a.partial=exceeded||bodyReadFailed;a.bodyReadFailed=bodyReadFailed;
    await io.durableFile(join(dir,`response-${i}.json`),b);await save();
    if(exceeded)stop('RESPONSE_LIMIT');
    if(bodyReadFailed)stop('BODY_READ_FAILED');
    if(response.status!==200)stop('HTTP_'+response.status);
    if(clock()-start>=120000)stop('LEASE_EXPIRED');
    let p;try{p=parseHistorySource(b);}catch{stop('INVALID_UTF8_JSON');}
    if(i===0){if(!Array.isArray(p))stop('HISTOGRAM_SHAPE_UNKNOWN');r.jobs[i].rows=p.length;r.jobs[i].state=p.length?'HTTP_200_JSON_OBSERVED':'HTTP_200_EMPTY';}
    else{if(!p||!Array.isArray(p.swaps)||p.swaps.length>1)stop('SWAPS_SHAPE_UNKNOWN');r.jobs[i].rows=p.swaps.length;r.jobs[i].state=p.swaps.length?'HTTP_200_JSON_OBSERVED':'HTTP_200_EMPTY';}
    await save();
   }
   r.state='COMPLETE';
  }catch(e){r.state='STOPPED_UNKNOWN';r.stopReason=/^(LEASE_EXPIRED|BUDGET_EXHAUSTED|PROXY_ERROR|RESPONSE_LIMIT|BODY_READ_FAILED|HTTP_[0-9]{3}|INVALID_UTF8_JSON|HISTOGRAM_SHAPE_UNKNOWN|SWAPS_SHAPE_UNKNOWN)$/.test(e.message)?e.message:'TRANSPORT_OR_LOCAL_ERROR';}
  r.previousPreserved=previousHash===await manifest(root);
  if(!r.previousPreserved){r.state='STOPPED_UNKNOWN';r.stopReason='PRIOR_EVIDENCE_CHANGED';}
  r.finishedAt=new Date().toISOString();await save();return r;
 },{live:true});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.slice(2).join(' ')!=='--live-approved')stop('NO_LIVE_APPROVAL');
  const env=await workspaceEnvironment();
  const r=await probe({root:'.state/allium-executor',planBytes:await readFile(new URL('../data/arkham-usage-probe-plan.json',import.meta.url)),key:env.ARKM_API_KEY,approvalBytes:await readFile(new URL('../.state/arkham-usage-verification-20261027/approved-scope.txt',import.meta.url))});
  console.log(JSON.stringify(r));
 }catch{console.error('ARKHAM_ONCE_BLOCKED: inspect private receipt; do not retry.');process.exitCode=1;}
}
