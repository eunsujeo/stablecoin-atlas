import { validateIndex, VERDICTS, reportLinks } from './evidence-model.js';
import { validateMarket, displayAmount, latest } from './market-model.js';
import { overviewSummary, overviewRanking } from './overview-model.js';
const $=selector=>document.querySelector(selector);
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;};
const state={index:null,market:null,loading:false,loaded:false};
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
  if(!state.index){host.append(node('p','저장된 검증 근거가 없습니다. 점수와 등급을 산정하지 않습니다.','semantic-note'));return;}
  const summary=overviewSummary(state.index,$('#overview-scope').value);
  const grade=summary.grade===null?'등급 없음':`${summary.provisional?'잠정 ':''}${summary.grade}`;
  for(const [label,value,note,cls] of [
    ['확정 판정 중 통과 점수',summary.score===null?'미산정':`${summary.score} / 100`,`${grade} · PASS ${summary.counts.PASS} / 판정 완료 ${summary.decisive}`,'lead-purple'],
    ['판정 완료 비율',summary.coverage===null?'미산정':`${summary.coverage}%`,`${summary.decisive} / 대상 ${summary.applicable}개 · 비적용 제외`,'lead-teal'],
    ['실패 시나리오',summary.counts.FAIL,'자산 안전성 점수와 별도',''],
    ['집계 보고서',summary.reports.length,`선택 ${summary.total} / 전체 ${state.index.items.length}개 항목`,''],
  ]){const card=node('article',undefined,`metric-card ${cls}`),valueRow=node('div',undefined,'metric-value');valueRow.append(node('strong',value));if(cls==='lead-purple')valueRow.append(node('span',grade,'grade'));card.append(node('p',label),valueRow,node('p',note));host.append(card);}
  for(const verdict of VERDICTS){const button=node('button',undefined,`overview-verdict verdict-${verdict.toLowerCase()}`);button.append(node('span',labels[verdict]),node('strong',summary.counts[verdict]),node('small',verdict));button.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('atlas:show-verdict',{detail:{scope:summary.scope,verdict,reportIds:summary.reports.map(r=>r.id)}})));verdicts.append(button);}
  $('#overview-result-note').textContent=`${summary.scope==='LOCAL_FIXTURE'?'사설 Fixture 실행':'실제 자산의 저장된 읽기'} · ${summary.provisional?'미확인·미실행 항목이 남아 잠정 등급입니다.':'선택 범위의 판정 결과입니다.'} 실행 오류 ${summary.executionCounts.ERROR} · 미실행 ${summary.executionCounts.NOT_EXECUTED}건. ${summary.scope==='LOCAL_FIXTURE'?'예상 음성의 FAIL도 원시 판정 그대로 포함하며 자동 테스트 통과율과 다릅니다. ':''}결과를 누르면 항목별 근거로 이동합니다.`;
  const reports=$('#overview-selected-reports');reports.replaceChildren();for(const report of summary.reports){const item=node('li'),link=node('a',report.label+' · '+when(report.completedAt));link.href=reportLinks(report.id).document;link.target='_blank';link.rel='noopener noreferrer';item.append(link);reports.append(item);}
}
function renderMarket(){
  for(const [metric,target] of [['CIRCULATING','circulating'],['COIN_TOTAL','total']]){
    const host=$('#overview-'+target);host.replaceChildren();
    const rows=state.market?overviewRanking(state.market,metric):[];
    for(const [index,row]of rows.entries()){
      const coin=state.market.registry.coins.find(c=>c.id===row.coinId),item=node('li'),link=node('a',undefined,'overview-rank-row');link.href='#live';
      link.append(node('span',index+1,'rank-number'),node('strong',coin.symbol),node('span',displayAmount(row.amount),'overview-rank-value'),node('small',when(row.observedAt),'muted'));
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
  try {
  const results=await Promise.allSettled([json('/evidence/index.json').then(validateIndex),json('/market-data.json').then(validateMarket)]);
  const failed=[];
  for(const [index,key]of ['index','market'].entries()){
    if(results[index].status==='fulfilled')state[key]=results[index].value;
    else failed.push(index===0?'검증 근거':'시장 자료');
  }
  renderEvidence();renderMarket();
  const collectionFailed=state.market?.collectionState?.state==='FAILED'||state.market?.lastBuildState==='FAILED';
  $('#overview-error').hidden=!failed.length&&!collectionFailed;
  $('#overview-error').textContent=failed.length?`${failed.join(' · ')}를 읽지 못했습니다. 이전 정상 자료가 있으면 원래 시각을 유지해 표시합니다.`:'최근 시장 수집 또는 자료 생성 실패 · 마지막 정상 자료와 원본 관측 시각을 표시합니다.';
  $('#overview-status').textContent=`화면 확인 ${when(new Date().toISOString())} · 근거 문서 ${state.index?when(state.index.generatedAt):'미확보'} · 시장 자료 ${state.market?when(state.market.publishedAt):'미확보'} · 60초마다 저장본 재독`;
  }catch{$('#overview-error').hidden=false;$('#overview-error').textContent='저장 자료를 표시하지 못했습니다. 다시 읽어주세요.';}
  finally {state.loading=false;state.loaded=true;$('#overview-reload').disabled=false;}
}
function activate(){if(!$('#overview-screen').hidden&&!state.loaded)load();}
$('#overview-reload').addEventListener('click',load);$('#overview-scope').addEventListener('change',renderEvidence);$('#overview-theme').addEventListener('click',()=>$('#theme-toggle').click());
const theme=()=>{$('#overview-theme').textContent=document.documentElement.dataset.theme==='light'?'☾ 다크':'☀ 라이트';};
new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});theme();
document.addEventListener('atlas:navigate',activate);activate();
setInterval(()=>{if(!$('#overview-screen').hidden&&!document.hidden)load();},60000);
