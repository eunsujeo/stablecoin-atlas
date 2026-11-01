import test from 'node:test';
import assert from 'node:assert/strict';
import {slotState,slotDetails,lessonView} from '../experiments/blockchain-knowledge/lessons.mjs';
import {playback} from '../experiments/blockchain-knowledge/playback.mjs';
test('proposal does not end the 12 second slot; each boundary resets the clock',()=>{
 for(const [t,slot,elapsed,block] of [[0,3200,0,null],[2,3200,6,701],[3.5,3200,10.5,701],[4,3201,0,null],[24,3206,0,null]]){
  const s=slotState(t);assert.equal(s.current.slot,slot);assert.equal(s.current.elapsed,elapsed);assert.equal(s.current.duration,12);assert.equal(s.current.blockNumber,block);
 }
 assert.equal(slotDetails(slotState(4),3200).elapsed,12);
});
test('missed is determined at slot end; no placeholder block or parent is manufactured',()=>{
 for(const t of [8,9,11.99]){const q=slotDetails(slotState(t),3202);assert.notEqual(q.status,'skipped');assert.equal(q.blockNumber,null);assert.equal(q.parentNumber,null);assert(q.elapsed<12);}
 const s=slotState(12),q=slotDetails(s,3202);assert.equal(q.status,'skipped');assert.equal(q.elapsed,12);assert.equal(s.current.slot,3203);assert.equal(s.current.elapsed,0);assert.equal(s.current.blockNumber,null);
 const next=slotDetails(slotState(14),3203);assert.equal(next.blockNumber,703);assert.equal(next.parentNumber,702);assert.equal(next.parent,'B702');assert.equal(slotState(14).blocks.find(b=>b.id===next.parent).slot,3201);
});
test('selected future and past slots expose only results already created; current KPI never borrows the old head',()=>{
 const future=slotDetails(slotState(0),3203);assert.equal(future.status,'future');assert.equal(future.elapsed,0);assert.equal(future.block,null);
 for(const t of [0,4,8,9,12,24]){const s=slotState(t);assert.equal(lessonView(s).kpis[3][1],'아직 없음');assert.equal(s.current.blockNumber,null);}
 const past=slotDetails(slotState(24),3200);assert.equal(past.blockNumber,701);assert.equal(past.parentNumber,700);assert.equal(past.elapsed,12);assert.throws(()=>slotDetails(slotState(0),999),/UNKNOWN_SLOT/);
});
test('replay speed affects transport only, not slot duration or seek reconstruction',()=>{
 const initial={t:0,playing:true,reduced:false,speed:1};
 for(const speed of [.5,1,2]){const p=playback({...initial,speed},{type:'tick',delta:2/speed});assert.equal(p.t,2);assert.deepEqual(slotState(p.t),slotState(2));assert.equal(slotState(p.t).current.duration,12);}
 for(const t of [1.999,2,3.999,4,8,11.999,12,14,23.999,24]){const before=slotState(t);slotState(24);slotState(0);assert.deepEqual(slotState(t),before);}
});
