import {validateMarket,latest,units} from './market-model.js';
import {validateRegistrationIndex} from './registration-model.js';
const legacyCoins=new Set(['usdt','usdc','rlusd']);
// Explicit provider/scope selection. A missing metric never triggers provider fallback.
export function overviewMarketRows(market,index){
 if(market)validateMarket(market);if(index)validateRegistrationIndex(index);
 const coins=index?.coins??market?.registry.coins??[];
 const arkham=(coinId,metric)=>{
  const row=market?latest(market,{coinId,metric}).filter(r=>r.provider==='ARKHAM'&&r.deploymentId===null&&r.endpoint.startsWith('/token/market/')).sort((a,b)=>b.observedAt.localeCompare(a.observedAt)||b.id.localeCompare(a.id))[0]:null;
  return row?{amount:row.amount,observedAt:row.sourceAt,fetchedAt:row.observedAt,day:null}:null;
 };
 const rows=coins.map(coin=>{
  const daily=coin.market,field=name=>daily?.[name].state==='AVAILABLE'?{amount:daily[name].amount,observedAt:null,fetchedAt:daily.fetchedAt,day:daily[name].day??null}:null;
  const legacy=legacyCoins.has(coin.id);
  return {coin,pegCurrency:coin.pegCurrency??'USD',price:legacy?arkham(coin.id,'PRICE'):field('price'),circulating:legacy?arkham(coin.id,'CIRCULATING'):field('circulating'),total:legacy?arkham(coin.id,'COIN_TOTAL'):null,volume:null};
 });
 // Native quantities compare only within the same peg currency. No combined rank.
 return rows.sort((a,b)=>a.pegCurrency!==b.pegCurrency?(a.pegCurrency==='USD'?-1:1):a.circulating&&b.circulating?(units(a.circulating.amount)>units(b.circulating.amount)?-1:units(a.circulating.amount)<units(b.circulating.amount)?1:a.coin.symbol.localeCompare(b.coin.symbol)):a.circulating?-1:b.circulating?1:a.coin.symbol.localeCompare(b.coin.symbol));
}
