import {initialDailyState,applyDailyEvent} from '../tools/allium-daily-state.mjs';
import {dailyHash} from '../tools/allium-daily-plan.mjs';
import {reviewDailyReconciliation} from '../tools/allium-reconciliation-review.mjs';
import {simulation,simulationOrg as org} from './allium-daily-fixture.mjs';
export function costReviewFixture(){
 const at='2026-10-23T10:00:00.000000Z',f=simulation(at),s=initialDailyState(org);
 const add=e=>applyDailyEvent(s,{...e,organizationHash:org,at});
 add({type:'USAGE_INTENT',id:dailyHash('usage')});add({type:'USAGE_RESPONSE',intentId:dailyHash('usage'),body:f.usage});
 const id=dailyHash({organizationHash:org,day:f.plan.asOfDay,kind:'daily'}),ackHash=dailyHash('ACK');
 add({type:'RESERVE',id,kind:'daily',plan:f.plan,authorization:f.authorization,ackHash});
 add({type:'CONFIRM_RESERVATION',reservationId:id,ackHash});
 const intentId=dailyHash({reservationId:id,ordinal:0});
 add({type:'INTENT',id:intentId,reservationId:id,job:'supply',operation:'create'});
 add({type:'FAKE_SEND',reservationId:id,intentId});
 const context={organizationHash:org,fixtureHash:dailyHash('cost fixture')};
 return {events:s.events,context,bundle:costEvidenceFor(s.events,context)};
}
export function costEvidenceFor(events,context){
 const s=initialDailyState(context.organizationHash);for(const e of events)applyDailyEvent(s,e);
 const report=reviewDailyReconciliation(events,context),a=s.reservations[0].authorization;
 return {kind:'ALLIUM_SIMULATED_COST_EVIDENCE_V1',...context,checkpointHash:report.checkpoint.hash,snapshots:[{
  organizationHash:context.organizationHash,rootHash:dailyHash('root'),epochHash:dailyHash('epoch'),versionHash:dailyHash('version'),previousVersionHash:null,
  sourceHash:dailyHash('source'),sourceVersionHash:dailyHash('source version'),acquisitionHash:dailyHash('acquisition'),rawHash:dailyHash('raw'),rawLength:10,
  observedAt:new Date(Date.parse(events.at(-1).at)+1000).toISOString(),reviewedAt:new Date(Date.parse(events.at(-1).at)+2000).toISOString(),unit:'EXPLORER_UNIT',totalUnits:'1.1',scope:'ORGANIZATION_COMPLETE',scopeEvidenceHash:dailyHash('scope'),operationScopeHash:dailyHash('operation scope'),
  finality:{state:'FINAL',policyHash:dailyHash('policy'),coverageHash:dailyHash('coverage'),versionHash:dailyHash('version')},change:'ORIGINAL',
  periods:['billing','allocation','cap'].map(kind=>({kind,identityHash:dailyHash(kind),start:a[kind+'Start'],end:a[kind+'End'],timezone:'UTC',dst:'NONE',evidenceHash:dailyHash(kind+' proof')})),
  keyLinks:[{keyHash:a.keyHash,organizationHash:context.organizationHash,validFrom:a.reviewedAt,validUntil:a.expiresAt,evidenceHash:dailyHash('key link')}],
  items:s.reservations.flatMap(r=>r.intents.filter(i=>i.sent).map(i=>({
   chargeHash:dailyHash('charge '+i.id),reservationId:r.id,intentId:i.id,ordinal:r.intents.indexOf(i),job:i.job,operation:i.operation,
   sendHash:dailyHash({fixtureHash:context.fixtureHash,sendEvent:events.find(e=>e.type==='FAKE_SEND'&&e.reservationId===r.id&&e.intentId===i.id)}),
   quantity:'0.1',unit:'EXPLORER_UNIT',costAt:events.find(e=>e.type==='FAKE_SEND'&&e.intentId===i.id).at,periodLinkHash:null,
  }))),
 }]};
}
