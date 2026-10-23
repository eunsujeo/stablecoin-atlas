import {readFile} from 'node:fs/promises';
import {alliumPlan,alliumSurveyResult} from './allium-plan.mjs';
import {supplyHash} from './allium-supply-source.mjs';
import {parseHistorySource} from './supply-history-source.mjs';
import {validateSurveySnapshot,surveyTargets} from '../web/survey-model.js';
import {dailyPlan,dailyHash} from './allium-daily-plan.mjs';
import {canonical,instant,epochMicros} from './market-db/plan.mjs';
export const surveyMapper='allium-stored-survey-v1';
export const surveyPlanHash='1b4318b699f0620bcff4c52587201d8bbaa0b45860dd777df35f6b81407e8797';
const fail=()=>{throw Error('ALLIUM_SURVEY_SOURCE_INVALID');};
export async function storedSurveyPlan(){
 const [metadata,legacy]=await Promise.all([readFile(new URL('../data/market-registration.json',import.meta.url)),readFile(new URL('../data/asset-registry.json',import.meta.url))]);
 const plan=alliumPlan(JSON.parse(metadata),JSON.parse(legacy),{asOfDay:'2026-10-23'});
 if(plan.planHash!==surveyPlanHash||surveyTargets.some(t=>!plan.targets.some(p=>p.deploymentId===t.deploymentId&&p.coinId===t.coinId&&p.networkId===t.networkId&&p.networkIdentity===t.networkIdentity)))fail();return plan;
}
export function surveySource(bytes,{plan,kind,expectedHash,reviewBytes,reviewHash,receiptBytes,executionAuthorizationBytes,userApprovalBytes,now=new Date().toISOString()}={}){
 if(plan?.planHash!==surveyPlanHash||!['supply','volume'].includes(kind)||!Buffer.isBuffer(reviewBytes)||reviewBytes.length>65536||supplyHash(reviewBytes)!==reviewHash||!Buffer.isBuffer(receiptBytes)||receiptBytes.length>131072)fail();
 parseHistorySource(reviewBytes);parseHistorySource(receiptBytes);
 const manifest=JSON.parse(reviewBytes),receipt=JSON.parse(receiptBytes),record=receipt.jobs?.find(j=>j.kind===kind);
 let sqlReview;
 if(manifest.kind==='ALLIUM_LIVE_REVIEWED_SQL_ECHO') {
  sqlReview=liveStoredReview({bytes,plan,kind,expectedHash,manifest,receipt,receiptBytes,executionAuthorizationBytes,userApprovalBytes});
 } else {
  if(executionAuthorizationBytes!==undefined||userApprovalBytes!==undefined||manifest.schemaVersion!==1||manifest.kind!=='ALLIUM_REVIEWED_SQL_ECHO'||manifest.planHash!==plan.planHash||manifest.receiptHash!==supplyHash(receiptBytes)||!Array.isArray(manifest.reviews)||manifest.reviews.length>3||manifest.reviews.filter(r=>r.kind===kind).length!==1||receipt.kind!=='ALLIUM_SURVEY_RECEIPT'||receipt.planHash!==plan.planHash||receipt.state!=='UNKNOWN'||record?.sourceHash!==expectedHash||receipt.attempts?.[record.resultAttempt]?.responseHash!==expectedHash)fail();
  sqlReview=manifest.reviews.find(r=>r.kind===kind);
 }
 if(sqlReview.reviewStatus!=='SOURCE_REVIEWED')fail();
 const snapshot=validateSurveySnapshot(alliumSurveyResult(plan,kind,bytes,{expectedHash,now,sqlReview}));
 if(snapshot.sqlReviewStatus!=='SOURCE_REVIEWED')fail();
 const metadata={mapper:surveyMapper,kind,planHash:plan.planHash,sourceHash:expectedHash,reviewHash,receiptHash:manifest.receiptHash,queriedAt:snapshot.queriedAt,from:snapshot.window.from,to:'2026-10-22',projectionHash:supplyHash(snapshot)};
 return {...metadata,id:supplyHash(metadata),snapshot};
}

// Offline provenance checks only: no lease renewal, execution gate, key read or dispatch.
function liveStoredReview({bytes,plan,kind,expectedHash,manifest,receipt,receiptBytes,executionAuthorizationBytes,userApprovalBytes}) {
 if(!Buffer.isBuffer(bytes)||bytes.length>2097152||!Buffer.isBuffer(executionAuthorizationBytes)||!executionAuthorizationBytes.length||executionAuthorizationBytes.length>65536||
   !Buffer.isBuffer(userApprovalBytes)||!userApprovalBytes.length||userApprovalBytes.length>65536)fail();
 parseHistorySource(executionAuthorizationBytes);
 const a=JSON.parse(executionAuthorizationBytes),daily=dailyPlan({asOfDay:plan.asOfDay});
 const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 if(!hex(a.accountKeyHash)||!hex(a.legacyManifestHash)||typeof a.grantId!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(a.grantId))fail();
 const expected={schemaVersion:1,kind:'ALLIUM_USER_AUTHORIZED_LIVE_ONCE',mode:'USER_AUTHORIZED_LIVE_ONCE',grantId:a.grantId,
  authorizedAt:instant(a.authorizedAt),expiresAt:new Date(Date.parse(a.authorizedAt)+900000).toISOString(),day:daily.asOfDay,
  planHash:daily.planHash,targetsHash:dailyHash(daily.targets),window:daily.window,
  sqlHashes:Object.fromEntries(daily.jobs.map(j=>[j.kind,j.sqlHash])),resultLimits:Object.fromEntries(daily.jobs.map(j=>[j.kind,j.resultLimit])),
  accountKeyHash:a.accountKeyHash,approvalHash:supplyHash(userApprovalBytes),legacyManifestHash:a.legacyManifestHash,
  maxRuns:2,maxHttpRequests:26,maxReadRetries:0,maxPostRetries:0,scope:'LOCAL_MANUAL_ONCE',
  organizationIdentity:'UNKNOWN',otherPcExclusivity:'UNKNOWN',providerCapStatus:'UNCONFIRMED',overagesStatus:'UNCONFIRMED',costLimit:null,
  globalBudgetGuaranteed:false,transition:'TRANSITION_BLOCKED',pendingUnits:null,reservationBound:null,reconciledUnits:'0',costAttribution:'UNKNOWN',usageFinality:'UNKNOWN'};
 if(canonical(a)!==canonical(expected)||a.authorizedAt.slice(0,10)!==plan.asOfDay||
   canonical(daily.jobs)!==canonical(plan.jobs.filter(j=>j.kind!=='registry'))||canonical(daily.targets)!==canonical(plan.targets)||canonical(daily.window)!==canonical(plan.window))fail();
 const authorizationHash=supplyHash(executionAuthorizationBytes),record=receipt.jobs?.find(j=>j.kind===kind),job=daily.jobs.find(j=>j.kind===kind);
 if(manifest.schemaVersion!==1||manifest.planHash!==daily.planHash||manifest.authorizationHash!==authorizationHash||manifest.receiptHash!==supplyHash(receiptBytes)||
   receipt.kind!=='ALLIUM_LIVE_ONCE_RECEIPT'||receipt.state!=='UNKNOWN'||receipt.failure!=='SQL_ECHO_REVIEW_REQUIRED'||receipt.planHash!==daily.planHash||
   receipt.day!==plan.asOfDay||receipt.authorizationHash!==authorizationHash||canonical(receipt.authorization)!==canonical(a)||
   !Array.isArray(receipt.jobs)||receipt.jobs.length!==2||receipt.jobs.filter(j=>j.kind===kind).length!==1||record?.state!=='UNKNOWN'||
   record.sqlHash!==job.sqlHash||record.resultLimit!==job.resultLimit||record.sourceHash!==expectedHash||!Number.isInteger(record.resultAttempt)||
   !Array.isArray(receipt.attempts)||receipt.attempts.length>26||record.resultAttempt!==receipt.attempts.length-1)fail();
 const attempts=receipt.attempts;
 if(attempts.some((v,i)=>v.index!==i||v.httpStatus!==200||!hex(v.responseHash)||!['create','run','status','result'].includes(v.kind)||
   epochMicros(v.at)<epochMicros(a.authorizedAt)||epochMicros(v.at)>=epochMicros(a.expiresAt)||v.at.slice(0,10)!==a.day||
   i>0&&epochMicros(v.at)<epochMicros(attempts[i-1].at)))fail();
 let start=0;
 for(const [n,r]of receipt.jobs.entries()) {
  if(r.kind!==daily.jobs[n].kind||r.sqlHash!==daily.jobs[n].sqlHash||r.resultLimit!==daily.jobs[n].resultLimit)fail();
  if(r.resultAttempt===undefined){if(r.state!=='RESERVED'||r.queryId||r.runId||n===0||kind!=='supply')fail();continue;}
  const segment=attempts.slice(start,r.resultAttempt+1);
  if(!Number.isInteger(r.resultAttempt)||segment.length<4||segment.length>13||segment[0]?.kind!=='create'||segment[1]?.kind!=='run'||
    segment.at(-1)?.kind!=='result'||segment.slice(2,-1).some(v=>v.kind!=='status')||segment.at(-1).responseHash!==r.sourceHash||
    typeof r.queryId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(r.queryId)||typeof r.runId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(r.runId)||
    (r.kind===kind?r.state!=='UNKNOWN':r.state!=='SUCCEEDED'))fail();
  start=r.resultAttempt+1;
 }
 if(start!==attempts.length||attempts.at(-1)?.responseHash!==expectedHash||manifest.review?.kind!==kind)fail();
 // Keep the original run time distinct from this later offline review/import time.
 const review=manifest.review;
 if(review.planHash!==plan.planHash||review.requestSqlHash!==job.sqlHash||review.sourceHash!==expectedHash)fail();
 const raw=parseHistorySource(bytes),queriedAt=instant(raw.queried_at);
 if(raw.meta?.run_id!==record.runId||epochMicros(queriedAt)<epochMicros(a.authorizedAt)||epochMicros(queriedAt)>=epochMicros(a.expiresAt)||
   epochMicros(queriedAt)<epochMicros(attempts[kind==='supply'?1:receipt.jobs[0].resultAttempt+2].at)||
   epochMicros(queriedAt)>epochMicros(attempts.at(-1).at)||epochMicros(review.reviewedAt)<epochMicros(queriedAt))fail();
 return review;
}
