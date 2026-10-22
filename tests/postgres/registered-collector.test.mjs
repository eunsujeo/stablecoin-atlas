import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture} from './fixture.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {initialize,partition,grantAccess} from '../../tools/market-db/schema.mjs';
import {importSources} from '../../tools/market-db/repository.mjs';
import {importPlan} from '../../tools/market-db/plan.mjs';
import {initializeHistory,normalizeHistory,enableContinuousHistory,grantHistoryWriter} from '../../tools/market-db/history.mjs';
import {initializeRegistration,upgradeRegistration,grantRegistrationReader,grantRegistrationWriter,requireRegistrationWriter,verifyRegistration} from '../../tools/market-db/registration-access.mjs';
import {installRegistration,importRegistrationHistory,readRegistrationIndex,readRegistrationHistory} from '../../tools/market-db/registration.mjs';
import {acquireWorker,releaseWorker} from '../../tools/market-db/scheduler.mjs';
import {acquireRegisteredWorker,releaseRegisteredWorker,claimRegistered,requireLegacyHistoryCollection} from '../../tools/market-db/registration-scheduler.mjs';
import {runRegisteredCollector} from '../../tools/registered-collector.mjs';
const metadata=JSON.parse(await readFile(new URL('../../data/market-registration.json',import.meta.url))),legacy=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url)));
const bytes=value=>Buffer.from(JSON.stringify(value));
const catalogue={peggedAssets:metadata.coins.map(c=>({id:c.defillama.assetId,symbol:c.symbol,gecko_id:c.defillama.geckoId,pegType:c.defillama.pegType,chains:['Ethereum'],chainCirculating:{Ethereum:{current:{[c.defillama.pegType]:'100'}}}}))};
function detailed(coinId,day,amount='10'){
 const c=metadata.coins.find(c=>c.id===coinId);return bytes({id:c.defillama.assetId,symbol:c.symbol,gecko_id:c.defillama.geckoId,pegType:c.defillama.pegType,address:c.defillama.primaryAddress,chainBalances:{Ethereum:{tokens:[{date:Date.parse(day)/1000,circulating:{[c.defillama.pegType]:amount},minted:{[c.defillama.pegType]:'20'}}]}}});
}
test('registration daily PG17: atomic upgrade, minimal writer, separate lock, 404 isolation, day dedupe and stale source preservation',{timeout:120000},async()=>{
 const f=await fixture(),root=await mkdtemp(join(tmpdir(),'atlas-registered-pg-'));let writer,reader,other;
 try{
  await initialize(f.admin);await partition(f.admin,'2026-10');await initializeHistory(f.admin);await normalizeHistory(f.admin,legacy);await enableContinuousHistory(f.admin);
  const writerUrl=await f.createUser('atlas_test_registeredwriter'),readerUrl=await f.createUser('atlas_test_registeredreader');
  await grantAccess(f.admin,'atlas_test_registeredwriter','writer');await grantAccess(f.admin,'atlas_test_registeredreader','reader');await grantHistoryWriter(f.admin,'atlas_test_registeredwriter');
  writer=await connectDatabase({DATABASE_URL:writerUrl});reader=await connectDatabase({DATABASE_URL:readerUrl});other=await connectDatabase({DATABASE_URL:writerUrl});
  await importSources(writer,{registry:legacy,sources:[importPlan(legacy,bytes({requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-22T00:00:00.000Z',data:{price:'1'}}]}))],archiveDirectory:join(root,'market')});
  await initializeRegistration(f.admin);await grantRegistrationReader(f.admin,'atlas_test_registeredreader');const installed=await installRegistration(f.admin,metadata,legacy,bytes(catalogue),{fetchedAt:'2026-10-22T01:00:00.000Z'}),selectionId=installed.selectionId;
  await requireLegacyHistoryCollection(writer); // v1 needs no registration USAGE for this guard.
  await assert.rejects(upgradeRegistration(writer),/DATABASE_OWNER_REQUIRED/);
  assert.equal((await upgradeRegistration(f.admin)).state,'UPGRADED');assert.equal((await upgradeRegistration(f.admin)).state,'UNCHANGED');
  await assert.rejects(grantRegistrationWriter(f.admin,'atlas_test_registeredreader'),/REGISTRATION_DB_WRITER_REQUIRED/);
  assert.equal((await grantRegistrationWriter(f.admin,'atlas_test_registeredwriter')).state,'GRANTED');assert.equal((await grantRegistrationWriter(f.admin,'atlas_test_registeredwriter')).state,'UNCHANGED');await requireRegistrationWriter(writer);
  await assert.rejects(requireRegistrationWriter(reader),/REGISTRATION_DB_WRITER_REQUIRED/);await assert.rejects(requireLegacyHistoryCollection(writer),/REGISTRATION_COLLECTION_REQUIRED/);
  const day=(await f.admin.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day")).rows[0].day;
  const oldTime=new Date(Date.parse(day)-3600000).toISOString();await importRegistrationHistory(f.admin,{selectionId,coinId:'jpyc',bytes:detailed('jpyc',day,'5'),fetchedAt:oldTime});
  const oldIndex=await readRegistrationIndex(reader),oldSource=oldIndex.coins.find(c=>c.id==='jpyc').metrics[0].sourceId;
  await acquireWorker(writer);const pid=await acquireRegisteredWorker(writer,selectionId);await assert.rejects(acquireRegisteredWorker(other,selectionId),/SCHEDULER_LOCKED/);await releaseRegisteredWorker(writer);
  let calls=0;const requested=[];const options={selectionId,once:true,stateDirectory:join(root,'receipts'),archiveRoot:root};
  const states=[],collect=()=>runRegisteredCollector({env:{DATABASE_URL:writerUrl},options,onState:r=>states.push(r),fetcher:async url=>{calls++;const id=url.split('/').at(-1),coin=metadata.coins.find(c=>c.defillama.assetId===id).id;requested.push(coin);return coin==='jpyc'?new Response('',{status:404}):new Response(detailed(coin,day));}});
  assert.equal((await collect()).state,'PARTIAL');assert.equal(calls,5);assert.deepEqual(requested,['usdt','usdc','rlusd','jpyc','jpysc']);assert.equal(states.filter(s=>s.state==='STORED').length,4);
  assert.equal((await collect()).state,'PARTIAL');assert.equal(calls,5);
  const rows=(await f.admin.query('SELECT coin,state,error_code FROM atlas_registration.collection_result ORDER BY coin')).rows;
  assert.equal(rows.length,5);assert.equal(rows.find(r=>r.coin==='jpyc').error_code,'HISTORY_HTTP_FAILED');assert.equal(rows.find(r=>r.coin==='jpysc').state,'STORED');
  const index=await readRegistrationIndex(reader);assert.equal(index.coins.find(c=>c.id==='jpyc').metrics[0].sourceId,oldSource);
  const old=await readRegistrationHistory(reader,{selectionId,coinId:'jpyc',metric:'NETWORK_CIRCULATING',from:oldTime.slice(0,10),to:day});assert.equal(old.updatedAt,oldTime);
  const counts=JSON.stringify((await f.admin.query('SELECT count(*) FROM atlas_registration.daily_value')).rows);assert.equal((await collect()).state,'PARTIAL');assert.equal(calls,5);assert.equal(JSON.stringify((await f.admin.query('SELECT count(*) FROM atlas_registration.daily_value')).rows),counts);
  const newPid=await acquireRegisteredWorker(writer,selectionId);assert.equal((await claimRegistered(writer,{selectionId,coinId:'usdt',pid:newPid})).state,'STORED');await releaseRegisteredWorker(writer);
  await assert.rejects(writer.query('UPDATE atlas_registration.daily_value SET amount=\'0\''),e=>e.code==='42501');await assert.rejects(writer.query("INSERT INTO atlas_registration.metadata_revision SELECT * FROM atlas_registration.metadata_revision"),e=>e.code==='42501');
  await assert.rejects(reader.query("INSERT INTO atlas_registration.collection_result SELECT * FROM atlas_registration.collection_result"),e=>e.code==='42501');await assert.rejects(writer.query('SELECT atlas_registration.reject_mutation()'),e=>e.code==='42501');
  await f.admin.query('GRANT UPDATE(amount) ON atlas_registration.daily_value TO atlas_test_registeredwriter');await assert.rejects(requireRegistrationWriter(writer),/REGISTRATION_DB_PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE UPDATE(amount) ON atlas_registration.daily_value FROM atlas_test_registeredwriter');
  await assert.rejects(f.admin.query('DELETE FROM atlas_registration.collection_result'),e=>e.code==='23514');
  const changed=structuredClone(metadata);changed.revision=2;await installRegistration(f.admin,changed,legacy,bytes(catalogue),{fetchedAt:day+'T10:00:00.000Z'});await assert.rejects(acquireRegisteredWorker(other,selectionId),/REGISTRATION_DB_SELECTION_CHANGED/);assert.equal(calls,5);
  await verifyRegistration(f.admin);assert(Number.isInteger(pid));
 }finally{await reader?.end();if(writer){await releaseRegisteredWorker(writer).catch(()=>{});await releaseWorker(writer).catch(()=>{});}await writer?.end();await other?.end();await f.stop();await rm(root,{recursive:true,force:true});}
});
