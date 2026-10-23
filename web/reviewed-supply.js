import {reviewedSupplyRows} from './reviewed-supply-model.js';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function renderReviewedSupply(root,{data,state},coin='all'){
 const host=root.querySelector('tbody');host.replaceChildren();
 const count=data?.series.reduce((n,s)=>n+s.points.length,0)??0;
 root.querySelector('[role="status"]').textContent={LAST_GOOD:'조회 실패 · 마지막 정상 자료',UNAVAILABLE:'자료 조회 실패',DISABLED:'DB 읽기 모드 미연결',MISSING:'저장 자료 미확보',AVAILABLE:`저장 표본 ${count}/14행`}[state];
 if(!data){const tr=node('tr'),td=node('td',state==='UNAVAILABLE'?'공급량 표본을 읽지 못했습니다. 전체 다시 읽기로 재조회하세요.':state==='DISABLED'?'DB 읽기 모드에서 저장된 표본을 볼 수 있습니다.':'저장된 공급량 표본이 없습니다.');td.colSpan=6;tr.append(td);host.append(tr);return;}
 for(const {coinId,day,point}of reviewedSupplyRows(data,coin)){
  const tr=node('tr'),th=node('th',coinId.toUpperCase());th.scope='row';tr.append(th,node('td',day));
  for(const key of ['totalSupply','circulatingSupply','adjustedCirculatingSupply'])tr.append(node('td',point===null?'미확보':point[key]===null?'—':point[key]));
  const td=node('td');
  if(point){const details=node('details');details.append(node('summary','관측 근거'));const time=node('p','조회 시각 (UTC) '+point.queriedAt),native=node('p','공급자 isNative: '+String(point.isNative)),hash=node('p','원문 SHA-256: '+point.sourceHash);hash.className='reviewed-source-hash';details.append(time,native,hash);td.append(details);}else td.textContent='미확보';
  tr.append(td);host.append(tr);
 }
}
