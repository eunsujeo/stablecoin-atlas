import {overviewCoins,readOverviewHistories,overviewSupplyGroups,legacyOverviewDetails} from './supply-overview-model.js';
import {sameRegisteredSource} from './registration-model.js';
import {renderNetworkSupplyChart} from './market-chart.js';
const colors={usdc:'#638bff',usdt:'#22a98b',rlusd:'#b17de0',jpysc:'#dc9638',jpyc:'#de6884'};
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const dashes=['','8 4','2 4','10 3 2 3','5 3','14 4','8 3 2 3 2 3','3 6','12 3 5 3','1 3'];
export function initializeSupplyOverview(root,{read}){
 let details=[],index=null,period='1y',comparison='amount',failed=false,loading=false,sequence=0;
 const hidden=new Set();
 function render(){
  const focus=root.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
  const {groups,from,to}=overviewSupplyGroups(details,{period});
  const networks=[...new Set((index?.networks??groups.map(g=>({id:g.networkId}))).map(n=>n.id))].sort();
  for(const group of groups){group.color=colors[group.coinId];group.dash=networks.indexOf(group.networkId)<dashes.length?dashes[networks.indexOf(group.networkId)]:(4+networks.indexOf(group.networkId))+' 3 2 3';}
  root.hidden=false;root.replaceChildren();
  const heading=node('div',undefined,'panel-heading'),title=node('div');title.append(node('p','STABLECOIN SUPPLY','eyebrow'),node('h2','토큰 · 네트워크별 공급량 추이'),node('p','DeFiLlama · 체인별 일별 유통량 (tokens)','chart-note'));
  const switches=node('div',undefined,'supply-switches');
  const buttons=(label,options,value,change)=>{const box=node('div',undefined,'chart-filters');box.setAttribute('role','group');box.setAttribute('aria-label',label);for(const [id,text]of options){const b=node('button',text);b.type='button';b.setAttribute('aria-label',label+' · '+text);b.setAttribute('aria-pressed',String(value===id));b.addEventListener('click',()=>{change(id);render();});box.append(b);}switches.append(box);};
  buttons('조회 기간',[['30d','30D'],['90d','3M'],['1y','1Y']],period,v=>period=v);
  buttons('비교 방식',[['amount','공급량 규모'],['change','증감률 (%)']],comparison,v=>comparison=v);
  heading.append(title,switches);root.append(heading);
  const status=node('p',loading?'저장된 1년 자료 읽는 중…':failed?'일부 저장 자료 읽기 실패 · 같은 출처의 이전 정상 자료만 유지합니다.':'','chart-note');status.setAttribute('role','status');root.append(status);
  const coinButtons=node('div',undefined,'supply-coins');coinButtons.setAttribute('role','group');coinButtons.setAttribute('aria-label','토큰 표시');
  for(const id of overviewCoins){const series=groups.filter(g=>g.coinId===id),b=node('button',id.toUpperCase(),'supply-coin');b.type='button';b.style.setProperty('--coin-color',colors[id]);b.setAttribute('aria-label',id.toUpperCase()+' 전체 네트워크');b.disabled=!series.length;b.setAttribute('aria-pressed',String(series.some(s=>!hidden.has(s.key))));b.addEventListener('click',()=>{const hide=series.some(s=>!hidden.has(s.key));for(const s of series)hide?hidden.add(s.key):hidden.delete(s.key);render();});coinButtons.append(b);}root.append(coinButtons);
  const plot=node('div',undefined,'supply-combined-plot');root.append(plot);
  const visible=groups.filter(g=>!hidden.has(g.key));
  if(visible.length){renderNetworkSupplyChart(plot,{registeredSupply:true,updatedAt:visible.map(g=>g.updatedAt).filter(Boolean).sort().at(-1)},null,{groups:visible,period,comparison,source:'history',showLegend:false,compactWidth:460,domain:[from+'T00:00:00Z',to+'T00:00:00Z']});}
  else plot.append(node('p',groups.length?'위 토큰 버튼이나 아래 범례에서 표시할 계열을 선택하세요.':loading?'저장 자료를 읽고 있습니다.':'연결된 일별 유통량 저장 자료가 없습니다.','empty-state'));
  const legend=node('div',undefined,'supply-series-legend');legend.setAttribute('role','group');legend.setAttribute('aria-label','토큰과 네트워크 범례');
  for(const group of groups){const b=node('button',undefined,'supply-series');b.type='button';b.setAttribute('aria-label',group.network.name);b.setAttribute('aria-pressed',String(!hidden.has(group.key)));b.title='실제 관측 '+group.rows[0].observedAt.slice(0,10)+' ~ '+group.rows.at(-1).observedAt.slice(0,10)+' · '+group.rows.length+'점 · 조회 '+group.updatedAt;
   const swatch=document.createElementNS('http://www.w3.org/2000/svg','svg');swatch.setAttribute('viewBox','0 0 28 10');swatch.setAttribute('aria-hidden','true');const line=document.createElementNS(swatch.namespaceURI,'path');line.setAttribute('d','M0 5H28');line.setAttribute('stroke',group.color);line.setAttribute('stroke-width','3');line.setAttribute('stroke-dasharray',group.dash);swatch.append(line);b.append(swatch,node('span',group.network.name));b.addEventListener('click',()=>{hidden.has(group.key)?hidden.delete(group.key):hidden.add(group.key);render();});legend.append(b);
  }
  root.append(legend);
  if(from)root.append(node('p',from+' ~ '+to+' · 공통 조회 기간 / 실제 마지막 관측 '+groups.flatMap(g=>g.rows.map(r=>r.observedAt.slice(0,10))).sort().at(-1),'chart-note'));
  root.append(node('p','색상은 토큰, 선 모양은 네트워크입니다. 범례를 눌러 각 선을 켜거나 끌 수 있습니다. USD·JPY 연동 토큰의 수량이며 가치 비교나 전체 합계가 아닙니다.','chart-note'),node('p','증감률은 선택 기간 내 각 계열의 첫 관측 대비입니다. 출시 시점·자료 범위에 따라 실제 관측 기간이 다르며 누락 날짜는 연결하지 않습니다. 발행·소각량이나 계약 totalSupply를 뜻하지 않습니다.','chart-note'));
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
