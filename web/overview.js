import {tokenInfoButton} from './token-profile.js';
import {beginLoading} from './loading.js';
import {sparkline, renderNetworkSupplyChart, networkSupplySeries} from './market-chart.js';
import { dashboardEvidence, VERDICTS, reportLinks } from './evidence-model.js';
import { validateMarket, displayAmount, ratio, units, latest } from './market-model.js';
import { overviewSummary, overviewRanking, overviewEvidenceRanking } from './overview-model.js';
const $=selector=>document.querySelector(selector);
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;};
const state={index:null,market:null,loading:false,loaded:false,period:'30d',sourceInitialized:false,comparison:'change'};
const when=value=>new Date(value).toLocaleString('ko-KR',{hour12:false});
const labels={PASS:'통과',FAIL:'실패',INCONCLUSIVE:'판정 불충분',NOT_TESTED:'미검증',NOT_APPLICABLE:'비적용',UNSUPPORTED:'지원 범위 밖'};
async function json(path){
  const response=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('READ_FAILED');
  let size=0;const chunks=[];
  for await(const chunk of response.body){size+=chunk.length;if(size>2*1024*1024)throw new Error('READ_LIMIT');chunks.push(chunk);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function renderEvidence(){
  const host=$('#overview-metrics'),verdicts=$('#overview-verdicts');host.replaceChildren();verdicts.replaceChildren();
  if(!state.index){$('#overview-scope-summary').textContent='검토 범위 · 자료 미확보';host.append(node('p','저장된 검증 근거가 없습니다. 점수와 등급을 산정하지 않습니다.','semantic-note'));return;}
  const summary=overviewSummary(state.index,$('#overview-scope').value);
  const assets=new Set(summary.reports.map(r=>r.asset).filter(Boolean));
  const networks=new Set(summary.reports.filter(r=>r.chain&&r.identity?.networkId).map(r=>JSON.stringify([r.chain,r.identity.networkId])));
  $('#overview-scope-summary').textContent=`검토 범위 · ${assets.size}개 자산 · ${networks.size}개 네트워크 · ${summary.reports.length}개 자산·네트워크 프로필`;
  const grade=summary.grade===null?'등급 없음':`${summary.provisional?'잠정 ':''}${summary.grade}`;
  for(const [label,value,note,cls] of [
    ['검토한 자산',`${assets.size}개`,[...assets].join(' · ')||'자산 식별 정보 미확보','lead-purple'],
    ['검토한 네트워크',`${networks.size}개`,`${summary.reports.length}개 자산·네트워크 프로필 · 저장된 조회 근거`,'lead-teal'],
    ['판정 완료 비율',summary.coverage===null?'미산정':`${summary.coverage}%`,`${summary.decisive} / 대상 ${summary.applicable}개 · 비적용 제외`,''],
    ['확정 판정 중 통과 점수',summary.score===null?'미산정':`${summary.score} / 100`,`${grade} · PASS ${summary.counts.PASS} / 판정 완료 ${summary.decisive}`,''],
  ]){const card=node('article',undefined,`metric-card ${cls}`),valueRow=node('div',undefined,'metric-value');valueRow.append(node('strong',value));if(label==='확정 판정 중 통과 점수')valueRow.append(node('span',grade,'grade'));card.append(node('p',label),valueRow,node('p',note));host.append(card);}
  for(const verdict of VERDICTS){const button=node('button',undefined,`overview-verdict verdict-${verdict.toLowerCase()}`);button.append(node('span',labels[verdict]),node('strong',summary.counts[verdict]),node('small',verdict));button.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('atlas:show-verdict',{detail:{scope:summary.scope,verdict,reportIds:summary.reports.map(r=>r.id)}})));verdicts.append(button);}
  $('#overview-result-note').textContent=`${summary.scope==='LOCAL_FIXTURE'?'로컬 테스트용 토큰 검사':'실제 자산의 저장된 읽기'} · ${summary.provisional?'미확인·미실행 항목이 남아 잠정 등급입니다.':'선택 범위의 판정 결과입니다.'} 실행 오류 ${summary.executionCounts.ERROR} · 미실행 ${summary.executionCounts.NOT_EXECUTED}건. ${summary.scope==='LOCAL_FIXTURE'?'의도적으로 실패하게 만든 검사도 FAIL로 표시합니다. 이는 검사 프로그램 자체의 오류와는 다릅니다. ':''}결과를 누르면 항목별 근거로 이동합니다.`;
  const reports=$('#overview-selected-reports');reports.replaceChildren();for(const report of summary.reports){const item=node('li'),link=node('a',report.label+' · '+when(report.completedAt));link.href=reportLinks(report.id).document;link.target='_blank';link.rel='noopener noreferrer';item.append(link);reports.append(item);}
}
function renderEvidenceRankings(){
  for(const groupBy of ['asset','network']){
    const host=$('#overview-'+groupBy+'-ranking');host.replaceChildren();
    const rows=state.index?overviewEvidenceRanking(state.index,{scope:$('#overview-scope').value,groupBy,metric:$('#overview-rank-metric').value}):[];
    for(const row of rows){
      const network=groupBy==='network'?state.market?.registry.networks.find(n=>n.family===row.chain&&n.networkId===row.networkId):null;
      const label=network?.name??row.label,item=node('li'),button=node('button',undefined,'overview-evidence-row');
      const identity=node('span',undefined,'overview-evidence-identity');identity.append(node('span',row.rank??'—','rank-number'),node('strong',label));
      identity.append(node('small',`${row.reports.length}개 보고서`,'muted'));
      if(groupBy==='asset')identity.append(node('small',`${row.networkCount}개 네트워크`,'muted'));
      const score=node('span',undefined,'overview-evidence-stat');score.append(node('strong',row.score===null?'미산정':row.score+' / 100'),node('small',`PASS ${row.counts.PASS} / 확정 ${row.decisive}`));
      const coverage=node('span',undefined,'overview-evidence-stat');coverage.append(node('strong',row.coverage===null?'미산정':row.coverage+'%'),node('small',`확정 ${row.decisive} / 대상 ${row.applicable}`));
      button.append(identity,score,coverage);button.title=`${row.label} · NOT_APPLICABLE ${row.counts.NOT_APPLICABLE}개 제외 · 근거 보기`;
      button.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('atlas:show-verdict',{detail:{scope:row.scope,verdict:'',reportIds:row.reports.map(r=>r.id)}})));
      item.append(button);host.append(item);
    }
    if(!rows.length)host.append(node('li','저장된 검증 근거 없음','overview-empty'));
  }
}
function populateTrendSource(){
  const select=$('#overview-trend-source'),previous=select.value;select.replaceChildren();
  for(const [metric,value,label]of [['NETWORK_CIRCULATING','history','일별 유통량'],['NETWORK_MINTED','minted','일별 발행량']]){
    if(state.market?.supplyHistory?.some(s=>s.metric===metric)){const option=node('option',label);option.value=value;select.append(option);}
  }
  const available=select.options.length>0;
  if(!available){const option=node('option','일별 자료 미확보');option.value='history';select.append(option);}
  select.disabled=!available;
  if([...select.options].some(o=>o.value===previous))select.value=previous;
  if(!state.sourceInitialized&&available)state.period='1y';state.sourceInitialized=!!state.market;
  updateTrendPeriods();
}
function updateTrendPeriods(){for(const b of $('#overview-trend-period').querySelectorAll('button[data-period]')){b.hidden=['24h','7d'].includes(b.dataset.period);b.setAttribute('aria-pressed',String(b.dataset.period===state.period));}}
function populateTrendNetworks(){
  const select=$('#overview-trend-network'),previous=select.value,data=state.market,coinId=$('#overview-trend-coin').value;
  select.replaceChildren();
  const all=node('option','모든 네트워크');all.value='all';select.append(all);
  const available=data?networkSupplySeries(data,coinId,{source:$('#overview-trend-source').value}):[];
  const deployments=data?.registry.deployments.filter(d=>d.coinId===coinId&&available.some(s=>s.network.id===d.networkId))??[];
  for(const deployment of deployments){
    const network=data.registry.networks.find(n=>n.id===deployment.networkId);
    const option=node('option',network.name);option.value=network.id;select.append(option);
  }
  if(deployments.some(d=>d.networkId===previous))select.value=previous;else select.value='all';
  if(!deployments.length){select.replaceChildren();const option=node('option','표시할 네트워크 없음');option.value='';select.append(option);}
  select.disabled=!deployments.length;
}
function renderMarketTrend(){
  if(state.loading&&!state.market)return;
  const host=$('#overview-market-trend'),chains=$('#overview-chain-breakdown'),note=$('#overview-trend-note');
  host.replaceChildren();chains.replaceChildren();
  if(!state.market){host.append(node('p','시장 자료를 읽으면 네트워크별 공급량 추이를 표시합니다.','empty-state'));note.textContent='시장 자료 미확보';return;}
  const data=state.market,coinId=$('#overview-trend-coin').value,networkId=$('#overview-trend-network').value,source=$('#overview-trend-source').value;
  const minted=source==='minted',metricLabel=minted?'발행량':'유통량';
  const coin=data.registry.coins.find(c=>c.id===coinId),network=data.registry.networks.find(n=>n.id===networkId);
  const deployment=data.registry.deployments.find(d=>d.coinId===coinId&&d.networkId===networkId);
  const title=`${coin?.symbol??'토큰'} · ${networkId==='all'?'네트워크별':network?.name??'네트워크'} ${metricLabel} 추이`;
  const info=deployment?tokenInfoButton(data,deployment.id,title+' ⓘ'):null;
  $('#overview-trend-title').replaceChildren(info??document.createTextNode(title));
  $('#overview-trend-scope').textContent=`DeFiLlama · 네트워크별 일별 ${metricLabel} · ${state.comparison==='change'?'첫 관측 대비 증감률 (%)':'tokens'}`;
  $('.overview-chain-panel h3').textContent=`네트워크별 ${metricLabel}`;
  $('.overview-chain-panel > .muted').textContent=`일별 ${metricLabel} 비교`;
  renderNetworkSupplyChart(host,data,coinId,{period:state.period,networkId,comparison:state.comparison,source,profileButton:id=>tokenInfoButton(data,id)});
  note.textContent='';note.hidden=true;
  const rows=networkSupplySeries(data,coinId,{source}).map(s=>({networkId:s.network.id,amount:s.rows.at(-1).amount})).sort((a,b)=>units(a.amount)>units(b.amount)?-1:units(a.amount)<units(b.amount)?1:0);
  for(const row of rows){
    const network=data.registry.networks.find(n=>n.id===row.networkId),item=node('button',undefined,'overview-chain-item'),heading=node('div');
    heading.append(node('strong',network.name),node('span',displayAmount(row.amount)));
    item.type='button';item.dataset.network=row.networkId;item.setAttribute('aria-pressed',String(row.networkId===networkId));item.setAttribute('aria-label',`${coin.symbol} · ${network.name} ${metricLabel} 추이 보기`);item.addEventListener('click',()=>{$('#overview-trend-network').value=row.networkId;renderMarketTrend();$('#overview-chain-breakdown').querySelector(`[data-network="${row.networkId}"]`)?.focus({preventScroll:true});});
    const track=node('div',undefined,'track'),fill=node('span',undefined,'track-fill');fill.style.width=ratio(row.amount,rows[0].amount)+'%';track.append(fill);item.append(heading,track);chains.append(item);
  }
  if(!rows.length)chains.append(node('p','체인별 공급량 미확보','muted'));
  chains.append(node('p',`네트워크별 ${metricLabel}은 DeFiLlama 집계입니다.`,'chart-note'));
}
function renderMarket(){
  const select=$('#overview-trend-coin'),previous=select.value;select.replaceChildren();
  for(const coin of state.market?.registry.coins??[]){const option=node('option',coin.symbol);option.value=coin.id;select.append(option);}
  if(state.market?.registry.coins.some(c=>c.id===previous))select.value=previous;
  select.disabled=!state.market;
  populateTrendSource();populateTrendNetworks();renderMarketTrend();
  for(const [metric,target] of [['CIRCULATING','circulating'],['COIN_TOTAL','total']]){
    const host=$('#overview-'+target);host.replaceChildren();
    const rows=state.market?overviewRanking(state.market,metric):[];
    for(const [index,row]of rows.entries()){
      const coin=state.market.registry.coins.find(c=>c.id===row.coinId),item=node('li'),link=node('a',undefined,'overview-rank-row');link.href='#live';
      link.append(node('span',index+1,'rank-number'),node('strong',coin.symbol),node('span',displayAmount(row.amount),'overview-rank-value'),node('small',when(row.observedAt),'muted'));
      link.append(sparkline(state.market,row));
      link.title=`${coin.name} · ${row.amount} tokens · ${row.provider} ${row.endpoint} · ${row.selector}`;item.append(link);host.append(item);
    }
    if(!rows.length)host.append(node('li','저장된 자료 없음','overview-empty'));
    $('#overview-'+target+'-note').textContent=state.market?`${rows.length} / 등록 ${state.market.registry.coins.length}개 · 각 행은 해당 관측 시각 기준`:'시장 자료 미확보 · 누락은 0이 아닙니다.';
  }
  const volume=$('#overview-volume');volume.replaceChildren();volume.append(node('strong','비교 기준 확인 중'),node('p','거래량의 집계 기간과 단위가 확인되면 순위를 표시합니다.','muted'));
  const count=state.market?latest(state.market,{metric:'REPORTED_VOLUME'}).length:0;
  volume.append(node('small',`totalVolume 저장 관측 ${count}개 · 현재 순위에 사용하지 않습니다.`,'chart-note'));
}
async function load(){
  if(state.loading)return;state.loading=true;$('#overview-reload').disabled=true;
  const finish=beginLoading($('#overview-screen'),{ready:!!(state.index||state.market),targets:[['#overview-market-trend','chart'],['#overview-chain-breakdown','rows'],['#overview-circulating','rows'],['#overview-total','rows'],['#overview-volume','rows'],['#overview-metrics','cards']]});
  try {
  const results=await Promise.allSettled([json('/evidence/index.json').then(dashboardEvidence),json('/market-data.json').then(validateMarket)]);
  const failed=[];
  for(const [index,key]of ['index','market'].entries()){
    if(results[index].status==='fulfilled')state[key]=results[index].value;
    else failed.push(index===0?'검증 근거':'시장 자료');
  }
  renderEvidence();renderMarket();renderEvidenceRankings();
  const collectionFailed=state.market?.collectionState?.state==='FAILED'||state.market?.lastBuildState==='FAILED';
  $('#overview-error').hidden=!failed.length&&!collectionFailed;
  $('#overview-error').textContent=failed.length?`${failed.join(' · ')}를 읽지 못했습니다. 이전 정상 자료가 있으면 원래 시각을 유지해 표시합니다.`:'최근 시장 수집 또는 자료 생성 실패 · 마지막 정상 자료와 원본 관측 시각을 표시합니다.';
  }catch{$('#overview-error').hidden=false;$('#overview-error').textContent='저장 자료를 표시하지 못했습니다. 다시 읽어주세요.';}
  finally {finish();state.loading=false;state.loaded=true;$('#overview-reload').disabled=false;}
}
function activate(){if(!$('#overview-screen').hidden&&!state.loaded)load();}
$('#overview-reload').addEventListener('click',load);$('#overview-scope').addEventListener('change',()=>{renderEvidence();renderEvidenceRankings();});$('#overview-rank-metric').addEventListener('change',renderEvidenceRankings);$('#overview-theme').addEventListener('click',()=>$('#theme-toggle').click());
const theme=()=>{$('#overview-theme').textContent=document.documentElement.dataset.theme==='light'?'☾ 다크':'☀ 라이트';};
new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});theme();
document.addEventListener('atlas:navigate',activate);activate();
setInterval(()=>{if(!$('#overview-screen').hidden&&!document.hidden)load();},60000);

$('#overview-trend-coin').addEventListener('change',()=>{$('#overview-trend-network').value='all';populateTrendNetworks();renderMarketTrend();});
$('#overview-trend-network').addEventListener('change',renderMarketTrend);
$('#overview-trend-period').addEventListener('click',event=>{const button=event.target.closest('button[data-period]');if(!button)return;state.period=button.dataset.period;for(const item of $('#overview-trend-period').querySelectorAll('button[data-period]'))item.setAttribute('aria-pressed',String(item===button));renderMarketTrend();});
let overviewTrendWidth=0;
new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width>0&&width!==overviewTrendWidth){overviewTrendWidth=width;renderMarketTrend();}}).observe($('#overview-market-trend'));

$('#overview-trend-source').addEventListener('change',()=>{state.period='1y';updateTrendPeriods();$('#overview-trend-network').value='all';populateTrendNetworks();renderMarketTrend();});

$('#overview-trend-period').addEventListener('click',event=>{const button=event.target.closest('button[data-comparison]');if(!button)return;state.comparison=button.dataset.comparison;for(const item of $('#overview-trend-period').querySelectorAll('button[data-comparison]'))item.setAttribute('aria-pressed',String(item===button));renderMarketTrend();});
