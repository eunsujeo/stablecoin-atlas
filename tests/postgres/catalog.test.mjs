import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture} from './fixture.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {initialize,partition,grantAccess,verifySchema} from '../../tools/market-db/schema.mjs';
import {initializeCatalog,importCatalog,grantCatalogReader} from '../../tools/market-db/catalog.mjs';
import {importSources} from '../../tools/market-db/repository.mjs';
import {importPlan} from '../../tools/market-db/plan.mjs';
import {databaseMarket} from '../../tools/market-db/preview.mjs';
const registry=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url))),profiles=JSON.parse(await readFile(new URL('../../data/token-profiles.json',import.meta.url))).profiles;
test('catalog: real PG17 immutable versions, owner-only imports, least privilege, rollback/concurrency, snapshot and drift detection',{timeout:120000},async()=>{
  const f=await fixture(),directory=await mkdtemp(join(tmpdir(),'atlas-catalog-'));let reader,writer,second;
  try{
    await initialize(f.admin);await partition(f.admin,'2026-10');
    const readerUrl=await f.createUser('atlas_test_catalogreader'),writerUrl=await f.createUser('atlas_test_catalogwriter');
    await grantAccess(f.admin,'atlas_test_catalogreader','reader');await grantAccess(f.admin,'atlas_test_catalogwriter','writer');
    reader=await connectDatabase({DATABASE_URL:readerUrl});writer=await connectDatabase({DATABASE_URL:writerUrl});
    const now=Date.parse('2026-10-22T23:00:00Z'),read=()=>databaseMarket(reader,registry,{now});
    await importSources(writer,{registry,sources:[importPlan(registry,Buffer.from(JSON.stringify({requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-22T00:00:00.000Z',data:{price:'1'}}]})))],archiveDirectory:join(directory,'archive')});
    assert.deepEqual((await read()).tokenProfiles,[]);
    const fingerprint=(await f.admin.query("SELECT encode(structure_hash,'hex') AS hash FROM atlas_market.schema_version")).rows[0].hash;
    assert.equal((await initializeCatalog(f.admin)).state,'INITIALIZED');assert.equal((await initializeCatalog(f.admin)).state,'UNCHANGED');
    await verifySchema(f.admin);assert.equal((await f.admin.query("SELECT encode(structure_hash,'hex') AS hash FROM atlas_market.schema_version")).rows[0].hash,fingerprint);
    await assert.rejects(read()); // Installed but ungranted must not silently fall back.
    await assert.rejects(initializeCatalog(writer),/DATABASE_OWNER_REQUIRED/);
    await assert.rejects(importCatalog(writer,registry,profiles),/DATABASE_OWNER_REQUIRED/);
    await assert.rejects(grantCatalogReader(f.admin,'atlas_test_catalogwriter'),/CATALOG_READER_REQUIRED/);
    assert.equal((await grantCatalogReader(f.admin,'atlas_test_catalogreader')).state,'GRANTED');assert.equal((await grantCatalogReader(f.admin,'atlas_test_catalogreader')).state,'UNCHANGED');
    assert.equal((await importCatalog(f.admin,registry,profiles)).profiles,8);assert.equal((await importCatalog(f.admin,registry,profiles)).unchanged,8);
    assert.deepEqual((await read()).tokenProfiles.sort((a,b)=>a.deploymentId.localeCompare(b.deploymentId)),[...profiles].sort((a,b)=>a.deploymentId.localeCompare(b.deploymentId)));
    for(const sql of ["INSERT INTO atlas_catalog.reader_grant VALUES('x')","UPDATE atlas_catalog.token_profile SET revision=2","DELETE FROM atlas_catalog.token_profile",'SELECT atlas_catalog.reject_mutation()'])await assert.rejects(reader.query(sql),e=>e.code==='42501');
    await assert.rejects(f.admin.query('UPDATE atlas_catalog.token_profile SET revision=2'),e=>e.code==='23514');
    const conflict=structuredClone(profiles);conflict[0].revision=2;conflict[1].assetDescription='conflicting same revision';await assert.rejects(importCatalog(f.admin,registry,conflict),/CATALOG_CONTENT_CONFLICT/);
    assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM atlas_catalog.token_profile')).rows[0].n,8);
    second=await connectDatabase({DATABASE_URL:f.url('postgres')});
    const updated=structuredClone(profiles);updated[0].revision=2;updated[0].assetDescription+=' 검토 설명 보완.';
    const imports=await Promise.all([importCatalog(f.admin,registry,updated),importCatalog(second,registry,updated)]);assert.equal(imports.reduce((n,r)=>n+r.profiles,0),1);assert.equal((await read()).tokenProfiles.find(p=>p.deploymentId===profiles[0].deploymentId).revision,2);
    const fake=structuredClone(registry);fake.deployments[0].identity.address='0x'+'1'.repeat(40);const badProfiles=structuredClone(profiles);badProfiles[0].identity=fake.deployments[0].identity;await assert.rejects(importCatalog(f.admin,fake,badProfiles),/CATALOG_IDENTITY_MISMATCH/);
    await f.admin.query('GRANT UPDATE(asset_description) ON atlas_catalog.token_profile TO atlas_test_catalogreader');await assert.rejects(read(),/CATALOG_PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE UPDATE(asset_description) ON atlas_catalog.token_profile FROM atlas_test_catalogreader');
    await f.admin.query('GRANT EXECUTE ON FUNCTION atlas_catalog.reject_mutation() TO PUBLIC');await assert.rejects(read(),/CATALOG_/);await f.admin.query('REVOKE ALL ON FUNCTION atlas_catalog.reject_mutation() FROM PUBLIC');
    await f.admin.query('ALTER TABLE atlas_catalog.token_profile DISABLE TRIGGER immutable_record');await assert.rejects(read(),/CATALOG_SCHEMA_MISMATCH/);await f.admin.query('ALTER TABLE atlas_catalog.token_profile ENABLE TRIGGER immutable_record');
    // A current response stays on its original snapshot while a new version is imported.
    const query=reader.query.bind(reader);let changed=false;
    reader.query=async(...args)=>{if(typeof args[0]==='string'&&args[0].includes('SELECT DISTINCT ON (p.deployment_id)')&&!changed){changed=true;const next=structuredClone(updated);next[0].revision=3;await importCatalog(f.admin,registry,next);}return query(...args);};
    assert.equal((await read()).tokenProfiles.find(p=>p.deploymentId===profiles[0].deploymentId).revision,2);reader.query=query;
    assert.equal((await read()).tokenProfiles.find(p=>p.deploymentId===profiles[0].deploymentId).revision,3);
    await verifySchema(f.admin);
  }finally{await reader?.end();await writer?.end();await second?.end();await f.stop();await rm(directory,{recursive:true,force:true});}
});
