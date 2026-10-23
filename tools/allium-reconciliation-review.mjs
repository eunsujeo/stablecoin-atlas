import {canonical} from './market-db/plan.mjs';
import {dailyHash,dailyFail,hashValue} from './allium-daily-plan.mjs';
import {initialDailyState,applyDailyEvent,dailyView,dailyEntryHash} from './allium-daily-state.mjs';

// A local semantic summary. Only the PG review factory can verify publication/storage.
export function reviewDailyReconciliation(events,{organizationHash,fixtureHash}){
 if(!Array.isArray(events)||!hashValue(fixtureHash))dailyFail();
 const s=initialDailyState(organizationHash);let hash='0'.repeat(64);
 for(const [index,event]of events.entries()){
  applyDailyEvent(s,event);
  if(event.type==='RESPONSE_IMPORTED'&&event.evidence.fixtureHash!==fixtureHash)dailyFail();
  hash=dailyEntryHash(organizationHash,index+1,hash,canonical(event));
 }
 const v=dailyView(s);
 return {
  kind:'ALLIUM_OFFLINE_RECONCILIATION_REVIEW',executionEnabled:false,debitEnabled:false,
  providerRequests:0,scheduleWrites:0,publication:'NOT_VERIFIED',
  fixtureHash,organizationHash,checkpoint:{count:events.length,hash},stateHash:v.stateHash,
  reconciliation:v.reconciliation,pendingUnits:v.pendingUnits,
  costAttribution:'UNKNOWN',usageFinality:'UNKNOWN',
  blockers:['USAGE_MEMBERSHIP_UNPROVEN','USAGE_FINALITY_UNPROVEN','COST_ALLOCATION_UNPROVEN','DEBIT_NOT_ENABLED'],
  reservations:s.reservations.map((r,index)=>({
   id:r.id,day:r.day,kind:r.kind,state:v.reservations[index].state,reservedUnits:r.reservedUnits,
   reconciledUnits:'0',usageIncludedUnits:null,
   jobs:r.jobs.map(j=>({kind:j.kind,complete:j.complete})),
   intents:r.intents.map(i=>{
    const imported=i.imported;
    return {id:i.id,job:i.job,operation:i.operation,sent:i.sent,
     evidenceState:imported?'IMPORTED':i.response?'INLINE_RESPONSE_ONLY':i.sent?'NOT_IMPORTED':'NOT_SENT',
     contentState:imported?(i.operation==='result'?(imported.reviewed.state==='VALIDATED'?'RESULT_VALIDATED':'UNKNOWN'):
      imported.reviewed.state==='UNKNOWN'?'UNKNOWN':'CONTROL_RESPONSE_ONLY'):'NOT_TESTED',
     reviewState:imported?.reviewed.state??imported?.reviewed.status??null,
     evidenceHash:imported?.evidenceHash??null,rawHash:imported?.rawHash??null,
     observedAt:imported?.observedAt??null,reviewedAt:imported?.reviewedAt??null,
     reportedResultUnits:i.operation==='result'&&imported?.reviewed.state==='VALIDATED'?imported.reviewed.observedUnits:null,
     costAttribution:'UNKNOWN',usageFinality:'UNKNOWN',reconciledUnits:'0'};
   })
  }))
 };
}
