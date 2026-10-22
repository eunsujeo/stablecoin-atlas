import {createHash} from 'node:crypto';
import {historyAssets,historyChains,validateSupplyHistory} from '../web/supply-history-model.js';
export const sourceByteLimit=32*1024*1024;
export const hashHistory=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw Error('HISTORY_INVALID');};
export function parseHistorySource(bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>sourceByteLimit)fail();
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);let depth=0,quoted=false,escaped=false;
 for(const c of text){if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{'||c==='['){if(++depth>32)fail();}else if(c==='}'||c===']')depth--;}
 return JSON.parse(text,(_k,v,context)=>typeof v==='number'?context.source:v);
}
export function historyProjection(bytes,coinId,registry,fetchedAt,{metric='NETWORK_CIRCULATING'}={}){
 if(!Object.hasOwn(historyAssets,coinId)||!['NETWORK_CIRCULATING','NETWORK_MINTED'].includes(metric))fail();const asset=historyAssets[coinId];const data=parseHistorySource(bytes);
 if(data.id!==asset.id||data.symbol!==asset.symbol||data.gecko_id!==asset.gecko||data.pegType!=='peggedUSD'||!data.chainBalances||typeof fetchedAt!=='string'||!Number.isFinite(Date.parse(fetchedAt)))fail();
 const to=fetchedAt.slice(0,10),from=new Date(Date.parse(to)-365*86400000).toISOString().slice(0,10),networks=[];
 for(const networkId of Object.keys(historyChains).filter(id=>registry.deployments.some(d=>d.coinId===coinId&&d.networkId===id))){
  const tokens=data.chainBalances[historyChains[networkId]]?.tokens;if(tokens===undefined)continue;if(!Array.isArray(tokens)||tokens.length>12000)fail();const points=new Map();
  for(const row of tokens){if(!row||typeof row.date!=='string'||!/^\d{1,11}$/.test(row.date))fail();const seconds=BigInt(row.date);if(seconds%86400n!==0n)fail();const date=new Date(Number(seconds)*1000).toISOString().slice(0,10);if(date<from||date>to)continue;
   const amount=row[metric==='NETWORK_MINTED'?'minted':'circulating']?.peggedUSD;if(amount===undefined||amount===null)continue;if(typeof amount!=='string'||!/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(amount)||points.has(date))fail();points.set(date,{day:date,amount});
  }
  if(points.size)networks.push({networkId,points:[...points.values()].sort((a,b)=>a.day.localeCompare(b.day))});
 }
 const snapshot={coinId,provider:'DEFILLAMA',metric,unit:'token',fetchedAt,sourceHash:hashHistory(bytes),endpoint:'/stablecoin/'+asset.id,from,to,networks};validateSupplyHistory([snapshot],registry);return snapshot;
}
export async function fetchHistorySource(coinId,fetcher=fetch){
 if(!Object.hasOwn(historyAssets,coinId))fail();const response=await fetcher('https://stablecoins.llama.fi/stablecoin/'+historyAssets[coinId].id,{redirect:'error',signal:AbortSignal.timeout(30000),headers:{Accept:'application/json'}});
 if(response.status!==200){await response.body?.cancel();throw Error('HISTORY_HTTP_FAILED');}let size=0;const chunks=[];
 for await(const chunk of response.body){size+=chunk.length;if(size>sourceByteLimit)throw Error('HISTORY_RESPONSE_LIMIT');chunks.push(chunk);}return Buffer.concat(chunks);
}
