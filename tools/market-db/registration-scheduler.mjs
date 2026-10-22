import {transaction} from './connection.mjs';
import {lock,requireRegistrationWriter} from './registration-access.mjs';
import {requireCurrentRegistrationSelection} from './registration.mjs';
const coins=new Set(['usdt','usdc','rlusd','jpyc','jpysc']);
const valid=(coin,selection)=>{if(!coins.has(coin)||!/^\w{64}$/.test(selection)||!/^[a-f0-9]+$/.test(selection))throw Error('SCHEDULER_INVALID');};
export const registeredJob=coin=>'REGISTERED_'+coin.toUpperCase();
export const registeredSlot=day=>day+'T00:00:00.000Z';
export async function acquireRegisteredWorker(client,selectionId){return transaction(client,async()=>{
 await requireRegistrationWriter(client);await requireCurrentRegistrationSelection(client,selectionId);
 const r=(await client.query('SELECT pg_try_advisory_lock(18471234,407) AS locked,pg_backend_pid() AS pid')).rows[0];
 if(!r.locked)throw Error('SCHEDULER_LOCKED');return r.pid;
},{readonly:true});}
export const releaseRegisteredWorker=client=>client.query('SELECT pg_advisory_unlock(18471234,407)');
async function owned(client,pid){
 const r=(await client.query(`SELECT pg_backend_pid()=$1 AND EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=18471234 AND objid=407 AND objsubid=2 AND pid=pg_backend_pid() AND granted) AS owned,
 to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day`,[pid])).rows[0];
 if(!r.owned)throw Error('SCHEDULER_SESSION_CHANGED');return r.day;
}
export async function registeredContext(client,selectionId){return transaction(client,async()=>{
 await lock(client);await requireRegistrationWriter(client);return requireCurrentRegistrationSelection(client,selectionId);
},{readonly:true});}
export async function claimRegistered(client,{coinId,selectionId,pid}){valid(coinId,selectionId);return transaction(client,async()=>{
 await lock(client);await requireRegistrationWriter(client);await requireCurrentRegistrationSelection(client,selectionId);const day=await owned(client,pid);
 const inserted=(await client.query('INSERT INTO atlas_registration.collection_run(day,coin,selection_id) VALUES($1,$2,$3) ON CONFLICT(day,coin) DO NOTHING',[day,coinId,Buffer.from(selectionId,'hex')])).rowCount;
 const prior=(await client.query(`SELECT encode(r.selection_id,'hex') AS selection,s.state,s.error_code FROM atlas_registration.collection_run r LEFT JOIN atlas_registration.collection_result s USING(day,coin) WHERE r.day=$1 AND r.coin=$2`,[day,coinId])).rows[0];
 if(prior.selection!==selectionId)throw Error('REGISTRATION_DB_SELECTION_CHANGED');
 return {coinId,selectionId,day,slot:registeredSlot(day),job:registeredJob(coinId),state:prior.state??(inserted?'CLAIMED':'RECOVER'),errorCode:prior.error_code??null};
});}
export async function pendingRegistered(client,selectionId,pid){return transaction(client,async()=>{
 await requireRegistrationWriter(client);await owned(client,pid);
 const rows=(await client.query(`SELECT to_char(r.day,'YYYY-MM-DD') AS day,r.coin AS "coinId",encode(r.selection_id,'hex') AS "selectionId"
 FROM atlas_registration.collection_run r LEFT JOIN atlas_registration.collection_result s USING(day,coin) WHERE s.coin IS NULL ORDER BY r.day,r.coin LIMIT 26`)).rows;
 if(rows.length>25)throw Error('SCHEDULER_RECOVERY_LIMIT');
 if(rows.some(r=>r.selectionId!==selectionId))throw Error('REGISTRATION_DB_SELECTION_CHANGED');
 return rows.map(r=>({...r,slot:registeredSlot(r.day),job:registeredJob(r.coinId),state:'RECOVER'}));
},{readonly:true});}
export async function beforeRegisteredRequest(client,reservation,pid){return transaction(client,async()=>{
 await lock(client);await requireRegistrationWriter(client);await requireCurrentRegistrationSelection(client,reservation.selectionId);
 if(await owned(client,pid)!==reservation.day)throw Error('SCHEDULER_DAY_CHANGED');
 const r=(await client.query('SELECT 1 FROM atlas_registration.collection_run r LEFT JOIN atlas_registration.collection_result s USING(day,coin) WHERE r.day=$1 AND r.coin=$2 AND r.selection_id=$3 AND s.coin IS NULL',[reservation.day,reservation.coinId,Buffer.from(reservation.selectionId,'hex')])).rowCount;
 if(!r)throw Error('SCHEDULER_INVALID');
},{readonly:true});}
export async function finishRegistered(client,reservation,state,errorCode=null){
 if(!['STORED','FAILED','UNCONFIRMED'].includes(state)||(state==='STORED')!==(errorCode===null)||errorCode!==null&&!/^[A-Z_]{1,64}$/.test(errorCode))throw Error('SCHEDULER_INVALID');
 return transaction(client,async()=>{await lock(client);await requireRegistrationWriter(client);
 await client.query('INSERT INTO atlas_registration.collection_result(day,coin,selection_id,state,error_code) VALUES($1,$2,$3,$4,$5) ON CONFLICT(day,coin) DO NOTHING',[reservation.day,reservation.coinId,Buffer.from(reservation.selectionId,'hex'),state,errorCode]);
 const r=(await client.query('SELECT state,error_code FROM atlas_registration.collection_result WHERE day=$1 AND coin=$2',[reservation.day,reservation.coinId])).rows[0];
 if(r.state!==state||r.error_code!==errorCode)throw Error('SCHEDULER_INVALID');return {state};
 });
}
// After cutover, old worker/manual collection must fail before any HTTP call.
export async function requireLegacyHistoryCollection(client){
 if((await client.query("SELECT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='atlas_registration' AND c.relname='writer_grant') AS enabled")).rows[0].enabled)throw Error('REGISTRATION_COLLECTION_REQUIRED');
}
