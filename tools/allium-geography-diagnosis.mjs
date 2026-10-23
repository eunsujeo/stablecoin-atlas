import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {file} from './allium-offline-files.mjs';
import {canonical} from './market-db/plan.mjs';
import {workspaceEnvironment} from './workspace-env.mjs';
import {alliumHash,alliumExecutionStorage as io,alliumBoundedRequest,withAlliumSendLock} from './allium-executor.mjs';
import {geographyPlan,geographyLegacyManifest,previousGeographyManifest} from './allium-geography.mjs';

const slot='balances-diagnosis-20261024';
const fail=()=>{throw Error('GEOGRAPHY_DIAGNOSIS_BLOCKED');};
const hash=v=>alliumHash(Buffer.from(canonical(v)));
const reference=v=>{if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(v))fail();return v;};
async function source(root){
 const archive=join(root,'geography-once','balances'),bytes=Buffer.from(await file(join(archive,'receipt.json'),131072)),r=JSON.parse(bytes);
 const a=Buffer.from(await file(join(archive,'authorization.json'),65536)),plan=geographyPlan('balances');
 if(r.state!=='UNKNOWN'||r.failure!=='PROVIDER_RUN_FAILED'||!r.legacyPreserved||r.planHash!==hash(plan)||r.authorizationHash!==alliumHash(a)||canonical(JSON.parse(a).plan)!==canonical(plan)||r.attempts.length!==3)fail();
 for(const [i,kind] of ['create','run','status'].entries()){
  const attempt=r.attempts[i],intent=JSON.parse(await file(join(archive,`intent-${i}.json`),65536));
  if(attempt.index!==i||attempt.kind!==kind||attempt.httpStatus!==200||intent.index!==i||intent.kind!==kind||intent.at!==attempt.at||alliumHash(Buffer.from(await file(join(archive,`response-${i}.json`),2097152)))!==attempt.responseHash)fail();
 }
 const q=JSON.parse(await file(join(archive,'response-0.json'),2097152)),run=JSON.parse(await file(join(archive,'response-1.json'),2097152)),status=JSON.parse(await file(join(archive,'response-2.json'),2097152));
 if((q.query_id??q.id)!==r.queryId||run.run_id!==r.runId||(typeof status==='string'?status:status.status)!=='failed')fail();
 return {receiptHash:alliumHash(bytes),queryId:reference(r.queryId),runId:reference(r.runId),sqlHash:plan.sqlHash};
}
async function context(root){return {source:await source(root),legacyHash:await geographyLegacyManifest(root),previousPhaseHash:await previousGeographyManifest(root,slot)};}
export async function prepareGeographyDiagnosis(root,{apiKey,approvalBytes,now=new Date().toISOString()}){
 if(typeof apiKey!=='string'||!apiKey||!Buffer.isBuffer(approvalBytes)||!approvalBytes.length||approvalBytes.length>65536||!Number.isFinite(Date.parse(now)))fail();
 return withAlliumSendLock(root,async()=>Buffer.from(canonical({version:1,kind:'ALLIUM_GEOGRAPHY_DIAGNOSIS_ONCE',slot,...await context(root),keyHash:alliumHash(Buffer.from(apiKey)),approvalHash:alliumHash(approvalBytes),authorizedAt:now,expiresAt:new Date(Date.parse(now)+900000).toISOString(),maxHttpRequests:1,maxRuns:0,retries:0,costStatus:'UNCONFIRMED'})),{live:true});
}
export async function collectGeographyDiagnosis(root,{apiKey,approvalBytes,authorizationBytes,reviewedHash,now=()=>new Date().toISOString(),fetcher=globalThis.fetch}){
 return withAlliumSendLock(root,async()=>{
  if(!Buffer.isBuffer(authorizationBytes)||authorizationBytes.length>65536||alliumHash(authorizationBytes)!==reviewedHash)fail();
  const a=JSON.parse(authorizationBytes),expected=JSON.parse(await prepareUnlocked());
  async function prepareUnlocked(){
   if(typeof apiKey!=='string'||!apiKey||!Buffer.isBuffer(approvalBytes)||!approvalBytes.length||approvalBytes.length>65536||!Number.isFinite(Date.parse(a.authorizedAt)))fail();
   return canonical({version:1,kind:'ALLIUM_GEOGRAPHY_DIAGNOSIS_ONCE',slot,...await context(root),keyHash:alliumHash(Buffer.from(apiKey)),approvalHash:alliumHash(approvalBytes),authorizedAt:a.authorizedAt,expiresAt:new Date(Date.parse(a.authorizedAt)+900000).toISOString(),maxHttpRequests:1,maxRuns:0,retries:0,costStatus:'UNCONFIRMED'});
  }
  if(canonical(a)!==canonical(expected))fail();
  const validTime=()=>{const at=Date.parse(now());if(!Number.isFinite(at)||at<Date.parse(a.authorizedAt)||at>=Date.parse(a.expiresAt))fail();};validTime();
  const parent=join(root,'geography-once');await io.privateDirectory(parent);const archive=join(parent,slot);await io.exclusiveDirectory(archive);
  await io.durableFile(join(archive,'authorization.json'),authorizationBytes);await io.durableFile(join(archive,'approval'),approvalBytes);
  const receipt={version:1,kind:'ALLIUM_GEOGRAPHY_DIAGNOSIS_RECEIPT',authorizationHash:reviewedHash,state:'RESERVED',attempts:[],failure:null};
  await io.snapshot(join(archive,'receipt.json'),receipt);
  try{
   validTime();
   const result=await alliumBoundedRequest(receipt,archive,'diagnosis',`explorer/query-runs?query_id=${a.source.queryId}`,null,{apiKey,fetcher,now});
   const v=result.value;
   if(v.query_id!==a.source.queryId||v.run_id!==a.source.runId||v.status!=='failed'||typeof v.query_config?.sql!=='string'||alliumHash(Buffer.from(v.query_config.sql))!==a.source.sqlHash||typeof v.error!=='string'||!v.error.trim())fail();
   receipt.state='OBSERVED';receipt.errorHash=alliumHash(Buffer.from(v.error));
  }catch{receipt.state='UNKNOWN';receipt.failure='DIAGNOSIS_UNCONFIRMED';}
  receipt.previousPreserved=canonical(await context(root))===canonical({source:a.source,legacyHash:a.legacyHash,previousPhaseHash:a.previousPhaseHash});
  if(!receipt.previousPreserved){receipt.state='UNKNOWN';receipt.failure='PREVIOUS_EVIDENCE_CHANGED';}
  await io.snapshot(join(archive,'receipt.json'),receipt);
  return {state:receipt.state,failure:receipt.failure,httpAttempts:receipt.attempts.length,runs:0,previousPreserved:receipt.previousPreserved,errorHash:receipt.errorHash??null,costStatus:'UNCONFIRMED'};
 },{live:true});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [command,approvalPath,authorizationPath,reviewedHash,...extra]=process.argv.slice(2);
  if(!['prepare','collect'].includes(command)||!approvalPath||!authorizationPath||extra.length||command==='collect'&&!reviewedHash||command==='prepare'&&reviewedHash)fail();
  const root=fileURLToPath(new URL('../.state/allium-executor/',import.meta.url)),approvalBytes=Buffer.from(await file(approvalPath,65536)),{ALLIUM_API_KEY:apiKey}=await workspaceEnvironment();
  const output=fileURLToPath(new URL('../.state/allium-geography-authorization/balances-diagnosis-20261024.json',import.meta.url));
  if(authorizationPath!==output)fail();
  if(command==='prepare'){
   const b=await prepareGeographyDiagnosis(root,{apiKey,approvalBytes});await io.durableFile(output,b);console.log(JSON.stringify({state:'PREPARED_NOT_SENT',authorizationHash:alliumHash(b),maxHttpRequests:1,maxRuns:0}));
  }else{
   const r=await collectGeographyDiagnosis(root,{apiKey,approvalBytes,authorizationBytes:Buffer.from(await file(output,65536)),reviewedHash});console.log(JSON.stringify(r));if(r.state==='UNKNOWN')process.exitCode=1;
  }
 }catch{console.error('GEOGRAPHY_DIAGNOSIS_BLOCKED: private evidence or permanent reservation unavailable.');process.exitCode=1;}
}
