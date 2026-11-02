// Presentation seconds only. Protocol models retain their existing deterministic time 0..24.
// End model time, presentation duration, reason. No independent timers or mutable event queue.
const normal=[
 [.2,1.5,'첫 제안자'],[1.8,1.6,'서명 거래 도착'],[2.7,1.5,'첫 블록 생성'],[4,1.3,'다음 슬롯'],
 [4.3,1.5,'V02 배정'],[4.6,1.5,'TX01 선택'],[4.8,1.5,'TX02 선택'],[4.9,1.5,'TX01 실행 결과'],
 [5.2,1.5,'TX03 선택'],[5.6,1.5,'TX02 실행 결과'],[6,2,'TX03 실패 Receipt'],
 [6.2,.9,'TX01 포함 이동'],[6.4,.9,'TX02 포함 이동'],[6.6,.9,'TX03 포함 이동'],[7,1.5,'블록 전파'],[8,2,'재실행 확인'],
 [9,1.5,'미응답 제안자'],[12,3,'누락 슬롯 대기'],[12.5,1.5,'다음 제안자'],[13,1.5,'TX04 선택'],[14,1.5,'TX04 실행'],
 [14.7,1.2,'다음 블록 생성'],[15,1,'다음 블록 전파'],[16,1.5,'다음 블록 검증'],[24,8,'익숙해진 생성 반복']
];
const empty=[[.2,1.5,'첫 제안자'],[2,1.8,'거래 없는 후보'],[2.5,1.5,'빈 거래 블록 제안'],[3,1.5,'전파'],[4,2,'검증 확인'],[24,20,'동일 슬롯 반복']];
function build(rows){let modelStart=0,playStart=0;return Object.freeze(rows.map(([modelEnd,duration,label])=>{const s=Object.freeze({modelStart,modelEnd,playStart,playEnd:playStart+duration,label});modelStart=modelEnd;playStart=s.playEnd;return s;}));}
// Each interval describes educational screen time, never a consensus deadline.
const profiles={
 xrpl:[[4,4,'거래 수신'],[8,5,'거래 집합 제안'],[12,7,'합의 조건'],[13,2,'실행 시작'],[14,3,'순차 실행'],[16,4,'원장 해시'],[18.4,4,'Validation 도착'],[20,3,'검증 결과'],[23.4,3,'지연 응답'],[24,3,'확정 조건']],
 tron:[[4,4,'생산자'],[8,5,'실행과 블록'],[12,4,'검증과 다음 슬롯'],[16,4,'생산 이력'],[17.4,4,'18명 참여'],[18.8,5,'19명과 대상 블록 확정'],[20,2,'다음 생산'],[24,4,'확정 조건']],
 solana:[[4,4,'리더'],[7,4,'후보와 실행'],[10,4,'재실행'],[12,2,'투표 시작'],[12.8,2,'30% 지분'],[13.6,2,'55% 지분'],[14.4,4,'60% 기준과 Notar 증명'],[16,4,'80%와 빠른 확정'],[18,3,'증명 비교'],[20,4,'2차 라운드'],[24,4,'최종 결과']],
 'solana-skipped':[[4,3,'리더'],[8,3,'미응답'],[12,4,'응답 대기'],[13.6,4,'Skip 지지'],[18,4,'Skip 증명'],[19.8,4,'다음 후보 검증'],[20,2,'투표 시작'],[21.6,4,'지분 누적'],[22.4,4,'Notar 증명'],[24,4,'빠른 확정']],
 base:[[4,4,'사전 확인'],[8,5,'L2 블록'],[12,4,'Batch 구성'],[16,6,'L1 데이터 게시'],[20,6,'재구성과 Safe'],[24,5,'L1 확정과 Finalized']],
 'base-outage':[[4,3,'Sequencer 중단'],[10,4,'복구 대기'],[14,4,'복구와 사전 확인'],[18,5,'L2 생성'],[20,4,'Batch 게시'],[22,5,'재구성 대기'],[24,5,'Safe · L1 확정 대기']],
 'base-l1_reorg':[[4,4,'사전 확인'],[8,4,'L2 생성'],[12,3,'Batch'],[13,3,'L1 게시'],[14,4,'Safe'],[18,5,'L1 Reorg'],[20,4,'재게시'],[22,4,'재구성'],[24,4,'L1 확정']],
 'base-derive_delay':[[4,4,'사전 확인'],[8,4,'L2 생성'],[12,3,'Batch'],[16,5,'L1 게시'],[22,5,'재구성 지연'],[24,5,'Safe · 확정 대기']],
 'base-deposit':[[4,4,'L1 입금'],[8,5,'L1 이벤트'],[10,4,'도출'],[16,5,'L2 실행과 Safe'],[24,5,'L1 확정']],
 'base-withdrawal':[[4,3,'출금 시작'],[8,4,'L2 생성과 게시'],[10,4,'L1 데이터'],[12,4,'Safe'],[13,3,'Finalized'],[16,4,'출력 주장'],[18,3,'증명'],[22,5,'검증 · 대기'],[23,3,'조건 확인'],[24,3,'실행 결과']]
};
export const PACING=Object.freeze({...Object.fromEntries(Object.entries(profiles).map(([key,rows])=>[key,build(rows)])),network:build([[4,6,'도입'],[8,6,'후보'],[12,6,'합의'],[16,6,'결과'],[20,6,'검증'],[24,6,'확정']]),normal:build(normal),empty:build(empty),consensus:build([[3,7,'투표 세 대상'],[7,7,'순차 전파'],[10,7,'지분과 Head 변경'],[12,3,'투표 반영'],[13,3,'정당화 결과'],[16,5,'새 Epoch 최신 메시지'],[20,4,'다음 연결'],[21,3,'최종 확정 결과'],[24,3,'Head와 확정 비교']]),epoch:build([[1,4,'Epoch 정의'],[6,5,'슬롯 진행'],[8,4,'마지막 슬롯'],[8.5,3,'Epoch101 경계'],[14,5.5,'새 역할표 투표'],[16,4,'마지막 슬롯'],[16.5,3,'Epoch102 경계'],[24,7.5,'합의 결과 비교']])});
function segments(kind){if(!Object.hasOwn(PACING,kind))throw Error('UNKNOWN_PACING');return PACING[kind];}
const rounded=n=>Math.round(n*1e9)/1e9;
export function playbackDuration(kind){return kind?segments(kind).at(-1).playEnd:24;}
export function presentationTime(t,kind){if(!Number.isFinite(t))throw Error('INVALID_TIME');t=Math.max(0,Math.min(24,t));if(!kind)return t;const s=segments(kind).find(s=>t<=s.modelEnd);return s.playStart+(t-s.modelStart)/(s.modelEnd-s.modelStart)*(s.playEnd-s.playStart);}
export function modelTime(time,kind){if(!Number.isFinite(time))throw Error('INVALID_TIME');time=Math.max(0,Math.min(playbackDuration(kind),time));if(!kind)return time;const s=segments(kind).find(s=>time<=s.playEnd);return rounded(s.modelStart+(time-s.playStart)/(s.playEnd-s.playStart)*(s.modelEnd-s.modelStart));}

export function networkPacing(network,scenario='normal'){
 const key=network==='base'&&['withdrawal_dual','challenge'].includes(scenario)?'base-withdrawal':`${network}-${scenario}`;
 if(Object.hasOwn(profiles,key))return key;
 if(Object.hasOwn(profiles,network))return network;
 throw Error('UNKNOWN_NETWORK_PACING');
}
// Pause just before the following event: the completed explanation remains visible.
// This epsilon is model time, independent of frame rate or selected playback speed.
export function learningStops(kind){return kind?segments(kind).map(s=>s.modelEnd===24?24:s.modelEnd-.0001):[3.9999,7.9999,11.9999,15.9999,19.9999,24];}
