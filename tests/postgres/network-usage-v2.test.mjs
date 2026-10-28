import test from 'node:test';import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';
import{fixture}from'./fixture.mjs';import{initialize,grantAccess,structureHash}from'../../tools/market-db/schema.mjs';import{connectDatabase}from'../../tools/market-db/connection.mjs';
import{initializeNetworkUsage,upgradeNetworkUsage,grantNetworkUsage,importNetworkUsage,readNetworkUsage,verifyNetworkUsageSchema,claimNetworkUsageDay}from'../../tools/market-db/network-usage.mjs';
import{networkUsageFixture}from'../network-usage-fixture.mjs';import{usageV2Fixture}from'../network-usage-v2-fixture.mjs';import{digest,canonical}from'../../tools/market-db/plan.mjs';
test('usage v2 additive PG17 upgrade preserves v1, roles and immutable claims, allows one cross-process daily owner',{timeout:120000},async()=>{
 const f=await fixture();let w,r,w2;try{
  await initialize(f.admin);await f.admin.query('CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE authenticator NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS');await initializeNetworkUsage(f.admin);
  const wu=await f.createUser('atlas_test_usagewriter'),ru=await f.createUser('atlas_test_usagereader');await grantAccess(f.admin,'atlas_test_usagewriter','writer');await grantAccess(f.admin,'atlas_test_usagereader','reader');await grantNetworkUsage(f.admin,'atlas_test_usagewriter','writer');await grantNetworkUsage(f.admin,'atlas_test_usagereader','reader');
  w=await connectDatabase({DATABASE_URL:wu});w2=await connectDatabase({DATABASE_URL:wu});r=await connectDatabase({DATABASE_URL:ru});const old=await networkUsageFixture(),b=Buffer.from(JSON.stringify(old));await importNetworkUsage(w,b,digest(b));const legacy=(await f.admin.query('SELECT * FROM atlas_network_usage.snapshot')).rows;const market=await structureHash(f.admin,'atlas_market');
  assert.equal((await upgradeNetworkUsage(f.admin)).state,'UPGRADED');assert.equal(await verifyNetworkUsageSchema(f.admin),2);assert.equal((await upgradeNetworkUsage(f.admin)).state,'UNCHANGED');assert.deepEqual((await f.admin.query('SELECT * FROM atlas_network_usage.snapshot')).rows,legacy);assert.equal((await readNetworkUsage(r)).schemaVersion,1);
  const p=usageV2Fixture(),bytes=Buffer.from(JSON.stringify(p));assert.equal((await importNetworkUsage(w,bytes,digest(bytes))).inserted,1);assert.equal((await importNetworkUsage(w,bytes,digest(bytes))).inserted,0);assert.equal(canonical(await readNetworkUsage(r)),canonical(p));
  const conflict=structuredClone(p);conflict.rows[0].usd='1';const cb=Buffer.from(JSON.stringify(conflict));await assert.rejects(importNetworkUsage(w,cb,digest(cb)),/CONFLICT/);
  const day=(await f.admin.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day")).rows[0].day,opts={day,planHash:'a'.repeat(64),ownerId:randomUUID()};
  const claims=await Promise.all([claimNetworkUsageDay(w,opts),claimNetworkUsageDay(w2,{...opts,ownerId:randomUUID()})]);assert.equal(claims.filter(c=>c.state==='CLAIMED').length,1);assert.equal(claims.filter(c=>c.state==='ALREADY_CLAIMED').length,1);
  await assert.rejects(claimNetworkUsageDay(r,opts));await assert.rejects(claimNetworkUsageDay(w,{...opts,day:'2020-01-01'}));
  for(const sql of ['UPDATE atlas_network_usage.collection_day SET owner_id=gen_random_uuid()','DELETE FROM atlas_network_usage.snapshot_v2','TRUNCATE atlas_network_usage.snapshot_v2'])await assert.rejects(w.query(sql));
  assert.equal(await structureHash(f.admin,'atlas_market'),market);assert.deepEqual((await f.admin.query('SELECT * FROM atlas_network_usage.snapshot')).rows,legacy);
 }finally{await Promise.all([w,w2,r].filter(Boolean).map(c=>c.end()));await f.stop();}
});

test('automatic CLI collects with owned PG once, atomically publishes and recovers without provider replay',{timeout:120000},async()=>{
 const{mkdtemp,realpath,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const{operatingUsagePlan}=await import('../../tools/usage-operating-plan.mjs'),{collectOperatingUsage}=await import('../../tools/usage-operating-collector.mjs'),{usageOperation}=await import('../../tools/usage-operating-cli.mjs');
 const f=await fixture(),root=await realpath(await mkdtemp(join(tmpdir(),'usage-cli-pg-')));let rd;
 try{
  await initialize(f.admin);await f.admin.query('CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE authenticator NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS');await initializeNetworkUsage(f.admin);await upgradeNetworkUsage(f.admin);
  const wu=await f.createUser('atlas_test_autowriter'),ru=await f.createUser('atlas_test_autoreader');for(const[role,mode]of [['atlas_test_autowriter','writer'],['atlas_test_autoreader','reader']]){await grantAccess(f.admin,role,mode);await grantNetworkUsage(f.admin,role,mode);}
  const day=new Date().toISOString().slice(0,10),p=await operatingUsagePlan(day),end=new Date(Date.parse(day)+86400000).toISOString().slice(0,10);
  const a=Buffer.from(JSON.stringify({kind:'ARKHAM_USAGE_PERIOD_AUTHORIZATION',policyHash:p.policyHash,fromDay:day,untilExclusive:end,maxHTTPPerDay:18,maxTotalHTTP:18,maxBytesPerDay:37748736,maxTotalBytes:37748736,costStatus:'UNKNOWN_ACCEPTED'})),review=Buffer.from(JSON.stringify({schemaVersion:1,kind:'SUPPLY_SOURCE_REVIEWED_DEFINERS',definers:[]}));
  for(const[name,bytes]of [['writer.env',Buffer.from('DATABASE_URL='+wu+'\nARKM_API_KEY=fixture\n')],['approval.json',a],['review.json',review]])await writeFile(join(root,name),bytes,{mode:0o600});
  const cfg={stateRoot:join(root,'state'),envFile:join(root,'writer.env'),authorizationFile:join(root,'approval.json'),authorizationHash:digest(a),reviewedDefinersFile:join(root,'review.json'),reviewedDefinersHash:digest(review)},path=join(root,'config.json');await writeFile(path,JSON.stringify(cfg),{mode:0o600});
  let calls=0,ms=0;const deps={collect:o=>collectOperatingUsage({...o,clock:()=>ms,sleep:async n=>{ms+=n;},fetcher:async()=>{calls++;return new Response('[{"time":"'+p.jobs[0].query.timeLte.slice(0,10)+'T00:00:00Z","count":3,"usd":2.000000000000000001}]');}})};
  assert.equal((await usageOperation(['check','--config',path])).providerRequests,0);const first=await usageOperation(['run','--config',path],deps);assert.equal(first.state,'PUBLISHED');assert.equal(first.inserted,1);assert.equal(calls,18);
  assert.equal((await usageOperation(['run','--config',path],deps)).inserted,0);assert.equal(calls,18);
  rd=await connectDatabase({DATABASE_URL:ru});assert.equal((await readNetworkUsage(rd)).rows.length,126);
  await writeFile(path,JSON.stringify({...cfg,stateRoot:join(root,'fresh-state')}),{mode:0o600});assert.equal((await usageOperation(['run','--config',path],deps)).state,'CONSUMED_NO_COMPLETE_ARCHIVE');assert.equal(calls,18);
 }finally{await rd?.end();await f.stop();await rm(root,{recursive:true,force:true});}
});
