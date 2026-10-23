import {mkdir, open, rename, lstat, realpath, readdir, rmdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {canonical, instant, epochMicros} from './market-db/plan.mjs';
import {boundedRead} from './evidence-store.mjs';
import {parseHistorySource} from './supply-history-source.mjs';
import {alliumPlan, alliumSurveyResult} from './allium-plan.mjs';

const fail = () => { throw Error('ALLIUM_EXECUTION_BLOCKED'); };
export const alliumHash = bytes => createHash('sha256').update(bytes).digest('hex');
const objectHash = value => alliumHash(Buffer.from(canonical(value)));
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const decimal = value => typeof value === 'string' && /^(0|[1-9]\d{0,20})(\.\d{1,18})?$/.test(value);
const units = value => { if (!decimal(value)) fail(); const [a,b=''] = value.split('.'); return BigInt(a) * 10n**18n + BigInt(b.padEnd(18,'0')); };
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) fail(); return value; };
const terminal = new Set(['SUCCEEDED','EMPTY','FAILED','TRUNCATED','UNKNOWN']);

async function syncDirectory(path) { const f = await open(path, 'r'); try { await f.sync(); } finally { await f.close(); } }
async function privateDirectory(path) {
  await mkdir(path, {recursive:true,mode:0o700});
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) || await realpath(path) !== resolve(path)) fail();
  await syncDirectory(path); await syncDirectory(resolve(path,'..')); await syncDirectory(resolve(path,'../..'));
}
async function exclusiveDirectory(path) { await mkdir(path,{mode:0o700}); await syncDirectory(resolve(path,'..')); }
async function durableFile(path, bytes) {
  const f = await open(path,'wx',0o600);
  try { await f.writeFile(bytes); await f.sync(); } finally { await f.close(); }
  await syncDirectory(resolve(path,'..'));
}
async function snapshot(path, value) {
  const temp = path+'.'+randomUUID()+'.tmp';
  await durableFile(temp, Buffer.from(JSON.stringify(value)));
  await rename(temp,path); await syncDirectory(resolve(path,'..'));
}
// Every CLI send path shares this lock, including usage and reviewed resumes.
// A crash leaves the lock in place. A consumed live exception closes legacy sends.
export async function withAlliumSendLock(root, action, {live = false} = {}) {
  await privateDirectory(root);
  const lock = join(root, 'reservation-lock');
  await exclusiveDirectory(lock);
  try {
    if (!live && (await readdir(root)).includes('live-once')) fail();
    return await action();
  } finally { await rmdir(lock); await syncDirectory(root); }
}
export const alliumExecutionStorage = {privateDirectory, exclusiveDirectory, durableFile, snapshot, syncDirectory};
function validPlan(plan) {
  const {planHash,...body} = plan;
  if (!hex(planHash) || objectHash(body) !== planHash || plan.mapper !== 'allium-survey-v1' || plan.jobs.length !== 3 || plan.budget.maxHttpRequests !== 39) fail();
  for (const kind of ['registry','supply','volume']) {
    const job = plan.jobs.find(j => j.kind === kind);
    if (!job || alliumHash(Buffer.from(job.sql)) !== job.sqlHash || job.resultLimit !== job.expectedMaxRows+1) fail();
  }
}
async function fixedPlan(plan) {
  const [metadata,legacy]=await Promise.all([boundedRead(new URL('../data/market-registration.json',import.meta.url),262144),boundedRead(new URL('../data/asset-registry.json',import.meta.url),131072)]);
  if(canonical(plan)!==canonical(alliumPlan(JSON.parse(metadata),JSON.parse(legacy),{asOfDay:plan.asOfDay})))fail();
}

// This is a reviewed attestation, not an API assertion that the provider enforces a cap.
// Its three evidence hashes must be reviewed outside this tool before execution.
export function validateAlliumAuthorization(plan, bytes, {reviewedHash, apiKey, usageBytes, controlsBytes, now = new Date().toISOString()}) {
  validPlan(plan);
  if (!hex(reviewedHash) || alliumHash(bytes) !== reviewedHash || !Buffer.isBuffer(usageBytes) || !Buffer.isBuffer(controlsBytes)) fail();
  const a = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const usage = parseHistorySource(usageBytes);
  const keyHash = alliumHash(Buffer.from(apiKey ?? ''));
  if (!apiKey || a.schemaVersion !== 1 || a.kind !== 'ALLIUM_REVIEWED_SURVEY_AUTHORIZATION' || a.planHash !== plan.planHash || a.accountKeyHash !== keyHash || !hex(a.accountScopeHash) ||
      a.usageHash !== alliumHash(usageBytes) || a.controlsHash !== alliumHash(controlsBytes) || !hex(a.controlsHash) || controlsBytes.length === 0 ||
      a.unit !== 'EXPLORER_UNIT' || a.providerHardCapIncludingInFlight !== true || a.exclusiveConsumer !== true || a.overagesDisabled !== true ||
      a.maxRuns !== 3 || a.maxHttpRequests !== 39 || a.reviewStatus !== 'MANUALLY_REVIEWED') fail();
  if (canonical(a.sqlHashes) !== canonical(Object.fromEntries(plan.jobs.map(j=>[j.kind,j.sqlHash]))) ||
      canonical(a.resultLimits) !== canonical(Object.fromEntries(plan.jobs.map(j=>[j.kind,j.resultLimit])))) fail();
  const at = epochMicros(now), reviewed = epochMicros(a.reviewedAt), observed = epochMicros(a.usageObservedAt);
  const start = instant(a.periodStart), end = instant(a.periodEnd), capStart=instant(a.capPeriodStart),capEnd=instant(a.capPeriodEnd);
  // A stale account view cannot authorize today's execution. All jobs must finish within this lease.
  if (reviewed > at || observed>reviewed || at-observed>3600n*1000000n || epochMicros(start)>at || epochMicros(end)<=at || epochMicros(capStart)>at || epochMicros(capEnd)<=at ||
      plan.asOfDay !== now.slice(0,10) || usage.allocation_period_start == null || usage.allocation_period_end == null ||
      instant(usage.allocation_period_start)!==start || instant(usage.allocation_period_end)!==end ||
      units(usage.allocation_amounts?.explorer_units) !== units(a.includedUnits) || units(usage.consumed_amounts?.explorer_units) !== units(a.consumedUnits)) fail();
  const reserved = units(a.maxUnitsPerRun)*3n;
  if (reserved<=0n || units(a.surveyBudgetUnits)<reserved || units(a.providerRemainingUnits)<reserved || units(a.providerRemainingUnits)>units(a.surveyBudgetUnits) ||
      units(a.includedUnits)-units(a.consumedUnits)<reserved) fail();
  return {authorizationHash:reviewedHash, accountKeyHash:keyHash, accountScopeHash:a.accountScopeHash, periodStart:start, periodEnd:end, capPeriodStart:capStart,capPeriodEnd:capEnd,reviewedAt:instant(a.reviewedAt),
    usageHash:a.usageHash, usageObservedAt:instant(a.usageObservedAt), controlsHash:a.controlsHash, reservedUnits:a.surveyBudgetUnits, maxUnitsPerRun:a.maxUnitsPerRun,
    unit:a.unit, maxRuns:3, maxHttpRequests:39};
}

export function alliumReceiptView(receipt) {
  return {kind:receipt.kind, planHash:receipt.planHash ?? null, day:receipt.day, state:terminal.has(receipt.state)?receipt.state:'UNKNOWN',
    ...(receipt.authorization?.mode==='MANUAL_UNCAPPED_SURVEY'?{executionMode:'MANUAL_UNCAPPED_SURVEY',providerCapStatus:'UNCONFIRMED',maxHttpRequests:156,maxRuns:3}:{}),
    ...(receipt.authorization?.mode==='USER_AUTHORIZED_LIVE_ONCE'?{executionMode:'USER_AUTHORIZED_LIVE_ONCE',providerCapStatus:'UNCONFIRMED',maxHttpRequests:26,maxRuns:2,
      costAttribution:'UNKNOWN',globalBudgetGuaranteed:false,transition:'TRANSITION_BLOCKED',pendingUnits:null,reservationBound:null,reconciledUnits:'0',
      failure:receipt.failure??null}:{}),
    httpAttempts:receipt.attempts.length, completedResponses:receipt.attempts.filter(a=>a.responseHash).length,
    counts:Object.fromEntries(['usage','create','run','status','result'].map(kind=>[kind,receipt.attempts.filter(a=>a.kind===kind).length])),
    jobs:(receipt.jobs??[]).map(j=>({kind:j.kind,state:terminal.has(j.state)?j.state:receipt.authorization?.mode==='USER_AUTHORIZED_LIVE_ONCE'&&j.state==='RESERVED'?'NOT_TESTED':'UNKNOWN',sourceHash:j.sourceHash??null,queriedAt:j.queriedAt??null,observedExplorerUnits:j.observedUnits??null,...(j.sqlReview?{sqlReviewStatus:'SOURCE_REVIEWED'}:{})})),
    observedUsage:receipt.observedUsage??null, databaseWrites:0};
}

async function request(receipt, directory, kind, path, body, deps) {
  if (receipt.attempts.length >= (receipt.kind==='ALLIUM_USAGE_RECEIPT'?1:receipt.authorization?.mode==='USER_AUTHORIZED_LIVE_ONCE'?26:receipt.authorization?.mode==='MANUAL_UNCAPPED_SURVEY'?156:39)) fail();
  if (receipt.authorization) {
    const now=epochMicros(deps.now());
    if(['MANUAL_UNCAPPED_SURVEY','USER_AUTHORIZED_LIVE_ONCE'].includes(receipt.authorization.mode)) {
      if(now<epochMicros(receipt.authorization.authorizedAt)||now>=epochMicros(receipt.authorization.expiresAt)||deps.now().slice(0,10)!==receipt.day)fail();
    } else if (now<epochMicros(receipt.authorization.usageObservedAt) || now>=epochMicros(receipt.authorization.periodEnd) || now>=epochMicros(receipt.authorization.capPeriodEnd) || now-epochMicros(receipt.authorization.usageObservedAt)>3600n*1000000n) fail();
  }
  const attempt={index:receipt.attempts.length,kind,at:deps.now(),responseHash:null,httpStatus:null};
  receipt.attempts.push(attempt);
  // An intent is durable BEFORE dispatch. A lost response consumes its reservation forever.
  await durableFile(join(directory,`intent-${attempt.index}.json`),Buffer.from(JSON.stringify(attempt)));
  await snapshot(join(directory,'receipt.json'),receipt);
  let response;
  try { response=await deps.fetcher('https://api.allium.so/api/v1/'+path,{method:body?'POST':'GET',
    headers:{'X-API-KEY':deps.apiKey,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)}); }
  catch(error) {
    const code=error?.cause?.code??error?.code;
    if(!body&&(['TimeoutError','AbortError'].includes(error?.name)||['ETIMEDOUT','ECONNRESET','EAI_AGAIN','ECONNREFUSED','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET'].includes(code)))throw Object.assign(Error('TRANSIENT_READ'),{retryable:true});
    throw Error('REQUEST_UNAVAILABLE');
  }
  let size=0; const chunks=[];
  for await (const chunk of response.body) {size+=chunk.length;if(size>2097152){await response.body.cancel?.().catch(()=>{});fail();}chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);
  // Raw error/success bodies are private; never propagate provider errors to stdout.
  await durableFile(join(directory,`response-${attempt.index}.json`),bytes);
  attempt.responseHash=alliumHash(bytes); attempt.httpStatus=response.status;
  await snapshot(join(directory,'receipt.json'),receipt);
  if (response.status!==200) {
    // POST rejection does not independently prove that a query run was not accepted.
    const proxyBlocked=response.headers.has('x-squid-error')||/access denied|unavailable for legal reasons/i.test(bytes.toString('utf8'));
    throw Object.assign(Error('HTTP_UNAVAILABLE'),{retryable:!body&&!proxyBlocked&&[408,429,500,502,503,504].includes(response.status),retryAfter:response.headers.get('retry-after')});
  }
  parseHistorySource(bytes);
  return {bytes,value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),attempt};
}
export const alliumBoundedRequest = request;
const dependencies = options => ({fetcher:options.fetcher??globalThis.fetch,now:options.now??(()=>new Date().toISOString()),sleep:options.sleep??(ms=>new Promise(r=>setTimeout(r,ms))),random:options.random??Math.random,apiKey:options.apiKey});

async function surveyRequest(receipt,directory,kind,path,body,deps) {
  for(let retry=0;;retry++) {
    try{return await request(receipt,directory,kind,path,body,deps);}
    catch(error) {
      if(receipt.authorization?.mode!=='MANUAL_UNCAPPED_SURVEY'||!error.retryable||retry>=3)throw error;
      let minimum=0;
      if(error.retryAfter!==null&&error.retryAfter!==undefined){
        if(/^\d+$/.test(error.retryAfter))minimum=Number(error.retryAfter)*1000;
        else {const date=Date.parse(error.retryAfter);if(!Number.isFinite(date))throw error;minimum=Math.max(0,date-Date.parse(deps.now()));}
      }
      const delay=Math.max(2000*2**retry+Math.floor(Math.max(0,Math.min(0.999999,deps.random()))*251),minimum);
      if(delay>60000)throw error;
      receipt.attempts.at(-1).retryDelayMs=delay;
      await snapshot(join(directory,'receipt.json'),receipt);
      await deps.sleep(delay);
    }
  }
}

export function validateAlliumManualAuthorization(plan,bytes,{reviewedHash,apiKey,usageBytes,approvalBytes,now}) {
  validPlan(plan);
  if(!apiKey||!Buffer.isBuffer(usageBytes)||!Buffer.isBuffer(approvalBytes)||!approvalBytes.length||alliumHash(bytes)!==reviewedHash)fail();
  const a=JSON.parse(bytes),at=epochMicros(now);
  if(a.schemaVersion!==1||a.kind!=='ALLIUM_MANUAL_UNCAPPED_SURVEY_AUTHORIZATION'||a.reviewStatus!=='USER_AUTHORIZED_UNCAPPED'||
    a.planHash!==plan.planHash||a.accountKeyHash!==alliumHash(Buffer.from(apiKey))||a.usageHash!==alliumHash(usageBytes)||a.approvalHash!==alliumHash(approvalBytes)||
    a.providerCapStatus!=='UNCONFIRMED'||a.costLimit!==null||a.overagesStatus!=='UNCONFIRMED'||a.maxRuns!==3||a.maxHttpRequests!==156||a.maxReadRetries!==3||
    a.usageObservedAt?.slice(0,10)!==plan.asOfDay||epochMicros(a.usageObservedAt)>epochMicros(a.authorizedAt)||epochMicros(a.authorizedAt)>at||epochMicros(a.expiresAt)<=at||
    epochMicros(a.expiresAt)-epochMicros(a.authorizedAt)!==900n*1000000n||plan.asOfDay!==now.slice(0,10)||
    canonical(a.sqlHashes)!==canonical(Object.fromEntries(plan.jobs.map(j=>[j.kind,j.sqlHash])))||canonical(a.resultLimits)!==canonical(Object.fromEntries(plan.jobs.map(j=>[j.kind,j.resultLimit]))))fail();
  parseHistorySource(usageBytes);
  return {...a,authorizedAt:instant(a.authorizedAt),expiresAt:instant(a.expiresAt),usageObservedAt:instant(a.usageObservedAt),mode:'MANUAL_UNCAPPED_SURVEY',authorizationHash:reviewedHash,usageContext:'SAVED_CONTEXT_ONLY_NOT_A_BUDGET_ASSERTION'};
}

// Called with the common send mutex held. Permanent reservations are never removed.
async function reserveSurvey(root,plan,authorization,manual) {
    const names=await readdir(root);
    if(names.includes('manual-once')||manual&&names.some(n=>n.startsWith('period-')||n.startsWith('survey-')))fail();
    const periodDirectory=manual?join(root,'manual-once'):join(root,'period-'+objectHash({account:authorization.accountScopeHash,start:authorization.periodStart,end:authorization.periodEnd}));
    await exclusiveDirectory(periodDirectory);
    await durableFile(join(periodDirectory,'reservation.json'),Buffer.from(JSON.stringify({kind:manual?'ALLIUM_MANUAL_UNCAPPED_ONCE_RESERVED':'ALLIUM_FULL_PERIOD_ALLOWANCE_RESERVED',planHash:plan.planHash,day:plan.asOfDay,authorization})));
    const directory=join(root,'survey-'+plan.asOfDay);await exclusiveDirectory(directory);return directory;
}

export const alliumUsage = options => withAlliumSendLock(options.root, () => usageUnlocked(options));
async function usageUnlocked({root, ...options}) {
  const deps=dependencies(options); if(!deps.apiKey)fail();
  await privateDirectory(root);
  const day=instant(deps.now()).slice(0,10), directory=join(root,'usage-'+day);
  await exclusiveDirectory(directory);
  const receipt={schemaVersion:1,kind:'ALLIUM_USAGE_RECEIPT',day,accountKeyHash:alliumHash(Buffer.from(deps.apiKey)),state:'RESERVED',attempts:[]};
  await snapshot(join(directory,'receipt.json'),receipt);
  try {
    const r=await request(receipt,directory,'usage','account/organization/usage',null,deps);
    const p=parseHistorySource(r.bytes);
    if(!p.billing_period_start || !p.billing_period_end || !p.allocation_amounts || !p.consumed_amounts) fail();
    receipt.observedUsage={billingPeriodStart:instant(p.billing_period_start),billingPeriodEnd:instant(p.billing_period_end),
      allocationPeriodStart:p.allocation_period_start==null?null:instant(p.allocation_period_start),
      allocationPeriodEnd:p.allocation_period_end==null?null:instant(p.allocation_period_end),
      includedExplorerUnits:decimal(p.allocation_amounts.explorer_units)?p.allocation_amounts.explorer_units:null,
      consumedExplorerUnits:decimal(p.consumed_amounts.explorer_units)?p.consumed_amounts.explorer_units:null,
      observedAt:r.attempt.at,sourceHash:r.attempt.responseHash,providerCapStatus:'UNCONFIRMED'};
    receipt.state='SUCCEEDED'; await snapshot(join(directory,'receipt.json'),receipt);
  } catch { receipt.state='UNKNOWN'; await snapshot(join(directory,'receipt.json'),receipt); }
  return alliumReceiptView(receipt);
}

export const executeAlliumSurvey=(plan,options)=>withAlliumSendLock(options.root,()=>executeSurvey(plan,options,false));
export const executeAlliumManualSurvey=(plan,options)=>withAlliumSendLock(options.root,()=>executeSurvey(plan,options,true));
export const resumeAlliumManualSurvey=(plan,options)=>withAlliumSendLock(options.root,()=>executeSurvey(plan,options,true,true));

async function reviewedCheckpoint(root,plan,authorization,authorizationBytes,approvalBytes,sqlReviewBytes,reviewedSqlReviewHash,now) {
  const directory=join(root,'survey-'+plan.asOfDay),bytes=await boundedRead(join(directory,'receipt.json'),131072),receipt=JSON.parse(bytes);
  if(!Buffer.isBuffer(sqlReviewBytes)||alliumHash(sqlReviewBytes)!==reviewedSqlReviewHash)fail();
  const manifest=JSON.parse(sqlReviewBytes),originalBytes=await boundedRead(join(directory,'authorization.json'),65536),original=JSON.parse(originalBytes);
  const reservation=JSON.parse(await boundedRead(join(root,'manual-once','reservation.json'),131072));
  if(manifest.kind!=='ALLIUM_REVIEWED_SQL_ECHO'||manifest.schemaVersion!==1||manifest.planHash!==plan.planHash||manifest.receiptHash!==alliumHash(bytes)||!Array.isArray(manifest.reviews)||manifest.reviews.length>3||
    receipt.kind!=='ALLIUM_SURVEY_RECEIPT'||receipt.state!=='UNKNOWN'||receipt.planHash!==plan.planHash||receipt.authorization.mode!=='MANUAL_UNCAPPED_SURVEY'||receipt.day!==plan.asOfDay||
    reservation.planHash!==plan.planHash||reservation.authorization.authorizationHash!==alliumHash(originalBytes)||original.approvalHash!==authorization.approvalHash||original.accountKeyHash!==authorization.accountKeyHash||original.usageHash!==authorization.usageHash||
    alliumHash(await boundedRead(join(directory,'user-approval'),2097152))!==authorization.approvalHash||alliumHash(approvalBytes)!==authorization.approvalHash||
    canonical(JSON.parse(await boundedRead(join(directory,'plan.json'),131072)))!==canonical(plan)||receipt.attempts.length>=156)fail();
  for(const [i,a]of receipt.attempts.entries()) {
    const intent=JSON.parse(await boundedRead(join(directory,`intent-${i}.json`),8192));
    if(a.index!==i||intent.index!==i||intent.kind!==a.kind||intent.at!==a.at||intent.responseHash!==null||a.httpStatus!==200||
      alliumHash(await boundedRead(join(directory,`response-${i}.json`),2097152))!==a.responseHash)fail();
  }
  const executed=receipt.jobs.filter(j=>j.resultAttempt!==undefined),posts=receipt.attempts.filter(a=>a.kind==='create');
  if(!executed.length||executed.length>3||posts.length!==executed.length||receipt.attempts.filter(a=>a.kind==='run').length!==executed.length||receipt.attempts.at(-1)?.kind!=='result')fail();
  let start=0;const projections=[];
  for(const [i,j]of receipt.jobs.entries()) {
    if(i>=executed.length){if(j.state!=='RESERVED'||j.queryId||j.runId)fail();continue;}
    if(j.kind!==plan.jobs[i].kind||j.sqlHash!==plan.jobs[i].sqlHash||j.resultLimit!==plan.jobs[i].resultLimit||!['SUCCEEDED','UNKNOWN'].includes(j.state)||i<executed.length-1&&j.state!=='SUCCEEDED'||i===executed.length-1&&j.state!=='UNKNOWN')fail();
    const segment=receipt.attempts.slice(start,j.resultAttempt+1),q=JSON.parse(await boundedRead(join(directory,`response-${start}.json`),2097152)),run=JSON.parse(await boundedRead(join(directory,`response-${start+1}.json`),2097152));
    if(segment[0]?.kind!=='create'||segment[1]?.kind!=='run'||segment.at(-1)?.kind!=='result'||segment.slice(2,-1).some(a=>a.kind!=='status')||segment.length<4||segment.length>43||
      (q.query_id??q.id)!==j.queryId||run.run_id!==j.runId||receipt.attempts[j.resultAttempt]?.responseHash!==j.sourceHash)fail();
    const lastStatus=JSON.parse(await boundedRead(join(directory,`response-${j.resultAttempt-1}.json`),2097152));if((typeof lastStatus==='string'?lastStatus:lastStatus.status)!=='success')fail();
    const raw=await boundedRead(join(directory,`response-${j.resultAttempt}.json`),2097152),sqlReview=manifest.reviews.find(r=>r.kind===j.kind);
    projections.push(alliumSurveyResult(plan,j.kind,raw,{expectedHash:j.sourceHash,now,sqlReview}));start=j.resultAttempt+1;
  }
  if(start!==receipt.attempts.length)fail();
  const checkpoint=executed.at(-1).kind;
  // Each reviewed result gets one permanent checkpoint; a crash cannot dispatch twice.
  await exclusiveDirectory(join(directory,'resume-'+checkpoint));
  if(alliumHash(await boundedRead(join(directory,'receipt.json'),131072))!==manifest.receiptHash)fail();
  await durableFile(join(directory,'receipt-before-review-'+checkpoint+'.json'),bytes);
  await durableFile(join(directory,'sql-review-'+checkpoint+'.json'),sqlReviewBytes);
  await durableFile(join(directory,'authorization-after-review-'+checkpoint+'.json'),authorizationBytes);
  receipt.reviewHistory??=[];receipt.reviewHistory.push({checkpoint,previousState:receipt.state,receiptHash:manifest.receiptHash,reviewHash:reviewedSqlReviewHash,previousAuthorizationHash:receipt.authorization.authorizationHash});
  receipt.authorization=authorization;
  for(const [i,projection]of projections.entries()){receipt.jobs[i].state='SUCCEEDED';receipt.jobs[i].queriedAt=projection.queriedAt;receipt.jobs[i].sqlReview=manifest.reviews.find(r=>r.kind===receipt.jobs[i].kind)??null;}
  receipt.state='RUNNING';await snapshot(join(directory,'receipt.json'),receipt);return {directory,receipt};
}

async function executeSurvey(plan, {root,authorizationBytes,reviewedHash,usageBytes,controlsBytes,approvalBytes,sqlReviewBytes,reviewedSqlReviewHash,...options},manual,resume=false) {
  await fixedPlan(plan);
  const deps=dependencies(options);
  const authorization=(manual?validateAlliumManualAuthorization:validateAlliumAuthorization)(plan,authorizationBytes,{reviewedHash,usageBytes,controlsBytes,approvalBytes,apiKey:deps.apiKey,now:deps.now()});
  await privateDirectory(root);
  const usageReceipt=JSON.parse(await boundedRead(join(root,'usage-'+plan.asOfDay,'receipt.json'),131072));
  if(usageReceipt.kind!=='ALLIUM_USAGE_RECEIPT'||usageReceipt.state!=='SUCCEEDED'||usageReceipt.accountKeyHash!==authorization.accountKeyHash||
    usageReceipt.attempts?.length!==1||usageReceipt.attempts[0].httpStatus!==200||usageReceipt.attempts[0].responseHash!==authorization.usageHash||
    instant(usageReceipt.attempts[0].at)!==authorization.usageObservedAt)fail();
  // One survey per account allocation period, and one per UTC day. Neither claim is removed.
  // Reserving the entire allowance is conservative: an unused/failed job never refunds it.
  let directory,receipt;
  if(resume)({directory,receipt}=await reviewedCheckpoint(root,plan,authorization,authorizationBytes,approvalBytes,sqlReviewBytes,reviewedSqlReviewHash,deps.now()));
  else {
  directory=await reserveSurvey(root,plan,authorization,manual);
  receipt={schemaVersion:1,kind:'ALLIUM_SURVEY_RECEIPT',planHash:plan.planHash,day:plan.asOfDay,mapper:plan.mapper,window:plan.window,
    deploymentsHash:objectHash(plan.targets),authorization,state:'RESERVED',attempts:[],
    jobs:plan.jobs.map(j=>({kind:j.kind,sqlHash:j.sqlHash,resultLimit:j.resultLimit,state:'RESERVED'}))};
  await durableFile(join(directory,'plan.json'),Buffer.from(JSON.stringify(plan)));
  await durableFile(join(directory,'authorization.json'),authorizationBytes);
  await durableFile(join(directory,'usage.json'),usageBytes);
  await durableFile(join(directory,manual?'user-approval':'controls'),manual?approvalBytes:controlsBytes);
  await snapshot(join(directory,'receipt.json'),receipt);
  }
  for (const job of plan.jobs) {
    const record=receipt.jobs.find(j=>j.kind===job.kind);
    if(record.state==='SUCCEEDED')continue;
    try {
      receipt.state='DISPATCHING';record.state='DISPATCHING';
      const q=await surveyRequest(receipt,directory,'create','explorer/queries',{title:`Atlas bounded survey ${job.kind} ${plan.asOfDay}`,config:{sql:job.sql,limit:job.resultLimit}},deps);
      record.queryId=id(q.value.query_id??q.value.id);
      const run=await surveyRequest(receipt,directory,'run',`explorer/queries/${record.queryId}/run-async`,{parameters:{},run_config:{limit:job.resultLimit}},deps);
      record.runId=id(run.value.run_id); record.state='RUNNING';receipt.state='RUNNING';
      await snapshot(join(directory,'receipt.json'),receipt);
      let success=false;
      for(let i=0;i<10;i++) {
        await deps.sleep(2000);
        const status=await surveyRequest(receipt,directory,'status',`explorer/query-runs/${record.runId}/status`,null,deps);
        const state=typeof status.value==='string'?status.value:status.value.status;
        if(state==='success'){success=true;break;}
        if(['failed','canceled'].includes(state)){record.state='FAILED';break;}
        if(!['created','queued','running'].includes(state)) fail();
      }
      if(!success){if(record.state!=='FAILED')record.state='UNKNOWN';receipt.state=record.state;break;}
      const result=await surveyRequest(receipt,directory,'result',`explorer/query-runs/${record.runId}/results`,null,deps);
      record.sourceHash=alliumHash(result.bytes);record.resultAttempt=result.attempt.index;
      const raw=parseHistorySource(result.bytes);
      record.observedUnits=decimal(raw.meta?.cost_explorer_units)?raw.meta.cost_explorer_units:null;
      if(!manual&&record.observedUnits!==null && units(record.observedUnits)>units(authorization.maxUnitsPerRun))fail();
      if(!Array.isArray(result.value.data))fail();
      if(result.value.data.length>=job.resultLimit){record.state='TRUNCATED';receipt.state='TRUNCATED';break;}
      // Empty LEFT JOIN results cannot be a complete response for our approved deployments.
      const projection=alliumSurveyResult(plan,job.kind,result.bytes,{expectedHash:record.sourceHash,now:deps.now()});
      record.queriedAt=projection.queriedAt;record.state='SUCCEEDED';
      await snapshot(join(directory,'receipt.json'),receipt);
    } catch { record.state='UNKNOWN';receipt.state='UNKNOWN';break; }
  }
  if(receipt.jobs.every(j=>j.state==='SUCCEEDED'))receipt.state='SUCCEEDED';
  await snapshot(join(directory,'receipt.json'),receipt);
  return alliumReceiptView(receipt);
}

// Offline recovery can validate archived bytes, including a crash after archive-before-snapshot.
// It never changes receipts, releases reservations, creates runs, or imports a database.
export async function reviewAlliumArchive(plan, {root,kind,expectedHash,now=new Date().toISOString()}) {
  await fixedPlan(plan);
  validPlan(plan); if(!hex(expectedHash)||!plan.jobs.some(j=>j.kind===kind))fail();
  const directory=join(root,'survey-'+plan.asOfDay);
  const saved=JSON.parse(await boundedRead(join(directory,'plan.json'),131072));
  if(canonical(saved)!==canonical(plan))fail();
  const receipt=JSON.parse(await boundedRead(join(directory,'receipt.json'),131072));
  if(receipt.planHash!==plan.planHash)fail();
  // Fixed names only; manual backoff has a separately recorded HTTP allowance.
  for(let i=0;i<(receipt.authorization?.mode==='MANUAL_UNCAPPED_SURVEY'?156:39);i++) {
    let bytes;
    try {bytes=await boundedRead(join(directory,`response-${i}.json`),2097152);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    if(alliumHash(bytes)!==expectedHash)continue;
    const intent=JSON.parse(await boundedRead(join(directory,`intent-${i}.json`),8192));
    if(intent.kind!=='result'||intent.index!==i)fail();
    return alliumSurveyResult(plan,kind,bytes,{expectedHash,now});
  }
  fail();
}
