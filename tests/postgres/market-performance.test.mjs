import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture} from './fixture.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {initialize,partition,grantAccess} from '../../tools/market-db/schema.mjs';
import {initializeCatalog,grantCatalogReader,importCatalog} from '../../tools/market-db/catalog.mjs';
import {initializeHistory,normalizeHistory,enableContinuousHistory,grantHistoryReader} from '../../tools/market-db/history.mjs';
import {importSources} from '../../tools/market-db/repository.mjs';
import {importPlan} from '../../tools/market-db/plan.mjs';
import {databaseMarket} from '../../tools/market-db/preview.mjs';
import {verifyProductionReader} from '../../tools/production-database.mjs';
import {transaction} from '../../tools/market-db/connection.mjs';
import {withValidationBatch,prefetchValidation} from '../../tools/market-db/validation-batch.mjs';

const registry=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url)));
const profiles=JSON.parse(await readFile(new URL('../../data/token-profiles.json',import.meta.url))).profiles;
const dataQuery=sql=>/^(SELECT id FROM atlas_market.series|WITH numbered|SELECT s.id::text AS series|SELECT n.code AS "networkId"|WITH latest|SELECT DISTINCT ON \(p.deployment_id\)|SELECT DISTINCT ON \(s.coin_id,s.metric\) encode|SELECT encode\(s.id,'hex'\) AS source)/.test(sql);
const category=sql=>dataQuery(sql)?'data':/^(BEGIN|COMMIT|ROLLBACK|DISCARD|SET)/.test(sql)?'session':'validation';
const sum=rows=>Object.fromEntries(['validation','data','session'].map(key=>[key,rows.filter(r=>r.category===key).length]));
// Exact previous health query, kept only as a fixture equivalence/plan oracle.
const legacyHealth=`WITH latest AS (
  SELECT DISTINCT ON (d.provider_id,d.endpoint_path,d.target_subject_id) q.id,q.observed_at,q.state
  FROM atlas_market.request_definition d JOIN atlas_market.collection_request q ON q.definition_id=d.id
  ORDER BY d.provider_id,d.endpoint_path,d.target_subject_id,q.observed_at DESC,q.id DESC
) SELECT (SELECT count(*)::int FROM latest WHERE state NOT IN ('SUCCESS','RECORDED')) AS failures,
  (SELECT count(*)::int FROM latest q JOIN atlas_market.observation o ON o.request_id=q.id AND o.observed_at=q.observed_at WHERE o.state='MISSING') AS missing`;

test('market MISS: owned full PG17 schema query census, equivalent batched validations and local execution plans',{timeout:120000},async()=>{
  const f=await fixture(),directory=await mkdtemp(join(tmpdir(),'atlas-market-perf-'));let writer,reader;
  try{
    await initialize(f.admin);await partition(f.admin,'2026-10');
    const writerURL=await f.createUser('atlas_test_perfwriter'),readerURL=await f.createUser('atlas_test_perfreader');
    await grantAccess(f.admin,'atlas_test_perfwriter','writer');await grantAccess(f.admin,'atlas_test_perfreader','reader');
    writer=await connectDatabase({DATABASE_URL:writerURL});reader=await connectDatabase({DATABASE_URL:readerURL});
    const now=Date.parse('2026-10-26T00:00:00Z');
    const requests=Array.from({length:205},(_,i)=>({endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,
      observedAt:new Date(now-3600000+i*1000).toISOString(),data:{price:'1.'+String(9007199254740993n+BigInt(i))}}));
    await importSources(writer,{registry,sources:[importPlan(registry,Buffer.from(JSON.stringify({requests})))],archiveDirectory:join(directory,'archive')});
    await initializeCatalog(f.admin);await grantCatalogReader(f.admin,'atlas_test_perfreader');await importCatalog(f.admin,registry,profiles);
    await initializeHistory(f.admin);await normalizeHistory(f.admin,registry);await enableContinuousHistory(f.admin);await grantHistoryReader(f.admin,'atlas_test_perfreader');
    // Dense request history with unchanged imported observations/provenance.
    // All writes target the newly owned fixture, not a workspace database.
    await f.admin.query(`INSERT INTO atlas_market.collection_request(run_id,ordinal,definition_id,state,evidence_kind,source_position,observed_at,observation_clock,artifact_id,selector_prefix)
      SELECT r.run_id,1000+g.i,r.definition_id,r.state,r.evidence_kind,'synthetic-old-'||g.i,
        timestamptz '2026-10-01T00:00:00Z'+g.i*interval '1 second',r.observation_clock,r.artifact_id,r.selector_prefix
      FROM (SELECT * FROM atlas_market.collection_request ORDER BY id LIMIT 1) r CROSS JOIN generate_series(1,50000) g(i)`);
    await f.admin.query('ANALYZE atlas_market.collection_request');
    const raw=reader.query.bind(reader),plans=[];
    const measure=async(batchValidation,delayMs=0)=>{
      const trace=[];let phase='checkout';
      reader.query=async(sql,values)=>{if(!batchValidation&&sql.startsWith('WITH latest'))sql=legacyHealth;const start=performance.now();try{if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));return await raw(sql,values);}finally{trace.push({phase,category:category(sql),sql,values,ms:performance.now()-start});}};
      const started=performance.now();
      try{
        await verifyProductionReader(reader);phase='market';
        const data=await databaseMarket(reader,registry,{now,batchValidation});
        phase='cleanup';await reader.query('ROLLBACK');await reader.query('DISCARD ALL');
        return {data,trace,ms:performance.now()-started};
      }finally{reader.query=raw;}
    };
    const before=await measure(false),after=await measure(true);
    assert.deepEqual(after.data,before.data);
    assert.equal(after.trace.length,64);
    assert.deepEqual(sum(before.trace),{validation:80,data:8,session:12});
    assert.deepEqual(sum(after.trace),{validation:44,data:8,session:12});
    const delayedBefore=await measure(false,10),delayedAfter=await measure(true,10);
    assert.deepEqual(delayedAfter.data,delayedBefore.data);
    // Fixture-only EXPLAIN; never loads workspace credentials or addresses a real DB.
    for(const [mode,trace]of [['sequential',before.trace],['batched',after.trace]])for(const row of trace.filter(r=>r.category!=='session')){
      const {rows}=await raw('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+row.sql,row.values);
      const p=rows[0]['QUERY PLAN'][0];
      const nodes=[];const visit=n=>{nodes.push({node:n['Node Type'],relation:n['Relation Name'],index:n['Index Name'],rows:n['Actual Rows'],loops:n['Actual Loops'],sort:n['Sort Method'],sharedHits:n['Shared Hit Blocks'],tempRead:n['Temp Read Blocks'],tempWritten:n['Temp Written Blocks']});for(const child of n.Plans??[])visit(child);};visit(p.Plan);
      plans.push({mode,category:row.category,query:row.sql.split('\n')[0],planningMs:p['Planning Time'],executionMs:p['Execution Time'],nodes});
    }
    const report={fixture:'OWNED_PG17_SYNTHETIC_NOT_PRODUCTION',observations:205,requests:50205,before:{count:before.trace.length,categories:sum(before.trace),ms:before.ms},after:{count:after.trace.length,categories:sum(after.trace),ms:after.ms},injectedDelay:{msPerQuery:10,beforeMs:delayedBefore.ms,afterMs:delayedAfter.ms},plans,
      census:before.trace.map(({phase,category,sql,ms},i)=>({number:i+1,phase,category,query:sql.split('\n')[0],ms}))};
    await mkdir('.state/agent-logs',{recursive:true});await writeFile('.state/agent-logs/market-miss-profile.json',JSON.stringify(report,null,2)+'\n');
    assert.equal(before.trace.length,100);
    assert.equal(before.data.observations.length,200);
    // Multiple definition versions must still be grouped by provider/path/target,
    // with the original (observed_at,id) tie break across all versions.
    const oldDefinition=(await f.admin.query('SELECT id FROM atlas_market.request_definition ORDER BY id LIMIT 1')).rows[0].id;
    const newDefinition=(await f.admin.query(`INSERT INTO atlas_market.request_definition(provider_id,endpoint_path,version,target_subject_id,request_kind,request_shape)
      SELECT provider_id,endpoint_path,version+1,target_subject_id,request_kind,request_shape FROM atlas_market.request_definition WHERE id=$1 RETURNING id`,[oldDefinition])).rows[0].id;
    const healthSQL=after.trace.find(row=>row.sql.startsWith('WITH latest')).sql;
    for(const [definition,state]of [[newDefinition,'FAILED'],[oldDefinition,'SUCCESS'],[newDefinition,'NOT_ATTEMPTED'],[oldDefinition,'PARTIAL'],[newDefinition,'RECORDED']]){
      await f.admin.query(`INSERT INTO atlas_market.collection_request(run_id,ordinal,definition_id,state,evidence_kind,source_position,observed_at,observation_clock,artifact_id,selector_prefix)
        SELECT run_id,(SELECT max(ordinal)+1 FROM atlas_market.collection_request),$1,$2,evidence_kind,'synthetic-tie',
          (SELECT max(observed_at) FROM atlas_market.collection_request),observation_clock,artifact_id,selector_prefix
        FROM atlas_market.collection_request ORDER BY id LIMIT 1`,[definition,state]);
      assert.deepEqual((await raw(healthSQL)).rows,(await raw(legacyHealth)).rows);
      assert.equal((await raw(healthSQL)).rows[0].failures,['SUCCESS','RECORDED'].includes(state)?0:1);
    }
    // Each independent ACL/policy/structure fault still rejects the default
    // batched reader, then a fresh snapshot succeeds after restoration.
    for(const [mutate,restore,error]of [
      ['GRANT UPDATE(name) ON atlas_market.coin TO atlas_test_perfreader','REVOKE UPDATE(name) ON atlas_market.coin FROM atlas_test_perfreader',/DATABASE_PRIVILEGES_UNSAFE/],
      ['CREATE POLICY unexpected ON atlas_market.coin FOR SELECT TO atlas_test_perfreader USING(true)','DROP POLICY unexpected ON atlas_market.coin',/DATABASE_POLICIES_MISMATCH/],
      ['ALTER TABLE atlas_market.coin NO FORCE ROW LEVEL SECURITY','ALTER TABLE atlas_market.coin FORCE ROW LEVEL SECURITY',/DATABASE_SCHEMA_MISMATCH/],
      ['CREATE POLICY unexpected ON atlas_catalog.token_profile FOR SELECT TO atlas_test_perfreader USING(true)','DROP POLICY unexpected ON atlas_catalog.token_profile',/CATALOG_POLICIES_UNSAFE/],
      ['CREATE POLICY unexpected ON atlas_history.daily_source FOR SELECT TO atlas_test_perfreader USING(true)','DROP POLICY unexpected ON atlas_history.daily_source',/HISTORY_POLICIES_UNSAFE/]
    ]){
      await f.admin.query(mutate);
      try{await assert.rejects(databaseMarket(reader,registry,{now}),error);}finally{await f.admin.query(restore);}
      assert.deepEqual(await databaseMarket(reader,registry,{now}),before.data);
    }
    await assert.rejects(transaction(reader,()=>withValidationBatch(reader,async scoped=>{
      await prefetchValidation(scoped,['SELECT 1 AS ok','SELECT 1/0 AS failed']);
    }),{readonly:true,repeatableRead:true}),e=>e.code==='22012');
    assert.deepEqual(await databaseMarket(reader,registry,{now}),before.data);
  }finally{await reader?.end();await writer?.end();await f.stop();await rm(directory,{recursive:true,force:true});}
});
