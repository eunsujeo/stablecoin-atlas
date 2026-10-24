import {units} from './market-model.js';

export const DASHBOARD_METRICS = {CIRCULATING:'코인 전체 유통량', CHAIN_TOTAL:'체인별 총공급량', PRICE:'저장 가격'};
export const PERIODS = { '24h':86400000, '7d':604800000, '30d':2592000000, all:null };
export const NETWORK_COLORS = {ethereum:'#75b5ff',solana:'#c2a0ff',tron:'#f1a17f',xrpl:'#8ac9be'};
export const seriesIdentity = row => JSON.stringify([row.coinId,row.deploymentId,row.metric,row.unit,row.provider,row.endpoint,row.selector]);
export function decimalString(value) {
  const sign=value<0n?'-':'';value=value<0n?-value:value;
  const scale=10n**36n,tail=String(value%scale).padStart(36,'0').replace(/0+$/,'');
  return sign+String(value/scale)+(tail?'.'+tail:'');
}
export function change(current,previous) {
  if(current===null||previous===null)return {amount:null,percent:null,reason:'이전 관측 없음'};
  const a=units(current),b=units(previous),delta=a-b;
  const hundredths=b===0n?null:delta*10000n/b;
  return {amount:decimalString(delta),percent:hundredths===null?null:(hundredths<0n?'-':delta<0n?'-':'')+String((hundredths<0n?-hundredths:hundredths)/100n)+'.'+String((hundredths<0n?-hundredths:hundredths)%100n).padStart(2,'0'),reason:b===0n?'이전 값이 0':null};
}
export function parseDashboardFilters(search,registry) {
  const q=new URLSearchParams(search),metric=Object.hasOwn(DASHBOARD_METRICS,q.get('metric'))?q.get('metric'):'CIRCULATING';
  return {coin:registry.coins.some(c=>c.id===q.get('coin'))?q.get('coin'):registry.coins[0]?.id??'',metric,
    network:metric==='CHAIN_TOTAL'&&registry.networks.some(n=>n.id===q.get('network'))?q.get('network'):'all',
    period:Object.hasOwn(PERIODS,q.get('period'))?q.get('period'):'24h',
    sort:['time-desc','time-asc','amount-desc','amount-asc'].includes(q.get('sort'))?q.get('sort'):'time-desc',
    page:/^[1-9]\d{0,3}$/.test(q.get('page')??'')?Number(q.get('page')):1};
}
export function filterSearch(filters) {
  return '?'+new URLSearchParams(Object.entries(filters).map(([k,v])=>[k,String(v)])).toString();
}
// Thirty minutes is an explicit display gap policy, never evidence of continuous collection.
export const MAX_GAP_MS=1800000;
export function contiguousSegments(rows) {
  const segments=[];
  for(const row of rows){const last=segments.at(-1);if(!last||Date.parse(row.observedAt)-Date.parse(last.at(-1).observedAt)>MAX_GAP_MS)segments.push([row]);else last.push(row);}
  return segments;
}
export function downsample(rows,limit=240) {
  if(rows.length<=limit)return rows;
  const chosen=new Set([0,rows.length-1]),buckets=Math.max(1,Math.floor((limit-2)/2));
  for(let i=0;i<buckets;i++){
    const from=1+Math.floor(i*(rows.length-2)/buckets),to=1+Math.floor((i+1)*(rows.length-2)/buckets);
    let low=from,high=from;
    for(let j=from+1;j<to;j++){if(units(rows[j].amount)<units(rows[low].amount))low=j;if(units(rows[j].amount)>units(rows[high].amount))high=j;}
    chosen.add(low);chosen.add(high);
  }
  return [...chosen].sort((a,b)=>a-b).map(i=>rows[i]);
}
function canonicalGroups(data,filters) {
  const groups=new Map();
  for(const row of data.observations){
    if(row.coinId!==filters.coin||row.metric!==filters.metric||filters.metric==='CHAIN_TOTAL'&&filters.network!=='all'&&row.networkId!==filters.network)continue;
    if(data.readState&&(row.observedAt<data.readState.historyFrom||row.observedAt>=data.readState.historyTo))continue;
    const key=seriesIdentity(row);if(!groups.has(key))groups.set(key,new Map());
    const sameTime=groups.get(key),old=sameTime.get(row.observedAt);
    if(!old||row.id>old.id)sameTime.set(row.observedAt,row);
  }
  return [...groups].map(([key,times])=>({key,rows:[...times.values()].sort((a,b)=>a.observedAt.localeCompare(b.observedAt))}));
}
export function dashboardView(data,filters,pageSize=12) {
  const groups=canonicalGroups(data,filters),end=Math.max(...groups.flatMap(g=>g.rows.map(r=>Date.parse(r.observedAt)))),span=PERIODS[filters.period];
  const start=Number.isFinite(end)&&span!==null?end-span:-Infinity;
  const series=groups.map(g=>({...g,rows:g.rows.filter(r=>Date.parse(r.observedAt)>=start)})).filter(g=>g.rows.length);
  const rows=series.flatMap(g=>g.rows),ordered=[...rows].sort((a,b)=>{
    const amount=filters.sort.startsWith('amount'),direction=filters.sort.endsWith('asc')?1:-1;
    const compare=amount?(units(a.amount)<units(b.amount)?-1:units(a.amount)>units(b.amount)?1:0):a.observedAt.localeCompare(b.observedAt);
    return direction*compare||a.id.localeCompare(b.id);
  });
  const pages=Math.max(1,Math.ceil(rows.length/pageSize)),page=Math.min(Math.max(1,filters.page),pages);
  const single=series.length===1?series[0]:null,last=single?.rows.at(-1)??null,first=single?.rows[0]??null;
  let previous={amount:null,percent:null,reason:'이전 동기간 자료 부족'};
  if(single&&span!==null&&!data.readState?.sampled&&!data.readState?.latestRequestFailures&&!data.readState?.latestMissingFields&&data.lastBuildState!=='FAILED'){
    const all=groups.find(g=>g.key===single.key).rows,prior=all.filter(r=>Date.parse(r.observedAt)>=start-span&&Date.parse(r.observedAt)<start);
    const complete=rs=>rs.length>1&&contiguousSegments(rs).length===1;
    if(prior.length&&complete(prior)&&complete(single.rows)&&Date.parse(prior[0].observedAt)<=start-span+MAX_GAP_MS&&start-Date.parse(prior.at(-1).observedAt)<=MAX_GAP_MS&&Date.parse(first.observedAt)-start<=MAX_GAP_MS)
      previous=change(last.amount,prior.at(-1).amount);
  }
  return {series,rows,ordered,table:ordered.slice((page-1)*pageSize,page*pageSize),pages,page,start,end,last,first,
    interval:single&&single.rows.length>1?change(last.amount,first.amount):{amount:null,percent:null,reason:series.length>1?'계열별로 확인':'관측 2개 필요'},
    previous,gaps:series.reduce((sum,g)=>sum+Math.max(0,contiguousSegments(g.rows).length-1),0),
    expectedNetworks:filters.metric==='CHAIN_TOTAL'?data.registry.deployments.filter(d=>d.coinId===filters.coin&&(filters.network==='all'||d.networkId===filters.network)).map(d=>d.networkId):[],
  };
}
