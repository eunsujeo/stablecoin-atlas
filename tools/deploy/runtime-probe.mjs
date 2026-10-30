// Installed fixed code, executed only as the relevant existing service user.
import {pathToFileURL} from 'node:url';
import {readFile,lstat} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {connectDatabase} from '../market-db/connection.mjs';
import {verifyProductionReader} from '../production-database.mjs';
import {databaseMarketReader} from '../market-db/preview.mjs';
import {databaseRegistrationReader} from '../market-db/registration-preview.mjs';
import {databaseAssetReviewReader} from '../market-db/asset-review-preview.mjs';
import {databaseNetworkUsageReader} from '../market-db/network-usage-preview.mjs';
import {verifyHistoryWriter} from '../market-db/history.mjs';
import {requireRegistrationWriter} from '../market-db/registration-access.mjs';
import {requireCurrentRegistrationSelection} from '../market-db/registration-context.mjs';
import {assertSchedulerPolicy} from '../market-db/scheduler.mjs';
import {resolveArkhamSchedule,collectorScheduleEnvironment} from '../arkham-schedule.mjs';
import {usageOperation} from '../usage-operating-cli.mjs';
import {verifyNetworkUsageSchema} from '../market-db/network-usage.mjs';
import {databaseFrankfurterFXReader} from '../market-db/frankfurter-fx-preview.mjs';
import {productionSettings} from '../production-web.mjs';
import {checkDeployment} from '../collector-deploy.mjs';
import {projectOperatingUsage} from '../usage-operating-project.mjs';
import {verifySupplyApiBoundary} from '../market-db/supply-api-boundary.mjs';
import {requireThat} from './files.mjs';
async function variables(file){const stat=await lstat(file);requireThat(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&!(stat.mode&0o077)&&stat.size<=65536,'PROBE_ENV_INVALID');return parseEnv(await readFile(file,'utf8'));}
export async function collectorGate({client,registered,selection,schedule,hold=false}){
 await verifyHistoryWriter(client);await requireRegistrationWriter(registered);await requireCurrentRegistrationSelection(registered,selection);await assertSchedulerPolicy(client,schedule);
 if(hold){for(const [db,key]of [[client,499],[client,405],[registered,407]])requireThat((await db.query('SELECT pg_try_advisory_lock(18471234,$1) AS held',[key])).rows[0].held,'REMOTE_WORKER_LOCKED');}
 const pending=(await client.query("SELECT count(*)::int AS count FROM atlas_history.scheduler_run WHERE state='CLAIMED'")).rows[0].count;
 const waiting=(await registered.query('SELECT count(*)::int AS count FROM atlas_registration.collection_run r LEFT JOIN atlas_registration.collection_result s USING(day,coin) WHERE s.coin IS NULL')).rows[0].count;
 requireThat(pending===0&&waiting===0,'PENDING_RESERVATIONS');
 const budgets=(await client.query("SELECT d.budget,count(r.*)::int AS used FROM atlas_history.scheduler_day d LEFT JOIN atlas_history.scheduler_run r USING(job,day) WHERE d.day=(clock_timestamp() AT TIME ZONE 'UTC')::date GROUP BY d.job,d.day,d.budget")).rows;requireThat(budgets.every(r=>r.used<=r.budget),'BUDGET_INVALID');
 return {state:'READY',pending:0,providerRequests:0};
}
export async function probe({component,envFile,selection,hold=false}){
 let clients=[];
 try{
  if(component==='web'){
   const {env}=await productionSettings({configFile:'/etc/atlas-web/web.json',readerFile:envFile,revisionFile:'/opt/stablecoin-atlas/current/REVISION'});const connect=async()=>{const c=await connectDatabase(env);try{await verifyProductionReader(c);return c;}catch(e){await c.end().catch(()=>{});throw e;}};
   const market=await databaseMarketReader({env,connect,includeLocalStatus:false})();requireThat(market.readState?.source==='POSTGRESQL','DB_MARKET_REQUIRED');
   await databaseRegistrationReader({env,connect})('/registration-index.json');await databaseAssetReviewReader({env,connect})();await databaseNetworkUsageReader({env,connect})();
   await databaseFrankfurterFXReader({env,connect})();return {state:'READY',providerRequests:0};
  }
  if(component==='collector'){
   await checkDeployment({'--kind':'arkham','--env-file':'/etc/atlas-collector/writer.env','--state-root':'/var/lib/atlas-collector','--schedule-file':'/etc/atlas-collector/schedule.env'},{});await checkDeployment({'--kind':'registered','--env-file':'/etc/atlas-collector/registered-writer.env','--state-root':'/var/lib/atlas-collector','--selection':selection},{});
   const env=await variables('/etc/atlas-collector/writer.env'),registeredEnv=await variables('/etc/atlas-collector/registered-writer.env');const client=await connectDatabase(env);clients.push(client);const registered=await connectDatabase(registeredEnv);clients.push(registered);
   const schedule=resolveArkhamSchedule({},await collectorScheduleEnvironment('/etc/atlas-collector/schedule.env',{}));const result=await collectorGate({client,registered,selection,schedule,hold});if(hold){const day=new Date().toISOString().slice(0,10);try{await lstat('/var/lib/atlas-collector/fx-store/claims/'+day+'.json');const receipt=JSON.parse(await readFile('/var/lib/atlas-collector/fx-store/receipts/'+day+'.json'));requireThat(typeof receipt.sourceHash==='string'&&/^[a-f0-9]{64}$/.test(receipt.sourceHash),'FX_UNCONFIRMED');}catch(e){if(e.code!=='ENOENT'||e.path?.includes('/receipts/'))throw Error('FX_UNCONFIRMED');}}
   if(hold){console.log(JSON.stringify(result));await new Promise(r=>process.stdin.once('data',r));}return result;
  }
  requireThat(component==='usage','PROBE_COMPONENT');
  await usageOperation(['check','--config','/etc/atlas-usage/config.json']);
  const c=JSON.parse(await readFile('/etc/atlas-usage/config.json'));requireThat(c.stateRoot==='/var/lib/atlas-usage','USAGE_STATE_ROOT');const rootStat=await lstat(c.stateRoot);requireThat(rootStat.isDirectory()&&!rootStat.isSymbolicLink()&&rootStat.uid===process.getuid()&&!(rootStat.mode&0o077),'USAGE_STATE_ROOT');const env=await variables(c.envFile),client=await connectDatabase(env);clients=[client];await verifyNetworkUsageSchema(client);const review=JSON.parse(await readFile(c.reviewedDefinersFile));await verifySupplyApiBoundary(client,{schema:'atlas_network_usage',reviewedDefiners:review.definers});
  requireThat((await client.query('SELECT access_mode FROM atlas_network_usage.access_grant WHERE role_name=current_user')).rows[0]?.access_mode==='writer','USAGE_WRITER_REQUIRED');
  for(const claim of (await client.query("SELECT to_char(day,'YYYY-MM-DD') AS day FROM atlas_network_usage.collection_day ORDER BY day DESC LIMIT 32")).rows){const receipt=JSON.parse(await readFile(c.stateRoot+'/arkham-usage-daily-'+claim.day+'/receipt.json'));requireThat(receipt.state==='COMPLETE','USAGE_UNCERTAIN_CONSUMPTION');await projectOperatingUsage(c.stateRoot,claim.day);}
  try{await lstat(c.stateRoot+'/reservation-lock');throw Error('USAGE_SEND_LOCKED');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(hold)requireThat((await client.query('SELECT pg_try_advisory_lock(18471234,499) AS held')).rows[0].held,'REMOTE_DEPLOY_LOCKED');
  const result={state:'READY',providerRequests:0};if(hold){console.log(JSON.stringify(result));await new Promise(r=>process.stdin.once('data',r));}return result;
 }finally{for(const c of clients)await c.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const [component,selection,envFile,flag]=process.argv.slice(2);const hold=flag==='hold';const r=await probe({component,selection,envFile,hold});if(!hold)console.log(JSON.stringify(r));}catch(e){console.error(/^[A-Z_]{1,64}$/.test(e.message)?e.message:'DEPLOY_PROBE_FAILED');process.exitCode=1;}}
