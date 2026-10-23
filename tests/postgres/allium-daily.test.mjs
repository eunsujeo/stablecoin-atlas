import test from 'node:test';import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {fixture} from './fixture.mjs';import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {dailyLab,initializeDailyLab,dailyEntryHash} from '../../tools/market-db/allium-daily-lab.mjs';
import {dailyHash,dailyPlan} from '../../tools/allium-daily-plan.mjs';
import {simulation,simulationOrg as org,dailyResponse} from '../allium-daily-fixture.mjs';
import {canonical} from '../../tools/market-db/plan.mjs';
import {mkdtemp,realpath,chmod,rm,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createCheckpointStore,checkpointPublisher} from '../../tools/allium-checkpoint.mjs';
import {checkpointDailyLab} from '../../tools/market-db/allium-daily-lab.mjs';
const exec=promisify(execFile),zero='0'.repeat(64),blocked=p=>assert.rejects(p,/ALLIUM_DAILY_OFFLINE_BLOCKED/);
async function lab(t){
 const f=await fixture(),clients=[],fixtureHash=dailyHash(randomBytes(32)),name='atlas_daily_fixture_'+randomBytes(8).toString('hex');
 t.after(async()=>{for(const c of clients)await c.end().catch(()=>{});await f.stop();});
 await f.admin.query(`CREATE DATABASE ${name}`);await f.admin.query(`COMMENT ON DATABASE ${name} IS 'ALLIUM_DAILY_OFFLINE:${fixtureHash}'`);
 const urls={};for(const [key,role]of [['writer','atlas_test_dailywriter'],['reader','atlas_test_dailyreader']]){
  const u=new URL(await f.createUser(role));u.pathname='/'+name;urls[key]=u.href;
 }
 const u=new URL(f.url('postgres'));u.pathname='/'+name;urls.admin=u.href;
 const connect=async(key='writer')=>{const c=await connectDatabase({DATABASE_URL:urls[key]});clients.push(c);return c;};
 const admin=await connect('admin');await initializeDailyLab(admin,{fixtureHash,writer:'atlas_test_dailywriter',reader:'atlas_test_dailyreader'});
 const writer=await connect(),reader=await connect('reader'),ledger=dailyLab(writer,{fixtureHash});
 const now=async()=>(await admin.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS at")).rows[0].at;
 const clocked=async()=>simulation(await now());
 const count=async()=>(await admin.query('SELECT count(*)::int AS n FROM atlas_allium_daily_lab.entry')).rows[0].n;
 return {f,fixtureHash,admin,writer,reader,ledger,connect,urls,now,clocked,count};
}
async function seed(l,{organization=org}={}){
 const f=await l.clocked();if(organization!==org){f.authorization.organizationHash=organization;f.usage.organizationHash=organization;}
 await l.ledger.claimWorker(organization);const intent=await l.ledger.usageIntent(organization);
 await l.ledger.usageResponse(organization,intent.id,f.usage);return f;
}
async function publishedLab(t,l,{fault}={}){
 const root=await mkdtemp(join(await realpath(tmpdir()),'allium-pg-checkpoint-'));await chmod(root,0o700);
 t.after(()=>rm(root,{recursive:true,force:true}));const path=join(root,'checkpoint');
 const setup=await createCheckpointStore(path,{fixtureHash:l.fixtureHash,organizationHash:org});
 const publisher=await checkpointPublisher(path,{...setup,fault});t.after(()=>publisher.close().catch(()=>{}));
 l.ledger=await checkpointDailyLab(l.writer,{fixtureHash:l.fixtureHash,publisher});return {root,path,setup,publisher};
}
const ok=JSON.stringify({state:'OK',referenceHash:dailyHash('SIMULATED REFERENCE')});
async function send(l,reservationId,job,operation,body){
 const i=await l.ledger.intent(org,reservationId,job,operation);await l.ledger.fakeSend(org,reservationId,i.id);
 return l.ledger.response(org,reservationId,i.id,body);
}
test('daily PG17 fixture reserves atomically, replays immutable audit and validates complete fake exchanges',{timeout:120000},async t=>{
 const l=await lab(t),f=await seed(l),second=await l.connect(),other=dailyLab(second,{fixtureHash:l.fixtureHash});
 const attempts=await Promise.allSettled([l.ledger.reserve(org,f.plan,f.authorization),other.reserve(org,f.plan,f.authorization)]);
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(attempts.filter(r=>r.status==='rejected').length,1);
 const winner=attempts.findIndex(r=>r.status==='fulfilled'),id=attempts[winner].value.id;assert.equal(await l.count(),4);
 if(winner===1){await l.ledger.releaseWorker(org);await other.claimWorker(org);l.ledger=other;}
 const rotated=structuredClone(f.authorization);rotated.keyHash=dailyHash('ROTATED SIMULATED KEY');
 await blocked(other.reserve(org,f.plan,rotated));
 await other.reserve(org,f.plan,rotated,'registry');assert.equal(await l.count(),6);
 for(const job of ['supply','volume']){
  await send(l,id,job,'create',ok);await blocked(l.ledger.intent(org,id,job,'create'));
  await send(l,id,job,'run',ok);await blocked(l.ledger.intent(org,id,job,'run'));
  await send(l,id,job,'status',JSON.stringify({status:'success'}));
  await send(l,id,job,'result',dailyResponse(f.plan,job));
 }
 const v=await l.ledger.read(org);assert.equal(v.reservations.find(r=>r.id===id).state,'SUCCEEDED');assert.equal(v.reservations.find(r=>r.id===id).fakeSends,8);
 assert.equal(v.reservations.find(r=>r.kind==='registry').reservedUnits,'0.1');assert.equal(v.providerRequests,0);assert.equal(v.executionEnabled,false);
 const rebuilt=await dailyLab(l.reader,{fixtureHash:l.fixtureHash,checkpoints:{[org]:v.checkpoint}}).read(org);assert.deepEqual(rebuilt,v);
 await blocked(dailyLab(l.reader,{fixtureHash:l.fixtureHash}).reserve(org,f.plan,f.authorization));
 await blocked(dailyLab(l.admin,{fixtureHash:l.fixtureHash}).read(org));
 await blocked(l.ledger.usageIntent(org));
});
test('daily PG17 least privilege, chain/DML/ACL/role/trigger tampering and trusted checkpoint detect corruption',{timeout:120000},async t=>{
 const l=await lab(t),f=await seed(l);await l.ledger.reserve(org,f.plan,f.authorization);
 const original=await l.ledger.read(org);
 for(const sql of ['UPDATE atlas_allium_daily_lab.entry SET ordinal=ordinal','DELETE FROM atlas_allium_daily_lab.entry','TRUNCATE atlas_allium_daily_lab.entry',
  'UPDATE atlas_allium_daily_lab.configuration SET version=1','SELECT atlas_allium_daily_lab.reject_mutation()'])await assert.rejects(l.writer.query(sql));
 const payload=canonical({type:'UNRECOGNIZED',organizationHash:org,at:await l.now()});
 await assert.rejects(l.writer.query('INSERT INTO atlas_allium_daily_lab.entry VALUES($1,5,$2,$3,$4)',[org,zero,zero,payload]));
 await l.admin.query('GRANT UPDATE(payload) ON atlas_allium_daily_lab.entry TO atlas_test_dailywriter');await blocked(l.ledger.read(org));
 await l.admin.query('REVOKE UPDATE(payload) ON atlas_allium_daily_lab.entry FROM atlas_test_dailywriter');
 await l.admin.query('CREATE ROLE anon NOLOGIN');await l.admin.query('GRANT atlas_test_dailywriter TO anon');await blocked(l.ledger.read(org));await l.admin.query('REVOKE atlas_test_dailywriter FROM anon');
 assert.equal((await l.admin.query("SELECT has_schema_privilege('anon','atlas_allium_daily_lab','USAGE') AS access")).rows[0].access,false);
 await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry DISABLE TRIGGER validate_chain');await blocked(l.ledger.read(org));await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry ENABLE TRIGGER validate_chain');
 await l.admin.query('ALTER FUNCTION atlas_allium_daily_lab.guard_chain() SECURITY DEFINER');await blocked(l.ledger.read(org));await l.admin.query('ALTER FUNCTION atlas_allium_daily_lab.guard_chain() SECURITY INVOKER');
 await l.admin.query("ALTER FUNCTION atlas_allium_daily_lab.guard_chain() SET search_path='public'");await blocked(l.ledger.read(org));await l.admin.query("ALTER FUNCTION atlas_allium_daily_lab.guard_chain() SET search_path='pg_catalog'");
 // A hash-valid but semantically invalid direct INSERT must never authorize a subsequent simulated send.
 const next=original.checkpoint.count+1,hash=dailyEntryHash(org,next,original.checkpoint.hash,payload);
 await l.writer.query('INSERT INTO atlas_allium_daily_lab.entry VALUES($1,$2,$3,$4,$5)',[org,next,original.checkpoint.hash,hash,payload]);await blocked(l.ledger.read(org));
 await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry DISABLE TRIGGER immutable_record');await l.admin.query('DELETE FROM atlas_allium_daily_lab.entry WHERE ordinal=$1',[next]);await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry ENABLE TRIGGER immutable_record');
 assert.equal((await l.ledger.read(org)).checkpoint.hash,original.checkpoint.hash);
 // Removing a valid tail needs a trusted external checkpoint. A fresh reader cannot prove its absence.
 const trusted=structuredClone(original.checkpoint),published=await l.ledger.read(org);published.checkpoint.count=0;published.checkpoint.hash=zero;
 const input={[org]:structuredClone(trusted)},anchored=dailyLab(l.reader,{fixtureHash:l.fixtureHash,checkpoints:input});input[org].count=0;input[org].hash=zero;
 await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry DISABLE TRIGGER immutable_record');await l.admin.query('DELETE FROM atlas_allium_daily_lab.entry WHERE ordinal=4');await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry ENABLE TRIGGER immutable_record');
 await blocked(l.ledger.read(org));await blocked(anchored.read(org));await blocked(dailyLab(l.reader,{fixtureHash:l.fixtureHash,checkpoints:{[org]:trusted}}).read(org));
 const unanchored=await dailyLab(l.reader,{fixtureHash:l.fixtureHash}).read(org);assert.equal(unanchored.checkpoint.count,3);assert.equal(unanchored.tailDetection,'REQUIRES_TRUSTED_CHECKPOINT');
 await blocked(dailyLab(l.writer,{fixtureHash:dailyHash('WRONG FIXTURE')}).read(org));
});
test('daily PG17 durable intent/commit ambiguity, usage once, lock failure and lost worker fence survive process restart',{timeout:120000},async t=>{
 const l=await lab(t),f=await seed(l),reserved=await l.ledger.reserve(org,f.plan,f.authorization);
 // Throw after INSERT but before COMMIT: the whole transaction must roll back without a fake send.
 let failInsert=true;
 const wrapped={connectionParameters:l.writer.connectionParameters,query:async(...args)=>{
  const result=await l.writer.query(...args);if(failInsert&&String(args[0]).startsWith('INSERT INTO atlas_allium_daily_lab.entry')){failInsert=false;throw Error('SIMULATED_CRASH_AFTER_INSERT');}return result;
 }};
 const faulty=dailyLab(wrapped,{fixtureHash:l.fixtureHash});
 const before=await l.count();await blocked(faulty.reserve(org,f.plan,f.authorization,'registry'));assert.equal(await l.count(),before);
 // An intent is durable but not yet fake-sent. A new session must never reuse its old worker token.
 const intent=await l.ledger.intent(org,reserved.id,'supply','create');assert.equal((await l.ledger.read(org)).reservations[0].state,'UNKNOWN');
 const child=`import {connectDatabase} from './tools/market-db/connection.mjs'; import {dailyLab} from './tools/market-db/allium-daily-lab.mjs';
 const c=await connectDatabase({DATABASE_URL:process.env.DAILY_FIXTURE_URL});const d=dailyLab(c,{fixtureHash:process.env.DAILY_FIXTURE_HASH});
 const org=process.env.DAILY_FIXTURE_ORG;let claim='BLOCKED',send='BLOCKED';try{await d.claimWorker(org);claim='CLAIMED';await d.fakeSend(org,process.env.DAILY_FIXTURE_RESERVATION,process.env.DAILY_FIXTURE_INTENT);send='SENT';}catch{}finally{await c.end().catch(()=>{});}console.log(JSON.stringify({claim,send}));`;
 const childRun=async()=>JSON.parse((await exec(process.execPath,['--input-type=module','-e',child],{cwd:process.cwd(),timeout:20000,
  env:{...process.env,DAILY_FIXTURE_URL:l.urls.writer,DAILY_FIXTURE_HASH:l.fixtureHash,DAILY_FIXTURE_ORG:org,DAILY_FIXTURE_RESERVATION:reserved.id,DAILY_FIXTURE_INTENT:intent.id}})).stdout);
 assert.deepEqual(await childRun(),{claim:'BLOCKED',send:'BLOCKED'});
 const pid=(await l.writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;await l.admin.query('SELECT pg_terminate_backend($1)',[pid]);
 await blocked(l.ledger.fakeSend(org,reserved.id,intent.id));assert.deepEqual(await childRun(),{claim:'CLAIMED',send:'BLOCKED'});
 const second=await l.connect(),restart=dailyLab(second,{fixtureHash:l.fixtureHash});await restart.claimWorker(org);
 await blocked(restart.usageIntent(org));await blocked(restart.intent(org,reserved.id,'supply','create'));
 const v=await restart.read(org);assert.equal(v.reservations[0].state,'UNKNOWN');assert.equal(v.reservations[0].fakeSends,0);
 // Losing a COMMIT acknowledgement retains the committed reservation and refuses a duplicate.
 const otherOrg=dailyHash('COMMIT AMBIGUITY SIMULATED ORGANIZATION'),a=await seed({...l,ledger:restart},{organization:otherOrg});
 let failCommit=true;
 const uncertain={connectionParameters:second.connectionParameters,query:async(...args)=>{const result=await second.query(...args);if(String(args[0])==='COMMIT'&&failCommit){failCommit=false;throw Error('SIMULATED_LOST_COMMIT_ACK');}return result;}};
 await blocked(dailyLab(uncertain,{fixtureHash:l.fixtureHash}).reserve(otherOrg,a.plan,a.authorization));
 await blocked(restart.reserve(otherOrg,a.plan,a.authorization));assert.equal((await restart.read(otherOrg)).reservations[0].state,'UNKNOWN');
 const ambiguousOrg=dailyHash('SIMULATED INTENT COMMIT AMBIGUITY');let intentCommit=false;
 const intentClient={connectionParameters:second.connectionParameters,query:async(...args)=>{const result=await second.query(...args);if(String(args[0])==='COMMIT'&&intentCommit){intentCommit=false;throw Error('SIMULATED_INTENT_COMMIT_ACK_LOSS');}return result;}};
 const ambiguous=dailyLab(intentClient,{fixtureHash:l.fixtureHash}),af=await seed({...l,ledger:ambiguous},{organization:ambiguousOrg});
 const ar=await ambiguous.reserve(ambiguousOrg,af.plan,af.authorization);intentCommit=true;
 await blocked(ambiguous.intent(ambiguousOrg,ar.id,'supply','create'));
 const lostId=dailyHash({reservationId:ar.id,ordinal:0});await blocked(ambiguous.fakeSend(ambiguousOrg,ar.id,lostId));
 assert.equal((await ambiguous.read(ambiguousOrg)).reservations[0].fakeSends,0);
 // A transaction lock timeout makes no new reservation.
 const locker=await l.connect();await locker.query('BEGIN');await locker.query('SELECT pg_advisory_xact_lock(18471236,hashtext($1))',[otherOrg]);
 const count=await l.count();await blocked(restart.reserve(otherOrg,a.plan,a.authorization,'registry'));await locker.query('ROLLBACK');assert.equal(await l.count(),count);
});
test('daily PG17 failed usage consumes the day; actual DB time expiry, overrun and echo mismatch block fake sends',{timeout:120000},async t=>{
 const l=await lab(t);await l.ledger.claimWorker(org);const u=await l.ledger.usageIntent(org);await l.ledger.usageResponse(org,u.id,null);
 await blocked(l.ledger.usageIntent(org));const f=await l.clocked();await blocked(l.ledger.reserve(org,f.plan,f.authorization));
 for(const scenario of ['expired','expired_after_intent','overrun','echo']){
  const organization=dailyHash('SIMULATED '+scenario),x=await seed(l,{organization});
  if(scenario==='expired'){x.authorization.expiresAt=x.authorization.reviewedAt;await blocked(l.ledger.reserve(organization,x.plan,x.authorization));continue;}
  if(scenario==='expired_after_intent')x.authorization.expiresAt=new Date(Date.parse(x.authorization.reviewedAt)+5000).toISOString();
  const r=await l.ledger.reserve(organization,x.plan,x.authorization);
  if(scenario==='expired_after_intent'){
   const i=await l.ledger.intent(organization,r.id,'supply','create');
   await l.admin.query('SELECT pg_sleep(GREATEST(0,extract(epoch FROM ($1::timestamptz-clock_timestamp())))+0.02)',[x.authorization.expiresAt]);
   await blocked(l.ledger.fakeSend(organization,r.id,i.id));assert.equal((await l.ledger.read(organization)).reservations[0].fakeSends,0);continue;
  }
  for(const [op,body]of [['create',ok],['run',ok],['status',JSON.stringify({status:'success'})],['result',dailyResponse(x.plan,'supply',{cost:scenario==='overrun'?'0.3':'0.1',echo:scenario==='echo'?'SELECT 1':undefined})]]){
   const i=await l.ledger.intent(organization,r.id,'supply',op);await l.ledger.fakeSend(organization,r.id,i.id);await l.ledger.response(organization,r.id,i.id,body);
  }
  assert.equal((await l.ledger.read(organization)).reservations[0].state,'UNKNOWN');await blocked(l.ledger.intent(organization,r.id,'volume','create'));
 }
});
test('checkpoint PG17 publication gates each fake send and duplicate publication never rearms intent',{timeout:120000},async t=>{
 const l=await lab(t),raw=l.writer;let duringSend=false;
 l.writer={connectionParameters:raw.connectionParameters,query:async(...args)=>{
  const value=await raw.query(...args);
  if(duringSend&&String(args[0]).startsWith('SELECT count(*)::text')){duringSend=false;await blocked(l.ledger.releaseWorker(org));}
  return value;
 }};
 const p=await publishedLab(t,l),f=await seed(l),r=await l.ledger.reserve(org,f.plan,f.authorization);
 const i=await l.ledger.intent(org,r.id,'supply','create'),published=await l.ledger.publishCheckpoint(org);
 assert.equal(published.checkpoint.count,5);assert.equal((await l.ledger.publishCheckpoint(org)).duplicate,true);
 duringSend=true;await l.ledger.fakeSend(org,r.id,i.id);assert.equal(duringSend,false);await l.ledger.response(org,r.id,i.id,ok);
 await l.ledger.publishCheckpoint(org);await blocked(l.ledger.fakeSend(org,r.id,i.id));
 const v=await dailyLab(l.reader,{fixtureHash:l.fixtureHash}).read(org);assert.equal(v.reservations[0].fakeSends,1);
 assert.equal(v.executionEnabled,false);assert.equal(v.providerRequests,0);
 // Poisoned session cannot rearm even through inspect; a fresh handle cannot recover old acknowledgements.
 await blocked(p.publisher.inspect());
});
test('checkpoint PG17 unposted intent and write/fsync/publication ACK loss retain UNKNOWN and zero fake sends',{timeout:120000},async t=>{
 for(const scenario of ['unposted','record-write','file-sync','directory-sync','publication-ack']){
  const l=await lab(t),p=await publishedLab(t,l,{fault:async where=>{if(scenario===where)throw Error('FAKE_PUBLICATION_FAILURE');}});
  const f=await seed(l),r=await l.ledger.reserve(org,f.plan,f.authorization),i=await l.ledger.intent(org,r.id,'supply','create');
  if(scenario!=='unposted')await blocked(l.ledger.publishCheckpoint(org));
  await blocked(l.ledger.fakeSend(org,r.id,i.id));
  const v=await dailyLab(l.reader,{fixtureHash:l.fixtureHash}).read(org);assert.equal(v.reservations[0].fakeSends,0);assert.equal(v.reservations[0].state,'UNKNOWN');
  await p.publisher.close();await unlink(join(p.path,'publisher.lock')); // explicit owned-harness recovery only
  const recovered=await checkpointPublisher(p.path,p.setup);t.after(()=>recovered.close().catch(()=>{}));
  const fresh=await checkpointDailyLab(await l.connect(),{fixtureHash:l.fixtureHash,publisher:recovered});
  await l.ledger.releaseWorker(org);await fresh.claimWorker(org);
  await blocked(fresh.fakeSend(org,r.id,i.id));assert.equal((await fresh.read(org)).reservations[0].fakeSends,0);
 }
});
test('checkpoint PG17 DB-only, checkpoint-only and joint rollback block with separately retained latest trust; absent trust stays blocked',{timeout:120000},async t=>{
 const l=await lab(t),p=await publishedLab(t,l),f=await seed(l),r=await l.ledger.reserve(org,f.plan,f.authorization);
 const a=await l.ledger.publishCheckpoint(org);await l.ledger.intent(org,r.id,'supply','create');const b=await l.ledger.publishCheckpoint(org);
 await p.publisher.close();
 const rows=(await l.admin.query('SELECT * FROM atlas_allium_daily_lab.entry WHERE organization_hash=$1 ORDER BY ordinal',[org])).rows;
 const trim=async()=>{await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry DISABLE TRIGGER immutable_record');await l.admin.query('DELETE FROM atlas_allium_daily_lab.entry WHERE ordinal>4');await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry ENABLE TRIGGER immutable_record');};
 // Restore only DB: trusted publication is ahead and replay refuses the shorter ledger.
 await trim();const q=await checkpointPublisher(p.path,{...p.setup,trusted:b.trusted});
 const restored=await checkpointDailyLab(l.reader,{fixtureHash:l.fixtureHash,publisher:q});await blocked(restored.read(org));await q.close();
 const tail=rows.at(-1);await l.writer.query('INSERT INTO atlas_allium_daily_lab.entry VALUES($1,$2,$3,$4,$5)',[org,tail.ordinal,tail.previous_hash,tail.event_hash,tail.payload]);
 // Restore only checkpoint: independently retained B refuses old A, even though DB is current.
 await unlink(join(p.path,'00000002.json'));await blocked(checkpointPublisher(p.path,{...p.setup,trusted:b.trusted}));await unlink(join(p.path,'publisher.lock'));
 // Joint restore to A cannot satisfy B; with no outside reference the state is UNKNOWN and no gate opens.
 await trim();await blocked(checkpointPublisher(p.path,{...p.setup,trusted:b.trusted}));await unlink(join(p.path,'publisher.lock'));
 await blocked(checkpointPublisher(p.path,{identity:p.setup.identity}));
 // An explicitly old reference cannot prove joint rollback: demonstrate the limit, but old intent has no handle.
 const old=await checkpointPublisher(p.path,{...p.setup,trusted:a.trusted});t.after(()=>old.close().catch(()=>{}));
 const unknowable=await checkpointDailyLab(await l.connect(),{fixtureHash:l.fixtureHash,publisher:old});
 assert.equal((await unknowable.read(org)).checkpoint.count,4);await unknowable.claimWorker(org).then(()=>assert.fail('old worker still holds lock'),()=>{});
 assert.equal((await unknowable.read(org)).reservations[0].fakeSends,0);
});
test('checkpoint PG17 publication does not extend a DB lease or release budget',{timeout:120000},async t=>{
 const l=await lab(t),p=await publishedLab(t,l),f=await seed(l);
 f.authorization.expiresAt=new Date(Date.parse(f.authorization.reviewedAt)+5000).toISOString();
 const r=await l.ledger.reserve(org,f.plan,f.authorization),i=await l.ledger.intent(org,r.id,'supply','create');await l.ledger.publishCheckpoint(org);
 await l.admin.query('SELECT pg_sleep(GREATEST(0,extract(epoch FROM ($1::timestamptz-clock_timestamp())))+0.02)',[f.authorization.expiresAt]);
 await blocked(l.ledger.fakeSend(org,r.id,i.id));const v=await dailyLab(l.reader,{fixtureHash:l.fixtureHash}).read(org);
 assert.equal(v.reservations[0].fakeSends,0);assert.equal(v.reservations[0].state,'UNKNOWN');assert.equal(v.reservations[0].reservedUnits,'0.5');
 await blocked(p.publisher.inspect());
});
test('checkpoint PG17 intent/send commit ACK loss and post-publication worker lock loss forbid repeat sends',{timeout:120000},async t=>{
 for(const scenario of ['intent-commit','send-commit','worker-lock']){
  const l=await lab(t),raw=l.writer;let lose=false;
  l.writer={connectionParameters:raw.connectionParameters,query:async(...args)=>{const value=await raw.query(...args);if(lose&&String(args[0])==='COMMIT'){lose=false;throw Error('FAKE_COMMIT_ACK_LOSS');}return value;}};
  await publishedLab(t,l);const f=await seed(l),r=await l.ledger.reserve(org,f.plan,f.authorization);
  let id;
  if(scenario==='intent-commit'){
   lose=true;await blocked(l.ledger.intent(org,r.id,'supply','create'));id=dailyHash({reservationId:r.id,ordinal:0});
  }else id=(await l.ledger.intent(org,r.id,'supply','create')).id;
  await l.ledger.publishCheckpoint(org);
  if(scenario==='worker-lock')await raw.query('SELECT pg_advisory_unlock_all()');
  if(scenario==='send-commit')lose=true;
  await blocked(l.ledger.fakeSend(org,r.id,id));await blocked(l.ledger.fakeSend(org,r.id,id));
  const v=await dailyLab(l.reader,{fixtureHash:l.fixtureHash}).read(org);
  assert.equal(v.reservations[0].fakeSends,scenario==='send-commit'?1:0);assert.equal(v.reservations[0].state,'UNKNOWN');assert.equal(v.reservations[0].reservedUnits,'0.5');
 }
});
