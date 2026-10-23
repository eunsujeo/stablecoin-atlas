import {canonical,epochMicros,instant} from './market-db/plan.mjs';
import {parseHistorySource} from './supply-history-source.mjs';
import {dailyHash,dailyFail,hashValue,eu,euText,validateSimulationAuthorization,verifyDailyPlan,dailyBudget,dailyResult} from './allium-daily-plan.mjs';

export const initialDailyState=organizationHash=>{
 if(!hashValue(organizationHash))dailyFail();return {organizationHash,events:[],usages:[],reservations:[]};
};
const assert=(v)=>{if(!v)dailyFail();};
export function dailyReservationState(r){
 if(!r.acknowledged)return 'UNKNOWN';
 if(r.blocked)return r.blocked;
 if(r.intents.some(i=>!i.response))return 'UNKNOWN';
 if(r.kind==='registry')return 'RESERVED_ACCOUNTING_ONLY';
 return r.jobs.every(j=>j.complete)?'SUCCEEDED':r.intents.length?'RUNNING':'RESERVED';
}
function activeGate(s,r,at){
 validateSimulationAuthorization(r.authorization,r.plan,at);
 assert(r.authorization.organizationHash===s.organizationHash);
 dailyBudget({authorization:r.authorization,usage:s.usages.find(u=>u.day===at.slice(0,10)),reservations:s.reservations.filter(x=>x.id!==r.id),kind:r.kind,now:at});
 assert(!s.reservations.some(x=>x.id!==r.id&&(dailyReservationState(x)==='UNKNOWN'||x.day<at.slice(0,10)&&dailyReservationState(x)!=='SUCCEEDED')));
}
const nextJob=r=>r.jobs.find(j=>!j.complete);
function intentAllowed(r,job,operation){
 assert(r.kind==='daily'&&!r.blocked&&!r.intents.some(i=>!i.response));
 const j=nextJob(r);assert(j?.kind===job);
 const history=r.intents.filter(i=>i.job===job),last=history.at(-1);
 if(!last)assert(operation==='create');
 else if(last.operation==='create')assert(operation==='run');
 else if(last.operation==='run')assert(operation==='status');
 else if(last.operation==='status')assert(last.response.status==='success'?operation==='result':operation==='status'&&history.filter(i=>i.operation==='status').length<10);
 else dailyFail();
 assert(r.intents.length<26);
}
function response(r,i,body,at){
 if(body===null){r.blocked='UNKNOWN';return {state:'UNKNOWN'};}
 assert(typeof body==='string'&&Buffer.byteLength(body)<=2097152);
 let parsed;
 try{parsed=JSON.parse(body);}catch{r.blocked='UNKNOWN';return {state:'UNKNOWN'};}
 if(i.operation==='create'||i.operation==='run'){
  if(parsed?.state!=='OK'||!hashValue(parsed.referenceHash)){r.blocked='UNKNOWN';return {state:'UNKNOWN'};}
  return {state:'OK',referenceHash:parsed.referenceHash};
 }
 if(i.operation==='status'){
  const status=parsed?.status;
  if(['failed','canceled'].includes(status)){r.blocked='FAILED';return {status};}
  if(!['created','queued','running','success'].includes(status)){r.blocked='UNKNOWN';return {state:'UNKNOWN'};}
  if(status!=='success'&&r.intents.filter(x=>x.job===i.job&&x.operation==='status').length>=10)r.blocked='UNKNOWN';
  return {status};
 }
 try{
  const bytes=Buffer.from(body),raw=parseHistorySource(bytes),cost=raw?.meta?.cost_explorer_units;
  if(eu(cost)>eu(r.authorization.maxUnits[i.job]))dailyFail();
  dailyResult(r.plan,i.job,bytes,at);r.jobs.find(j=>j.kind===i.job).complete=true;
  return {state:'VALIDATED',sourceHash:dailyHash(bytes),observedUnits:cost};
 }catch{r.blocked='UNKNOWN';return {state:'UNKNOWN',sourceHash:dailyHash(Buffer.from(body))};}
}
// Append-only semantic replay is used for reads as well as writes. No provider I/O exists here.
export function applyDailyEvent(s,event){
 assert(event&&event.organizationHash===s.organizationHash&&typeof event.type==='string');instant(event.at);
 assert(!s.events.length||epochMicros(event.at)>=epochMicros(s.events.at(-1).at));
 if(event.type==='USAGE_INTENT'){
  assert(!s.usages.some(u=>u.day===event.at.slice(0,10)));
  s.usages.push({organizationHash:s.organizationHash,day:event.at.slice(0,10),at:event.at,state:'UNKNOWN',intentId:event.id});
 }else if(event.type==='USAGE_RESPONSE'){
  const u=s.usages.find(x=>x.intentId===event.intentId);assert(u&&!u.responded);
  if(event.body!==null){
   const b=event.body;assert(b.kind==='ALLIUM_SIMULATED_USAGE'&&b.organizationHash===s.organizationHash&&hashValue(b.sourceHash)&&
    Object.keys(b).sort().join(',')===['kind','organizationHash','allocationStart','allocationEnd','includedUnits','consumedUnits','sourceHash'].sort().join(','));
   instant(b.allocationStart);instant(b.allocationEnd);
   assert(epochMicros(b.allocationStart)<=epochMicros(u.at)&&epochMicros(u.at)<epochMicros(b.allocationEnd)&&eu(b.includedUnits)>=eu(b.consumedUnits));
   const previous=s.usages.filter(x=>x!==u&&x.state==='SUCCEEDED'&&x.allocationStart===b.allocationStart&&x.allocationEnd===b.allocationEnd).at(-1);
   assert(!previous||eu(b.consumedUnits)>=eu(previous.consumedUnits));
   Object.assign(u,{state:'SUCCEEDED',allocationStart:b.allocationStart,allocationEnd:b.allocationEnd,includedUnits:b.includedUnits,consumedUnits:b.consumedUnits,sourceHash:b.sourceHash});
  }
  u.responded=true;
 }else if(event.type==='RESERVE'){
  const {plan,authorization:a,kind}=event;verifyDailyPlan(plan);validateSimulationAuthorization(a,plan,event.at);
  assert(a.organizationHash===s.organizationHash&&event.id===dailyHash({organizationHash:s.organizationHash,day:plan.asOfDay,kind}));
  assert(!s.reservations.some(r=>r.id===event.id));
  assert(hashValue(event.ackHash));
  const r={id:event.id,kind,day:plan.asOfDay,plan,authorization:a,ackHash:event.ackHash,acknowledged:false,intents:[],jobs:plan.jobs.map(j=>({kind:j.kind,complete:false}))};
  activeGate(s,r,event.at);
  r.reservedUnits=dailyBudget({authorization:a,usage:s.usages.find(u=>u.day===plan.asOfDay),reservations:s.reservations,kind,now:event.at}).reservedUnits;
  s.reservations.push(r);
 }else if(event.type==='CONFIRM_RESERVATION'){
  const r=s.reservations.find(r=>r.id===event.reservationId);assert(r&&!r.acknowledged&&r.ackHash===event.ackHash);activeGate(s,r,event.at);r.acknowledged=true;
 }else if(event.type==='INTENT'){
  const r=s.reservations.find(r=>r.id===event.reservationId);assert(r);activeGate(s,r,event.at);intentAllowed(r,event.job,event.operation);
  assert(r.acknowledged);
  assert(event.id===dailyHash({reservationId:r.id,ordinal:r.intents.length}));
  r.intents.push({id:event.id,job:event.job,operation:event.operation,at:event.at,response:null,sent:false});
 }else if(event.type==='FAKE_SEND'){
  const r=s.reservations.find(r=>r.id===event.reservationId),i=r?.intents.find(i=>i.id===event.intentId);
  assert(r&&i&&!i.sent&&!i.response&&!r.blocked);activeGate(s,r,event.at);i.sent=true;
 }else if(event.type==='RESPONSE'){
  const r=s.reservations.find(r=>r.id===event.reservationId),i=r?.intents.find(i=>i.id===event.intentId);
  assert(i&&i.sent&&!i.response);i.response=response(r,i,event.body,event.at);
 }else dailyFail();
 s.events.push(structuredClone(event));return s;
}
export function dailyView(s){
 return {kind:'ALLIUM_DAILY_OFFLINE_SIMULATION',executionEnabled:false,providerRequests:0,scheduleWrites:0,
  tailDetection:'REQUIRES_TRUSTED_CHECKPOINT',reconciliation:'NOT_ENABLED_C_ZERO',
  pendingUnits:euText(s.reservations.reduce((n,r)=>n+eu(r.reservedUnits),0n)),
  usages:s.usages.map(u=>({day:u.day,state:u.state})),
  reservations:s.reservations.map(r=>({id:r.id,day:r.day,kind:r.kind,state:dailyReservationState(r),reservedUnits:r.reservedUnits,
   fakeSends:r.intents.filter(i=>i.sent).length,intents:r.intents.length})),
  stateHash:dailyHash(canonical(s.events))};
}
