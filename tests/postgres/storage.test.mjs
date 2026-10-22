import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fixture} from './fixture.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {initialize,partition,grantAccess} from '../../tools/market-db/schema.mjs';
import {importPlan,digest} from '../../tools/market-db/plan.mjs';
import {importSources,listSeries,latestValues,history,latestNetworks,networkHistory} from '../../tools/market-db/repository.mjs';
const exec=promisify(execFile),registry=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url)));
const original={observedAt:'2026-10-21T12:00:00.123456Z',requests:[
  {endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,data:{price:'0.999999999999999999999999999999999999',circulatingSupply:'9007199254740993.000000000000000000000000000000000001',totalSupply:null,totalVolume:'42'}},
  {endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,data:{price:'1',circulatingSupply:'9007199254740993.000000000000000000000000000000000001',totalSupply:null}},
  {endpoint:'/token/holders/usd-coin',state:'SUCCESS',httpStatus:200,data:{totalSupply:{ethereum:'0',solana:'2'}}},
  {endpoint:'/networks/status',state:'SUCCESS',httpStatus:200,data:{ethereum:{active:true,tip:'9007199254740993',asOf:{tip:'2026-10-21T11:59:00.000001789Z'}}}},
  {endpoint:'/token/market/usd-coin',state:'FAILED',httpStatus:429,observedAt:'2026-10-21T12:02:00.000000Z'}
]};
const source=body=>importPlan(registry,Buffer.from(JSON.stringify(body)));
const next=(price,at)=>source({requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:at,data:{price,circulatingSupply:'10'}}]});
const counts=async admin=>(await admin.query(`SELECT (SELECT count(*)::int FROM atlas_market.observation) AS observations,(SELECT count(*)::int FROM atlas_market.collection_run) AS runs,(SELECT count(*)::int FROM atlas_market.artifact) AS artifacts`)).rows[0];
test('owned PostgreSQL: migration, real RLS roles, exact import lineage/idempotency/concurrency/rollback and bounded queries',{timeout:120000},async t=>{
  const f=await fixture(),directory=await mkdtemp(join(tmpdir(),'atlas-db-integration-')),clients=[];let writer,reader,writerUrl;
  const connect=async url=>{const c=await connectDatabase({DATABASE_URL:url});clients.push(c);return c;};
  const step=async(name,body)=>{let failed=false;await t.test(name,async()=>{try{await body();}catch(error){failed=true;throw error;}});if(failed)throw new Error('POSTGRES_SUBTEST_FAILED: '+name);};
  const ingest=(client,plans)=>importSources(client,{registry,sources:plans,archiveDirectory:join(directory,'archive')});
  try{
    await step('privileged init is explicit/idempotent, partitions retain structure, grants use real unprivileged logins',async()=>{
      assert.equal((await initialize(f.admin)).state,'INITIALIZED');assert.equal((await initialize(f.admin)).state,'UNCHANGED');
      await partition(f.admin,'2026-10');await partition(f.admin,'2026-10');await partition(f.admin,'2026-11');
      writerUrl=await f.createUser('atlas_test_writer');const readerUrl=await f.createUser('atlas_test_reader');await grantAccess(f.admin,'atlas_test_writer','writer');await grantAccess(f.admin,'atlas_test_reader','reader');await grantAccess(f.admin,'atlas_test_reader','reader');
      writer=await connect(writerUrl);reader=await connect(readerUrl);
      assert.equal((await listSeries(reader)).series.length,0);
      await assert.rejects(initialize(reader),/OWNER_REQUIRED/);
      await assert.rejects(reader.query("INSERT INTO atlas_market.coin(code,symbol,name) VALUES('bad','BAD','bad')"),e=>e.code==='42501');
      await assert.rejects(writer.query('SELECT * FROM atlas_market.observation_2026_10'),e=>e.code==='42501');
      await assert.rejects(ingest(f.admin,[source(original)]),/DATABASE_ROLE_UNSAFE/);
    });
    await step('input transaction preserves positions, scope, microseconds, exact values, null and failed-request state',async()=>{
      const plan=source(original),result=await ingest(writer,[plan]);assert.equal(result.sources,1);assert.equal(result.observations,9);assert.equal(result.networks,1);
      const rows=(await listSeries(reader,{coin:'usdc'})).series,price=rows.find(s=>s.metric==='PRICE').id,circ=rows.find(s=>s.metric==='CIRCULATING').id,chain=rows.find(s=>s.metric==='CHAIN_TOTAL'&&s.network==='ethereum');
      assert.equal(chain.scope,'COIN_NETWORK');assert.equal(chain.deployment,null);
      const query={series:price,from:'2026-10-21T00:00:00Z',to:'2026-10-22T00:00:00Z',limit:1},one=await history(reader,query),two=await history(reader,{...query,cursor:one.next});
      assert.equal(one.points[0].at,'2026-10-21T12:00:00.123456Z');assert.equal(one.points[0].amount,'0.999999999999999999999999999999999999');assert.equal(two.points[0].amount,'1');assert.notEqual(one.points[0].request,two.points[0].request);assert.equal(two.next,null);
      const supply=await history(reader,{...query,series:circ,limit:10});assert.equal(supply.points[0].amount,'9007199254740993.000000000000000000000000000000000001');
      const latest=(await latestValues(reader,{coin:'usdc'})).values,head=latest.find(o=>o.metric==='PRICE');assert.equal(head.amount,'1');assert.equal(head.latest_request_state,'FAILED');
      const empty=latest.find(o=>o.metric==='COIN_TOTAL');assert.equal(empty.amount,null);
      const zero=(await history(reader,{...query,series:chain.id,limit:10})).points[0];assert.equal(zero.amount,'0');assert.ok(zero.legacy_id);
      assert.equal((await f.admin.query(`SELECT d.code FROM atlas_market.legacy_observation l JOIN atlas_market.deployment d ON d.id=l.legacy_deployment_id WHERE encode(l.legacy_id,'hex')=$1`,[zero.legacy_id])).rows[0].code,'usdc-ethereum');
      const net=(await f.admin.query("SELECT tip::text, to_char(source_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS at FROM atlas_market.network_observation")).rows[0];assert.equal(net.tip,'9007199254740993');assert.equal(net.at,'2026-10-21T11:59:00.000001Z');
      const publicNet=(await networkHistory(reader,{network:'ethereum',from:query.from,to:query.to})).points[0];assert.equal(publicNet.source_at,'2026-10-21T11:59:00.000001789Z');assert.equal(publicNet.tip,'9007199254740993');
      assert.equal((await latestNetworks(reader)).networks.find(n=>n.network==='ethereum').tip,'9007199254740993');
      assert.equal((await latestNetworks(reader)).networks.find(n=>n.network==='xrpl').active,null);
      const before=await counts(f.admin);assert.equal((await ingest(writer,[plan])).unchanged,1);assert.deepEqual(await counts(f.admin),before);
      await assert.rejects(history(reader,{...query,limit:1201}),/QUERY_LIMIT/);await assert.rejects(history(reader,{...query,series:circ,cursor:one.next}),/CURSOR/);
    });
    await step('same/different concurrent imports are atomic and older imports never regress latest',async()=>{
      const other=await connect(writerUrl),same=next('1','2026-10-21T12:01:00.000001Z');const result=await Promise.all([ingest(writer,[same]),ingest(other,[same])]);assert.equal(result.reduce((n,r)=>n+r.sources,0),1);assert.equal(result.reduce((n,r)=>n+r.unchanged,0),1);
      await Promise.all([ingest(writer,[next('3','2026-10-21T12:04:00.000001Z')]),ingest(other,[next('4','2026-10-21T12:05:00.000001Z')])]);
      await ingest(writer,[next('9','2026-10-20T12:00:00.000001Z')]);assert.equal((await latestValues(reader,{coin:'usdc'})).values.find(v=>v.metric==='PRICE').amount,'4');
    });
    await step('XRPL imports stay recorded units with fixed issuer/currency/network and original ledger',async()=>{
      const d=registry.deployments.find(d=>d.id==='usdc-xrpl'),report={kind:'XRPL_GATEWAY_OBLIGATIONS_RESEARCH_NOT_ASSESSMENT',observedAt:'2026-10-21T12:00:00.000001Z',ledgerHash:'A'.repeat(64),ledgerIndex:'9007199254740993',observations:[{status:'OBSERVED',issuer:d.identity.issuer,currency:d.identity.currency,metric:'gateway_balances.obligations',value:'0.123456789012345678901234567890123456',ledgerHash:'A'.repeat(64),ledgerIndex:'9007199254740993'}]};
      const p=source(report);await ingest(writer,[p]);await ingest(writer,[p]);const req=(await f.admin.query("SELECT state,evidence_kind,http_status,ledger_index::text,encode(ledger_hash,'hex') AS ledger,observation_clock FROM atlas_market.collection_request WHERE evidence_kind='IMPORTED_UNIT'")).rows[0];
      assert.equal(req.state,'RECORDED');assert.equal(req.http_status,null);assert.equal(req.observation_clock,'REPORT_FALLBACK');assert.equal(req.ledger_index,'9007199254740993');assert.equal(req.ledger,'a'.repeat(64));
      const bad=structuredClone(report);bad.observations[0].ledgerHash='B'.repeat(64);assert.throws(()=>source(bad));
    });
    await step('DB triggers enforce failed request/latest/immutability even for the real writer role',async()=>{
      const failed=(await f.admin.query("SELECT q.id::text,q.definition_id,to_char(q.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS at FROM atlas_market.collection_request q WHERE state='FAILED' LIMIT 1")).rows[0];
      const price=(await listSeries(reader)).series.find(s=>s.metric==='PRICE');await assert.rejects(writer.query("INSERT INTO atlas_market.observation VALUES($1,$2,$3,$4,'OBSERVED',0,NULL,NULL)",[price.id,failed.at,failed.id,failed.definition_id]),e=>e.code==='23514');
      await assert.rejects(writer.query("UPDATE atlas_market.metric_definition SET unit='USD'"),e=>e.code==='42501');await assert.rejects(writer.query('DELETE FROM atlas_market.observation'),e=>e.code==='42501');
      for(const amount of ['NaN','Infinity','-1','0.0000000000000000000000000000000000001'])await assert.rejects(writer.query("INSERT INTO atlas_market.observation VALUES($1,$2,$3,$4,'OBSERVED',$5,NULL,NULL)",[price.id,failed.at,failed.id,failed.definition_id,amount]),e=>e.code==='23514');
      await assert.rejects(writer.query("UPDATE atlas_market.collection_run SET state='RUNNING' WHERE state='SUCCESS'"),e=>e.code==='23514');
      await writer.query('BEGIN');
      try{
        const xrpl=(await writer.query("SELECT o.series_id,o.request_definition_id,q.artifact_id FROM atlas_market.observation o JOIN atlas_market.collection_request q ON q.id=o.request_id JOIN atlas_market.series s ON s.id=o.series_id JOIN atlas_market.metric_definition m ON m.id=s.metric_id WHERE m.code='OBLIGATIONS' LIMIT 1")).rows[0];
        const run=(await writer.query("INSERT INTO atlas_market.collection_run(idempotency_key,kind,state,started_at) VALUES($1,'IMPORT','RUNNING',clock_timestamp()) RETURNING id",[Buffer.from('ee'.repeat(32),'hex')])).rows[0].id;
        const request=(await writer.query("INSERT INTO atlas_market.collection_request(run_id,ordinal,definition_id,state,evidence_kind,source_position,observed_at,observation_clock,artifact_id,selector_prefix) VALUES($1,0,$2,'RECORDED','IMPORTED_UNIT','$.synthetic','2026-10-21T12:09:00Z','REPORT_FALLBACK',$3,'$.synthetic') RETURNING id",[run,xrpl.request_definition_id,xrpl.artifact_id])).rows[0].id;
        await assert.rejects(writer.query("INSERT INTO atlas_market.observation VALUES($1,'2026-10-21T12:09:00Z',$2,$3,'OBSERVED',0,NULL,NULL)",[xrpl.series_id,request,xrpl.request_definition_id]),e=>e.code==='23514');
      }finally{await writer.query('ROLLBACK');}
      const old=(await f.admin.query('SELECT observed_at,request_id FROM atlas_market.observation WHERE series_id=$1 ORDER BY observed_at LIMIT 1',[price.id])).rows[0];
      await assert.rejects(writer.query('UPDATE atlas_market.series_latest SET observed_at=$2,request_id=$3 WHERE series_id=$1',[price.id,old.observed_at,old.request_id]),e=>e.code==='23514');
      const missing=(await f.admin.query("SELECT series_id,observed_at,request_id FROM atlas_market.observation WHERE state='MISSING' LIMIT 1")).rows[0];await assert.rejects(writer.query('INSERT INTO atlas_market.series_latest VALUES($1,$2,$3)',[missing.series_id,missing.observed_at,missing.request_id]),e=>e.code==='23514');
    });
    await step('legacy collision rolls back all new DB writes while preserving private byte artifacts',async()=>{
      const p=next('8','2026-10-21T12:08:00.000001Z'),o=p.units[0].observations[0].legacy;
      await f.admin.query(`INSERT INTO atlas_market.legacy_observation(legacy_id,legacy_group_id,original_selector,series_id,observed_at,request_id)
        SELECT $1,$2,'$.syntheticConflict',series_id,observed_at,request_id FROM atlas_market.observation LIMIT 1`,[Buffer.from(o.id,'hex'),Buffer.from(o.groupId,'hex')]);
      const before=await counts(f.admin);await assert.rejects(ingest(writer,[p]),/CONTENT_CONFLICT/);assert.deepEqual(await counts(f.admin),before);
      assert.equal(digest(await readFile(join(directory,'archive',p.hash.slice(0,2),p.hash+'.json'))),p.hash);
    });
    await step('owner inheritance, unexpected DML/child grants and policy/schema tampering are rejected',async()=>{
      const elevatedUrl=await f.createUser('atlas_test_elevated');await f.admin.query('GRANT postgres TO atlas_test_elevated');await assert.rejects(grantAccess(f.admin,'atlas_test_elevated','reader'),/ROLE_UNSAFE/);await assert.rejects(listSeries(await connect(elevatedUrl)),/ROLE_UNSAFE/);
      const overlap=await Promise.allSettled([listSeries(reader),listSeries(reader)]);assert.equal(overlap.filter(r=>r.status==='fulfilled').length,1);assert.match(overlap.find(r=>r.status==='rejected').reason.message,/CLIENT_BUSY/);
      await f.admin.query('ALTER ROLE atlas_test_reader REPLICATION');await assert.rejects(listSeries(reader),/ROLE_UNSAFE/);await f.admin.query('ALTER ROLE atlas_test_reader NOREPLICATION');
      await f.admin.query('GRANT UPDATE ON atlas_market.observation TO atlas_test_reader');await assert.rejects(listSeries(reader),/PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE UPDATE ON atlas_market.observation FROM atlas_test_reader');
      await f.admin.query('GRANT SELECT ON atlas_market.observation_2026_10 TO atlas_test_reader');await assert.rejects(listSeries(reader),/PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE SELECT ON atlas_market.observation_2026_10 FROM atlas_test_reader');
      await f.admin.query('CREATE POLICY synthetic_rogue ON atlas_market.coin FOR SELECT TO atlas_test_reader USING(true)');await assert.rejects(listSeries(reader),/POLICIES_MISMATCH/);await f.admin.query('DROP POLICY synthetic_rogue ON atlas_market.coin');
      await f.admin.query('ALTER TABLE atlas_market.coin ADD COLUMN synthetic_drift text');await assert.rejects(listSeries(reader),/SCHEMA_MISMATCH/);await f.admin.query('ALTER TABLE atlas_market.coin DROP COLUMN synthetic_drift');assert.ok((await listSeries(reader)).series.length>0);
    });
    await step('CLI plan requires no DB and query/error output never prints the connection string',async()=>{
      const reports=join(directory,'reports');await mkdir(reports);await writeFile(join(reports,'arkham-api-smoke.json'),JSON.stringify(original));const cli=new URL('../../tools/market-db/cli.mjs',import.meta.url);
      const plan=await exec(process.execPath,[cli.pathname,'plan','--source','arkham-api-smoke.json','--reports-dir',reports],{env:{...process.env,DATABASE_URL:'invalid'}});assert.equal(JSON.parse(plan.stdout).networkCalls,0);
      const read=await exec(process.execPath,[cli.pathname,'series','--limit','1'],{env:{...process.env,DATABASE_URL:await f.createUser('atlas_test_cli')}}).catch(e=>e);assert.equal(read.code,1);assert.ok(!read.stderr.includes('postgresql://'));
      const ok=await exec(process.execPath,[cli.pathname,'latest','--coin','usdc','--limit','2'],{env:{...process.env,DATABASE_URL:writerUrl}});assert.equal(JSON.parse(ok.stdout).values.length,2);assert.ok(!ok.stdout.includes(writerUrl));
    });
  }finally{await Promise.all(clients.map(c=>c.end().catch(()=>{})));await f.stop();await rm(directory,{recursive:true,force:true});}
});
