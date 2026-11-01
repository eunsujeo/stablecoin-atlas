import {ETHEREUM, LESSON_STEPS} from './protocol.mjs';
// All displayed counts and reasons are a projection of the exact renderer state.
export const STATUS = Object.freeze({assembling:'생성 전',proposed:'제안됨',head:'미확정',accepted:'미확정',justified:'정당화됨',finalized:'최종 확정'});
export function presentation(s){
 const step=LESSON_STEPS.findLast(p=>p.at<=s.t),received=s.peers.filter(p=>p.received).length,verified=s.peers.filter(p=>p.verified).length,attested=s.peers.filter(p=>p.attested).length;
 const weight=String(s.support.weight),total=String(s.support.total),link=`C${s.sources[s.round]} → C${s.round}`;
 const reason=s.checkpoints[1].finalized?'C100이 정당화되었고, 연속된 C101 연결도 2/3 이상 지지해 C100을 확정했습니다.':!s.proposed?'아직 서명된 블록이 없습니다. 생성한 뒤에도 지분 투표가 필요합니다.':s.t<12?'블록 수신·검증만으로는 확정되지 않습니다. epoch 전체의 지분 투표가 필요합니다.':!s.checkpoints[1].justified?(s.scenario==='offline'&&s.t>=16?'전체 지분의 7/12만 참여해 2/3에 못 미칩니다. 시간이 지나도 C100은 확정되지 않습니다.':s.support.quorum?'C99 → C100 지지 기준을 충족했습니다. epoch 경계 처리를 기다리며, C100의 최종 확정에는 다음 연결도 필요합니다.':'C99 → C100 연결에 전체 활성 지분의 2/3 이상 지지가 필요합니다.'):
 s.t<18?'C100은 정당화되었지만, 다음 C101 연결에 대한 새 지분 투표가 아직 필요합니다.':s.support.quorum?'C100 → C101도 지지 기준을 충족했습니다. epoch 경계에서 연속 체크포인트 조건을 처리합니다.':'정당화된 C100 → C101 연결에 새 지분 투표가 모여야 C100을 확정할 수 있습니다.';
 const sentences={assign:s.assigned?'V03이 이번 슬롯의 제안자로 배정되었습니다.':'슬롯 3200의 제안자 배정을 확인합니다.',build:'V03이 거래 실행 결과와 합의 정보를 C100에 담습니다.',propagate:`V03이 제안한 C100을 ${received}/8개 노드 표본이 받았습니다.`,attest:`${verified}/8개 노드가 검증했고, 배정된 검증자 ${attested}/3개 표본이 투표했습니다.`,justify:s.checkpoints[1].justified?'C99 → C100의 지지를 처리해 C100이 정당화되었습니다.':`C99 → C100을 지지하는 지분 ${weight}/${total}을 집계합니다.`,finalize:s.checkpoints[1].finalized?'C101까지 지지가 이어져 C100이 최종 확정되었습니다.':`${link} 지분 ${weight}/${total}과 연속 체크포인트 조건을 확인합니다.`};
 return {step,received,verified,attested,weight,total,link,reason,sentence:sentences[step.key],proposer:s.assigned?`V${String(ETHEREUM.proposer+1).padStart(2,'0')}`:'배정 확인',block:STATUS[s.blockStatus],quorum:s.support.quorum,activePeers:s.peers.filter(p=>!p.offline&&(step.key==='assign'||step.key==='build'?p.id===ETHEREUM.proposer:step.key==='attest'?ETHEREUM.committee.includes(p.id):step.key==='propagate')).map(p=>p.id)};
}
