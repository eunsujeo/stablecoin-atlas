import test from 'node:test';import assert from 'node:assert/strict';
import {dailyHash} from '../tools/allium-daily-plan.mjs';
import {reviewDailyCostEvidence} from '../tools/allium-cost-evidence-review.mjs';
import {costReviewFixture} from './allium-cost-evidence-fixture.mjs';
const review=f=>reviewDailyCostEvidence(f.events,f.context,f.bundle);
const codes=f=>review(f).evidenceReview.blockers;
test('synthetic complete contract is consistent only; immutable, deterministic, redacted and c zero',()=>{
 const f=costReviewFixture(),before=structuredClone(f),a=review(f);
 assert.equal(a.evidenceReview.consistency,'CONSISTENT_SYNTHETIC_CONTRACT');assert.deepEqual(a.evidenceReview.blockers,[]);
 assert.equal(a.costAttribution,'UNKNOWN');assert.equal(a.usageFinality,'UNKNOWN');assert.equal(a.debitEnabled,false);
 assert.equal(a.reservations[0].state,'UNKNOWN');assert.equal(a.reservations[0].reconciledUnits,'0');assert.equal(a.reservations[0].usageIncludedUnits,null);
 assert.equal(a.evidenceReview.providerAuthenticity,'UNCONFIRMED');assert.equal(a.evidenceReview.allocationConcurrency,'NOT_TESTED');
 assert.deepEqual(f,before);assert.deepEqual(review(f),a);a.evidenceReview.blockers.push('EDIT');assert.deepEqual(review(f).evidenceReview.blockers,[]);
 assert.doesNotMatch(JSON.stringify(a.evidenceReview),/rawLength|rawHash|acquisitionHash|costAt|keyLinks|periodLinkHash/);
});
test('missing and conflicting contract evidence gives precise blockers without estimating costs',()=>{
 const cases=[
  [s=>s.sourceHash=null,'SOURCE_EVIDENCE_MISSING'],[s=>s.finality.coverageHash=null,'FINALITY_EVIDENCE_MISSING'],
  [s=>s.finality.versionHash=dailyHash('other'),'FINALITY_EVIDENCE_MISSING'],[s=>s.scope='UNKNOWN','CONSUMER_HISTORY_SCOPE_UNPROVEN'],
  [s=>s.operationScopeHash=null,'OPERATION_COST_SCOPE_UNPROVEN'],[s=>s.keyLinks=[],'KEY_ORGANIZATION_LINK_UNPROVEN'],
  [s=>s.keyLinks[0].keyHash=dailyHash('rotated'),'KEY_ORGANIZATION_LINK_UNPROVEN'],
  [s=>s.keyLinks[0].validUntil=s.items[0].costAt,'KEY_ORGANIZATION_LINK_UNPROVEN'],
  [s=>s.periods.pop(),'PERIOD_EVIDENCE_MISSING'],[s=>s.periods[0].start=s.periods[0].end,'PERIOD_BOUNDARY_CONFLICT'],
  [s=>s.periods[0].timezone='America/New_York','TIMEZONE_OR_DST_UNSUPPORTED'],[s=>s.periods[0].dst='UNSPECIFIED','TIMEZONE_OR_DST_UNSUPPORTED'],
  [s=>s.items[0].costAt=s.periods[0].end,'CROSS_PERIOD_LINK_UNPROVEN'],
  [s=>s.items[0].unit='EU','UNIT_CONFLICT'],[s=>s.totalUnits=null,'USAGE_QUANTITY_UNKNOWN'],
  [s=>s.items[0].quantity=null,'ITEM_QUANTITY_UNKNOWN'],[s=>s.items[0].quantity='0.6','RESERVATION_CAP_EXCEEDED'],
  [s=>s.totalUnits='0.09','USAGE_QUANTITY_EXCEEDED'],[s=>s.totalUnits='0.9','USAGE_DECREASE'],
  [s=>s.keyLinks[0].organizationHash=dailyHash('wrong'),'KEY_ORGANIZATION_CONFLICT'],[s=>s.items[0].sendHash=null,'OPERATION_LINK_UNPROVEN'],
  [s=>s.items[0].ordinal=1,'OPERATION_LINK_UNPROVEN'],[s=>s.items[0].chargeHash=null,'ITEM_IDENTITY_UNPROVEN'],
  [s=>s.items=[],'USAGE_MEMBERSHIP_UNPROVEN'],[s=>s.organizationHash=dailyHash('other org'),'ORGANIZATION_CONFLICT'],
  [s=>s.change='CORRECTION','CORRECTION_OR_CANCELLATION'],[s=>s.change='CANCELLATION','CORRECTION_OR_CANCELLATION'],
  [s=>s.previousVersionHash=dailyHash('missing'),'VERSION_LINEAGE_MISSING'],
 ];
 for(const [mutate,code]of cases){const f=costReviewFixture();mutate(f.bundle.snapshots[0]);assert.ok(codes(f).includes(code),code);assert.equal(review(f).reservations[0].reconciledUnits,'0');}
});
test('runtime rejects malformed schema, Number, negative, precision overflow, boolean finality and hidden text',()=>{
 for(const mutate of [s=>s.totalUnits=0.1,s=>s.items[0].quantity=-1,s=>s.items[0].quantity='-1',s=>s.items[0].quantity='0.0000000000000000001',
  s=>s.finality=true,s=>s.rawLength='10',s=>s.sourceHash='not a hash',s=>s.items[0].raw='SECRET',s=>s.observedAt='2026-02-30T00:00:00Z',s=>delete s.unit]){
  const f=costReviewFixture();mutate(f.bundle.snapshots[0]);assert.throws(()=>review(f),/^Error: ALLIUM_DAILY_OFFLINE_BLOCKED$/);
 }
 for(const value of [undefined,null,{},[],{kind:'LIVE_COST_EVIDENCE'}]){const f=costReviewFixture();f.bundle=value;assert.throws(()=>review(f),/ALLIUM_DAILY_OFFLINE_BLOCKED/);}
});
test('same item across bytes, roots, epochs and consumers remains a duplicate candidate; changed link conflicts',()=>{
 const f=costReviewFixture(),s=structuredClone(f.bundle.snapshots[0]);s.versionHash=dailyHash('v2');s.finality.versionHash=s.versionHash;
 s.rawHash=dailyHash('new bytes');s.rootHash=dailyHash('other root');s.epochHash=dailyHash('other epoch');f.bundle.snapshots.push(s);
 assert.ok(codes(f).includes('DUPLICATE_ITEM_CANDIDATE'));s.items[0].quantity='0.09';assert.ok(codes(f).includes('ITEM_LINK_CONFLICT'));
});
test('new usage lineage detects lost membership, quantity decrease and invalid observation order',()=>{
 const f=costReviewFixture(),s=structuredClone(f.bundle.snapshots[0]);s.previousVersionHash=s.versionHash;s.versionHash=dailyHash('new');s.finality.versionHash=s.versionHash;
 s.observedAt=new Date(Date.parse(s.observedAt)+1).toISOString();s.items=[];s.totalUnits='0.09';f.bundle.snapshots.push(s);
 assert.ok(codes(f).includes('USAGE_MEMBERSHIP_LOST'));assert.ok(codes(f).includes('USAGE_DECREASE'));
 s.observedAt=f.bundle.snapshots[0].observedAt;assert.ok(codes(f).includes('VERSION_LINEAGE_CONFLICT'));
 s.previousVersionHash=s.versionHash;assert.ok(codes(f).includes('VERSION_LINEAGE_CONFLICT'));
});
test('checkpoint and organization substitution block even for otherwise complete virtual evidence',()=>{
 for(const key of ['organizationHash','fixtureHash','checkpointHash']){const f=costReviewFixture();f.bundle[key]=dailyHash('other');assert.ok(codes(f).includes(key==='organizationHash'?'ORGANIZATION_CONFLICT':'CHECKPOINT_CONFLICT'));}
});

test('explicit synthetic cross-period link, key rotation link and cap totals are checked without changing budget',()=>{
 const f=costReviewFixture(),s=f.bundle.snapshots[0];s.periods[0].start='2026-10-01T01:00:00Z';
 assert.ok(codes(f).includes('RESERVATION_PERIOD_CONFLICT'));s.items[0].periodLinkHash=dailyHash('explicit period mapping');
 assert.deepEqual(codes(f),[]);
 s.keyLinks.unshift({...s.keyLinks[0],keyHash:dailyHash('old key')});assert.deepEqual(codes(f),[]);
 s.items.push({...s.items[0],chargeHash:dailyHash('second charge'),quantity:'0.45'});assert.ok(codes(f).includes('RESERVATION_CAP_EXCEEDED'));
 const before=structuredClone(f);review(f);assert.deepEqual(f,before);
});
