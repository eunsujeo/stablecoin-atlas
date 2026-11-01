import test from 'node:test';import assert from 'node:assert/strict';
import {epochState,epochDetail,applyFfgBoundary,targetSupport,EPOCH_VALIDATORS,EPOCH_INTRO} from '../experiments/blockchain-knowledge/epochs.mjs';
const cp=e=>({epoch:e,root:'r'+e});
test('32 time slots form an epoch regardless of missing blocks; boundary updates are exact',()=>{
 for(const kind of ['normal','skipped','delayed']){const a=epochState(7.99,kind),b=epochState(8,kind),c=epochState(16,kind);assert.equal(a.epoch,100);assert.equal(a.slot,3231);assert.equal(b.epoch,101);assert.equal(b.slot,3232);assert.equal(b.progress,0);assert.equal(b.seconds,384);assert.equal(c.slot,3264);assert.equal(c.seconds,768);assert.equal(b.slotInEpoch,1);}
 assert.match(EPOCH_INTRO,/32개의 Slot/);assert.equal(epochState(24).epoch,102);assert(epochState(24).progress<1);
});
test('skipped first slot checkpoints refer to existing prior block; no phantom block or height',()=>{
 assert.equal(epochState(8,'skipped').checkpoints[1].root,null);const s=epochState(9,'skipped'),c=s.checkpoints[1];assert.equal(c.root,'block:3231');assert.equal(s.blocks.some(b=>b.slot===3232),false);const next=s.blocks.find(b=>b.slot===3233),parent=s.blocks.find(b=>b.root===next.parent);assert.equal(parent.slot,3231);assert.equal(next.number,parent.number+1);assert.equal(s.slots[0].status,'누락');assert.match(epochDetail(s,'checkpoint:101').body,/슬롯 3231/);
});
test('quorum alone before boundary is not finality; two valid adjacent links finalize only the earlier checkpoint',()=>{
 const a=epochState(7.99);assert.equal(a.round.support.weight,12n);assert.equal(a.ffg.current.epoch,99);const b=epochState(8);assert.equal(b.ffg.current.epoch,100);assert.equal(b.ffg.finalized.epoch,99);const c=epochState(16);assert.equal(c.ffg.current.epoch,101);assert.equal(c.ffg.finalized.epoch,100);assert.equal(c.checkpoints[1].status,'Justified');assert.equal(c.checkpoints[0].status,'Finalized');
});
test('majority of validator headcount can lack 2/3 stake, with unchanged epoch time and stalled finality',()=>{
 const s=epochState(15.99,'delayed');assert.equal(s.round.support.ids.length,5);assert.equal(s.round.support.weight,7n);assert.equal(s.round.support.quorum,false);const end=epochState(24,'delayed');assert.equal(end.ffg.current.epoch,99);assert.equal(end.ffg.finalized.epoch,98);assert.equal(end.slot,epochState(24).slot);assert.equal(s.round.source.epoch,99);
});
test('role assignments change without replacing validators; attestations count only after a later block includes them',()=>{
 const a=epochState(0),b=epochState(8);assert.deepEqual(a.assignments.map(v=>v.id),b.assignments.map(v=>v.id));assert.notDeepEqual(a.assignments.map(v=>v.committee),b.assignments.map(v=>v.committee));const q=epochState(.6).round.votes[0];assert(q.sent);assert(!q.included);assert.equal(epochState(.7).round.votes[0].included,true);
 for(const v of epochState(7.99,'skipped').round.votes){assert(v.inclusionSlot>v.slot);assert.equal(v.target.epoch,100);assert.equal(v.source.epoch,99);}assert.equal(epochState(7.99,'skipped').round.votes[1].inclusionSlot,3208);
});
test('target support deduplicates stake, rejects wrong source/target/signature/timing and excludes slashed numerator',()=>{
 const s=epochState(7.99),r=s.round,opts={source:r.source,target:r.target,totalEpoch:100};assert.equal(targetSupport([...r.votes,...r.votes],EPOCH_VALIDATORS,opts).weight,12n);
 for(const change of [{source:cp(97)},{source:{...r.source,root:'wrong'}},{target:cp(200)},{target:{...r.target,root:'wrong'}},{validSignature:false},{validSignature:"yes"},{inclusionSlot:undefined},{included:false},{inclusionSlot:3202},{inclusionSlot:3299},{slot:999}]){assert.equal(targetSupport([{...r.votes[0],...change}],EPOCH_VALIDATORS,opts).weight,0n);}
 const validators=EPOCH_VALIDATORS.map(v=>v.id==='V01'?{...v,slashed:true}:v);assert.equal(targetSupport(r.votes,validators,opts).weight,7n);assert.equal(targetSupport(r.votes,validators,opts).total,12n);
 // Head agreement is a distinct flag, not an extra target-weight requirement.
 assert.equal(targetSupport([{...r.votes[0],head:'different-head'}],EPOCH_VALIDATORS,opts).weight,5n);
});
test('all four FFG bit patterns use the correct old checkpoint and epoch-distance condition',()=>{
 const cases=[{bits:[true,true,true,false],previous:97,current:90,p:8n,c:0n,expected:97,rule:'1:4/3'},{bits:[true,true,false,false],previous:98,current:90,p:8n,c:0n,expected:98,rule:'1:3/2'},{bits:[true,true,false,false],previous:90,current:98,p:8n,c:8n,expected:98,rule:'0:3/2'},{bits:[true,false,false,false],previous:90,current:99,p:8n,c:8n,expected:99,rule:'0:2/1'}];
 for(const q of cases){const state={previous:cp(q.previous),current:cp(q.current),finalized:cp(89),bits:q.bits};const out=applyFfgBoundary(state,{epoch:100,total:12n,previousWeight:q.p,currentWeight:q.c,previousTarget:cp(99),currentTarget:cp(100)});assert.equal(out.finalized.epoch,q.expected);assert(out.matched.includes(q.rule));assert.deepEqual(state.bits,q.bits);}
 const state={previous:cp(98),current:cp(99),finalized:cp(97),bits:[true,false,false,false]};assert.equal(applyFfgBoundary(state,{epoch:100,total:12n,previousWeight:7n,currentWeight:7n,previousTarget:cp(99),currentTarget:cp(100)}).current.epoch,99);assert.equal(applyFfgBoundary(state,{epoch:100,total:12n,previousWeight:13n,currentWeight:0n,previousTarget:cp(99),currentTarget:cp(100)}).bits[1],true);assert.throws(()=>applyFfgBoundary(state,{epoch:100,total:12n,previousWeight:-1n,currentWeight:0n,previousTarget:cp(99),currentTarget:cp(100)}),/INVALID_FFG/);
});
test('reconstruction and 32-slot detail preserve results on arbitrary rewind in every scenario',()=>{
 for(const kind of ['normal','skipped','delayed'])for(const t of [0,.1,2,6,7.99,8,8.1,9,12,15.99,16,17,24]){const a=epochState(t,kind);epochState(24,kind);epochState(0,kind);assert.deepEqual(epochState(t,kind),a);assert.equal(epochDetail(a,'slots').epochSlots.length,32);assert.equal(epochDetail(a,'slots:102').epochSlots[0].slot,3264);}
 assert.throws(()=>epochState(NaN),/INVALID_EPOCH/);assert.throws(()=>epochState(0,'bad'),/INVALID_EPOCH/);
});
