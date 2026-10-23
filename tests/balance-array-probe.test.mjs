import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canonical} from '../tools/market-db/plan.mjs';
import {alliumHash} from '../tools/allium-executor.mjs';
import {providerCapabilityPlan,capabilitySlot,capabilityToken} from '../tools/provider-capability-plan.mjs';
import {balanceArrayPlan} from '../tools/balance-array-plan.mjs';
import {prepareCapabilityProbe,collectCapabilityProbe} from '../tools/provider-capability-probe.mjs';
const at='2026-10-24T06:00:00.000Z',profile='balance-array',keys={allium:'fixture-key-only'},approvalBytes=Buffer.from('User approves 1HTTP/0run array body with unknown cost'),slot=balanceArrayPlan().slot;
async function fixture(t){
 const root=await mkdtemp(join(await realpath(tmpdir()),'atlas-balance-array-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,capabilitySlot),{mode:0o700});await writeFile(join(root,capabilitySlot,'original'),'preserved-capability-bytes',{mode:0o600});
 const options={profile,keys,approvalBytes,now:at},authorizationBytes=await prepareCapabilityProbe(root,options);
 return {root,...options,now:()=>at,authorizationBytes,reviewedHash:alliumHash(authorizationBytes)};
}
test('array profile is a distinct fixed REST-only plan and leaves the original canonical plan unchanged',()=>{
 assert.equal(alliumHash(Buffer.from(canonical(providerCapabilityPlan()))),'149428d2cf485ed5d3489f885656983a74741221f4b8ade0b2110254e903e2dd');
 const p=balanceArrayPlan();assert.equal(p.jobs.length,1);assert.equal(p.maxHttpRequests,1);assert.equal(p.maxRuns,0);assert.equal(p.maxResponseBytes,p.maxTotalBytes);assert.equal(p.leaseMs,300000);assert.equal(p.retries,0);
 assert.deepEqual(p.jobs[0].body,[{chain:'ethereum',address:capabilityToken}]);assert.notEqual(p.slot,capabilitySlot);
});
test('one exact POST follows durable intent, preserves numeric bytes and prior capability archive, and permanently refuses replay',async t=>{
 const f=await fixture(t);let calls=0;const bytes='{"items":[{"raw_balance":90071992547409931234,"raw_balance_str":"90071992547409931234"}],"cursor":"do-not-follow"}';
 const fetcher=async(u,o)=>{
  calls++;assert.equal(u,'https://api.allium.so/api/v1/developer/wallet/balances');assert.equal(o.method,'POST');assert.equal(o.redirect,'error');assert.deepEqual(JSON.parse(o.body),[{chain:'ethereum',address:capabilityToken}]);assert.equal(o.headers['X-API-KEY'],keys.allium);
  const intent=JSON.parse(await readFile(join(f.root,slot,'intent-0.json')));assert.equal(intent.step,'read');assert.equal(intent.index,0);
  assert.equal(JSON.parse(await readFile(join(f.root,slot,'receipt.json'))).attempts.length,1);return new Response(bytes);
 };
 const r=await collectCapabilityProbe(f.root,{...f,fetcher});assert.equal(r.jobs[0].state,'HTTP_200_JSON');assert.equal(r.httpAttempts,1);assert.equal(r.runs,0);assert.equal(r.previousPreserved,true);
 assert.equal(await readFile(join(f.root,slot,'response-0.json'),'utf8'),bytes);assert.equal(await readFile(join(f.root,capabilitySlot,'original'),'utf8'),'preserved-capability-bytes');assert.doesNotMatch(JSON.stringify(r),/9007199|do-not-follow|fixture-key|0xa0b8/);
 const fresh=await prepareCapabilityProbe(f.root,{profile,keys,approvalBytes,now:at});await assert.rejects(collectCapabilityProbe(f.root,{...f,authorizationBytes:fresh,reviewedHash:alliumHash(fresh),fetcher}));assert.equal(calls,1);
});
test('unknown profile, stale lease, changed request/key/approval/archive and lock reject before dispatch',async t=>{
 const f=await fixture(t);let calls=0;const fetcher=async()=>{calls++;return new Response('{}');};
 for(const patch of [{profile:'arbitrary'},{profile:'capabilities'},{now:()=> '2026-10-24T06:05:00.000Z'},{keys:{allium:'changed'}},{approvalBytes:Buffer.from('changed')}])await assert.rejects(collectCapabilityProbe(f.root,{...f,...patch,fetcher}));
 const a=JSON.parse(f.authorizationBytes);a.plan.jobs[0].body[0].address='changed';const b=Buffer.from(canonical(a));await assert.rejects(collectCapabilityProbe(f.root,{...f,authorizationBytes:b,reviewedHash:alliumHash(b),fetcher}));
 await mkdir(join(f.root,'reservation-lock'),{mode:0o700});await assert.rejects(collectCapabilityProbe(f.root,{...f,fetcher}));await rm(join(f.root,'reservation-lock'),{recursive:true});
 await writeFile(join(f.root,capabilitySlot,'original'),'changed');await assert.rejects(collectCapabilityProbe(f.root,{...f,fetcher}));assert.equal(calls,0);
});
test('empty, request rejection, auth rejection, origin451, server error and oversized response are terminal single observations',async t=>{
 for(const [status,body,state]of [[200,'{"items":[]}','HTTP_200_EMPTY'],[200,'{"error":"fixture"}','HTTP_200_ERROR_BODY'],[200,'html','HTTP_200_NON_JSON'],[400,'{}','HTTP_400_REQUEST_REJECTED'],[401,'{}','HTTP_401_AUTHENTICATION_REJECTED'],[403,'{}','HTTP_403_FORBIDDEN'],[451,'{}','HTTP_451_UNCONFIRMED'],[500,'{}','HTTP_500_UNCONFIRMED'],[200,'x'.repeat(2097153),'RESPONSE_TOO_LARGE']]){
  const f=await fixture(t);let calls=0;const fetcher=async()=>{calls++;return new Response(body,{status});},r=await collectCapabilityProbe(f.root,{...f,fetcher});
  assert.equal(r.jobs[0].state,state);assert.equal(r.previousPreserved,true);assert.equal(calls,1);assert.ok(r.responseBytes<=2097152);await assert.rejects(collectCapabilityProbe(f.root,{...f,fetcher}));assert.equal(calls,1);
 }
});
test('transport loss, timeout, mid-body loss, rate limit and proxy denial never retry and preserve consumed UNKNOWN evidence',async t=>{
 for(const mode of ['lost','timeout','body','rate','proxy']){
  const f=await fixture(t);let calls=0;const fetcher=async()=>{
   calls++;if(mode==='lost')throw Error('lost');if(mode==='timeout')throw new DOMException('timeout','TimeoutError');
   if(mode==='body')return new Response(new ReadableStream({start(c){c.error(Error('lost body'));}}));
   return new Response('private error',{status:mode==='rate'?429:451,headers:mode==='proxy'?{'x-squid-error':'ERR_ACCESS_DENIED 0'}:{}});
  };
  const r=await collectCapabilityProbe(f.root,{...f,fetcher});assert.equal(r.state,'STOPPED_UNKNOWN');assert.equal(r.httpAttempts,1);assert.equal(r.previousPreserved,true);await assert.rejects(collectCapabilityProbe(f.root,{...f,fetcher}));assert.equal(calls,1);
  if(mode==='proxy'){assert.equal(r.stopReason,'PROXY_ACCESS_DENIED');await assert.rejects(readFile(join(f.root,slot,'response-0.json')));}
 }
});
test('concurrent collectors send once; pre-existing crash slot never resumes; exact 2MiB response is retained',async t=>{
 const f=await fixture(t);let entered,release,calls=0;const started=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;});
 const fetcher=async()=>{calls++;entered();await gate;return new Response('{}');};
 const first=collectCapabilityProbe(f.root,{...f,fetcher});await started;
 try{await assert.rejects(collectCapabilityProbe(f.root,{...f,fetcher}));}finally{release();}
 assert.equal((await first).previousPreserved,true);assert.equal(calls,1);
 const crash=await fixture(t);await mkdir(join(crash.root,slot),{mode:0o700});await assert.rejects(collectCapabilityProbe(crash.root,{...crash,fetcher}));assert.equal(calls,1);
 const exact=await fixture(t),body=JSON.stringify({x:'x'.repeat(2097152-8)}),r=await collectCapabilityProbe(exact.root,{...exact,fetcher:async()=>new Response(body)});
 assert.equal(r.jobs[0].state,'HTTP_200_JSON');assert.equal(r.responseBytes,2097152);assert.equal((await readFile(join(exact.root,slot,'response-0.json'))).length,2097152);
});
