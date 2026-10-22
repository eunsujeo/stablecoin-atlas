import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture} from './fixture.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {initialize,partition,grantAccess,verifySchema} from '../../tools/market-db/schema.mjs';
import {importSources} from '../../tools/market-db/repository.mjs';
import {importPlan} from '../../tools/market-db/plan.mjs';
import {initializeHistory,normalizeHistory,enableContinuousHistory,grantHistoryWriter,requireHistoryRuntime} from '../../tools/market-db/history.mjs';
import {acquireWorker,releaseWorker} from '../../tools/market-db/scheduler.mjs';
import {databaseRegistrationReader} from '../../tools/market-db/registration-preview.mjs';
import {initializeRegistration,grantRegistrationReader} from '../../tools/market-db/registration-access.mjs';
import {installRegistration,importRegistrationHistory,readRegistrationHistory,readRegistrationIndex} from '../../tools/market-db/registration.mjs';
const metadata=JSON.parse(await readFile(new URL('../../data/market-registration.json',import.meta.url))),legacy=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url)));
const bytes=value=>Buffer.from(JSON.stringify(value));
const catalogue=()=>({peggedAssets:metadata.coins.map(c=>{
 const keys=metadata.coverage.filter(p=>p.coinId===c.id).map(p=>metadata.networks.find(n=>n.id===p.networkId).defillamaKey);
 return {id:c.defillama.assetId,symbol:c.symbol,gecko_id:c.defillama.geckoId,pegType:c.defillama.pegType,chains:keys,chainCirculating:Object.fromEntries(keys.map((k,i)=>[k,{current:{[c.defillama.pegType]:String(100-i)}}]))};
})});
function detailed({amount='9007199254740993.123456789012345678901234567890123456',tag=1,networks,missingMinted=false}={}){
 const c=metadata.coins.find(c=>c.id==='jpyc'),keys=networks??metadata.coverage.filter(p=>p.coinId===c.id).map(p=>metadata.networks.find(n=>n.id===p.networkId).defillamaKey);
 return bytes({id:c.defillama.assetId,symbol:c.symbol,gecko_id:c.defillama.geckoId,pegType:c.defillama.pegType,address:c.defillama.primaryAddress,tag,chainBalances:Object.fromEntries(keys.map(k=>[k,{tokens:[20,21,22].map(d=>({date:Date.parse('2026-10-'+d)/1000,circulating:{peggedJPY:amount},...(!missingMinted?{minted:{peggedJPY:'100000000000000000000.000000000000000001'}}:{})}))}]))});
}
test('registration PG17: additive metadata, JPY units, dedupe, immutable source reconstruction, ordering, filters, RLS and drift',{timeout:120000},async()=>{
 const f=await fixture(),directory=await mkdtemp(join(tmpdir(),'atlas-registration-'));let reader,writer,second;
 try{
  await initialize(f.admin);await partition(f.admin,'2026-10');await initializeHistory(f.admin);await normalizeHistory(f.admin,legacy);await enableContinuousHistory(f.admin);
  const readerUrl=await f.createUser('atlas_test_registrationreader'),writerUrl=await f.createUser('atlas_test_registrationwriter');
  await grantAccess(f.admin,'atlas_test_registrationreader','reader');await grantAccess(f.admin,'atlas_test_registrationwriter','writer');
  await grantHistoryWriter(f.admin,'atlas_test_registrationwriter');
  reader=await connectDatabase({DATABASE_URL:readerUrl});writer=await connectDatabase({DATABASE_URL:writerUrl});second=await connectDatabase({DATABASE_URL:f.url('postgres')});
  await importSources(writer,{registry:legacy,sources:[importPlan(legacy,bytes({requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-22T00:00:00.000Z',data:{price:'1'}}]}))],archiveDirectory:join(directory,'archive')});
  await acquireWorker(writer); // The existing collector retains its session lock throughout this rollout.
  const fingerprints=async()=>JSON.stringify((await f.admin.query("SELECT 'market' AS scope,encode(structure_hash,'hex') AS hash FROM atlas_market.schema_version UNION ALL SELECT 'history',encode(structure_hash,'hex') FROM atlas_history.schema_version ORDER BY scope,hash")).rows);
  const before=await fingerprints();assert.equal((await initializeRegistration(f.admin)).state,'INITIALIZED');assert.equal((await initializeRegistration(f.admin)).state,'UNCHANGED');assert.equal(await fingerprints(),before);
  const cat=bytes(catalogue()),installation=await installRegistration(f.admin,metadata,legacy,cat,{fetchedAt:'2026-10-22T01:00:00.000Z'}),selectionId=installation.selectionId;
  assert.equal(installation.activeInDashboard,false);assert.equal((await installRegistration(f.admin,metadata,legacy,cat,{fetchedAt:'2026-10-22T01:05:00.000Z'})).selectionId,selectionId);
  const filter={selectionId,coinId:'jpyc',metric:'NETWORK_CIRCULATING',from:'2026-10-20',to:'2026-10-22'},read=change=>readRegistrationHistory(reader,{...filter,...change});
  await assert.rejects(read());await assert.rejects(initializeRegistration(writer),/DATABASE_OWNER_REQUIRED/);await assert.rejects(installRegistration(writer,metadata,legacy,cat,{fetchedAt:'2026-10-22T01:00:00.000Z'}),/DATABASE_OWNER_REQUIRED/);
  await assert.rejects(grantRegistrationReader(f.admin,'atlas_test_registrationwriter'),/REGISTRATION_DB_READER_REQUIRED/);
  assert.equal((await grantRegistrationReader(f.admin,'atlas_test_registrationreader')).state,'GRANTED');assert.equal((await grantRegistrationReader(f.admin,'atlas_test_registrationreader')).state,'UNCHANGED');
  assert.equal((await readRegistrationIndex(reader)).selectionId,selectionId);
  assert.equal((await read()).state,'MISSING');
  const input={selectionId,coinId:'jpyc',bytes:detailed(),fetchedAt:'2026-10-22T02:00:00.000Z'},initial=await importRegistrationHistory(f.admin,input);
  assert.deepEqual(initial,{state:'IMPORTED',sourcesInserted:2,valuesInserted:24,coverageInserted:2,providerRequests:0});
  assert.equal((await readRegistrationIndex(reader)).coins.find(c=>c.id==='jpyc').metrics.length,2);
  await assert.rejects(readRegistrationIndex(writer));
  const original=await read();assert.equal(original.pegCurrency,'JPY');assert.equal(original.contract.unit,'token');assert.equal(original.selected[0].reportedUsdValue,'100');assert.equal(original.series.length,4);assert.equal(original.series[0].points[0].amount,'9007199254740993.123456789012345678901234567890123456');
  const again=await importRegistrationHistory(f.admin,{...input,fetchedAt:'2026-10-22T02:05:00.000Z'});assert.equal(again.sourcesInserted,0);assert.equal(again.valuesInserted,0);assert.equal((await read()).updatedAt,original.updatedAt);
  const corrected={...input,bytes:detailed({amount:'20',tag:2}),fetchedAt:'2026-10-22T03:00:00.000Z'};
  // A newer import between index and history must not mix old scope with a new source.
  let raced=false;const request=databaseRegistrationReader({connect:async()=>({end:async()=>{}}),
   index:async()=>{const scope=await readRegistrationIndex(reader);await importRegistrationHistory(f.admin,{...input,bytes:detailed({amount:'55',tag:'index-race'}),fetchedAt:'2026-10-22T02:30:00.000Z'});raced=true;return scope;},
   history:async(_client,filter)=>readRegistrationHistory(reader,filter)});
  const pinned=await request('/registration-history.json?'+new URLSearchParams({selection:selectionId,coin:'jpyc',metric:'NETWORK_CIRCULATING'}));
  assert.equal(raced,true);assert.equal(pinned.sourceId,original.sourceId);assert.equal(pinned.updatedAt,original.updatedAt);assert.deepEqual(pinned.series,original.series);
  const correctedStats=await importRegistrationHistory(f.admin,corrected);assert.equal(correctedStats.valuesInserted,12);const correction=await read();assert.equal(correction.series[0].points[0].amount,'20');
  assert.deepEqual((await read({sourceId:original.sourceId})).series,original.series);
  await importRegistrationHistory(f.admin,{...input,fetchedAt:'2026-10-22T04:00:00.000Z'});assert.equal((await read()).sourceId,correction.sourceId); // Replay does not become a new observation.
  const returned=await importRegistrationHistory(f.admin,{...input,bytes:detailed({tag:3}),fetchedAt:'2026-10-22T05:00:00.000Z'});assert.equal(returned.valuesInserted,0);assert.equal(returned.coverageInserted,0);assert.deepEqual((await read()).series,original.series);
  await importRegistrationHistory(f.admin,{...input,bytes:detailed({amount:'3',tag:4}),fetchedAt:'2026-10-22T01:30:00.000Z'});assert.deepEqual((await read()).series,original.series);
  const concurrent={...input,bytes:detailed({amount:'42',tag:5}),fetchedAt:'2026-10-22T06:00:00.000Z'};
  const results=await Promise.all([importRegistrationHistory(f.admin,concurrent),importRegistrationHistory(second,concurrent)]);assert.equal(results.reduce((n,r)=>n+r.sourcesInserted,0),2);assert.equal(results.reduce((n,r)=>n+r.valuesInserted,0),12);
  await importRegistrationHistory(f.admin,{...concurrent,bytes:detailed({amount:'43',tag:'tie'})});
  const tied=(await f.admin.query("SELECT encode(id,'hex') AS id FROM atlas_registration.daily_source WHERE selection_id=$1 AND coin='jpyc' AND metric='NETWORK_CIRCULATING' AND fetched_at='2026-10-22T06:00:00.000Z' ORDER BY id DESC",[Buffer.from(selectionId,'hex')])).rows;
  assert.equal((await read()).sourceId,tied[0].id);
  await importRegistrationHistory(f.admin,{...input,bytes:detailed({amount:'0',tag:6,networks:['Ethereum'],missingMinted:true}),fetchedAt:'2026-10-22T07:00:00.000Z'});
  const partial=await read();assert.equal(partial.series.length,1);assert.equal(partial.state,'PARTIAL');assert.equal(partial.series[0].points[0].amount,'0');assert.equal(partial.missingNetworks.length,3);
  assert.equal((await read({metric:'NETWORK_MINTED'})).state,'MISSING');assert.deepEqual((await read({metric:'NETWORK_MINTED'})).series,[]);assert.equal((await read({from:'2026-10-22'})).series[0].points.length,1);
  assert.deepEqual((await read({sourceId:correction.sourceId})).series,correction.series);
  const query=reader.query.bind(reader);let changed=false;
  reader.query=async(...args)=>{if(typeof args[0]==='string'&&args[0].includes('FROM atlas_registration.daily_source WHERE selection_id=')&&!changed){changed=true;await importRegistrationHistory(f.admin,{...input,bytes:detailed({amount:'99',tag:'snapshot'}),fetchedAt:'2026-10-22T08:00:00.000Z'});}return query(...args);};
  assert.equal((await read()).sourceId,partial.sourceId);reader.query=query;assert.equal((await read()).series[0].points[0].amount,'99');
  await assert.rejects(read({coinId:'usdc',sourceId:correction.sourceId}),/REGISTRATION_DB_SOURCE_REQUIRED/);
  await assert.rejects(importRegistrationHistory(writer,input),/DATABASE_OWNER_REQUIRED/);
  const forged=JSON.parse(detailed().toString());forged.id='427';await assert.rejects(importRegistrationHistory(f.admin,{...input,bytes:bytes(forged)}),/REGISTRATION_ASSET_IDENTITY_MISMATCH/);
  const conflicting=structuredClone(metadata);conflicting.coins[0].notes.push('changed without a revision');await assert.rejects(installRegistration(f.admin,conflicting,legacy,cat,{fetchedAt:input.fetchedAt}),/REGISTRATION_DB_CONTENT_CONFLICT/);
  const nextMetadata=structuredClone(metadata);nextMetadata.revision=2;nextMetadata.coins[0].notes.push('new revision');const nextSelection=await installRegistration(f.admin,nextMetadata,legacy,cat,{fetchedAt:'2026-10-22T08:30:00.000Z'});
  const freshIndex=await readRegistrationIndex(reader);assert.equal(freshIndex.selectionId,nextSelection.selectionId);assert.equal(freshIndex.coins.find(c=>c.id==='jpyc').metrics.length,0);
  assert.equal((await read({selectionId:nextSelection.selectionId})).state,'MISSING');assert.equal((await read()).series[0].points[0].amount,'99');
  const unsafeCatalogue=catalogue();unsafeCatalogue.peggedAssets.find(c=>c.id==='355').chains.push('Unreviewed Network');unsafeCatalogue.peggedAssets.find(c=>c.id==='355').chainCirculating['Unreviewed Network']={current:{peggedJPY:'999999'}};
  const unsafe=await installRegistration(f.admin,metadata,legacy,bytes(unsafeCatalogue),{fetchedAt:'2026-10-22T08:00:00.000Z'});await assert.rejects(importRegistrationHistory(f.admin,{...input,selectionId:unsafe.selectionId}),/REGISTRATION_DB_REVIEW_REQUIRED/);
  for(const sql of ['UPDATE atlas_registration.daily_value SET amount=\'0\'','DELETE FROM atlas_registration.daily_source',"INSERT INTO atlas_registration.reader_grant VALUES('x')",'SELECT atlas_registration.reject_mutation()'])await assert.rejects(reader.query(sql),e=>e.code==='42501');
  await assert.rejects(f.admin.query("UPDATE atlas_registration.daily_value SET amount='0'"),e=>e.code==='23514');
  await f.admin.query('GRANT UPDATE(amount) ON atlas_registration.daily_value TO atlas_test_registrationreader');await assert.rejects(read(),/REGISTRATION_DB_PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE UPDATE(amount) ON atlas_registration.daily_value FROM atlas_test_registrationreader');
  await f.admin.query('GRANT EXECUTE ON FUNCTION atlas_registration.reject_mutation() TO PUBLIC');await assert.rejects(read(),/REGISTRATION_DB_PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE ALL ON FUNCTION atlas_registration.reject_mutation() FROM PUBLIC');
  await f.admin.query('ALTER TABLE atlas_registration.daily_value DISABLE TRIGGER immutable_record');await assert.rejects(read(),/REGISTRATION_DB_SCHEMA_MISMATCH/);await f.admin.query('ALTER TABLE atlas_registration.daily_value ENABLE TRIGGER immutable_record');
  await verifySchema(f.admin);await requireHistoryRuntime(writer);assert.equal(await fingerprints(),before);
 }finally{await reader?.end();if(writer)await releaseWorker(writer);await writer?.end();await second?.end();await f.stop();await rm(directory,{recursive:true,force:true});}
});
