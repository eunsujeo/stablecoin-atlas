import {displayAmount,exactDecimal,units} from './market-model.js';
import {DASHBOARD_METRICS,NETWORK_COLORS,parseDashboardFilters,filterSearch,dashboardView,contiguousSegments,downsample} from './atlas-dashboard-model.js';

const $=selector=>document.querySelector(selector);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const when=value=>value?new Date(value).toLocaleString('ko-KR',{hour12:false}):'미제공';
const sv=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const signed=value=>value===null?'—':(value.startsWith('-')?'−':'+')+displayAmount(value.replace(/^-/,'')).replace(/^-/, '');
export function initDashboard(){
  let data=null,filters=null,view=null,selected='';
  function writeURL(push=true){const url=filterSearch(filters)+(location.hash||'#supply');if(push)history.pushState(null,'',url);else history.replaceState(null,'',url);}
  function label(row){return row.networkId?data.registry.networks.find(n=>n.id===row.networkId)?.name??row.networkId:data.registry.coins.find(c=>c.id===row.coinId)?.symbol??row.coinId;}
  function choose(row){selected=row.id;const index=view.ordered.findIndex(r=>r.id===row.id);filters.page=Math.floor(index/12)+1;writeURL();view=dashboardView(data,filters);renderTable();renderDetail(row);}
  function renderDetail(row){
    const host=$('#observation-detail');host.replaceChildren();host.hidden=!row;if(!row)return;
    const title=node('h3','선택한 관측'),list=node('dl');
    for(const [key,value]of [['항목',label(row)],['수량',exactDecimal(row.amount)+(row.unit==='USD'?' USD':' tokens')],['데이터 기준 시각',when(row.sourceAt)],['관측 기록 시각',when(row.observedAt)]]){const pair=node('div');pair.append(node('dt',key),node('dd',value));list.append(pair);}
    const close=node('button','선택 해제');close.addEventListener('click',()=>{selected='';host.hidden=true;renderTable();});host.append(title,list,close);
  }
  function renderTable(){
    const body=$('#observation-rows');body.replaceChildren();
    for(const row of view.table){const tr=node('tr');if(row.id===selected)tr.className='selected-observation';
      const button=node('button',label(row),'table-item');button.addEventListener('click',()=>{selected=row.id;renderDetail(row);renderTable();});
      const name=node('th');name.scope='row';name.append(button);tr.append(name,node('td',exactDecimal(row.amount),'numeric'),node('td',row.unit==='USD'?'USD':'tokens'),node('td',when(row.sourceAt)),node('td',when(row.observedAt)));body.append(tr);
    }
    if(!view.rows.length){const tr=node('tr'),td=node('td',data.observations.length?'선택 조건에 맞는 관측이 없습니다. 코인이나 지표를 바꿔보세요.':'저장된 관측이 없습니다. 서버에서 자료를 수집한 뒤 다시 읽으세요.');td.colSpan=5;tr.append(td);body.append(tr);}
    $('#table-page').textContent=`${view.page} / ${view.pages} 페이지 · ${view.rows.length.toLocaleString()}개 관측`;
    $('#table-prev').disabled=view.page<=1;$('#table-next').disabled=view.page>=view.pages;
  }
  function renderChart(){
    const host=$('#supply-chart');host.replaceChildren();$('#chart-legend').replaceChildren();$('#chart-footnote').textContent='';
    if(!view.rows.length){host.append(node('p','선택한 조건의 추이를 표시할 관측이 없습니다.','empty-state'));return;}
    const compact=host.clientWidth<600,unit=filters.metric==='PRICE'?'USD':'tokens',width=compact?600:900,height=compact?320:300,left=12,right=compact?470:774,top=22,bottom=240;
    const values=view.rows.map(r=>units(r.amount)),lo=values.reduce((a,b)=>a<b?a:b),hi=values.reduce((a,b)=>a>b?a:b),pad=(hi-lo)/8n||hi/100000n||1n;
    const min=lo>pad?lo-pad:0n,max=hi+pad,span=max-min||1n,firstTime=Math.max(Number.isFinite(view.start)?view.start:-Infinity,Math.min(...view.rows.map(r=>Date.parse(r.observedAt)))),lastTime=view.end;
    const point=row=>({row,x:lastTime===firstTime?(left+right)/2:left+(Date.parse(row.observedAt)-firstTime)/(lastTime-firstTime)*(right-left),y:bottom-Number((units(row.amount)-min)*1000000n/span)/1000000*(bottom-top)});
    const figure=sv('svg',{viewBox:`0 0 ${width} ${height}`,role:'group',tabindex:0,'aria-label':`${DASHBOARD_METRICS[filters.metric]} 추이. 방향키로 관측 선택, Enter로 상세 보기.`});figure.classList.add('dashboard-chart');
    for(let i=0;i<4;i++){
      const y=bottom-i*(bottom-top)/3;figure.append(sv('line',{x1:left,x2:right,y1:y,y2:y,class:'grid-line'}));
      const value=min+span*BigInt(i)/3n,scale=10n**36n,tail=String(value%scale).padStart(36,'0').slice(0,6).replace(/0+$/,'');
      const text=sv('text',{x:right+18,y:y+4,class:'trend-axis'});text.textContent=displayAmount(String(value/scale)+(tail?'.'+tail:''));figure.append(text);
    }
    const legend=$('#chart-legend');legend.replaceChildren();let allPoints=[];
    for(const [index,series] of view.series.entries()){
      const row=series.rows[0],color=NETWORK_COLORS[row.networkId]??'#75b5ff',same=view.series.filter(g=>g.rows[0].networkId===row.networkId).length;
      const name=label(row)+(same>1?` 계열 ${index+1}`:''),key=node('span'),swatch=node('i');swatch.style.background=color;key.append(swatch,document.createTextNode(name));legend.append(key);
      for(const segment of contiguousSegments(series.rows)){
        const points=downsample(segment).map(point);allPoints.push(...points.map(p=>({...p,color})));
        if(points.length>1)figure.append(sv('polyline',{points:points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:color,'stroke-width':2.4,'stroke-linejoin':'round'}));
        for(const p of [points[0],...(points.length>1?[points.at(-1)]:[])])figure.append(sv('circle',{cx:p.x,cy:p.y,r:3.2,fill:color}));
      }
    }
    for(const [time,x,anchor]of [[firstTime,left,'start'],[(firstTime+lastTime)/2,(left+right)/2,'middle'],[lastTime,right,'end']]){
      const text=sv('text',{x,y:bottom+36,'text-anchor':anchor,class:'trend-axis'});text.textContent=new Date(time).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});figure.append(text);
    }
    const guide=sv('line',{y1:top,y2:bottom,class:'trend-crosshair'}),dot=sv('circle',{r:5,stroke:'var(--panel)','stroke-width':2});figure.append(guide,dot);guide.setAttribute('visibility','hidden');dot.setAttribute('visibility','hidden');
    const tip=node('div',undefined,'dashboard-tooltip');tip.hidden=true;tip.setAttribute('role','status');let active=allPoints.length-1;
    function show(index){active=index;const p=allPoints[index];guide.setAttribute('x1',p.x);guide.setAttribute('x2',p.x);dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);dot.setAttribute('fill',p.color);guide.setAttribute('visibility','visible');dot.setAttribute('visibility','visible');tip.replaceChildren(node('strong',label(p.row)+' '+exactDecimal(p.row.amount)+' '+unit),node('span','관측 기록 '+when(p.row.observedAt)));tip.hidden=false;}
    function pointer(event){const matrix=figure.getScreenCTM();if(!matrix)return;const p=figure.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const local=p.matrixTransform(matrix.inverse());let best=0,distance=Infinity;
      allPoints.forEach((point,i)=>{const d=(point.x-local.x)**2+(point.y-local.y)**2;if(d<distance){best=i;distance=d;}});show(best);
    }
    figure.addEventListener('pointermove',pointer);figure.addEventListener('click',event=>{pointer(event);choose(allPoints[active].row);});
    figure.addEventListener('pointerleave',()=>{tip.hidden=true;guide.setAttribute('visibility','hidden');dot.setAttribute('visibility','hidden');});
    figure.addEventListener('focus',()=>show(active));figure.addEventListener('keydown',event=>{
      const next={ArrowLeft:Math.max(0,active-1),ArrowRight:Math.min(allPoints.length-1,active+1),Home:0,End:allPoints.length-1}[event.key];
      if(next!==undefined){event.preventDefault();show(next);}if(event.key==='Enter'){event.preventDefault();choose(allPoints[active].row);}
    });host.append(figure,tip);
    $('#chart-footnote').textContent=`${unit} · 관측 기록 시각 기준 · 세로축은 선택 값에 맞춤 · 30분 초과 공백 ${view.gaps}곳은 연결하지 않음${data.readState?.sampled?' · 읽기 응답이 표본화됨':''}`;
  }
  function renderComparison(){
    const host=$('#network-bars');host.replaceChildren();
    if(filters.metric!=='CHAIN_TOTAL'){
      $('#comparison-title').textContent='선택 구간의 범위';
      const dl=node('dl');
      for(const [label,value]of [['지표',DASHBOARD_METRICS[filters.metric]],['범위','코인 전체'],['실제 관측 시작',view.rows.length?when(new Date(Math.min(...view.rows.map(r=>Date.parse(r.observedAt)))).toISOString()):'—'],['마지막 관측',view.rows.length?when(new Date(view.end).toISOString()):'—']]){const pair=node('div');pair.append(node('dt',label),node('dd',value));dl.append(pair);}host.append(dl);
      const button=node('button','체인별 공급량 비교','compare-action');button.addEventListener('click',()=>update({metric:'CHAIN_TOTAL',network:'all'}));host.append(button);return;
    }
    $('#comparison-title').textContent='체인별 총공급량';
    const latest=view.series.map(g=>g.rows.at(-1)),maximum=latest.reduce((a,r)=>units(r.amount)>a?units(r.amount):a,0n);
    for(const row of latest.sort((a,b)=>units(a.amount)>units(b.amount)?-1:units(a.amount)<units(b.amount)?1:0)){
      const button=node('button',undefined,'network-bar');button.setAttribute('aria-label',label(row)+' 상세 관측 보기');
      const title=node('span'),value=node('strong',displayAmount(row.amount));title.append(node('span',label(row)),value);
      const track=node('span',undefined,'bar-track'),fill=node('span');fill.style.width=(maximum?Number(units(row.amount)*10000n/maximum)/100:0)+'%';fill.style.background=NETWORK_COLORS[row.networkId]??'#75b5ff';track.append(fill);button.append(title,track,node('small',when(row.observedAt)));button.addEventListener('click',()=>choose(row));host.append(button);
    }
    const missing=view.expectedNetworks.filter(n=>!latest.some(r=>r.networkId===n));
    if(missing.length)host.append(node('p','관측 미확보: '+missing.map(id=>data.registry.networks.find(n=>n.id===id)?.name??id).join(', '),'comparison-missing'));
    host.append(node('p','체인별 수량은 합산하지 않습니다. 각 항목의 관측 시각이 다를 수 있습니다.','explanation'));
  }
  function render(){
    if(!data)return;view=dashboardView(data,filters);filters.page=view.page;writeURL(false);
    for(const [id,key]of [['#coin','coin'],['#dashboard-metric','metric'],['#dashboard-network','network'],['#observation-sort','sort']])$(id).value=filters[key];
    $('#dashboard-network').disabled=filters.metric!=='CHAIN_TOTAL';
    for(const b of $('#periods').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.period===filters.period));
    const coin=data.registry.coins.find(c=>c.id===filters.coin);
    $('#supply-title').textContent=`${coin?.symbol??''} ${DASHBOARD_METRICS[filters.metric]}`;
    $('#chart-title').textContent=DASHBOARD_METRICS[filters.metric]+' 추이';
    $('#kpi-value').textContent=view.last?displayAmount(view.last.amount):view.series.length>1?`${view.series.length}개 관측 계열`:'—';
    $('#kpi-unit').textContent=view.last?(filters.metric==='PRICE'?'USD':filters.metric==='CHAIN_TOTAL'?label(view.last)+' · tokens':'tokens'):'체인·계열별 수량은 비교에서 확인';
    $('#kpi-change').textContent=view.interval.amount===null?'—':signed(view.interval.amount);
    $('#kpi-change-note').textContent=view.interval.percent===null?view.interval.reason:`${view.interval.percent}% · 첫 관측 대비`;
    $('#kpi-previous').textContent=view.previous.percent===null?'비교 불가':view.previous.percent+'%';
    $('#kpi-previous-note').textContent=view.previous.reason??'동일 길이 이전 구간의 마지막 관측 대비';
    $('#dashboard-range').textContent=view.rows.length?`실제 관측 ${when(new Date(Math.min(...view.rows.map(r=>Date.parse(r.observedAt)))).toISOString())} ~ ${when(new Date(view.end).toISOString())}`:'선택 조건의 관측 없음';
    $('#dashboard-partial').textContent=data.readState?.latestRequestFailures||data.readState?.latestMissingFields?'최근 조회에 실패·누락 항목이 있습니다. 확보된 관측만 표시합니다.':view.gaps?'일부 구간의 관측이 없습니다. 빈 구간은 그래프에서 끊어 표시합니다.':filters.period!=='all'&&view.rows.length&&Math.min(...view.rows.map(r=>Date.parse(r.observedAt)))-view.start>1800000?'선택 기간의 일부만 저장되어 있습니다. 실제 관측 범위를 확인하세요.':'';
    $('#dashboard-partial').hidden=!$('#dashboard-partial').textContent;
    renderChart();renderComparison();renderTable();
    if(!view.rows.some(r=>r.id===selected)){selected='';renderDetail(null);}
  }
  function update(patch){if(!filters)return;filters={...filters,...patch,page:1};if(filters.metric!=='CHAIN_TOTAL')filters.network='all';selected='';renderDetail(null);writeURL();render();}
  for(const [id,key]of [['#coin','coin'],['#dashboard-metric','metric'],['#dashboard-network','network'],['#observation-sort','sort']])$(id).addEventListener('change',event=>update({[key]:event.target.value}));
  $('#periods').addEventListener('click',event=>{const button=event.target.closest('button[data-period]');if(button)update({period:button.dataset.period});});
  for(const [id,delta]of [['#table-prev',-1],['#table-next',1]])$(id).addEventListener('click',()=>{filters.page+=delta;writeURL();render();});
  window.addEventListener('popstate',()=>{if(data){filters=parseDashboardFilters(location.search,data.registry);selected='';renderDetail(null);render();}});
  let chartWidth=0;
  new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(data&&view&&width>0&&width!==chartWidth){chartWidth=width;renderChart();}}).observe($('#supply-chart'));
  return {
    loading(){$('#dashboard-refresh').textContent=data?'갱신 중 · 기존 자료 표시':'저장 자료 읽는 중';},
    setData(next,{failed=false}={}){
      if(next){data=next;filters=parseDashboardFilters(location.search,data.registry);
        for(const [id,rows]of [['#coin',data.registry.coins.map(c=>[c.id,c.symbol])],['#dashboard-network',[['all','전체 체인'],...data.registry.networks.map(n=>[n.id,n.name])]]]){
          $(id).replaceChildren(...rows.map(([value,label])=>{const option=node('option',label);option.value=value;return option;}));
        }render();
      }
      const collection=data?.collectionState,lastObserved=data?.observations.length?Math.max(...data.observations.map(r=>Date.parse(r.observedAt))):null,stale=lastObserved!==null&&Date.now()-lastObserved>86400000,buildFailed=data?.lastBuildState==='FAILED';
      $('#dashboard-refresh').textContent=failed?(data?'조회 실패 · 마지막 정상 자료 유지':'자료 조회 실패 · 다시 읽기를 눌러주세요'):data?'저장 자료 조회 완료':'저장 자료 없음';
      const status=$('#collector-status');status.dataset.state=failed||buildFailed||collection?.state==='FAILED'?'failed':stale?'stale':'saved';
      const stateText=buildFailed?'최근 발행 실패 · 마지막 정상 저장본 표시':collection?.state==='FAILED'?`수집 실패${collection.httpStatus?' · HTTP '+collection.httpStatus:' · 상세 오류 코드 미기록'} · 이전 저장본 표시`:collection?.state==='RUNNING'?'수집 진행 기록 있음':collection?.state==='SUCCESS'?'마지막 수집 성공':'수집 상태 미확인';
      const stopped=data?.schedulerState&&['STOPPED','LIMIT_REACHED'].includes(data.schedulerState.state);
      status.textContent=`${stateText}${stale?' · 24시간 이상 지난 저장본':''}${stopped?' · 예약 수집 종료':''}`;
      $('#collector-time').textContent=data?`${data.readState?'조회 기준':'저장 완료'} ${when(data.publishedAt)}${collection?' · 로컬 수집 마지막 시도 '+when(collection.attemptedAt):''}`:'서버 저장본을 읽으면 수집 상태를 확인할 수 있습니다.';
      $('#data-basis').textContent=data?'데이터 기준 시각은 상세 표 참조 · 관측 기록 시각과 구분':'저장된 실제 관측만 표시';
      if(!data){$('#supply-chart').replaceChildren(node('p',failed?'저장 자료를 읽지 못했습니다. 다시 읽기로 재시도하세요.':'저장 자료가 없습니다. 서버 수집 설정을 확인하세요.','empty-state'));$('#observation-rows').replaceChildren();}
    },
  };
}
