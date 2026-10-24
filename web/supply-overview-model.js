import {alliumSeries} from './allium-dashboard-model.js';
import {surveyWindow} from './survey-model.js';
import {units} from './market-model.js';
import {validateRegisteredHistory,sameRegisteredSource} from './registration-model.js';
export const overviewCoins=['usdc','usdt','rlusd','jpysc','jpyc'];
const metric='NETWORK_CIRCULATING';
// At most two local stored-history reads; no provider requests or retries.
export async function readOverviewHistories(index,read,previous=[]){
 const coins=overviewCoins.filter(id=>index.coins.find(c=>c.id===id)?.metrics.some(m=>m.metric===metric));
 const results=new Array(coins.length);let next=0;
 async function worker(){while(next<coins.length){const slot=next++,coinId=coins[slot];
  try{const query=new URLSearchParams({selection:index.selectionId,coin:coinId,metric});
   const detail=validateRegisteredHistory(await read('/registration-history.json?'+query),index,{coinId,metric});results[slot]={detail,failed:false};
  }catch{results[slot]={detail:previous.find(d=>sameRegisteredSource(d,index,{coinId,metric}))??null,failed:true};}
 }}
 await Promise.all([worker(),worker()]);return {details:results.flatMap(r=>r.detail?[r.detail]:[]),failed:results.some(r=>r.failed)};
}
export function overviewSupplyGroups(details,{period='1y'}={}){
 const days={'30d':30,'90d':90,'1y':365}[period];if(!days)throw Error('INVALID_SUPPLY_PERIOD');
 const end=details.map(d=>d.to).sort().at(-1);if(!end)return {groups:[],from:null,to:null};
 const from=new Date(Date.parse(end)-days*86400000).toISOString().slice(0,10);
 return {from,to:end,groups:overviewCoins.flatMap(coinId=>details.filter(d=>d.coinId===coinId&&d.metric===metric).flatMap(d=>d.series.map(s=>({
  key:coinId+':'+s.networkId,coinId,networkId:s.networkId,updatedAt:d.updatedAt,
  network:{id:coinId+':'+s.networkId,name:coinId.toUpperCase()+' · '+s.networkId.toUpperCase()},
  rows:s.points.filter(p=>p.day>=from&&p.day<=end).map(p=>({amount:p.amount,observedAt:p.day+'T00:00:00.000Z'})),
 })).filter(s=>s.rows.length)))};
}
export function legacyOverviewDetails(market){
 return (market?.supplyHistory??[]).filter(s=>s.provider==='DEFILLAMA'&&s.metric===metric).map(s=>({...s,updatedAt:s.fetchedAt,series:s.networks}));
}

// Ranking uses each network's last actual observation; no totals or missing-value fill.
export function overviewNetworkRanking(groups){
 const sorted=groups.filter(g=>g.rows.length).map(g=>({...g,last:g.rows.at(-1)})).sort((a,b)=>{
  const av=units(a.last.amount),bv=units(b.last.amount);return av===bv?a.networkId.localeCompare(b.networkId):av>bv?-1:1;
 });
 let rank=0,previous;
 return sorted.map((g,i)=>{const amount=units(g.last.amount);if(amount!==previous)rank=i+1;previous=amount;
  return {...g,rank,width:sorted.length&&units(sorted[0].last.amount)>0n?Number(amount*10000n/units(sorted[0].last.amount))/100:0};
 });
}
export function supplyQuantityLabel(amount){
 const value=units(amount),scale=10n**36n;
 for(const [size,label]of [[1000000000000n,'조'],[100000000n,'억'],[10000n,'만']])if(value>=size*scale){
  const n=value*100n/(size*scale);return String(n/100n)+(n%100n?'.'+String(n%100n).padStart(2,'0').replace(/0$/,''):'')+label;
 }
 const [whole,tail='']=amount.split('.');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(tail?'.'+tail.slice(0,4)+(tail.length>4?'…':''):'');
}

export function overviewTransferGroups(data,coinId){
 const snapshot=data?.snapshots.find(s=>s.survey==='volume');if(!snapshot)return {groups:[],from:null,to:null};
 const window=data.window??snapshot.window??surveyWindow;
 return {from:window.from,to:new Date(Date.parse(window.untilExclusive)-86400000).toISOString().slice(0,10),
  groups:alliumSeries(data,coinId,'volume','transfer_volume').map(s=>({key:s.coinId+':'+s.networkId,coinId:s.coinId,networkId:s.networkId,updatedAt:s.queriedAt,
   network:{id:s.coinId+':'+s.networkId,name:s.networkId.toUpperCase()},dateBasis:window.dateBasis??'PROVIDER_DAY',aggregateTimezone:window.aggregateTimezone??'UNKNOWN',
   rows:s.points.map(p=>({amount:p.amount,observedAt:p.day+'T00:00:00.000Z'})),
  }))};
}
