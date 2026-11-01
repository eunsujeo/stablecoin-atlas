import test from 'node:test';import assert from 'node:assert/strict';
import {PACING,presentationTime,modelTime,playbackDuration} from '../experiments/blockchain-knowledge/pacing.mjs';
import {playback} from '../experiments/blockchain-knowledge/playback.mjs';
import {slotState} from '../experiments/blockchain-knowledge/lessons.mjs';
test('important first states get reading time but later repetition retains its original rate',()=>{
 const rows=PACING.normal;for(const label of ['첫 제안자','V02 배정','TX01 선택','TX02 선택','TX01 실행 결과','TX03 선택','TX02 실행 결과','TX03 실패 Receipt','블록 전파','재실행 확인']){const s=rows.find(s=>s.label===label);assert(s.playEnd-s.playStart>=1.49);assert(s.playEnd-s.playStart<=2.01);}
 for(const label of ['TX01 포함 이동','TX02 포함 이동','TX03 포함 이동']){const s=rows.find(s=>s.label===label);assert(Math.abs(s.playEnd-s.playStart-.9)<1e-9);}
 assert.equal(presentationTime(24,'normal')-presentationTime(16,'normal'),8);assert.equal(playbackDuration('normal'),43.8);assert.equal(playbackDuration('empty'),28.3);
});
test('timeline is continuous and invertible at all event boundaries and arbitrary seeks',()=>{
 for(const kind of ['normal','empty',null]){let last=-1;for(let i=0;i<=2400;i++){const t=i/100,p=presentationTime(t,kind);assert(p>last);last=p;assert(Math.abs(modelTime(p,kind)-t)<1e-8);}for(const s of PACING[kind]??[]){assert.equal(modelTime(s.playStart,kind),s.modelStart);assert.equal(modelTime(s.playEnd,kind),s.modelEnd);}}
 assert.throws(()=>modelTime(NaN,'normal'),/INVALID_TIME/);assert.throws(()=>presentationTime(2,'wrong'),/UNKNOWN_PACING/);
});
test('all four speed choices scale presentation time, not the protocol or transaction states',()=>{
 for(const speed of [.5,1,1.5,2]){const state=playback({t:4.3,pacing:'normal',speed,playing:true},{type:'tick',delta:1.5/speed});assert.equal(state.t,4.6);assert.equal(slotState(state.t).current.duration,12);assert.equal(slotState(state.t).transactions.items[1].status,'selected');}
});
test('pause, restart, seek and completion reconstruct the same states without timers',()=>{
 const state={t:0,pacing:'normal',speed:1,playing:true};let a=state;for(let i=0;i<438;i++)a=playback(a,{type:'tick',delta:.1});assert(Math.abs(a.t-24)<1e-6);
 const end=playback(state,{type:'tick',delta:100});assert.equal(end.t,24);assert.equal(end.playing,false);assert.equal(playback(end,{type:'play'}).t,0);
 const paused=playback({...state,t:5.6},{type:'pause'});assert.deepEqual(playback(paused,{type:'tick',delta:99}),paused);
 for(const t of [0,4.3,4.8,5.6,6.1,7,9,12.5,24]){const direct=playback(end,{type:'seek',time:t});assert.deepEqual(slotState(direct.t),slotState(modelTime(presentationTime(t,'normal'),'normal')));}
});
