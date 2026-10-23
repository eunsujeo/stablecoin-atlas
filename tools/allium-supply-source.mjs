import {createHash} from 'node:crypto';
import {parseHistorySource} from './supply-history-source.mjs';
import {canonical,instant,epochMicros} from './market-db/plan.mjs';
import {activityAssets,activityDay} from './activity-source.mjs';
export const supplyMapper='allium-ethereum-supply-reviewed-v1';
export const supplyHash=value=>createHash('sha256').update(Buffer.isBuffer(value)?value:canonical(value)).digest('hex');
export const supplyWindow=Object.freeze({from:'2026-10-16',to:'2026-10-22'});
export const supplyCoins=Object.freeze(['usdc','usdt']);
const sqlHashes=new Set(['d83ef8d88134f0c1ddc69bf23fa0d46e3d5afe080fdbd57d2fb0483b3d5cc112','aeaa8477e6338483cf6dab90a2aadc5a29452f3002dc74faa3bde51717f8ce94']);
const fail=()=>{throw Error('ALLIUM_SUPPLY_SOURCE_INVALID');};
const decimal=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(v);
export function validateSupplyValues(v){
 if(!v||Object.keys(v).sort().join(',')!=='adjustedCirculatingSupply,circulatingSupply,isNative,totalSupply'||
 ![v.totalSupply,v.circulatingSupply,v.adjustedCirculatingSupply].every(decimal)||typeof v.isNative!=='boolean')fail();return v;
}
export function alliumSupplySource(bytes,{expectedHash,now=new Date().toISOString()}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length>2097152||typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHash)||supplyHash(bytes)!==expectedHash)fail();
 parseHistorySource(bytes);
 const p=JSON.parse(bytes.toString('utf8'));
 if(!p||typeof p.sql!=='string'||!sqlHashes.has(supplyHash(Buffer.from(p.sql)))||!Array.isArray(p.data)||p.data.length!==14||String(p.meta?.row_count)!=='14')fail();
 const queriedAt=instant(p.queried_at);if(epochMicros(queriedAt)>epochMicros(now)||queriedAt.slice(0,10)<='2026-10-22')fail();
 const seen=new Set(),rows=p.data.map(r=>{
  if(!supplyCoins.includes(r.coin_id)||r.chain!=='ethereum'||typeof r.token_address!=='string'||r.token_address.toLowerCase()!==activityAssets[r.coin_id]||
     typeof r.date!=='string'||!/^\d{4}-\d\d-\d\dT00:00:00(?:\.0{1,9})?$/.test(r.date))fail();
  const day=r.date.slice(0,10),key=r.coin_id+':'+day;
  if(!activityDay(day)||day<supplyWindow.from||day>supplyWindow.to||seen.has(key))fail();seen.add(key);
  const values=validateSupplyValues({totalSupply:r.total_supply_str,circulatingSupply:r.circulating_supply_str,adjustedCirculatingSupply:r.adjusted_circulating_supply_str,isNative:r.is_native});
  const row={coinId:r.coin_id,networkId:'ethereum',day,values};return {...row,valueHash:supplyHash(row)};
 }).sort((a,b)=>(a.coinId+':'+a.day).localeCompare(b.coinId+':'+b.day));
 // Exactly two approved deployments × seven distinct dates proves this bounded query's grid.
 // LIMIT 14 is acceptable only for this fully populated grid, never as evidence of global coverage.
 const source={provider:'ALLIUM',mapper:supplyMapper,sourceHash:expectedHash,queriedAt,...supplyWindow,rowsHash:supplyHash(rows)};
 return {...source,id:supplyHash(source),rows};
}
export function supplyReadRange({coinId,from,to}={}){
 if(coinId!==undefined&&!supplyCoins.includes(coinId)||!activityDay(from)||!activityDay(to)||from>to||Date.parse(to)-Date.parse(from)>30*86400000)fail();
 return {coinId:coinId??null,from,to};
}
