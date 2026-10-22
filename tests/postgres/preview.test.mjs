import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fixture} from './fixture.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {initialize,partition,grantAccess} from '../../tools/market-db/schema.mjs';
import {importSources} from '../../tools/market-db/repository.mjs';
import {importPlan} from '../../tools/market-db/plan.mjs';
import {normalizeSources} from '../../tools/market-store.mjs';
import {databaseMarket,databaseMarketReader} from '../../tools/market-db/preview.mjs';
import {series,rank,latest} from '../../web/market-model.js';
import {startPreviewServer} from '../../tools/ui-preview.mjs';
const registry=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url)));
test('DB preview: reader-only consistent snapshot, exact provenance, real bounded samples, no JSON dependency or fallback',{timeout:120000},async()=>{
  const f=await fixture(),directory=await mkdtemp(join(tmpdir(),'atlas-db-preview-'));let writer,reader,server;
  try {
    await initialize(f.admin);await partition(f.admin,'2026-10');
    const writerUrl=await f.createUser('atlas_test_previewwriter'),readerUrl=await f.createUser('atlas_test_previewreader');
    await grantAccess(f.admin,'atlas_test_previewwriter','writer');await grantAccess(f.admin,'atlas_test_previewreader','reader');
    writer=await connectDatabase({DATABASE_URL:writerUrl});reader=await connectDatabase({DATABASE_URL:readerUrl});
    const now=Date.parse('2026-10-22T00:00:00Z');
    const requests=Array.from({length:205},(_,i)=>({endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,
      observedAt:new Date(now-3600000+Math.floor(i/2)*1000).toISOString(),data:{price:'0.'+String(9007199254740993n+BigInt(i)),circulatingSupply:i===0?'0':undefined}}));
    requests.push({endpoint:'/token/market/tether',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-01T00:00:00.000001Z',data:{price:'1'}},
      {endpoint:'/token/holders/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-21T00:00:00.123456Z',data:{totalSupply:{ethereum:'9007199254740993.000000000000000000000000000000000001',solana:'0'}}},
      {endpoint:'/networks/status',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-21T00:00:00.123456Z',data:{ethereum:{active:true,tip:'9007199254740993',asOf:{tip:'2026-10-21T00:00:00.123456789Z'}}}},
      {endpoint:'/token/market/usd-coin',state:'FAILED',httpStatus:429,observedAt:new Date(now-1000).toISOString()},
      {endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:new Date(now-500).toISOString(),data:{totalSupply:null}});
    const body={requests},bytes=Buffer.from(JSON.stringify(body)),plan=importPlan(registry,bytes);
    const ingest=p=>importSources(writer,{registry,sources:[p],archiveDirectory:join(directory,'archive')});await ingest(plan);
    const baseline=normalizeSources(registry,[{value:body,hash:plan.hash}]);
    const snapshot=await databaseMarket(reader,registry,{now});
    assert.equal(snapshot.readState.sampled,true);assert.equal(snapshot.readState.latestMissingFields,1);
    const prices=snapshot.observations.filter(o=>o.coinId==='usdc'&&o.metric==='PRICE');assert.equal(prices.length,200);
    assert.equal(prices[0].amount,requests[0].data.price);assert.equal(prices.at(-1).amount,requests[204].data.price);
    assert.equal(new Set(prices.map(o=>o.id)).size,200);
    const originals=new Map(baseline.observations.map(o=>[o.id,o]));
    for(const row of snapshot.observations){const old=originals.get(row.id);assert.ok(old);for(const key of ['amount','groupId','selector','sourceHash','observationClock','coinId','networkId','deploymentId'])assert.equal(row[key],old[key]);assert.equal(Date.parse(row.observedAt),Date.parse(old.observedAt));}
    assert.equal(snapshot.networks[0].tip,'9007199254740993');assert.equal(snapshot.networks[0].sourceAt,'2026-10-21T00:00:00.123456789Z');
    assert.equal(rank(snapshot,'usdc').length,2);
    await assert.rejects(databaseMarket(writer,registry,{now}),/DATABASE_READER_REQUIRED/);
    await assert.rejects(databaseMarket(f.admin,registry,{now}),/DATABASE_ROLE_UNSAFE/);
    await assert.rejects(reader.query("DELETE FROM atlas_market.coin"),e=>e.code==='42501');
    // Data arriving after the first SELECT must be invisible throughout this snapshot.
    const query=reader.query.bind(reader);let inserted=false;
    reader.query=async(...args)=>{
      if(typeof args[0]==='string'&&args[0].startsWith('WITH numbered')&&!inserted){inserted=true;await ingest(importPlan(registry,Buffer.from(JSON.stringify({requests:[{endpoint:'/token/market/tether',state:'SUCCESS',httpStatus:200,observedAt:new Date(now-1).toISOString(),data:{price:'2'}}]}))));}
      return query(...args);
    };
    const consistent=await databaseMarket(reader,registry,{now});assert.equal(latest(consistent,{coinId:'usdt',metric:'PRICE'})[0].amount,'1');reader.query=query;
    const next=await databaseMarket(reader,registry,{now});assert.equal(latest(next,{coinId:'usdt',metric:'PRICE'})[0].amount,'2');
    // A latest value older than the chart window remains available only in latest/detail.
    const old=await databaseMarket(reader,registry,{now:Date.parse('2026-12-22T00:00:00Z')});
    assert.ok(old.observations.length);assert.equal(series(old,old.observations[0]).length,0);
    const d=registry.deployments.find(d=>d.networkId==='xrpl'),ledgerHash='A'.repeat(64);
    const xrpl=importPlan(registry,Buffer.from(JSON.stringify({kind:'XRPL_GATEWAY_OBLIGATIONS_RESEARCH_NOT_ASSESSMENT',observedAt:'2026-10-21T12:00:00.123456Z',ledgerHash,ledgerIndex:'9007199254740993',observations:[{status:'OBSERVED',issuer:d.identity.issuer,currency:d.identity.currency,metric:'gateway_balances.obligations',value:'42',ledgerHash,ledgerIndex:'9007199254740993'}]})));
    await ingest(xrpl);const withLedger=await databaseMarket(reader,registry,{now}),obligation=withLedger.observations.find(o=>o.metric==='OBLIGATIONS');assert.equal(obligation.ledgerHash,ledgerHash.toLowerCase());assert.equal(obligation.ledgerIndex,'9007199254740993');
    const count=async()=> (await f.admin.query('SELECT count(*)::int AS n FROM atlas_market.observation')).rows[0].n,before=await count();
    const read=databaseMarketReader({env:{DATABASE_URL:readerUrl},marketDirectory:join(directory,'no-json'),now:()=>now});
    server=await startPreviewServer(0,{marketReader:read,marketDirectory:join(directory,'no-json')});const url='http://127.0.0.1:'+server.address().port;
    const response=await fetch(url+'/market-data.json');assert.equal(response.status,200);const json=await response.json();assert.equal(json.readState.source,'POSTGRESQL');assert.equal(json.observations.length,withLedger.observations.length);assert.equal(await count(),before);
    for(const path of ['/.env.local','/market-data.json?sql=select','/.state/market-db-secrets/reader.env'])assert.equal((await fetch(url+path)).status,404);
    const wrong=structuredClone(registry);wrong.coins[0].name='wrong';
    await assert.rejects(databaseMarket(reader,wrong,{now}),/DATABASE_REGISTRY_MISMATCH/);
    await new Promise(resolve=>server.close(resolve));server=null;
    server=await startPreviewServer(0,{marketReader:databaseMarketReader({env:{DATABASE_URL:writerUrl},marketDirectory:directory,now:()=>now})});
    const failed=await fetch('http://127.0.0.1:'+server.address().port+'/market-data.json');assert.equal(failed.status,503);assert.equal(await failed.text(),'MARKET_DATA_UNAVAILABLE');
    await f.admin.query(`INSERT INTO atlas_market.series(subject_id,metric_id,scope,provider_id,endpoint_path,selector_suffix)
      SELECT s.subject_id,s.metric_id,s.scope,s.provider_id,s.endpoint_path,s.selector_suffix||'.synthetic'||g.i FROM atlas_market.series s CROSS JOIN generate_series(1,12) g(i) WHERE s.id=(SELECT min(id) FROM atlas_market.series)`);
    const adaptive=await databaseMarket(reader,registry,{now});assert.ok(adaptive.readState.pointsPerSeries<200);
    assert.equal(adaptive.observations.filter(o=>o.metric==='PRICE'&&o.coinId==='usdc').length,adaptive.readState.pointsPerSeries);
    await f.admin.query(`INSERT INTO atlas_market.series(subject_id,metric_id,scope,provider_id,endpoint_path,selector_suffix)
      SELECT s.subject_id,s.metric_id,s.scope,s.provider_id,s.endpoint_path,s.selector_suffix||'.overflow'||g.i FROM atlas_market.series s CROSS JOIN generate_series(1,12) g(i) WHERE s.id=(SELECT min(id) FROM atlas_market.series)`);
    await assert.rejects(databaseMarket(reader,registry,{now}),/QUERY_SERIES_LIMIT/);
  } finally {if(server)await new Promise(resolve=>server.close(resolve));await reader?.end();await writer?.end();await f.stop();await rm(directory,{recursive:true,force:true});}
});
