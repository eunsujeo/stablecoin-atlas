import {createHash} from 'node:crypto';
import {parseHistorySource} from './supply-history-source.mjs';
import {canonical,instant,epochMicros} from './market-db/plan.mjs';
export const activityMapper='allium-ethereum-transfers-v1';
export const activityAssets=Object.freeze({usdc:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',usdt:'0xdac17f958d2ee523a2206206994597c13d831ec7',rlusd:'0x8292bb45bf1ee4d140127049757c2e0ff06317ed',jpyc:'0xe7c3d8c9a439fede00d2600032d5db0be71c3c29',jpysc:'0x6781d5631bfe47432b089e64e3eab3b6edd26177'});
export const activityHash=value=>createHash('sha256').update(Buffer.isBuffer(value)?value:canonical(value)).digest('hex');
export const activityDay=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const invalid=()=>{throw Error('ACTIVITY_SOURCE_INVALID');};
const decimal=s=>typeof s==='string'&&/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(s);
export function validateActivityValues(v){
 if(!v||Object.keys(v).sort().join(',')!=='adjustedUSD,hasAdjusted,transactions,transfers,volume,volumeUSD'||!decimal(v.volume)||!decimal(v.volumeUSD)||![v.transfers,v.transactions].every(s=>typeof s==='string'&&/^(0|[1-9]\d{0,77})$/.test(s))||typeof v.hasAdjusted!=='boolean'||(v.adjustedUSD!==null&&!decimal(v.adjustedUSD))||(!v.hasAdjusted&&v.adjustedUSD!==null))invalid();
 return v;
}
export function activitySource(bytes,{expectedHash,from,to,now=new Date().toISOString()}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length>2*1024*1024||!/^[a-f0-9]{64}$/.test(expectedHash)||activityHash(bytes)!==expectedHash||!activityDay(from)||!activityDay(to)||from>to||Date.parse(to)-Date.parse(from)>30*86400000)invalid();
 parseHistorySource(bytes); // Enforce the bounded nesting/UTF-8 contract before ordinary type validation.
 const p=JSON.parse(bytes.toString('utf8'));if(!p||!Array.isArray(p.data)||p.data.length>=75||String(p.meta?.row_count)!==String(p.data.length)||typeof p.sql!=='string'||!p.sql.length)invalid();
 const queriedAt=instant(p.queried_at);if(epochMicros(queriedAt)>epochMicros(now)||to>=queriedAt.slice(0,10))invalid();
 const seen=new Set(),rows=p.data.map(r=>{
  if(!Object.hasOwn(activityAssets,r.coin_id)||r.chain!=='ethereum'||r.token_address!==activityAssets[r.coin_id]||typeof r.activity_date!=='string'||!/^\d{4}-\d\d-\d\dT00:00:00(?:\.0{1,9})?$/.test(r.activity_date))invalid();
  const day=r.activity_date.slice(0,10),key=r.coin_id+':'+day;if(!activityDay(day)||day<from||day>to||seen.has(key))invalid();seen.add(key);
  const values=validateActivityValues({volume:r.transfer_volume_str,volumeUSD:r.transfer_volume_usd_str,transfers:r.transfer_count_str,transactions:r.transfer_tx_count_str,hasAdjusted:r.has_adjusted_volume,adjustedUSD:r.adjusted_volume_usd_str});
  return {coinId:r.coin_id,networkId:'ethereum',day,values,valueHash:activityHash({coinId:r.coin_id,networkId:'ethereum',day,values})};
 }).sort((a,b)=>(a.coinId+':'+a.day).localeCompare(b.coinId+':'+b.day));
 const source={provider:'ALLIUM',mapper:activityMapper,sourceHash:expectedHash,queriedAt,from,to,rowsHash:activityHash(rows)};
 return {...source,id:activityHash(source),rows};
}
