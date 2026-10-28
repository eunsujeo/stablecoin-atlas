import {retiredAlliumFetch,assertAlliumFixtureTransport} from './retired-allium.mjs';
import {readdir, lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {canonical, instant, epochMicros} from './market-db/plan.mjs';
import {boundedRead} from './evidence-store.mjs';
import {file, directory} from './allium-offline-files.mjs';
import {dailyPlan, verifyDailyPlan, eu} from './allium-daily-plan.mjs';
import {alliumPlan, alliumSurveyResult} from './allium-plan.mjs';
import {parseHistorySource} from './supply-history-source.mjs';
import {alliumHash, alliumExecutionStorage as io, alliumBoundedRequest, alliumReceiptView, withAlliumSendLock} from './allium-executor.mjs';

const fail = () => { throw Error('ALLIUM_LIVE_BLOCKED'); };
const risks = Object.freeze({organizationIdentity:'UNKNOWN',otherPcExclusivity:'UNKNOWN',providerCapStatus:'UNCONFIRMED',
  overagesStatus:'UNCONFIRMED',costLimit:null,globalBudgetGuaranteed:false,transition:'TRANSITION_BLOCKED',
  pendingUnits:null,reservationBound:null,reconciledUnits:'0',costAttribution:'UNKNOWN',usageFinality:'UNKNOWN'});
const hash = value => alliumHash(Buffer.from(canonical(value)));
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);

// Read all legacy bytes without changing their timestamps, modes, receipts or reservations.
// This is local preservation evidence, never a global organization budget assertion.
export async function liveLegacyManifest(root) {
  await directory(root);
  const entries=[];
  let bytes=0;
  async function walk(relative='') {
    const names=(await readdir(join(root,relative))).sort();
    for(const name of names) {
      if(!relative && ['reservation-lock','live-once'].includes(name))continue;
      const path=join(root,relative,name),key=relative?relative+'/'+name:name,s=await lstat(path);
      if(entries.length>=256||s.isSymbolicLink()||s.uid!==process.getuid())fail();
      if(s.isDirectory()) {
        await directory(path);entries.push({path:key,kind:'directory',mode:s.mode&0o777});await walk(key);
      } else {
        // Check ownership, permissions, links and byte bounds before reading raw bytes.
        await file(path,2097152);
        const raw=await boundedRead(path,2097152);bytes+=raw.length;if(bytes>67108864)fail();
        entries.push({path:key,kind:'file',mode:s.mode&0o777,size:raw.length,sha256:alliumHash(raw)});
      }
    }
  }
  await walk();
  return {kind:'ALLIUM_LOCAL_LEGACY_MANIFEST',entries};
}

export function liveAuthorization(plan,{apiKey,approvalBytes,legacyManifest,now,grantId=randomUUID()}) {
  verifyDailyPlan(plan);
  if(!apiKey||!Buffer.isBuffer(approvalBytes)||!approvalBytes.length||approvalBytes.length>65536||!uuid(grantId)||
    !Array.isArray(legacyManifest?.entries)||plan.asOfDay!==instant(now).slice(0,10))fail();
  return {schemaVersion:1,kind:'ALLIUM_USER_AUTHORIZED_LIVE_ONCE',mode:'USER_AUTHORIZED_LIVE_ONCE',grantId,
    authorizedAt:instant(now),expiresAt:new Date(Date.parse(now)+900000).toISOString(),day:plan.asOfDay,
    planHash:plan.planHash,targetsHash:hash(plan.targets),window:plan.window,
    sqlHashes:Object.fromEntries(plan.jobs.map(j=>[j.kind,j.sqlHash])),resultLimits:Object.fromEntries(plan.jobs.map(j=>[j.kind,j.resultLimit])),
    accountKeyHash:alliumHash(Buffer.from(apiKey)),approvalHash:alliumHash(approvalBytes),legacyManifestHash:hash(legacyManifest),
    maxRuns:2,maxHttpRequests:26,maxReadRetries:0,maxPostRetries:0,scope:'LOCAL_MANUAL_ONCE',...risks};
}

export function validateLiveAuthorization(plan,authorizationBytes,{apiKey,approvalBytes,legacyManifest,reviewedHash,now}) {
  if(!Buffer.isBuffer(authorizationBytes)||authorizationBytes.length>65536||alliumHash(authorizationBytes)!==reviewedHash)fail();
  const a=JSON.parse(authorizationBytes);
  const expected=liveAuthorization(plan,{apiKey,approvalBytes,legacyManifest,now:a.authorizedAt,grantId:a.grantId});
  if(canonical(a)!==canonical(expected)||epochMicros(now)<epochMicros(a.authorizedAt)||epochMicros(now)>=epochMicros(a.expiresAt)||
    now.slice(0,10)!==plan.asOfDay)fail();
  return a;
}

async function surveyPlan(day) {
  const metadata=JSON.parse(await boundedRead(new URL('../data/market-registration.json',import.meta.url),262144));
  const legacy=JSON.parse(await boundedRead(new URL('../data/asset-registry.json',import.meta.url),131072));
  return alliumPlan(metadata,legacy,{asOfDay:day});
}

export const executeLiveOnce = (plan,options) => liveExecution(plan,options,false);
export const resumeLiveOnce = (plan,options) => liveExecution(plan,options,true);
async function liveExecution(plan,options,resume) {
  assertAlliumFixtureTransport(options.fetcher);
  verifyDailyPlan(plan);
  const {root,authorizationBytes,approvalBytes,apiKey,reviewedHash}=options;
  const deps={apiKey,fetcher:options.fetcher??retiredAlliumFetch,now:options.now??(()=>new Date().toISOString()),
    sleep:options.sleep??(ms=>new Promise(r=>setTimeout(r,ms)))};
  return withAlliumSendLock(root,async()=>{
    const legacyManifest=await liveLegacyManifest(root);
    const authorization=validateLiveAuthorization(plan,authorizationBytes,{apiKey,approvalBytes,legacyManifest,reviewedHash,now:deps.now()});
    const originalPlan=await surveyPlan(plan.asOfDay);
    const archive=join(root,'live-once');
    let receipt;
    if(resume) {
      receipt=await reviewedLiveCheckpoint(archive,plan,originalPlan,authorization,options,deps.now());
    } else {
    // Global to this root, independent of key, date, lease or a newly generated grant ID.
    // A failed mkdir, partial publication or crash never permits a second reservation.
    await io.exclusiveDirectory(archive);
    await io.durableFile(join(archive,'reservation.json'),Buffer.from(canonical({kind:'ALLIUM_LIVE_ONCE_CONSUMED',grantId:authorization.grantId,
      authorizationHash:reviewedHash,planHash:plan.planHash,...risks})));
    await io.durableFile(join(archive,'authorization.json'),authorizationBytes);
    await io.durableFile(join(archive,'user-approval'),approvalBytes);
    await io.durableFile(join(archive,'legacy-manifest.json'),Buffer.from(canonical(legacyManifest)));
    await io.durableFile(join(archive,'plan.json'),Buffer.from(canonical(plan)));
    receipt={schemaVersion:1,kind:'ALLIUM_LIVE_ONCE_RECEIPT',day:plan.asOfDay,planHash:plan.planHash,
      authorizationHash:reviewedHash,authorization,window:plan.window,...risks,state:'RESERVED',attempts:[],
      jobs:plan.jobs.map(j=>({kind:j.kind,sqlHash:j.sqlHash,resultLimit:j.resultLimit,state:'RESERVED'}))};
    await io.snapshot(join(archive,'receipt.json'),receipt);
    }
    for(const job of plan.jobs) {
      const record=receipt.jobs.find(j=>j.kind===job.kind);
      if(record.state==='SUCCEEDED')continue;
      try {
        record.state='DISPATCHING';receipt.state='DISPATCHING';
        const q=await alliumBoundedRequest(receipt,archive,'create','explorer/queries',
          {title:`Atlas user authorized live ${job.kind} ${plan.asOfDay}`,config:{sql:job.sql,limit:job.resultLimit}},deps);
        record.queryId=reference(q.value.query_id??q.value.id);
        const run=await alliumBoundedRequest(receipt,archive,'run',`explorer/queries/${record.queryId}/run-async`,
          {parameters:{},run_config:{limit:job.resultLimit}},deps);
        record.runId=reference(run.value.run_id);record.state='RUNNING';receipt.state='RUNNING';
        let success=false;
        for(let i=0;i<10;i++) {
          await deps.sleep(2000);
          const response=await alliumBoundedRequest(receipt,archive,'status',`explorer/query-runs/${record.runId}/status`,null,deps);
          const state=typeof response.value==='string'?response.value:response.value.status;
          if(state==='success'){success=true;break;}
          if(['failed','canceled'].includes(state)){record.state='FAILED';receipt.state='FAILED';break;}
          if(!['created','queued','running'].includes(state))fail();
        }
        if(!success){if(record.state!=='FAILED'){record.state='UNKNOWN';receipt.state='UNKNOWN';}receipt.failure='RUN_NOT_CONFIRMED';break;}
        const result=await alliumBoundedRequest(receipt,archive,'result',`explorer/query-runs/${record.runId}/results`,null,deps);
        record.sourceHash=alliumHash(result.bytes);record.resultAttempt=result.attempt.index;
        const raw=parseHistorySource(result.bytes);
        // Observation only. It is never deducted or interpreted as a future bound.
        try {eu(raw.meta?.cost_explorer_units);record.observedUnits=raw.meta.cost_explorer_units;}catch{record.observedUnits=null;}
        if(!Array.isArray(result.value.data))fail();
        if(result.value.data.length>=job.resultLimit){record.state='TRUNCATED';receipt.state='TRUNCATED';receipt.failure='RESULT_TRUNCATED';break;}
        if(result.value.sql!==job.sql){receipt.failure='SQL_ECHO_REVIEW_REQUIRED';fail();}
        const projection=alliumSurveyResult(originalPlan,job.kind,result.bytes,{expectedHash:record.sourceHash,now:deps.now()});
        await io.durableFile(join(archive,job.kind+'-projection.json'),Buffer.from(canonical(projection)));
        record.queriedAt=projection.queriedAt;record.state='SUCCEEDED';
        await io.snapshot(join(archive,'receipt.json'),receipt);
      }catch {record.state='UNKNOWN';receipt.state='UNKNOWN';receipt.failure??='REQUEST_OR_EVIDENCE_UNCONFIRMED';break;}
    }
    if(receipt.jobs.every(j=>j.state==='SUCCEEDED'))receipt.state='SUCCEEDED';
    receipt.legacyPreserved=hash(await liveLegacyManifest(root))===authorization.legacyManifestHash;
    if(!receipt.legacyPreserved){receipt.state='UNKNOWN';receipt.failure='LEGACY_CHANGED';}
    await io.snapshot(join(archive,'receipt.json'),receipt);
    return {...alliumReceiptView(receipt),legacyPreserved:receipt.legacyPreserved};
  },{live:true});
}

async function reviewedLiveCheckpoint(archive,plan,originalPlan,authorization,options,now) {
  const {authorizationBytes,approvalBytes,reviewedHash,sqlReviewBytes,reviewedSqlReviewHash}=options;
  if(!Buffer.isBuffer(sqlReviewBytes)||sqlReviewBytes.length>65536||alliumHash(sqlReviewBytes)!==reviewedSqlReviewHash)fail();
  const bytes=Buffer.from(await file(join(archive,'receipt.json'),131072)),receipt=JSON.parse(bytes),manifest=JSON.parse(sqlReviewBytes);
  const reservation=JSON.parse(await file(join(archive,'reservation.json'),65536));
  if(receipt.kind!=='ALLIUM_LIVE_ONCE_RECEIPT'||receipt.state!=='UNKNOWN'||receipt.failure!=='SQL_ECHO_REVIEW_REQUIRED'||
    receipt.planHash!==plan.planHash||receipt.day!==plan.asOfDay||receipt.authorizationHash!==reviewedHash||
    canonical(receipt.authorization)!==canonical(authorization)||reservation.authorizationHash!==reviewedHash||reservation.grantId!==authorization.grantId||
    alliumHash(Buffer.from(await file(join(archive,'authorization.json'),65536)))!==alliumHash(authorizationBytes)||
    alliumHash(Buffer.from(await file(join(archive,'user-approval'),65536)))!==alliumHash(approvalBytes)||
    canonical(JSON.parse(await file(join(archive,'plan.json'),131072)))!==canonical(plan)||
    manifest.schemaVersion!==1||manifest.kind!=='ALLIUM_LIVE_REVIEWED_SQL_ECHO'||manifest.planHash!==plan.planHash||
    manifest.authorizationHash!==reviewedHash||manifest.receiptHash!==alliumHash(bytes)||
    !Array.isArray(receipt.attempts)||receipt.attempts.length>26||!Array.isArray(receipt.jobs)||receipt.jobs.length!==2)fail();
  for(const [n,a]of receipt.attempts.entries()) {
    const intent=JSON.parse(await file(join(archive,`intent-${n}.json`),8192));
    if(a.index!==n||intent.index!==n||a.kind!==intent.kind||a.at!==intent.at||intent.responseHash!==null||intent.httpStatus!==null||
      a.httpStatus!==200||epochMicros(a.at)<epochMicros(authorization.authorizedAt)||epochMicros(a.at)>=epochMicros(authorization.expiresAt)||
      n&&epochMicros(a.at)<epochMicros(receipt.attempts[n-1].at)||
      alliumHash(await boundedRead(join(archive,`response-${n}.json`),2097152))!==a.responseHash)fail();
  }
  let start=0,checkpoint=null,reviewedProjection;
  for(const [n,j]of receipt.jobs.entries()) {
    const job=plan.jobs[n];
    if(j.kind!==job.kind||j.sqlHash!==job.sqlHash||j.resultLimit!==job.resultLimit)fail();
    if(j.resultAttempt===undefined){if(j.state!=='RESERVED'||j.queryId||j.runId||!checkpoint)fail();continue;}
    if(checkpoint||!['SUCCEEDED','UNKNOWN'].includes(j.state)||!Number.isInteger(j.resultAttempt))fail();
    const segment=receipt.attempts.slice(start,j.resultAttempt+1);
    if(segment.length<4||segment.length>13||segment[0]?.kind!=='create'||segment[1]?.kind!=='run'||segment.at(-1)?.kind!=='result'||
      segment.slice(2,-1).some(a=>a.kind!=='status'))fail();
    const q=JSON.parse(await boundedRead(join(archive,`response-${start}.json`),2097152));
    const run=JSON.parse(await boundedRead(join(archive,`response-${start+1}.json`),2097152));
    if((q.query_id??q.id)!==j.queryId||run.run_id!==j.runId)fail();
    for(const a of segment.slice(2,-1)) {
      const response=JSON.parse(await boundedRead(join(archive,`response-${a.index}.json`),2097152)),state=typeof response==='string'?response:response.status;
      if(a===segment.at(-2)?state!=='success':!['created','queued','running'].includes(state))fail();
    }
    const source=await boundedRead(join(archive,`response-${j.resultAttempt}.json`),2097152);
    if(alliumHash(source)!==j.sourceHash||receipt.attempts[j.resultAttempt].responseHash!==j.sourceHash)fail();
    const sqlReview=j.state==='UNKNOWN'?manifest.review:j.sqlReview;
    const projection=alliumSurveyResult(originalPlan,j.kind,source,{expectedHash:j.sourceHash,now,sqlReview});
    if(j.state==='UNKNOWN') {
      if(manifest.review?.kind!==j.kind||manifest.review?.reviewStatus!=='SOURCE_REVIEWED')fail();
      checkpoint=j.kind;reviewedProjection=projection;
    }
    start=j.resultAttempt+1;
  }
  if(!checkpoint||start!==receipt.attempts.length)fail();
  // A checkpoint only advances past a fully received, individually reviewed result.
  // The original lease and consumed grant remain unchanged; no prior POST is replayed.
  await io.exclusiveDirectory(join(archive,'resume-'+checkpoint));
  if(alliumHash(await boundedRead(join(archive,'receipt.json'),131072))!==manifest.receiptHash)fail();
  await io.durableFile(join(archive,'receipt-before-review-'+checkpoint+'.json'),bytes);
  await io.durableFile(join(archive,'review-'+checkpoint+'.json'),sqlReviewBytes);
  await io.durableFile(join(archive,checkpoint+'-projection.json'),Buffer.from(canonical(reviewedProjection)));
  const record=receipt.jobs.find(j=>j.kind===checkpoint);
  record.state='SUCCEEDED';record.queriedAt=reviewedProjection.queriedAt;record.sqlReview=manifest.review;
  receipt.reviewHistory??=[];receipt.reviewHistory.push({checkpoint,originalState:'UNKNOWN',receiptHash:manifest.receiptHash,reviewHash:reviewedSqlReviewHash});
  delete receipt.failure;
  await io.snapshot(join(archive,'receipt.json'),receipt);
  return receipt;
}

function reference(value) {
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(value))fail();return value;
}

export async function liveStatus(root) {
  const receipt=JSON.parse(await file(join(root,'live-once','receipt.json'),131072));
  return {...alliumReceiptView(receipt),legacyPreserved:receipt.legacyPreserved??null};
}

export {dailyPlan};
