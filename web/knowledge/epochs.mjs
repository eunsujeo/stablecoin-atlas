// Educational normalized effective balances. No real validator set, BLS or execution.
export const EPOCH_INTRO='Epoch는 32개의 Slot을 묶은 단위로, Ethereum에서 검증자 투표와 합의 상태를 정리하는 기준입니다.';
export const EPOCH_STEPS=[{at:0,key:'unit',label:'32슬롯 묶음'},{at:2,key:'duties',label:'역할과 투표'},{at:6,key:'last',label:'마지막 슬롯'},{at:8,key:'boundary',label:'Epoch 101'},{at:12,key:'link',label:'Source → Target'},{at:16,key:'finality',label:'Epoch 102'}];
export const EPOCH_VALIDATORS=Object.freeze([5n,2n,2n,1n,1n,1n].map((weight,i)=>Object.freeze({id:`V0${i+1}`,weight})));
const cp=(epoch,root=`block:${epoch*32}`)=>({epoch,root});
const same=(a,b)=>a?.epoch===b?.epoch&&a?.root===b?.root;
// Independently expressed four-bit FFG transition; participation is checked before weighting.
export function applyFfgBoundary(state,{epoch,total,previousWeight,currentWeight,previousTarget,currentTarget}){
 if(!Number.isInteger(epoch)||epoch<2||typeof total!=='bigint'||total<=0n||[previousWeight,currentWeight].some(n=>typeof n!=='bigint'||n<0n)||previousTarget.epoch!==epoch-1||currentTarget.epoch!==epoch||!previousTarget.root||!currentTarget.root||state.bits.length!==4||state.bits.some(b=>typeof b!=='boolean'))throw Error('INVALID_FFG_INPUT');
 const oldA=state.previous,oldB=state.current,bits=[false,...state.bits.slice(0,3)];let current=oldB,finalized=state.finalized;
 if(previousWeight*3n>=total*2n){bits[1]=true;current=previousTarget;}
 if(currentWeight*3n>=total*2n){bits[0]=true;current=currentTarget;}
 const rules=[[1,4,oldA,3],[1,3,oldA,2],[0,3,oldB,2],[0,2,oldB,1]],matched=[];
 for(const [start,end,target,gap]of rules)if(target.epoch+gap===epoch&&bits.slice(start,end).every(Boolean)){finalized=target;matched.push(`${start}:${end}/${gap}`);}
 return {previous:{...oldB},current:{...current},finalized:{...finalized},bits,matched};
}
export function targetSupport(records,validators,{source,target,totalEpoch}){
 const ids=new Set(),by=new Map(validators.map(v=>[v.id,v]));if(by.size!==validators.length||validators.some(v=>typeof v.weight!=='bigint'||v.weight<=0n))throw Error('INVALID_VALIDATORS');
 for(const r of records){const v=by.get(r.validator);if(!v)throw Error('UNKNOWN_VALIDATOR');if(!Number.isSafeInteger(r.slot)||!Number.isSafeInteger(r.inclusionSlot)||!source.root||!target.root||source.epoch>=target.epoch||Math.floor(r.slot/32)!==target.epoch||v.active===false||v.slashed||r.included!==true||r.validSignature!==true||!same(r.source,source)||!same(r.target,target)||r.target.epoch!==totalEpoch||r.inclusionSlot<=r.slot||r.inclusionSlot-r.slot>32)continue;ids.add(v.id);}
 const total=validators.filter(v=>v.active!==false).reduce((n,v)=>n+v.weight,0n),weight=[...ids].reduce((n,id)=>n+by.get(id).weight,0n);return {weight,total,ids:[...ids],quorum:total>0n&&weight*3n>=total*2n};
}
export function epochSeconds(t){if(t<=6)return t*60;if(t<=8)return 360+(t-6)*12;if(t<=14)return 384+(t-8)*60;if(t<=16)return 744+(t-14)*12;return 768+(t-16)*24;}
const assignments=epoch=>EPOCH_VALIDATORS.map((v,i)=>({...v,slot:epoch*32+(i*4+(epoch-100)*3+2)%28,committee:(i+epoch)%2?'A':'B'}));
export function epochState(time,scenario='normal'){
 if(!Number.isFinite(time)||!['normal','skipped','delayed'].includes(scenario))throw Error('INVALID_EPOCH_INPUT');const t=Math.max(0,Math.min(24,time)),seconds=epochSeconds(t),slot=3200+Math.floor(seconds/12),epoch=Math.floor(slot/32),elapsed=seconds%12,skips=scenario==='skipped'?[3207,3232,3259]:[];
 const blocks=[{slot:3199,number:700,root:'block:3199',parent:null}];for(let n=3200;n<=slot;n++)if(!skips.includes(n)&&seconds>=(n-3200)*12+2){const last=blocks.at(-1);blocks.push({slot:n,number:last.number+1,root:`block:${n}`,parent:last.root});}
 const checkpoint=e=>{const first=e*32,b=blocks.find(b=>b.slot===first);if(b)return cp(e,b.root);if(slot>first)return cp(e,blocks.findLast(b=>b.slot<first)?.root??null);return cp(e,null);};
 let ffg={previous:cp(98),current:cp(99),finalized:cp(98),bits:[true,true,false,false]},lastWeight=12n;const rounds=[],boundaries=[],justifiedEpochs=new Set([98,99]);
 for(let e=100;e<=epoch;e++){
  const target=checkpoint(e),source={...ffg.current};const votes=assignments(e).map(v=>{const at=(v.slot-3200)*12+8,b=blocks.find(b=>b.slot>v.slot),head=blocks.findLast(b=>b.slot<=v.slot),sent=seconds>=at&&!(scenario==='delayed'&&v.id==='V01');return {validator:v.id,weight:v.weight,committee:v.committee,slot:v.slot,head:head?.root??null,source,target,sent,included:sent&&!!b,inclusionSlot:b?.slot??null,validSignature:true};});
  const support=targetSupport(votes,EPOCH_VALIDATORS,{source,target,totalEpoch:e});rounds.push({epoch:e,source,target,votes,support});
  if(e<epoch){if(lastWeight*3n>=24n)justifiedEpochs.add(e-1);if(support.weight*3n>=24n)justifiedEpochs.add(e);ffg=applyFfgBoundary(ffg,{epoch:e,total:12n,previousWeight:lastWeight,currentWeight:support.weight,previousTarget:cp(e-1,e===100?`block:${99*32}`:checkpoint(e-1).root),currentTarget:target});boundaries.push({entered:e+1,weight:support.weight,...ffg});lastWeight=support.weight;}
 }
 const round=rounds.at(-1),checkpoints=[100,101,102].map(e=>{const c=checkpoint(e),finalized=c.root!==null&&e<=ffg.finalized.epoch,justified=c.root!==null&&justifiedEpochs.has(e);return {...c,status:finalized?'Finalized':justified?'Justified':c.root?'미정당화':'기준 블록 대기',finalized,justified};});
 const slots=Array.from({length:32},(_,i)=>{const n=epoch*32+i,b=blocks.find(b=>b.slot===n);return {slot:n,block:b??null,status:n>slot?'예정':b?'생성':n<slot?'누락':'대기',current:n===slot};});
 return {lesson:'epoch',scenario,t,seconds,slot,epoch,slotInEpoch:slot%32+1,elapsed,progress:((slot%32)*12+elapsed)/384,proposer:`V0${(slot+epoch)%6+1}`,blocks,slots,skips,checkpoints,rounds,round,ffg,boundaries,assignments:assignments(epoch),step:EPOCH_STEPS.findLast(p=>p.at<=t)};
}
export function epochView(s){
 const b=s.boundaries.at(-1),boundary=(s.t>=8&&s.t<9)||(s.t>=16&&s.t<17),support=s.round.support;
 const title=s.t<2?'시간을 묶어 합의를 정리합니다':boundary?`Epoch ${s.epoch} 시작 · 역할표 갱신`:s.scenario==='delayed'&&s.epoch>100?'시간은 진행, 확정은 지연':s.t>=16?'C100의 확정 조건을 확인합니다':'배정된 슬롯에서 지분으로 투표';
 const body=s.t<2?EPOCH_INTRO:boundary?`직전 마지막 슬롯이 끝나고 슬롯 ${s.epoch*32}이 시작됩니다. 같은 검증자들의 사전 배정된 새 역할표를 사용합니다.`:s.t>=16?(s.scenario==='delayed'?'직전 Epoch 101은 5명이 참여해도 지분이7/12였습니다. 현재 Epoch 102의 집계는 계속 진행 중입니다.':'앞선 두 Epoch의 C99→C100, C100→C101 지지가 처리되어 C100이 Finalized, C101은 Justified입니다.'):'Attestation은 배정된 슬롯의 Head와 Source·Target을 함께 담습니다. 아래 막대는 사람 수가 아닌 유효 지분입니다.';
 return {title,body,sentence:boundary?`Epoch ${s.epoch-1} 종료 → ${s.epoch} · 슬롯 ${s.slot} · ${b?.weight??0n}/12 · ${b?.weight>=8n?'기준 충족':'기준 미달'}`:s.t<2?'1 Slot = 12초 · 32 Slots = 1 Epoch = 6분 24초':`Epoch ${s.epoch} · 슬롯 ${s.slot} (${s.slotInEpoch}/32) · Source C${s.round.source.epoch} → Target C${s.epoch}`,
 reason:s.epoch===102&&support.quorum?'현재 C102 지지가 기준에 도달해도 다음 경계 처리는 아직입니다. 이 장면은 Epoch 102 중간에서 끝나며 C102를 자동 확정하지 않습니다.':s.t<2?'32는 프로토콜이 정한 시간 묶음입니다. 역할 배정·참여 기록·보상/페널티·합의 상태를 정리하는 주기이며 블록 수를 뜻하지 않습니다.':s.scenario==='skipped'&&s.epoch===101?(s.checkpoints[1].root?'첫 슬롯3232가 비어 C101은 슬롯3231의 기존 블록을 가리킵니다. 체크포인트는 별도 블록이 아닙니다.':'첫 슬롯의 결과를 기다립니다. 블록이 없더라도 Epoch 시간과 다음 슬롯은 계속 진행합니다.'):'Epoch 경과만으로 확정되지 않습니다. 전체 활성 유효 지분의2/3 이상과 정당화된 체크포인트의 연결 조건이 함께 필요합니다.',
 kpis:[['현재 Epoch',String(s.epoch),`${s.epoch*32} ~ ${s.epoch*32+31} · ${Math.floor(s.progress*100)}% 진행`],['현재 Slot',String(s.slot),`${s.slotInEpoch}/32 · 슬롯 내 ${s.elapsed.toFixed(1)}/12초`],['현재 제안자',s.proposer,'동일 검증자 집합 · 고정 교육용 배정'],['합의 상태',`J ${s.ffg.current.epoch} / F ${s.ffg.finalized.epoch}`,'J 정당화 · F 최종 확정 · 시간과 별도']],foot:'교육용 지분12단위 · 실제 관측/ETH 아님 · 초기 C99 정당화/C98 확정 · 경계는 느리게, 중간 슬롯은 압축',meterTitle:`Target C${s.epoch} 유효 지분`,meterNote:`${support.weight}/12 · 기준8/12 · ${support.ids.length}/6명 참여`};
}
export function epochDetail(s,id){
 if(id.startsWith('slots')){const requested=Number(id.split(':')[1]??s.epoch);if(![100,101,102].includes(requested))throw Error('UNKNOWN_EPOCH');const slots=Array.from({length:32},(_,i)=>{const slot=requested*32+i,b=s.blocks.find(b=>b.slot===slot);return {slot,block:b??null,status:slot>s.slot?'예정':b?'생성':slot<s.slot?'누락':'대기'};});return {title:`Epoch ${requested} · 32개 슬롯`,body:'슬롯은 블록이 없어도 진행됩니다. 생성된 블록만 부모를 참조하며 번호가 증가합니다.',technical:'32는 현재 프로토콜의 SLOTS_PER_EPOCH 상수입니다. 매 슬롯마다 제안자가 있고, 검증자는 epoch 안에 배정된 attestation 역할을 수행합니다. 블록32개가 필수라는 뜻은 아닙니다.',epochSlots:slots};}
 if(id.startsWith('checkpoint:')){const e=Number(id.split(':')[1]),c=s.checkpoints.find(q=>q.epoch===e),block=s.blocks.find(b=>b.root===c?.root);return {title:`체크포인트 C${e}`,body:`${c.status}. ${block?`슬롯 ${block.slot}의 기존 블록 #${block.number}을 가리킵니다.`:'해당 Epoch의 기준 블록을 아직 결정하지 않았습니다.'}`,technical:'체크포인트는 (epoch, block root) 쌍입니다. 시작 슬롯에 블록이 없으면 해당 체인의 이전 블록 root가 사용될 수 있습니다. Justified는 지지 조건을 만족한 기준점, Finalized는 추가 FFG 연결 조건까지 충족한 상태입니다. 최근4개 Epoch의 정당화 비트와 이전 기준점의 Epoch 간격을 검사합니다.'};}
 return {title:'Source / Target · 역할과 지분',body:`Source C${s.round.source.epoch}는 현재 정당화된 기준점, Target C${s.epoch}는 투표 대상 Epoch의 기준점입니다. Head 의견은 포크 선택에 쓰입니다.`,technical:'합의 사양의 timely target 참여를 단순화합니다. 서명 검증이 완료됐다는 교육용 전제 아래 Source/Target·포함 시점·미슬래시 조건을 검사하고 지분을 중복 없이 합산합니다. 전체 활성 유효 지분이 분모입니다. 두2/3 지지 집합은 적어도1/3이 겹치며 FFG의 모순 투표 규칙과 함께 상충 확정을 방어하는 근거가 됩니다. A/B는 attestation 위원회 표본이며 sync committee 교체를 뜻하지 않습니다. 새 Epoch에서 전원이 교체되는 것이 아니며 사전에 정해진 역할표를 사용합니다. Fulu의 proposer lookahead/RANDAO 배정·BLS·실제 보상/페널티 계산은 실행하지 않습니다. epoch 처리에는 참여 기록과 잔액/레지스트리 관련 갱신이 있지만 이 모형의 활성 집합/지분은 고정입니다.'};
}
