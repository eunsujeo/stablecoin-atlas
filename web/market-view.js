import {beginLoading} from './loading.js';
import {sparkline,renderMarketChart} from './market-chart.js';
import {validateMarket,rank,latest,series,units,ratio,displayAmount,exactDecimal,METRICS} from './market-model.js';
const $ = s=>document.querySelector(s), state={data:null,loading:false,trigger:null,period:'all'};
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const svg=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const when=value=>value?new Date(value).toLocaleString('ko-KR',{hour12:false}):'UNKNOWN · 자료 시각 미제공';
const coin=id=>state.data.registry.coins.find(c=>c.id===id);
const network=id=>state.data.registry.networks.find(n=>n.id===id);
const label=o=>coin(o.coinId).symbol+(o.networkId?' · '+network(o.networkId).name:' · 코인 전체');
function detail(o,trigger){state.trigger=trigger;const d=state.data.registry.deployments.find(d=>d.id===o.deploymentId),list=node('dl');
  const identity=d?d.identity.kind==='ISSUED'?`${d.identity.issuer} / ${d.identity.currency}`:d.identity.address:'코인 전체 · 개별 컨트랙트 합계와 별도';
  for(const[k,v]of [['지표',METRICS[o.metric].label],['원본 수량',o.amount+' '+o.unit],['식별자',identity],['고유 ID',d?.id??o.coinId],['네트워크 ID',d?network(d.networkId).networkId:'전체 범위'],['발행 형태',d?.origin??'체인별 발행 형태 미확인'],['공급자',o.provider],['조회 경로',o.endpoint],['추출 위치',o.selector],['원본 관측',when(o.observedAt)],['관측시각 근거',o.observationClock==='REQUEST'?'개별 요청 시각':'상위 보고서 시각 대체'],['공급자 자료 시각',when(o.sourceAt)],['입력 SHA-256',o.sourceHash]]){list.append(node('dt',k),node('dd',v));}
  if(o.ledgerHash)list.append(node('dt','확정 원장'),node('dd',o.ledgerIndex+' / '+o.ledgerHash));
  $('#dialog-title').textContent=label(o);$('#dialog-content').replaceChildren(node('p',o.metric==='OBLIGATIONS'?'범위가 제한된 gateway_balances.obligations입니다. 운영주소 제외 미적용 · 유통량 미확인 · 다른 공급량과 순위/합산하지 않습니다.':'외부 서비스에서 받아 저장한 값입니다. 네이티브·브리지 구분과 중복, 공급자 산정 방식·원본 반올림은 독립 검증하지 않았습니다.','semantic-note'),list);$('#detail-dialog').showModal();
}
$('#detail-dialog').addEventListener('close',()=>{if(state.trigger&&location.hash==='#live'){state.trigger.focus();state.trigger=null;}});
function chart(){const host=$('#live-history');host.replaceChildren();const selected=$('#live-coin').value;const rows=rank(state.data,selected);const groups=rows.map(o=>({o,points:series(state.data,o)})).filter(g=>g.points.length);
  const counts=groups.map(g=>g.points.length);$('#live-history-note').textContent=counts.length?`${coin(selected).symbol} · 네트워크별 ${Math.min(...counts)===Math.max(...counts)?counts[0]:Math.min(...counts)+'~'+Math.max(...counts)}회 관측`:'저장 이력 없음';
  if(!groups.length){host.append(node('p','해당 지표의 저장된 관측이 없습니다.','empty-state'));return;}
  const values=groups.flatMap(g=>g.points.map(p=>units(p.amount))),max=values.reduce((a,b)=>a>b?a:b,0n)||1n;
  const times=groups.flatMap(g=>g.points.map(p=>Date.parse(p.observedAt))),minTime=Math.min(...times),maxTime=Math.max(...times);
  const figure=svg('svg',{viewBox:'0 0 900 280',role:'img','aria-label':coin(selected).symbol+' 네트워크별 저장 공급량 관측'});
  for(let i=0;i<4;i++){const y=230-i*65;figure.append(svg('line',{x1:30,y1:y,x2:870,y2:y,class:'grid-line'}));}
  const colors=['var(--teal)','var(--purple)','var(--blue)','var(--pink)'];const legends=node('div',undefined,'live-legend');
  groups.forEach((g,i)=>{const points=g.points.map(p=>({p,x:maxTime===minTime?450:40+(Date.parse(p.observedAt)-minTime)/(maxTime-minTime)*820,y:230-Number(units(p.amount)*190n/max)}));
    if(points.length>1)figure.append(svg('polyline',{points:points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:colors[i%colors.length],'stroke-width':3}));
    for(const point of points){const c=svg('circle',{cx:point.x,cy:point.y,r:6,fill:colors[i%colors.length],tabindex:0,role:'img','aria-label':`${label(g.o)} ${when(point.p.observedAt)} ${point.p.amount} tokens`});const title=svg('title',{});title.textContent=`${label(g.o)} · ${point.p.amount} tokens · ${when(point.p.observedAt)}`;c.append(title);figure.append(c);}
    const legend=node('span',`${network(g.o.networkId).name} · ${g.points.length}점 · ${displayAmount(g.o.amount)}`);legend.style.color=colors[i%colors.length];legends.append(legend);
  });
  const topObservation=groups.flatMap(g=>g.points).reduce((a,b)=>units(a.amount)>units(b.amount)?a:b);
  const title=svg('text',{x:30,y:20,class:'axis-text'});title.textContent=`상단 기준 ${displayAmount(topObservation.amount)} tokens · 선형 비율`;
  figure.append(title);host.append(figure,legends,node('p',`${when(new Date(minTime).toISOString())}${maxTime!==minTime?' → '+when(new Date(maxTime).toISOString()):' · 단일 관측 시점'}`,'chart-note'));
}
function trend(){if(!state.data)return;const selected=$('#live-coin').value,metric=$('#live-trend-metric').value;
  const observation=latest(state.data,{coinId:selected,metric})[0];
  $('#live-trend-title').textContent=coin(selected).symbol+' · '+({PRICE:'가격',CIRCULATING:'유통량',COIN_TOTAL:'총공급량'}[metric]);
  $('#live-trend-scope').textContent='코인 전체 · '+(metric==='PRICE'?'USD':'tokens')+' · 수집한 시장 데이터 · 출처: Arkham';
  renderMarketChart($('#live-trend'),state.data,observation,{period:state.period,onDetail:detail});
}
$('#live-trend-metric').addEventListener('change',trend);
$('#live-trend-period').addEventListener('click',event=>{const button=event.target.closest('button[data-period]');if(!button)return;state.period=button.dataset.period;for(const b of $('#live-trend-period').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));trend();});
function render(){if(!state.data)return;const data=state.data,selected=$('#live-coin').value,c=coin(selected),mode=$('#live-mode').value;
  const global=latest(data,{coinId:selected,metric:'CIRCULATING'})[0],price=latest(data,{coinId:selected,metric:'PRICE'})[0],chainRows=rank(data,selected),deployments=data.registry.deployments.filter(d=>d.coinId===selected);
  const metrics=$('#live-metrics');metrics.replaceChildren();
  for(const [title,value,note,observation]of [[`${c.symbol} 유통량`,global?displayAmount(global.amount):'미확보','전체 네트워크 · tokens',global],[`${c.symbol} 가격`,price?'$'+price.amount:'미확보','USD · Arkham',price],['선택 코인 관측 시각',global?new Date(global.observedAt).toLocaleTimeString('ko-KR',{hour12:false}):'미확보',global?new Date(global.observedAt).toLocaleDateString('ko-KR'):'저장된 관측 없음',null]]){
    const cell=node('article',undefined,'market-stat');const valueNode=node(observation?'button':'strong',value,'market-stat-value');if(observation){valueNode.title='원본 수량과 출처';valueNode.addEventListener('click',()=>detail(observation,valueNode));}cell.append(node('p',title),valueNode,node('small',note));metrics.append(cell);
  }
  const rows=mode==='coins'?rank(data):chainRows;$('#live-ranking-title').textContent=mode==='coins'?'유통량 순위':`${c.symbol} 네트워크 순위`;
  $('#live-rank-label').textContent=mode==='coins'?'자산':'네트워크';$('#live-rank-secondary').textContent=mode==='coins'?'가격':'관측 시각';
  $('#live-ranking-note').textContent=mode==='coins'?`${rows.length}개 코인 · 행을 선택하면 네트워크 비교에 반영됩니다.`:`총공급량 확인 ${rows.length}/${deployments.length}개 · XRPL 별도 지표는 순위 제외`;
  const host=$('#live-ranking');host.replaceChildren();rows.forEach((o,i)=>{
    const b=node('button',undefined,'ranking-row market-rank-row');b.dataset.coin=o.coinId;
    b.setAttribute('aria-label',mode==='coins'?`${coin(o.coinId).symbol} 선택, 유통량 ${o.amount} tokens`:`${label(o)} 총공급량 ${o.amount} tokens 상세`);
    if(mode==='coins')b.setAttribute('aria-pressed',String(o.coinId===selected));
    const name=node('span',undefined,'market-asset-name');name.append(node('strong',mode==='coins'?coin(o.coinId).symbol:network(o.networkId).name),node('small',mode==='coins'?coin(o.coinId).name:c.symbol));
    const amount=node('span',undefined,'market-quantity');amount.append(node('strong',displayAmount(o.amount)));const track=node('span',undefined,'track'),fill=node('span',undefined,'track-fill');fill.style.width=ratio(o.amount,rows[0].amount)+'%';track.append(fill);amount.append(track);
    const p=latest(data,{coinId:o.coinId,metric:'PRICE'})[0];b.append(node('span',String(i+1),'rank-number'),name,amount,node('span',mode==='coins'?(p?'$'+p.amount:'미확보'):new Date(o.observedAt).toLocaleTimeString('ko-KR',{hour12:false}),'market-row-secondary'));
    b.append(sparkline(data,o));
    b.addEventListener('click',()=>{if(mode==='coins'){$('#live-coin').value=o.coinId;render();$('#live-ranking').querySelector(`[data-coin="${o.coinId}"]`)?.focus();}else detail(o,b);});host.append(b);
  });if(!rows.length)host.append(node('p','비교할 공급량이 없습니다.','empty-state'));
  const bars=$('#live-bars');bars.replaceChildren();for(const d of deployments){const o=chainRows.find(o=>o.deploymentId===d.id),row=node('div',undefined,'market-network-row'),head=node('div',undefined,'market-network-row-head');head.append(node('strong',network(d.networkId).name));
    if(o){head.append(node('span',displayAmount(o.amount)));const track=node('div',undefined,'track'),fill=node('span',undefined,'track-fill');fill.style.width=ratio(o.amount,chainRows[0].amount)+'%';track.append(fill);row.append(head,track);}
    else{const separate=latest(data,{deploymentId:d.id,metric:'OBLIGATIONS'})[0];head.append(node('span',separate?'별도 지표':'미확보','muted'));row.classList.add('market-network-unavailable');row.append(head);if(separate){const b=node('button','obligations 기록 보기 ↗','market-inline-link');b.addEventListener('click',()=>detail(separate,b));row.append(b);}}
    bars.append(row);
  }
  const table=$('#live-rows');table.replaceChildren();for(const d of deployments){const o=latest(data,{coinId:selected,deploymentId:d.id,metric:d.networkId==='xrpl'?'OBLIGATIONS':'CHAIN_TOTAL'})[0];const row=node('tr');row.append(node('td',`${c.symbol} · ${network(d.networkId).name}`),node('td',o?METRICS[o.metric].label:'해당 공급량 미확보'),node('td',o?exactDecimal(o.amount):'미확보','exact'),node('td',o?when(o.observedAt):'—'));const action=node('td');if(o){const b=node('button','상세 ↗','quiet-button');b.addEventListener('click',()=>detail(o,b));action.append(b);}row.append(action);table.append(row);}
  trend();chart();const networks=$('#live-networks');networks.replaceChildren();for(const n of data.registry.networks){const observation=data.networks.find(x=>x.networkId===n.id),card=node('article',undefined,'market-network-status');card.append(node('h3',n.name),node('span',observation?(observation.active?'활성 보고':'비활성 보고'):'미확보',observation?.active?'network-report-active':'muted'),node('small',observation?'블록 / 슬롯 '+observation.tip:'별도 관측 필요','muted'),node('small',observation?'기준 '+when(observation.sourceAt):'자료 없음','muted'));card.title=observation?'수집 관측 '+when(observation.observedAt):'공급자 자료가 없습니다.';networks.append(card);}
}
async function load(){if(state.loading)return;state.loading=true;$('#live-reload').disabled=true;const finish=beginLoading($('#live-screen'),{ready:!!state.data,targets:[['#live-metrics','cards'],['#live-trend','chart'],['#live-ranking','rows'],['#live-bars','rows'],['#live-networks','cards']]});try{const res=await fetch('/market-data.json',{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!res.ok)throw new Error();let size=0;const chunks=[];for await(const chunk of res.body){size+=chunk.length;if(size>2*1024*1024)throw new Error();chunks.push(chunk);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const data=validateMarket(JSON.parse(new TextDecoder().decode(bytes)));state.data=data;
    const select=$('#live-coin'),old=select.value;select.replaceChildren();for(const c of data.registry.coins){const option=node('option',c.symbol);option.value=c.id;select.append(option);}if(data.registry.coins.some(c=>c.id===old))select.value=old;
    const last=data.observations.reduce((t,o)=>o.observedAt>t?o.observedAt:t,'');const minutes=last?Math.max(0,Math.floor((Date.now()-Date.parse(last))/60000)):null;
    $('#live-status').textContent=`최근 시장 데이터 수집 ${when(last)}${minutes===null?'':` · ${minutes}분 경과`}`;
    $('#live-provenance').textContent=`화면 확인 ${when(new Date().toISOString())} · 자료 묶음 생성 ${when(data.publishedAt)} · 등록 ${data.registry.coins.length}개 코인 / ${data.registry.networks.length}개 네트워크 / ${data.registry.deployments.length}개 자산. 등록 밖 체인 공급량 ${data.omittedSupplyEntries}건 미표시. 관측 시각과 공급자 자료 기준 시각은 상세에서 구분합니다. 등록은 Adapter 지원 인증이 아닙니다.`;
    const read=data.readState;
    $('#live-trend-period [data-period="all"]').textContent=read?'조회 범위':'전체';
    if(read){
      $('#live-status').textContent+=' · PostgreSQL 조회 완료';
      $('#live-provenance').textContent=`DB 조회 ${when(data.publishedAt)} · 차트 ${when(read.historyFrom)} → ${when(read.historyTo)} · 기간 내 원본 ${read.historyRows}개 · ${read.sampled?'실제 관측 표본 표시':'기간 내 관측 전체 표시'} (시리즈별 최대 ${read.pointsPerSeries}점). 기간 밖 최신값은 요약/상세에서만 표시합니다. 등록 밖 공급량 집계는 제공하지 않습니다. 관측 시각과 공급자 자료 기준 시각은 상세에서 구분합니다.`;
      if(read.latestRequestFailures||read.latestMissingFields)$('#live-status').textContent+=` · DB 최근 요청 실패 ${read.latestRequestFailures}건 / 값 누락 ${read.latestMissingFields}건 (최신 정상값 유지)`;
    }else $('#live-status').textContent+=' · 로컬 JSON 조회';
    const scheduler=data.schedulerState;
    if(scheduler){
      const labels={COLLECTING:'수집 시작 기록',WAITING:'5분 주기 대기',STOPPED:'중지',FAILED:'오류로 중단',LIMIT_REACHED:'실행 한도 도달'};
      const overdue=scheduler.nextAt&&Date.now()>Date.parse(scheduler.nextAt)+60000||scheduler.state==='COLLECTING'&&Date.now()>Date.parse(scheduler.updatedAt)+180000;
      $('#live-status').textContent+=` · 자동 수집 ${overdue?'실행 상태 확인 필요':labels[scheduler.state]} ${scheduler.runs}/${scheduler.maxRuns}회${scheduler.nextAt?' · 다음 예정 '+when(scheduler.nextAt):''} (저장된 실행 기록)`;
    }else $('#live-status').textContent+=' · 자동 수집 실행 기록 없음';
    const database=data.databaseState;
    if(database){
      const labels={CHECKING:'사전 점검',COLLECTING:'공급자 수집 중',IMPORTING:'저장 시도 · 완료 미확인',STORED:'저장 완료',FAILED:'실패',UNCONFIRMED:'저장 결과 미확인 · 명시 재이전 필요'};
      $('#live-status').textContent+=` · DB 기록 ${labels[database.state]} ${when(database.updatedAt)}${database.errorCode?' ('+database.errorCode+')':''}`;
    }
    const collection=data.collectionState;
    if(collection)$('#live-status').textContent+=` · 수집 ${collection.state==='SUCCESS'?'완료':collection.state==='RUNNING'?'시작 기록 (완료 미확인)':'실패'} ${when(collection.attemptedAt)}`;
    $('#live-error').hidden=data.lastBuildState!=='FAILED'&&collection?.state!=='FAILED'&&scheduler?.state!=='FAILED';
    $('#live-error').textContent=(collection?.state==='FAILED'&&collection.published?'자료는 발행되었으나 완료 상태 기록 중 오류가 발생했습니다.': scheduler?.state==='FAILED'&&collection?.state==='SUCCESS'?'자동 수집을 중단했습니다. 마지막으로 발행된 정상 자료와 원본 관측 시각을 표시합니다.': '최근 수집 또는 자료 묶음 생성에 실패했습니다. 이전 정상 저장본과 원본 관측 시각을 유지합니다.')+(collection?.httpStatus?` HTTP ${collection.httpStatus}.`:'')+(collection?.retryAfterSeconds?` 공급자 재시도 대기 ${collection.retryAfterSeconds}초 (자동 재시도 없음).`:'');render();
  }catch{$('#live-error').hidden=false;$('#live-error').textContent=state.data?'저장 자료를 다시 읽지 못했습니다. 이전 자료와 원본 시각을 유지합니다.':'시장 자료를 읽지 못했습니다. 서버의 조회 모드와 연결 상태를 확인하세요.';}finally{finish();state.loading=false;$('#live-reload').disabled=false;}}
$('#live-reload').addEventListener('click',load);$('#live-mode').addEventListener('change',render);$('#live-coin').addEventListener('change',render);$('#live-theme').addEventListener('click',()=>$('#theme-toggle').click());
const theme=()=>{$('#live-theme').textContent=document.documentElement.dataset.theme==='light'?'☾ 다크':'☀ 라이트';};new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});theme();
function activate(){if(location.hash==='#live'&&!state.data)load();}window.addEventListener('hashchange',activate);activate();
setInterval(()=>{if(location.hash==='#live'&&!document.hidden)load();},60000);

let trendWidth=0;new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width>0&&width!==trendWidth){trendWidth=width;trend();}}).observe($('#live-trend'));
