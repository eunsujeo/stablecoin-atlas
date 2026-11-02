import test from 'node:test';import assert from 'node:assert/strict';
import {PACING,networkPacing,learningStops,presentationTime,modelTime,playbackDuration} from '../web/knowledge/pacing.mjs';
import {playback} from '../web/knowledge/playback.mjs';import {NETWORKS} from '../web/knowledge/networks.mjs';
test('all scenario clocks are invertible and reconstruct protocol evidence after arbitrary seeks',()=>{
 for(const [id,n]of Object.entries(NETWORKS))for(const scenario of Object.keys(n.scenarios)){
 const kind=networkPacing(id,scenario);let previous=-1;for(let i=0;i<=2400;i++){const t=i/100,p=presentationTime(t,kind),back=modelTime(p,kind);assert(p>previous);previous=p;assert(Math.abs(t-back)<1e-8);}
 for(const t of [0,6,12,13.6,14.4,17.4,18.8,20,22,24]){const expected=n.state(t,scenario);n.state(24,scenario);assert.deepEqual(n.state(modelTime(presentationTime(t,kind),kind),scenario),expected);}
 }
});
test('important threshold results receive distinct reading intervals without uniform slowdown',()=>{
 const span=(a,b,k)=>presentationTime(b,k)-presentationTime(a,k);
 assert.equal(span(16,17.4,'tron'),4);assert.equal(span(17.4,18.8,'tron'),5);
 assert.equal(span(12,16,'base'),6);assert.equal(span(16,20,'base'),6);assert.equal(span(20,24,'base'),5);
 assert.equal(span(13.6,14.4,'solana'),4);assert.equal(span(14.4,16,'solana'),4);
 for(const k of ['xrpl','tron','solana','base'])assert(new Set(PACING[k].map(s=>s.playEnd-s.playStart)).size>1);
 assert.equal(playbackDuration('normal'),43.8);assert.equal(playbackDuration('empty'),28.3);assert.equal(playbackDuration('consensus'),42);
});
test('learning clamps even oversized frames at each boundary, preserves state, and resumes once',()=>{
 for(const [id,n]of Object.entries(NETWORKS))for(const scenario of Object.keys(n.scenarios))for(const speed of [.5,1,1.5,2]){
 const pacing=networkPacing(id,scenario);let state={t:0,pacing,speed,playing:false,mode:'learning'};
 for(const stop of learningStops(pacing)){
 state=playback(playback(state,{type:'play'}),{type:'tick',delta:1000});assert.equal(state.t,stop);assert.equal(state.playing,false);assert.deepEqual(playback(state,{type:'tick',delta:1000}),state);
 assert.deepEqual(n.state(state.t,scenario),n.state(stop,scenario));
 }
 assert.equal(state.t,24);
 const continuous=playback(playback({...state,t:3,playing:true},{type:'mode',mode:'continuous'}),{type:'tick',delta:1000});assert.equal(continuous.t,24);
 }
});
test('speed, seek, pause, mode changes and reduced motion do not leak clocks or alter protocol rules',()=>{
 for(const speed of [.5,1,1.5,2]){let s={t:8,pacing:'base',playing:true,mode:'continuous',speed};s=playback(s,{type:'tick',delta:1/speed});assert(Math.abs(presentationTime(s.t,s.pacing)-presentationTime(8,s.pacing)-1)<1e-8);s=playback(s,{type:'pause'});const frozen=s;s=playback(s,{type:'tick',delta:99});assert.deepEqual(s,frozen);s=playback(s,{type:'seek',time:0});assert.equal(s.speed,speed);s=playback(s,{type:'reduce',value:true});assert.equal(playback(s,{type:'play'}).playing,false);}
 assert.throws(()=>playback({}, {type:'mode',mode:'bad'}),/INVALID_MODE/);
 const s=NETWORKS.xrpl.state(23.9999,'offline');assert(!s.accepted&&!s.validated&&s.executed===0);
 const a=NETWORKS.solana.state(14,'normal'),b=NETWORKS.solana.state(14.5,'normal');assert(a.cert.notarized&&!a.finalized);assert(b.cert.fast&&b.finalized);assert.match(NETWORKS.solana.view(a).title,/Notar/);assert.match(NETWORKS.solana.view(b).title,/확정 증명서/);
});
