import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dailyPlan,verifyDailyPlan,dailyHash,eu,euText,dailyBudget,validateSimulationAuthorization} from '../tools/allium-daily-plan.mjs';
import {initialDailyState,applyDailyEvent,dailyView,dailyReservationState,sentDailyContext} from '../tools/allium-daily-state.mjs';
import {simulation,simulationOrg as org,dailyResponse} from './allium-daily-fixture.mjs';
import {reviewDailyReconciliation} from '../tools/allium-reconciliation-review.mjs';
const at='2026-10-23T10:00:00.000000Z';
const blocked=fn=>assert.throws(fn,/ALLIUM_DAILY_OFFLINE_BLOCKED/);
function setup(now=at,mutate){
 const f=simulation(now,mutate),s=initialDailyState(f.authorization.organizationHash);let sequence=0;
 const add=e=>applyDailyEvent(s,{...e,organizationHash:s.organizationHash,at:now});
 const usageId=dailyHash('usage'+sequence++);add({type:'USAGE_INTENT',id:usageId});add({type:'USAGE_RESPONSE',intentId:usageId,body:f.usage});
 const id=dailyHash({organizationHash:s.organizationHash,day:f.plan.asOfDay,kind:'daily'});
 add({type:'RESERVE',id,kind:'daily',plan:f.plan,authorization:f.authorization,ackHash:dailyHash('ACK')});
 add({type:'CONFIRM_RESERVATION',reservationId:id,ackHash:dailyHash('ACK')});
 return {...f,s,id,add};
}
function send(f,job,operation,body){
 const r=f.s.reservations.find(r=>r.id===f.id),id=dailyHash({reservationId:f.id,ordinal:r.intents.length});
 f.add({type:'INTENT',id,reservationId:f.id,job,operation});f.add({type:'FAKE_SEND',reservationId:f.id,intentId:id});
 f.add({type:'RESPONSE',reservationId:f.id,intentId:id,body:typeof body==='string'?body:JSON.stringify(body)});return id;
}
const ok={state:'OK',referenceHash:dailyHash('SIMULATED REFERENCE')};
test('import replay validates result bytes at original observation time, preserves UNKNOWN, and cannot complete or rearm jobs',()=>{
 for(const scenario of ['valid','cost','sql','period']){
  const f=setup();send(f,'supply','create',ok);send(f,'supply','run',ok);send(f,'supply','status',{status:'success'});
  const id=dailyHash({reservationId:f.id,ordinal:3});f.add({type:'INTENT',id,reservationId:f.id,job:'supply',operation:'result'});
  f.add({type:'FAKE_SEND',reservationId:f.id,intentId:id});
  const raw=Buffer.from(dailyResponse(f.plan,'supply',scenario==='cost'?{cost:'0.200000000000000001'}:scenario==='sql'?{echo:'SELECT SIMULATED_WRONG_QUERY'}:{cost:'0.05360000000000001'}));
  const evidence={...sentDailyContext(f.s,f.id,id),schema:1,kind:'ALLIUM_OFFLINE_SIMULATED_RESPONSE',storeHash:dailyHash('FAKE STORE'),
   fixtureHash:dailyHash('FAKE EPOCH'),dbEpoch:dailyHash('FAKE EPOCH'),organizationHash:org,observedAt:at,
   rawLength:raw.length,rawHash:dailyHash(raw),rawBase64:raw.toString('base64')};
  if(scenario==='period')evidence.observedAt='2026-11-01T10:00:00.000000Z';
  const event={type:'RESPONSE_IMPORTED',organizationHash:org,at:'2026-11-02T10:00:00.000000Z',evidence,evidenceHash:dailyHash(evidence)};
  if(scenario==='period'){blocked(()=>applyDailyEvent(f.s,event));continue;}
  applyDailyEvent(f.s,event);const v=dailyView(f.s),r=f.s.reservations[0];
  const before=structuredClone(f.s),report=reviewDailyReconciliation(f.s.events,{organizationHash:org,fixtureHash:evidence.fixtureHash});
  const item=report.reservations[0].intents[3];
  assert.equal(item.contentState,scenario==='valid'?'RESULT_VALIDATED':'UNKNOWN');
  assert.equal(item.reportedResultUnits,scenario==='valid'?'0.05360000000000001':null);
  assert.equal(item.observedAt,at);assert.equal(item.reviewedAt,event.at);assert.equal(item.evidenceHash,event.evidenceHash);
  assert.equal(report.publication,'NOT_VERIFIED');assert.equal(report.costAttribution,'UNKNOWN');assert.equal(report.usageFinality,'UNKNOWN');
  assert.equal(report.reservations[0].usageIncludedUnits,null);assert.equal(report.reservations[0].reconciledUnits,'0');
  assert.equal(report.pendingUnits,'0.5');assert.equal(report.debitEnabled,false);assert.deepEqual(f.s,before);
  assert.doesNotMatch(JSON.stringify(report),/rawBase64|referenceHash|rawLength/);
  blocked(()=>reviewDailyReconciliation(f.s.events,{organizationHash:org,fixtureHash:dailyHash('OTHER FIXTURE')}));
  assert.equal(v.reservations[0].importedResponses[0].reviewed.state,scenario==='valid'?'VALIDATED':'UNKNOWN');
  assert.equal(r.intents[3].response,null);assert.equal(r.jobs[0].complete,false);assert.equal(v.reservations[0].state,'UNKNOWN');assert.equal(v.pendingUnits,'0.5');
  blocked(()=>applyDailyEvent(f.s,event));
  blocked(()=>applyDailyEvent(f.s,{type:'RESPONSE',organizationHash:org,at:event.at,reservationId:f.id,intentId:id,body:raw.toString()}));
 }
});
test('reconciliation summary distinguishes unsent, absent import, inline response and imported control without certifying costs',()=>{
 const f=setup(),fixtureHash=dailyHash('REVIEW FIXTURE'),id=dailyHash({reservationId:f.id,ordinal:0});
 const report=()=>reviewDailyReconciliation(f.s.events,{organizationHash:org,fixtureHash});
 f.add({type:'INTENT',id,reservationId:f.id,job:'supply',operation:'create'});
 assert.equal(report().reservations[0].intents[0].evidenceState,'NOT_SENT');
 f.add({type:'FAKE_SEND',reservationId:f.id,intentId:id});
 assert.equal(report().reservations[0].intents[0].evidenceState,'NOT_IMPORTED');
 const raw=Buffer.from(JSON.stringify(ok)),evidence={...sentDailyContext(f.s,f.id,id),schema:1,kind:'ALLIUM_OFFLINE_SIMULATED_RESPONSE',
  storeHash:dailyHash('STORE'),fixtureHash,dbEpoch:fixtureHash,organizationHash:org,observedAt:at,
  rawLength:raw.length,rawHash:dailyHash(raw),rawBase64:raw.toString('base64')};
 f.add({type:'RESPONSE_IMPORTED',evidence,evidenceHash:dailyHash(evidence)});
 const imported=report().reservations[0].intents[0];assert.equal(imported.evidenceState,'IMPORTED');
 assert.equal(imported.contentState,'CONTROL_RESPONSE_ONLY');assert.equal(imported.reportedResultUnits,null);
 assert.equal(imported.reconciledUnits,'0');assert.equal(imported.costAttribution,'UNKNOWN');
 const inline=setup();send(inline,'supply','create',ok);
 const i=reviewDailyReconciliation(inline.s.events,{organizationHash:org,fixtureHash}).reservations[0].intents[0];
 assert.equal(i.evidenceState,'INLINE_RESPONSE_ONLY');assert.equal(i.contentState,'NOT_TESTED');assert.equal(i.rawHash,null);
 const corrupted=structuredClone(f.s.events);corrupted.at(-1).evidence.rawHash=dailyHash('WRONG');
 blocked(()=>reviewDailyReconciliation(corrupted,{organizationHash:org,fixtureHash}));
});
test('daily plans remain offline, bind exact approved SQL/identity, exclude registry and XRPL execution',()=>{
 const p=dailyPlan({asOfDay:'2026-10-23'});assert.deepEqual(p.jobs.map(j=>j.kind),['supply','volume']);assert.equal(p.executionEnabled,false);
 assert.deepEqual(p.window,{from:'2026-10-16',untilExclusive:'2026-10-23',days:7,dateBasis:'PROVIDER_DAY',aggregateTimezone:'UNKNOWN'});
 assert.equal(p.policy.maxTotalHttpRequests,27);assert.equal(p.policy.retries,0);assert(p.jobs.every(j=>j.resultLimit===78));
 assert.equal(p.targets.filter(t=>t.family==='XRPL').length,2);assert.equal(verifyDailyPlan(p),p);
 for(const mutate of [p=>p.executionEnabled=true,p=>p.policy.retries=1,p=>p.jobs[0].sql+=' ',p=>p.targets[0].identity.address='other']){
  const altered=structuredClone(p);mutate(altered);const {planHash,...body}=altered;altered.planHash=dailyHash(body);blocked(()=>verifyDailyPlan(altered));
 }
 for(const day of ['2026-02-30','2026-10-23T00:00:00Z',undefined])assert.throws(()=>dailyPlan({asOfDay:day}));
});
test('EU arithmetic is exact; invalid amounts and each budget boundary fail closed',()=>{
 assert.equal(euText(eu('0.05360000000000001')+eu('0.03758333333333334')),'0.09118333333333335');
 for(const v of [0,1.1,null,undefined,'-1','1e2','01','0.0000000000000000001','1000000000000000000000'])blocked(()=>eu(v));
 const f=simulation(at),usage={...f.usage,at,state:'SUCCEEDED'};
 assert.equal(dailyBudget({authorization:f.authorization,usage,reservations:[],kind:'daily',now:at}).reservedUnits,'0.5');
 for(const key of ['dayBudgetUnits','periodBudgetUnits','hardRemainingUnits']){
  const a={...f.authorization,[key]:'0.499999999999999999'};blocked(()=>dailyBudget({authorization:a,usage,reservations:[],kind:'daily',now:at}));
 }
 blocked(()=>dailyBudget({authorization:f.authorization,usage:{...usage,consumedUnits:'99.500000000000000001'},reservations:[],kind:'daily',now:at}));
 for(const v of [null,'1',1,'0.000000000000000001']){
  const a=structuredClone(f.authorization);a.executionEnabled=v;blocked(()=>validateSimulationAuthorization(a,f.plan,at));
 }
});
test('simulation authorization rejects real/unknown controls, missing transition and time/identity mismatch',()=>{
 const f=simulation(at);validateSimulationAuthorization(f.authorization,f.plan,at);
 for(const mutate of [a=>a.kind='ALLIUM_REVIEWED_SURVEY_AUTHORIZATION',a=>a.exclusiveConsumer=false,a=>a.overagesDisabled=false,
  a=>a.transition='UNREVIEWED',a=>a.controlsHash=null,a=>a.expiresAt=at,a=>a.reviewedAt='2026-10-23T10:00:01Z',a=>a.apiKey='forbidden',a=>a.maxUnits.supply=1]){
  const a=structuredClone(f.authorization);mutate(a);blocked(()=>validateSimulationAuthorization(a,f.plan,at));
 }
});
test('successful fake exchange validates amount strings, actual zero/null and exact echo without granting execution',()=>{
 const f=setup();
 for(const job of ['supply','volume']){
  send(f,job,'create',ok);send(f,job,'run',ok);send(f,job,'status',{status:'queued'});send(f,job,'status',{status:'success'});
  send(f,job,'result',dailyResponse(f.plan,job,{mutate:r=>{r.data[0][job==='supply'?'total_supply_str':'transfer_volume_str']='0';}}));
 }
 const v=dailyView(f.s);assert.equal(v.reservations[0].state,'SUCCEEDED');assert.equal(v.reservations[0].fakeSends,10);assert.equal(v.providerRequests,0);assert.equal(v.executionEnabled,false);
 assert.equal(v.reconciliation,'NOT_ENABLED_C_ZERO');
});
test('create and run repeat, job reordering and response loss never generate a second fake send',()=>{
 const f=setup();blocked(()=>send(f,'volume','create',ok));
 send(f,'supply','create',ok);blocked(()=>send(f,'supply','create',ok));send(f,'supply','run',ok);blocked(()=>send(f,'supply','run',ok));
 const r=f.s.reservations[0],id=dailyHash({reservationId:f.id,ordinal:r.intents.length});
 f.add({type:'INTENT',id,reservationId:f.id,job:'supply',operation:'status'});assert.equal(dailyReservationState(r),'UNKNOWN');
 blocked(()=>f.add({type:'INTENT',id,reservationId:f.id,job:'supply',operation:'status'}));
 assert.equal(dailyView(f.s).reservations[0].fakeSends,2);
});
test('poll exhaustion, explicit failure, cost overrun, missing cost, truncated/malformed and unreviewed echo stop subsequent jobs',()=>{
 for(const which of ['poll','failed','overrun','costMissing','echo','truncated','amountNumber','malformed']){
  const f=setup();send(f,'supply','create',ok);send(f,'supply','run',ok);
  if(which==='poll')for(let n=0;n<10;n++)send(f,'supply','status',{status:'running'});
  else if(which==='failed')send(f,'supply','status',{status:'failed'});
  else{
   send(f,'supply','status',{status:'success'});
   const body=which==='malformed'?'not JSON':dailyResponse(f.plan,'supply',{cost:which==='overrun'?'0.200000000000000001':'0.1',echo:which==='echo'?'SELECT 1':undefined,
    mutate:r=>{if(which==='costMissing')delete r.meta.cost_explorer_units;if(which==='truncated')r.data.push(...r.data);if(which==='amountNumber')r.data[0].total_supply_str=1;}});
   send(f,'supply','result',body);
  }
  assert.equal(dailyView(f.s).reservations[0].state,which==='failed'?'FAILED':'UNKNOWN');blocked(()=>send(f,'volume','create',ok));
 }
});
test('unreconciled costs, registry reservation and key rotation share one organization budget',()=>{
 const f=setup(),a=structuredClone(f.authorization);a.keyHash=dailyHash('ROTATED SIMULATED KEY');
 const id=dailyHash({organizationHash:org,day:f.plan.asOfDay,kind:'registry'});
 f.add({type:'RESERVE',id,kind:'registry',plan:f.plan,authorization:a,ackHash:dailyHash('REGISTRY ACK')});
 f.add({type:'CONFIRM_RESERVATION',reservationId:id,ackHash:dailyHash('REGISTRY ACK')});
 assert.equal(f.s.reservations.length,2);
 const b=dailyBudget({authorization:a,usage:f.s.usages[0],reservations:f.s.reservations,kind:'registry',now:at});assert.equal(b.pendingUnits,'0.6');
 const lower=structuredClone(a);lower.periodBudgetUnits='0.6';blocked(()=>dailyBudget({authorization:lower,usage:f.s.usages[0],reservations:f.s.reservations,kind:'registry',now:at}));
 blocked(()=>f.add({type:'RESERVE',id:f.id,kind:'daily',plan:f.plan,authorization:a}));
});
test('stale/failed usage, rollback of usage consumption, UTC and cap/allocation boundaries do not reset reservations',()=>{
 const f=setup();
 blocked(()=>validateSimulationAuthorization(f.authorization,f.plan,'2026-10-23T11:00:01Z'));
 blocked(()=>dailyBudget({authorization:f.authorization,usage:f.s.usages[0],reservations:[],kind:'daily',now:'2026-10-23T11:00:01Z'}));
 const later=simulation('2026-10-24T10:00:00.000000Z'),u='later-usage';
 applyDailyEvent(f.s,{type:'USAGE_INTENT',id:u,organizationHash:org,at:'2026-10-24T10:00:00.000000Z'});
 blocked(()=>applyDailyEvent(structuredClone(f.s),{type:'USAGE_RESPONSE',intentId:u,body:{...later.usage,consumedUnits:'0.9'},organizationHash:org,at:'2026-10-24T10:00:00.000000Z'}));
 const next=simulation('2026-11-01T00:00:00.000000Z');
 blocked(()=>dailyBudget({authorization:next.authorization,usage:{...next.usage,state:'SUCCEEDED',at:'2026-11-01T00:00:00.000000Z'},reservations:f.s.reservations,kind:'daily',now:'2026-11-01T00:00:00.000000Z'}));
 const cap=structuredClone(f.authorization);cap.capEnd='2026-10-23T10:00:00.000000Z';blocked(()=>validateSimulationAuthorization(cap,f.plan,at));
 const s=initialDailyState(org);applyDailyEvent(s,{type:'USAGE_INTENT',id:u,organizationHash:org,at});
 blocked(()=>applyDailyEvent(s,{type:'USAGE_RESPONSE',intentId:u,body:{...f.usage,apiKey:'FORBIDDEN_SIMULATED_FIELD'},organizationHash:org,at}));assert.equal(s.usages[0].responded,undefined);
 blocked(()=>applyDailyEvent(s,{type:'USAGE_INTENT',id:'retry',organizationHash:org,at}));
 blocked(()=>dailyBudget({authorization:f.authorization,usage:s.usages[0],reservations:[],kind:'daily',now:at}));
});
test('previous-day UNKNOWN and independent cap reset never authorize a new daily bundle',()=>{
 const f=setup(),id=dailyHash({reservationId:f.id,ordinal:0});f.add({type:'INTENT',id,reservationId:f.id,job:'supply',operation:'create'});
 const nextAt='2026-10-24T10:00:00.000000Z',next=simulation(nextAt),add=e=>applyDailyEvent(f.s,{...e,organizationHash:org,at:nextAt});
 add({type:'USAGE_INTENT',id:'next-day'});add({type:'USAGE_RESPONSE',intentId:'next-day',body:next.usage});
 blocked(()=>add({type:'RESERVE',id:dailyHash({organizationHash:org,day:next.plan.asOfDay,kind:'daily'}),kind:'daily',plan:next.plan,authorization:next.authorization,ackHash:dailyHash('NEXT ACK')}));
 assert.equal(dailyView(f.s).reservations[0].state,'UNKNOWN');assert.equal(f.s.reservations[0].reservedUnits,'0.5');
 const cap=structuredClone(next.authorization);cap.capStart='2026-10-24T09:00:00Z';
 blocked(()=>dailyBudget({authorization:cap,usage:{...next.usage,state:'SUCCEEDED',at:nextAt},reservations:f.s.reservations,kind:'daily',now:nextAt}));
 assert.equal(dailyPlan({asOfDay:'2024-03-01'}).window.from,'2024-02-23');
});
test('daily modules expose no provider URL, environment/credential loader, live executor or CLI',async()=>{
 for(const name of ['allium-daily-plan','allium-daily-state','allium-reconciliation-review','allium-cost-evidence-review','market-db/allium-daily-lab']){
  const source=await readFile(new URL('../tools/'+name+'.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/api\.allium\.so|process\.env|fetch\(|workspaceEnvironment|executeAllium|pathToFileURL/);
 }
});
