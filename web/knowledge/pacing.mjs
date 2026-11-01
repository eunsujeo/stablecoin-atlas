// Presentation seconds only. Model time remains 0..24; slot time remains model time * 3.
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
export const PACING=Object.freeze({network:build([[4,6,'도입'],[8,6,'후보'],[12,6,'합의'],[16,6,'결과'],[20,6,'검증'],[24,6,'확정']]),normal:build(normal),empty:build(empty),consensus:build([[3,7,'투표 세 대상'],[7,7,'순차 전파'],[10,7,'지분과 Head 변경'],[12,3,'투표 반영'],[13,3,'정당화 결과'],[16,5,'새 Epoch 최신 메시지'],[20,4,'다음 연결'],[21,3,'최종 확정 결과'],[24,3,'Head와 확정 비교']]),epoch:build([[1,4,'Epoch 정의'],[6,5,'슬롯 진행'],[8,4,'마지막 슬롯'],[8.5,3,'Epoch101 경계'],[14,5.5,'새 역할표 투표'],[16,4,'마지막 슬롯'],[16.5,3,'Epoch102 경계'],[24,7.5,'합의 결과 비교']])});
function segments(kind){if(!Object.hasOwn(PACING,kind))throw Error('UNKNOWN_PACING');return PACING[kind];}
const rounded=n=>Math.round(n*1e9)/1e9;
export function playbackDuration(kind){return kind?segments(kind).at(-1).playEnd:24;}
export function presentationTime(t,kind){if(!Number.isFinite(t))throw Error('INVALID_TIME');t=Math.max(0,Math.min(24,t));if(!kind)return t;const s=segments(kind).find(s=>t<=s.modelEnd);return rounded(s.playStart+(t-s.modelStart)/(s.modelEnd-s.modelStart)*(s.playEnd-s.playStart));}
export function modelTime(time,kind){if(!Number.isFinite(time))throw Error('INVALID_TIME');time=Math.max(0,Math.min(playbackDuration(kind),time));if(!kind)return time;const s=segments(kind).find(s=>time<=s.playEnd);return rounded(s.modelStart+(time-s.playStart)/(s.playEnd-s.playStart)*(s.modelEnd-s.modelStart));}
