import {join} from 'node:path';
import {boundedRead} from './evidence-store.mjs';
import {canonical,digest} from './market-db/plan.mjs';
import {histogramPoints} from './network-usage-source.mjs';
import {operatingUsagePlan,validateUsageAuthorization} from './usage-operating-plan.mjs';
import {expandedUsageSnapshot} from './network-usage-v2.mjs';
import {usageDays} from '../web/network-usage-model.js';
export async function projectOperatingUsage(root,day){
 const plan=await operatingUsagePlan(day),dir=join(root,plan.slot),read=(name,n=131072)=>boundedRead(join(dir,name),n);
 const pb=await read('plan.json'),rb=await read('receipt.json'),ab=await read('authorization.json'),approval=await read('approval',65536),p=JSON.parse(pb),r=JSON.parse(rb),a=JSON.parse(ab);
 const fail=()=>{throw Error('USAGE_ARCHIVE_INVALID');};
 if(canonical(p)!==canonical(plan)||r.kind!=='ARKHAM_USAGE_DAILY_RECEIPT'||r.state!=='COMPLETE'||!r.previousPreserved||r.planHash!==p.planHash||r.authorizationHash!==digest(ab)||a.planHash!==p.planHash||a.approvalHash!==digest(approval)||a.maxHTTP!==18||a.maxBytes!==37748736||a.maxSeconds!==420||r.attempts.length!==18||r.jobs.length!==18||r.databaseWrites!==0)fail();
 validateUsageAuthorization(JSON.parse(approval),p);if(!Number.isFinite(Date.parse(a.authorizedAt))||!Number.isFinite(Date.parse(r.finishedAt))||Date.parse(r.finishedAt)<Date.parse(a.authorizedAt)||Date.parse(r.finishedAt)-Date.parse(a.authorizedAt)>420000)fail();
 let total=0;const rows=[];
 for(const[i,j]of p.jobs.entries()){
  const at=r.attempts[i],job=r.jobs[i],b=await read(`response-${i}.json`,2097152),intent=JSON.parse(await read(`intent-${i}.json`));
  if(at.index!==i||at.jobId!==j.id||at.httpStatus!==200||at.partial||at.truncated||at.bodyReadFailed||at.responseHash!==digest(b)||at.responseBytes!==b.length||job.id!==j.id||!job.state.startsWith('HTTP_200_')||canonical(intent.query)!==canonical(j.query)||intent.path!==j.path||intent.method!=='GET'||intent.a.at!==at.at)fail();
  const points=histogramPoints(b,p.window);if(job.rows!==points.length)fail();total+=b.length;
  for(const day of usageDays(p.window.untilExclusive)){const v=points.find(v=>v.day===day);rows.push({deploymentId:j.id,coinId:j.coinId,networkId:j.networkId,day,providerTime:v?.providerTime??null,state:v?'OBSERVED':'MISSING',usd:v?.usd??null,transfers:v?.transfers??null,transactions:null,sourceHash:at.responseHash,queriedAt:at.at});}
 }
 if(total!==r.responseBytes||total>37748736)fail();return expandedUsageSnapshot({planHash:p.planHash,receiptHash:digest(rb),sourceReceipts:[digest(rb)],window:p.window,rows});
}
