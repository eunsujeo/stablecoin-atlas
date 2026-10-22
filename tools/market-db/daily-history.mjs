import {canonical,digest,fail} from './plan.mjs';
import {validateSupplyHistory,historyAssets} from '../../web/supply-history-model.js';
const hex=s=>Buffer.from(s,'hex');
const amount=s=>{const [whole,tail]=s.split('.');return whole+(tail?.replace(/0+$/,'')?'.'+tail.replace(/0+$/,''):'');};
export const normalizeDaily=s=>({...s,networks:s.networks.map(n=>({...n,points:n.points.map(p=>({...p,amount:amount(p.amount)}))}))});
const valueKey=(s,n,p)=>digest(canonical({coinId:s.coinId,metric:s.metric,networkId:n.networkId,day:p.day,amount:p.amount}));
export async function importDaily(client,registry,input){
 validateSupplyHistory(input,registry);let inserted=0,unchanged=0,valuesInserted=0,pointersChanged=0;
 for(const original of input){
  const s=normalizeDaily(original),coin=(await client.query('SELECT id,symbol FROM atlas_market.coin WHERE code=$1',[s.coinId])).rows[0];if(!coin||coin.symbol!==registry.coins.find(c=>c.id===s.coinId)?.symbol)fail('HISTORY_IDENTITY_MISMATCH');
  const prior=(await client.query(`SELECT encode(id,'hex') AS id,to_char(fetched_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS fetched FROM atlas_history.daily_source WHERE coin_id=$1 AND metric=$2 AND source_hash=$3 AND window_to=$4::date`,[coin.id,s.metric,hex(s.sourceHash),s.to])).rows[0];
  if(prior){if(prior.id!==digest(canonical({...s,fetchedAt:prior.fetched})))fail('HISTORY_CONTENT_CONFLICT');unchanged++;continue;}
  const id=digest(canonical(s)),coverage=s.networks.map(n=>({networkId:n.networkId,days:n.points.map(p=>p.day)}));
  const previous=(await client.query("SELECT fetched_at,encode(id,'hex') AS id FROM atlas_history.daily_source WHERE coin_id=$1 AND metric=$2 ORDER BY fetched_at DESC,id DESC LIMIT 1",[coin.id,s.metric])).rows[0];
  const publish=!previous||Date.parse(s.fetchedAt)>new Date(previous.fetched_at).getTime()||Date.parse(s.fetchedAt)===new Date(previous.fetched_at).getTime()&&id>previous.id;
  await client.query('INSERT INTO atlas_history.daily_source VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[hex(id),coin.id,s.metric,hex(s.sourceHash),s.from,s.to,s.fetchedAt,JSON.stringify(coverage)]);
  for(const n of s.networks){
   const expected=registry.networks.find(r=>r.id===n.networkId),network=(await client.query('SELECT id,family,network_identity FROM atlas_market.network WHERE code=$1',[n.networkId])).rows[0];if(!network||network.family!==expected?.family||network.network_identity!==expected.networkId)fail('HISTORY_IDENTITY_MISMATCH');
   const rows=n.points.map(p=>({id:valueKey(s,n,p),day:p.day,amount:p.amount}));
   const added=await client.query(`INSERT INTO atlas_history.daily_value(id,coin_id,metric,network_id,observed_day,amount,first_source)
    SELECT decode(r.id,'hex'),$2,$3,$4,r.day::date,r.amount,$5 FROM jsonb_to_recordset($1::jsonb) AS r(id text,day text,amount text) ON CONFLICT(id) DO NOTHING`,[JSON.stringify(rows),coin.id,s.metric,network.id,hex(id)]);valuesInserted+=added.rowCount;
   const checked=(await client.query(`SELECT encode(v.id,'hex') AS id,v.amount,to_char(v.observed_day,'YYYY-MM-DD') AS day FROM atlas_history.daily_value v WHERE v.id=ANY($1::bytea[]) AND v.coin_id=$2 AND v.metric=$3 AND v.network_id=$4`,[rows.map(r=>hex(r.id)),coin.id,s.metric,network.id])).rows;
   if(checked.length!==rows.length||checked.some(v=>valueKey(s,n,v)!==v.id))fail('HISTORY_CONTENT_CONFLICT');
   if(publish){const updated=await client.query(`INSERT INTO atlas_history.daily_latest(coin_id,metric,network_id,observed_day,value_id,source_id)
     SELECT $2,$3,$4,r.day::date,decode(r.id,'hex'),$5 FROM jsonb_to_recordset($1::jsonb) AS r(id text,day text,amount text)
     ON CONFLICT(coin_id,metric,network_id,observed_day) DO UPDATE SET value_id=excluded.value_id,source_id=excluded.source_id WHERE atlas_history.daily_latest.value_id<>excluded.value_id`,[JSON.stringify(rows),coin.id,s.metric,network.id,hex(id)]);pointersChanged+=updated.rowCount;}
  }inserted++;
 }
 return {state:'IMPORTED',inserted,unchanged,valuesInserted,pointersChanged};
}
export async function readDaily(client,registry){
 const sources=(await client.query(`SELECT DISTINCT ON (s.coin_id,s.metric) encode(s.id,'hex') AS id,c.code AS coin,s.metric,encode(s.source_hash,'hex') AS hash,
  to_char(s.window_from,'YYYY-MM-DD') AS "from",to_char(s.window_to,'YYYY-MM-DD') AS "to",to_char(s.fetched_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS fetched,s.coverage
  FROM atlas_history.daily_source s JOIN atlas_market.coin c ON c.id=s.coin_id ORDER BY s.coin_id,s.metric,s.fetched_at DESC,s.id DESC LIMIT 7`)).rows;
 if(sources.length>6)fail('HISTORY_RESPONSE_LIMIT');
 const snapshots=sources.map(s=>{
  if(!Array.isArray(s.coverage)||s.coverage.some(n=>!n||Object.keys(n).sort().join(',')!=='days,networkId'||!Array.isArray(n.days)))fail('HISTORY_CONTENT_CONFLICT');
  return {coinId:s.coin,provider:'DEFILLAMA',metric:s.metric,unit:'token',fetchedAt:s.fetched,sourceHash:s.hash,endpoint:'/stablecoin/'+historyAssets[s.coin]?.id,from:s.from,to:s.to,networks:s.coverage.map(n=>({networkId:n.networkId,points:n.days.map(day=>({day,amount:'0'}))}))};
 });validateSupplyHistory(snapshots,registry);
 const values=(await client.query(`SELECT encode(s.id,'hex') AS source,n.code AS network,t.day,v.amount,encode(v.id,'hex') AS id
  FROM atlas_history.daily_source s CROSS JOIN LATERAL jsonb_array_elements(s.coverage) scope
  JOIN atlas_market.network n ON n.code=scope->>'networkId' CROSS JOIN LATERAL jsonb_array_elements_text(scope->'days') t(day)
  JOIN atlas_history.daily_latest l ON l.coin_id=s.coin_id AND l.metric=s.metric AND l.network_id=n.id AND l.observed_day=t.day::date
  JOIN atlas_history.daily_value v ON v.id=l.value_id WHERE s.id=ANY($1::bytea[]) LIMIT 5857`,[sources.map(s=>hex(s.id))])).rows;
 if(values.length>5856)fail('HISTORY_RESPONSE_LIMIT');const map=new Map(values.map(v=>[v.source+':'+v.network+':'+v.day,v]));
 for(const [i,s]of snapshots.entries())for(const n of s.networks)for(const p of n.points){const v=map.get(sources[i].id+':'+n.networkId+':'+p.day);if(!v)fail('HISTORY_CONTENT_CONFLICT');p.amount=v.amount;if(valueKey(s,n,p)!==v.id)fail('HISTORY_CONTENT_CONFLICT');}
 for(const [i,s]of snapshots.entries())if(digest(canonical(s))!==sources[i].id)fail('HISTORY_CONTENT_CONFLICT');return validateSupplyHistory(snapshots,registry);
}
