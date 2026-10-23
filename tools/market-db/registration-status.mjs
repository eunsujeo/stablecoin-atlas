import {transaction,runtimeRole} from './connection.mjs';
import {verifyRuntimeAccess} from './schema.mjs';
import {verifyRegistration,readerPrivileges,requireRegistrationWriter} from './registration-access.mjs';
import {requireCurrentRegistrationSelection} from './registration-context.mjs';
import {readCoinMarkets} from './registration-coin-market.mjs';
const stamp=c=>`to_char(${c} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const coins=['usdt','usdc','rlusd','jpyc','jpysc'];
export async function registeredCollectorStatus(client,selectionId){
 if(!/^[a-f0-9]{64}$/.test(selectionId??''))throw Error('SCHEDULER_INVALID');
 return transaction(client,async()=>{
  await runtimeRole(client);await verifyRuntimeAccess(client);const version=await verifyRegistration(client);
  if(version<2)throw Error('REGISTRATION_DB_UPGRADE_REQUIRED');
  const role=(await client.query('SELECT current_user AS name')).rows[0].name;
  if((await client.query('SELECT 1 FROM atlas_registration.reader_grant WHERE role_name=current_user')).rowCount)await readerPrivileges(client,role);
  else await requireRegistrationWriter(client);
  const context=await requireCurrentRegistrationSelection(client,selectionId);
  const clock=(await client.query(`SELECT ${stamp('transaction_timestamp()')} AS "checkedAt",to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day`)).rows[0];
  const today=(await client.query(`SELECT r.coin,encode(r.selection_id,'hex') AS selection,s.state,s.error_code FROM atlas_registration.collection_run r LEFT JOIN atlas_registration.collection_result s USING(day,coin) WHERE r.day=$1::date`,[clock.day])).rows;
  const pending=(await client.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE r.selection_id=$1)::int AS "selected",count(*) FILTER(WHERE r.selection_id<>$1)::int AS "otherSelections" FROM atlas_registration.collection_run r LEFT JOIN atlas_registration.collection_result s USING(day,coin) WHERE s.coin IS NULL`,[Buffer.from(selectionId,'hex')])).rows[0];
  const sources=(await client.query(`SELECT coin,metric,${stamp('max(fetched_at)')} AS "fetchedAt" FROM atlas_registration.daily_source WHERE selection_id=$1 GROUP BY coin,metric`,[Buffer.from(selectionId,'hex')])).rows;
  const markets=version>=3?await readCoinMarkets(client,context):new Map();
  // pg_locks is a point-in-time observation, separate from the MVCC data snapshot.
  const workerLockHeld=(await client.query(`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND classid=18471234 AND objid=407 AND objsubid=2 AND granted) AS held`)).rows[0].held;
  return {kind:'REGISTERED_COLLECTOR_STATUS',schemaVersion:1,registrationVersion:version,selectionId,...clock,workerLockHeld,
   lockMeaning:'POINT_IN_TIME_LOCK_PRESENCE_ONLY',pendingReservations:{scope:'ALL_SELECTIONS_ALL_DAYS',...pending},
   marketClockSupported:version>=3,
   coins:coins.map(coinId=>{const run=today.find(r=>r.coin===coinId);return {coinId,state:!run?'NOT_STARTED':run.selection!==selectionId?'SELECTION_CHANGED':run.state??'PENDING',errorCode:run?.selection===selectionId?run.error_code??null:null,
    networkFetchedAt:sources.filter(s=>s.coin===coinId).map(({metric,fetchedAt})=>({metric,fetchedAt})).sort((a,b)=>a.metric.localeCompare(b.metric)),marketFetchedAt:markets.get(coinId)?.fetchedAt??null};})};
 },{repeatableRead:true});
}
