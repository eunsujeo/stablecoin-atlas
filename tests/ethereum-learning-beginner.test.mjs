import test from 'node:test';import assert from 'node:assert/strict';
import {slotState,forkState,forkBlocks,chooseHead,latestMessages,VALIDATORS,lessonStep,lessonView} from '../experiments/blockchain-knowledge/lessons.mjs';
import {termDetail} from '../experiments/blockchain-knowledge/glossary.mjs';
test('slots advance independently of creation; missing slot has no block and next parent skips it',()=>{
 assert.equal(slotState(0).slot,3200);assert.equal(slotState(1.99).created,0);assert.equal(slotState(2).head,'B701');assert.equal(slotState(4).slot,3201);
 assert.equal(slotState(9).slots[2].status,'unresponsive');assert.equal(slotState(11.99).skipped,0);assert.equal(slotState(12).skipped,1);
 const final=slotState(24);assert.equal(final.slot,3206);assert.equal(final.created,5);assert.equal(final.skipped,1);assert.equal(final.head,'B705');assert.equal(final.blocks.find(b=>b.id==='B703').parent,'B702');assert.equal(final.blocks.find(b=>b.id==='B703').slot,3203);assert(!final.blocks.some(b=>b.slot===3202));
 for(let i=1;i<final.blocks.length;i++){const b=final.blocks[i],p=final.blocks[i-1];assert.equal(b.parent,p.id);assert.equal(b.number,p.number+1);assert(b.slot>p.slot);}assert.equal(final.blocks[1].checkpoint,'C100');assert.equal(final.seconds,72);
});
test('delayed blocks and messages change the observer view, not a global simultaneous view',()=>{
 const early=forkState(7);assert(early.blocks.some(b=>b.id==='B'));assert(!early.known.includes('B'));assert.equal(early.head,'A');
 const received=forkState(12);assert(received.known.includes('B'));assert.equal(received.head,'A2');assert.equal(received.weights.B,0n);assert.equal(forkState(16).head,'A2');
 const changed=forkState(18);assert.equal(changed.head,'B');assert.equal(changed.weights.A,4n);assert.equal(changed.weights.B,6n);assert.equal(changed.latest.filter(m=>m.root==='A').length,3);assert.equal(changed.latest.filter(m=>m.root==='B').length,2);
});
test('reorg removes actual ancestors, removes the example transaction, preserves finality and does not assert a new finalization',()=>{
 const before=forkState(17.99),after=forkState(18);assert.equal(before.tx,'정식 체인에 포함');assert.equal(after.tx,'정식 체인에서 제외');assert.deepEqual(after.removed,['A','A2']);assert.deepEqual(after.added,['B']);assert(after.path.includes('F'));assert(after.path.includes('H3936'));assert(!after.path.includes('A'));assert.equal(after.finalized,before.finalized);assert.equal(after.justified,before.justified);
 const all=forkBlocks(),p=all.find(b=>b.id==='P');assert.equal(p.parent,'H3999');assert.equal(all.filter(b=>b.createdAt===0).length,97);assert.equal(all.find(b=>b.id==='A').parent,p.id);assert.equal(all.find(b=>b.id==='B').parent,p.id);assert.notEqual(all.find(b=>b.id==='A').slot,all.find(b=>b.id==='B').slot);
});
test('weighted subtree fork choice beats headcount and chain length; descendants support their entire branch',()=>{
 const blocks=forkBlocks(),messages=[{validator:'V03',root:'A2',epoch:125},{validator:'V05',root:'A',epoch:125},{validator:'V06',root:'A',epoch:125},{validator:'V01',root:'B',epoch:125},{validator:'V02',root:'B',epoch:125}];
 const c=chooseHead({blocks,messages,justified:'H3936',finalized:'F'});assert.equal(c.head,'B');assert.equal(c.weights.A,4n);assert.equal(c.weights.A2,2n);assert.equal(c.weights.B,6n);assert.equal(c.weights.P,10n);
 const noB=chooseHead({blocks,messages:messages.slice(0,3),justified:'H3936',finalized:'F'});assert.equal(noB.head,'A2');
});
test('latest messages count once per validator and replace only for a newer target epoch',()=>{
 const messages=[{validator:'V01',root:'A',epoch:124},{validator:'V01',root:'B',epoch:125},{validator:'V01',root:'A2',epoch:125},{validator:'V01',root:'A',epoch:124}];assert.deepEqual(latestMessages(messages),[messages[1]]);
 const result=chooseHead({blocks:forkBlocks(),messages,justified:'H3936',finalized:'F'});assert.equal(result.weights.A,0n);assert.equal(result.weights.B,3n);assert.equal(result.weights.P,3n);
});
test('known finalized and justified ancestors constrain choice even if another branch has more weight',()=>{
 const blocks=forkBlocks(),messages=[{validator:'V01',root:'A',epoch:125},{validator:'V02',root:'A',epoch:125},{validator:'V03',root:'A',epoch:125}];
 assert.equal(chooseHead({blocks,messages,justified:'B',finalized:'P'}).head,'B');assert.throws(()=>chooseHead({blocks,messages,justified:'A',finalized:'B'}),/INVALID_ANCHOR/);
 assert.throws(()=>chooseHead({blocks:blocks.filter(b=>b.id!=='P'),messages,justified:'H3936',finalized:'F'}),/UNKNOWN_PARENT/);
});
test('equal weight uses deterministic root order; inactive/slashed/equivocating votes do not add weight',()=>{
 const blocks=forkBlocks(),messages=[{validator:'V01',root:'A',epoch:125},{validator:'V02',root:'B',epoch:125}];assert.equal(chooseHead({blocks,messages,justified:'H3936',finalized:'F'}).head,'B');
 for(const flag of ['slashed','equivocating','active']){const validators=VALIDATORS.map(v=>v.id==='V02'?{...v,[flag]:flag==='active'?false:true}:v);const c=chooseHead({blocks,messages,validators,justified:'H3936',finalized:'F'});assert.equal(c.weights.B,0n);assert.equal(c.head,'A2');}
});
test('all snapshots reconstruct on arbitrary rewind and proposals/messages never refer to the future',()=>{
 for(const fn of [slotState,forkState])for(const t of [0,2,3,4,6,7,8,10,12,16,17.99,18,20,24]){const a=fn(t);fn(24);fn(0);assert.deepEqual(fn(t),a);assert(lessonView(a).sentence);if(a.messages)for(const m of a.messages){assert(m.slot<a.slot);assert.equal(m.epoch,Math.floor(m.slot/32));assert(a.known.includes(m.root));}}
 const changed=forkState(24);changed.blocks[0].tx.push('mutated');assert.deepEqual(forkState(24).blocks[0].tx,[]);assert.throws(()=>slotState(NaN),/INVALID_TIME/);assert.throws(()=>forkState(Infinity),/INVALID_TIME/);
 assert.equal(lessonStep('slots',8,1),12);assert.equal(lessonStep('fork',18,-1),12);
});
test('glossary separates easy meaning, technical scope and validator/node/attester roles',()=>{
 for(const id of ['validator','node','block','checkpoint','slot','epoch','vote','fork','reorg','choice','finality']){const d=termDetail(id);assert(d.title&&d.body&&d.technical);}
 assert.match(termDetail('validator').technical,/한 노드가 여러 검증자/);assert.match(termDetail('checkpoint').technical,/마지막 블록/);assert.match(termDetail('choice').technical,/2\/3/);assert.match(termDetail('block').technical,/같은 높이/);assert.throws(()=>termDetail('unknown'),/UNKNOWN_TERM/);
});
