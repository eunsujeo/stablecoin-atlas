export const CHAPTERS={
 assign:['한 슬롯, 한 명의 제안자','이번 블록을 제안할 차례는 V03입니다. 지분을 반영한 의사난수 배정으로 결정되며, 다른 노드들이 제안자를 뽑는 투표를 하는 것은 아닙니다.','슬롯 전에 정해진 배정을 보여주는 고정 예시입니다.'],
 build:['거래를 담고, 상태를 계산합니다','제안자의 실행 클라이언트가 거래를 실행해 payload를 만듭니다. 합의 클라이언트는 이를 beacon block에 담고, 제안자가 서명합니다.','서명된 블록이 생겼습니다. 아직 최종 확정은 아닙니다.'],
 propagate:['하나의 블록, 여러 개의 관점','블록은 peer-to-peer 네트워크를 따라 전달됩니다. 각 노드는 서로 다른 시각에 받습니다. 수신했다고 곧바로 유효하다고 믿지는 않습니다.','봉투는 블록 전달을, 노드 안의 두 줄은 검증 단계를 나타냅니다.'],
 attest:['받은 블록을 직접 확인합니다','실행 결과를 재현하고 합의 규칙과 서명을 확인합니다. 배정된 attester는 head와 source → target 체크포인트를 담아 투표합니다.','8개 노드는 표본입니다. 모든 validator가 매 슬롯 투표하는 것은 아닙니다.'],
 epoch:['노드 수가 아니라, 지분을 셉니다','이제 한 슬롯에서 epoch 전체로 시야를 넓힙니다. 여러 슬롯의 위원회 투표가 합쳐집니다. 전체 활성 지분의 2/3 이상이 같은 연결을 지지해야 합니다.','12칸은 동일 지분 묶음입니다. 위의 8개 노드와 1:1 대응하지 않습니다.'],
 justify:['한 번의 지지, 아직 최종은 아닙니다','Epoch 경계에서 C100이 justified가 됩니다. 바로 앞의 justified 체크포인트 C99는 finalized로 바뀌지만, 우리가 추적하는 C100은 한 단계가 더 필요합니다.','Justified와 Finalized는 서로 다른 상태입니다.'],
 next:['다음 체크포인트까지 이어지는 동의','다음 epoch의 C101에도 새로운 투표가 모입니다. C100을 source로, C101을 target으로 지지합니다. 앞선 epoch의 표를 다시 세는 것이 아닙니다.','시간을 압축했습니다. 1 epoch = 32 slots = 6분 24초.'],
 finalize:['블록 생성에서, 최종 확정으로','연속된 체크포인트 C100 → C101이 충분한 지분 지지를 받았습니다. 다음 epoch 경계에서 C100은 finalized, C101은 justified가 됩니다.','최종 확정의 되돌림에는 중대한 합의 실패와 최소 1/3 지분의 손실이 필요합니다.'],
};
export function narrative(s){let [title,body,note]=CHAPTERS[s.phase.key];if(s.scenario==='offline'&&s.t>=12){
 title=s.t>=22?'블록은 이어져도, 확정은 멈춥니다':s.t>=16?'기준에 못 미친 지분':'같은 기준, 부족한 참여';
 body='전체 활성 지분의 5/12가 오프라인입니다. 남은 7/12(58.3%)만으로는 2/3에 도달하지 못합니다. 온라인 제안자가 블록을 이어가더라도 C100과 C101은 justified·finalized로 승격되지 않습니다.';
 note='오프라인을 slashing으로 표시하지 않습니다. 장기 inactivity leak 회복은 이 짧은 예시의 범위 밖입니다.';
 }return {title,body,note};}
export function detail(s,selected){
 if(selected==='block')return {title:'추적 블록 · C100',body:`Epoch 100의 시작 블록, slot 3200입니다. 현재 상태는 ${s.blockStatus.toUpperCase()}입니다. 거래 payload와 합의 정보를 함께 가지며, 후속 체크포인트가 충분한 지지를 얻기 전에는 finalized가 아닙니다.`};
 if(selected.startsWith('checkpoint:')){const epoch=Number(selected.split(':')[1]),c=s.checkpoints.find(v=>v.epoch===epoch);return {title:`체크포인트 · C${epoch}`,body:epoch===101&&!s.nextBlock?'아직 다음 epoch의 체크포인트가 제안되기 전입니다.':`현재 ${c.finalized?'FINALIZED':c.justified?'JUSTIFIED':'미확정'}입니다. epoch 경계의 체크포인트가 확정되면 그 조상 블록도 확정된 체인에 포함됩니다.`};}
 const p=s.peers[Number(selected.split(':')[1])];if(!p)return {title:'직접 살펴보기',body:'네트워크의 노드, 중앙 블록 또는 아래 체크포인트를 선택해 보세요. 시간 막대를 뒤로 움직이면 그 시점의 설명도 함께 바뀝니다.'};
 return {title:`검증 노드 · V${String(p.id+1).padStart(2,'0')}`,body:p.offline?'이 시나리오에서는 응답하지 않는 노드 표본입니다. 실제 지분 비율은 노드 개수가 아니라 아래 별도 지분 막대로 표현합니다.':p.attested?'검증을 마친 attester 표본입니다. head와 source/target 체크포인트에 대한 관점을 서명해 전파했습니다. 투표 한 번이 finality를 뜻하지는 않습니다.':p.verified?'실행과 합의 검사를 마쳤습니다. 이번 슬롯의 attester로 배정되지 않았다면 이 시점의 투표 표본에는 포함되지 않습니다.':p.received?'블록을 받았지만 아직 검증을 마치지 않았습니다. 전달과 검증은 다른 단계입니다.':p.id===2?'이번 슬롯의 배정된 제안자 표본입니다. 실제 제안자는 유효 지분에 가중된 의사난수 방식으로 결정됩니다.':'네트워크의 peer 표본입니다. 배정된 역할과 수신 여부에 따라 다음 행동이 달라집니다.'};
}
