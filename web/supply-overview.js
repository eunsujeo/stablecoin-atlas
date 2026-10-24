import {overviewCoins,readOverviewHistories,overviewSupplyGroups,legacyOverviewDetails,overviewNetworkRanking,supplyQuantityLabel} from './supply-overview-model.js';
import {exactDecimal} from './market-model.js';
import {sameRegisteredSource} from './registration-model.js';
import {renderNetworkSupplyChart} from './market-chart.js';
const colors={usdc:'#638bff',usdt:'#22a98b',rlusd:'#b17de0',jpysc:'#dc9638',jpyc:'#de6884'};
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const networkColors={ethereum:'#547aef',solana:'#149b91',tron:'#8b5cba',xrpl:'#cc8d28',polygon:'#527e31',avalanche:'#d56b32',kaia:'#ba5874',base:'#8959cd',arbitrum:'#cf5d78',bsc:'#b17a19',stellar:'#8b6983','hyperliquid-l1':'#be8331',arc:'#387a96',plasma:'#187c72',ton:'#9a5c35',aptos:'#9465a5',mantle:'#88862a'};
export function initializeSupplyOverview(root,{read}){
 let details=[],index=null,currency='USD',period='1y',comparison='amount',failed=false,loading=false,sequence=0;
 const hidden=new Set(),selectedCoins={USD:'usdc',JPY:'jpysc'};
 function render(){
  const focus=root.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
  const {groups:allGroups,from,to}=overviewSupplyGroups(details,{period});
  const coins=overviewCoins.filter(id=>currency==='USD'?['usdc','usdt','rlusd'].includes(id):['jpysc','jpyc'].includes(id));
  const selectedCoin=selectedCoins[currency],groups=allGroups.filter(g=>g.coinId===selectedCoin);
  for(const group of groups){group.color=networkColors[group.networkId]??'#638bff';group.dash='';group.network.name=index?.networks.find(n=>n.id===group.networkId)?.name??group.networkId.toUpperCase();}
  root.hidden=false;root.replaceChildren();
  const heading=node('div',undefined,'panel-heading'),title=node('div');title.append(node('p','STABLECOIN SUPPLY','eyebrow'),node('h2',selectedCoin.toUpperCase()+' · 네트워크별 공급량 추이'),node('p','DeFiLlama · '+currency+' 연동 · 체인별 일별 유통량 (tokens)','chart-note'));
  const switches=node('div',undefined,'supply-switches');
  const buttons=(label,options,value,change,target=switches)=>{const box=node('div',undefined,'chart-filters');box.setAttribute('role','group');box.setAttribute('aria-label',label);for(const [id,text]of options){const b=node('button',text);b.type='button';b.setAttribute('aria-label',label+' · '+text);b.setAttribute('aria-pressed',String(value===id));b.addEventListener('click',()=>{change(id);render();});box.append(b);}target.append(box);};
  buttons('조회 기간',[['30d','30D'],['90d','3M'],['1y','1Y']],period,v=>period=v);
  buttons('비교 방식',[['amount','공급량 규모'],['change','증감률 (%)']],comparison,v=>comparison=v);
  heading.append(title,switches);root.append(heading);
  const status=node('p',loading?'저장된 1년 자료 읽는 중…':failed?'일부 저장 자료 읽기 실패 · 같은 출처의 이전 정상 자료만 유지합니다.':'','chart-note');status.setAttribute('role','status');root.append(status);
  const coinButtons=node('div',undefined,'supply-coins');coinButtons.setAttribute('role','group');coinButtons.setAttribute('aria-label','토큰 하나 선택');
  for(const id of coins){const available=allGroups.some(g=>g.coinId===id),b=node('button',id.toUpperCase(),'supply-coin');b.type='button';b.style.setProperty('--coin-color',colors[id]);b.setAttribute('aria-label',id.toUpperCase()+' 선택');b.disabled=!available;b.setAttribute('aria-pressed',String(id===selectedCoin));b.addEventListener('click',()=>{selectedCoins[currency]=id;render();});coinButtons.append(b);}
  const selection=node('div',undefined,'supply-selection'),currencyTabs=node('div',undefined,'supply-currency-tabs');
  buttons('연동 통화',[['USD','USD'],['JPY','JPY']],currency,v=>currency=v,currencyTabs);
  selection.append(currencyTabs,coinButtons);root.append(selection);
  const layout=node('div',undefined,'supply-comparison-layout'),plot=node('div',undefined,'supply-combined-plot'),ranking=node('aside',undefined,'supply-network-ranking');
  ranking.setAttribute('aria-label',selectedCoin.toUpperCase()+' 네트워크별 공급량 순위');layout.append(plot,ranking);root.append(layout);
  const visible=groups.filter(g=>!hidden.has(g.key));
  if(visible.length){renderNetworkSupplyChart(plot,{registeredSupply:true,updatedAt:visible.map(g=>g.updatedAt).filter(Boolean).sort().at(-1)},null,{groups:visible,period,comparison,source:'history',showLegend:false,compactWidth:460,tall:true,amountLabel:supplyQuantityLabel,domain:[from+'T00:00:00Z',to+'T00:00:00Z']});}
  else plot.append(node('p',groups.length?'오른쪽 순위에서 표시할 네트워크를 선택하세요.':loading?'저장 자료를 읽고 있습니다.':'선택한 토큰의 일별 유통량 저장 자료가 없습니다.','empty-state'));
  ranking.append(node('h3','네트워크별 공급량'),node('p','최신 관측 · '+selectedCoin.toUpperCase()+' tokens','chart-note'));
  const list=node('ol',undefined,'supply-rank-list');
  const emphasize=key=>{if(hidden.has(key))key=null;for(const path of plot.querySelectorAll('[data-network]')){path.style.opacity=key&&path.dataset.network!==key?'.18':'1';path.style.strokeWidth=key&&path.dataset.network===key?'4':'2.5';}};
  for(const group of overviewNetworkRanking(groups)){
   const item=node('li'),button=node('button',undefined,'supply-rank-button');button.type='button';button.dataset.series=group.key;button.style.setProperty('--network-color',group.color);button.setAttribute('aria-label',group.network.name+' · '+exactDecimal(group.last.amount)+' tokens · '+group.last.observedAt.slice(0,10));button.setAttribute('aria-pressed',String(!hidden.has(group.key)));
   button.title=exactDecimal(group.last.amount)+' tokens · 기준일 '+group.last.observedAt.slice(0,10)+' · 조회 '+group.updatedAt;
   const top=node('span',undefined,'supply-rank-top'),identity=node('span',undefined,'supply-rank-identity'),dot=node('span',undefined,'supply-rank-dot');dot.setAttribute('aria-hidden','true');identity.append(node('span',String(group.rank),'supply-rank-number'),dot,node('span',group.network.name,'supply-rank-name'));
   top.append(identity,node('strong',supplyQuantityLabel(group.last.amount),'supply-rank-amount'));
   const bar=node('span',undefined,'supply-rank-track'),fill=node('span');fill.style.width=group.width+'%';bar.setAttribute('aria-hidden','true');bar.append(fill);
   const day=node('time',group.last.observedAt.slice(0,10),'supply-rank-day');day.dateTime=group.last.observedAt.slice(0,10);const bottom=node('span',undefined,'supply-rank-bottom');bottom.append(bar,day);button.append(top,bottom);item.append(button);list.append(item);
   button.addEventListener('click',()=>{hidden.has(group.key)?hidden.delete(group.key):hidden.add(group.key);render();});
   for(const event of ['pointerenter','focus'])button.addEventListener(event,()=>emphasize(group.key));for(const event of ['pointerleave','blur'])button.addEventListener(event,()=>emphasize(null));
  }
  ranking.append(list,node('p','공급량 내림차순 · 클릭하면 그래프 표시 전환. 막대는 최대 관측값 대비 길이입니다.','chart-note'));
  if(from&&groups.length)root.append(node('p',from+' ~ '+to+' · 공통 조회 기간 / 실제 마지막 관측 '+groups.flatMap(g=>g.rows.map(r=>r.observedAt.slice(0,10))).sort().at(-1),'chart-note'));
  root.append(node('p','색상은 네트워크입니다. 순위에 마우스를 올리거나 키보드로 이동하면 해당 선을 강조합니다. '+currency+' 연동 토큰의 수량이며 가치 비교나 전체 합계가 아닙니다.','chart-note'),node('p','증감률은 선택 기간 내 각 계열의 첫 관측 대비입니다. 출시 시점·자료 범위에 따라 실제 관측 기간이 다르며 누락 날짜는 연결하지 않습니다. 발행·소각량이나 계약 totalSupply를 뜻하지 않습니다.','chart-note'));
  if(focus)[...root.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focus)?.focus({preventScroll:true});
 }
 let observedWidth=0;
 const observer=new ResizeObserver(([entry])=>{const width=Math.round(entry.contentRect.width);if(width!==observedWidth){observedWidth=width;if(details.length)requestAnimationFrame(render);}});observer.observe(root);
 return async ({index:next,market,indexFailed})=>{
  const run=++sequence;
  if(indexFailed){failed=true;loading=false;render();return;}
  const previous=details;index=next;
  // A new index cannot display stale selections while its own reads are pending.
  details=next?previous.filter(d=>sameRegisteredSource(d,next,{coinId:d.coinId,metric:'NETWORK_CIRCULATING'})):[];failed=false;loading=true;render();
  const result=next?await readOverviewHistories(next,read,previous):{details:legacyOverviewDetails(market),failed:false};
  if(run!==sequence)return;
  details=result.details;failed=result.failed;loading=false;render();
 };
}
