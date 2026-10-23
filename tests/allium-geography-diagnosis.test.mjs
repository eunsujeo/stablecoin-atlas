import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareGeography,collectGeography,geographyPlan} from '../tools/allium-geography.mjs';
import {prepareGeographyDiagnosis,collectGeographyDiagnosis} from '../tools/allium-geography-diagnosis.mjs';
import {alliumHash} from '../tools/allium-executor.mjs';
const at='2026-10-24T01:00:00.000Z',apiKey='fixture-only',approvalBytes=Buffer.from('User requests country balance collection'),reply=v=>new Response(JSON.stringify(v),{status:200});
async function fixture(t){
 const root=await mkdtemp(join(await realpath(tmpdir()),'atlas-geo-diagnosis-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'live-once'),{mode:0o700});await writeFile(join(root,'live-once','consumed'),'original',{mode:0o600});
 const authorizationBytes=await prepareGeography(root,{apiKey,approvalBytes,kind:'balances',now:at});
 await collectGeography(root,{apiKey,approvalBytes,authorizationBytes,reviewedHash:alliumHash(authorizationBytes),now:()=>at,sleep:async()=>{},fetcher:async u=>reply(u.endsWith('/queries')?{query_id:'fixture-query'}:u.endsWith('/run-async')?{run_id:'fixture-run'}:'failed')});
 const diagnosis=await prepareGeographyDiagnosis(root,{apiKey,approvalBytes,now:at});
 return {root,apiKey,approvalBytes,authorizationBytes:diagnosis,reviewedHash:alliumHash(diagnosis),now:()=>at};
}
const detail=()=>({query_id:'fixture-query',run_id:'fixture-run',status:'failed',query_config:{sql:geographyPlan('balances').sql},error:'Fixture diagnostic error; not a real provider observation'});
test('diagnosis makes one GET for the pinned failed run, persists intent before dispatch and preserves original bytes',async t=>{
 const f=await fixture(t),p=join(f.root,'geography-once/balances/receipt.json'),before=await readFile(p);let calls=0;
 const fetcher=async(u,o)=>{calls++;assert.equal(u,'https://api.allium.so/api/v1/explorer/query-runs?query_id=fixture-query');assert.equal(o.method,'GET');assert.ok(await readFile(join(f.root,'geography-once/balances-diagnosis-20261024/intent-0.json')));return reply(detail());};
 const r=await collectGeographyDiagnosis(f.root,{...f,fetcher});assert.equal(r.state,'OBSERVED');assert.equal(r.previousPreserved,true);assert.equal(r.runs,0);assert.equal(r.httpAttempts,1);assert.doesNotMatch(JSON.stringify(r),/fixture-query|Fixture diagnostic/);assert.deepEqual(await readFile(p),before);
 await assert.rejects(collectGeographyDiagnosis(f.root,{...f,fetcher}));
 const fresh=await prepareGeographyDiagnosis(f.root,{apiKey,approvalBytes,now:at});await assert.rejects(collectGeographyDiagnosis(f.root,{...f,authorizationBytes:fresh,reviewedHash:alliumHash(fresh),fetcher}));assert.equal(calls,1);
});
test('lost acknowledgement permanently consumes diagnosis and never retries',async t=>{
 const f=await fixture(t);let calls=0;const fetcher=async()=>{calls++;throw Error('lost acknowledgement');};
 assert.equal((await collectGeographyDiagnosis(f.root,{...f,fetcher})).state,'UNKNOWN');await assert.rejects(collectGeographyDiagnosis(f.root,{...f,fetcher}));assert.equal(calls,1);
});
test('wrong run, changed SQL, missing error and HTTP rejection do not certify a diagnosis',async t=>{
 for(const patch of [{run_id:'another-run'},{query_config:{sql:'SELECT 1'}},{error:null},{status:'success'}]){
  const f=await fixture(t);const r=await collectGeographyDiagnosis(f.root,{...f,fetcher:async()=>reply({...detail(),...patch})});assert.equal(r.state,'UNKNOWN');assert.equal(r.httpAttempts,1);
 }
 const f=await fixture(t),r=await collectGeographyDiagnosis(f.root,{...f,fetcher:async()=>new Response('{}',{status:403})});assert.equal(r.state,'UNKNOWN');assert.equal(r.httpAttempts,1);
});
test('lock, expiry, wrong approval/key and altered authorization are rejected before dispatch',async t=>{
 const f=await fixture(t);let calls=0;const fetcher=async()=>{calls++;return reply(detail());};
 await mkdir(join(f.root,'reservation-lock'),{mode:0o700});await assert.rejects(collectGeographyDiagnosis(f.root,{...f,fetcher}));await rm(join(f.root,'reservation-lock'),{recursive:true});
 for(const patch of [{now:()=> '2026-10-24T01:15:00.000Z'},{apiKey:'wrong'},{approvalBytes:Buffer.from('another approval')},{reviewedHash:'0'.repeat(64)}])await assert.rejects(collectGeographyDiagnosis(f.root,{...f,...patch,fetcher}));
 const altered=Buffer.from(JSON.stringify({...JSON.parse(f.authorizationBytes),maxHttpRequests:2}));await assert.rejects(collectGeographyDiagnosis(f.root,{...f,authorizationBytes:altered,reviewedHash:alliumHash(altered),fetcher}));assert.equal(calls,0);
});
test('changed legacy or another geographic archive invalidates the authorization without sending',async t=>{
 for(const change of ['legacy','other-slot','source']){
  const f=await fixture(t);let calls=0;
  if(change==='legacy')await writeFile(join(f.root,'live-once/consumed'),'changed');
  else if(change==='other-slot'){await mkdir(join(f.root,'geography-once/discovery'),{mode:0o700});await writeFile(join(f.root,'geography-once/discovery/receipt.json'),'{}',{mode:0o600});}
  else await writeFile(join(f.root,'geography-once/balances/response-2.json'),'"success"');
  await assert.rejects(collectGeographyDiagnosis(f.root,{...f,fetcher:async()=>{calls++;return reply(detail());}}));assert.equal(calls,0);
 }
});
