import {NETWORKS} from './networks.mjs';
import {VALIDATORS,chooseHead} from './fork-choice.mjs';
export {VALIDATORS,ancestor,latestMessages,chooseHead} from './fork-choice.mjs';
import {consensusState,consensusView,CONSENSUS_STEPS} from './consensus.mjs';
import {epochState,epochView,EPOCH_STEPS} from './epochs.mjs';
import {playbackDuration} from './pacing.mjs';
import {transactionState} from './transactions.mjs';
import {clamp} from './engine.mjs';
export const LESSONS=Object.freeze({...Object.fromEntries(Object.entries(NETWORKS).map(([id,n])=>[id,{label:n.name,steps:n.steps}])),epoch:{label:'Epoch·투표',steps:EPOCH_STEPS},slots:{label:'블록 생성',steps:[{at:0,key:'clock',label:'슬롯과 블록'},{at:4,key:'parent',label:'부모에 연결'},{at:8,key:'missing',label:'제안자 미응답'},{at:12,key:'skip',label:'빈 슬롯 건너기'},{at:16,key:'repeat',label:'생성 반복'},{at:20,key:'epoch',label:'32슬롯 묶음'}]},consensus:{label:'합의·확정',steps:CONSENSUS_STEPS},fork:{label:'Fork·Reorg',steps:[{at:0,key:'parent',label:'공통 부모'},{at:3,key:'first',label:'먼저 본 블록'},{at:7,key:'fork',label:'다른 후보'},{at:12,key:'weight',label:'지분으로 비교'},{at:18,key:'reorg',label:'선택 변경'},{at:22,key:'finality',label:'확정 경계'}]}});
export const SLOT_SECONDS=12, SLOT_REPLAY_SCALE=3;
export const SLOT_LABELS=Object.freeze({future:'예정 · Scheduled',waiting:'대기 · Waiting',unresponsive:'응답 없음 · Waiting',created:'제안됨 · Proposed',skipped:'누락 · Missed'});
export function slotDetails(s,number){
 const entry=s.slots.find(q=>q.slot===number)??(number===3206?{slot:3206,proposer:'V07',start:24,status:s.t===24?'waiting':'future',block:null}:null);
 if(!entry)throw Error('UNKNOWN_SLOT');const block=s.blocks.find(b=>b.id===entry.block),parent=s.blocks.find(b=>b.id===block?.parent);
 return {slot:number,proposer:entry.proposer,status:entry.status,label:SLOT_LABELS[entry.status],elapsed:clamp((s.t-entry.start)*SLOT_REPLAY_SCALE,0,SLOT_SECONDS),duration:SLOT_SECONDS,block:entry.block,blockNumber:block?.number??null,parent:block?.parent??null,parentNumber:parent?.number??null};
}
export function slotState(time,txScenario='normal'){
 if(!Number.isFinite(time))throw Error('INVALID_TIME');const t=clamp(time,0,24),seconds=t*SLOT_REPLAY_SCALE,index=Math.floor(seconds/SLOT_SECONDS),slot=3200+index;
 const blocks=[{id:'B700',number:700,slot:3199,parent:null,createdAt:0,checkpoint:null}],slots=[];
 for(let i=0;i<6;i++){
  const start=i*4,skipped=i===2&&t>=start+4,created=i!==2&&t>=start+2;
  const entry={elapsed:clamp((t-start)*SLOT_REPLAY_SCALE,0,SLOT_SECONDS),duration:SLOT_SECONDS,slot:3200+i,proposer:`V0${i+1}`,start,status:t<start?'future':created?'created':skipped?'skipped':i===2&&t>=start+1?'unresponsive':'waiting',block:null};
  if(created){const parent=blocks.at(-1),number=parent.number+1;entry.block=`B${number}`;blocks.push({id:entry.block,number,slot:entry.slot,parent:parent.id,createdAt:start+2,checkpoint:i===0?'C100':null});}slots.push(entry);
 }
 const s={lesson:'slots',t,seconds,slot,epoch:100,index,progress:seconds%SLOT_SECONDS/SLOT_SECONDS,proposer:`V0${index+1}`,slots,blocks,head:blocks.at(-1).id,created:blocks.length-1,skipped:slots.filter(s=>s.status==='skipped').length,step:LESSONS.slots.steps.findLast(p=>p.at<=t)};s.current=slotDetails(s,slot);s.transactions=transactionState(s,txScenario);return s;
}
const root=n=>'0x'+n.toString(16).padStart(64,'0');
export function forkBlocks(){
 // Every initial ancestor is present in the model; the renderer compresses 95 of them.
 const initial=Array.from({length:97},(_,i)=>({id:i===0?'F':i===96?'P':`H${3904+i}`,slot:3904+i,number:404+i,parent:i===0?null:i===1?'F':`H${3903+i}`,root:root(1000+i),createdAt:0,receivedAt:0,tx:[]}));
 initial.push({id:'A',slot:4001,number:501,parent:'P',root:root(2001),createdAt:3,receivedAt:3,tx:['T']},{id:'B',slot:4002,number:501,parent:'P',root:root(2002),createdAt:7,receivedAt:12,tx:[]},{id:'A2',slot:4003,number:502,parent:'A',root:root(2003),createdAt:10,receivedAt:10,tx:[]});return initial;
}
const MESSAGES=Object.freeze([{at:6,validator:'V03',root:'A',epoch:125,slot:4001},{at:6,validator:'V05',root:'A',epoch:125,slot:4001},{at:6,validator:'V06',root:'A',epoch:125,slot:4001},{at:16,validator:'V01',root:'B',epoch:125,slot:4002},{at:18,validator:'V02',root:'B',epoch:125,slot:4002}].map(Object.freeze));
export function forkSeconds(t){const knots=[[0,0],[3,2],[6,12],[7,14],[10,24],[12,36],[18,40],[24,48]];for(let i=1;i<knots.length;i++){const [b,y]=knots[i],[a,x]=knots[i-1];if(t<=b)return x+(y-x)*clamp((t-a)/(b-a));}return 48;}
export function forkState(time){
 if(!Number.isFinite(time))throw Error('INVALID_TIME');const t=clamp(time,0,24),seconds=forkSeconds(t),slot=4001+Math.floor(seconds/12),all=forkBlocks(),blocks=all.filter(b=>b.createdAt<=t),known=blocks.filter(b=>b.receivedAt<=t),messages=MESSAGES.filter(m=>m.at<=t&&m.slot<slot);
 const choice=chooseHead({blocks:known,messages,justified:'H3936',finalized:'F'}),oldHead=choice.head==='B'&&known.some(b=>b.id==='A2')?'A2':null,removed=oldHead?['A','A2'].filter(id=>!choice.path.includes(id)):[],added=oldHead?choice.path.filter(id=>!new Set([...all.filter(b=>b.createdAt===0).map(b=>b.id),'A','A2']).has(id)):[];
 return {lesson:'fork',t,seconds,slot,epoch:Math.floor(slot/32),blocks,known:known.map(b=>b.id),messages,head:choice.head,path:choice.path,weights:choice.weights,latest:choice.latest,oldHead,removed,added,finalized:'F',justified:'H3936',tx:choice.path.includes('A')?'정식 체인에 포함':t>=18?'정식 체인에서 제외':'아직 미포함',step:LESSONS.fork.steps.findLast(p=>p.at<=t)};
}
export function lessonState(lesson,t,txScenario='normal'){if(NETWORKS[lesson])return NETWORKS[lesson].state(t,txScenario);if(lesson==='consensus')return consensusState(t,txScenario);if(lesson==='epoch')return epochState(t,txScenario);if(lesson==='slots')return slotState(t,txScenario);if(lesson==='fork')return forkState(t);throw Error('UNKNOWN_LESSON');}
export function lessonStep(lesson,t,direction){if(![-1,1].includes(direction))throw Error('INVALID_STEP');const stops=[...LESSONS[lesson].steps.map(s=>s.at),24];return direction===1?stops.find(n=>n>t+.01)??24:stops.findLast(n=>n<t-.01)??0;}
function baseLessonView(s){
 if(s.lesson==='slots'){
  const missing=s.slots[2],head=s.blocks.at(-1),notes={clock:['시간 칸과 기록 묶음','슬롯은 12초짜리 기회입니다. 블록은 그 안에서 실제로 만들어진 기록입니다.'],parent:['바로 앞 블록을 가리킵니다','새 블록은 부모 블록의 해시를 담습니다. 시간 칸이 아니라 실제 블록에 연결됩니다.'],missing:['제안자가 응답하지 않습니다','검증자 V03이 오프라인인 예시입니다. 이 슬롯에는 새 블록이 전달되지 않습니다.'],skip:['빈 시간 칸을 건너 연결합니다','슬롯 3202가 끝나도 블록은 없습니다. 다음 제안자는 마지막 블록 B702를 부모로 사용합니다.'],repeat:['시간은 계속, 기록은 성공할 때','제안자는 슬롯마다 배정됩니다. 블록 번호는 블록이 생길 때만 증가합니다.'],epoch:['슬롯 32개가 한 에포크','에포크 100은 슬롯 3200~3231입니다. 이 장면은 앞 6개 슬롯, 실제 72초를 압축합니다.']};
  const [title,body]=notes[s.step.key],c=s.current;
  return {title,body,sentence:s.t===24?'6개의 시간 칸에서 블록 5개가 생겼습니다. 다음 슬롯 3206도 예정대로 시작됩니다.':c.status==='unresponsive'?`슬롯 ${s.slot} · 응답이 없어도 ${c.elapsed.toFixed(1)} / 12초의 시간은 흐릅니다.`:c.block?`슬롯 ${s.slot}에서 블록 #${c.blockNumber} 제안 · 슬롯 종료까지 ${(12-c.elapsed).toFixed(1)}초 남았습니다.`:`슬롯 ${s.slot} 시작 · 제안자 ${c.proposer}의 블록을 기다립니다.`,reason:'누락은 한 시간 칸에 블록이 없는 상태입니다. 기존 체인 선택을 바꾸는 Reorg와는 다릅니다. 제안된 블록도 아직 최종 확정은 아닙니다.',kpis:[['현재 슬롯 · Current Slot',String(c.slot),'블록을 제안할 수 있는 12초 시간 칸'],['슬롯 내 경과 · 프로토콜 시간',`${c.elapsed.toFixed(1)} / 12초`,'재생 배속을 바꿔도 슬롯 길이는 12초'],['현재 제안자 · Proposer',c.proposer,'이 슬롯에서 블록을 제안하도록 배정'],['현재 슬롯의 블록',c.block?`#${c.blockNumber}`:c.status==='skipped'?'블록 없음':'아직 없음',c.block?`Proposed · 부모 #${c.parentNumber}`:c.label]],foot:'교육용 고정 예시 · 기본 재생24초 = 프로토콜72초 · 재생 배속은 화면 시계만 변경',meterTitle:'에포크(Epoch) 100 · 32개 슬롯',meterValue:`${Math.min(s.index,6)} / 32`,meterNote:'슬롯3200~3231 · 12초 × 32 = 6분24초'};
 }
 const a=String(s.weights.A??0n),b=String(s.weights.B??0n),notes={parent:['같은 과거에서 시작합니다','초록 체크포인트는 이미 확정된 과거입니다. 이후 블록 P는 아직 확정되지 않았습니다.'],first:['먼저 도착한 A를 선택합니다','관찰 노드는 블록 A와 이를 지지하는 투표를 먼저 받습니다. A에 송금 T가 들어 있습니다.'],fork:['늦게 본 제안자는 다른 부모를 택합니다','다음 슬롯의 제안자는 A를 보지 못해 같은 부모 P 위에 B를 만듭니다. 같은 슬롯의 이중 제안 예시는 아닙니다.'],weight:['머릿수가 아니라 지분을 비교합니다','관찰 노드에 B와 투표가 늦게 도착합니다. 각 검증자의 최신 메시지 하나와 유효 지분을 가지별로 합칩니다.'],reorg:['선택한 가지가 바뀝니다','B 가지의 지분 지지가 더 커져 A·A2가 선택 경로에서 빠지고 B로 바뀝니다. 블록 개수가 많은 A 가지가 이기지 않습니다.'],finality:['Head 변경과 확정 취소는 다릅니다','이번 Reorg는 미확정 구간 안에서만 일어납니다. 확정된 체크포인트 F와 그 조상은 보존합니다.']};
 const [title,body]=notes[s.step.key];return {title,body,sentence:s.t>=18?'B 지지 지분 6 > A 지지 지분 4: A·A2 대신 B를 선택합니다.':s.t>=12?`관찰 노드의 최신 지지: A 가지 ${a}, B 가지 ${b} · 현재 선택 ${s.head}`:s.t>=7?'A를 못 본 다음 제안자가 P 위에 B를 만들었습니다. 관찰 노드에는 아직 도착하지 않았습니다.':s.t>=3?'관찰 노드가 먼저 받은 A를 현재 체인의 끝으로 선택합니다.':'확정된 과거 위에 공통 부모 P가 있습니다.',reason:s.t>=18?'송금 T는 A에만 있어 현재 정식 체인에서 제외됩니다. 나중에 다시 포함될 수 있지만 자동 재포함이나 성공을 보장하지 않습니다.':'모든 노드가 같은 순간에 같은 블록을 보는 것은 아닙니다. 관찰 노드가 새 블록과 투표를 받으면 선택이 달라질 수 있습니다.',kpis:[['관찰 노드의 Head',s.head,'현재 선택된 체인의 끝 · 미확정'],['A 가지 / B 가지',`${a} / ${b}`,'최신 메시지 × 지분 · 전체 표본 지분 12'],['Reorg로 제외된 블록',`${s.removed.length}개`,s.removed.length?'A · A2 제외 / B 선택':'현재까지 경로 교체 없음'],['송금 T',s.tx,'A에만 포함 · 되돌림 후 재포함은 별개']],foot:'고정 지분 예시 · 유효한 후보·서명 전제 · proposer boost가 만료된 시점의 비교 · 전체 클라이언트 구현 아님',meterTitle:'관찰된 최신 메시지 · 지분 가중치',meterValue:`A ${a} : B ${b}`,meterNote:'2/3 확정 기준과 다른 Head 선택 · V04 메시지 미도착'};
}

export function lessonView(s){if(NETWORKS[s.lesson])return NETWORKS[s.lesson].view(s);if(s.lesson==='consensus')return consensusView(s);if(s.lesson==='epoch')return epochView(s);const v=baseLessonView(s);if(s.lesson!=='slots')return v;const tx=s.transactions;return {...v,title:tx.title,body:tx.story,reason:tx.reason,foot:`교육용 고정 예시 · 기본 재생 ${playbackDuration(tx.scenario).toFixed(1)}초 = 프로토콜72초 · 슬롯은12초, 장면별 표시 시간은 다릅니다`};}
