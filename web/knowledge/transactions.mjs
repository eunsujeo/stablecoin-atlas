// Fixed educational events, not execution, provider data or a shared global mempool.
export const TX_SCENARIOS=['normal','empty'];
export const TX_LABELS={broadcast:'전파 중',pending:'Pending · 대기',selected:'Selected · 선택',executed:'Executed · 실행',included:'Included · 제안 블록 포함',excluded:'Not Included · 이번 블록 제외'};
const SPEC=[['TX01','ETH 전송',.4,4.3,4.8,6,702],['TX02','ERC-20 전송',.7,4.6,5.2,6,702],['TX03','컨트랙트 호출',1,4.9,5.6,6,702],['TX04','ETH 전송 · 대기',1.3,12.5,13,14,703]];
export function transactionState(s,scenario='normal'){
 if(!TX_SCENARIOS.includes(scenario))throw Error('UNKNOWN_TX_SCENARIO');
 const t=s.t,items=scenario==='empty'?[]:SPEC.map(([id,type,arrival,select,execute,include,number],i)=>{
  const status=t>=include?'included':t>=execute?'executed':t>=select?'selected':t<arrival?'broadcast':i===3&&t>=4.3&&t<12?'excluded':'pending';
  const executed=t>=execute,included=t>=include,receipt=executed?{status:i===2?0:1,applicationState:i===2?'호출 변경 되돌림':'예시 상태 변경',gasCharged:true,nonceConsumed:true}:null;
  return {id,type,status,label:TX_LABELS[status],observedByA:t>=arrival,observedByB:t>=arrival+.5,inPool:t>=arrival&&!included,selected:t>=select&&!included,executed,receipt,block:included?`B${number}`:null,blockNumber:included?number:null,arrivalAt:arrival,selectAt:select,executeAt:execute,includeAt:include,transferAt:include+(i<3?i*.2:0),finalized:false,canonical:'이 장면에서 판정하지 않음',reason:included?'제안된 블록의 거래 목록에 포함. 체인 선택·최종 확정은 별도입니다.':i===3&&t<12?'maxFeePerGas가 예시 base fee보다 낮아 이번 후보에 미포함. 관찰 노드 A는 계속 보관합니다.':i===3?'부모 #702의 gas 사용량이 목표보다 낮아 다음 base fee가 낮아진 가정. nonce·잔액·gas 등 유효성 조건도 충족해 선택 가능합니다.':status==='broadcast'?'사용자가 서명한 거래를 전파합니다. 노드별 도착 시점은 다릅니다.':'nonce·잔액·서명·gas 조건이 맞는 고정 예시입니다. 단순 수수료 순위만으로 선택하지 않습니다.'};
 });
 const blocks=s.blocks.map(b=>({id:b.id,transactions:b.number===700?null:items.filter(q=>q.block===b.id).map(q=>q.id),validation:b.number===700?'초기 부모':t>=b.createdAt+1?'다른 노드 재실행 확인 · 미확정':t>=b.createdAt+.5?'노드로 전파 중':'제안됨 · 미확정'}));
 const events=SPEC.flatMap(([id,type,arrival,select,execute,include],i)=>[{id,at:arrival},{id,at:select},{id,at:execute},{id,at:include+(i<3?i*.2:0)}]).filter(e=>e.at<=t).sort((a,b)=>b.at-a.at);
 const active=scenario==='empty'?null:t>=8&&t<12?'TX04':events[0]?.id??'TX01';
 let title,story,reason;
 if(scenario==='empty'){title='사용자 거래가 없어도 블록은 생성';story='실행 트랜잭션 목록은 0개입니다. 부모 참조·상태 관련 정보·합의 데이터까지 빈 것은 아닙니다.';reason='빈 거래 목록도 가능하지만 제안·검증·체인 선택·최종 확정은 여전히 서로 다른 과정입니다.';}
 else if(t<2){title='사용자가 서명하고 노드로 전파';story='작은 거래 4개가 노드 A의 풀에 차례로 도착합니다. 노드 B는 조금 늦게 관측합니다.';reason='트랜잭션 풀은 전역 단일 큐가 아닙니다. 노드마다 관측 내용과 보관 정책이 다릅니다.';}
 else if(t<4){title='먼저, 사용자 거래 없는 블록';story='#701의 사용자 거래는 0개입니다. 대기 거래가 있어도 모든 거래를 반드시 포함하는 것은 아닙니다.';reason='이 예시는 다음 슬롯에서 거래를 선택합니다. 빈 목록이 블록 전체에 정보가 없다는 뜻은 아닙니다.';}
 else if(t<6){title=t<4.8?'제안자가 실행 페이로드 구성':'순서대로 실행하고 결과 기록';story=t<4.8?'V02의 후보에 TX01~03을 선택합니다. TX04는 수수료 조건이 맞지 않아 풀에 남습니다.':'TX01 → TX02 → TX03 순서로 실행합니다. Receipt는 별도 실행 결과이며 거래 목록의 항목이 아닙니다.';reason='TX03은 호출이 revert된 예시입니다. 실패 Receipt(status 0)도 유효한 거래로 블록에 포함될 수 있습니다. EVM 자체는 실행하지 않습니다.';}
 else if(t<8){title='세 거래가 #702에 포함';story=t<6.5?'실행된 거래 목록으로 블록을 제안합니다. 풀에서 블록으로의 이동은 개념 표현입니다.':t<7?'다른 노드에 #702를 전파합니다. 수신만으로 검증이 끝난 것은 아닙니다.':'다른 노드가 거래를 다시 실행해 결과를 확인한 예시입니다. 정식 체인 선택과 최종 확정은 별도입니다.';reason='TX03의 호출 실패와 블록 유효성 실패는 다릅니다. 제안 블록에 포함되어도 최종 확정은 아닙니다.';}
 else if(t<12){title='슬롯은 지나가도 거래는 대기';story='V03이 응답하지 않습니다. TX04는 노드 A의 풀에 남고, 새 블록 없이 다음 슬롯을 기다립니다.';reason='이 예시의 노드는 거래를 유지합니다. 실제 보관·퇴출·교체는 노드 정책과 거래 조건에 따릅니다. 누락은 Reorg와 다릅니다.';}
 else if(t<14){title='다음 슬롯에서 다시 선택';story='부모 #702의 낮은 gas 사용량으로 다음 base fee가 낮아진 예시입니다. TX04도 조건을 충족합니다. V04가 선택·실행하여 #703 후보를 구성합니다.';reason='새 거래나 수수료 수정본을 만든 것이 아닙니다. 같은 서명 거래가 달라진 블록 조건에서 유효해진 교육용 가정입니다.';}
 else {title='포함은 확정과 다릅니다';story='TX04는 #703에 포함됐습니다. 뒤의 #704·#705는 사용자 거래 없이도 생성됩니다.';reason='거래는 제안 블록에 포함된 상태입니다. Fork·Reorg에서 체인 포함 여부가 바뀔 수 있으며 Finality는 별도 합의 과정입니다.';}
 return {scenario,items,blocks,active,title,story,reason,pending:items.filter(q=>q.inPool&&!q.selected).length,selected:items.filter(q=>q.selected).length,included:items.filter(q=>q.block).length};
}
export function transactionDetail(q){return {txInfo:q,title:`${q.id} · ${q.type}`,body:`${q.label}. ${q.reason}`,technical:`실행: ${q.receipt?`Receipt status ${q.receipt.status} · ${q.receipt.applicationState}. gas 비용·nonce는 반영되는 예시.`:'아직 실행 전.'} 포함 블록: ${q.blockNumber===null?'없음':'#'+q.blockNumber}. 최종 확정: 아니오. 노드 A 관측: ${q.observedByA?'있음':'아직 없음'}, B 관측: ${q.observedByB?'있음':'아직 없음'}. 제안자는 로컬 구성 또는 외부 builder가 제공하는 실행 페이로드를 사용할 수 있습니다. Receipt 원문이 거래 목록 안에 들어가는 것은 아니며, receiptsRoot·stateRoot 등으로 실행 결과를 검증합니다. 실제 EVM·서명·실제 잔액을 실행한 결과가 아닙니다.`};}
