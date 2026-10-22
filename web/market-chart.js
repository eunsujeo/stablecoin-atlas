import {units, exactDecimal, displayAmount, series, latest} from './market-model.js';
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
  if(rows.length===1)heading.append(el('span','단일 관측 · 추세 미확보','trend-change'));
  host.append(heading);
  const figure=svg('svg',{viewBox:`0 0 ${width} ${height}`,role:'group',tabindex:0,'aria-label':`${unit==='USD'?'가격':'공급량'} 저장 이력 ${rows.length}점. 좌우 화살표로 관측 선택, Home 처음, End 마지막.`});figure.classList.add('market-price-chart','trend-'+g.direction);
  const id=(host.id||'market')+'-trend-fill',defs=svg('defs'),gradient=svg('linearGradient',{id,x1:0,y1:0,x2:0,y2:1});gradient.append(svg('stop',{offset:'0%','stop-color':'currentColor','stop-opacity':'.23'}),svg('stop',{offset:'100%','stop-color':'currentColor','stop-opacity':'.01'}));defs.append(gradient);figure.append(defs);
  for(const tick of g.ticks){figure.append(svg('line',{x1:32,x2:right,y1:tick.y,y2:tick.y,class:'grid-line'}));const text=svg('text',{x:right+20,y:tick.y+4,class:'trend-axis'});const amount=displayAmount(tick.amount).replace(/(\.\d{6})\d+/, '$1…');text.textContent=(unit==='USD'?'$':'')+amount;figure.append(text);}
  const coordinates=g.points.map(p=>`${p.x},${p.y}`).join(' ');
  if(g.points.length>1){figure.append(svg('polygon',{points:`${g.points[0].x},${bottom} ${coordinates} ${g.points.at(-1).x},${bottom}`,fill:`url(#${id})`}));figure.append(svg('polyline',{points:coordinates,fill:'none',stroke:'currentColor','stroke-width':2.5,'stroke-linejoin':'round','stroke-linecap':'round'}));}
  for(const index of new Set([0,Math.floor((rows.length-1)/2),rows.length-1])){const p=g.points[index],text=svg('text',{x:p.x,y:bottom+42,'text-anchor':index===0?'start':index===rows.length-1?'end':'middle',class:'trend-axis'});text.textContent=new Date(p.row.observedAt).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});figure.append(text);}
  const guide=svg('line',{y1:28,y2:bottom,class:'trend-crosshair'}),dot=svg('circle',{r:5,fill:'currentColor',stroke:'var(--panel)','stroke-width':3});figure.append(guide,dot);
  const readout=el('div',undefined,'trend-readout'),value=el('strong'),time=el('span'),source=el('small'),button=el('button','선택 관측의 원본·출처 ↗','quiet-button');readout.classList.add('chart-point-tooltip');readout.hidden=true;readout.setAttribute('aria-live','polite');readout.append(value,time,source);let selected=g.points.length-1;
  const select=index=>{selected=index;const p=g.points[index];guide.setAttribute('x1',p.x);guide.setAttribute('x2',p.x);dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);value.textContent=(unit==='USD'?'$':'')+exactDecimal(p.row.amount)+(unit==='USD'?'':' tokens');time.textContent=when(p.row.observedAt);source.textContent=p.row.provider+' · '+(p.row.observationClock==='REQUEST'?'개별 요청 시각':'보고서 시각 대체');};select(selected);
  const selectPointer=event=>{const point=figure.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const matrix=figure.getScreenCTM();if(!matrix)return;const x=point.matrixTransform(matrix.inverse()).x;let index=0;for(let i=1;i<g.points.length;i++)if(Math.abs(g.points[i].x-x)<Math.abs(g.points[index].x-x))index=i;select(index);};
  figure.addEventListener('pointermove',event=>{selectPointer(event);readout.hidden=false;});figure.addEventListener('pointerdown',event=>{selectPointer(event);readout.hidden=false;});figure.addEventListener('pointerleave',()=>readout.hidden=true);figure.addEventListener('focus',()=>readout.hidden=false);figure.addEventListener('blur',()=>readout.hidden=true);
  figure.addEventListener('keydown',event=>{const next={ArrowLeft:Math.max(0,selected-1),ArrowRight:Math.min(g.points.length-1,selected+1),Home:0,End:g.points.length-1}[event.key];if(next!==undefined){event.preventDefault();select(next);}});
  button.addEventListener('click',()=>onDetail?.(g.points[selected].row,button));
  host.append(figure,readout);if(onDetail)host.append(button);
  host.append(el('p','업데이트 '+when(latest.observedAt),'chart-updated'));
}

export function networkSupplySeries(data,coinId,{period='all',networkId='all'}={}){
  return data.registry.deployments.filter(d=>d.coinId===coinId&&(networkId==='all'||d.networkId===networkId)).map(d=>{
    const observation=latest(data,{coinId,deploymentId:d.id,metric:'CHAIN_TOTAL'})[0];
    return {deploymentId:d.id,network:data.registry.networks.find(n=>n.id===d.networkId),rows:chartHistory(data,observation,period)};
  }).filter(s=>s.rows.length);
}
export function renderNetworkSupplyChart(host,data,coinId,options={}){
  host.replaceChildren();const groups=networkSupplySeries(data,coinId,options);
  if(!groups.length){host.append(el('p','선택한 구간의 공급량 자료가 없습니다.','empty-state'));return;}
  const colors=['#36a9ef','#e59827','#a681ee','#20ad8b','#e57796','#8caa39'];
  const compact=host.clientWidth<600,right=compact?430:870,bottom=compact?240:280,width=compact?600:1040,height=compact?310:350;
  const rows=groups.flatMap(s=>s.rows).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  const g=chartGeometry(rows,{right,bottom,zeroBaseline:true}),points=new Map(g.points.map(p=>[p.row,p]));
  const legend=el('div',undefined,'network-chart-legend');
  const figure=svg('svg',{viewBox:`0 0 ${width} ${height}`,role:'group',tabindex:0,'aria-label':'네트워크별 총공급량. 좌우 화살표로 시각, 위아래 화살표로 네트워크 선택. Home 처음, End 마지막.'});figure.classList.add('market-price-chart');
  for(const tick of g.ticks){figure.append(svg('line',{x1:32,x2:right,y1:tick.y,y2:tick.y,class:'grid-line'}));const text=svg('text',{x:right+20,y:tick.y+4,class:'trend-axis'});text.textContent=displayAmount(tick.amount).replace(/(\.\d{4})\d+/, '$1…');figure.append(text);}
  groups.forEach((group,i)=>{
    group.points=group.rows.map(row=>points.get(row));const color=colors[i%colors.length],item=el('div',undefined,'network-chart-key'),swatch=el('span',undefined,'network-chart-swatch');swatch.style.background=color;
    item.append(swatch,el('strong',group.network.name),el('span',displayAmount(group.rows.at(-1).amount)));
    const info=options.profileButton?.(group.deploymentId);if(info)item.append(info);legend.append(item);
    const path=svg('polyline',{points:group.points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:color,'stroke-width':2.5,'stroke-linejoin':'round','data-network':group.network.id});figure.append(path);
    const last=group.points.at(-1);figure.append(svg('circle',{cx:last.x,cy:last.y,r:3,fill:color}));
  });
  for(const index of new Set([0,Math.floor((rows.length-1)/2),rows.length-1])){const p=points.get(rows[index]);if(index!==0&&index!==rows.length-1&&(p.x-g.points[0].x<120||g.points.at(-1).x-p.x<120))continue;const text=svg('text',{x:p.x,y:bottom+42,'text-anchor':index===0?'start':index===rows.length-1?'end':'middle',class:'trend-axis'});text.textContent=new Date(p.row.observedAt).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});figure.append(text);}
  const tip=el('div',undefined,'chart-point-tooltip'),guide=svg('line',{y1:28,y2:bottom,class:'trend-crosshair'}),dot=svg('circle',{r:5,stroke:'var(--panel)','stroke-width':2});tip.hidden=true;tip.setAttribute('aria-live','polite');figure.append(guide,dot);let groupIndex=0,pointIndex=groups[0].points.length-1;
  function select(){const group=groups[groupIndex],p=group.points[pointIndex];guide.setAttribute('x1',p.x);guide.setAttribute('x2',p.x);dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);dot.setAttribute('fill',colors[groupIndex%colors.length]);tip.replaceChildren(el('strong',group.network.name+' · '+exactDecimal(p.row.amount)+' tokens'),el('span',when(p.row.observedAt)));}
  function pointer(event){const origin=figure.createSVGPoint();origin.x=event.clientX;origin.y=event.clientY;const matrix=figure.getScreenCTM();if(!matrix)return;const q=origin.matrixTransform(matrix.inverse());let distance=Infinity;groups.forEach((group,i)=>group.points.forEach((p,j)=>{const d=(p.x-q.x)**2+(p.y-q.y)**2;if(d<distance){distance=d;groupIndex=i;pointIndex=j;}}));select();tip.hidden=false;}
  select();figure.addEventListener('pointermove',pointer);figure.addEventListener('pointerdown',pointer);figure.addEventListener('pointerleave',()=>tip.hidden=true);figure.addEventListener('focus',()=>tip.hidden=false);figure.addEventListener('blur',()=>tip.hidden=true);
  figure.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Escape'].includes(event.key))return;event.preventDefault();if(event.key==='Escape'){tip.hidden=true;return;}if(event.key==='ArrowUp')groupIndex=(groupIndex+groups.length-1)%groups.length;if(event.key==='ArrowDown')groupIndex=(groupIndex+1)%groups.length;const last=groups[groupIndex].points.length-1;pointIndex=Math.min(pointIndex,last);if(event.key==='ArrowLeft')pointIndex=Math.max(0,pointIndex-1);if(event.key==='ArrowRight')pointIndex=Math.min(last,pointIndex+1);if(event.key==='Home')pointIndex=0;if(event.key==='End')pointIndex=last;select();tip.hidden=false;});
  host.append(legend,figure,tip,el('p','업데이트 '+when(rows.at(-1).observedAt),'chart-updated'));
}
