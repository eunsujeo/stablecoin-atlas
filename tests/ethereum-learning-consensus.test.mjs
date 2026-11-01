import test from 'node:test';import assert from 'node:assert/strict';
import {consensusState as state,consensusView,consensusDetail,consensusSeconds} from '../experiments/blockchain-knowledge/consensus.mjs';
import {chooseHead,latestMessages,ancestor} from '../experiments/blockchain-knowledge/fork-choice.mjs';
import {presentationTime,modelTime,playbackDuration} from '../experiments/blockchain-knowledge/pacing.mjs';
test('attestations carry consistent head/source/target and separate gossip from inclusion',()=>{
 const s=state(8),v=s.round.votes.find(v=>v.validator==='V01');assert(v.sent&&v.received&&!v.included);assert.equal(v.head,'B');assert.deepEqual(v.source,{epoch:99,root:'C99'});assert.deepEqual(v.target,{epoch:100,root:'P'});assert.equal(s.round.support.weight,0n);assert.equal(state(11).round.support.weight,12n);
 for(let t=0;t<=24;t+=.1){const s=state(t);for(const r of s.rounds)for(const v of r.votes){if(v.sent)assert(v.slot<=s.slot);if(v.received){assert(s.slot>v.slot);assert(ancestor(s.blocks,v.head,v.target.root));}if(v.included){assert(v.inclusionSlot>v.slot);assert(s.blocks.some(b=>b.slot===v.inclusionSlot));}}}
});
test('one validator outweighs three and shorter branch becomes head without a two-thirds threshold',()=>{
 const a=state(7.99),b=state(8);assert.equal(a.head,'A2');assert.equal(a.weights.A,4n);assert.equal(b.head,'B');assert.equal(b.weights.B,5n);assert.equal(b.latest.filter(v=>v.root==='B').length,1);assert.equal(b.latest.filter(v=>v.root==='A2').length,3);assert(5n*3n<12n*2n);assert.equal(b.ffg.finalized.epoch,98);
});
test('FFG boundary conditions distinguish justified and finalized, not elapsed epoch count',()=>{
 assert.equal(state(11.99).ffg.current.epoch,99);const j=state(12);assert.equal(j.ffg.current.epoch,100);assert.equal(j.ffg.finalized.epoch,99);assert.equal(j.checkpoints.find(c=>c.epoch===100).status,'Justified');const f=state(20);assert.equal(f.ffg.current.epoch,101);assert.equal(f.ffg.finalized.epoch,100);assert.equal(f.checkpoints.find(c=>c.epoch===101).status,'Justified');assert(ancestor(f.blocks,f.head,f.ffg.finalized.root));
});
test('offline and delayed votes are distinct while blocks grow without finality',()=>{
 for(const kind of ['offline','delayed']){const a=state(12,kind),b=state(24,kind),r=state(19,kind).round;assert(b.blocks.length>a.blocks.length);assert.equal(b.ffg.current.epoch,99);assert.equal(b.ffg.finalized.epoch,98);assert.equal(r.support.weight,7n);assert.equal(r.support.ids.length,5);const v=state(9,kind).round.votes.find(v=>v.validator==='V01');assert.equal(v.sent,kind==='delayed');assert.equal(v.offline,kind==='offline');assert(!v.received&&!v.included);}
});
test('new epoch messages replace prior weight and repeated or older messages do not add support',()=>{
 const s=state(19);assert.equal(s.latest.length,6);assert(s.latest.every(v=>v.epoch===101));assert.equal(s.weights.P,12n);const a=s.messages.find(v=>v.validator==='V03'&&v.epoch===100),b=s.messages.find(v=>v.validator==='V03'&&v.epoch===101);assert.deepEqual(latestMessages([a,b,a,b]),[b]);const q=chooseHead({blocks:s.blocks,messages:[...s.messages,...s.messages],validators:s.validators,justified:s.ffg.current.root,finalized:s.ffg.finalized.root});assert.deepEqual(q.weights,s.weights);
});
test('fork choice ignores ineligible stake and respects its justified/finalized anchor',()=>{
 const s=state(8),args={blocks:s.blocks,messages:s.messages,validators:s.validators,justified:'C99',finalized:'C98'};assert.equal(chooseHead({...args,validators:s.validators.map(v=>({...v,slashed:v.id==='V01'}))}).head,'A2');assert.throws(()=>chooseHead({...args,justified:'A',finalized:'B'}),/INVALID_ANCHOR/);assert.throws(()=>chooseHead({...args,messages:[{validator:'bad',root:'A',epoch:100}]}),/INVALID_MESSAGE/);
});
test('all scenarios replay deterministically with synchronized views, roles, checkpoints and inverse timing',()=>{
 assert.equal(playbackDuration('consensus'),42);for(const kind of ['normal','offline','delayed'])for(const t of [0,3,7.99,8,11.99,12,16,19,20,24]){const s=state(t,kind),v=consensusView(s);state(24,kind);state(0,kind);assert.deepEqual(state(t,kind),s);assert.equal(v.kpis[0][1],s.head);assert.equal(v.kpis[2][1],`${s.focusRound.support.weight} / 12`);assert.equal(v.kpis[3][1],`J ${s.ffg.current.epoch} / F ${s.ffg.finalized.epoch}`);assert(Math.abs(modelTime(presentationTime(t,'consensus'),'consensus')-t)<1e-8);assert.equal(s.slot,3200+Math.floor(consensusSeconds(t)/12));}
});
test('detail explains the selected validator and checkpoint and rejects unsupported inputs',()=>{
 assert.match(consensusDetail(state(9,'delayed'),'V01').body,/아직 받지/);assert.match(consensusDetail(state(9,'offline'),'V01').body,/서명하지/);assert.match(consensusDetail(state(20),'C100').title,/Finalized/);assert.match(consensusDetail(state(20,'delayed'),'latest:V01').body,/아직 받지/);const end=state(24),latest=end.latest.find(v=>v.validator==='V02');assert(consensusDetail(end,'latest:V02').body.includes('Head '+latest.root));assert.match(consensusDetail(state(0),'roles').body,/Source/);assert.throws(()=>state(NaN));assert.throws(()=>state(0,'unknown'));
});
