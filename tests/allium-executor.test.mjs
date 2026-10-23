import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,realpath,rm,writeFile,stat,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {canonical} from '../tools/market-db/plan.mjs';
import {alliumPlan} from '../tools/allium-plan.mjs';
import {alliumUsage,executeAlliumSurvey,reviewAlliumArchive,alliumReceiptView,alliumHash,validateAlliumAuthorization} from '../tools/allium-executor.mjs';
import {executionArguments} from '../tools/allium-execute-cli.mjs';

const metadata=JSON.parse(await readFile(new URL('../data/market-registration.json',import.meta.url)));
const legacy=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url)));
const p=alliumPlan(metadata,legacy,{asOfDay:'2026-10-23'}), at='2026-10-23T08:00:00.000Z', now=()=>at, apiKey='private-test-key';
const usageBytes=Buffer.from('{"billing_period_start":"2026-10-01T00:00:00Z","billing_period_end":"2026-11-01T00:00:00Z","allocation_period_start":"2026-10-01T00:00:00Z","allocation_period_end":"2026-11-01T00:00:00Z","allocation_amounts":{"explorer_units":100},"consumed_amounts":{"explorer_units":1.123456789012345678}}');
const controlsBytes=Buffer.from('TEST ONLY: reviewed isolated provider hard cap and cost envelope; not production evidence.');
function authorization(mutate=()=>{}) {
  const a={schemaVersion:1,kind:'ALLIUM_REVIEWED_SURVEY_AUTHORIZATION',planHash:p.planHash,accountKeyHash:alliumHash(Buffer.from(apiKey)),accountScopeHash:alliumHash(Buffer.from('test-organization')),
    usageHash:alliumHash(usageBytes),controlsHash:alliumHash(controlsBytes),unit:'EXPLORER_UNIT',providerHardCapIncludingInFlight:true,exclusiveConsumer:true,overagesDisabled:true,
    maxRuns:3,maxHttpRequests:39,reviewStatus:'MANUALLY_REVIEWED',reviewedAt:at,usageObservedAt:at,
    periodStart:'2026-10-01T00:00:00Z',periodEnd:'2026-11-01T00:00:00Z',capPeriodStart:'2026-10-01T00:00:00Z',capPeriodEnd:'2026-11-01T00:00:00Z',includedUnits:'100',consumedUnits:'1.123456789012345678',
    maxUnitsPerRun:'0.2',surveyBudgetUnits:'1',providerRemainingUnits:'1',
    sqlHashes:Object.fromEntries(p.jobs.map(j=>[j.kind,j.sqlHash])),resultLimits:Object.fromEntries(p.jobs.map(j=>[j.kind,j.resultLimit]))};
  mutate(a); const authorizationBytes=Buffer.from(JSON.stringify(a));
  return {authorizationBytes,reviewedHash:alliumHash(authorizationBytes),usageBytes,controlsBytes,apiKey,now,sleep:async()=>{}};
}
function response(kind) {
  const data=p.targets.filter(t=>t.family!=='XRPL').map(t=>({deployment_id:t.deploymentId,coin_id:t.coinId,requested_chain:t.networkId,requested_address:t.identity.address,
    observed_chain:null,observed_address:null,...(kind==='registry'?{product_id:null,currency:null,decimals_str:null,is_native:null,is_verified:null}:
      kind==='supply'?{provider_day:null,total_supply_str:null,circulating_supply_str:null,adjusted_circulating_supply_str:null,total_supply_usd_str:null,circulating_supply_usd_str:null,adjusted_circulating_supply_usd_str:null,is_native:null}:
      {provider_day:null,transfer_volume_str:null,transfer_volume_usd_str:null,transfer_count_str:null,transfer_tx_count_str:null,adjusted_volume_usd_str:null,has_adjusted_volume:null})}));
  return {sql:p.jobs.find(j=>j.kind===kind).sql,data,meta:{row_count:data.length,cost_explorer_units:0.123456},queried_at:at};
}
function mock({resultMutation=()=>{},failureAt=-1,status='success',before=async()=>{}}={}) {
  const calls=[];
  const fetcher=async(url,options)=>{
    const n=calls.length;calls.push({url,options});await before(n);
    if(n===failureAt)throw Error('provider-secret-key-and-rpc-url');
    const path=new URL(url).pathname;
    let value;
    if(path.endsWith('/usage'))return new Response(usageBytes);
    if(path.endsWith('/queries'))value={query_id:'private-query-'+(calls.filter(c=>c.url.endsWith('/queries')).length-1)};
    else if(path.endsWith('/run-async'))value={run_id:path.split('/').at(-2)};
    else if(path.endsWith('/status'))value=status;
    else if(path.endsWith('/results')) {const i=Number(path.split('/').at(-2).split('-').at(-1));value=response(p.jobs[i].kind);resultMutation(value);}
    else throw Error('UNEXPECTED_ENDPOINT');
    return new Response(JSON.stringify(value));
  };return {fetcher,calls};
}
async function sandbox(t) {const root=await realpath(await mkdtemp(join(tmpdir(),'allium-executor-')));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
async function setup(t,options={}) {const root=await sandbox(t),net=mock(options);await alliumUsage({root,apiKey,now,fetcher:net.fetcher});net.calls.length=0;return {root,...net,...authorization()};}

test('authorization binds exact SQL, limits, key, fresh observed usage and reviewed provider controls before any dispatch',()=>{
  const valid=authorization();const check=o=>validateAlliumAuthorization(p,o.authorizationBytes,{...o,now:o.now()});
  assert.equal(check(valid).reservedUnits,'1');
  for(const mutate of [a=>a.planHash='0'.repeat(64),a=>a.accountKeyHash='0'.repeat(64),a=>a.providerHardCapIncludingInFlight=false,a=>a.exclusiveConsumer=false,
    a=>a.overagesDisabled=false,a=>a.controlsHash='0'.repeat(64),a=>a.usageHash='0'.repeat(64),a=>a.sqlHashes.supply='0'.repeat(64),a=>a.resultLimits.volume=77,
    a=>a.maxRuns=4,a=>a.maxHttpRequests=40,a=>a.periodEnd='2026-10-23T07:59:59Z',a=>a.capPeriodEnd='2026-10-23T07:59:59Z',a=>a.reviewedAt='2026-10-23T09:00:00Z',a=>a.usageObservedAt='2026-10-23T06:59:59Z',
    a=>a.consumedUnits='1.123456789012345679',a=>a.surveyBudgetUnits='0.2',a=>a.providerRemainingUnits='2',a=>a.maxUnitsPerRun=0.1])assert.throws(()=>check(authorization(mutate)));
  assert.throws(()=>check({...valid,reviewedHash:'0'.repeat(64)}));
  assert.throws(()=>check({...valid,now:()=> '2026-10-24T08:00:00Z'}));
});

test('usage is a single durable attempt, preserves numeric lexemes and does not certify a provider cap',async t=>{
  const root=await sandbox(t),net=mock();
  const result=await alliumUsage({root,apiKey,now,fetcher:net.fetcher});
  assert.equal(result.state,'SUCCEEDED');assert.equal(result.httpAttempts,1);assert.equal(result.observedUsage.consumedExplorerUnits,'1.123456789012345678');
  assert.equal(result.observedUsage.providerCapStatus,'UNCONFIRMED');
  await assert.rejects(()=>alliumUsage({root,apiKey,now,fetcher:net.fetcher}));assert.equal(net.calls.length,1);
  assert.equal((await stat(join(root,'usage-2026-10-23','response-0.json'))).mode&0o777,0o600);
});

test('three successful survey runs archive raw bytes before projection, bind API limits and recover offline without changing receipts',async t=>{
  const o=await setup(t),result=await executeAlliumSurvey(p,o);
  assert.equal(result.state,'SUCCEEDED');assert.deepEqual(result.counts,{usage:0,create:3,run:3,status:3,result:3});assert.equal(result.httpAttempts,12);
  for(const c of o.calls){assert.equal(c.options.redirect,'error');assert(c.options.signal);if(c.options.body){const body=JSON.parse(c.options.body);const limit=body.config?.limit??body.run_config.limit;assert([12,78].includes(limit));}}
  const directory=join(o.root,'survey-'+p.asOfDay),bytes=await readFile(join(directory,'receipt.json'));
  const privateReceipt=JSON.parse(bytes);assert.equal(privateReceipt.jobs[0].observedUnits,'0.123456');
  for(const job of result.jobs){const projection=await reviewAlliumArchive(p,{root:o.root,kind:job.kind,expectedHash:job.sourceHash,now:at});assert(projection.rows.every(r=>r.state==='INCONCLUSIVE'));}
  assert.deepEqual(await readFile(join(directory,'receipt.json')),bytes);
  assert(!JSON.stringify(result).includes('private'));assert(!JSON.stringify(result).includes('SELECT'));assert.equal(result.databaseWrites,0);
  await assert.rejects(()=>executeAlliumSurvey(p,o));assert.equal(o.calls.length,12);
});

test('concurrent processes share a permanent allowance and cannot create two surveys',async t=>{
  const o=await setup(t),results=await Promise.allSettled([executeAlliumSurvey(p,o),executeAlliumSurvey(p,o)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(o.calls.filter(c=>c.url.endsWith('/run-async')).length,3);
});

test('a different day or plan cannot reuse the account-period allowance',async t=>{
  const o=await setup(t);await executeAlliumSurvey(p,o);
  const next=alliumPlan(metadata,legacy,{asOfDay:'2026-10-24'}),nextAt='2026-10-24T08:00:00.000Z';
  await alliumUsage({root:o.root,apiKey,now:()=>nextAt,fetcher:o.fetcher});
  const a=authorization(a=>{a.planHash=next.planHash;a.reviewedAt=nextAt;a.usageObservedAt=nextAt;a.sqlHashes=Object.fromEntries(next.jobs.map(j=>[j.kind,j.sqlHash]));});
  await assert.rejects(()=>executeAlliumSurvey(next,{...o,...a,now:()=>nextAt}));assert.equal(o.calls.filter(c=>c.url.endsWith('/run-async')).length,3);
});

test('lost create/run/status/result responses consume intents and stop all later jobs without retries',async t=>{
  for(let failureAt=0;failureAt<4;failureAt++) {
    const o=await setup(t);
    const net=mock({failureAt}),options={...o,fetcher:net.fetcher};
    const r=await executeAlliumSurvey(p,options);assert.equal(r.state,'UNKNOWN');assert.equal(r.httpAttempts,failureAt+1);
    assert.equal(net.calls.length,failureAt+1);assert(!JSON.stringify(r).includes('secret'));
    await assert.rejects(()=>executeAlliumSurvey(p,options));assert.equal(net.calls.length,failureAt+1);
  }
});

test('polling consumes at most ten reads at two-second intervals and unknown/failed status never fetches results',async t=>{
  for(const status of ['running','failed','unexpected']){
    const o=await setup(t),net=mock({status}),sleeps=[];
    const r=await executeAlliumSurvey(p,{...o,fetcher:net.fetcher,sleep:async ms=>sleeps.push(ms)});
    assert.equal(r.state,status==='failed'?'FAILED':'UNKNOWN');assert.equal(r.counts.status,status==='running'?10:1);assert.equal(r.counts.result,0);
    assert(sleeps.every(ms=>ms===2000));await assert.rejects(()=>executeAlliumSurvey(p,o));
  }
});

test('success on every tenth poll reaches exactly the 39-request ceiling without pagination',async t=>{
  const o=await setup(t),base=mock(),reads=new Map();
  const fetcher=async(url,options)=>{
    if(url.endsWith('/status')){base.calls.push({url,options});const n=(reads.get(url)??0)+1;reads.set(url,n);return new Response(JSON.stringify(n===10?'success':'running'));}
    return base.fetcher(url,options);
  };
  const r=await executeAlliumSurvey(p,{...o,fetcher});assert.equal(r.state,'SUCCEEDED');assert.equal(r.httpAttempts,39);assert.equal(r.counts.status,30);
  assert.equal(base.calls.length,39);assert(base.calls.every(c=>!c.url.includes('?')));
});

test('expired usage lease and cost-envelope violations stop subsequent requests',async t=>{
  const o=await setup(t),net=mock();let clock=at;
  const fetcher=async(url,options)=>{const r=await net.fetcher(url,options);clock='2026-10-23T09:00:00.001Z';return r;};
  const expired=await executeAlliumSurvey(p,{...o,fetcher,now:()=>clock});assert.equal(expired.state,'UNKNOWN');assert.equal(expired.httpAttempts,1);
  const other=await setup(t),cost=mock({resultMutation:r=>r.meta.cost_explorer_units=0.3});
  const exceeded=await executeAlliumSurvey(p,{...other,fetcher:cost.fetcher});assert.equal(exceeded.state,'UNKNOWN');assert.equal(exceeded.counts.run,1);
  assert.equal(exceeded.jobs[0].observedExplorerUnits,'0.3');
});

test('sentinel, incomplete rows, unexpected SQL and numeric amounts remain archived without accepted evidence',async t=>{
  for(const mutation of [r=>r.data.push(r.data[0]),r=>{r.data=[];r.meta.row_count=0;},r=>r.sql+=' ',r=>r.data[0].decimals_str=6]) {
    const o=await setup(t),net=mock({resultMutation:mutation});const r=await executeAlliumSurvey(p,{...o,fetcher:net.fetcher});
    assert(['UNKNOWN','TRUNCATED'].includes(r.state));assert.equal(r.counts.run,1);assert(r.jobs[0].sourceHash);
    await assert.rejects(()=>reviewAlliumArchive(p,{root:o.root,kind:'registry',expectedHash:r.jobs[0].sourceHash,now:at}));
  }
});

test('HTTP errors, oversize bodies and archive write failure leave a permanent unknown reservation',async t=>{
  for(const mode of ['http','large','disk']){
    const o=await setup(t);let calls=0;
    const r=await executeAlliumSurvey(p,{...o,fetcher:async()=>{calls++;if(mode==='disk')await writeFile(join(o.root,'survey-'+p.asOfDay,'response-0.json'),'existing');return new Response(mode==='large'?'x'.repeat(2097153):'private-provider-error',{status:mode==='http'?429:200});}});
    assert.equal(r.state,'UNKNOWN');assert.equal(calls,1);assert.equal(r.httpAttempts,1);assert(!JSON.stringify(r).includes('private-provider-error'));
    await assert.rejects(()=>executeAlliumSurvey(p,o));
  }
});

test('a process exit at dispatch has a durable intent and restart cannot repeat it',async t=>{
  for(let boundary=0;boundary<4;boundary++){
  const o=await setup(t),file=join(o.root,'input.json');
  await writeFile(file,JSON.stringify({plan:p,authorization:JSON.parse(o.authorizationBytes),root:o.root}));
  const script=`import{readFile}from'node:fs/promises';import{executeAlliumSurvey,alliumHash}from ${JSON.stringify(new URL('../tools/allium-executor.mjs',import.meta.url).href)};const x=JSON.parse(await readFile(process.argv[1]));const authorizationBytes=Buffer.from(JSON.stringify(x.authorization));let count=0;await executeAlliumSurvey(x.plan,{root:x.root,authorizationBytes,reviewedHash:alliumHash(authorizationBytes),usageBytes:Buffer.from(${JSON.stringify(usageBytes.toString())}),controlsBytes:Buffer.from(${JSON.stringify(controlsBytes.toString())}),apiKey:${JSON.stringify(apiKey)},now:()=>${JSON.stringify(at)},sleep:async()=>{},fetcher:async()=>{if(count++===${boundary})process.exit(73);return new Response(JSON.stringify(count===1?{query_id:'private-query'}:count===2?{run_id:'private-run'}:'success'));}});`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script,file],{encoding:'utf8'});assert.equal(child.status,73);
  const receipt=JSON.parse(await readFile(join(o.root,'survey-'+p.asOfDay,'receipt.json')));
  assert.equal(alliumReceiptView(receipt).state,'UNKNOWN');assert.equal(receipt.attempts.length,boundary+1);
  assert.equal(JSON.parse(await readFile(join(o.root,'survey-'+p.asOfDay,'intent-0.json'))).kind,'create');
  await assert.rejects(()=>executeAlliumSurvey(p,o));assert.equal(o.calls.length,0);
  }
});

test('offline archive recovery tolerates a lost final snapshot but rejects changed bytes and never releases claims',async t=>{
  const o=await setup(t),r=await executeAlliumSurvey(p,o),file=join(o.root,'survey-'+p.asOfDay,'receipt.json');
  const receipt=JSON.parse(await readFile(file));receipt.state='RUNNING';delete receipt.jobs[0].sourceHash;delete receipt.jobs[0].resultAttempt;
  await writeFile(file,JSON.stringify(receipt));
  const projection=await reviewAlliumArchive(p,{root:o.root,kind:'registry',expectedHash:r.jobs[0].sourceHash,now:at});assert.equal(projection.survey,'registry');
  await writeFile(join(o.root,'survey-'+p.asOfDay,'response-3.json'),'{}');
  await assert.rejects(()=>reviewAlliumArchive(p,{root:o.root,kind:'registry',expectedHash:r.jobs[0].sourceHash,now:at}));
  await assert.rejects(()=>executeAlliumSurvey(p,o));assert.equal(o.calls.length,12);
});

test('unobserved usage, drifted approval, unsafe paths and extra CLI flags fail closed without fetching',async t=>{
  const root=await sandbox(t),net=mock();await assert.rejects(()=>executeAlliumSurvey(p,{root,...authorization(),fetcher:net.fetcher}));assert.equal(net.calls.length,0);
  const o=await setup(t);await assert.rejects(()=>executeAlliumSurvey(p,{...o,reviewedHash:'0'.repeat(64)}));assert.equal(o.calls.length,0);
  const changed=structuredClone(p);changed.jobs[0].sql='SELECT private_data FROM unrelated_table';changed.jobs[0].sqlHash=alliumHash(Buffer.from(changed.jobs[0].sql));
  const {planHash:ignored,...body}=changed;changed.planHash=alliumHash(Buffer.from(canonical(body)));
  const approved=authorization(a=>{a.planHash=changed.planHash;a.sqlHashes.registry=changed.jobs[0].sqlHash;});
  await assert.rejects(()=>executeAlliumSurvey(changed,{...o,...approved}));assert.equal(o.calls.length,0);
  const link=join(root,'link');await symlink(o.root,link);await assert.rejects(()=>alliumUsage({root:link,apiKey,now,fetcher:net.fetcher}));
  for(const args of [['usage','--day','2026-10-23'],['execute','--day','2026-10-23'],['status','--day','../../secret'],['status','--day','2026-02-30'],['status','--day','2026-10-23','--retry','1']])assert.throws(()=>executionArguments(args));
});
