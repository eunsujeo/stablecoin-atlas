// Offline evidence validation/projection. No credentials, provider calls or database access.
import {join} from 'node:path';
import {boundedRead} from './evidence-store.mjs';
import {canonical,digest} from './market-db/plan.mjs';
import {parsePriceBytes,numericLexeme} from './provider-price-review.mjs';
import {validateUsagePlan} from './network-usage-plan.mjs';
import {usageDays,validateNetworkUsage} from '../web/network-usage-model.js';
const fail=()=>{throw Error('NETWORK_USAGE_EVIDENCE_INVALID');};
export function histogramPoints(bytes,window){
 const p=parsePriceBytes(bytes),days=usageDays(window.untilExclusive),seen=new Set();if(window.from!==days[0]||!Array.isArray(p)||p.length>7)fail();
 return p.map(r=>{
  if(!r||Object.keys(r).sort().join(',')!=='count,time,usd'||typeof r.time!=='string'||!days.some(d=>r.time===d+'T00:00:00Z'||r.time===d+'T00:00:00.000Z'))fail();
  const day=r.time.slice(0,10),usd=numericLexeme(r.usd),transfers=numericLexeme(r.count);
  if(seen.has(day)||!/^(0|[1-9]\d{0,77})$/.test(transfers)||!/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(usd))fail();seen.add(day);return {day,providerTime:r.time,usd,transfers};
 });
}
export async function projectUsageArchive(dir,{planFileHash,receiptHash,approvalHash}){
 const pb=await boundedRead(join(dir,'plan.json'),32768),rb=await boundedRead(join(dir,'receipt.json'),131072),ab=await boundedRead(join(dir,'authorization.json'),32768),approval=await boundedRead(join(dir,'approval'),65536);
 if(digest(pb)!==planFileHash||digest(rb)!==receiptHash||digest(approval)!==approvalHash)fail();
 const plan=await validateUsagePlan(JSON.parse(pb)),r=JSON.parse(rb),a=JSON.parse(ab);
 if(r.kind!=='ARKHAM_NETWORK_USAGE_RECEIPT'||r.state!=='COMPLETE'||r.previousPreserved!==true||r.planHash!==plan.planHash||r.authorizationHash!==digest(ab)||a.planHash!==plan.planHash||a.approvalHash!==approvalHash||a.maxHTTP!==5||a.maxBytes!==10485760||a.maxSeconds!==120||a.costStatus!=='UNCONFIRMED'||r.databaseWrites!==0||r.attempts.length!==5||r.jobs.length!==5||r.costStatus!=='UNCONFIRMED'||!Number.isFinite(Date.parse(a.authorizedAt))||!Number.isFinite(Date.parse(r.finishedAt))||Date.parse(r.finishedAt)-Date.parse(a.authorizedAt)>120000||Date.parse(r.finishedAt)<Date.parse(a.authorizedAt))fail();
 let total=0;const rows=[];
 for(const [i,j]of plan.jobs.entries()){
  const at=r.attempts[i],job=r.jobs[i],b=await boundedRead(join(dir,`response-${i}.json`),2097152),intent=JSON.parse(await boundedRead(join(dir,`intent-${i}.json`),32768));
  if(at.index!==i||at.jobId!==j.id||at.httpStatus!==200||at.partial||at.truncated||at.bodyReadFailed||at.responseHash!==digest(b)||at.responseBytes!==b.length||job.id!==j.id||!['HTTP_200_JSON_OBSERVED','HTTP_200_EMPTY'].includes(job.state)||canonical({method:intent.method,path:intent.path,query:intent.query})!==canonical({method:'GET',path:j.path,query:j.query})||intent.a?.jobId!==j.id||intent.a?.index!==i||intent.a?.at!==at.at||Date.parse(at.at)<Date.parse(a.authorizedAt)||Date.parse(at.at)>Date.parse(r.finishedAt))fail();
  total+=b.length;const points=histogramPoints(b,plan.window);if(job.rows!==points.length)fail();
  for(const day of usageDays(plan.window.untilExclusive)){const p=points.find(p=>p.day===day);rows.push({deploymentId:j.id,coinId:j.coinId,networkId:j.networkId,day,providerTime:p?.providerTime??null,state:p?'OBSERVED':'MISSING',usd:p?.usd??null,transfers:p?.transfers??null,transactions:null,sourceHash:at.responseHash,queriedAt:at.at});}
 }
 if(total!==r.responseBytes||total>10485760||!rows.some(r=>r.state==='OBSERVED'))fail();
 return validateNetworkUsage({schemaVersion:1,kind:'ARKHAM_NETWORK_USAGE',id:'arkham-usage-'+receiptHash,provider:'ARKHAM',planHash:plan.planHash,receiptHash,window:plan.window,dateBasis:'PROVIDER_DAY',aggregateTimezone:'UNKNOWN',coverage:'SUBSECOND_END_BOUNDARY_UNCONFIRMED',rows});
}
