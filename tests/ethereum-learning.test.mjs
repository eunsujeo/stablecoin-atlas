import test from 'node:test';import assert from 'node:assert/strict';
import {ETHEREUM,STAKES,PHASES,DELIVERIES,support,advanceCheckpoint} from '../experiments/blockchain-knowledge/protocol.mjs';
import {stateAt,eventsFor,stepTime,protocolSeconds} from '../experiments/blockchain-knowledge/engine.mjs';
import {playback} from '../experiments/blockchain-knowledge/playback.mjs';
import {narrative,detail} from '../experiments/blockchain-knowledge/narrative.mjs';
test('stake thresholds count unique stake against the complete denominator, not online headcount',()=>{
 assert.equal(support([0,1,2,3,4,5,6]).quorum,false);assert.equal(support([0,1,2,3,4,5,6,7]).quorum,true);
 const duplicated=support([0,0,0,1,1]);assert.equal(duplicated.weight,2n);assert.equal(duplicated.total,12n);assert.equal(duplicated.quorum,false);
 assert.equal(support([0],[{id:0,weight:2n**60n},{id:1,weight:2n**59n}]).quorum,true);
 assert.throws(()=>support([99]),/UNKNOWN_STAKE/);assert.throws(()=>support([],[]),/INVALID_STAKE_SET/);assert.throws(()=>support([],[{id:0,weight:1}]),/INVALID_STAKE/);
});
test('proposal, validation, justification and finality are distinct chronological states',()=>{
 assert.equal(stateAt(5.99).proposed,false);assert.equal(stateAt(6).proposed,true);assert.equal(stateAt(6).blockStatus,'proposed');
 assert.equal(stateAt(11).blockStatus,'head');assert.equal(stateAt(15.9).support.quorum,true);assert.equal(stateAt(15.9).checkpoints[1].justified,false);
 const first=stateAt(16);assert.equal(first.checkpoints[0].finalized,true);assert.equal(first.checkpoints[1].justified,true);assert.equal(first.checkpoints[1].finalized,false);
 assert.equal(stateAt(21.99).checkpoints[1].finalized,false);const end=stateAt(22);assert.equal(end.checkpoints[1].finalized,true);assert.equal(end.checkpoints[2].justified,true);assert.equal(end.checkpoints[2].finalized,false);
 assert.equal(end.votes[100].length,12);assert.equal(end.votes[101].length,12);
});
test('offline scenario continues proposal without inventing quorum or slashing',()=>{
 const s=stateAt(24,'offline');assert.equal(s.proposed,true);assert.equal(s.nextBlock,true);assert.equal(s.blockStatus,'accepted');assert.equal(s.support.weight,7n);assert.equal(s.support.total,12n);
 assert.equal(s.checkpoints[1].justified,false);assert.equal(s.checkpoints[1].finalized,false);assert.equal(s.checkpoints[2].justified,false);
 for(const p of s.peers.filter(p=>p.offline))assert.deepEqual([p.received,p.verified,p.attested],[false,false,false]);
 assert.match(narrative(s).body,/7\/12/);assert.match(narrative(s).note,/slashing/);
});
test('slot attesters are a subset; epoch stake totals are a different scale',()=>{
 const s=stateAt(11.99);assert.equal(s.peers.filter(p=>p.attested).length,ETHEREUM.committee.length);assert(s.peers.every(p=>!p.attested||p.verified));assert.equal(s.votes[100].length,0);assert.equal(STAKES.length,12);assert.equal(s.peers.length,8);
});
test('arbitrary seek and backward navigation reconstruct the exact state without mutable history',()=>{
 for(const scenario of ['normal','offline'])for(const t of [0,1.8,3,6,8.1,11,12,15.9,16,18,22,24]){const expected=stateAt(t,scenario);stateAt(24,scenario);stateAt(0,scenario);assert.deepEqual(stateAt(t,scenario),expected);}
 const a=stateAt(24);a.votes[100].pop();a.checkpoints[1].finalized=false;assert.equal(stateAt(24).votes[100].length,12);assert.equal(stateAt(24).checkpoints[1].finalized,true);
 assert.equal(stateAt(-1).t,0);assert.equal(stateAt(99).t,24);assert.throws(()=>stateAt(NaN),/INVALID_TIME/);assert.throws(()=>stateAt(0,'xrpl'),/UNKNOWN_SCENARIO/);
});
test('nonlinear teaching time stays monotone and epoch transitions match the model',()=>{
 let previous=-1;for(let t=0;t<=24;t+=.05){const current=protocolSeconds(t);assert(current>=previous);previous=current;}
 assert.equal(protocolSeconds(12),4);assert.equal(protocolSeconds(16),384);assert.equal(protocolSeconds(22),768);assert.equal(stateAt(16).epoch,101);assert.equal(stateAt(22).slot,3264);
 const events=eventsFor('normal');assert(events.every((e,i)=>i===0||e.at>=events[i-1].at));assert.equal(stepTime(16,-1),12);assert.equal(stepTime(16,1),18);assert.equal(stepTime(24,1),24);
});
test('finalization cannot skip a checkpoint or reuse an unjustified source',()=>{
 const all=STAKES.map(s=>s.id),prev={epoch:99,justified:false,finalized:false},current={epoch:100,justified:false,finalized:false};assert.equal(advanceCheckpoint(prev,current,all).current.justified,false);assert.throws(()=>advanceCheckpoint(prev,{...current,epoch:101},all),/NON_CONSECUTIVE/);
});
test('playback pause, speed, seek, reduced-motion and completion share one clock',()=>{
 let s={t:0,playing:false,speed:1,reduced:false};s=playback(s,{type:'play'});s=playback(s,{type:'tick',delta:3});assert.equal(s.t,3);s=playback(s,{type:'speed',speed:2});s=playback(s,{type:'tick',delta:2});assert.equal(s.t,7);
 s=playback(s,{type:'pause'});assert.equal(playback(s,{type:'tick',delta:5}).t,7);s=playback(s,{type:'seek',time:4});assert.equal(s.t,4);assert.equal(s.playing,false);
 s=playback(s,{type:'reduce',value:true});assert.equal(playback(s,{type:'play'}).playing,false);s=playback(s,{type:'step',direction:1});assert.equal(s.t,6);s=playback(s,{type:'reduce',value:false});s=playback(s,{type:'play'});s=playback(s,{type:'tick',delta:99});assert.equal(s.t,24);assert.equal(s.playing,false);assert.equal(playback(s,{type:'play'}).t,0);
 assert.throws(()=>playback(s,{type:'speed',speed:3}),/INVALID_SPEED/);assert.throws(()=>playback(s,{type:'tick',delta:-1}),/INVALID_DELTA/);
});
test('every phase remains understandable with motion disabled and inspector follows rewind',()=>{
 for(const p of PHASES){const n=narrative(stateAt(p.at));assert(n.title&&n.body&&n.note);}
 assert.match(detail(stateAt(24),'block').body,/FINALIZED/);assert.doesNotMatch(detail(stateAt(6),'block').body,/현재 상태는 FINALIZED/);assert.match(detail(stateAt(6),'checkpoint:101').body,/제안되기 전/);
});

test('gossip receipt coincides with visual delivery completion and relay never precedes receipt',()=>{
 for(const route of DELIVERIES){const arrival=route.at+(route.to===route.from?0:.65);assert.equal(stateAt(arrival-.0001).peers[route.to].received,false);assert.equal(stateAt(arrival).peers[route.to].received,true);if(route.from!==route.to)assert.equal(stateAt(route.at).peers[route.from].received,true);}
});

import {presentation,STATUS} from '../experiments/blockchain-knowledge/presentation.mjs';
import {LESSON_STEPS} from '../experiments/blockchain-knowledge/protocol.mjs';
test('six learning chapters preserve internal boundary events and navigation',()=>{
 assert.equal(LESSON_STEPS.length,6);assert.deepEqual(LESSON_STEPS.map(s=>s.at),[0,3,6,9,12,18]);
 for(const [i,step]of LESSON_STEPS.entries()){assert.equal(presentation(stateAt(step.at)).step.key,step.key);if(i<5)assert.equal(stepTime(step.at,1),LESSON_STEPS[i+1].at);if(i>0)assert.equal(stepTime(step.at,-1),LESSON_STEPS[i-1].at);}
 assert.equal(presentation(stateAt(16)).step.key,'justify');assert.equal(presentation(stateAt(22)).step.key,'finalize');
});
test('KPI, visible roles and explanation follow the same state through every event and rewind',()=>{
 for(const scenario of ['normal','offline'])for(const event of eventsFor(scenario))for(const delta of [-.001,0,.001]){
  const s=stateAt(event.at+delta,scenario),v=presentation(s);
  assert.equal(v.received,s.peers.filter(p=>p.received).length);assert.equal(v.verified,s.peers.filter(p=>p.verified).length);assert.equal(v.attested,s.peers.filter(p=>p.attested).length);
  assert.equal(v.weight,String(s.support.weight));assert.equal(v.total,'12');assert.equal(v.quorum,s.support.quorum);assert.equal(v.block,STATUS[s.blockStatus]);
  assert(v.activePeers.every(i=>!s.peers[i].offline));assert(v.sentence&&v.reason);
  stateAt(24,scenario);assert.deepEqual(presentation(stateAt(event.at+delta,scenario)),v);
 }
});
test('finality explanations distinguish quorum waiting, next link, completion and lack of participation',()=>{
 assert.match(presentation(stateAt(15.9)).reason,/epoch 경계/);assert.match(presentation(stateAt(16)).reason,/다음 C101/);
 assert.match(presentation(stateAt(21.9)).reason,/연속 체크포인트/);assert.match(presentation(stateAt(24)).reason,/확정했습니다/);
 assert.match(presentation(stateAt(24,'offline')).reason,/7\/12/);assert.match(presentation(stateAt(24,'offline')).reason,/시간이 지나도/);
 assert.equal(presentation(stateAt(11)).weight,'0');assert.equal(presentation(stateAt(11)).attested,2);assert.equal(presentation(stateAt(11.1)).attested,3);
});
test('offline next-epoch votes keep the latest justified source instead of inventing C100 justification',()=>{
 const normal=stateAt(24),offline=stateAt(24,'offline');assert.equal(normal.sources[101],100);assert.equal(offline.sources[101],99);
 assert.equal(presentation(normal).link,'C100 → C101');assert.equal(presentation(offline).link,'C99 → C101');assert.equal(offline.checkpoints[2].justified,false);
 assert.equal(stateAt(17).sources[101],99);assert.equal(stateAt(18).sources[101],100);
});
