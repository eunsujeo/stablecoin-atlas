import {createHash} from 'node:crypto';
import {registryMatches} from './preview.mjs';
import {transaction} from './connection.mjs';
import {verifyRegistration,owner,lock,requireRegistrationWriter} from './registration-access.mjs';
import {selectionContext,requireCurrentRegistrationSelection} from './registration-context.mjs';
import {coinMarketProjection,validateCoinMarketProjection,marketDay} from '../market-registration/coin-market.mjs';
import {registrationHash as hash} from '../market-registration/planner.mjs';
const hex=s=>Buffer.from(s,'hex');
const need=(v,code='REGISTRATION_DB_CONTENT_CONFLICT')=>{if(!v)throw Error(code);};
const stamp=c=>`to_char(${c} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
export async function importCoinMarket(client,{selectionId,coinId,bytes,fetchedAt,requestDay}){
 need(/^[a-f0-9]{64}$/.test(selectionId??'')&&typeof coinId==='string'&&Buffer.isBuffer(bytes)&&bytes.length<=32*1024*1024&&marketDay(requestDay),'REGISTRATION_SOURCE_INVALID');
 return transaction(client,async()=>{
  await lock(client);need(await verifyRegistration(client)>=3,'REGISTRATION_DB_UPGRADE_REQUIRED');
  const installer=(await client.query("SELECT current_user=pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='atlas_registration'")).rows[0].owner;
  if(installer)await owner(client);else{await requireRegistrationWriter(client);await requireCurrentRegistrationSelection(client,selectionId);}
  const c=await selectionContext(client,selectionId);await registryMatches(client,c.legacy);const rawHash=createHash('sha256').update(bytes).digest('hex');
  const prior=(await client.query(`SELECT encode(id,'hex') AS id,projection,${stamp('fetched_at')} AS fetched FROM atlas_registration.coin_market_source WHERE selection_id=$1 AND coin=$2 AND source_hash=$3 AND request_day=$4::date`,[hex(selectionId),coinId,hex(rawHash),requestDay])).rows[0];
  // Validate caller's clock as well, but preserve the original receipt clock on replay.
  coinMarketProjection(c.metadata,c.legacy,bytes,{selectionId,coinId,fetchedAt,requestDay});
  const projection=coinMarketProjection(c.metadata,c.legacy,bytes,{selectionId,coinId,fetchedAt:prior?.fetched??fetchedAt,requestDay}),id=hash(projection);
  if(prior)need(prior.id===id&&hash(prior.projection)===id);
  else await client.query('INSERT INTO atlas_registration.coin_market_source VALUES($1,$2,$3,$4,$5,$6::date,$7,$8)',[hex(id),hex(selectionId),hex(c.metadata_id),coinId,hex(rawHash),requestDay,fetchedAt,projection]);
  return {state:'IMPORTED',marketSourcesInserted:prior?0:1,providerRequests:0};
 });
}
export async function readCoinMarkets(client,context){
 const rows=(await client.query(`SELECT DISTINCT ON(coin) coin,encode(id,'hex') AS id,encode(selection_id,'hex') AS selection_id,encode(metadata_id,'hex') AS metadata_id,encode(source_hash,'hex') AS source_hash,to_char(request_day,'YYYY-MM-DD') AS day,${stamp('fetched_at')} AS fetched,projection FROM atlas_registration.coin_market_source WHERE selection_id=$1 ORDER BY coin,fetched_at DESC,id DESC LIMIT 6`,[hex(context.id)])).rows;
 need(rows.length<=5);const result=new Map();
 for(const r of rows){
  const p=validateCoinMarketProjection(r.projection),coin=context.metadata.coins.find(c=>c.id===r.coin);
  need(coin&&p.coinId===r.coin&&p.pegCurrency===coin.pegCurrency&&p.selectionId===context.id&&r.selection_id===context.id&&r.metadata_id===context.metadata_id&&p.sourceHash===r.source_hash&&p.requestDay===r.day&&p.fetchedAt===r.fetched&&hash(p)===r.id);
  result.set(r.coin,{...p,sourceId:r.id});
 }
 return result;
}
