import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fixture} from './fixture.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {initialize,partition,grantAccess} from '../../tools/market-db/schema.mjs';
import {initializeHistory,normalizeHistory,enableContinuousHistory,upgradeScheduler,grantHistoryWriter} from '../../tools/market-db/history.mjs';
import {importSources} from '../../tools/market-db/repository.mjs';
import {importPlan} from '../../tools/market-db/plan.mjs';
import {initializeRegistration,upgradeRegistration,grantRegistrationWriter} from '../../tools/market-db/registration-access.mjs';
import {installRegistration} from '../../tools/market-db/registration.mjs';
import {acquireRegisteredWorker,claimRegistered,releaseRegisteredWorker} from '../../tools/market-db/registration-scheduler.mjs';
import {acquireWorker,releaseWorker} from '../../tools/market-db/scheduler.mjs';
import {collectorGate} from '../../tools/deploy/runtime-probe.mjs';
import {arkhamSchedule} from '../../tools/arkham-schedule.mjs';
const bytes=x=>Buffer.from(JSON.stringify(x));
test('deployment PG17 gate refuses other-host locks and pending reservations without modifying claims or budgets',{timeout:120000},async()=>{
 const f=await fixture(),root=await mkdtemp(join(tmpdir(),'atlas-deploy-gate-'));let client,registered,other;
 try{
  const legacy=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url))),metadata=JSON.parse(await readFile(new URL('../../data/market-registration.json',import.meta.url)));
  const today=(await f.admin.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day")).rows[0].day;
  await initialize(f.admin);await partition(f.admin,today.slice(0,7));await initializeHistory(f.admin);await normalizeHistory(f.admin,legacy);await enableContinuousHistory(f.admin);await upgradeScheduler(f.admin);
  const url=await f.createUser('atlas_test_deploywriter');await grantAccess(f.admin,'atlas_test_deploywriter','writer');await grantHistoryWriter(f.admin,'atlas_test_deploywriter');client=await connectDatabase({DATABASE_URL:url});registered=await connectDatabase({DATABASE_URL:url});other=await connectDatabase({DATABASE_URL:url});
  await importSources(client,{registry:legacy,sources:[importPlan(legacy,bytes({requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:today+'T00:00:00.000Z',data:{price:'1'}}]}))],archiveDirectory:join(root,'market')});
  await initializeRegistration(f.admin);const catalogue={peggedAssets:metadata.coins.map(c=>({id:c.defillama.assetId,symbol:c.symbol,gecko_id:c.defillama.geckoId,pegType:c.defillama.pegType,chains:['Ethereum'],chainCirculating:{Ethereum:{current:{[c.defillama.pegType]:'100'}}}}))};
  const selection=(await installRegistration(f.admin,metadata,legacy,bytes(catalogue),{fetchedAt:today+'T01:00:00.000Z'})).selectionId;await upgradeRegistration(f.admin);await grantRegistrationWriter(f.admin,'atlas_test_deploywriter');
  const options={client,registered,selection,schedule:arkhamSchedule({interval:'5m',dailyRunLimit:288})};
  const counts=async()=> (await f.admin.query('SELECT (SELECT count(*)::int FROM atlas_history.scheduler_run) AS runs,(SELECT count(*)::int FROM atlas_history.scheduler_day) AS budgets,(SELECT count(*)::int FROM atlas_registration.collection_run) AS claims,(SELECT count(*)::int FROM atlas_registration.collection_result) AS results')).rows[0];
  const before=await counts();assert.equal((await collectorGate(options)).state,'READY');assert.deepEqual(await counts(),before);
  await acquireWorker(other);await assert.rejects(collectorGate({...options,hold:true}),/REMOTE_WORKER_LOCKED/);assert.deepEqual(await counts(),before);await releaseWorker(other);await client.query('SELECT pg_advisory_unlock_all()');await registered.query('SELECT pg_advisory_unlock_all()');
  assert.equal((await collectorGate({...options,hold:true})).providerRequests,0);assert.equal((await other.query('SELECT pg_try_advisory_lock(18471234,405) AS held')).rows[0].held,false);await client.query('SELECT pg_advisory_unlock_all()');await registered.query('SELECT pg_advisory_unlock_all()');
  const pid=await acquireRegisteredWorker(other,selection);await claimRegistered(other,{coinId:'usdc',selectionId:selection,pid});await releaseRegisteredWorker(other);const claimed=await counts();await assert.rejects(collectorGate(options),/PENDING_RESERVATIONS/);assert.deepEqual(await counts(),claimed);
 }finally{for(const c of [client,registered,other])await c?.end().catch(()=>{});await f.stop();await rm(root,{recursive:true,force:true});}
});
