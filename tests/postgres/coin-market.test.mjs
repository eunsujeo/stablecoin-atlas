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
import {initializeRegistration,upgradeRegistration,upgradeCoinMarket,grantRegistrationReader,grantRegistrationWriter,verifyRegistration,requireRegistrationWriter} from '../../tools/market-db/registration-access.mjs';
import {installRegistration,readRegistrationIndex} from '../../tools/market-db/registration.mjs';
import {importCoinMarket} from '../../tools/market-db/registration-coin-market.mjs';
import {runRegisteredCollector} from '../../tools/registered-collector.mjs';
import {receiptStore} from '../../tools/periodic-jobs.mjs';
import {readCompressedSource} from '../../tools/history-archive.mjs';
import {coinMarketProjection} from '../../tools/market-registration/coin-market.mjs';
import {registrationHash} from '../../tools/market-registration/planner.mjs';
import {validateRegistrationIndex} from '../../web/registration-model.js';
const metadata=JSON.parse(await readFile(new URL('../../data/market-registration.json',import.meta.url))),legacy=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url)));
const bytes=x=>Buffer.from(JSON.stringify(x));
const catalogue={peggedAssets:metadata.coins.map(c=>({id:c.defillama.assetId,symbol:c.symbol,gecko_id:c.defillama.geckoId,pegType:c.defillama.pegType,chains:['Ethereum'],chainCirculating:{Ethereum:{current:{[c.defillama.pegType]:'100'}}}}))};
function detailed(c,day,amount='9007199254740993.1234567890123456789'){return bytes({id:c.defillama.assetId,symbol:c.symbol,gecko_id:c.defillama.geckoId,pegType:c.defillama.pegType,address:c.defillama.primaryAddress,price:'0.006313010246021263',tokens:[{date:String(Date.parse(day)/1000),circulating:{[c.defillama.pegType]:amount}}],chainBalances:{Ethereum:{tokens:[{date:String(Date.parse(day)/1000),circulating:{[c.defillama.pegType]:'10'},minted:{[c.defillama.pegType]:'20'}}]}}});}
test('coin market PG17: atomic v3 roles, exact global facts, COMMIT-loss replay, completed-slot backfill HTTP0, immutable scopes and drift',{timeout:120000},async()=>{
 const f=await fixture(),root=await mkdtemp(join(tmpdir(),'atlas-coin-market-'));let writer,reader;
 try{
  await initialize(f.admin);await partition(f.admin,'2026-10');await initializeHistory(f.admin);await normalizeHistory(f.admin,legacy);await enableContinuousHistory(f.admin);
  const writerUrl=await f.createUser('atlas_test_coinmarketwriter'),readerUrl=await f.createUser('atlas_test_coinmarketreader');
  await grantAccess(f.admin,'atlas_test_coinmarketwriter','writer');await grantAccess(f.admin,'atlas_test_coinmarketreader','reader');await grantHistoryWriter(f.admin,'atlas_test_coinmarketwriter');
  writer=await connectDatabase({DATABASE_URL:writerUrl});reader=await connectDatabase({DATABASE_URL:readerUrl});
  await importSources(writer,{registry:legacy,sources:[importPlan(legacy,bytes({requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-22T00:00:00.000Z',data:{price:'1'}}]}))],archiveDirectory:join(root,'market')});
  const fingerprint=async()=>JSON.stringify((await f.admin.query("SELECT 'market' AS scope,encode(structure_hash,'hex') AS hash FROM atlas_market.schema_version UNION ALL SELECT 'history',encode(structure_hash,'hex') FROM atlas_history.schema_version ORDER BY scope,hash")).rows),before=await fingerprint();
  await initializeRegistration(f.admin);await grantRegistrationReader(f.admin,'atlas_test_coinmarketreader');
  const {selectionId}=await installRegistration(f.admin,metadata,legacy,bytes(catalogue),{fetchedAt:'2026-10-22T01:00:00.000Z'});
  assert((await readRegistrationIndex(reader)).coins.every(c=>c.market===undefined));
  await upgradeRegistration(f.admin);await grantRegistrationWriter(f.admin,'atlas_test_coinmarketwriter');
  assert((await readRegistrationIndex(reader)).coins.every(c=>c.market===undefined));
  await assert.rejects(upgradeCoinMarket(writer),/DATABASE_OWNER_REQUIRED/);
  assert.equal((await upgradeCoinMarket(f.admin)).version,3);assert.equal((await upgradeCoinMarket(f.admin)).state,'UNCHANGED');assert.equal(await verifyRegistration(reader),3);await requireRegistrationWriter(writer);assert.equal(await fingerprint(),before);
  const day=(await f.admin.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day")).rows[0].day;
  let calls=0,lost=false;const options={selectionId,once:true,stateDirectory:join(root,'receipts'),archiveRoot:root};
  const collect=()=>runRegisteredCollector({env:{DATABASE_URL:writerUrl},options,connect:async env=>{
   const c=await connectDatabase(env),query=c.query.bind(c);let marketInsert=false;
   c.query=async(sql,...args)=>{if(typeof sql==='string'&&sql.startsWith('INSERT INTO atlas_registration.coin_market_source'))marketInsert=true;const result=await query(sql,...args);if(sql==='COMMIT'&&marketInsert&&!lost){marketInsert=false;lost=true;throw Error('COMMIT response lost');}if(sql==='COMMIT'||sql==='ROLLBACK')marketInsert=false;return result;};return c;
  },fetcher:async url=>{calls++;const c=metadata.coins.find(c=>c.defillama.assetId===url.split('/').at(-1));return new Response(detailed(c,day));}});
  assert.equal((await collect()).state,'PARTIAL');assert.equal(lost,true);assert.equal(calls,5);
  assert.equal((await collect()).state,'COMPLETED');assert.equal(calls,5);
  const index=validateRegistrationIndex(await readRegistrationIndex(reader));assert.equal(index.coins.length,5);assert(index.coins.every(c=>c.market?.price.amount==='0.006313010246021263'&&c.market.price.sourceAsOf===null&&c.market.circulating.amount==='9007199254740993.1234567890123456789'));
  const receipts=await receiptStore(options.stateDirectory);let last;
  for(const c of metadata.coins){const receipt=await receipts.read('REGISTERED_'+c.id.toUpperCase(),day+'T00:00:00.000Z');last={selectionId,coinId:c.id,bytes:await readCompressedSource(join(root,'history'),receipt.payload.sourceHash),fetchedAt:receipt.payload.fetchedAt,requestDay:day};assert.equal((await importCoinMarket(writer,last)).marketSourcesInserted,0);}
  assert.equal(calls,5);assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM atlas_registration.coin_market_source')).rows[0].n,5);assert.equal((await collect()).state,'COMPLETED');assert.equal(calls,5);
  await assert.rejects(importCoinMarket(writer,{...last,requestDay:'2026-02-30'}),/REGISTRATION_SOURCE_INVALID/);
  const correction={...last,bytes:detailed(metadata.coins.find(c=>c.id===last.coinId),day,'0'),fetchedAt:new Date(Date.parse(last.fetchedAt)+1).toISOString()};assert.equal((await importCoinMarket(writer,correction)).marketSourcesInserted,1);
  assert.equal((await readRegistrationIndex(reader)).coins.find(c=>c.id===last.coinId).market.circulating.amount,'0');assert.equal((await importCoinMarket(writer,last)).marketSourcesInserted,0);
  assert.equal((await readRegistrationIndex(reader)).coins.find(c=>c.id===last.coinId).market.circulating.amount,'0');
  for(const sql of ['UPDATE atlas_registration.coin_market_source SET coin=coin','DELETE FROM atlas_registration.coin_market_source','SELECT atlas_registration.reject_mutation()'])await assert.rejects(writer.query(sql),e=>e.code==='42501');
  await assert.rejects(reader.query('INSERT INTO atlas_registration.coin_market_source SELECT * FROM atlas_registration.coin_market_source'),e=>e.code==='42501');
  await assert.rejects(f.admin.query('DELETE FROM atlas_registration.coin_market_source'),e=>e.code==='23514');
  await f.admin.query('GRANT UPDATE(projection) ON atlas_registration.coin_market_source TO atlas_test_coinmarketreader');await assert.rejects(readRegistrationIndex(reader),/REGISTRATION_DB_PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE UPDATE(projection) ON atlas_registration.coin_market_source FROM atlas_test_coinmarketreader');
  await f.admin.query('BEGIN');try{await f.admin.query('ALTER TABLE atlas_registration.coin_market_source ADD COLUMN unwanted text');await assert.rejects(verifyRegistration(f.admin),/REGISTRATION_DB_SCHEMA_MISMATCH/);}finally{await f.admin.query('ROLLBACK');}
  // A collision with changed normalized contents must fail explicitly, not silently skip.
  const conflict={...correction,bytes:detailed(metadata.coins.find(c=>c.id===last.coinId),day,'42'),fetchedAt:new Date(Date.parse(last.fetchedAt)+2).toISOString()},projection=coinMarketProjection(metadata,legacy,conflict.bytes,conflict),id=registrationHash(projection),bad=structuredClone(projection);bad.circulating.amount='43';
  await f.admin.query('INSERT INTO atlas_registration.coin_market_source VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[Buffer.from(id,'hex'),Buffer.from(selectionId,'hex'),Buffer.from(registrationHash(metadata),'hex'),last.coinId,Buffer.from(projection.sourceHash,'hex'),day,projection.fetchedAt,bad]);
  await assert.rejects(importCoinMarket(writer,conflict),/REGISTRATION_DB_CONTENT_CONFLICT/);await assert.rejects(readRegistrationIndex(reader),/REGISTRATION_DB_CONTENT_CONFLICT/);
  assert.equal(await fingerprint(),before);
 }finally{await writer?.end();await reader?.end();await f.stop();await rm(root,{recursive:true,force:true});}
});
