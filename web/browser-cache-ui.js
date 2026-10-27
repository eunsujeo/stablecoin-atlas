import {browserData} from './browser-data.js';
export function cacheStatusText(row,now=Date.now()){
 if(row.state==='fresh'&&row.hasData&&row.expiresAt!==null&&row.expiresAt<=now)row={...row,state:'stale'};
 const saved=row.storedAt===null?'':` · 브라우저 저장 ${new Date(row.storedAt).toLocaleString('ko-KR',{hour12:false})}`;
 if(row.state==='rate-limited')return `${row.label}: 요청 제한(429)${row.hasData?' · 마지막 정상 자료 표시':''}${saved}${row.retryAt?` · ${new Date(row.retryAt).toLocaleString('ko-KR',{hour12:false})} 이후 다시 조회 가능`:''}`;
 if(row.hasData&&['stale','refreshing','error','cancelled'].includes(row.state))return `${row.label}: 오래된 캐시 · ${row.state==='refreshing'?'갱신 중':row.state==='error'?'갱신 실패 · 마지막 정상 자료 표시':'마지막 정상 자료 표시'}${saved}`;
 if(row.hasData&&!row.persistent)return `${row.label}: 브라우저 저장소를 사용할 수 없어 이번 탭의 정상 자료만 유지합니다.`;
 return '';
}
export function bindCacheStatus(root,matches){
 const note=document.createElement('p');note.className='chart-note browser-cache-status';note.setAttribute('role','status');note.hidden=true;root.before(note);
 const render=()=>{const lines=browserData.states().filter(r=>matches(r.url)).map(row=>cacheStatusText(row)).filter(Boolean);note.textContent=lines.join(' · ');note.hidden=!lines.length||!!root.closest('[hidden]');};
 browserData.subscribe(render);document.addEventListener('atlas:navigate',render);window.addEventListener('hashchange',render);render();return note;
}
