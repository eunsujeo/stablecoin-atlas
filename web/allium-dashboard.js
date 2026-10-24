import {alliumCoins,alliumFields,alliumSeries,alliumGeometry} from './allium-dashboard-model.js';
import {exactDecimal,displayAmount,units} from './market-model.js';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const svg=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
export function initializeAlliumDashboard(root){
 let current={data:null,state:'MISSING'},coin='usdc',network='ethereum',supplyField='total_supply',volumeField='transfer_volume',trigger;
 const dialog=document.createElement('dialog');dialog.className='allium-detail';dialog.setAttribute('aria-labelledby','allium-detail-title');document.body.append(dialog);
 dialog.addEventListener('close',()=>{trigger?.isConnected&&trigger.focus();});
 const selectedFields=()=>[['supply',supplyField],['volume',volumeField]];
 function table(series,field,label,unit,detail=false){
  const scroll=node('div',undefined,'table-scroll'),table=node('table',undefined,'overview-market-table'),caption=node('caption',label+(detail?' 일별 이력':' · 체인별 마지막 저장값'),'sr-only');
  const head=node('thead'),tr=node('tr');for(const title of ['네트워크','기준일',label+' ('+unit+')']){const th=node('th',title);th.scope='col';tr.append(th);}head.append(tr);const body=node('tbody');
  for(const s of series)for(const p of detail?s.points:[s.points.at(-1)]){
   const row=node('tr'),name=node('th');name.scope='row';
   if(detail)name.textContent=s.networkId.toUpperCase();else{const b=node('button',s.networkId.toUpperCase(),'market-chart-link');b.type='button';b.setAttribute('aria-label',coin.toUpperCase()+' '+s.networkId+' 일별 상세');b.addEventListener('click',()=>openDetail(s.networkId,b));name.append(b);}
   row.append(name,node('td',p.day),node('td',exactDecimal(p.amount)));body.append(row);
  }
  table.append(caption,head,body);scroll.append(table);return scroll;
 }
 function chart(s,label,unit){
  const box=node('div',undefined,'allium-chart'),title=node('h3',s.networkId.toUpperCase()+' · '+label+' ('+unit+')');box.append(title);
  const points=s.points,figure=svg('svg',{viewBox:'0 0 630 185',role:'group','aria-label':label+' 일별 저장 추이'});
  const high=points.reduce((m,p)=>units(p.amount)>units(m)?p.amount:m,'0');
  const ceiling=svg('text',{x:35,y:18,fill:'currentColor','font-size':11});ceiling.textContent=displayAmount(high)+' '+unit;figure.append(ceiling);
  const base=svg('path',{d:'M35 20V150H595',fill:'none',stroke:'currentColor',opacity:'.2'});figure.append(base);
  for(const segment of alliumGeometry(points)){
   figure.append(svg('polyline',{points:segment.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:'currentColor','stroke-width':2}));
   for(const p of segment){const dot=svg('circle',{cx:p.x,cy:p.y,r:4,tabindex:0,'aria-label':p.day+' '+p.amount+' '+unit});dot.append(svg('title',{}));dot.firstChild.textContent=p.day+' · '+p.amount+' '+unit;figure.append(dot);}
  }
  const start=svg('text',{x:35,y:175,fill:'currentColor','font-size':11});start.textContent=points[0].day;const end=svg('text',{x:595,y:175,'text-anchor':'end',fill:'currentColor','font-size':11});end.textContent=points.at(-1).day;figure.append(start,end);box.append(figure,node('p',points.at(-1).day+' · '+exactDecimal(points.at(-1).amount)+' '+unit,'chart-note'));return box;
 }
 function openDetail(id,button){trigger=button;network=id;renderDetail();if(!dialog.open)dialog.showModal();}
 function renderDetail(){
  if(!dialog.open&&!trigger)return;
  const header=node('div',undefined,'panel-heading'),title=node('h2',coin.toUpperCase()+' · '+network.toUpperCase());title.id='allium-detail-title';const close=node('button','닫기','quiet-button');close.type='button';close.addEventListener('click',()=>dialog.close());header.append(title,close);dialog.replaceChildren(header);
  for(const [kind,field]of selectedFields()){
   const series=alliumSeries(current.data,coin,kind,field).filter(s=>s.networkId===network);if(!series.length)continue;
   const [,label,unit]=alliumFields[kind].find(f=>f[0]===field),section=node('section');section.append(node('h3',label),table(series,field,label,unit,true),node('p','Allium 조회 시각 (UTC) '+series[0].queriedAt,'chart-note'));dialog.append(section);
  }
 }
 function render(){
  const focused=root.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
  const coins=alliumCoins(current.data);root.hidden=!coins.length;
  if(!coins.length){if(dialog.open)dialog.close();root.replaceChildren();return;}
  if(!coins.includes(coin))coin=coins[0];
  const status=node('p',current.state==='LAST_GOOD'?'저장본 읽기 실패 · 이전 정상 자료 표시':'Allium · 저장된 관측','chart-note');status.setAttribute('role','status');
  const header=node('div',undefined,'panel-heading'),heading=node('div');heading.append(node('h2','공급량과 전송 활동'),status);
  const controls=node('div',undefined,'allium-controls');
  const choose=(label,options,value,onChange)=>{const wrap=node('label',undefined,'market-select');wrap.append(node('span',label));const select=node('select');select.setAttribute('aria-label',label);for(const [id,text]of options){const option=node('option',text);option.value=id;select.append(option);}select.value=value;select.addEventListener('change',()=>{onChange(select.value);render();});wrap.append(select);controls.append(wrap);return select;};
  choose('코인',coins.map(c=>[c,c.toUpperCase()]),coin,v=>{coin=v;if(dialog.open)dialog.close();});
  for(const kind of ['supply','volume']){const fields=alliumFields[kind].filter(([f])=>alliumSeries(current.data,coin,kind,f).length);if(!fields.length)continue;let field=kind==='supply'?supplyField:volumeField;if(!fields.some(f=>f[0]===field))field=fields[0][0];if(kind==='supply')supplyField=field;else volumeField=field;choose(kind==='supply'?'공급량 지표':'전송 지표',fields.map(([id,label])=>[id,label]),field,v=>{if(kind==='supply')supplyField=v;else volumeField=v;});}
  const networks=[...new Set(selectedFields().flatMap(([kind,field])=>alliumSeries(current.data,coin,kind,field).map(s=>s.networkId)))];if(!networks.includes(network))network=networks[0];choose('차트 네트워크',networks.map(n=>[n,n.toUpperCase()]),network,v=>network=v);
  header.append(heading,controls);root.replaceChildren(header);
  const grid=node('div',undefined,'allium-grid');
  for(const [kind,field]of selectedFields()){
   const series=alliumSeries(current.data,coin,kind,field);if(!series.length)continue;
   const [,label,unit]=alliumFields[kind].find(f=>f[0]===field),section=node('section',undefined,'allium-metric'),selected=series.find(s=>s.networkId===network);
   section.append(node('h3',coin.toUpperCase()+' · '+label));if(selected)section.append(chart(selected,label,unit));
   section.append(table(series,field,label,unit),node('p','Allium 조회 시각 (UTC) '+series[0].queriedAt,'chart-note'));grid.append(section);
  }
  root.append(grid,node('p','체인별 저장값이며 코인 전체 합계로 합산하지 않습니다. 전송량은 지갑 간 이동량입니다. 기준일은 공급자 집계일이며 집계 시간대는 미확인입니다. 차트 세로축은 0부터 해당 계열 최댓값이며 수량은 아래 표에서 확인할 수 있습니다.','chart-note'));
  if(dialog.open)renderDetail();
  else if(focused)[...root.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focused)?.focus({preventScroll:true});
 }
 return value=>{current=value;render();};
}
