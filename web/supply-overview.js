import {overviewCoins,readOverviewHistories,overviewSupplyGroups,legacyOverviewDetails,overviewNetworkRanking,supplyQuantityLabel,overviewTransferGroups} from './supply-overview-model.js';
import {exactDecimal} from './market-model.js';
import {sameRegisteredSource} from './registration-model.js';
import {renderNetworkSupplyChart} from './market-chart.js';
const colors={usdc:'#638bff',usdt:'#22a98b',rlusd:'#b17de0',jpysc:'#dc9638',jpyc:'#de6884'};
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const networkColors={ethereum:'#547aef',solana:'#149b91',tron:'#8b5cba',xrpl:'#cc8d28',polygon:'#527e31',avalanche:'#d56b32',kaia:'#ba5874',base:'#8959cd',arbitrum:'#cf5d78',bsc:'#b17a19',stellar:'#8b6983','hyperliquid-l1':'#be8331',arc:'#387a96',plasma:'#187c72',ton:'#9a5c35',aptos:'#9465a5',mantle:'#88862a'};
let helpSequence=0;
function metricTitle(text,kind){
 const label=kind==='volume'?'전송량':'공급량',row=node('div',undefined,'metric-title-row'),wrap=node('span',undefined,'metric-help'),button=node('button','i','metric-help-button'),tip=node('span',kind==='volume'?'선택한 토큰이 해당 네트워크에서 하루 동안 이동한 수량입니다. 일별 전송 활동을 토큰 단위로 보여주며, 매매 거래량·결제액과 구분합니다.':'선택한 토큰이 해당 네트워크에서 유통 중인 것으로 집계된 수량입니다. 날짜별 유통 잔액을 토큰 단위로 보여줍니다.','metric-help-tooltip');
 tip.id='metric-help-'+(++helpSequence);tip.popover='auto';tip.setAttribute('role','tooltip');button.type='button';button.setAttribute('aria-label',label+' 설명');button.setAttribute('aria-describedby',tip.id);button.setAttribute('aria-controls',tip.id);button.setAttribute('aria-expanded','false');button.popoverTargetElement=tip;let pinned=false,closeTimer;
 const show=()=>{clearTimeout(closeTimer);if(!tip.isConnected)return;if(!tip.matches(':popover-open'))tip.showPopover();const anchor=button.getBoundingClientRect(),box=tip.getBoundingClientRect();tip.style.left=Math.max(12,Math.min(anchor.left-12,innerWidth-box.width-12))+'px';const below=anchor.bottom+8+box.height<=innerHeight-12;tip.dataset.placement=below?'below':'above';tip.style.top=(below?anchor.bottom+8:Math.max(12,anchor.top-box.height-8))+'px';button.setAttribute('aria-expanded','true');};
 const hide=()=>{clearTimeout(closeTimer);if(tip.matches(':popover-open'))tip.hidePopover();button.setAttribute('aria-expanded','false');pinned=false;};
 const deferHide=()=>{clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(!pinned&&!wrap.matches(':hover')&&!tip.matches(':hover')&&!button.matches(':focus-visible'))hide();},200);};
 button.addEventListener('click',event=>{event.preventDefault();pinned=!pinned;pinned?show():hide();});
 wrap.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')show();});wrap.addEventListener('pointerleave',deferHide);tip.addEventListener('pointerenter',show);tip.addEventListener('pointerleave',deferHide);
 button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))show();});button.addEventListener('blur',()=>{pinned=false;deferHide();});wrap.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
 tip.addEventListener('toggle',()=>{const open=tip.matches(':popover-open');button.setAttribute('aria-expanded',String(open));if(!open)pinned=false;});
 wrap.append(button,tip);row.append(node('h2',text),wrap);return row;
}
export function initializeSupplyOverview(root,{read}){
 let details=[],index=null,currency='USD',period='1y',comparison='amount',failed=false,loading=false,sequence=0;
 let transferSurvey={data:null,state:'MISSING'};
 const hidden=new Set(),hiddenTransfers=new Set(),selectedCoins={USD:'usdc',JPY:'jpysc'};
 function metricLayout(container,groups,{coinId,from,to,kind,comparison='amount',hidden}){
  const quantityLabel=kind==='volume'?'전송량':'공급량';
  const layout=node('div',undefined,'supply-comparison-layout'),plot=node('div',undefined,'supply-combined-plot'),ranking=node('aside',undefined,'supply-network-ranking');
  ranking.setAttribute('aria-label',coinId.toUpperCase()+' 네트워크별 '+quantityLabel+' 순위');layout.append(plot,ranking);layout.dataset.metric=kind;container.append(layout);
  const visible=groups.filter(g=>!hidden.has(g.key));
  if(visible.length){renderNetworkSupplyChart(plot,{registeredSupply:true,updatedAt:visible.map(g=>g.updatedAt).filter(Boolean).sort().at(-1)},null,{groups:visible,period:kind==='volume'?'7d':period,comparison,quantityLabel,source:'history',showLegend:false,compactWidth:460,tall:true,amountLabel:supplyQuantityLabel,domain:[from+'T00:00:00Z',to+'T00:00:00Z']});}
  else plot.append(node('p',groups.length?'오른쪽 순위에서 표시할 네트워크를 선택하세요.':loading?'저장 자료를 읽고 있습니다.':'선택한 토큰의 일별 유통량 저장 자료가 없습니다.','empty-state'));
  ranking.append(node('h3','네트워크별 '+quantityLabel),node('p','최신 관측 · '+coinId.toUpperCase()+' tokens','chart-note'));
  const list=node('ol',undefined,'supply-rank-list');
  const emphasize=key=>{if(hidden.has(key))key=null;for(const path of plot.querySelectorAll('[data-network]')){path.style.opacity=key&&path.dataset.network!==key?'.18':'1';path.style.strokeWidth=key&&path.dataset.network===key?'4':'2.5';}};
  for(const group of overviewNetworkRanking(groups)){
   const item=node('li'),button=node('button',undefined,'supply-rank-button');button.type='button';button.dataset.series=group.key;button.style.setProperty('--network-color',group.color);button.setAttribute('aria-label',quantityLabel+' · '+group.network.name+' · '+exactDecimal(group.last.amount)+' tokens · '+group.last.observedAt.slice(0,10));button.setAttribute('aria-pressed',String(!hidden.has(group.key)));
   button.title=exactDecimal(group.last.amount)+' tokens · 기준일 '+group.last.observedAt.slice(0,10)+' · 조회 '+group.updatedAt;if(group.dateBasis==='PROVIDER_DAY')button.title+=' · 공급자 집계일 · 집계 시간대 미확인';
   const top=node('span',undefined,'supply-rank-top'),identity=node('span',undefined,'supply-rank-identity'),dot=node('span',undefined,'supply-rank-dot');dot.setAttribute('aria-hidden','true');identity.append(node('span',String(group.rank),'supply-rank-number'),dot,node('span',group.network.name,'supply-rank-name'));
   top.append(identity,node('strong',supplyQuantityLabel(group.last.amount),'supply-rank-amount'));
   const bar=node('span',undefined,'supply-rank-track'),fill=node('span');fill.style.width=group.width+'%';bar.setAttribute('aria-hidden','true');bar.append(fill);
   const day=node('time',group.last.observedAt.slice(0,10),'supply-rank-day');day.dateTime=group.last.observedAt.slice(0,10);const bottom=node('span',undefined,'supply-rank-bottom');bottom.append(bar,day);button.append(top,bottom);item.append(button);list.append(item);
   button.addEventListener('click',()=>{hidden.has(group.key)?hidden.delete(group.key):hidden.add(group.key);render();});
   for(const event of ['pointerenter','focus'])button.addEventListener(event,()=>emphasize(group.key));for(const event of ['pointerleave','blur'])button.addEventListener(event,()=>emphasize(null));
  }
  ranking.append(list);
  return layout;
 }
 function render(){
  const focus=root.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
  const {groups:allGroups,from,to}=overviewSupplyGroups(details,{period});
  const coins=overviewCoins.filter(id=>currency==='USD'?['usdc','usdt','rlusd'].includes(id):['jpysc','jpyc'].includes(id));
  const selectedCoin=selectedCoins[currency],groups=allGroups.filter(g=>g.coinId===selectedCoin),transfers=overviewTransferGroups(transferSurvey.data,selectedCoin);
  for(const group of [...groups,...transfers.groups]){group.color=networkColors[group.networkId]??'#638bff';group.dash='';group.network.name=index?.networks.find(n=>n.id===group.networkId)?.name??group.networkId.toUpperCase();}
  root.hidden=false;root.replaceChildren();
  const heading=node('div',undefined,'panel-heading'),title=node('div');title.append(node('p','STABLECOIN SUPPLY','eyebrow'),metricTitle(selectedCoin.toUpperCase()+' · 네트워크별 공급량 추이','supply'));
  const switches=node('div',undefined,'supply-switches');
  const buttons=(label,options,value,change,target=switches)=>{const box=node('div',undefined,'chart-filters');box.setAttribute('role','group');box.setAttribute('aria-label',label);for(const [id,text]of options){const b=node('button',text);b.type='button';b.setAttribute('aria-label',label+' · '+text);b.setAttribute('aria-pressed',String(value===id));b.addEventListener('click',()=>{change(id);render();});box.append(b);}target.append(box);};
  buttons('조회 기간',[['30d','30D'],['90d','3M'],['1y','1Y']],period,v=>period=v);
  buttons('비교 방식',[['amount','공급량 규모'],['change','증감률 (%)']],comparison,v=>comparison=v);
  heading.append(title,switches);root.append(heading);
  const status=node('p',loading?'저장된 1년 자료 읽는 중…':failed?'일부 저장 자료 읽기 실패 · 같은 출처의 이전 정상 자료만 유지합니다.':'','chart-note');status.setAttribute('role','status');root.append(status);
  const coinButtons=node('div',undefined,'supply-coins');coinButtons.setAttribute('role','group');coinButtons.setAttribute('aria-label','토큰 하나 선택');
  for(const id of coins){const available=allGroups.some(g=>g.coinId===id)||overviewTransferGroups(transferSurvey.data,id).groups.length>0,b=node('button',id.toUpperCase(),'supply-coin');b.type='button';b.style.setProperty('--coin-color',colors[id]);b.setAttribute('aria-label',id.toUpperCase()+' 선택');b.disabled=!available;b.setAttribute('aria-pressed',String(id===selectedCoin));b.addEventListener('click',()=>{selectedCoins[currency]=id;render();});coinButtons.append(b);}
  const selection=node('div',undefined,'supply-selection'),currencyTabs=node('div',undefined,'supply-currency-tabs');
  buttons('연동 통화',[['USD','USD'],['JPY','JPY']],currency,v=>currency=v,currencyTabs);
  selection.append(currencyTabs,coinButtons);root.append(selection);
  metricLayout(root,groups,{coinId:selectedCoin,from,to,kind:'supply',comparison,hidden});
  if(transfers.groups.length){
   const section=node('section',undefined,'supply-volume-section');section.setAttribute('aria-label',selectedCoin.toUpperCase()+' 전송량');
   const header=node('div',undefined,'panel-heading'),label=metricTitle(selectedCoin.toUpperCase()+' · 네트워크별 전송량 추이','volume'),window=node('span','7D','supply-volume-window');
   window.title=transfers.from+' ~ '+transfers.to;header.append(label,window);section.append(header);
   if(transferSurvey.state==='LAST_GOOD'){const status=node('p','전송량 읽기 실패 · 이전 정상 자료 표시','chart-note');status.setAttribute('role','status');section.append(status);}
   root.append(section);metricLayout(section,transfers.groups,{coinId:selectedCoin,from:transfers.from,to:transfers.to,kind:'volume',hidden:hiddenTransfers});
  }
  if(focus)[...root.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focus)?.focus({preventScroll:true});
 }
 let observedWidth=0;
 const observer=new ResizeObserver(([entry])=>{const width=Math.round(entry.contentRect.width);if(width!==observedWidth){observedWidth=width;if(details.length||transferSurvey.data)requestAnimationFrame(render);}});observer.observe(root);
 return async ({index:next,market,indexFailed,survey={data:null,state:'MISSING'}})=>{
  const run=++sequence;transferSurvey=survey;
  if(indexFailed){failed=true;loading=false;render();return;}
  const previous=details;index=next;
  // A new index cannot display stale selections while its own reads are pending.
  details=next?previous.filter(d=>sameRegisteredSource(d,next,{coinId:d.coinId,metric:'NETWORK_CIRCULATING'})):[];failed=false;loading=true;render();
  const result=next?await readOverviewHistories(next,read,previous):{details:legacyOverviewDetails(market),failed:false};
  if(run!==sequence)return;
  details=result.details;failed=result.failed;loading=false;render();
 };
}
