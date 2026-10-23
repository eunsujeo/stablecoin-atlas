import {mkdir, open, rename, lstat, realpath} from 'node:fs/promises';
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
    httpAttempts:receipt.attempts.length, completedResponses:receipt.attempts.filter(a=>a.responseHash).length,
    counts:Object.fromEntries(['usage','create','run','status','result'].map(kind=>[kind,receipt.attempts.filter(a=>a.kind===kind).length])),
    jobs:(receipt.jobs??[]).map(j=>({kind:j.kind,state:terminal.has(j.state)?j.state:'UNKNOWN',sourceHash:j.sourceHash??null,queriedAt:j.queriedAt??null,observedExplorerUnits:j.observedUnits??null})),
    observedUsage:receipt.observedUsage??null, databaseWrites:0};
}

async function request(receipt, directory, kind, path, body, deps) {
  if (receipt.attempts.length >= (receipt.kind==='ALLIUM_USAGE_RECEIPT'?1:39)) fail();
  if (receipt.authorization) {
    const now=epochMicros(deps.now());
    if (now<epochMicros(receipt.authorization.usageObservedAt) || now>=epochMicros(receipt.authorization.periodEnd) || now>=epochMicros(receipt.authorization.capPeriodEnd) || now-epochMicros(receipt.authorization.usageObservedAt)>3600n*1000000n) fail();
  }
  const attempt={index:receipt.attempts.length,kind,at:deps.now(),responseHash:null,httpStatus:null};
  receipt.attempts.push(attempt);
  // An intent is durable BEFORE dispatch. A lost response consumes its reservation forever.
  await durableFile(join(directory,`intent-${attempt.index}.json`),Buffer.from(JSON.stringify(attempt)));
  await snapshot(join(directory,'receipt.json'),receipt);
  const response=await deps.fetcher('https://api.allium.so/api/v1/'+path,{method:body?'POST':'GET',
    headers:{'X-API-KEY':deps.apiKey,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});
  let size=0; const chunks=[];
  for await (const chunk of response.body) {size+=chunk.length;if(size>2097152){await response.body.cancel?.().catch(()=>{});fail();}chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);
  // Raw error/success bodies are private; never propagate provider errors to stdout.
  await durableFile(join(directory,`response-${attempt.index}.json`),bytes);
  attempt.responseHash=alliumHash(bytes); attempt.httpStatus=response.status;
  await snapshot(join(directory,'receipt.json'),receipt);
  if (response.status!==200) fail();
  parseHistorySource(bytes);
  return {bytes,value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),attempt};
}
const dependencies = options => ({fetcher:options.fetcher??globalThis.fetch,now:options.now??(()=>new Date().toISOString()),sleep:options.sleep??(ms=>new Promise(r=>setTimeout(r,ms))),apiKey:options.apiKey});

export async function alliumUsage({root, ...options}) {
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

export async function executeAlliumSurvey(plan, {root,authorizationBytes,reviewedHash,usageBytes,controlsBytes,...options}) {
  await fixedPlan(plan);
  const deps=dependencies(options);
  const authorization=validateAlliumAuthorization(plan,authorizationBytes,{reviewedHash,usageBytes,controlsBytes,apiKey:deps.apiKey,now:deps.now()});
  await privateDirectory(root);
  const usageReceipt=JSON.parse(await boundedRead(join(root,'usage-'+plan.asOfDay,'receipt.json'),131072));
  if(usageReceipt.kind!=='ALLIUM_USAGE_RECEIPT'||usageReceipt.state!=='SUCCEEDED'||usageReceipt.accountKeyHash!==authorization.accountKeyHash||
    usageReceipt.attempts?.length!==1||usageReceipt.attempts[0].httpStatus!==200||usageReceipt.attempts[0].responseHash!==authorization.usageHash||
    instant(usageReceipt.attempts[0].at)!==authorization.usageObservedAt)fail();
  // One survey per account allocation period, and one per UTC day. Neither claim is removed.
  // Reserving the entire allowance is conservative: an unused/failed job never refunds it.
  const period=objectHash({account:authorization.accountScopeHash,start:authorization.periodStart,end:authorization.periodEnd});
  const periodDirectory=join(root,'period-'+period);
  await exclusiveDirectory(periodDirectory);
  await durableFile(join(periodDirectory,'reservation.json'),Buffer.from(JSON.stringify({kind:'ALLIUM_FULL_PERIOD_ALLOWANCE_RESERVED',planHash:plan.planHash,day:plan.asOfDay,authorization,at:deps.now()})));
  const directory=join(root,'survey-'+plan.asOfDay);
  await exclusiveDirectory(directory);
  const receipt={schemaVersion:1,kind:'ALLIUM_SURVEY_RECEIPT',planHash:plan.planHash,day:plan.asOfDay,mapper:plan.mapper,window:plan.window,
    deploymentsHash:objectHash(plan.targets),authorization,state:'RESERVED',attempts:[],
    jobs:plan.jobs.map(j=>({kind:j.kind,sqlHash:j.sqlHash,resultLimit:j.resultLimit,state:'RESERVED'}))};
  await durableFile(join(directory,'plan.json'),Buffer.from(JSON.stringify(plan)));
  await durableFile(join(directory,'authorization.json'),authorizationBytes);
  await durableFile(join(directory,'usage.json'),usageBytes);
  await durableFile(join(directory,'controls'),controlsBytes);
  await snapshot(join(directory,'receipt.json'),receipt);
  for (const job of plan.jobs) {
    const record=receipt.jobs.find(j=>j.kind===job.kind);
    try {
      receipt.state='DISPATCHING';record.state='DISPATCHING';
      const q=await request(receipt,directory,'create','explorer/queries',{title:`Atlas bounded survey ${job.kind} ${plan.asOfDay}`,config:{sql:job.sql,limit:job.resultLimit}},deps);
      record.queryId=id(q.value.query_id??q.value.id);
      const run=await request(receipt,directory,'run',`explorer/queries/${record.queryId}/run-async`,{parameters:{},run_config:{limit:job.resultLimit}},deps);
      record.runId=id(run.value.run_id); record.state='RUNNING';receipt.state='RUNNING';
      await snapshot(join(directory,'receipt.json'),receipt);
      let success=false;
      for(let i=0;i<10;i++) {
        await deps.sleep(2000);
        const status=await request(receipt,directory,'status',`explorer/query-runs/${record.runId}/status`,null,deps);
        const state=typeof status.value==='string'?status.value:status.value.status;
        if(state==='success'){success=true;break;}
        if(['failed','canceled'].includes(state)){record.state='FAILED';break;}
        if(!['created','queued','running'].includes(state)) fail();
      }
      if(!success){if(record.state!=='FAILED')record.state='UNKNOWN';receipt.state=record.state;break;}
      const result=await request(receipt,directory,'result',`explorer/query-runs/${record.runId}/results`,null,deps);
      record.sourceHash=alliumHash(result.bytes);record.resultAttempt=result.attempt.index;
      const raw=parseHistorySource(result.bytes);
      record.observedUnits=decimal(raw.meta?.cost_explorer_units)?raw.meta.cost_explorer_units:null;
      if(record.observedUnits!==null && units(record.observedUnits)>units(authorization.maxUnitsPerRun))fail();
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
  // At most 39 responses, fixed names. Never trust an archive path from provider/user JSON.
  for(let i=0;i<39;i++) {
    let bytes;
    try {bytes=await boundedRead(join(directory,`response-${i}.json`),2097152);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    if(alliumHash(bytes)!==expectedHash)continue;
    const intent=JSON.parse(await boundedRead(join(directory,`intent-${i}.json`),8192));
    if(intent.kind!=='result'||intent.index!==i)fail();
    return alliumSurveyResult(plan,kind,bytes,{expectedHash,now});
  }
  fail();
}
