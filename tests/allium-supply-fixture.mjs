import {readFile} from 'node:fs/promises';
import {activityAssets} from '../tools/activity-source.mjs';
import {supplyHash} from '../tools/allium-supply-source.mjs';
const sql=await readFile(new URL('../docs/research/allium-samples/supply-recent.sql',import.meta.url),'utf8');
export function supplyFixture({queriedAt='2026-10-23T03:26:50.626271Z',amount='1000.000000000000000001',mutate=()=>{}}={}){
 const data={sql,queried_at:queriedAt,meta:{row_count:14,run_id:'private-run'},query_id:'private-query',data:['usdc','usdt'].flatMap(coin=>Array.from({length:7},(_,i)=>({coin_id:coin,chain:'ethereum',token_address:activityAssets[coin],date:`2026-10-${16+i}T00:00:00`,is_native:true,total_supply_str:amount,circulating_supply_str:'900',adjusted_circulating_supply_str:null,_metadata:{private:'omitted'}})))};
 mutate(data);const bytes=Buffer.from(JSON.stringify(data));return {bytes,data,options:{expectedHash:supplyHash(bytes),now:'2026-10-24T00:00:00.000Z'}};
}
