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
