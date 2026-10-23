import {surveyRows,surveyMetrics,surveyTargets} from './survey-model.js';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const metricLabels={total_supply:'총공급량 (tokens)',circulating_supply:'유통량 (tokens)',adjusted_circulating_supply:'조정 유통량 (tokens)',total_supply_usd:'총공급량 환산 (USD)',circulating_supply_usd:'유통량 환산 (USD)',adjusted_circulating_supply_usd:'조정 유통량 환산 (USD)',transfer_volume:'전송량 (tokens)',transfer_volume_usd:'환산 전송량 (USD)',transfer_count:'전송 건수',transfer_tx_count:'트랜잭션 수',adjusted_volume_usd:'조정 전송량 (USD)'};
export function initializeSurveyFilters(root,render){
 for(const [key,values]of [['coin',[...new Set(surveyTargets.map(t=>t.coinId))]],['network',[...new Set(surveyTargets.map(t=>t.networkId))]]]){
  const select=root.querySelector(`[data-survey-${key}]`);for(const value of values){const option=node('option',value.toUpperCase());option.value=value;select.append(option);}
 }
 for(const s of root.querySelectorAll('select'))s.addEventListener('change',render);
}
export function renderSurvey(root,{data,state}){
 const kind=root.querySelector('[data-survey-kind]').value,coin=root.querySelector('[data-survey-coin]').value,network=root.querySelector('[data-survey-network]').value;
 const snapshot=data?.snapshots.find(s=>s.survey===kind),rows=surveyRows(snapshot,{coin,network});
 const observed=rows.filter(r=>r.state==='OBSERVED').length,inconclusive=rows.filter(r=>r.state==='INCONCLUSIVE').length;
 root.querySelector('[role="status"]').textContent=({LAST_GOOD:'조회 실패 · 마지막 정상 자료',UNAVAILABLE:'자료 조회 실패',DISABLED:'DB 읽기 모드 미연결',MISSING:'저장 자료 미확보'})[state]??`관측 ${observed}/${rows.length}일 · INCONCLUSIVE ${inconclusive}일 · 미확보 ${rows.length-observed-inconclusive}일`;
 const head=root.querySelector('thead tr');head.replaceChildren();
 for(const title of ['토큰 · 네트워크','기준일','관측 상태',...surveyMetrics[kind].map(f=>metricLabels[f]),'관측 근거']){const th=node('th',title);th.scope='col';head.append(th);}
 const body=root.querySelector('tbody');body.replaceChildren();
 if(!data){const tr=node('tr'),td=node('td',state==='UNAVAILABLE'?'조사 자료를 읽지 못했습니다. 전체 다시 읽기로 재조회하세요.':state==='DISABLED'?'DB 읽기 모드에서 저장된 조사 자료를 볼 수 있습니다.':'저장된 조사 자료가 없습니다.');td.colSpan=4+surveyMetrics[kind].length;tr.append(td);body.append(tr);return;}
 for(const r of rows){
  const tr=node('tr'),th=node('th',r.coinId.toUpperCase()+' · '+r.networkId.toUpperCase());th.scope='row';tr.dataset.state=r.state;tr.dataset.deployment=r.deploymentId;tr.dataset.day=r.day;tr.append(th,node('td',r.day),node('td',r.state==='MISSING'?'미확보':r.state));
  for(const f of surveyMetrics[kind])tr.append(node('td',r.point?(r.point.values[f]??'—'):r.state==='INCONCLUSIVE'?'—':'미확보'));
  const evidence=node('td');if(snapshot){const details=node('details');details.append(node('summary','관측 근거'));
   for(const text of ['조회 시각 (UTC): '+snapshot.queriedAt,'네트워크 식별: '+r.networkIdentity,'원문 SHA-256: '+snapshot.sourceHash,'SQL 검토: '+(snapshot.sqlReviewStatus??'EXACT_SQL'),r.state==='INCONCLUSIVE'?'공급자 LEFT JOIN 미일치 · 기능 부재 인증 아님':r.state==='MISSING'?'해당 날짜 행 미확보':kind==='supply'?'공급자 isNative: '+r.point.isNative:'조정 전송량 제공: '+r.point.values.hasAdjusted]){const p=node('p',text);p.className='reviewed-source-hash';details.append(p);}evidence.append(details);
  }else evidence.textContent='미확보';tr.append(evidence);body.append(tr);
 }
}
