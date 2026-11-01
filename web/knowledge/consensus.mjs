// Fixed, validated educational inputs; never a network observer or consensus client.
import {chooseHead} from './fork-choice.mjs';
import {applyFfgBoundary,targetSupport,EPOCH_VALIDATORS} from './epochs.mjs';
export const CONSENSUS_STEPS=[{at:0,key:'attestation',label:'투표의 세 대상'},{at:3,key:'gossip',label:'투표 전파'},{at:7,key:'head',label:'지분과 Head'},{at:12,key:'justify',label:'정당화'},{at:16,key:'next-vote',label:'다음 연결'},{at:20,key:'finalize',label:'최종 확정'}];
export const CONSENSUS_SCENARIOS={normal:'정상 합의',offline:'일부 오프라인',delayed:'투표·Finality 지연'};
const root=n=>'0x'+n.toString(16).padStart(64,'0'),cp=(epoch,id)=>({epoch,root:id});
export function consensusSeconds(t){return t<=10?48+t*9.6:t<=12?144+(t-10)*120:t<=20?384+(t-12)*48:768+(t-20)*48;}
const initial=[{id:'C98',slot:3136,parent:null},{id:'C99',slot:3168,parent:'C98'},{id:'P',slot:3200,parent:'C99'},{id:'A',slot:3201,parent:'P'},{id:'A2',slot:3202,parent:'A'},{id:'B',slot:3203,parent:'P'}].map((b,i)=>({...b,root:root(i+1),receivedAt:b.id==='B'?6:0}));
// Received gossip and block inclusion are deliberately different events.
function firstVotes(kind){return [{id:'V03',head:'A2',send:2,arrive:3},{id:'V04',head:'A2',send:3,arrive:4},{id:'V05',head:'A2',send:4,arrive:5},{id:'V01',head:'B',send:7,arrive:8},{id:'V02',head:'B',send:8,arrive:9},{id:'V06',head:'A2',send:9,arrive:10}].map(q=>({...q,send:kind==='offline'&&q.id==='V01'?Infinity:q.send,arrive:kind!=='normal'&&q.id==='V01'?Infinity:q.arrive}));}
export function consensusState(time,scenario='normal'){
 if(!Number.isFinite(time)||!Object.hasOwn(CONSENSUS_SCENARIOS,scenario))throw Error('INVALID_CONSENSUS_INPUT');
 const t=Math.max(0,Math.min(24,time)),seconds=consensusSeconds(t),slot=3200+Math.floor(seconds/12),epoch=Math.floor(slot/32),validators=EPOCH_VALIDATORS;
 const first=firstVotes(scenario),firstMessages=first.filter(q=>q.arrive<=10).map(q=>({validator:q.id,root:q.head,epoch:100}));
 const branch=chooseHead({blocks:initial,messages:firstMessages,validators,justified:'C99',finalized:'C98'}).head;
 const blocks=initial.filter(b=>b.receivedAt<=t).map(b=>({...b}));
 // The detailed fork precedes this run of ordinary proposals; unshown slots are not invented blocks.
 for(let n=3213;n<=slot;n++)if(seconds>=(n-3200)*12+2){const prior=blocks.findLast(b=>b.slot>=3213);blocks.push({id:n===3232?'C101':n===3264?'C102':`H${n}`,slot:n,parent:prior?.id??branch,root:root(100+n),receivedAt:0});}
 let ffg={previous:cp(98,'C98'),current:cp(99,'C99'),finalized:cp(98,'C98'),bits:[true,true,false,false]},previousWeight=12n;
 const rounds=[],boundaries=[],justified=new Set([98,99]);
 for(let e=100;e<=epoch;e++){
  const target=cp(e,e===100?'P':`C${e}`),source={...ffg.current};
  const votes=validators.map((v,i)=>{
   const q=e===100?first.find(q=>q.id===v.id):{send:13.12+(e-101)*8+i*.5,arrive:13.4+(e-101)*8+i*.5,head:e===101?'C101':'C102'};
   const send=scenario==='offline'&&v.id==='V01'?Infinity:q.send,arrive=scenario!=='normal'&&v.id==='V01'?Infinity:q.arrive;
   const voteSlot=e===100?3200+Math.floor(consensusSeconds(q.send===Infinity?7:q.send)/12):e*32+4+i*2;
   const head=e===100?q.head:(blocks.findLast(b=>b.slot<=voteSlot&&b.slot>=e*32)?.id??q.head);
   const inclusionSlot=e===100?3214:e*32+18+i;
   const inclusion=blocks.find(b=>b.slot===inclusionSlot);
   const received=t>=arrive&&slot>voteSlot&&blocks.some(b=>b.id===head),sent=t>=send;
   return {validator:v.id,weight:v.weight,source,target,head,slot:voteSlot,sent,received,send,arrive,inclusionSlot,included:received&&!!inclusion,validSignature:true,offline:scenario==='offline'&&v.id==='V01'};
  });
  const support=targetSupport(votes,validators,{source,target,totalEpoch:e});rounds.push({epoch:e,source,target,votes,support});
  if(e<epoch){if(support.quorum)justified.add(e);ffg=applyFfgBoundary(ffg,{epoch:e,total:12n,previousWeight,currentWeight:support.weight,previousTarget:cp(e-1,e===100?'C99':e===101?'P':`C${e-1}`),currentTarget:target});boundaries.push({entered:e+1,weight:support.weight,source,target,...ffg});previousWeight=support.weight;}
 }
 const round=rounds.at(-1),messages=rounds.flatMap(r=>r.votes.filter(v=>v.received).map(v=>({validator:v.validator,epoch:r.epoch,root:v.head}))),choice=chooseHead({blocks,messages,validators,justified:ffg.current.root,finalized:ffg.finalized.root});
 const checkpoints=[99,100,101].map(e=>({epoch:e,root:e===99?'C99':e===100?'P':'C101',status:e<=ffg.finalized.epoch?'Finalized':justified.has(e)?'Justified':blocks.some(b=>b.id===`C${e}`)||e===100?'미정당화':'블록 대기'}));
 const focusRound=t>=20?rounds.find(r=>r.epoch===101):t>=12&&t<13?rounds[0]:round;
 const activeVote=focusRound.votes.find(v=>v.sent&&!v.received&&!v.offline&&t<v.send+1.1)??focusRound.votes.findLast(v=>v.received)??[...focusRound.votes].sort((a,b)=>a.send-b.send)[0];
 return {lesson:'consensus',t,scenario,seconds,slot,epoch,validators,blocks,branch,rounds,round,messages,...choice,ffg,boundaries,checkpoints,focusRound,activeVote,step:CONSENSUS_STEPS.findLast(p=>p.at<=t)};
}
export function consensusView(s){
 const failed=s.scenario!=='normal',r=s.focusRound,last=s.boundaries.at(-1),titles=['한 번의 투표, 세 가지 대상','서명한 투표가 관찰 노드에 도착합니다','Head는 지분으로 가지를 선택합니다','충분한 지지로 체크포인트를 정당화','다음 Epoch의 투표로 연결을 확인','정당화와 최종 확정은 다릅니다'];
 const i=CONSENSUS_STEPS.indexOf(s.step),bodies=[
 'Attestation은 검증자의 서명된 의견입니다. Head는 현재 체인 끝, Source는 이미 정당화된 기준, Target은 이번 Epoch의 기준입니다.',
 '전파 중인 투표와 도착한 투표를 구분합니다. 관찰 노드는 검증자별 최신 Epoch 메시지 하나만 지분으로 반영합니다.',
 failed?'V01의 지분 5가 도착하지 않았습니다. 더 긴 체인이 아니라, 받은 최신 투표의 하위 가지 지분을 비교합니다.':'V01 한 명의 지분 5가 A의 세 명·지분 4보다 큽니다. B의 길이가 더 짧아도 Head가 바뀔 수 있습니다.',
 failed?'Epoch 101이 시작돼도 지분 7/12는 기준 8/12에 못 미칩니다. C100은 아직 정당화되지 않았습니다.':'C99 → C100의 유효 지지가 8/12 이상입니다. 경계 처리에서 C100이 Justified가 되지만 C100의 최종 확정은 아직입니다.',
 failed?'다음 블록과 투표는 계속 생깁니다. 다섯 명이 참여해도 전체 지분의 7/12라 최종성 조건은 부족합니다.':'새 Epoch의 투표가 이전 최신 메시지를 대체합니다. Source C100 → Target C101의 지지를 별도로 확인합니다.',
 failed?'블록은 계속 이어지지만 C99 정당화·C98 확정 상태가 유지됩니다. 시계가 흐르는 것만으로 최종 확정되지는 않습니다.':'C101 정당화와 연속 체크포인트 연결 조건을 충족해 C100이 Finalized됩니다. 최신 Head와 C101까지 모두 확정된 것은 아닙니다.'
 ];
 return {title:titles[i],body:bodies[i],sentence:i<3?`관찰 노드의 Head ${s.head} · A ${s.weights.A??0n}/12 · B ${s.weights.B??0n}/12`:`Epoch ${s.epoch} · Justified C${s.ffg.current.epoch} / Finalized C${s.ffg.finalized.epoch}`,reason:i<3?'Head 선택에는 2/3 문턱이 없습니다. 정당화·확정 조건은 별도로 판단합니다.':`직전 경계 지지 ${last?.weight??0n}/12 · 기준 8/12. 충분한 지분과 체크포인트 연결 조건이 함께 필요합니다.`,kpis:[['현재 Head',s.head,'관찰 노드의 선택 · 최종 확정과 별도'],[s.t<12?'도착한 검증자':'반영된 검증자',`${s.t<12?r.votes.filter(v=>v.received).length:r.support.ids.length} / 6`,s.t<12?'관찰 노드 수신 · 블록 반영과 별도':`Epoch ${r.epoch} · 합의 판단에 사용`],[`C${r.source.epoch} → C${r.target.epoch} 지지`,`${r.support.weight} / 12`,'가상 유효 지분 · 기준 8/12'],['합의 상태',`J ${s.ffg.current.epoch} / F ${s.ffg.finalized.epoch}`,`Epoch ${s.epoch} · J 정당화 / F 최종 확정`]],meterTitle:`Epoch ${r.epoch} · Target 지지 지분`,meterNote:`${r.support.ids.length}명 · ${r.support.weight}/12 · 전파와 블록 반영은 별도`,foot:'교육용 고정 지분·배정 · 관찰 노드 1곳 · 1× 42초 / 프로토콜 시간 압축 · 초기 C99 정당화/C98 확정'};
}
export function consensusDetail(s,id){
 const validator=id.replace(/^latest:/,''),latest=id.startsWith('latest:')?s.latest.find(v=>v.validator===validator):null,detailRound=id.startsWith('latest:')?(s.rounds.find(r=>r.epoch===latest?.epoch)??s.focusRound):s.focusRound;
 const v=detailRound.votes.find(v=>v.validator===validator),c=s.checkpoints.find(c=>id===`C${c.epoch}`);
 if(v)return {title:`검증자 ${v.validator} · 지분 ${v.weight}/12`,body:`Head ${v.head} · Source C${v.source.epoch} · Target C${v.target.epoch}. ${v.offline?'오프라인으로 서명하지 않았습니다.':!v.sent?'배정된 시점 대기입니다.':!v.received?'서명했지만 관찰 노드가 아직 받지 못했습니다.':v.included?'체인 블록에 투표가 반영되었습니다.':'관찰 노드에 도착했고 블록 반영은 아직입니다.'}`,technical:`투표 슬롯 ${v.slot}, 포함 예정 슬롯 ${v.inclusionSlot}. 최신 메시지는 Target Epoch가 더 새로운 경우 대체합니다. 같은 Epoch의 반복 메시지는 지분을 더하지 않습니다. 서명·실행 유효성은 교육용 전제이며 실제 BLS 검증을 실행하지 않습니다.`};
 if(c)return {title:`체크포인트 C${c.epoch} · ${c.status}`,body:`C${c.epoch}은 기존 블록 ${c.root}를 가리키는 Epoch 기준입니다. Justified는 충분한 지지로 정당화된 상태, Finalized는 후속 연결 조건까지 충족한 상태입니다.`,technical:'Casper FFG의 이전/현재 정당화 체크포인트와 4비트 이력, 네 최종화 조건을 평가합니다. 초기 C99 정당화/C98 확정은 주어진 과거 상태입니다. 확정 블록의 조상도 보호되며 정상적인 Head 변경은 확정 경계 바깥에서 일어납니다.'};
 return {title:'Head · Source · Target',body:'Head: 지금 선택한 체인의 끝. Source: 이미 정당화된 체크포인트. Target: 이번 Epoch의 체크포인트. 한 Attestation에 세 대상이 함께 들어갑니다.',technical:'LMD-GHOST는 유효한 후보 트리에서 정당화된 기준부터 자식 가지의 최신 지분 가중치를 비교합니다. 이 예시는 proposer boost가 없는 슬롯 이후 관점을 사용하고 유효성·정당화/확정 일관성이 확인된 입력만 다룹니다. 전체 fork-choice Store, unrealized checkpoint 갱신, RANDAO, BLS, 보상·inactivity leak은 구현하지 않습니다. 오프라인은 무서명, 지연은 서명했지만 관찰 구간 내 미도착으로 구분합니다.'};
}
