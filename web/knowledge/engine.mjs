import {ETHEREUM,STAKES,PHASES,LESSON_STEPS,DELIVERIES,scenarioById,advanceCheckpoint,support} from './protocol.mjs';
export const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
export const ease=n=>{n=clamp(n);return n*n*(3-2*n);};
export function protocolSeconds(t){const knots=[[0,0],[3,0],[6,1],[9,2],[12,4],[16,384],[18,390],[22,768],[24,768]];for(let i=1;i<knots.length;i++){const [b,y]=knots[i],[a,x]=knots[i-1];if(t<=b)return x+(y-x)*clamp((t-a)/(b-a));}return 768;}
export function eventsFor(id){
 const scenario=scenarioById(id),events=[{at:1.8,type:'assigned'},{at:6,type:'proposed'}];
 for(let i=0;i<8;i++)if(!scenario.offlinePeers.includes(i)){events.push({at:DELIVERIES[i].at+(i===2?0:.65),type:'received',peer:i},{at:9.05+i*.12,type:'verified',peer:i});if(ETHEREUM.committee.includes(i))events.push({at:10.1+i*.16,type:'attested',peer:i});}
 for(const epoch of [100,101])for(const unit of STAKES)if(!scenario.offlineStake.includes(unit.id))events.push({at:(epoch===100?12.3:18.3)+unit.id*.25,type:'stake',epoch,id:unit.id});
 events.push({at:16,type:'boundary',epoch:100},{at:18,type:'next-block'},{at:22,type:'boundary',epoch:101});
 return events.sort((a,b)=>a.at-b.at);
}
export function stateAt(time,id='normal'){
 if(!Number.isFinite(time))throw Error('INVALID_TIME');const t=clamp(time,0,ETHEREUM.duration),scenario=scenarioById(id);
 const s={t,scenario:id,assigned:false,proposed:false,peers:Array.from({length:8},(_,i)=>({id:i,offline:scenario.offlinePeers.includes(i),received:false,verified:false,attested:false})),votes:{100:[],101:[]},sources:{100:99,101:99},checkpoints:[{epoch:99,justified:true,finalized:false},{epoch:100,justified:false,finalized:false},{epoch:101,justified:false,finalized:false}],nextBlock:false};
 for(const e of eventsFor(id)){if(e.at>t)break;
  if(e.type==='assigned')s.assigned=true;if(e.type==='proposed')s.proposed=true;
  if(['received','verified','attested'].includes(e.type))s.peers[e.peer][e.type]=true;
  if(e.type==='stake')s.votes[e.epoch].push(e.id);
  if(e.type==='next-block'){s.nextBlock=true;s.sources[101]=s.checkpoints[1].justified?100:99;}
  if(e.type==='boundary'){const i=e.epoch-99;const r=advanceCheckpoint(s.checkpoints[i-1],s.checkpoints[i],s.votes[e.epoch]);s.checkpoints[i-1]=r.previous;s.checkpoints[i]=r.current;}
 }
 s.phase=PHASES.findLast(p=>p.at<=t);s.seconds=protocolSeconds(t);s.slot=3200+Math.floor(s.seconds/12);s.epoch=Math.floor(s.slot/32);s.round=t>=18?101:100;s.support=support(s.votes[s.round]);
 s.blockStatus=s.checkpoints[1].finalized?'finalized':s.checkpoints[1].justified?'justified':t>=12?'accepted':t>=10?'head':s.proposed?'proposed':'assembling';
 return s;
}
export function stepTime(t,direction){if(direction!==-1&&direction!==1)throw Error('INVALID_STEP');const stops=[...LESSON_STEPS.map(p=>p.at),24];return direction===1?(stops.find(n=>n>t+.01)??24):(stops.findLast(n=>n<t-.01)??0);}
