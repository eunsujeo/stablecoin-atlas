import {units, exactDecimal, displayAmount, series} from './market-model.js';
const ns='http://www.w3.org/2000/svg';
const svg=(tag,attrs={})=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
export function decimalUnits(value){const negative=value<0n;if(negative)value=-value;const scale=10n**36n,tail=String(value%scale).padStart(36,'0').replace(/0+$/,'');return (negative?'-':'')+String(value/scale)+(tail?'.'+tail:'');}
// Match source, field and scope before selecting a time window. No synthetic history.
export function chartHistory(data,observation,period='all'){
  if(!['all','24h','7d','30d'].includes(period))throw new Error('INVALID_CHART_PERIOD');
  if(!observation)return [];
  const byTime=new Map();for(const row of series(data,observation))byTime.set(Date.parse(row.observedAt),row);
  const rows=[...byTime.values()];if(!rows.length||period==='all')return rows;
  const span={'24h':86400000,'7d':7*86400000,'30d':30*86400000}[period],end=Date.parse(data.readState?.historyTo??rows.at(-1).observedAt);
  return rows.filter(row=>Date.parse(row.observedAt)>=end-span);
}
export function chartGeometry(rows,{left=32,right=870,top=28,bottom=280,zeroBaseline=false}={}){
  if(!rows.length)return {points:[],ticks:[],direction:'flat'};
  const amounts=rows.map(r=>units(r.amount)),low=amounts.reduce((a,b)=>a<b?a:b),high=amounts.reduce((a,b)=>a>b?a:b);
  const padding=high===low?(high/10000n||1n):((high-low)/10n||1n),min=zeroBaseline?0n:low>padding?low-padding:0n,max=high+padding,span=max-min||1n;
  const start=Date.parse(rows[0].observedAt),end=Date.parse(rows.at(-1).observedAt);
  const points=rows.map((row,i)=>({row,x:start===end?(left+right)/2:left+(Date.parse(row.observedAt)-start)/(end-start)*(right-left),y:bottom-Number((amounts[i]-min)*1000000n/span)/1000000*(bottom-top)}));
  const ticks=Array.from({length:5},(_,i)=>({y:bottom-i*(bottom-top)/4,amount:decimalUnits(min+span*BigInt(i)/4n)}));
  return {points,ticks,direction:amounts.at(-1)>amounts[0]?'up':amounts.at(-1)<amounts[0]?'down':'flat'};
}
const when=value=>new Date(value).toLocaleString('ko-KR',{hour12:false});
const valueLabel=(amount,unit)=>unit==='USD'?'$'+exactDecimal(amount):displayAmount(amount)+' tokens';
export function sparkline(data,observation){
  const rows=chartHistory(data,observation),g=chartGeometry(rows,{left:3,right:113,top:4,bottom:32});
  const wrap=el('span',undefined,'market-spark'),figure=svg('svg',{viewBox:'0 0 116 36',role:'img','aria-label':`${rows.length}개 저장 관측 · ${observation.metric} · ${rows.length<2?'추세 미확보':'관측 구간 추세'}`});
  figure.classList.add('trend-'+g.direction);const title=svg('title');title.textContent=`${rows.length}점 · ${rows.length?when(rows[0].observedAt)+' → '+when(rows.at(-1).observedAt):'관측 없음'} · ${observation.unit}`;figure.append(title);
  if(g.points.length>1)figure.append(svg('polyline',{points:g.points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:'currentColor','stroke-width':2}));
  if(g.points.length){const p=g.points.at(-1);figure.append(svg('circle',{cx:p.x,cy:p.y,r:2.5,fill:'currentColor'}));}
  wrap.append(figure,el('small',rows.length===0?'조회 구간 관측 없음':rows.length===1?'1점 · 추세 미확보':`저장 이력 ${rows.length}점`));return wrap;
}
export function renderMarketChart(host,data,observation,{period='all',onDetail}={}){
  host.replaceChildren();const rows=chartHistory(data,observation,period);
  if(!rows.length){host.append(el('p','선택한 지표의 저장 이력이 없습니다.','empty-state'));return;}
  const compact=host.clientWidth<600,right=compact?430:870,bottom=compact?240:280,width=compact?600:1040,height=compact?310:350;
  const unit=observation.unit,zeroBaseline=unit!=='USD',g=chartGeometry(rows,{right,bottom,zeroBaseline}),latest=rows.at(-1),heading=el('div',undefined,'trend-summary');
  heading.append(el('strong',valueLabel(latest.amount,unit),'trend-value'));
  if(rows.length>1){const delta=units(latest.amount)-units(rows[0].amount),absolute=decimalUnits(delta<0n?-delta:delta);heading.append(el('span',`관측 구간 ${delta>0n?'+':delta<0n?'−':''}${valueLabel(absolute,unit)}`,'trend-change trend-'+g.direction));}
  else heading.append(el('span','단일 관측 · 추세 미확보','trend-change'));
  heading.append(el('small','마지막 저장 '+when(latest.observedAt)));host.append(heading);
  const figure=svg('svg',{viewBox:`0 0 ${width} ${height}`,role:'group',tabindex:0,'aria-label':`${unit==='USD'?'가격':'공급량'} 저장 이력 ${rows.length}점. 좌우 화살표로 관측 선택, Home 처음, End 마지막.`});figure.classList.add('market-price-chart','trend-'+g.direction);
  const id=(host.id||'market')+'-trend-fill',defs=svg('defs'),gradient=svg('linearGradient',{id,x1:0,y1:0,x2:0,y2:1});gradient.append(svg('stop',{offset:'0%','stop-color':'currentColor','stop-opacity':'.23'}),svg('stop',{offset:'100%','stop-color':'currentColor','stop-opacity':'.01'}));defs.append(gradient);figure.append(defs);
  for(const tick of g.ticks){figure.append(svg('line',{x1:32,x2:right,y1:tick.y,y2:tick.y,class:'grid-line'}));const text=svg('text',{x:right+20,y:tick.y+4,class:'trend-axis'});const amount=displayAmount(tick.amount).replace(/(\.\d{6})\d+/, '$1…');text.textContent=(unit==='USD'?'$':'')+amount;figure.append(text);}
  const coordinates=g.points.map(p=>`${p.x},${p.y}`).join(' ');
  if(g.points.length>1){figure.append(svg('polygon',{points:`${g.points[0].x},${bottom} ${coordinates} ${g.points.at(-1).x},${bottom}`,fill:`url(#${id})`}));figure.append(svg('polyline',{points:coordinates,fill:'none',stroke:'currentColor','stroke-width':2.5,'stroke-linejoin':'round','stroke-linecap':'round'}));}
  for(const index of new Set([0,Math.floor((rows.length-1)/2),rows.length-1])){const p=g.points[index],text=svg('text',{x:p.x,y:bottom+42,'text-anchor':index===0?'start':index===rows.length-1?'end':'middle',class:'trend-axis'});text.textContent=new Date(p.row.observedAt).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});figure.append(text);}
  const guide=svg('line',{y1:28,y2:bottom,class:'trend-crosshair'}),dot=svg('circle',{r:5,fill:'currentColor',stroke:'var(--panel)','stroke-width':3});figure.append(guide,dot);
  const readout=el('div',undefined,'trend-readout'),value=el('strong'),time=el('span'),source=el('small'),button=el('button','선택 관측의 원본·출처 ↗','quiet-button');readout.setAttribute('aria-live','polite');readout.append(value,time,source);let selected=g.points.length-1;
  const select=index=>{selected=index;const p=g.points[index];guide.setAttribute('x1',p.x);guide.setAttribute('x2',p.x);dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);value.textContent=(unit==='USD'?'$':'')+exactDecimal(p.row.amount)+(unit==='USD'?'':' tokens');time.textContent=when(p.row.observedAt);source.textContent=p.row.provider+' · '+(p.row.observationClock==='REQUEST'?'개별 요청 시각':'보고서 시각 대체');};select(selected);
  const selectPointer=event=>{const point=figure.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const matrix=figure.getScreenCTM();if(!matrix)return;const x=point.matrixTransform(matrix.inverse()).x;let index=0;for(let i=1;i<g.points.length;i++)if(Math.abs(g.points[i].x-x)<Math.abs(g.points[index].x-x))index=i;select(index);};
  figure.addEventListener('pointermove',selectPointer);figure.addEventListener('pointerdown',selectPointer);
  figure.addEventListener('keydown',event=>{const next={ArrowLeft:Math.max(0,selected-1),ArrowRight:Math.min(g.points.length-1,selected+1),Home:0,End:g.points.length-1}[event.key];if(next!==undefined){event.preventDefault();select(next);}});
  button.addEventListener('click',()=>onDetail?.(g.points[selected].row,button));
  host.append(figure,readout);if(onDetail)host.append(button);
  host.append(el('p',`${rows.length}개 저장 관측 · ${data.readState?'DB 조회 시각 기준 구간':'마지막 저장 관측 기준 구간'} · ${zeroBaseline?'공급량 세로축은 0 기준':'가격 세로축 확대 (0 기준 아님)'}. 선은 관측점 사이를 연결하며 중간 시세를 나타내지 않습니다. 마우스·터치 또는 키보드 ← →로 정확한 값을 확인하세요.`,'chart-note'));
}
