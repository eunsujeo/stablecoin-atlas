import {overviewCoins,readOverviewHistories,overviewSupplyGroups,legacyOverviewDetails,overviewNetworkRanking,supplyQuantityLabel,overviewTransferGroups,transferComposition,transferMetrics,overviewUsageRows} from './supply-overview-model.js';
import {networkUsageView} from './network-usage-model.js';
import {exactDecimal} from './market-model.js';
import {sameRegisteredSource} from './registration-model.js';
import {renderNetworkSupplyChart} from './market-chart.js';
const colors={usdc:'#638bff',usdt:'#22a98b',rlusd:'#b17de0',jpysc:'#dc9638',jpyc:'#de6884'};
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const networkColors={ethereum:'#547aef',solana:'#149b91',tron:'#8b5cba',xrpl:'#cc8d28',polygon:'#527e31',avalanche:'#d56b32',kaia:'#ba5874',base:'#8959cd',arbitrum:'#cf5d78',bsc:'#b17a19',stellar:'#8b6983','hyperliquid-l1':'#be8331',arc:'#387a96',plasma:'#187c72',ton:'#9a5c35',aptos:'#9465a5',mantle:'#88862a'};
let helpSequence=0;
function metricTitle(text,kind,field='transfer_volume'){
 const label=kind==='volume'?transferMetrics[field].label:'공급량',row=node('div',undefined,'metric-title-row'),wrap=node('span',undefined,'metric-help'),button=node('button','i','metric-help-button'),tip=node('span',kind==='volume'?transferMetrics[field].help:'선택한 토큰이 해당 네트워크에서 유통 중인 것으로 집계된 수량입니다. 날짜별 유통 잔액을 토큰 단위로 보여줍니다.','metric-help-tooltip');
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
 let details=[],index=null,currency='USD',period='1y',comparison='amount',failed=false,loading=false,sequence=0,transferDay=null,transferField='transfer_volume_usd';
 let transferSurvey={data:null,state:'DISABLED'};const usageSource='ARKHAM';
 const hidden=new Set(),hiddenTransfers=new Set(),selectedCoins={USD:'usdc',JPY:'jpysc'};
 const svg=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))n.setAttribute(key,String(value));return n;};
 function chart(plot,groups,{kind,from,to,comparison='amount',hidden,onPointSelect}){
  const visible=groups.filter(g=>!hidden.has(g.key));
  if(!visible.length){plot.append(node('p',groups.length?'목록에서 네트워크를 선택하세요.':loading?'자료 읽는 중…':'선택한 토큰의 관측값이 없습니다.','empty-state'));return;}
  renderNetworkSupplyChart(plot,{registeredSupply:true,updatedAt:visible.map(g=>g.updatedAt).filter(Boolean).sort().at(-1)},null,{groups:visible,period:kind==='volume'?'7d':period,comparison,quantityLabel:kind==='volume'?transferMetrics[transferField].label:'공급량',unit:kind==='volume'?transferMetrics[transferField].unit:'tokens',source:'history',showLegend:false,fitWidth:true,chartHeight:kind==='volume'?205:245,showLatestLabel:false,amountLabel:supplyQuantityLabel,selectedDay:kind==='volume'?transferDay:null,onPointSelect,domain:[from+'T00:00:00Z',to+'T00:00:00Z']});
 }
 function emphasize(plot,key,hidden){
  if(hidden.has(key))key=null;
  for(const path of plot.querySelectorAll('[data-network]')){path.style.opacity=key&&path.dataset.network!==key?'.18':'1';path.style.strokeWidth=key&&path.dataset.network===key?'4':'2.5';}
 }
 function rankButton(group,row,{kind,hidden,plot,rank,share}){
  const label=kind==='volume'?transferMetrics[transferField].label:'공급량',unit=group.unit??'tokens',button=node('button',undefined,'supply-rank-button');button.type='button';button.dataset.series=group.key;button.style.setProperty('--network-color',group.color);
  button.setAttribute('aria-label',label+' · '+group.network.name+' · '+exactDecimal(row.amount)+' '+unit+' · '+row.observedAt.slice(0,10));button.setAttribute('aria-pressed',String(!hidden.has(group.key)));
  button.title=exactDecimal(row.amount)+' '+unit+' · 기준일 '+row.observedAt.slice(0,10)+' · 조회 '+group.updatedAt+(group.dateBasis==='PROVIDER_DAY'?' · 공급자 집계일 · 집계 시간대 미확인':'');
  const top=node('span',undefined,'supply-rank-top'),identity=node('span',undefined,'supply-rank-identity'),dot=node('span',undefined,'supply-rank-dot');dot.setAttribute('aria-hidden','true');
  if(rank!==undefined)identity.append(node('span',String(rank),'supply-rank-number'));
  identity.append(dot,node('span',group.network.name,'supply-rank-name'));top.append(identity,node('strong',supplyQuantityLabel(row.amount),'supply-rank-amount'));button.append(top);
  if(share!==undefined){button.title+=' · 비중은 소수 둘째 자리 반올림';button.classList.add('donut-legend-entry');button.append(node('span',share===null?'—':share+'%','donut-share'));const day=node('time',row.observedAt.slice(0,10),'sr-only');day.dateTime=row.observedAt.slice(0,10);button.append(day);}
  else{const bottom=node('span',undefined,'supply-rank-bottom'),bar=node('span',undefined,'supply-rank-track'),fill=node('span');fill.style.width=group.width+'%';bar.setAttribute('aria-hidden','true');bar.append(fill);const day=node('time',row.observedAt.slice(0,10),'supply-rank-day');day.dateTime=row.observedAt.slice(0,10);bottom.append(bar,day);button.append(bottom);}
  button.addEventListener('click',()=>{hidden.has(group.key)?hidden.delete(group.key):hidden.add(group.key);render();});
  for(const event of ['pointerenter','focus'])button.addEventListener(event,()=>emphasize(plot,group.key,hidden));for(const event of ['pointerleave','blur'])button.addEventListener(event,()=>emphasize(plot,null,hidden));
  return button;
 }
 function summaryCard(container,kind,coinId,stale){
  const card=node('article',undefined,'overview-summary-card summary-'+kind);card.dataset.summary=kind;
  const heading=node('div',undefined,'summary-heading');heading.append(node('span',kind==='supply'?'공급량 1위':transferMetrics[transferField].label+' 1위'),node('span','◈','summary-icon'));
  const value=node('strong',undefined,'summary-value'),meta=node('div',undefined,'summary-meta');card.append(heading,value,meta);if(stale)card.append(node('span','이전 정상 자료','summary-stale'));container.append(card);
  return (entry,missingDay=null)=>{const row=entry?.row??entry?.last;value.replaceChildren(node('span',row?supplyQuantityLabel(row.amount):missingDay?'관측 없음':'선택 필요'));if(row)value.append(node('small',kind==='supply'||transferField==='transfer_volume'?coinId.toUpperCase():transferMetrics[transferField].unit));meta.replaceChildren(node('span',entry?.network.name??'표시 네트워크'));if(row||missingDay){const day=(row?.observedAt.slice(0,10))??missingDay,time=node('time',day);time.dateTime=day;meta.append(time);}card.title=row?exactDecimal(row.amount)+' '+(entry.unit??'tokens')+' · '+entry.network.name+' · '+row.observedAt.slice(0,10):'선택일 또는 표시 네트워크를 확인하세요.';card.setAttribute('aria-label',kind==='supply'?'표시 네트워크 중 최신 관측 공급량 최대':'선택 집계일의 표시 네트워크 중 '+transferMetrics[transferField].label+' 최대');};
 }
 function renderUsage(host,coinId,day){
  host.replaceChildren(node('h2','네트워크 전송 활동 비교'));
  const snapshot=transferSurvey.data?.snapshots.find(s=>s.survey==='volume');
  const note=node('p',(day??'선택일 없음')+' · '+(transferSurvey.data?.provider??usageSource)+' 공급자 집계일 · 집계 시간대 미확인'+(snapshot?' · 조회 '+snapshot.queriedAt:''),'chart-note');host.append(note);
  const scroll=node('div',undefined,'usage-table-scroll'),table=node('table'),caption=node('caption',coinId.toUpperCase()+' · 같은 자산·집계일의 관측값');table.append(caption);
  const head=node('tr');for(const label of ['네트워크','전송금액 (USD)','전송 건수','전송 포함 트랜잭션 수','전송 이벤트당 평균 (USD)']){const th=node('th',label);th.scope='col';head.append(th);}const thead=node('thead');thead.append(head);table.append(thead);
  const body=node('tbody');for(const r of overviewUsageRows(transferSurvey.data,coinId,day).filter(r=>!hiddenTransfers.has(r.key))){
   const tr=node('tr'),name=node('th',index?.networks.find(n=>n.id===r.networkId)?.name??r.networkId.toUpperCase());name.scope='row';if(r.state==='NOT_TESTED')name.append(node('small',r.reason==='CHAIN_NOT_LISTED'?' · 체인 목록 미확인':' · 정확 주소 미확보','chart-note'));else if(r.state==='MISSING')name.append(node('small',' · 해당일 관측 없음','chart-note'));tr.append(name);
   for(const key of ['usd','transfers','transactions','averageUSD']){const value=r[key],cell=node('td',value===null?'—':key==='averageUSD'?(r.averageBelowCent?'<0.01':exactDecimal(value)):key==='usd'?supplyQuantityLabel(value):exactDecimal(value));cell.title=value===null?'자료 미확보 또는 평균 계산 불가':key==='averageUSD'?'전송금액 '+r.usd+' USD ÷ 전송 '+r.transfers+'건 · 소수 2자리까지 표시(이하 절사)':value+(key==='usd'?' USD':'건');cell.title+=(r.queriedAt?' · 조회 '+r.queriedAt:' · 미수집')+(r.providerTime?' · 공급자 버킷 '+r.providerTime:'');tr.append(cell);}body.append(tr);
  }if(!body.children.length){const tr=node('tr'),td=node('td',overviewUsageRows(transferSurvey.data,coinId,day).length?'목록에서 네트워크를 선택하세요.':'이 출처에서 선택한 자산의 네트워크 자료가 없습니다.');td.colSpan=5;tr.append(td);body.append(tr);}table.append(body);scroll.append(table);host.append(node('p','좌우로 밀어 금액·건수·평균을 함께 확인하세요.','chart-note usage-table-hint'),scroll,node('p','평균은 공급자 평가 USD 전송금액 ÷ 전송 이벤트 수이며 소수 둘째 자리까지 표시하고 이후 자릿수는 버립니다. 중앙값·결제 객단가가 아닙니다. 전송과 트랜잭션은 봇·DEX·반복 이동을 포함할 수 있으며 사람 수·안전성을 뜻하지 않습니다. 토큰별 트랜잭션 수를 합쳐 네트워크 전체 건수로 사용하지 않습니다.','chart-note'),node('p','활성 주소·중앙값·금액대별 건수·DEX 전체 매매량·결제 분류: 자료 미확보','chart-note'));
  if(transferSurvey.data?.provider==='ARKHAM')host.append(node('p','Arkham: 토큰 수량·전송 포함 트랜잭션 수 미지원 · 조회 종료일 마지막 초의 하위 초 포함 범위 미확인','chart-note'));
  if(snapshot)host.title='출처 '+(transferSurvey.data?.provider??usageSource)+' · source SHA-256 '+snapshot.sourceHash;
 }
 function render(){
  root.setAttribute('aria-busy',String(loading));
  // Keep the initial placeholders while the registered histories are still pending.
  if(loading&&!details.length)return;
  const focused=root.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
  // Keep the page tall while chart measurement forces layout during the rebuild.
  const minHeight=root.style.getPropertyValue('min-height'),minPriority=root.style.getPropertyPriority('min-height');
  root.style.setProperty('min-height',Math.ceil(root.getBoundingClientRect().height)+'px','important');
  try{
  const {groups:allGroups,from,to}=overviewSupplyGroups(details,{period}),coins=overviewCoins.filter(id=>currency==='USD'?['usdc','usdt','rlusd'].includes(id):['jpysc','jpyc'].includes(id)),selectedCoin=selectedCoins[currency];
  if(usageSource==='ARKHAM'&&!['transfer_volume_usd','transfer_count'].includes(transferField))transferField='transfer_volume_usd';
  const groups=allGroups.filter(g=>g.coinId===selectedCoin),transfers=overviewTransferGroups(transferSurvey.data,selectedCoin,transferField),hasTransfers=Object.keys(transferMetrics).some(field=>overviewTransferGroups(transferSurvey.data,selectedCoin,field).groups.length)||!!transferSurvey.data?.snapshots.find(s=>s.survey==='volume');
  for(const group of [...groups,...transfers.groups]){group.color=networkColors[group.networkId]??'#638bff';group.dash='';group.network.name=index?.networks.find(n=>n.id===group.networkId)?.name??group.networkId.toUpperCase();}
  root.hidden=false;root.replaceChildren();root.classList.add('balanced-overview');
  const toolbar=node('div',undefined,'overview-toolbar'),selection=node('div',undefined,'supply-selection'),currencyTabs=node('div',undefined,'supply-currency-tabs'),coinButtons=node('div',undefined,'supply-coins');
  const buttons=(label,options,value,change,target)=>{const box=node('div',undefined,'chart-filters');box.setAttribute('role','group');box.setAttribute('aria-label',label);for(const [id,text]of options){const b=node('button',text);b.type='button';b.setAttribute('aria-label',label+' · '+text);b.setAttribute('aria-pressed',String(id===value));b.addEventListener('click',()=>{change(id);render();});box.append(b);}target.append(box);};
  buttons('연동 통화',[['USD','USD'],['JPY','JPY']],currency,v=>currency=v,currencyTabs);coinButtons.setAttribute('role','group');coinButtons.setAttribute('aria-label','토큰 하나 선택');
  for(const id of coins){const b=node('button',id.toUpperCase(),'supply-coin');b.type='button';b.style.setProperty('--coin-color',colors[id]);b.setAttribute('aria-label',id.toUpperCase()+' 선택');b.disabled=!allGroups.some(g=>g.coinId===id)&&!Object.keys(transferMetrics).some(field=>overviewTransferGroups(transferSurvey.data,id,field).groups.length);b.setAttribute('aria-pressed',String(id===selectedCoin));b.addEventListener('click',()=>{selectedCoins[currency]=id;render();});coinButtons.append(b);}
  selection.append(currencyTabs,coinButtons);toolbar.append(selection,node('span',selectedCoin.toUpperCase()+' / '+currency,'overview-token-label'));root.append(toolbar);
  const status=node('p',loading?'저장 자료 읽는 중…':failed?details.length?'저장 자료 읽기 실패 · 이전 정상 자료 표시':'저장 자료 읽기 실패':'','chart-note overview-load-status');status.setAttribute('role','status');root.append(status);if(!transferSurvey.data)root.append(node('p',usageSource+' 활동 자료 '+(transferSurvey.state==='UNAVAILABLE'?'조회 실패':'미연결 또는 미확보')+' · 다른 출처로 자동 전환하지 않습니다.','chart-note'));
  const summaries=node('div',undefined,'overview-summary-grid');root.append(summaries);
  if(groups.length){const update=summaryCard(summaries,'supply',selectedCoin,failed);update(overviewNetworkRanking(groups.filter(g=>!hidden.has(g.key)))[0]);}
  let updateTransferSummary;
  if(hasTransfers)updateTransferSummary=summaryCard(summaries,'volume',selectedCoin,transferSurvey.state==='LAST_GOOD');
  const supplyRow=node('section',undefined,'overview-metric-row');supplyRow.dataset.metric='supply';supplyRow.setAttribute('aria-label',selectedCoin.toUpperCase()+' 공급량');
  const supplyCard=node('article',undefined,'overview-card overview-trend-card'),supplyHeader=node('div',undefined,'overview-card-heading'),switches=node('div',undefined,'supply-switches'),supplyPlot=node('div',undefined,'supply-combined-plot overview-chart-plot');
  supplyHeader.append(metricTitle('공급량 추이','supply'));buttons('조회 기간',[['30d','30D'],['90d','3M'],['1y','1Y']],period,v=>period=v,switches);buttons('비교 방식',[['amount','공급량 규모'],['change','증감률 (%)']],comparison,v=>comparison=v,switches);supplyHeader.append(switches);supplyCard.append(supplyHeader,supplyPlot);
  const ranking=node('aside',undefined,'overview-card supply-network-ranking');ranking.setAttribute('aria-label',selectedCoin.toUpperCase()+' 네트워크별 공급량 순위');const rankHeading=node('div',undefined,'overview-rank-heading');rankHeading.append(node('h3','네트워크별 공급량'),node('span',groups.length+'개','overview-network-count'));ranking.append(rankHeading,node('p','최신 관측 · '+selectedCoin.toUpperCase()+' tokens','chart-note'));
  const rankList=node('ol',undefined,'supply-rank-list');for(const group of overviewNetworkRanking(groups)){const item=node('li');item.append(rankButton(group,group.last,{kind:'supply',hidden,plot:supplyPlot,rank:group.rank}));rankList.append(item);}ranking.append(rankList);supplyRow.append(supplyCard,ranking);root.append(supplyRow);
  chart(supplyPlot,groups,{kind:'supply',from,to,comparison,hidden});
  if(hasTransfers){
   const row=node('section',undefined,'overview-metric-row overview-transfer-row supply-volume-section');row.dataset.metric='volume';row.setAttribute('aria-label',selectedCoin.toUpperCase()+' '+transferMetrics[transferField].label);
   const card=node('article',undefined,'overview-card overview-trend-card'),header=node('div',undefined,'overview-card-heading'),window=node('span','7D','supply-volume-window'),plot=node('div',undefined,'supply-combined-plot overview-chart-plot');window.title=transfers.from+' ~ '+transfers.to;header.append(metricTitle(transferMetrics[transferField].label+' 추이','volume',transferField),window);card.append(header);
   buttons('전송 활동 지표',Object.entries(transferMetrics).filter(([id])=>usageSource!=='ARKHAM'||['transfer_volume_usd','transfer_count'].includes(id)).map(([id,m])=>[id,m.label]),transferField,v=>transferField=v,card);
   if(transferSurvey.state==='LAST_GOOD'){const warning=node('p','전송량 읽기 실패 · 이전 정상 자료 표시','chart-note');warning.setAttribute('role','status');card.append(warning);}card.append(plot);
   const donut=node('aside',undefined,'overview-card overview-donut-card supply-network-ranking');donut.setAttribute('aria-label',selectedCoin.toUpperCase()+' 표시 네트워크의 관측 '+transferMetrics[transferField].label+' 비중');row.append(card,donut);root.append(row);
   const usage=node('section',undefined,'overview-card overview-usage');usage.setAttribute('aria-label','네트워크 전송 활동 비교');root.append(usage);
   const updateComposition=()=>{
    const view=transferComposition(transfers.groups,transferDay??(usageSource==='ARKHAM'?transfers.to:null),hiddenTransfers);if(transferDay===null)transferDay=view.day;
    renderUsage(usage,selectedCoin,view.day);
    updateTransferSummary(view.entries.find(e=>!e.hidden),view.state==='MISSING'?view.day:null);
    donut.replaceChildren();const top=node('div',undefined,'overview-donut-heading');top.append(node('h3','네트워크 비중'));const day=node('time',view.day??'','donut-date');if(view.day)day.dateTime=view.day;top.append(day);donut.append(top,node('p','표시 네트워크의 관측 '+transferMetrics[transferField].label+' · '+view.entries.filter(e=>!e.hidden).length+'/'+overviewUsageRows(transferSurvey.data,selectedCoin,view.day).length+'곳 관측 · 숨김 '+view.entries.filter(e=>e.hidden).length+'곳','donut-scope'));
    const latest=transferComposition(transfers.groups).day;if(latest&&view.day!==latest){const reset=node('button','최근일','donut-latest');reset.type='button';reset.setAttribute('aria-label','전송량 최신일 선택');reset.addEventListener('click',()=>{transferDay=latest;updateComposition();});top.append(reset);}
    const figure=node('div',undefined,'overview-donut'),ring=svg('svg',{viewBox:'0 0 180 180',role:'img','aria-label':view.day+' · 표시 네트워크 '+transferMetrics[transferField].label+' 비중'});ring.append(svg('circle',{cx:90,cy:90,r:68,fill:'none',stroke:'var(--track)','stroke-width':17}));
    let offset=0;for(const entry of view.entries.filter(e=>!e.hidden&&e.arc>0)){const slice=svg('circle',{cx:90,cy:90,r:68,fill:'none',stroke:entry.color,'stroke-width':17,pathLength:100,'stroke-dasharray':entry.arc+' '+(100-entry.arc),'stroke-dashoffset':-offset,transform:'rotate(-90 90 90)','data-share-network':entry.key});const title=svg('title',{});title.textContent=entry.network.name+' · '+exactDecimal(entry.row.amount)+' '+transferMetrics[transferField].unit+' · '+entry.share+'%';slice.append(title);ring.append(slice);offset+=entry.arc;}
    const center=node('div',undefined,'donut-center');if(view.state==='OBSERVED'){const entries=view.entries.filter(e=>!e.hidden);center.append(node('strong',entries.length===1?supplyQuantityLabel(entries[0].row.amount):selectedCoin.toUpperCase()),node('small',entries.length===1?transferMetrics[transferField].unit:entries.length+'개 네트워크'));}else center.append(node('strong',view.state==='ZERO'?'0':view.state==='FILTERED'?'선택 필요':'관측 없음'),node('small',view.state==='ZERO'?transferMetrics[transferField].unit:view.day??''));figure.append(ring,center);donut.append(figure);
    const legend=node('div',undefined,'donut-legend');for(const entry of view.entries)legend.append(rankButton(entry,entry.row,{kind:'volume',hidden:hiddenTransfers,plot,share:entry.share}));donut.append(legend);
   };
   updateComposition();
   chart(plot,transfers.groups,{kind:'volume',from:transfers.from,to:transfers.to,hidden:hiddenTransfers,onPointSelect:point=>{if(!donut.isConnected)return;transferDay=point.observedAt.slice(0,10);updateComposition();}});
  }
  if(focused)[...root.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focused)?.focus({preventScroll:true});
  }finally{if(minHeight)root.style.setProperty('min-height',minHeight,minPriority);else root.style.removeProperty('min-height');}
 }
 let observedWidth=0;const observer=new ResizeObserver(([entry])=>{const width=Math.round(entry.contentRect.width);if(width!==observedWidth){observedWidth=width;if(details.length||transferSurvey.data)requestAnimationFrame(render);}});observer.observe(root);
 return async ({index:next,market,indexFailed,usage={data:null,state:'DISABLED'}})=>{
  const run=++sequence;transferSurvey={...usage,data:usage.data?networkUsageView(usage.data):null};if(indexFailed){failed=true;loading=false;render();return;}
  const previous=details;index=next;details=next?previous.filter(d=>sameRegisteredSource(d,next,{coinId:d.coinId,metric:'NETWORK_CIRCULATING'})):[];failed=false;loading=true;render();
  const result=next?await readOverviewHistories(next,read,previous):{details:legacyOverviewDetails(market),failed:false};if(run!==sequence)return;details=result.details;failed=result.failed;loading=false;render();
 };
}
