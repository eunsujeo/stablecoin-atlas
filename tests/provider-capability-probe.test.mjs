import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {providerCapabilityPlan,capabilitySlot} from '../tools/provider-capability-plan.mjs';
import {prepareCapabilityProbe,collectCapabilityProbe} from '../tools/provider-capability-probe.mjs';
import {alliumHash} from '../tools/allium-executor.mjs';
const at='2026-10-24T02:00:00.000Z',keys={arkham:'fixture-arkham-only',allium:'fixture-allium-only'},approvalBytes=Buffer.from('User asks read-only capability testing'),reply=v=>new Response(JSON.stringify(v),{status:200});
async function fixture(t){const root=await mkdtemp(join(await realpath(tmpdir()),'atlas-capabilities-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'live-once'),{mode:0o700});await writeFile(join(root,'live-once/consumed'),'original',{mode:0o600});const authorizationBytes=await prepareCapabilityProbe(root,{keys,approvalBytes,now:at});return {root,keys,approvalBytes,authorizationBytes,reviewedHash:alliumHash(authorizationBytes),now:()=>at,sleep:async()=>{}};}
function transport({failSql=false,lastPoll=false,empty=false,echoMismatch=false,restStatus=200}={}){
 let calls=0;const queries=new Map(),reads=new Map();
 return {get calls(){return calls;},fetcher:async(url,o)=>{
  calls++;assert.equal(o.redirect,'error');
  if(url.endsWith('/explorer/queries')){const body=JSON.parse(o.body),job=providerCapabilityPlan().jobs.find(j=>j.sql===body.config.sql);assert.ok(job);assert.equal(body.config.limit,1);const id='fixture-query-'+queries.size;queries.set(id,job);return reply({query_id:id});}
  if(url.endsWith('/run-async'))return reply({run_id:url.split('/').at(-2)});
  if(url.endsWith('/status')){const id=url.split('/').at(-2),n=(reads.get(id)??0)+1;reads.set(id,n);return reply(lastPoll&&n<3?'running':failSql?'failed':'success');}
  if(url.includes('/explorer/query-runs?')){const id=new URL(url).searchParams.get('query_id'),job=queries.get(id);return reply({query_id:id,run_id:id,status:'failed',query_config:{sql:job.sql},error:'You used invalid tables: '+job.table});}
  if(url.endsWith('/results')){const job=queries.get(url.split('/').at(-2));return reply({sql:job.sql+(echoMismatch?';':''),data:empty?[]:[{probe_id:job.probeId}],queried_at:at});}
  return restStatus===200?reply(empty?[]:{fixture:true}):new Response('{}',{status:restStatus});
 }};
}
test('fixed plan contains only sampled reads, separates previous failures and untested variants, and pins budgets',()=>{
 const p=providerCapabilityPlan();assert.equal(p.jobs.length,45);assert.equal(p.jobs.filter(j=>j.provider==='arkham').length,20);assert.equal(p.jobs.filter(j=>j.type==='sql').length,16);assert.equal(p.maxHttpRequests,125);assert.equal(p.providerLimits.allium.maxHttpRequests,105);assert.equal(p.maxTotalBytes,33554432);assert.equal(p.retries,0);assert.equal(p.previous.length,2);assert.ok(p.notTested.length);
 for(const j of p.jobs){assert.doesNotMatch(j.path??'',/usage|analytics|alerts|subscription|\/ws\//);if(j.type==='sql'){assert.match(j.sql,/LIMIT 1$/);assert.doesNotMatch(j.sql,/SELECT \*|geo_balances_daily\b|cex_attributed_flows\b/);}}
});
test('successful samples preserve originals, publish no credentials/addresses/results and cannot replay with fresh authorization',async t=>{
 const f=await fixture(t),fake=transport();let intentSeen=false;
 const fetcher=async(u,o)=>{if(!intentSeen){const i=JSON.parse(await readFile(join(f.root,capabilitySlot,'intent-0.json'),'utf8'));assert.equal(i.index,0);intentSeen=true;}return fake.fetcher(u,o);};
 const r=await collectCapabilityProbe(f.root,{...f,fetcher});assert.equal(r.state,'COMPLETE');assert.equal(r.httpAttempts,93);assert.equal(r.runs,16);assert.equal(r.previousPreserved,true);assert.equal(await readFile(join(f.root,'live-once/consumed'),'utf8'),'original');assert.equal(r.jobs.filter(j=>j.state==='QUERY_SUCCEEDED_SAMPLE').length,16);assert.doesNotMatch(JSON.stringify(r),/fixture-arkham-only|fixture-allium-only|fixture-query-|0xa0b8|SELECT/);
 await assert.rejects(collectCapabilityProbe(f.root,{...f,fetcher}));const fresh=await prepareCapabilityProbe(f.root,{keys,approvalBytes,now:at});await assert.rejects(collectCapabilityProbe(f.root,{...f,authorizationBytes:fresh,reviewedHash:alliumHash(fresh),fetcher}));assert.equal(fake.calls,93);
});
test('last-poll SQL failures including diagnosis consume exactly the complete 125-HTTP budget without retries',async t=>{
 const f=await fixture(t),fake=transport({failSql:true,lastPoll:true}),r=await collectCapabilityProbe(f.root,{...f,fetcher:fake.fetcher});assert.equal(r.state,'COMPLETE');assert.equal(r.httpAttempts,125);assert.equal(r.runs,16);assert.equal(r.counts.arkham,20);assert.equal(r.counts.allium,105);assert.equal(r.jobs.filter(j=>j.state==='QUERY_FAILED'&&j.diagnosisState==='OBSERVED'&&j.errorClass==='INVALID_TABLES').length,16);
});
test('HTTP forbidden, request validation and empty JSON are distinct from unsupported APIs; SQL echo mismatch remains unreviewed',async t=>{
 for(const status of [403,422]){const f=await fixture(t),fake=transport({restStatus:status}),r=await collectCapabilityProbe(f.root,{...f,fetcher:fake.fetcher});assert.equal(r.state,'COMPLETE');assert.match(r.jobs[0].state,new RegExp('HTTP_'+status));assert.equal(r.jobs.at(-1).state,'QUERY_SUCCEEDED_SAMPLE');}
 const f=await fixture(t),fake=transport({empty:true,echoMismatch:true}),r=await collectCapabilityProbe(f.root,{...f,fetcher:fake.fetcher});assert.equal(r.jobs[0].state,'HTTP_200_EMPTY');assert.equal(r.jobs.at(-1).state,'QUERY_SUCCEEDED_ECHO_REVIEW_REQUIRED');assert.equal(r.jobs.at(-1).echoMatches,false);
});
test('lost acknowledgement, proxy error and rate limit stop the batch permanently before any other endpoint',async t=>{
 for(const mode of ['lost','proxy','rate']){
  const f=await fixture(t);let calls=0;const fetcher=async()=>{calls++;if(mode==='lost')throw Error('fixture response lost');return new Response('private error body',{status:mode==='proxy'?451:429,headers:mode==='proxy'?{'x-squid-error':'ERR_ACCESS_DENIED 0'}:{}});};
  const r=await collectCapabilityProbe(f.root,{...f,fetcher});assert.equal(r.state,'STOPPED_UNKNOWN');assert.equal(calls,1);assert.equal(r.httpAttempts,1);assert.equal(r.jobs.slice(1).every(j=>j.state==='NOT_TESTED'),true);await assert.rejects(collectCapabilityProbe(f.root,{...f,fetcher}));assert.equal(calls,1);
  if(mode==='proxy'){assert.equal(r.stopReason,'PROXY_ACCESS_DENIED');assert.equal(r.lastFailure.proxyError,'ERR_ACCESS_DENIED 0');await assert.rejects(readFile(join(f.root,capabilitySlot,'response-0.json')));}
 }
});
test('lock, expiry, changed approval/key/plan and changed prior archive reject before sending',async t=>{
 const f=await fixture(t);let calls=0;const fetcher=async()=>{calls++;return reply({});};
 await mkdir(join(f.root,'reservation-lock'),{mode:0o700});await assert.rejects(collectCapabilityProbe(f.root,{...f,fetcher}));await rm(join(f.root,'reservation-lock'),{recursive:true});
 for(const patch of [{now:()=> '2026-10-24T02:15:00.000Z'},{keys:{...keys,arkham:'wrong'}},{approvalBytes:Buffer.from('wrong')}])await assert.rejects(collectCapabilityProbe(f.root,{...f,...patch,fetcher}));
 const a=JSON.parse(f.authorizationBytes);a.plan.maxHttpRequests++;const bytes=Buffer.from(JSON.stringify(a));await assert.rejects(collectCapabilityProbe(f.root,{...f,authorizationBytes:bytes,reviewedHash:alliumHash(bytes),fetcher}));
 await writeFile(join(f.root,'live-once/consumed'),'changed');await assert.rejects(collectCapabilityProbe(f.root,{...f,fetcher}));assert.equal(calls,0);
});
test('lease expiry between samples stops dispatch; per-response and total byte ceilings are enforced',async t=>{
 const f=await fixture(t);let calls=0;const r=await collectCapabilityProbe(f.root,{...f,now:()=>calls?'2026-10-24T02:15:00.000Z':at,fetcher:async()=>{calls++;return reply({});}});assert.equal(calls,1);assert.equal(r.stopReason,'LEASE_EXPIRED');
 const large=await fixture(t),normal=transport();let first=true;const l=await collectCapabilityProbe(large.root,{...large,fetcher:async(u,o)=>{if(first){first=false;return new Response('x'.repeat(2097153));}return normal.fetcher(u,o);}});assert.equal(l.state,'COMPLETE');assert.equal(l.jobs[0].state,'RESPONSE_TOO_LARGE');assert.equal((await readFile(join(large.root,capabilitySlot,'response-0.json'))).length,2097152);assert.equal(l.httpAttempts,93);
 const total=await fixture(t);let count=0;const p=await collectCapabilityProbe(total.root,{...total,fetcher:async()=>{count++;return reply({padding:'x'.repeat(1900000)});}});assert.equal(p.stopReason,'RESPONSE_BYTE_LIMIT');assert.ok(p.responseBytes<=33554432);assert.ok(count<20);
});
