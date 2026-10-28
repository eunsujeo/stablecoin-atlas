import {readFile,lstat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {isCLIEntrypoint} from './cli-entrypoint.mjs';
import {join} from 'node:path';
import {operatingUsagePlan,validateUsageAuthorization} from './usage-operating-plan.mjs';
import {collectOperatingUsage} from './usage-operating-collector.mjs';
import {projectOperatingUsage} from './usage-operating-project.mjs';
import {workspaceEnvironment} from './workspace-env.mjs';
import {connectDatabase} from './market-db/connection.mjs';
import {verifyNetworkUsageSchema,claimNetworkUsageDay,importNetworkUsage} from './market-db/network-usage.mjs';
import {canonical,digest} from './market-db/plan.mjs';
import {boundedRead} from './evidence-store.mjs';
const fail=()=>{throw Error('USAGE_OPERATION_INVALID');};
export async function usageOperation(args,{now=()=>new Date().toISOString(),connect=connectDatabase,collect=collectOperatingUsage}={}){
 const[command,flag,value,...extra]=args;if(extra.length)fail();const day=now().slice(0,10);
 if(command==='plan'&&flag==='--day')return operatingUsagePlan(value);
 if(!['run','check'].includes(command)||flag!=='--config')fail();
 const s=await lstat(value);if(!s.isFile()||s.isSymbolicLink()||s.mode&0o022)fail();const c=JSON.parse(await boundedRead(value,65536));
 if(Object.keys(c).sort().join(',')!=='authorizationFile,authorizationHash,envFile,reviewedDefinersFile,reviewedDefinersHash,stateRoot')fail();
 for(const file of [c.authorizationFile,c.envFile,c.reviewedDefinersFile]){const st=await lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.uid!==process.getuid()||st.mode&0o077)fail();}
 const authorizationBytes=await boundedRead(c.authorizationFile,65536),review=await boundedRead(c.reviewedDefinersFile,65536);
 if(digest(authorizationBytes)!==c.authorizationHash||digest(review)!==c.reviewedDefinersHash)fail();
 const r=JSON.parse(review);if(r.schemaVersion!==1||r.kind!=='SUPPLY_SOURCE_REVIEWED_DEFINERS'||!Array.isArray(r.definers))fail();const options={reviewedDefiners:r.definers};
 const p=await operatingUsagePlan(day);validateUsageAuthorization(JSON.parse(authorizationBytes),p);
 const env=await workspaceEnvironment(c.envFile,{});if(!env.ARKM_API_KEY||!env.DATABASE_URL)fail();let db;
 try{
  db=await connect(env);if(await verifyNetworkUsageSchema(db)!==2)fail();
  if(command==='check')return {state:'READY',policyHash:p.policyHash,providerRequests:0};
  const result=await collect({root:c.stateRoot,planBytes:Buffer.from(JSON.stringify(p)),expectedPlanHash:digest(Buffer.from(JSON.stringify(p))),key:env.ARKM_API_KEY,approvalBytes:authorizationBytes,expectedApprovalHash:c.authorizationHash,claim:({day,planHash})=>claimNetworkUsageDay(db,{day,planHash,ownerId:randomUUID()},options)});
  if(!['COMPLETE','ALREADY_CLAIMED'].includes(result.state))return {state:result.state,stopReason:result.stopReason??null,providerAttempts:result.attempts?.length??0};
  let payload;try{payload=await projectOperatingUsage(c.stateRoot,day);}catch{if(result.state==='ALREADY_CLAIMED')return {state:'CONSUMED_NO_COMPLETE_ARCHIVE',providerAttempts:0};throw Error('USAGE_ARCHIVE_INVALID');}
  const bytes=Buffer.from(JSON.stringify(payload)),imported=await importNetworkUsage(db,bytes,digest(bytes),options);
  return {state:'PUBLISHED',providerAttempts:result.state==='ALREADY_CLAIMED'?0:result.attempts.length,inserted:imported.inserted,rows:payload.rows.length,observed:payload.rows.filter(r=>r.state==='OBSERVED').length};
 }finally{await db?.end().catch(()=>{});}
}
if(isCLIEntrypoint(import.meta.url)){try{const r=await usageOperation(process.argv.slice(2));console.log(JSON.stringify(r));if(r.state&&!['READY','PUBLISHED'].includes(r.state))process.exitCode=1;}catch{console.error('USAGE_OPERATION_FAILED: last stored snapshot preserved; inspect private state.');process.exitCode=1;}}
