import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,readFile,writeFile,mkdir,stat,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {alliumPlan} from '../tools/allium-plan.mjs';
import {dailyPlan,liveLegacyManifest,liveAuthorization,executeLiveOnce,resumeLiveOnce,liveStatus} from '../tools/allium-live-once.mjs';
import {alliumHash,alliumUsage,executeAlliumSurvey,executeAlliumManualSurvey,resumeAlliumManualSurvey} from '../tools/allium-executor.mjs';
import {liveArguments} from '../tools/allium-live-cli.mjs';

const at='2026-10-23T08:00:00.000Z',apiKey='PRIVATE_TEST_KEY',approvalBytes=Buffer.from('TEST ONLY: user authorized actual uncapped once collection');
const metadata=JSON.parse(await readFile(new URL('../data/market-registration.json',import.meta.url)));
const registry=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url)));
const plan=dailyPlan({asOfDay:at.slice(0,10)}),survey=alliumPlan(metadata,registry,{asOfDay:plan.asOfDay});
const future=dailyPlan({asOfDay:'2026-10-24'});

function result(kind) {
  const data=survey.targets.filter(t=>t.family!=='XRPL').map(t=>({deployment_id:t.deploymentId,coin_id:t.coinId,
    requested_chain:t.networkId,requested_address:t.identity.address,observed_chain:null,observed_address:null,provider_day:null,
    ...(kind==='supply'?{total_supply_str:null,circulating_supply_str:null,adjusted_circulating_supply_str:null,total_supply_usd_str:null,
      circulating_supply_usd_str:null,adjusted_circulating_supply_usd_str:null,is_native:null}:
      {transfer_volume_str:null,transfer_volume_usd_str:null,transfer_count_str:null,transfer_tx_count_str:null,adjusted_volume_usd_str:null,has_adjusted_volume:null})}));
  return {sql:plan.jobs.find(j=>j.kind===kind).sql,data,queried_at:at,meta:{row_count:data.length,cost_explorer_units:'TEST_COST_LEXEME'}};
}
function network({polls=1,mutate=()=>{},failure=-1,before=async()=>{}}={}) {
  const calls=[],statuses=new Map();let current;
  return {calls,fetcher:async(url,options)=>{
    const n=calls.length;calls.push({url,options});await before(n);
    if(n===failure)throw Error('PRIVATE_PROVIDER_ERROR');
    const path=new URL(url).pathname;let body;
    if(path.endsWith('/queries')) {
      current=plan.jobs.find(j=>j.sql===JSON.parse(options.body).config.sql)?.kind;assert(current);
      body={query_id:'query-'+current};
    }else if(path.endsWith('/run-async'))body={run_id:'run-'+current};
    else if(path.endsWith('/status')) {const count=(statuses.get(current)??0)+1;statuses.set(current,count);body=count>=polls?'success':'running';}
    else if(path.endsWith('/results')){body=result(current);mutate(body);}
    else assert.fail('unexpected endpoint');
    return new Response(JSON.stringify(body).replace('"TEST_COST_LEXEME"','0.012345678901234567'));
  }};
}
async function setup(t,netOptions={}) {
  const root=await realpath(await mkdtemp(join(tmpdir(),'allium-live-')));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'manual-once'),{mode:0o700});
  await writeFile(join(root,'manual-once','reservation.json'),'LEGACY UNKNOWN; P UNKNOWN; b null; c 0',{mode:0o600});
  const manifest=await liveLegacyManifest(root);
  const authorizationBytes=Buffer.from(JSON.stringify(liveAuthorization(plan,{apiKey,approvalBytes,legacyManifest:manifest,now:at})));
  return {root,manifest,authorizationBytes,reviewedHash:alliumHash(authorizationBytes),apiKey,approvalBytes,now:()=>at,sleep:async()=>{},...network(netOptions)};
}

test('live once durably consumes one grant, archives exact responses, preserves legacy UNKNOWN and reports no cost certification',async t=>{
  const o=await setup(t,{before:async n=>{if(n===0){assert.equal((await stat(join(o.root,'live-once','reservation.json'))).mode&0o777,0o600);assert.equal((await readdir(join(o.root,'live-once'))).includes('intent-0.json'),true);}}});
  const view=await executeLiveOnce(plan,o);assert.equal(view.state,'SUCCEEDED');assert.equal(view.httpAttempts,8);
  assert.equal(view.counts.run,2);assert.equal(view.counts.usage,0);assert.equal(view.databaseWrites,0);
  assert.equal(view.transition,'TRANSITION_BLOCKED');assert.equal(view.costAttribution,'UNKNOWN');assert.equal(view.reservationBound,null);
  assert.equal(view.reconciledUnits,'0');assert.equal(view.globalBudgetGuaranteed,false);assert.equal(view.legacyPreserved,true);
  assert.deepEqual(await liveLegacyManifest(o.root),o.manifest);
  assert.equal((await liveStatus(o.root)).state,'SUCCEEDED');
  assert(!JSON.stringify(view).includes(apiKey));assert(!JSON.stringify(view).includes('query-'));
  const projection=JSON.parse(await readFile(join(o.root,'live-once','supply-projection.json')));
  assert.equal(projection.rows.length,11);assert(projection.rows.every(r=>r.state==='INCONCLUSIVE'));
  const receipt=JSON.parse(await readFile(join(o.root,'live-once','receipt.json')));
  assert.equal(receipt.authorization.organizationIdentity,'UNKNOWN');assert.equal(receipt.authorization.otherPcExclusivity,'UNKNOWN');
  assert.equal(receipt.jobs[0].observedUnits,'0.012345678901234567'); // Preserve the numeric provider lexeme exactly.
  await assert.rejects(()=>executeLiveOnce(plan,o));
  await assert.rejects(()=>executeLiveOnce(plan,{...o,apiKey:'changed-key'}));
  await assert.rejects(()=>executeLiveOnce(future,{...o,now:()=> '2026-10-24T08:00:00Z'}));
  assert.equal(o.calls.length,8);
});

test('all legacy sends and another live process are excluded while live runs and after its permanent claim',async t=>{
  let entered,release;const ready=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
  const o=await setup(t,{before:async n=>{if(n===0){entered();await hold;}}});
  const running=executeLiveOnce(plan,o);await ready;
  for(const call of [()=>executeLiveOnce(plan,o),()=>alliumUsage(o),()=>executeAlliumSurvey(survey,o),
    ()=>executeAlliumManualSurvey(survey,o),()=>resumeAlliumManualSurvey(survey,o)])await assert.rejects(call);
  release();await running;
  for(const call of [()=>alliumUsage(o),()=>executeAlliumSurvey(survey,o),()=>executeAlliumManualSurvey(survey,o),()=>resumeAlliumManualSurvey(survey,o)])await assert.rejects(call);
  assert.equal(o.calls.length,8);assert.deepEqual(await liveLegacyManifest(o.root),o.manifest);
});

test('existing usage sender holds the same gate against a live reservation',async t=>{
  let entered,release;const ready=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
  const o=await setup(t);
  const usage=alliumUsage({...o,fetcher:async()=>{entered();await hold;return new Response('{}');}});await ready;
  await assert.rejects(()=>executeLiveOnce(plan,o));assert.equal(o.calls.length,0);
  release();await usage;
  assert(!(await readdir(o.root)).includes('live-once'));
});

test('mutated grants, legacy changes, future dates and expired leases make zero calls',async t=>{
  for(const mode of ['key','hash','field','legacy','expired','day']) {
    const o=await setup(t);
    if(mode==='key')o.apiKey='changed-key';
    if(mode==='hash')o.reviewedHash='0'.repeat(64);
    if(mode==='field'){const a=JSON.parse(o.authorizationBytes);a.maxHttpRequests=27;o.authorizationBytes=Buffer.from(JSON.stringify(a));o.reviewedHash=alliumHash(o.authorizationBytes);}
    if(mode==='legacy')await writeFile(join(o.root,'manual-once','reservation.json'),'changed');
    if(mode==='expired')o.now=()=> '2026-10-23T08:15:00Z';
    if(mode==='day')o.now=()=> '2026-10-24T08:00:00Z';
    await assert.rejects(()=>executeLiveOnce(plan,o));assert.equal(o.calls.length,0);assert(!(await readdir(o.root)).includes('live-once'));
  }
});

test('POST/GET response loss never retries or refunds and unknown raw history remains available',async t=>{
  for(const failure of [0,1,2,3,4]) {
    const o=await setup(t,{failure}),view=await executeLiveOnce(plan,o);
    assert.equal(view.state,'UNKNOWN');assert.equal(o.calls.length,failure+1);
    await assert.rejects(()=>executeLiveOnce(plan,o));assert.equal(o.calls.length,failure+1);
    assert.deepEqual(await liveLegacyManifest(o.root),o.manifest);
    const intents=(await readdir(join(o.root,'live-once'))).filter(f=>f.startsWith('intent-'));assert.equal(intents.length,failure+1);
  }
});

test('polling is bounded at 26 HTTP; expiry between requests stops further dispatch',async t=>{
  const o=await setup(t,{polls:10}),view=await executeLiveOnce(plan,o);
  assert.equal(view.state,'SUCCEEDED');assert.equal(view.httpAttempts,26);assert.equal(view.counts.status,20);
  const expired=await setup(t);let clock=at;
  expired.now=()=>clock;expired.sleep=async()=>{clock='2026-10-23T08:15:00Z';};
  const stopped=await executeLiveOnce(plan,expired);assert.equal(stopped.state,'UNKNOWN');assert.equal(expired.calls.length,2);
});

test('unreviewed echo, sentinel truncation and provider failure stop the second job',async t=>{
  for(const mode of ['echo','truncated','status-failed','http429']) {
    const o=await setup(t,{mutate:r=>{if(mode==='echo')r.sql+=' ';if(mode==='truncated')while(r.data.length<78)r.data.push(r.data[0]);}});
    if(mode==='status-failed'||mode==='http429') {
      const original=o.fetcher;o.fetcher=(url,options)=>url.endsWith('/status')?new Response(JSON.stringify('failed')):
        mode==='http429'?new Response('{}',{status:429}):original(url,options);
    }
    const view=await executeLiveOnce(plan,o);assert.notEqual(view.state,'SUCCEEDED');assert.equal(view.jobs[1].state,'NOT_TESTED');
    assert.equal(view.counts.create,1);assert(view.counts.run<=1);assert(view.httpAttempts<=4);
    if(mode==='echo')assert.equal(view.failure,'SQL_ECHO_REVIEW_REQUIRED');
    if(mode==='truncated')assert.equal(view.state,'TRUNCATED');
  }
});

test('process death after durable intent keeps both lock and permanent grant consumed',async t=>{
  const o=await setup(t),input=join(o.root,'input.json');
  await writeFile(input,JSON.stringify({root:o.root,authorization:JSON.parse(o.authorizationBytes)}),{mode:0o600});
  // Exclude the child input file from the prepared manifest by keeping it outside the legacy root.
  await rm(input);const parent=await realpath(await mkdtemp(join(tmpdir(),'allium-child-')));t.after(()=>rm(parent,{recursive:true,force:true}));
  const config=join(parent,'input.json');await writeFile(config,JSON.stringify({root:o.root,authorization:JSON.parse(o.authorizationBytes)}),{mode:0o600});
  const script=`import{readFile}from'node:fs/promises';import{executeLiveOnce,dailyPlan}from ${JSON.stringify(new URL('../tools/allium-live-once.mjs',import.meta.url).href)};import{alliumHash}from ${JSON.stringify(new URL('../tools/allium-executor.mjs',import.meta.url).href)};const x=JSON.parse(await readFile(process.argv[1]));const authorizationBytes=Buffer.from(JSON.stringify(x.authorization));await executeLiveOnce(dailyPlan({asOfDay:'2026-10-23'}),{root:x.root,authorizationBytes,reviewedHash:alliumHash(authorizationBytes),apiKey:${JSON.stringify(apiKey)},approvalBytes:Buffer.from(${JSON.stringify(approvalBytes.toString())}),now:()=>${JSON.stringify(at)},fetcher:async()=>process.exit(73)});`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script,config],{encoding:'utf8'});assert.equal(child.status,73,child.stderr);
  assert((await readdir(o.root)).includes('reservation-lock'));
  assert((await readdir(join(o.root,'live-once'))).includes('intent-0.json'));
  await assert.rejects(()=>executeLiveOnce(plan,o));assert.equal(o.calls.length,0);
  assert.equal((await liveStatus(o.root)).state,'UNKNOWN');
});

test('live CLI only accepts explicit commands and never accepts another root or a web trigger',()=>{
  assert.deepEqual(liveArguments(['status']),{command:'status'});
  for(const args of [[],['collect'],['status','--root','/tmp'],['watch'],['collect','--day','2026-10-23']])assert.throws(()=>liveArguments(args));
});

async function reviewOptions(o,mutate=()=>{}) {
  const archive=join(o.root,'live-once'),receiptBytes=await readFile(join(archive,'receipt.json')),receipt=JSON.parse(receiptBytes);
  const j=receipt.jobs.find(j=>j.state==='UNKNOWN'),source=await readFile(join(archive,'response-'+j.resultAttempt+'.json'));
  const manifest={schemaVersion:1,kind:'ALLIUM_LIVE_REVIEWED_SQL_ECHO',planHash:plan.planHash,authorizationHash:o.reviewedHash,
    receiptHash:alliumHash(receiptBytes),review:{reviewStatus:'SOURCE_REVIEWED',planHash:survey.planHash,kind:j.kind,
      requestSqlHash:j.sqlHash,sourceHash:alliumHash(source),responseSqlHash:alliumHash(Buffer.from(JSON.parse(source).sql)),reviewedAt:at}};
  mutate(manifest);const sqlReviewBytes=Buffer.from(JSON.stringify(manifest));
  return {...o,sqlReviewBytes,reviewedSqlReviewHash:alliumHash(sqlReviewBytes)};
}

test('individual echo checkpoints only dispatch unsent volume, retain original lease and preserve both UNKNOWN receipts',async t=>{
  const o=await setup(t,{polls:10,mutate:r=>r.sql+=' '});
  const first=await executeLiveOnce(plan,o);assert.equal(first.failure,'SQL_ECHO_REVIEW_REQUIRED');assert.equal(first.counts.run,1);
  const supplyReview=await reviewOptions(o),race=await Promise.allSettled([resumeLiveOnce(plan,supplyReview),resumeLiveOnce(plan,supplyReview)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.filter(r=>r.status==='rejected').length,1);
  const second=race.find(r=>r.status==='fulfilled').value;
  assert.equal(second.counts.run,2);assert.equal(second.httpAttempts,26);assert.equal(second.failure,'SQL_ECHO_REVIEW_REQUIRED');
  const volumeReview=await reviewOptions(o),third=await resumeLiveOnce(plan,volumeReview);
  assert.equal(third.state,'SUCCEEDED');assert.equal(third.httpAttempts,26);assert(third.jobs.every(j=>j.sqlReviewStatus==='SOURCE_REVIEWED'));
  for(const kind of ['supply','volume']) {
    const prior=JSON.parse(await readFile(join(o.root,'live-once','receipt-before-review-'+kind+'.json')));
    assert.equal(prior.state,'UNKNOWN');assert.equal(prior.authorization.expiresAt,JSON.parse(o.authorizationBytes).expiresAt);
  }
  await assert.rejects(()=>resumeLiveOnce(plan,supplyReview));await assert.rejects(()=>executeLiveOnce(plan,o));
  assert.equal(o.calls.filter(c=>c.options.method==='POST').length,4);assert.deepEqual(await liveLegacyManifest(o.root),o.manifest);
});

test('checkpoint rejects stale receipts, altered evidence, consumed claims, expiry and uncertain dispatch without a new send',async t=>{
  for(const mode of ['receipt','source','intent','query','status','checkpoint','expired','wrong-source','wrong-echo','uncertain']) {
    const o=await setup(t,{mutate:r=>r.sql+=' '});await executeLiveOnce(plan,o);
    const review=await reviewOptions(o,m=>{if(mode==='wrong-source')m.review.sourceHash='0'.repeat(64);if(mode==='wrong-echo')m.review.responseSqlHash='0'.repeat(64);});
    const archive=join(o.root,'live-once');
    if(mode==='receipt')await writeFile(join(archive,'receipt.json'),(await readFile(join(archive,'receipt.json'))).toString()+' ');
    if(mode==='source')await writeFile(join(archive,'response-3.json'),'{}');
    if(mode==='intent'){const path=join(archive,'intent-0.json'),v=JSON.parse(await readFile(path));v.kind='result';await writeFile(path,JSON.stringify(v));}
    if(mode==='checkpoint')await mkdir(join(archive,'resume-supply'));
    if(mode==='expired')review.now=()=> '2026-10-23T08:15:00Z';
    if(['query','status','uncertain'].includes(mode)) {
      const r=JSON.parse(await readFile(join(archive,'receipt.json')));
      if(mode==='query')r.jobs[0].queryId='changed-query';
      if(mode==='status') {const raw=Buffer.from(JSON.stringify('running'));await writeFile(join(archive,'response-2.json'),raw);r.attempts[2].responseHash=alliumHash(raw);}
      if(mode==='uncertain')r.attempts[0].httpStatus=null;
      const raw=Buffer.from(JSON.stringify(r));await writeFile(join(archive,'receipt.json'),raw);
      const m=JSON.parse(review.sqlReviewBytes);m.receiptHash=alliumHash(raw);review.sqlReviewBytes=Buffer.from(JSON.stringify(m));review.reviewedSqlReviewHash=alliumHash(review.sqlReviewBytes);
    }
    await assert.rejects(()=>resumeLiveOnce(plan,review),mode);assert.equal(o.calls.length,4,mode);
  }
});
