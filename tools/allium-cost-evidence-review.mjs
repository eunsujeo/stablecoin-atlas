import {canonical,epochMicros} from './market-db/plan.mjs';
import {dailyHash,dailyFail,hashValue,eu} from './allium-daily-plan.mjs';
import {initialDailyState,applyDailyEvent} from './allium-daily-state.mjs';
import {reviewDailyReconciliation} from './allium-reconciliation-review.mjs';

const keys=(v,list)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===list.split(' ').sort().join(',');
const requireKeys=(v,list)=>{if(!keys(v,list))dailyFail();};
const hashes=(...values)=>{if(!values.every(hashValue))dailyFail();};
const ref=v=>v===null||hashValue(v);
const list=v=>{if(!Array.isArray(v)||v.length>256)dailyFail();return v;};
// Synthetic references describe an internal contract, never provider authenticity.
export function reviewDailyCostEvidence(events,context,input){
 try{return review(events,context,input);}catch{dailyFail();}
}
function review(events,context,input){
 const report=reviewDailyReconciliation(events,context),state=initialDailyState(context.organizationHash);
 for(const e of events)applyDailyEvent(state,e);
 // Copy before validation/PG awaits; the caller retains no mutable review input.
 let bundle;try{bundle=structuredClone(input);canonical(bundle);}catch{dailyFail();}
 requireKeys(bundle,'kind organizationHash fixtureHash checkpointHash snapshots');
 if(bundle.kind!=='ALLIUM_SIMULATED_COST_EVIDENCE_V1')dailyFail();
 hashes(bundle.organizationHash,bundle.fixtureHash,bundle.checkpointHash);
 const blockers=new Set(),add=code=>blockers.add(code),rows=[],seen=new Map(),versions=new Map();
 if(bundle.organizationHash!==context.organizationHash)add('ORGANIZATION_CONFLICT');
 if(bundle.fixtureHash!==context.fixtureHash||bundle.checkpointHash!==report.checkpoint.hash)add('CHECKPOINT_CONFLICT');
 for(const s of list(bundle.snapshots)){
  requireKeys(s,'organizationHash rootHash epochHash versionHash previousVersionHash sourceHash sourceVersionHash acquisitionHash rawHash rawLength observedAt reviewedAt unit totalUnits scope scopeEvidenceHash operationScopeHash finality periods keyLinks items change');
  hashes(s.organizationHash,s.rootHash,s.epochHash,s.versionHash);
  if(![s.previousVersionHash,s.sourceHash,s.sourceVersionHash,s.acquisitionHash,s.rawHash,s.scopeEvidenceHash,s.operationScopeHash].every(ref))dailyFail();
  if(s.rawLength!==null&&(!Number.isSafeInteger(s.rawLength)||s.rawLength<=0))dailyFail();
  if(s.organizationHash!==context.organizationHash)add('ORGANIZATION_CONFLICT');
  if([s.sourceHash,s.sourceVersionHash,s.acquisitionHash,s.rawHash,s.rawLength].some(v=>v===null))add('SOURCE_EVIDENCE_MISSING');
  const observed=epochMicros(s.observedAt),reviewed=epochMicros(s.reviewedAt);
  if(reviewed<observed)add('OBSERVATION_TIME_CONFLICT');
  const total=s.totalUnits===null?null:eu(s.totalUnits);
  if(total===null)add('USAGE_QUANTITY_UNKNOWN');
  if(s.unit!=='EXPLORER_UNIT')add('UNIT_CONFLICT');
  if(!s.operationScopeHash)add('OPERATION_COST_SCOPE_UNPROVEN');
  if(s.scope!=='ORGANIZATION_COMPLETE'||s.scopeEvidenceHash===null)add('CONSUMER_HISTORY_SCOPE_UNPROVEN');
  requireKeys(s.finality,'state policyHash coverageHash versionHash');
  if(![s.finality.policyHash,s.finality.coverageHash,s.finality.versionHash].every(ref))dailyFail();
  if(s.finality.state!=='FINAL'||!s.finality.policyHash||!s.finality.coverageHash||s.finality.versionHash!==s.versionHash)add('FINALITY_EVIDENCE_MISSING');
  if(!['ORIGINAL','CORRECTION','CANCELLATION'].includes(s.change))dailyFail();
  if(s.change!=='ORIGINAL'){
   add('CORRECTION_OR_CANCELLATION');if(s.previousVersionHash===null)add('VERSION_LINEAGE_MISSING');
  }
  if(versions.has(s.versionHash))add('VERSION_CONFLICT');
  versions.set(s.versionHash,s);
  const periods=new Map();
  for(const p of list(s.periods)){
   requireKeys(p,'kind identityHash start end timezone dst evidenceHash');
   hashes(p.identityHash);if(!ref(p.evidenceHash))dailyFail();
   if(!['billing','allocation','cap'].includes(p.kind)||periods.has(p.kind))dailyFail();
   if(epochMicros(p.start)>=epochMicros(p.end))add('PERIOD_BOUNDARY_CONFLICT');
   // Regional timezone/DST interpretation is deliberately unsupported and blocked.
   if(p.timezone!=='UTC'||p.dst!=='NONE')add('TIMEZONE_OR_DST_UNSUPPORTED');
   if(!p.evidenceHash)add('PERIOD_EVIDENCE_MISSING');
   periods.set(p.kind,p);
  }
  if(periods.size!==3)add('PERIOD_EVIDENCE_MISSING');
  for(const k of list(s.keyLinks)){
   requireKeys(k,'keyHash organizationHash validFrom validUntil evidenceHash');hashes(k.keyHash,k.organizationHash);
   if(!ref(k.evidenceHash))dailyFail();
   if(k.organizationHash!==s.organizationHash)add('KEY_ORGANIZATION_CONFLICT');
   if(epochMicros(k.validFrom)>=epochMicros(k.validUntil))add('KEY_VALIDITY_CONFLICT');
  }
  const allocation=periods.get('allocation');
  for(const u of state.usages.filter(u=>u.state==='SUCCEEDED')){
   if(allocation&&epochMicros(allocation.start)===epochMicros(u.allocationStart)&&epochMicros(allocation.end)===epochMicros(u.allocationEnd)){
    if(observed<epochMicros(u.at))add('USAGE_OBSERVATION_STALE');
    if(total!==null&&total<eu(u.consumedUnits))add('USAGE_DECREASE');
   }
  }
  let sum=0n;
  for(const item of list(s.items)){
   requireKeys(item,'chargeHash reservationId intentId ordinal job operation sendHash quantity unit costAt periodLinkHash');
   if(![item.chargeHash,item.sendHash,item.periodLinkHash].every(ref))dailyFail();
   hashes(item.reservationId,item.intentId);
   if(!Number.isSafeInteger(item.ordinal)||item.ordinal<0)dailyFail();
   const quantity=item.quantity===null?null:eu(item.quantity),costAt=epochMicros(item.costAt);
   if(quantity===null)add('ITEM_QUANTITY_UNKNOWN');else sum+=quantity;
   if(item.unit!==s.unit)add('UNIT_CONFLICT');
   if(!item.chargeHash)add('ITEM_IDENTITY_UNPROVEN');
   else {
    const identity=dailyHash({organizationHash:s.organizationHash,chargeHash:item.chargeHash});
    if(seen.has(identity)){
     add('DUPLICATE_ITEM_CANDIDATE');
     if(seen.get(identity)!==canonical(item))add('ITEM_LINK_CONFLICT');
    }else seen.set(identity,canonical(item));
   }
   const r=state.reservations.find(r=>r.id===item.reservationId),i=r?.intents[item.ordinal];
   const send=events.find(e=>e.type==='FAKE_SEND'&&e.reservationId===r?.id&&e.intentId===i?.id);
   if(!r||!i||i.id!==item.intentId||!i.sent||i.job!==item.job||i.operation!==item.operation||item.sendHash!==dailyHash({fixtureHash:context.fixtureHash,sendEvent:send}))add('OPERATION_LINK_UNPROVEN');
   if(r){
    if(quantity!==null&&quantity>eu(r.reservedUnits))add('RESERVATION_CAP_EXCEEDED');
    const link=s.keyLinks.find(k=>k.keyHash===r.authorization.keyHash&&k.organizationHash===context.organizationHash&&k.evidenceHash&&i&&send&&epochMicros(k.validFrom)<=epochMicros(send.at)&&epochMicros(send.at)<epochMicros(k.validUntil));
    if(!link)add('KEY_ORGANIZATION_LINK_UNPROVEN');
    for(const kind of ['billing','allocation','cap']){
     const p=periods.get(kind),a=r.authorization;
     if((!p||epochMicros(p.start)!==epochMicros(a[kind+'Start'])||epochMicros(p.end)!==epochMicros(a[kind+'End']))&&!item.periodLinkHash)add('RESERVATION_PERIOD_CONFLICT');
     if(p&&(costAt<epochMicros(p.start)||costAt>=epochMicros(p.end))&&!item.periodLinkHash)add('CROSS_PERIOD_LINK_UNPROVEN');
    }
   }
   if(costAt>observed||(send&&costAt<epochMicros(send.at)))add('OBSERVATION_TIME_CONFLICT');
  }
  const sent=state.reservations.flatMap(r=>r.intents.filter(i=>i.sent).map(i=>({r,i})));
  if(!sent.length||sent.some(({r,i})=>!s.items.some(item=>item.reservationId===r.id&&item.intentId===i.id)))add('USAGE_MEMBERSHIP_UNPROVEN');
  if(total!==null&&sum>total)add('USAGE_QUANTITY_EXCEEDED');
  rows.push({snapshotHash:dailyHash(s),versionHash:s.versionHash,itemCount:s.items.length});
 }
 if(!rows.length)add('EVIDENCE_MISSING');
 for(const s of bundle.snapshots){
  const previous=s.previousVersionHash===null?null:versions.get(s.previousVersionHash);
  if(s.previousVersionHash!==null&&!previous)add('VERSION_LINEAGE_MISSING');
  if(previous){
   if(previous===s||epochMicros(previous.observedAt)>=epochMicros(s.observedAt)||previous.organizationHash!==s.organizationHash)add('VERSION_LINEAGE_CONFLICT');
   if(previous.totalUnits!==null&&s.totalUnits!==null&&eu(s.totalUnits)<eu(previous.totalUnits))add('USAGE_DECREASE');
   if(previous.items.some(i=>!s.items.some(j=>i.chargeHash&&i.chargeHash===j.chargeHash)))add('USAGE_MEMBERSHIP_LOST');
  }
 }
 // Per-reservation item totals are checked per immutable usage version; no allocation is made.
 for(const s of bundle.snapshots)for(const r of state.reservations){
  const items=s.items.filter(i=>i.reservationId===r.id);
  if(items.some(i=>i.quantity===null))continue;
  if(items.reduce((n,i)=>n+eu(i.quantity),0n)>eu(r.reservedUnits))add('RESERVATION_CAP_EXCEEDED');
 }
 return {...report,kind:'ALLIUM_OFFLINE_COST_EVIDENCE_REVIEW',evidenceReview:{
  kind:'SYNTHETIC_CONTRACT_ONLY',inputHash:dailyHash(bundle),
  consistency:blockers.size?'BLOCKED':'CONSISTENT_SYNTHETIC_CONTRACT',blockers:[...blockers].sort(),snapshots:rows,
  providerAuthenticity:'UNCONFIRMED',allocationEnabled:false,
  allocationConcurrency:'NOT_TESTED',allocationRecovery:'NOT_TESTED',freshness:'NOT_ATTESTED',
 }};
}
