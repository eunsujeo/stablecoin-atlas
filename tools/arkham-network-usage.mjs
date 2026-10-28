// Manual five-deployment histogram bundle. No web/startup/scheduler invocation.
import {readFile,readdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {alliumExecutionStorage as io,withAlliumSendLock} from './allium-executor.mjs';
import {workspaceEnvironment} from './workspace-env.mjs';
import {boundedRead} from './evidence-store.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
import {networkUsagePlan,validateUsagePlan} from './network-usage-plan.mjs';
import {projectUsageArchive,histogramPoints} from './network-usage-source.mjs';
const stop=code=>{throw Error(code);};
async function manifest(root,slot){
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
export {manifest as networkUsagePriorManifest};
export async function collectNetworkUsage({root,planBytes,expectedPlanHash,key,approvalBytes,expectedApprovalHash,fetcher=fetch,clock=()=>performance.now(),now=()=>new Date().toISOString(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 if(hash(planBytes)!==expectedPlanHash||!key||!Buffer.isBuffer(approvalBytes)||!approvalBytes.length||hash(approvalBytes)!==expectedApprovalHash)stop('INPUT_REJECTED');
 const plan=await validateUsagePlan(JSON.parse(planBytes)),{slot,planHash}=plan;
 if(plan.window.untilExclusive>now().slice(0,10))stop('INCOMPLETE_DAY');
 return withAlliumSendLock(root,async()=>{
  const previousHash=await manifest(root,slot),dir=join(root,slot);
  await io.exclusiveDirectory(dir);
  const start=clock(),authorization={planHash,approvalHash:hash(approvalBytes),keyHash:hash(key),previousHash,authorizedAt:now(),maxHTTP:5,maxBytes:10485760,maxSeconds:120,costStatus:'UNCONFIRMED'};
  await io.durableFile(join(dir,'plan.json'),planBytes);
  await io.durableFile(join(dir,'approval'),approvalBytes);
  await io.durableFile(join(dir,'authorization.json'),Buffer.from(JSON.stringify(authorization)));
  const r={kind:'ARKHAM_NETWORK_USAGE_RECEIPT',authorizationHash:hash(JSON.stringify(authorization)),state:'RUNNING',planHash,costStatus:'UNCONFIRMED',attempts:[],jobs:plan.jobs.map(j=>({id:j.id,state:'NOT_TESTED'})),responseBytes:0,databaseWrites:0};
  const save=()=>io.snapshot(join(dir,'receipt.json'),r);
  let lastSend=null;await save();
  try{
   for(const [i,j]of plan.jobs.entries()){
    if(lastSend!==null)await sleep(Math.max(0,1000-(clock()-lastSend)));
    const remaining=120000-(clock()-start);
    if(remaining<=0)stop('LEASE_EXPIRED');
    if(r.attempts.length>=5||r.responseBytes>=10485760)stop('BUDGET_EXHAUSTED');
    const a={index:i,jobId:j.id,at:now(),httpStatus:null,responseBytes:0,responseHash:null};
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
      const allowed=Math.min(2097152-a.responseBytes,10485760-r.responseBytes),n=Math.min(allowed,value.byteLength);
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
    let p;try{p=histogramPoints(b,plan.window);}catch{stop('INVALID_UTF8_JSON');}
    if(!Array.isArray(p)||p.length>7)stop('HISTOGRAM_SHAPE_UNKNOWN');r.jobs[i].rows=p.length;r.jobs[i].state=p.length?'HTTP_200_JSON_OBSERVED':'HTTP_200_EMPTY';
    await save();
   }
   r.state='COMPLETE';
  }catch(e){r.state='STOPPED_UNKNOWN';r.stopReason=/^(LEASE_EXPIRED|BUDGET_EXHAUSTED|PROXY_ERROR|RESPONSE_LIMIT|BODY_READ_FAILED|HTTP_[0-9]{3}|INVALID_UTF8_JSON|HISTOGRAM_SHAPE_UNKNOWN|SWAPS_SHAPE_UNKNOWN)$/.test(e.message)?e.message:'TRANSPORT_OR_LOCAL_ERROR';}
  r.previousPreserved=previousHash===await manifest(root,slot);
  if(!r.previousPreserved){r.state='STOPPED_UNKNOWN';r.stopReason='PRIOR_EVIDENCE_CHANGED';}
  r.finishedAt=now();await save();return r;
 },{live:true});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [command,...rest]=process.argv.slice(2),args={};
  for(let i=0;i<rest.length;i+=2){if(!['--day','--plan','--plan-sha256','--approval','--approval-sha256','--receipt-sha256','--archive','--output'].includes(rest[i])||!rest[i+1]||Object.hasOwn(args,rest[i]))stop('ARGUMENTS');args[rest[i]]=rest[i+1];}
  if(command==='plan'&&Object.keys(args).join(',')==='--day')console.log(JSON.stringify(await networkUsagePlan(args['--day']),null,2));
  else if(command==='collect'&&Object.keys(args).sort().join(',')==='--approval,--approval-sha256,--plan,--plan-sha256'){
   const planBytes=await boundedRead(args['--plan'],32768),approvalBytes=await boundedRead(args['--approval'],65536);
   if(planBytes.length>32768||approvalBytes.length>65536)stop('INPUT_LIMIT');
   const env=await workspaceEnvironment();
   console.log(JSON.stringify(await collectNetworkUsage({root:'.state/allium-executor',planBytes,expectedPlanHash:args['--plan-sha256'],approvalBytes,expectedApprovalHash:args['--approval-sha256'],key:env.ARKM_API_KEY})));
  }else if(command==='project'&&Object.keys(args).sort().join(',')==='--approval-sha256,--archive,--output,--plan-sha256,--receipt-sha256'){
   const p=await projectUsageArchive(args['--archive'],{planFileHash:args['--plan-sha256'],receiptHash:args['--receipt-sha256'],approvalHash:args['--approval-sha256']});
   await io.durableFile(args['--output'],Buffer.from(JSON.stringify(p)));console.log(JSON.stringify({state:'PROJECTED',id:p.id,rows:p.rows.length}));
  }else stop('ARGUMENTS');
 }catch{console.error('ARKHAM_NETWORK_USAGE_BLOCKED: inspect private evidence; do not retry.');process.exitCode=1;}
}
