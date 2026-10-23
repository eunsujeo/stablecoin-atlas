import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canonical} from '../tools/market-db/plan.mjs';
import {geographyPlan,prepareGeography,collectGeography,projectGeographyFlows,reviewGeography} from '../tools/allium-geography.mjs';
import {publishGeographyAvailability} from '../tools/allium-geography-preview.mjs';
import {alliumHash} from '../tools/allium-executor.mjs';
const at='2026-10-24T01:00:00.000Z',apiKey='fixture-only',approvalBytes=Buffer.from('User requests fixed country exchange flow verification'),kind='cex-flows',reply=v=>new Response(JSON.stringify(v),{status:200});
async function fixture(t){
 const root=await mkdtemp(join(await realpath(tmpdir()),'atlas-geo-flows-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'live-once'),{mode:0o700});await writeFile(join(root,'live-once','consumed'),'original',{mode:0o600});
 for(const name of ['discovery','balances','balances-diagnosis-20261024']){await mkdir(join(root,'geography-once',name),{recursive:true,mode:0o700});await writeFile(join(root,'geography-once',name,'receipt.json'),JSON.stringify({original:name,state:'UNKNOWN'}),{mode:0o600});}
 const authorizationBytes=await prepareGeography(root,{apiKey,approvalBytes,kind,now:at});return {root,apiKey,approvalBytes,authorizationBytes,reviewedHash:alliumHash(authorizationBytes),now:()=>at,sleep:async()=>{}};
}
const row=()=>{const p=geographyPlan(kind),t=p.targets[0];return {deployment_id:t.deploymentId,coin_id:t.coinId,requested_chain:t.networkId,observed_chain:t.networkId,observed_address:t.identity.address,provider_day:p.day,from_key:'geo:Fixture Country',to_key:'cex:Fixture Exchange',from_entity:'Fixture Country',to_entity:'Fixture Exchange',from_category:'individual',to_category:'cex',from_grain:'geo',to_grain:'entity',amount_str:'9007199254740993.000000000000000001',usd_amount_str:null,transfer_count_str:'9007199254740993'};};
function transport({status='success',statuses=[],rows=[row()],echo=geographyPlan(kind).sql,detailPatch={},createFailure=false,big=false}={}){
 let calls=0,reads=0;const urls=[];
 return {get calls(){return calls;},urls,fetcher:async(u,o)=>{calls++;urls.push(u);
  if(u.endsWith('/queries')){assert.equal(o.method,'POST');assert.equal(JSON.parse(o.body).config.sql,geographyPlan(kind).sql);if(createFailure)throw Error('lost create ack');return reply({query_id:'fixture-query'});}
  if(u.endsWith('/run-async'))return reply({run_id:'fixture-run'});
  if(u.endsWith('/status'))return reply(statuses[reads++]??status);
  if(u.includes('?query_id=')){assert.equal(o.method,'GET');return reply({query_id:'fixture-query',run_id:'fixture-run',status:'failed',query_config:{sql:geographyPlan(kind).sql},error:'Fixture table rejection',...detailPatch});}
  return reply({sql:echo,queried_at:at,meta:{row_count:rows.length},data:rows,...(big?{padding:'x'.repeat(2097152)}:{})});
 }};
}
test('existing plan bytes stay pinned and new plan is a bounded fixed country-exchange query',()=>{
 for(const [k,h] of [['discovery','b0a900b743bebef497f81946d023fcabe307d587dc05c79c32c9264ff20fa52c'],['balances','cbd32b73927407c7c28db33cfb6b4b6e93409b93bd2787ae7deda0be96ed55bb']])assert.equal(alliumHash(Buffer.from(canonical(geographyPlan(k)))),h);
 const p=geographyPlan(kind);assert.equal(p.targets.length,11);assert.equal(p.day,'2026-10-22');assert.equal(p.maxHttpRequests,13);assert.equal(p.maxRuns,1);assert.equal(p.retries,0);assert.match(p.sql,/cex_attributed_flows/);assert.match(p.sql,/from_grain = 'geo'/);assert.match(p.sql,/to_grain = 'geo'/);assert.doesNotMatch(p.sql,/geo_balances_daily/);
});
test('success preserves previous three slots, reviews exact amounts and never publishes flows as balances',async t=>{
 const f=await fixture(t),fake=transport(),r=await collectGeography(f.root,{...f,fetcher:fake.fetcher});assert.equal(r.state,'SUCCEEDED');assert.equal(r.legacyPreserved,true);assert.equal(fake.calls,4);
 for(const name of ['discovery','balances','balances-diagnosis-20261024'])assert.equal(await readFile(join(f.root,'geography-once',name,'receipt.json'),'utf8'),JSON.stringify({original:name,state:'UNKNOWN'}));
 const before=await readFile(join(f.root,'geography-once',kind,'receipt.json')),review=await reviewGeography(f.root,{kind,expectedSourceHash:r.sourceHash,expectedSqlHash:geographyPlan(kind).sqlHash,now:at});assert.equal(review.kind,'ALLIUM_GEOGRAPHY_FLOW_REVIEW');assert.equal(review.rows[0].amount,row().amount_str);assert.equal(review.rows[0].transferCount,row().transfer_count_str);assert.equal(review.rows[0].usdAmount,null);assert.equal(review.rows[0].direction,'COUNTRY_TO_EXCHANGE');assert.deepEqual(await readFile(join(f.root,'geography-once',kind,'receipt.json')),before);
 await assert.rejects(publishGeographyAvailability({kind,executionRoot:f.root,outputDirectory:join(f.root,'preview')}));await assert.rejects(collectGeography(f.root,{...f,fetcher:fake.fetcher}));assert.equal(fake.calls,4);
});
test('explicit failure reads same-query diagnostic once, keeps UNKNOWN and stops within 13 HTTP even at last poll',async t=>{
 const f=await fixture(t),fake=transport({statuses:[...Array(9).fill('running'),'failed']}),r=await collectGeography(f.root,{...f,fetcher:fake.fetcher});assert.equal(r.state,'UNKNOWN');assert.equal(r.failure,'PROVIDER_RUN_FAILED');assert.equal(r.diagnosisState,'OBSERVED');assert.equal(r.httpAttempts,13);assert.equal(r.runs,1);assert.equal(r.legacyPreserved,true);assert.equal(fake.urls.filter(u=>u.includes('?query_id=')).length,1);assert.equal(fake.urls.some(u=>u.endsWith('/results')),false);
 const fresh=await prepareGeography(f.root,{apiKey,approvalBytes,kind,now:at});await assert.rejects(collectGeography(f.root,{...f,authorizationBytes:fresh,reviewedHash:alliumHash(fresh),fetcher:fake.fetcher}));assert.equal(fake.calls,13);
});
test('wrong diagnostic run or SQL never certifies error information; original failure remains UNKNOWN',async t=>{
 for(const detailPatch of [{run_id:'another-run'},{query_config:{sql:'SELECT 1'}},{error:null}]){const f=await fixture(t),fake=transport({status:'failed',detailPatch}),r=await collectGeography(f.root,{...f,fetcher:fake.fetcher});assert.equal(r.state,'UNKNOWN');assert.equal(r.diagnosisState,'UNKNOWN');assert.equal(r.errorHash,null);assert.equal(fake.calls,4);}
});
test('ACK loss, HTTP rejection, canceled and unconfirmed status do not trigger diagnostics or retries',async t=>{
 for(const options of [{createFailure:true},{status:'canceled'},{status:'running'}]){const f=await fixture(t),fake=transport(options),r=await collectGeography(f.root,{...f,fetcher:fake.fetcher});assert.equal(r.state,'UNKNOWN');assert.equal(fake.urls.some(u=>u.includes('?query_id=')),false);const calls=fake.calls;await assert.rejects(collectGeography(f.root,{...f,fetcher:fake.fetcher}));assert.equal(fake.calls,calls);}
 const f=await fixture(t);let calls=0;const r=await collectGeography(f.root,{...f,fetcher:async()=>{calls++;return new Response('{}',{status:403});}});assert.equal(r.state,'UNKNOWN');assert.equal(calls,1);
});
test('flow direction, identity, decimal and count validation reject false evidence and preserve null and explicit zero',()=>{
 const r=row(),reverse={...r,from_key:r.to_key,to_key:r.from_key,from_entity:r.to_entity,to_entity:r.from_entity,from_category:r.to_category,to_category:r.from_category,from_grain:r.to_grain,to_grain:r.from_grain};
 assert.equal(projectGeographyFlows({data:[reverse]})[0].direction,'EXCHANGE_TO_COUNTRY');assert.equal(projectGeographyFlows({data:[reverse]})[0].country,r.from_entity);
 const zero=projectGeographyFlows({data:[{...r,from_entity:null,amount_str:'0',transfer_count_str:null}]})[0];assert.equal(zero.country,null);assert.equal(zero.amount,'0');assert.equal(zero.transferCount,null);
 for(const patch of [{observed_chain:'wrong'},{provider_day:'2026-10-21'},{observed_address:'wrong'},{from_grain:'entity'},{to_category:'individual'},{to_grain:'geo'},{amount_str:1},{transfer_count_str:'1.1'},{transfer_count_str:1}])assert.throws(()=>projectGeographyFlows({data:[{...r,...patch}]}));
 assert.throws(()=>projectGeographyFlows({data:[r,r]}));
});
test('sentinel, oversized response, echo mismatch and empty results remain distinct',async t=>{
 for(const options of [{rows:Array(3301).fill(row())},{big:true}]){const f=await fixture(t),fake=transport(options),r=await collectGeography(f.root,{...f,fetcher:fake.fetcher});assert.equal(r.state,'UNKNOWN');assert.equal(fake.calls,4);}
 const f=await fixture(t),echo=geographyPlan(kind).sql+';',fake=transport({echo}),r=await collectGeography(f.root,{...f,fetcher:fake.fetcher});assert.equal(r.failure,'SQL_ECHO_REVIEW_REQUIRED');assert.equal((await reviewGeography(f.root,{kind,expectedSourceHash:r.sourceHash,expectedSqlHash:alliumHash(Buffer.from(echo)),now:at})).state,'OBSERVED');
 const empty=await fixture(t),e=transport({rows:[]}),result=await collectGeography(empty.root,{...empty,fetcher:e.fetcher});assert.equal((await reviewGeography(empty.root,{kind,expectedSourceHash:result.sourceHash,expectedSqlHash:geographyPlan(kind).sqlHash,now:at})).state,'MISSING');
});
test('lock, expiry, altered previous evidence, wrong key and old authorization fail before any send',async t=>{
 const f=await fixture(t);let calls=0;const fetcher=async()=>{calls++;throw Error('unexpected send');};
 await mkdir(join(f.root,'reservation-lock'),{mode:0o700});await assert.rejects(collectGeography(f.root,{...f,fetcher}));await rm(join(f.root,'reservation-lock'),{recursive:true});
 for(const patch of [{now:()=> '2026-10-24T01:15:00.000Z'},{apiKey:'wrong'},{approvalBytes:Buffer.from('wrong approval')}])await assert.rejects(collectGeography(f.root,{...f,...patch,fetcher}));
 const old=JSON.parse(f.authorizationBytes);old.plan=geographyPlan('balances');const bytes=Buffer.from(canonical(old));await assert.rejects(collectGeography(f.root,{...f,authorizationBytes:bytes,reviewedHash:alliumHash(bytes),fetcher}));
 await writeFile(join(f.root,'geography-once/balances/receipt.json'),'changed');await assert.rejects(collectGeography(f.root,{...f,fetcher}));assert.equal(calls,0);
});
