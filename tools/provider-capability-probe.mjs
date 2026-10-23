import {readdir,lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {canonical} from './market-db/plan.mjs';
import {file} from './allium-offline-files.mjs';
import {alliumHash,alliumExecutionStorage as io,withAlliumSendLock} from './allium-executor.mjs';
import {parseHistorySource} from './supply-history-source.mjs';
import {workspaceEnvironment} from './workspace-env.mjs';
import {providerCapabilityPlan,capabilitySlot} from './provider-capability-plan.mjs';
const fail=code=>{throw Error(code??'CAPABILITY_PROBE_BLOCKED');},hash=v=>alliumHash(Buffer.from(canonical(v)));
const reference=v=>{if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(v))fail();return v;};
// Includes every previous archive, including the four consumed geographic slots.
export async function capabilityPriorManifest(root){
 const records=[];let bytes=0;
 async function walk(relative=''){
  for(const name of (await readdir(join(root,relative))).sort()){
   if(!relative&&['reservation-lock',capabilitySlot].includes(name))continue;
   const key=relative?relative+'/'+name:name,path=join(root,key),s=await lstat(path);
   if(s.isSymbolicLink()||s.uid!==process.getuid()||records.length>=4096)fail();
   if(s.isDirectory()){if(s.mode&0o077)fail();records.push([key,'directory',s.mode&0o777]);await walk(key);}
   else{await file(path,2097152);const b=await readFile(path);bytes+=b.length;if(bytes>67108864)fail();records.push([key,'file',b.length,alliumHash(b)]);}
  }
 }
 await walk();return hash(records);
}
async function authorization(root,{keys,approvalBytes,now}){
 const plan=providerCapabilityPlan();
 if(!['arkham','allium'].every(p=>typeof keys?.[p]==='string'&&keys[p])||!Buffer.isBuffer(approvalBytes)||!approvalBytes.length||approvalBytes.length>65536||!Number.isFinite(Date.parse(now)))fail();
 return {version:1,kind:'MANUAL_PROVIDER_CAPABILITY_ONCE',plan,planHash:hash(plan),approvalHash:alliumHash(approvalBytes),keyHashes:Object.fromEntries(Object.entries(keys).map(([p,k])=>[p,alliumHash(Buffer.from(k))])),previousHash:await capabilityPriorManifest(root),authorizedAt:now,expiresAt:new Date(Date.parse(now)+plan.leaseMs).toISOString()};
}
export const prepareCapabilityProbe=(root,options)=>withAlliumSendLock(root,async()=>Buffer.from(canonical(await authorization(root,options))),{live:true});
function responseState(status,value){
 if(status===401)return 'HTTP_401_AUTHENTICATION_REJECTED';if(status===403)return 'HTTP_403_FORBIDDEN';if(status===404)return 'HTTP_404_ROUTE_OR_SAMPLE_NOT_FOUND';
 if([400,405,422].includes(status))return 'HTTP_'+status+'_REQUEST_REJECTED';if(status===429)return 'HTTP_429_RATE_LIMITED';if(status!==200)return 'HTTP_'+status+'_UNCONFIRMED';
 if(value===undefined)return 'HTTP_200_NON_JSON';if(value?.error||value?.errors)return 'HTTP_200_ERROR_BODY';
 const list=Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.data)?value.data:null;
 return list?.length===0||value&&typeof value==='object'&&Object.keys(value).length===0?'HTTP_200_EMPTY':'HTTP_200_JSON';
}
export function capabilityReport(r){
 const plan=providerCapabilityPlan();return {version:1,kind:'PROVIDER_CAPABILITY_REPORT',state:r.state,planHash:r.planHash,checkedAt:r.finishedAt??null,httpAttempts:r.attempts.length,runs:r.runs,responseBytes:r.responseBytes,previousPreserved:r.previousPreserved??false,costStatus:'UNCONFIRMED',stopReason:r.stopReason??null,
  counts:Object.fromEntries(['arkham','allium'].map(p=>[p,r.attempts.filter(a=>a.provider===p).length])),lastFailure:r.lastFailure??null,
  jobs:r.jobs.map(j=>({id:j.id,provider:j.provider,type:j.type,state:j.state,httpStatus:j.httpStatus??null,diagnosisState:j.diagnosisState??null,errorClass:j.errorClass??null,echoMatches:j.echoMatches??null})),previous:plan.previous,notTested:plan.notTested};
}
export async function collectCapabilityProbe(root,{keys,approvalBytes,authorizationBytes,reviewedHash,now=()=>new Date().toISOString(),fetcher=globalThis.fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),onProgress=()=>{}}){
 return withAlliumSendLock(root,async()=>{
  if(!Buffer.isBuffer(authorizationBytes)||authorizationBytes.length>131072||alliumHash(authorizationBytes)!==reviewedHash)fail();
  const a=JSON.parse(authorizationBytes),plan=providerCapabilityPlan(),expected=await authorization(root,{keys,approvalBytes,now:a.authorizedAt});
  if(canonical(a)!==canonical(expected))fail();
  const validTime=()=>{const t=Date.parse(now());if(!Number.isFinite(t)||t<Date.parse(a.authorizedAt)||t>=Date.parse(a.expiresAt))fail('LEASE_EXPIRED');};validTime();
  const archive=join(root,capabilitySlot);await io.exclusiveDirectory(archive);await io.durableFile(join(archive,'authorization.json'),authorizationBytes);await io.durableFile(join(archive,'approval'),approvalBytes);
  const receipt={version:1,kind:'PROVIDER_CAPABILITY_RECEIPT',planHash:a.planHash,authorizationHash:reviewedHash,state:'RUNNING',runs:0,responseBytes:0,attempts:[],jobs:plan.jobs.map(j=>({id:j.id,provider:j.provider,type:j.type,state:'NOT_TESTED'}))};
  await io.snapshot(join(archive,'receipt.json'),receipt);
  async function request(job,step,path,body=null){
   validTime();const providerCount=receipt.attempts.filter(a=>a.provider===job.provider).length,jobCount=receipt.attempts.filter(a=>a.jobId===job.id).length;
   if(receipt.attempts.length>=plan.maxHttpRequests||providerCount>=plan.providerLimits[job.provider].maxHttpRequests||jobCount>=(job.type==='sql'?plan.maxSqlHttpRequests:1)||receipt.responseBytes>=plan.maxTotalBytes)fail('REQUEST_BUDGET_EXHAUSTED');
   if(step==='run'){if(receipt.runs>=plan.maxRuns)fail('RUN_BUDGET_EXHAUSTED');receipt.runs++;}
   const method=body?'POST':'GET',index=receipt.attempts.length,attempt={index,jobId:job.id,provider:job.provider,step,at:now(),method,path,bodyHash:body?hash(body):null,httpStatus:null,responseHash:null};receipt.attempts.push(attempt);
   await io.durableFile(join(archive,`intent-${index}.json`),Buffer.from(canonical(attempt)));await io.snapshot(join(archive,'receipt.json'),receipt);
   let response;
   try{response=await fetcher((job.provider==='arkham'?'https://api.arkm.com':'https://api.allium.so/api/v1')+(path.startsWith('/')?'':'/')+path,{method,headers:{[job.provider==='arkham'?'API-Key':'X-API-KEY']:keys[job.provider],Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(plan.timeoutMs)});}
   catch(e){attempt.transportCode=/^[A-Z0-9_]{1,80}$/.test(e?.cause?.code??'')?e.cause.code:'UNKNOWN';await io.snapshot(join(archive,'receipt.json'),receipt);fail('TRANSPORT_UNKNOWN');}
   attempt.httpStatus=response.status;const squid=response.headers.get('x-squid-error');attempt.proxyError=squid&&/^[A-Z_]+(?: \d+)?$/.test(squid)?squid:squid?'UNPARSED_PROXY_ERROR':null;
   if(squid){await response.body?.cancel();await io.snapshot(join(archive,'receipt.json'),receipt);fail(squid.startsWith('ERR_ACCESS_DENIED')?'PROXY_ACCESS_DENIED':'PROXY_ERROR');}
   const chunks=[];let size=0;
   if(response.body)for await(const chunk of response.body){
    if(receipt.responseBytes+Math.min(chunk.length,plan.maxResponseBytes-size)>plan.maxTotalBytes){await io.snapshot(join(archive,'receipt.json'),receipt);fail('RESPONSE_BYTE_LIMIT');}
    if(size+chunk.length>plan.maxResponseBytes){const part=chunk.subarray(0,plan.maxResponseBytes-size);receipt.responseBytes+=part.length;size+=part.length;chunks.push(part);attempt.responseTruncated=true;break;}
    size+=chunk.length;receipt.responseBytes+=chunk.length;chunks.push(chunk);
   }
   const bytes=Buffer.concat(chunks);await io.durableFile(join(archive,`response-${index}.json`),bytes);attempt.responseHash=alliumHash(bytes);attempt.responseBytes=size;await io.snapshot(join(archive,'receipt.json'),receipt);
   if(response.status===429)fail('RATE_LIMITED');
   if(attempt.responseTruncated)return {status:response.status,value:undefined,attempt,state:'RESPONSE_TOO_LARGE'};
   let value;try{value=parseHistorySource(bytes);}catch{}
   return {status:response.status,value,attempt,state:responseState(response.status,value)};
  }
  try{
   for(const [i,job]of plan.jobs.entries()){
    const result=receipt.jobs[i];receipt.activeJobId=job.id;result.state='UNKNOWN';
    if(job.type==='rest'){
     const r=await request(job,'read',job.path,job.body);result.httpStatus=r.status;result.state=r.state;
    }else{
     const q=await request(job,'create','explorer/queries',{title:'Atlas access probe '+job.id,config:{sql:job.sql,limit:1}});result.httpStatus=q.status;
     if(q.status!==200){result.state=q.state;await io.snapshot(join(archive,'receipt.json'),receipt);onProgress({id:job.id,state:result.state});continue;}
     result.queryId=reference(q.value?.query_id??q.value?.id);
     const run=await request(job,'run',`explorer/queries/${result.queryId}/run-async`,{parameters:{},run_config:{limit:1}});result.httpStatus=run.status;
     if(run.status!==200){result.state=run.state;await io.snapshot(join(archive,'receipt.json'),receipt);onProgress({id:job.id,state:result.state});continue;}
     result.runId=reference(run.value?.run_id);let success=false,terminal=false;
     for(let n=0;n<plan.maxStatusReads;n++){
      await sleep(2000);const s=await request(job,'status',`explorer/query-runs/${result.runId}/status`);result.httpStatus=s.status;
      if(s.status!==200){result.state=s.state;terminal=true;break;}
      const status=typeof s.value==='string'?s.value:s.value?.status;
      if(status==='success'){success=true;break;}
      if(status==='failed'){
       result.state='QUERY_FAILED';result.diagnosisState='UNKNOWN';const d=await request(job,'diagnosis',`explorer/query-runs?query_id=${result.queryId}`),v=d.value;
       if(d.status===200&&v?.query_id===result.queryId&&v?.run_id===result.runId&&v?.status==='failed'&&v?.query_config?.sql===job.sql&&typeof v.error==='string'){
        result.diagnosisState='OBSERVED';result.errorHash=alliumHash(Buffer.from(v.error));result.errorClass=v.error===`You used invalid tables: ${job.table}`?'INVALID_TABLES':'PROVIDER_ERROR';
       }
       terminal=true;break;
      }
      if(['canceled','cancelled'].includes(status)){result.state='QUERY_CANCELED';terminal=true;break;}
      if(!['created','queued','running'].includes(status))fail('STATUS_UNKNOWN');
     }
     if(success){
      const r=await request(job,'result',`explorer/query-runs/${result.runId}/results`);result.httpStatus=r.status;
      if(r.status!==200)result.state=r.state;
      else if(!Array.isArray(r.value?.data)||r.value.data.length>1||r.value.data.some(x=>x.probe_id!==job.probeId))result.state='QUERY_RESULT_UNCONFIRMED';
      else{result.echoMatches=r.value.sql===job.sql;result.state=result.echoMatches?(r.value.data.length?'QUERY_SUCCEEDED_SAMPLE':'QUERY_SUCCEEDED_EMPTY'):'QUERY_SUCCEEDED_ECHO_REVIEW_REQUIRED';}
     }else if(!terminal)result.state='QUERY_STATUS_UNCONFIRMED';
    }
    await io.snapshot(join(archive,'receipt.json'),receipt);onProgress({id:job.id,state:result.state});
   }
   receipt.state='COMPLETE';
  }catch(e){
   receipt.state='STOPPED_UNKNOWN';receipt.stopReason=['LEASE_EXPIRED','REQUEST_BUDGET_EXHAUSTED','RUN_BUDGET_EXHAUSTED','RESPONSE_BYTE_LIMIT','TRANSPORT_UNKNOWN','RATE_LIMITED','PROXY_ACCESS_DENIED','PROXY_ERROR','STATUS_UNKNOWN'].includes(e.message)?e.message:'EVIDENCE_UNCONFIRMED';
   const last=receipt.attempts.at(-1);if(last?.jobId===receipt.activeJobId){receipt.lastFailure={jobId:last.jobId,httpStatus:last.httpStatus,transportCode:last.transportCode??null,proxyError:last.proxyError??null};const job=receipt.jobs.find(j=>j.id===last.jobId);job.httpStatus=last.httpStatus;}
   else receipt.lastFailure={jobId:receipt.activeJobId,httpStatus:null,transportCode:null,proxyError:null};
  }
  receipt.previousPreserved=a.previousHash===await capabilityPriorManifest(root);if(!receipt.previousPreserved){receipt.state='STOPPED_UNKNOWN';receipt.stopReason='PREVIOUS_EVIDENCE_CHANGED';}
  receipt.finishedAt=now();await io.snapshot(join(archive,'receipt.json'),receipt);const report=capabilityReport(receipt);await io.durableFile(join(archive,'report.json'),Buffer.from(canonical(report)));return report;
 },{live:true});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [command,approvalPath,reviewedHash,...extra]=process.argv.slice(2),root=fileURLToPath(new URL('../.state/allium-executor/',import.meta.url));
  if(extra.length||!['plan','prepare','collect','status'].includes(command))fail();
  if(command==='plan')console.log(JSON.stringify(providerCapabilityPlan()));
  else if(command==='status')console.log(JSON.stringify(capabilityReport(JSON.parse(await file(join(root,capabilitySlot,'receipt.json'),262144)))));
  else{
   const env=await workspaceEnvironment(),keys={arkham:env.ARKM_API_KEY,allium:env.ALLIUM_API_KEY},approvalBytes=Buffer.from(await file(approvalPath,65536)),dir=fileURLToPath(new URL('../.state/provider-capability-authorization/',import.meta.url)),path=join(dir,capabilitySlot+'.json');
   if(command==='prepare'){if(reviewedHash)fail();await io.privateDirectory(dir);const b=await prepareCapabilityProbe(root,{keys,approvalBytes,now:new Date().toISOString()});await io.durableFile(path,b);console.log(JSON.stringify({state:'PREPARED_NOT_SENT',authorizationHash:alliumHash(b),jobs:providerCapabilityPlan().jobs.length,maxHttpRequests:providerCapabilityPlan().maxHttpRequests,maxRuns:providerCapabilityPlan().maxRuns}));}
   else{const report=await collectCapabilityProbe(root,{keys,approvalBytes,authorizationBytes:Buffer.from(await file(path,131072)),reviewedHash,onProgress:p=>console.log(JSON.stringify(p))});console.log(JSON.stringify(report));if(report.state!=='COMPLETE')process.exitCode=1;}
  }
 }catch{console.error('CAPABILITY_PROBE_BLOCKED: check private evidence and permanent reservation.');process.exitCode=1;}
}
