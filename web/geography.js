import {geographyStates,geographyBalanceRows} from './geography-model.js';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function initializeGeographyFilters(root,render){for(const s of root.querySelectorAll('select'))s.addEventListener('change',render);}
export function renderGeography(root,{data,state}){
 const status=root.querySelector('[role="status"]'),body=root.querySelector('[data-geography-availability]');body.replaceChildren();
 status.textContent=state==='LAST_GOOD'?'저장본 읽기 실패 · 마지막 확인 상태':state==='UNAVAILABLE'?'저장된 지리 자료 확인 상태를 읽지 못했습니다.':data?.state==='OBSERVED'?`공급자 추정 지리별 잔액 · ${data.observations}행 관측`:data?.state==='MISSING'?'조회 완료 · 고정 기준일·대상에 해당하는 저장 행 미확보':data?.state==='UNKNOWN'?'현재 계정의 지리 자료 미확보 · 추가 수집 중단':'저장된 지리 자료가 없습니다.';
 if(data?.lastFailure&&!['LAST_GOOD','UNAVAILABLE'].includes(state))status.textContent='최근 조회 실패 · 마지막 저장 잔액 표시';
 if(!data)return;
 for(const m of data.metrics){const tr=node('tr'),th=node('th',geographyStates[m.metric]);th.scope='row';tr.append(th,node('td',m.schemaState==='PUBLIC_SCHEMA_REVIEWED'?'공식 잔액 스키마 확인':'세부 스키마 미확인'),node('td',m.dataState==='OBSERVED'?'관측':m.state==='INCONCLUSIVE'?'미확보 · 조회 실패':'미확보'));body.append(tr);}
 const checked=root.querySelector('[data-geography-checked]');checked.textContent=data.checkedAt?(data.attemptKind==='balances'?'국가별 잔액 조회 시도 (UTC): ':'계정 스키마 확인 시도 (UTC): ')+data.checkedAt:'계정 스키마 확인 미실행';
 root.querySelector('[data-geography-reason]').textContent=data.reason==='PROVIDER_RUN_FAILED'?'공급자 조회 실행이 failed로 종료됐습니다. 상세 사유와 계정 권한은 미확인입니다.':data.state==='UNKNOWN'?'조회 또는 근거를 확인하지 못했습니다. 기능 부재를 뜻하지 않습니다.':data.balanceSnapshot?'고정 11개 배포 · 공급자가 지리를 귀속한 지갑의 보유 잔액만 포함합니다. 국가 전체 보유량·결제량·전송량으로 해석하지 않습니다.':'국가·지역별 실제 데이터 관측은 아직 없습니다.';
 const snapshot=data.balanceSnapshot,section=root.querySelector('[data-geography-balances]');section.hidden=!snapshot;
 if(!snapshot)return;
 for(const [key,values]of [['coin',[...new Set(snapshot.rows.map(r=>r.coinId))]],['network',[...new Set(snapshot.rows.map(r=>r.networkId))]],['country',[...new Set(snapshot.rows.map(r=>r.country??'__UNKNOWN__'))]]]){
  const select=root.querySelector(`[data-geography-${key}]`),value=select.value;select.replaceChildren();const all=node('option','전체');all.value='all';select.append(all);
  for(const v of values.sort()){const o=node('option',v==='__UNKNOWN__'?'국가 미확보':key==='country'?v:v.toUpperCase());o.value=v;select.append(o);}select.value=values.includes(value)?value:'all';
 }
 const rows=geographyBalanceRows(snapshot,Object.fromEntries(['coin','network','country'].map(k=>[k,root.querySelector(`[data-geography-${k}]`).value]))),host=root.querySelector('[data-geography-balance-rows]');host.replaceChildren();
 for(const r of rows){const tr=node('tr'),th=node('th',r.country??'국가 미확보');th.scope='row';tr.append(th,...[r.region??'지역 미확보',r.coinId.toUpperCase(),r.networkId.toUpperCase(),r.balance??'—',r.usdBalance??'—',snapshot.day].map(v=>node('td',v)));host.append(tr);}
 if(!rows.length){const tr=node('tr'),td=node('td','선택 범위의 저장 행이 없습니다.');td.colSpan=7;tr.append(td);host.append(tr);}
 root.querySelector('[data-geography-evidence]').textContent=`표시 ${rows.length}행 / 관측 ${snapshot.rows.length}행 · 기준일 (UTC): ${snapshot.day} · 조회 (UTC): ${snapshot.queriedAt} · 원문 SHA-256: ${snapshot.sourceHash} · SQL: SOURCE_REVIEWED. — 필드 null. 저장 행 미확보 배포: ${snapshot.missingDeployments.join(', ')||'없음'}. 누락된 국가·배포를 0으로 채우지 않습니다.`;
}
