import {browserData} from './browser-data.js';
export function cacheStatusText(row,now=Date.now()){
 if(row.state==='fresh'&&row.hasData&&row.expiresAt!==null&&row.expiresAt<=now)row={...row,state:'stale'};
 const saved=row.storedAt===null?'':` · 브라우저 저장 ${new Date(row.storedAt).toLocaleString('ko-KR',{hour12:false})}`;
 if(row.state==='rate-limited')return `${row.label}: 요청 제한(429)${row.hasData?' · 마지막 정상 자료 표시':''}${saved}${row.retryAt?` · ${new Date(row.retryAt).toLocaleString('ko-KR',{hour12:false})} 이후 다시 조회 가능`:''}`;
 if(row.state==='refreshing')return '';
 if(row.hasData&&['stale','error','cancelled'].includes(row.state))return `${row.label}: 오래된 캐시 · ${row.state==='error'?'갱신 실패 · 마지막 정상 자료 표시':'마지막 정상 자료 표시'}${saved}`;
 if(row.hasData&&!row.persistent)return `${row.label}: 브라우저 저장소를 사용할 수 없어 이번 탭의 정상 자료만 유지합니다.`;
 return '';
}
export function cacheStatusPresentation(rows,now=Date.now()){
 const stale=row=>row.hasData&&(row.state==='stale'||row.state==='fresh'&&row.expiresAt!==null&&row.expiresAt<=now);
 const warnings=rows.filter(row=>!stale(row)).map(row=>cacheStatusText(row,now)).filter(Boolean);
 if(warnings.length)return {kind:'warning',text:warnings.join(' · ')};
 if(rows.some(row=>['loading','refreshing'].includes(row.state)))return {kind:'progress',text:'최신 자료 확인 중'};
 if(rows.some(stale))return {kind:'stale',text:'저장 자료 표시 · 업데이트 필요'};
 return {kind:'idle',text:''};
}
export function bindCacheStatus(root,matches){
 const note=document.createElement('p');note.className='chart-note browser-cache-status';note.setAttribute('role','status');note.hidden=true;root.before(note);
 const compact=document.createElement('span');compact.className='browser-cache-compact';compact.dataset.cacheFor=root.id;compact.setAttribute('role','status');compact.setAttribute('aria-atomic','true');compact.hidden=true;
 const header=root.querySelector('.page-header')??root.closest('[id$="-screen"]')?.querySelector('.page-header');
 const anchor=header?.querySelector('.header-actions')??root;anchor.classList.add('browser-cache-anchor');let indicators=anchor.querySelector(':scope > .browser-cache-indicators');if(!indicators){indicators=document.createElement('span');indicators.className='browser-cache-indicators';anchor.append(indicators);}indicators.append(compact);
 const render=()=>{const view=cacheStatusPresentation(browserData.states().filter(r=>matches(r.url))),hidden=!!root.closest('[hidden]');note.textContent=view.kind==='warning'?view.text:'';note.hidden=hidden||view.kind!=='warning';compact.textContent=view.kind==='warning'?'':view.kind==='progress'&&root.dataset.loading==='refresh'?'이전 자료 표시 · 최신 자료 확인 중':view.text;compact.dataset.state=view.kind;compact.hidden=hidden||view.kind==='warning'||view.kind==='idle';};
 browserData.subscribe(render);document.addEventListener('atlas:navigate',render);window.addEventListener('hashchange',render);render();return note;
}
