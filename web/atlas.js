import {validateMarket,displayAmount} from './market-model.js';
import {overviewMarketRows} from './overview-market-model.js';
import {renderNetworkSupplyChart} from './market-chart.js';
import {validateActivity} from './activity-model.js';
import './atlas-evidence.js';

const $=s=>document.querySelector(s);
const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const state={market:null,activity:null,activityStatus:'MISSING',coin:'usdc',period:'30d',sort:'supply',loading:false};
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
function chart(){
 if(!state.market){$('#supply-chart').replaceChildren(element('p','저장된 공급량 자료가 없습니다.','empty-state'));return;}
 renderNetworkSupplyChart($('#supply-chart'),state.market,state.coin,{period:state.period,source:'recent'});
}
function renderMarket(){
 const rows=state.market?overviewMarketRows(state.market,null):[];
 const options=rows.map(row=>{const option=element('option',row.coin.symbol);option.value=row.coin.id;return option;});
 $('#coin').replaceChildren(...options);
 if(!rows.some(r=>r.coin.id===state.coin))state.coin=rows[0]?.coin.id??'usdc';
 $('#coin').value=state.coin;$('#coin').disabled=!rows.length;
 if(state.sort==='name')rows.sort((a,b)=>a.pegCurrency.localeCompare(b.pegCurrency)||a.coin.symbol.localeCompare(b.coin.symbol));
 const list=$('#coin-list');list.replaceChildren();let currency;
 for(const row of rows){
  if(currency!==row.pegCurrency){currency=row.pegCurrency;const group=element('p',currency+' 연동');group.className='coin-group';list.append(group);}
  const button=element('button');button.className='coin-row';button.setAttribute('aria-pressed',String(row.coin.id===state.coin));
  const identity=element('span');identity.append(element('strong',row.coin.symbol),element('small',row.coin.name));
  const quantity=element('span',row.circulating?displayAmount(row.circulating.amount):'—');quantity.className='quantity';quantity.append(element('small','tokens'));
  button.append(identity,quantity);button.title=row.circulating?'원래 수량 '+row.circulating.amount+' tokens · 공급자 기준 '+when(row.circulating.observedAt)+' · 요청 '+when(row.circulating.fetchedAt):'유통량 미확보';
  button.addEventListener('click',()=>{state.coin=row.coin.id;renderMarket();});list.append(button);
 }
 if(!rows.length)list.append(element('p','저장된 유통량 자료 없음'));
 const prices=$('#price-rows');prices.replaceChildren();
 for(const row of rows){const tr=element('tr'),name=element('th',row.coin.symbol);name.scope='row';tr.append(name);for(const value of [row.price?.amount??'—',when(row.price?.observedAt),when(row.price?.fetchedAt),row.price?'Arkham':'—'])tr.append(element('td',value));prices.append(tr);}
 if(!rows.length){const tr=element('tr'),td=element('td','저장된 가격 자료가 없습니다.');td.colSpan=5;tr.append(td);prices.append(tr);}
 chart();
}
function renderActivity(){
 const host=$('#activity-rows');host.replaceChildren();
 for(const series of state.activity?.series??[]){
  const point=series.points.at(-1),tr=element('tr'),name=element('th',series.coinId.toUpperCase());name.scope='row';tr.append(name);
  for(const value of [point.volume,point.volumeUSD,point.transfers,point.day])tr.append(element('td',value));
  const details=element('details'),summary=element('summary','관측 근거');details.append(summary,element('p','조회 '+when(point.queriedAt)),element('p','원문 SHA-256 '+point.sourceHash));tr.lastChild.append(details);host.append(tr);
 }
 if(!state.activity?.series.length){const tr=element('tr'),td=element('td',state.activityStatus==='DISABLED'?'이 서버에서 전송량 읽기가 설정되어 있지 않습니다.':'저장된 전송량 자료가 없습니다.');td.colSpan=5;tr.append(td);host.append(tr);}
 $('#activity-state').textContent={MISSING:'저장 자료 없음',DISABLED:'전송량 경로 비활성 · 현재 자료 없음',READY:'일별 저장 자료 읽음',LAST_GOOD:'조회 실패 · 마지막 정상 자료 유지',UNAVAILABLE:'전송량 조회 실패 · 저장본 다시 읽기로 재조회하세요.'}[state.activityStatus];
}
async function load(){
 if(state.loading)return;state.loading=true;$('#reload').disabled=true;$('#read-status').textContent='로컬 저장 자료 읽는 중';
 const results=await Promise.allSettled([read('/market-data.json',validateMarket),read('/activity-data.json',validateActivity)]);
 let error=false;
 const [market,activity]=results;
 if(market.status==='fulfilled'){state.market=market.value;}else{error=true;}
 if(activity.status==='fulfilled'){state.activity=activity.value;state.activityStatus=activity.value?'READY':'DISABLED';}else{state.activityStatus=state.activity?'LAST_GOOD':'UNAVAILABLE';error=true;}
 $('#read-error').hidden=!error;$('#read-error').textContent=error?'일부 저장 자료를 읽지 못했습니다. 이전에 읽은 정상 자료가 있으면 유지합니다. 저장본 다시 읽기로 재조회하세요.':'';
 renderMarket();renderActivity();
 $('#read-status').textContent=error?'일부 조회 실패 · 원래 관측 시각 유지':state.market?'저장본 조회 완료 · 자료별 기준시각은 각 표에서 확인하세요.':'시장 저장 자료 없음 · 새 수집을 실행하지 않았습니다.';
 state.loading=false;$('#reload').disabled=false;
}
function navigate(){
 const page=['supply','activity','prices','coverage','assets','compare'].includes(location.hash.slice(1))?location.hash.slice(1):'supply';
 for(const section of document.querySelectorAll('.workspace'))section.hidden=section.id!==page;
 const group=['assets','compare'].includes(page)?'coverage':page;
 for(const link of document.querySelectorAll('nav a')){if(link.hash==='#'+group)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 if(page==='supply')chart();
 window.scrollTo({top:0,behavior:'instant'});
 const heading={assets:'#profile-title',compare:'#native-compare-title',coverage:'#coverage-title'}[page];
 if(heading)$(heading).focus({preventScroll:true});
}
$('#coin').addEventListener('change',()=>{state.coin=$('#coin').value;renderMarket();});
$('#sort').addEventListener('change',()=>{state.sort=$('#sort').value;renderMarket();});
$('#periods').addEventListener('click',event=>{const button=event.target.closest('button[data-period]');if(!button)return;state.period=button.dataset.period;for(const b of $('#periods').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));chart();});
function theme(value){document.documentElement.dataset.theme=value;$('#theme').textContent=value==='dark'?'라이트 테마':'다크 테마';}
try{theme(localStorage.getItem('atlas-redesign-theme')==='light'?'light':'dark');}catch{theme('dark');}
$('#theme').addEventListener('click',()=>{const value=document.documentElement.dataset.theme==='dark'?'light':'dark';theme(value);try{localStorage.setItem('atlas-redesign-theme',value);}catch{}});
$('#reload').addEventListener('click',load);window.addEventListener('hashchange',navigate);
let width=0;new ResizeObserver(entries=>{const next=Math.round(entries[0].contentRect.width);if(next>0&&width!==next){width=next;if(!$('#supply').hidden)chart();}}).observe($('#supply-chart'));
navigate();load();
