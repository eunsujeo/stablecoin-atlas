import {validateMarket} from './market-model.js';
import {beginLoading} from './loading.js';
import {overviewMarketRows} from './overview-market-model.js';
import {initDashboard} from './atlas-dashboard.js';
import {validateActivity} from './activity-model.js';
import './atlas-evidence.js';

const $=s=>document.querySelector(s);
const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const state={market:null,marketFailed:false,activity:null,activityLoaded:false,activityStatus:'MISSING',loading:false};
const dashboard=initDashboard();
const when=value=>value?value.replace('T',' ').replace('Z',' UTC'):'미제공';
// Fixed same-origin published projections only. Raw research archives are never read.
async function read(path,validate){
 const response=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(response.status===404)return null;
 if(!response.ok)throw Error('READ_FAILED');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024)throw Error('READ_LIMIT');chunks.push(value);}}catch(error){await reader.cancel();throw error;}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return validate(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
function renderMarket(){
 const rows=state.market?overviewMarketRows(state.market,null):[];
 const prices=$('#price-rows');prices.replaceChildren();
 for(const row of rows){const tr=element('tr'),name=element('th',row.coin.symbol);name.scope='row';tr.append(name);for(const value of [row.price?.amount??'—',when(row.price?.observedAt),when(row.price?.fetchedAt)])tr.append(element('td',value));prices.append(tr);}
 if(!rows.length){const tr=element('tr'),td=element('td',state.marketFailed?'가격 자료를 읽지 못했습니다. 저장본 다시 읽기로 재조회하세요.':'저장된 가격 자료가 없습니다.');td.colSpan=4;tr.append(td);prices.append(tr);}
}
function renderActivity(){
 const host=$('#activity-rows');host.replaceChildren();
 for(const series of state.activity?.series??[]){
  const point=series.points.at(-1),tr=element('tr'),name=element('th',series.coinId.toUpperCase());name.scope='row';tr.append(name);
  for(const value of [point.volume,point.volumeUSD,point.transfers,point.day])tr.append(element('td',value));
  host.append(tr);
 }
 if(!state.activity?.series.length){const tr=element('tr'),td=element('td',state.activityStatus==='UNAVAILABLE'?'전송량 자료를 읽지 못했습니다. 저장본 다시 읽기로 재조회하세요.':state.activityStatus==='DISABLED'?'이 서버에서 전송량 읽기가 설정되어 있지 않습니다.':'저장된 전송량 자료가 없습니다.');td.colSpan=5;tr.append(td);host.append(tr);}
 $('#activity-state').textContent={MISSING:'저장 자료 없음',DISABLED:'전송량 경로 비활성 · 현재 자료 없음',READY:'일별 저장 자료 읽음',LAST_GOOD:'조회 실패 · 마지막 정상 자료 유지',UNAVAILABLE:'전송량 조회 실패 · 저장본 다시 읽기로 재조회하세요.'}[state.activityStatus];
}
async function load(){
 if(state.loading)return;state.loading=true;dashboard.loading();$('#reload').disabled=true;$('#read-status').textContent='로컬 저장 자료 읽는 중';
 const finishes=[
  beginLoading($('#supply'),{ready:!!state.market,targets:[['#supply-chart','chart'],['#network-bars','rows'],['#observation-rows','rows']]}),
  beginLoading($('#prices'),{ready:!!state.market,targets:[['#price-rows','rows']]}),
  beginLoading($('#activity'),{ready:state.activityLoaded,targets:[['#activity-rows','rows']]}),
 ];
 try {
 const results=await Promise.allSettled([read('/market-data.json',validateMarket),read('/activity-data.json',validateActivity)]);
 let error=false;
 const [market,activity]=results;
 if(market.status==='fulfilled'&&market.value){state.market=market.value;state.marketFailed=false;}else{state.marketFailed=market.status==='rejected';error=state.marketFailed||!!state.market;}
 if(activity.status==='fulfilled'){state.activity=activity.value;state.activityLoaded=true;state.activityStatus=activity.value?'READY':'DISABLED';}else{state.activityStatus=state.activity?'LAST_GOOD':'UNAVAILABLE';error=true;}
 $('#read-error').hidden=!error;$('#read-error').textContent=error?'일부 저장 자료를 읽지 못했습니다. 이전에 읽은 정상 자료가 있으면 유지합니다. 저장본 다시 읽기로 재조회하세요.':'';
 dashboard.setData(state.market,{failed:market.status==='rejected'||market.status==='fulfilled'&&market.value===null&&!!state.market});renderMarket();renderActivity();
 $('#read-status').textContent=error?'일부 조회 실패 · 원래 관측 시각 유지':state.market?'저장본 조회 완료 · 자료별 기준시각은 각 표에서 확인하세요.':'시장 저장 자료 없음 · 새 수집을 실행하지 않았습니다.';
 }finally{for(const finish of finishes)finish();state.loading=false;$('#reload').disabled=false;}
}
function navigate(){
 const page=['supply','activity','prices','coverage','assets','compare'].includes(location.hash.slice(1))?location.hash.slice(1):'supply';
 for(const section of document.querySelectorAll('.workspace'))section.hidden=section.id!==page;
 const group=['assets','compare'].includes(page)?'coverage':page;
 for(const link of document.querySelectorAll('nav a')){if(link.hash==='#'+group)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 window.scrollTo({top:0,behavior:'instant'});
 const heading={assets:'#profile-title',compare:'#compare [data-comparison-switch]',coverage:'#coverage-title'}[page];
 if(heading)$(heading).focus({preventScroll:true});
}
function theme(value){document.documentElement.dataset.theme=value;$('#theme').textContent=value==='dark'?'라이트 테마':'다크 테마';}
try{theme(localStorage.getItem('atlas-redesign-theme')==='light'?'light':'dark');}catch{theme('dark');}
$('#theme').addEventListener('click',()=>{const value=document.documentElement.dataset.theme==='dark'?'light':'dark';theme(value);try{localStorage.setItem('atlas-redesign-theme',value);}catch{}});
$('#reload').addEventListener('click',load);window.addEventListener('hashchange',navigate);
navigate();load();
