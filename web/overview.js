import {cachedJSON,browserData} from './browser-data.js';
import {bindCacheStatus} from './browser-cache-ui.js';
import {initializeSupplyOverview} from './supply-overview.js';
import {validateStoredSurvey,storedSurveyChoice} from './survey-model.js';
import {validateGeography,geographyChoice} from './geography-model.js';
import {renderGeography,initializeGeographyFilters} from './geography.js';
import {renderSurvey,initializeSurveyFilters} from './survey.js';
import {validateReviewedSupply,reviewedSupplyChoice} from './reviewed-supply-model.js';
import {renderReviewedSupply} from './reviewed-supply.js';
import {validateFX,usableFX,priceLabel,readCurrency,saveCurrency} from './fx-model.js';
import {validateActivity,providerChoice} from './activity-model.js';
import {overviewMarketRows} from './overview-market-model.js';
import {readChartPreferences,saveChartPreferences,readChartURL,syncChartURL} from './overview-preferences.js';
import {validateRegistrationIndex,validateRegisteredHistory,registrationChartData,sameRegisteredSource} from './registration-model.js';
import {tokenInfoButton,registeredCoinInfoButton} from './token-profile.js';
import {beginLoading} from './loading.js';
import {renderNetworkSupplyChart, networkSupplySeries} from './market-chart.js';
import { dashboardEvidence, VERDICTS, reportLinks } from './evidence-model.js';
import { validateMarket, displayAmount, ratio, units } from './market-model.js';
import { overviewSummary, overviewEvidenceRanking } from './overview-model.js';
import {sourceScopeSummary} from './asset-review-model.js';
import {mountAssetReview} from './asset-review-store.js';
const $=selector=>document.querySelector(selector);
const optionalText=(selector,value)=>{const element=$(selector);if(element)element.textContent=value;};
const publicMode=document.documentElement.dataset.deployment==='production';
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;};
const savedChart=readChartURL(location.href)??readChartPreferences();
const state={currency:readCurrency(location.href),fx:null,selectedCoin:savedChart?.coinId??'usdc',selectedSource:savedChart?.source??'history',selectedNetwork:savedChart?.networkId??'all',marketFailed:false,index:null,market:null,loading:false,loaded:false,period:savedChart?.period??'30d',sourceInitialized:!!savedChart,comparison:savedChart?.comparison??'amount',registration:null,detail:null,trendLoading:false,trendError:false,registrationFailed:false};
let trendSequence=0,trendAbort,trendFinish;
let survey={data:null,state:'MISSING'};
const renderSupplyOverview=initializeSupplyOverview($('#overview-supply'),{read:json});
let geography={data:null,state:'MISSING'};
if(!publicMode)initializeGeographyFilters($('#overview-geography'),()=>renderGeography($('#overview-geography'),geography));
const renderStoredSurvey=()=>renderSurvey($('#overview-survey'),survey);
initializeSurveyFilters($('#overview-survey'),renderStoredSurvey);
let reviewedSupply={data:null,state:'MISSING'};
const renderSupply=()=>renderReviewedSupply($('#overview-reviewed-supply'),reviewedSupply,$('#overview-reviewed-coin').value);
$('#overview-reviewed-coin').addEventListener('change',renderSupply);
let activity=null,activityState='MISSING';
function renderActivity(){
 const host=$('#overview-activity-rows');host.replaceChildren();
 $('#overview-activity-state').textContent=activityState==='LAST_GOOD'?'조회 실패 · 마지막 정상 자료':activityState==='UNAVAILABLE'?'자료 조회 실패':'';
 if(!activity?.series.length){const tr=node('tr'),cell=node('td',activityState==='UNAVAILABLE'?'전송량 자료를 읽지 못했습니다. 다시 읽어주세요.':'저장된 전송량 자료가 없습니다.','muted');cell.colSpan=5;tr.append(cell);host.append(tr);return;}
 for(const coinId of ['usdt','usdc','rlusd','jpyc','jpysc']){
  const row=node('tr'),identity=node('th');identity.scope='row';identity.append(registeredCoinInfoButton(state.registration,state.market,coinId,coinId.toUpperCase()+' ⓘ')??node('strong',coinId.toUpperCase()));row.append(identity);
  const point=activity.series.find(s=>s.coinId===coinId)?.points.at(-1);
  if(point){for(const key of ['volume','volumeUSD','transfers']){const cell=node('td',displayAmount(point[key]));cell.title=point[key]+(key==='volume'?' tokens':key==='volumeUSD'?' USD':'건');row.append(cell);}const day=node('td',point.day,'market-updated');day.title='일별 집계 기준일 · 조회 '+when(point.queriedAt);row.append(day);}
  else for(let i=0;i<4;i++)row.append(node('td','—','muted'));
  host.append(row);
 }
}
const trendData=()=>state.registration?registrationChartData(state.registration,state.detail):state.registrationFailed?null:state.market;
const scopeReady=()=>!state.registrationFailed&&(!!state.registration||!!state.market&&!state.marketFailed);
const rememberTrend=()=>{
 const choice={version:1,coinId:state.selectedCoin,networkId:state.selectedNetwork,source:state.selectedSource,period:state.period,comparison:state.comparison};
 saveChartPreferences(choice);syncChartURL(choice);
};
const when=value=>new Date(value).toLocaleString('ko-KR',{hour12:false});
const labels={PASS:'통과',FAIL:'실패',INCONCLUSIVE:'판정 불충분',NOT_TESTED:'미검증',NOT_APPLICABLE:'비적용',UNSUPPORTED:'지원 범위 밖'};
async function json(path,{signal,optional=false,revalidate=false,validate,context}={}){
  return cachedJSON(path,{cache:revalidate?'no-cache':'no-store',signal,optional,validate,context,timeoutMs:15000});
}
function renderSourceReview(sourceReviewProfiles){
  const assets=new Set(sourceReviewProfiles.map(p=>p.coinId)),networks=new Set(sourceReviewProfiles.map(p=>p.chainId??p.networkKey));
  const confirmed=sourceReviewProfiles.filter(p=>p.sourceReviewStatus==='SOURCE_REVIEWED');
  const metrics=$('#overview-source-metrics');metrics.replaceChildren();
  for(const [label,value,note] of [
    ['기존 소스 확인',`${confirmed.length} / ${sourceReviewProfiles.length}`,'기존 확인 프로필 / 전체 검토 프로필'],
    ['검토 자산',`${assets.size}개`,[...assets].map(id=>id.toUpperCase()).join(' · ')],
    ['검토 네트워크',`${networks.size}개`,[...new Set(sourceReviewProfiles.map(p=>p.network))].join(' · ')],
  ]){const card=node('article',undefined,'metric-card'),valueRow=node('div',undefined,'metric-value');valueRow.append(node('strong',value));card.append(node('p',label),valueRow,node('p',note));metrics.append(card);}
  const gradeCard=node('article',undefined,'metric-card overview-read-grade');
  const gradeValue=node('strong','미산정');gradeValue.id='overview-read-grade';
  const gradeNote=node('p','저장 보고서 로딩 중');gradeNote.id='overview-read-grade-note';
  const gradeRow=node('div',undefined,'metric-value');gradeRow.append(gradeValue);
  gradeCard.append(node('p','읽기 실행 등급'),gradeRow,gradeNote);if(!publicMode)metrics.append(gradeCard);
  const rows=$('#overview-source-rows');rows.replaceChildren();
  for(const coinId of assets){
    const profiles=sourceReviewProfiles.filter(p=>p.coinId===coinId);
    const complete=profiles.filter(p=>p.sourceReviewStatus==='SOURCE_REVIEWED').length;
    const card=node('article',undefined,'overview-source-asset');card.dataset.sourceCoin=coinId;
    const heading=node('div',undefined,'overview-source-asset-heading');
    heading.append(node('h3',profiles[0].symbol),node('span',complete===profiles.length?'소스 확인 완료':'검토 종류별 근거 확인','overview-source-status'));
    const networks=node('p',profiles.map(p=>p.network).join(' · '),'overview-source-networks');
    const footer=node('div',undefined,'overview-source-asset-footer');
    const link=node('a','상세 보기 →');link.href='#assets';
    link.addEventListener('click',()=>{
      const root=document.querySelector('[data-source-review]');
      const search=root.querySelector('input[type="search"]');search.value='';search.dispatchEvent(new Event('input'));
      root.querySelector(`[data-coin-id="${coinId}"]`)?.click();
    });
    footer.append(node('span',sourceScopeSummary(profiles)),link);
    card.append(heading,networks,footer);rows.append(card);
  }
}
mountAssetReview($('#overview-technical'),snapshot=>{renderSourceReview(snapshot.profiles);if(!publicMode)renderEvidence();},{target:$('#overview-source-rows')});
function renderEvidence(){
  const host=$('#overview-metrics'),verdicts=$('#overview-verdicts');host.replaceChildren();verdicts.replaceChildren();
  if(!state.index){optionalText('#overview-read-grade','미산정');optionalText('#overview-read-grade-note','저장된 실행 근거 없음');$('#overview-scope-summary').textContent='검토 범위 · 자료 미확보';host.append(node('p','저장된 검증 근거가 없습니다. 점수와 등급을 산정하지 않습니다.','semantic-note'));return;}
  const summary=overviewSummary(state.index,$('#overview-scope').value);
  const assets=new Set(summary.reports.map(r=>r.asset).filter(Boolean));
  const networks=new Set(summary.reports.filter(r=>r.chain&&r.identity?.networkId).map(r=>JSON.stringify([r.chain,r.identity.networkId])));
  $('#overview-scope-summary').textContent=`검토 범위 · ${assets.size}개 자산 · ${networks.size}개 네트워크 · ${summary.reports.length}개 자산·네트워크 프로필`;
  const grade=summary.grade===null?'등급 없음':`${summary.provisional?'잠정 ':''}${summary.grade}`;
  optionalText('#overview-read-grade',grade);
  optionalText('#overview-read-grade-note',summary.score===null?'판정 완료 항목 없음':`통과 점수 ${summary.score}점 · 판정 완료 ${summary.coverage}%`);
  for(const [label,value,note,cls] of [
    ['검토한 자산',`${assets.size}개`,[...assets].join(' · ')||'자산 식별 정보 미확보','lead-purple'],
    ['검토한 네트워크',`${networks.size}개`,`${summary.reports.length}개 자산·네트워크 프로필 · 저장된 조회 근거`,'lead-teal'],
    ['판정 완료 비율',summary.coverage===null?'미산정':`${summary.coverage}%`,`${summary.decisive} / 대상 ${summary.applicable}개 · 비적용 제외`,''],
    ['확정 판정 중 통과 점수',summary.score===null?'미산정':`${summary.score} / 100`,`${grade} · PASS ${summary.counts.PASS} / 판정 완료 ${summary.decisive}`,''],
  ]){const card=node('article',undefined,`metric-card ${cls}`),valueRow=node('div',undefined,'metric-value');valueRow.append(node('strong',value));if(label==='확정 판정 중 통과 점수')valueRow.append(node('span',grade,'grade'));card.append(node('p',label),valueRow,node('p',note));host.append(card);}
  for(const verdict of VERDICTS){const button=node('div',undefined,`overview-verdict verdict-${verdict.toLowerCase()}`);button.append(node('span',labels[verdict]),node('strong',summary.counts[verdict]),node('small',verdict));verdicts.append(button);}
  $('#overview-result-note').textContent=`${summary.scope==='LOCAL_FIXTURE'?'로컬 테스트용 토큰 검사':'실제 자산의 저장된 읽기'} · ${summary.provisional?'미확인·미실행 항목이 남아 잠정 등급입니다.':'선택 범위의 판정 결과입니다.'} 실행 오류 ${summary.executionCounts.ERROR} · 미실행 ${summary.executionCounts.NOT_EXECUTED}건. ${summary.scope==='LOCAL_FIXTURE'?'의도적으로 실패하게 만든 검사도 FAIL로 표시합니다. 이는 검사 프로그램 자체의 오류와는 다릅니다. ':''}저장 보고서에서 원래 실행 근거를 확인할 수 있습니다.`;
  const reports=$('#overview-selected-reports');reports.replaceChildren();for(const report of summary.reports){const item=node('li'),link=node('a',report.label+' · '+when(report.completedAt));link.href=reportLinks(report.id).document;link.target='_blank';link.rel='noopener noreferrer';item.append(link);reports.append(item);}
}
function renderEvidenceRankings(){
  for(const groupBy of ['asset','network']){
    const host=$('#overview-'+groupBy+'-ranking');host.replaceChildren();
    const rows=state.index?overviewEvidenceRanking(state.index,{scope:$('#overview-scope').value,groupBy,metric:$('#overview-rank-metric').value}):[];
    for(const row of rows){
      const network=groupBy==='network'?state.market?.registry.networks.find(n=>n.family===row.chain&&n.networkId===row.networkId):null;
      const label=network?.name??row.label,item=node('li'),button=node('div',undefined,'overview-evidence-row');
      const identity=node('span',undefined,'overview-evidence-identity');identity.append(node('span',row.rank??'—','rank-number'),node('strong',label));
      identity.append(node('small',`${row.reports.length}개 보고서`,'muted'));
      if(groupBy==='asset')identity.append(node('small',`${row.networkCount}개 네트워크`,'muted'));
      const score=node('span',undefined,'overview-evidence-stat');score.append(node('strong',row.score===null?'미산정':row.score+' / 100'),node('small',`PASS ${row.counts.PASS} / 확정 ${row.decisive}`));
      const coverage=node('span',undefined,'overview-evidence-stat');coverage.append(node('strong',row.coverage===null?'미산정':row.coverage+'%'),node('small',`확정 ${row.decisive} / 대상 ${row.applicable}`));
      button.append(identity,score,coverage);button.title=`${row.label} · NOT_APPLICABLE ${row.counts.NOT_APPLICABLE}개 제외 · 근거 보기`;
      item.append(button);host.append(item);
    }
    if(!rows.length)host.append(node('li','저장된 검증 근거 없음','overview-empty'));
  }
}
function populateTrendSource(){
  const select=$('#overview-trend-source'),previous=state.selectedSource;select.replaceChildren();
  for(const [metric,value,label]of [['NETWORK_CIRCULATING','history','일별 유통량'],['NETWORK_MINTED','minted','일별 발행 잔액']]){
    if(state.registration?state.registration.coins.find(c=>c.id===$('#overview-trend-coin').value)?.metrics.some(m=>m.metric===metric):!state.registrationFailed&&state.market?.supplyHistory?.some(s=>s.metric===metric)){const option=node('option',label);option.value=value;select.append(option);}
  }
  const available=select.options.length>0;
  if(!available){const option=node('option','일별 자료 미확보');option.value='history';select.append(option);}
  select.disabled=!available;
  if([...select.options].some(o=>o.value===previous))select.value=previous;
  else if(available&&scopeReady()){state.selectedSource=select.value;state.selectedNetwork='all';}
  if(!state.sourceInitialized&&available)state.period='1y';state.sourceInitialized||=!!(state.registration||state.market);
  updateTrendPeriods();
}
function updateTrendPeriods(){for(const b of $('#overview-trend-period').querySelectorAll('button[data-period]')){b.hidden=['24h','7d'].includes(b.dataset.period);b.setAttribute('aria-pressed',String(b.dataset.period===state.period));}for(const b of $('#overview-trend-period').querySelectorAll('button[data-comparison]'))b.setAttribute('aria-pressed',String(b.dataset.comparison===state.comparison));}
function populateTrendNetworks(){
  const select=$('#overview-trend-network'),previous=state.selectedNetwork,data=trendData(),coinId=$('#overview-trend-coin').value;
  select.replaceChildren();
  const all=node('option','모든 네트워크');all.value='all';select.append(all);
  const available=data?networkSupplySeries(data,coinId,{source:$('#overview-trend-source').value}):[];
  for(const group of available){const option=node('option',group.network.name);option.value=group.network.id;select.append(option);}
  if(available.some(s=>s.network.id===previous))select.value=previous;else select.value='all';
  if(!available.length){select.replaceChildren();const option=node('option','표시할 네트워크 없음');option.value='';select.append(option);}
  select.disabled=!available.length;
  const metric=$('#overview-trend-source').value==='minted'?'NETWORK_MINTED':'NETWORK_CIRCULATING';
  const ready=scopeReady()&&(state.registration?sameRegisteredSource(state.detail,state.registration,{coinId,metric}):!!data);
  // Empty/loading/failed responses do not prove that a saved network disappeared.
  if(ready){state.selectedNetwork=select.value||'all';rememberTrend();}
}
function renderMarketTrend(){
  if(state.trendLoading||state.loading&&!state.market&&!state.registration&&!state.registrationFailed)return;
  const host=$('#overview-market-trend'),chains=$('#overview-chain-breakdown'),note=$('#overview-trend-note');
  const chainScroll=chains.scrollTop;host.replaceChildren();chains.replaceChildren();
  if(!trendData()){host.append(node('p',state.registrationFailed?'공급량 저장 자료를 읽지 못했습니다. 다시 읽어주세요.':'시장 자료를 읽으면 네트워크별 공급량 추이를 표시합니다.','empty-state'));note.textContent=state.registrationFailed?'공급량 조회 실패':'시장 자료 미확보';note.hidden=false;return;}
  const data=trendData(),coinId=$('#overview-trend-coin').value,networkId=$('#overview-trend-network').value,source=$('#overview-trend-source').value;
  const minted=source==='minted',metricLabel=minted?'발행 잔액':'유통량';
  const coin=data.registry.coins.find(c=>c.id===coinId),network=data.registry.networks.find(n=>n.id===networkId);
  const deployment=data.registry.deployments.find(d=>d.coinId===coinId&&d.networkId===networkId);
  const title=`${coin?.symbol??'토큰'} · ${networkId==='all'?'네트워크별':network?.name??'네트워크'} ${metricLabel} 추이`;
  const info=state.registration?registeredCoinInfoButton(state.registration,state.market,coinId,title+' ⓘ',networkId):deployment?tokenInfoButton(data,deployment.id,title+' ⓘ'):null;
  $('#overview-trend-title').replaceChildren(info??document.createTextNode(title));
  $('#overview-trend-scope').textContent=`일별 ${metricLabel}${state.registration?' · '+coin.pegCurrency+' 연동':''}`;
  $('.overview-chain-panel h3').textContent='상위 최대 10개 네트워크';
  $('.overview-chain-panel > .muted').textContent=`${metricLabel} (tokens)`;
  $('.overview-chain-panel h3').title='네트워크 선정은 USD 환산 유통가치 기준이며, 아래 값은 토큰 수량입니다.';
  renderNetworkSupplyChart(host,data,coinId,{period:state.period,networkId,comparison:state.comparison,source,profileButton:(id,network)=>state.registration?registeredCoinInfoButton(state.registration,state.market,coinId,'ⓘ',network):tokenInfoButton(data,id)});
  const coinNotes=state.registration?.coins.find(c=>c.id===coinId)?.notes??[];note.textContent=state.trendError?'공급량 자료를 읽지 못했습니다. 다시 읽어주세요.':coinNotes.join(' ');note.hidden=!note.textContent;
  const rows=networkSupplySeries(data,coinId,{source}).map(s=>({networkId:s.network.id,amount:s.rows.at(-1).amount})).sort((a,b)=>units(a.amount)>units(b.amount)?-1:units(a.amount)<units(b.amount)?1:0);
  $('.overview-chain-panel > .muted').textContent=`${metricLabel} (tokens) · ${rows.length}개 표시`;
  for(const row of rows){
    const network=data.registry.networks.find(n=>n.id===row.networkId),item=node('button',undefined,'overview-chain-item'),heading=node('div');
    heading.append(node('strong',network.name),node('span',displayAmount(row.amount)));
    item.type='button';item.dataset.network=row.networkId;item.setAttribute('aria-pressed',String(row.networkId===networkId));item.setAttribute('aria-label',`${coin.symbol} · ${network.name} ${metricLabel} 추이 보기`);item.addEventListener('click',()=>{$('#overview-trend-network').value=row.networkId;state.selectedNetwork=row.networkId;rememberTrend();renderMarketTrend();$('#overview-chain-breakdown').querySelector(`[data-network="${row.networkId}"]`)?.focus({preventScroll:true});});
    const track=node('div',undefined,'track'),fill=node('span',undefined,'track-fill');fill.style.width=ratio(row.amount,rows[0].amount)+'%';track.append(fill);item.append(heading,track);chains.append(item);
  }
  if(!rows.length)chains.append(node('p','체인별 공급량 미확보','muted'));
  chains.scrollTop=chainScroll;
}
function renderMarket(){
  const select=$('#overview-trend-coin'),previous=state.selectedCoin;select.replaceChildren();
  for(const coin of trendData()?.registry.coins??[]){const option=node('option',coin.symbol);option.value=coin.id;select.append(option);}
  if(trendData()?.registry.coins.some(c=>c.id===previous))select.value=previous;
  else if(select.options.length&&scopeReady()){state.selectedCoin=select.value;state.selectedNetwork='all';}
  select.disabled=!trendData();
  populateTrendSource();populateTrendNetworks();renderMarketTrend();
  renderMarketTable();
}
function renderMarketTable(){
 const host=$('#overview-market-rows');host.replaceChildren();
 $('#overview-price-currency').value=state.currency;saveCurrency(state.currency);$('#overview-market-price-label').textContent='가격 ('+state.currency+')';
 const fxNote=$('#overview-fx-note');fxNote.hidden=state.currency!=='KRW';fxNote.textContent=usableFX(state.fx)?'환율 기준 '+state.fx.date+' · 참고 환산':'원화 환산용 환율 자료 미확보';
 const rows=overviewMarketRows(state.market,state.registration);
 const metricCell=(value,price=false)=>{
  const cell=node('td');if(!value){cell.append(node('span','—','muted'));cell.title='자료 미확보';return cell;}
  cell.textContent=price?priceLabel(value.amount,state.currency,state.fx):displayAmount(value.amount);
  cell.title=`${value.amount} ${price?'USD':'tokens'} · ${value.day?'일별 기준 '+value.day+' · ':''}${value.observedAt?'기준시각 '+when(value.observedAt):price?'가격 기준시각 미제공':'기준시각 미제공'} · 수집 ${when(value.fetchedAt)}${price&&state.currency==='KRW'?' · 참고 원화 환산 · 환율 기준 '+(state.fx?.date??'미확보'):''}`;
  return cell;
 };
 for(const row of rows){
  const tr=node('tr'),asset=node('th');asset.scope='row';
  const info=registeredCoinInfoButton(state.registration,state.market,row.coin.id,row.coin.symbol+' ⓘ');
  const identity=node('span',undefined,'market-token-identity');identity.append(info??node('strong',row.coin.symbol),node('span',row.coin.name,'market-token-name'),node('span',row.pegCurrency,'market-peg'));asset.append(identity);asset.title=row.coin.name+' · '+row.pegCurrency+' 연동';
  const clocks=[row.price,row.circulating,row.total].filter(Boolean).map(v=>v.fetchedAt).sort(),updated=node('td',clocks.length?new Date(clocks.at(-1)).toLocaleDateString('sv-SE').replaceAll('-','.')+' '+new Date(clocks.at(-1)).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'—','market-updated');
  updated.title=clocks.length?'업데이트 '+when(clocks.at(-1))+' · 지표별 기준시각은 해당 값에서 확인할 수 있습니다.':'자료 미확보';
  const action=node('td'),button=node('button','차트 보기','market-chart-link');button.type='button';button.setAttribute('aria-label',row.coin.symbol+' 공급량 차트 보기');
  button.addEventListener('click',()=>{const select=$('#overview-trend-coin');if(![...select.options].some(o=>o.value===row.coin.id))return;select.value=row.coin.id;select.dispatchEvent(new Event('change'));$('#overview-trend-title').scrollIntoView({behavior:'smooth',block:'start'});});
  button.disabled=![...$('#overview-trend-coin').options].some(o=>o.value===row.coin.id);action.append(button);
  tr.append(asset,metricCell(row.price,true),metricCell(row.circulating),metricCell(row.total),updated,action);host.append(tr);
 }
 if(!rows.length){const tr=node('tr'),cell=node('td','시장 자료를 읽지 못했습니다. 다시 읽어주세요.','muted');cell.colSpan=6;tr.append(cell);host.append(tr);}
}

async function loadTrend(){
  const sequence=++trendSequence;trendAbort?.abort();trendFinish?.();trendFinish=null;state.trendLoading=false;
  if(!state.registration){populateTrendNetworks();renderMarketTrend();return;}
  trendAbort=new AbortController();
  const coinId=$('#overview-trend-coin').value,metric=$('#overview-trend-source').value==='minted'?'NETWORK_MINTED':'NETWORK_CIRCULATING';
  if(!state.registration.coins.find(c=>c.id===coinId)?.metrics.some(m=>m.metric===metric)){state.detail=null;state.trendError=false;state.trendLoading=false;populateTrendNetworks();renderMarketTrend();return;}
  if(sameRegisteredSource(state.detail,state.registration,{coinId,metric})){state.trendError=false;populateTrendNetworks();renderMarketTrend();return;}
  const previous=state.detail?.coinId===coinId&&state.detail?.metric===metric&&state.detail?.selectionId===state.registration.selectionId?state.detail:null;
  state.detail=previous;state.trendError=false;state.trendLoading=true;populateTrendNetworks();
  $('#overview-chain-breakdown').replaceChildren();
  $('#overview-trend-title').textContent=`${state.registration.coins.find(c=>c.id===coinId).symbol} · 네트워크별 ${metric==='NETWORK_MINTED'?'발행 잔액':'유통량'} 추이`;
  const finish=beginLoading($('#overview-market-trend'),{ready:!!previous,targets:[[$('#overview-market-trend'),'chart']]});trendFinish=finish;
  try{
    const requestIndex=state.registration,pin=requestIndex.coins.find(c=>c.id===coinId).metrics.find(m=>m.metric===metric);
    const query=new URLSearchParams({selection:requestIndex.selectionId,coin:coinId,metric});
    const data=await json('/registration-history.json?'+query,{signal:trendAbort.signal,revalidate:true,validate:d=>validateRegisteredHistory(d,requestIndex,{coinId,metric}),context:JSON.stringify([pin.sourceId,pin.from,pin.to])});
    if(sequence!==trendSequence)return;
    state.detail=validateRegisteredHistory(data,state.registration,{coinId,metric});
  }catch{if(sequence===trendSequence)state.trendError=true;}
  finally{if(sequence===trendSequence){finish();trendFinish=null;state.trendLoading=false;populateTrendNetworks();renderMarketTrend();}}
}
let cacheRefreshPending=false;
const overviewCacheMatch=url=>url!=='/asset-review-data.json'&&url!=='/contract-review-data.json'&&url!=='/mock-data.json';
bindCacheStatus($('#overview-screen'),overviewCacheMatch);
browserData.subscribe(event=>{if(event.updated&&overviewCacheMatch(event.url)){if(state.loading)cacheRefreshPending=true;else if(state.loaded)load();}});
async function load(){
  if(state.loading)return;state.loading=true;$('#overview-reload').disabled=true;
  const finish=beginLoading($('#overview-screen'),{ready:!!(state.index||state.market),targets:[['#overview-market-trend','chart'],['#overview-chain-breakdown','rows'],['#overview-market-rows','rows'],['#overview-activity-rows','rows'],['#overview-reviewed-rows','rows'],['#overview-survey-rows','rows'],['#overview-metrics','cards']]});
  try {
  const results=await Promise.allSettled([publicMode?Promise.resolve(null):json('/evidence/index.json').then(dashboardEvidence),json('/market-data.json').then(validateMarket),json('/registration-index.json',{optional:true}).then(x=>x===null?null:validateRegistrationIndex(x)),json('/fx-data.json').then(validateFX),json('/activity-data.json',{optional:true}).then(x=>x===null?null:validateActivity(x)),json('/reviewed-supply-data.json',{optional:true}).then(x=>x===null?null:validateReviewedSupply(x)),json('/survey-data.json',{optional:true}).then(x=>x===null?null:validateStoredSurvey(x)),publicMode?Promise.resolve(null):json('/geography-data.json').then(validateGeography)]);
  const failed=[];
  for(const [index,key]of ['index','market'].entries()){
    if(results[index].status==='fulfilled')state[key]=results[index].value;
    else failed.push(index===0?'검증 근거':'시장 자료');
  }
  if(results[2].status==='fulfilled'){state.registration=results[2].value;state.registrationFailed=false;}else{state.registrationFailed=true;failed.push('공급량 자료');}
  if(results[3].status==='fulfilled')state.fx=results[3].value;
  if(results[3].status==='rejected'||!usableFX(state.fx))failed.push('참고 환율(FX)');
  const selected=providerChoice({primary:results[4].status==='fulfilled'?results[4].value:null,lastGood:activity,failed:results[4].status==='rejected'});activity=selected.data;activityState=selected.state;
  reviewedSupply=reviewedSupplyChoice(reviewedSupply.data,results[5]);
  survey=storedSurveyChoice(survey.data,results[6]);if(results[6].status==='rejected')failed.push('Allium 저장 자료');
  if(!publicMode)geography=geographyChoice(geography.data,results[7]);
  state.marketFailed=results[1].status!=='fulfilled';
  if(!publicMode){renderEvidence();renderEvidenceRankings();}renderMarket();renderActivity();renderSupply();renderStoredSurvey();if(!publicMode)renderGeography($('#overview-geography'),geography);
  await renderSupplyOverview({index:state.registration,market:state.market,indexFailed:state.registrationFailed,survey});
  const collectionFailed=state.market?.collectionState?.state==='FAILED'||state.market?.lastBuildState==='FAILED';
  $('#overview-error').hidden=!failed.length&&!collectionFailed;
  $('#overview-error').textContent=failed.length?`${failed.join(' · ')}를 읽지 못했습니다. 이전 정상 자료가 있으면 원래 시각을 유지해 표시합니다.`:'최근 시장 수집 또는 자료 생성 실패 · 마지막 정상 자료와 원본 관측 시각을 표시합니다.';
  }catch{$('#overview-error').hidden=false;$('#overview-error').textContent='화면 표시 중 오류가 발생했습니다. 다시 읽어주세요.';}
  finally {finish();state.loading=false;state.loaded=true;$('#overview-reload').disabled=false;if(cacheRefreshPending){cacheRefreshPending=false;queueMicrotask(load);}}
}
function activate(){if(!$('#overview-screen').hidden&&!state.loaded)load();}
$('#overview-reload').addEventListener('click',load);$('#overview-scope')?.addEventListener('change',()=>{renderEvidence();renderEvidenceRankings();});$('#overview-rank-metric')?.addEventListener('change',renderEvidenceRankings);$('#overview-theme').addEventListener('click',()=>$('#theme-toggle').click());
const theme=()=>{$('#overview-theme').textContent=document.documentElement.dataset.theme==='light'?'☾ 다크':'☀ 라이트';};
new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});theme();
document.addEventListener('atlas:navigate',activate);activate();
setInterval(()=>{if(!$('#overview-screen').hidden&&!document.hidden)load();},60000);

$('#overview-trend-coin').addEventListener('change',()=>{state.selectedCoin=$('#overview-trend-coin').value;state.selectedNetwork='all';$('#overview-trend-network').value='all';populateTrendSource();rememberTrend();loadTrend();});
$('#overview-trend-network').addEventListener('change',()=>{state.selectedNetwork=$('#overview-trend-network').value;rememberTrend();renderMarketTrend();});
$('#overview-trend-period').addEventListener('click',event=>{const button=event.target.closest('button[data-period]');if(!button)return;state.period=button.dataset.period;rememberTrend();for(const item of $('#overview-trend-period').querySelectorAll('button[data-period]'))item.setAttribute('aria-pressed',String(item===button));renderMarketTrend();});
let overviewTrendWidth=0;
new ResizeObserver(entries=>{const bounds=entries[0].contentRect;$('#overview-chain-breakdown').style.setProperty('--supply-list-height',Math.max(180,Math.round(bounds.height)-60)+'px');const width=Math.round(bounds.width);if(width>0&&width!==overviewTrendWidth){overviewTrendWidth=width;renderMarketTrend();}}).observe($('#overview-market-trend'));

$('#overview-trend-source').addEventListener('change',()=>{state.selectedSource=$('#overview-trend-source').value;state.selectedNetwork='all';state.period='1y';rememberTrend();updateTrendPeriods();$('#overview-trend-network').value='all';loadTrend();});

$('#overview-trend-period').addEventListener('click',event=>{const button=event.target.closest('button[data-comparison]');if(!button)return;state.comparison=button.dataset.comparison;rememberTrend();for(const item of $('#overview-trend-period').querySelectorAll('button[data-comparison]'))item.setAttribute('aria-pressed',String(item===button));renderMarketTrend();});

$('#overview-price-currency').addEventListener('change',()=>{state.currency=$('#overview-price-currency').value;saveCurrency(state.currency);renderMarketTable();});
