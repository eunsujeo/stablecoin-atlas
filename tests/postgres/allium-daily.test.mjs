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
import {checkpointDailyLab,responseImportDailyLab,reconciliationReviewDailyLab} from '../../tools/market-db/allium-daily-lab.mjs';
import {createResponseStore,responseStore} from '../../tools/allium-response-evidence.mjs';
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
async function evidenceLab(t,{writerFault,storeFault,publishFault}={}){
 const l=await lab(t),raw=l.writer;
 if(writerFault)l.writer={connectionParameters:raw.connectionParameters,query:async(...args)=>writerFault(raw,args)};
 const p=await publishedLab(t,l,{fault:publishFault}),path=join(p.root,'responses');
 const config=await createResponseStore(path,{fixtureHash:l.fixtureHash,organizationHash:org});
 const store=await responseStore(path,{...config,fault:storeFault});
 l.ledger=await checkpointDailyLab(l.writer,{fixtureHash:l.fixtureHash,publisher:p.publisher,responseStore:store});
 const f=await seed(l),r=await l.ledger.reserve(org,f.plan,f.authorization),i=await l.ledger.intent(org,r.id,'supply','create');
 await l.ledger.publishCheckpoint(org);await l.ledger.fakeSend(org,r.id,i.id);
 const observedAt=await l.now();
 const recovery=async(client=undefined)=>responseImportDailyLab(client??await l.connect(),{fixtureHash:l.fixtureHash,publisher:p.publisher,responseStore:store});
 return {l,p,path,config,store,r,i,f,observedAt,recovery};
}
test('response PG17 restart import preserves original UNKNOWN/budget/time, serializes duplicate imports and exposes no send API',{timeout:120000},async t=>{
 const e=await evidenceLab(t),{l,r,i}=e,ref=await l.ledger.preserveResponse(org,r.id,i.id,Buffer.from(' '+ok+'\n'),e.observedAt);
 const a=await e.recovery(),b=await e.recovery();assert.deepEqual(Object.keys(a).sort(),['importResponse','publishCheckpoint','read']);
 const before=await l.count();await Promise.all([a.importResponse(org,ref),b.importResponse(org,ref)]);assert.equal(await l.count(),before+1);
 const v=await a.read(org),entry=v.reservations[0].importedResponses[0];
 assert.equal(v.reservations[0].state,'UNKNOWN');assert.equal(v.reservations[0].fakeSends,1);assert.equal(v.pendingUnits,'0.5');
 assert.equal(v.reconciliation,'NOT_ENABLED_C_ZERO');assert.equal(entry.observedAt,e.observedAt);assert.equal(entry.reviewed.state,'OK');
 assert.ok(entry.reviewedAt>=entry.observedAt);assert.equal(v.providerRequests,0);
 await blocked(l.ledger.response(org,r.id,i.id,ok));await blocked(l.ledger.intent(org,r.id,'supply','run'));
 await a.publishCheckpoint(org);await blocked(l.ledger.fakeSend(org,r.id,i.id));
 assert.equal((await a.read(org)).reservations[0].fakeSends,1);
});
test('response PG17 DB INSERT failure and commit ACK loss recover by import only, without duplicate events',{timeout:120000},async t=>{
 for(const scenario of ['insert','commit']){
  let fail=false;
  const e=await evidenceLab(t,{writerFault:async(raw,args)=>{
   if(fail&&scenario==='insert'&&String(args[0]).startsWith('INSERT INTO atlas_allium_daily_lab.entry')){fail=false;throw Error('SIMULATED_INSERT_FAILURE');}
   const v=await raw.query(...args);if(fail&&scenario==='commit'&&String(args[0])==='COMMIT'){fail=false;throw Error('SIMULATED_COMMIT_ACK_LOSS');}return v;
  }}),{l,r,i}=e;
  const ref=await l.ledger.preserveResponse(org,r.id,i.id,Buffer.from(ok),e.observedAt),before=await l.count();
  fail=true;await blocked(l.ledger.importResponse(org,ref));assert.equal(await l.count(),before+(scenario==='commit'?1:0));
  const recovery=await e.recovery();await recovery.importResponse(org,ref);await recovery.importResponse(org,ref);assert.equal(await l.count(),before+1);
  const v=await recovery.read(org);assert.equal(v.reservations[0].fakeSends,1);assert.equal(v.pendingUnits,'0.5');assert.equal(v.reservations[0].state,'UNKNOWN');
 }
});
test('response PG17 wrong ancestry/identity/observation period cannot import; malformed exact bytes remain UNKNOWN',{timeout:120000},async t=>{
 const e=await evidenceLab(t),{l,r,i}=e,valid=await l.ledger.preserveResponse(org,r.id,i.id,Buffer.from(ok),e.observedAt),record=await e.store.read(valid);
 const {rawHash,rawLength,rawBase64,schema,kind,storeHash,fixtureHash,dbEpoch,organizationHash,...metadata}=record;
 const before=await l.count();
 for(const patch of [{sendHead:{...metadata.sendHead,hash:zero}},{sendHead:{count:5,hash:metadata.sendHead.hash}},
  {intentId:dailyHash('OTHER INTENT')},{reservationId:dailyHash('OTHER RESERVATION')},{job:'volume'},{operation:'run'},
  {observedAt:'2000-01-01T00:00:00.000000Z'},{observedAt:'2099-01-01T00:00:00.000000Z'}]){
  const ref=await e.store.preserve({...metadata,...patch},Buffer.from(ok));await blocked(l.ledger.importResponse(org,ref));assert.equal(await l.count(),before);
 }
 const malformed=await e.store.preserve(metadata,Buffer.from([0xff,0x00,0x7b]));await l.ledger.importResponse(org,malformed);
 const v=await l.ledger.read(org);assert.equal(v.reservations[0].importedResponses[0].reviewed.state,'UNKNOWN');assert.equal(v.reservations[0].state,'UNKNOWN');
 await blocked(l.ledger.importResponse(org,valid));assert.equal(await l.count(),before+1);
});
test('response PG17 vault rollback and DB rollback cannot satisfy current evidence/trusted publication',{timeout:120000},async t=>{
 const e=await evidenceLab(t),{l,r,i}=e,ref=await l.ledger.preserveResponse(org,r.id,i.id,Buffer.from(ok),e.observedAt);
 const before=await l.count();await l.ledger.importResponse(org,ref);const trusted=await l.ledger.publishCheckpoint(org);
 const {readFile,writeFile}=await import('node:fs/promises'),path=join(e.path,ref.recordHash+'.json'),bytes=await readFile(path);
 await unlink(path);await blocked((await e.recovery()).read(org));
 await writeFile(path,bytes,{mode:0o600});await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry DISABLE TRIGGER immutable_record');
 await l.admin.query('DELETE FROM atlas_allium_daily_lab.entry WHERE ordinal>$1',[before]);await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry ENABLE TRIGGER immutable_record');
 await blocked((await e.recovery()).importResponse(org,ref));await blocked((await e.recovery()).read(org));
 assert.ok(trusted.trusted.hash);assert.equal((await dailyLab(l.reader,{fixtureHash:l.fixtureHash}).read(org)).reservations[0].fakeSends,1);
});
test('response PG17 response fsync/ACK uncertainty retains UNKNOWN; import publication ACK loss grants no send rights',{timeout:120000},async t=>{
 for(const point of ['record-write','file-sync','directory-sync','response-ack']){
  const e=await evidenceLab(t,{storeFault:async where=>{if(where===point)throw Error('SIMULATED_STORE_FAILURE');}}),{l,r,i}=e;
  await blocked(l.ledger.preserveResponse(org,r.id,i.id,Buffer.from(ok),e.observedAt));
  const v=await l.ledger.read(org);assert.equal(v.reservations[0].fakeSends,1);assert.equal(v.reservations[0].state,'UNKNOWN');assert.equal(v.pendingUnits,'0.5');
 }
 let fail=false;const e=await evidenceLab(t,{publishFault:async where=>{if(fail&&where==='publication-ack')throw Error('SIMULATED_PUBLICATION_ACK_LOSS');}}),{l,r,i}=e;
 const ref=await l.ledger.preserveResponse(org,r.id,i.id,Buffer.from(ok),e.observedAt),recovery=await e.recovery();await recovery.importResponse(org,ref);
 fail=true;await blocked(recovery.publishCheckpoint(org));await blocked(l.ledger.fakeSend(org,r.id,i.id));
 const v=await recovery.read(org);assert.equal(v.reservations[0].fakeSends,1);assert.equal(v.pendingUnits,'0.5');assert.equal(v.providerRequests,0);
});
test('response PG17 full result bytes import without marking the job complete or releasing budget',{timeout:120000},async t=>{
 const l=await lab(t),f=await seed(l),r=await l.ledger.reserve(org,f.plan,f.authorization);
 await send(l,r.id,'supply','create',ok);await send(l,r.id,'supply','run',ok);await send(l,r.id,'supply','status',JSON.stringify({status:'success'}));
 const i=await l.ledger.intent(org,r.id,'supply','result');await l.ledger.fakeSend(org,r.id,i.id);
 const observedAt=await l.now(),p=await publishedLab(t,l),path=join(p.root,'responses');
 const config=await createResponseStore(path,{fixtureHash:l.fixtureHash,organizationHash:org}),store=await responseStore(path,config);
 l.ledger=await checkpointDailyLab(l.writer,{fixtureHash:l.fixtureHash,publisher:p.publisher,responseStore:store});
 const bytes=Buffer.from(dailyResponse(f.plan,'supply')),ref=await l.ledger.preserveResponse(org,r.id,i.id,bytes,observedAt);
 assert.ok(bytes.length>16384);const recovery=await responseImportDailyLab(await l.connect(),{fixtureHash:l.fixtureHash,publisher:p.publisher,responseStore:store});
 const v=await recovery.importResponse(org,ref);assert.equal(v.reservations[0].importedResponses[0].reviewed.state,'VALIDATED');
 assert.equal(v.reservations[0].state,'UNKNOWN');assert.equal(v.pendingUnits,'0.5');assert.equal(v.reservations[0].fakeSends,4);
 await recovery.publishCheckpoint(org);assert.deepEqual(await recovery.read(org),v);
 const reviewer=await reconciliationReviewDailyLab(l.reader,{fixtureHash:l.fixtureHash,publisher:p.publisher,responseStore:store});
 const report=await reviewer.review(org),item=report.reservations[0].intents[3];
 assert.equal(item.contentState,'RESULT_VALIDATED');assert.equal(item.reviewState,'VALIDATED');assert.equal(item.reportedResultUnits,'0.1');
 assert.equal(item.usageFinality,'UNKNOWN');assert.equal(item.reconciledUnits,'0');assert.equal(report.reservations[0].jobs[0].complete,false);
});
async function reviewFixture(t){
 const e=await evidenceLab(t),{l,r,i}=e;
 const ref=await l.ledger.preserveResponse(org,r.id,i.id,Buffer.from(ok),e.observedAt);
 await l.ledger.importResponse(org,ref);await l.ledger.publishCheckpoint(org);
 return {...e,ref,review:client=>reconciliationReviewDailyLab(client,{fixtureHash:l.fixtureHash,publisher:e.p.publisher,responseStore:e.store})};
}
test('review PG17 least privilege report is deterministic, redacted and changes no ledger, budget, jobs or publication',{timeout:120000},async t=>{
 const e=await reviewFixture(t),{l,p}=e,review=await e.review(l.reader);
 assert.deepEqual(Object.keys(review),['review']);
 await blocked(reconciliationReviewDailyLab(l.reader,{fixtureHash:l.fixtureHash,publisher:p.publisher}));
 await blocked(reconciliationReviewDailyLab(l.reader,{fixtureHash:l.fixtureHash,publisher:p.publisher,
  responseStore:{identity:()=>({...e.store.identity(),organizationHash:dailyHash('WRONG ORGANIZATION')})}}));
 await blocked(review.review(dailyHash('WRONG ORGANIZATION')));
 const before=await l.ledger.read(org),count=await l.count(),publication=await p.publisher.inspect();
 const a=await review.review(org),b=await review.review(org);assert.deepEqual(a,b);
 assert.equal(a.publication,'EXACT_PUBLISHED_HEAD');assert.deepEqual(a.checkpoint,publication.checkpoint);
 assert.equal(a.reservations[0].state,'UNKNOWN');assert.equal(a.reservations[0].intents[0].contentState,'CONTROL_RESPONSE_ONLY');
 assert.equal(a.reservations[0].intents[0].reviewState,'OK');
 assert.equal(a.reservations[0].intents[0].observedAt,e.observedAt);assert.equal(a.reservations[0].intents[0].evidenceHash,e.ref.recordHash);
 assert.equal(a.pendingUnits,'0.5');assert.equal(a.reservations[0].reconciledUnits,'0');assert.equal(a.reservations[0].usageIncludedUnits,null);
 assert.equal(a.providerRequests,0);assert.equal(a.debitEnabled,false);assert.ok(a.reservations[0].jobs.every(j=>!j.complete));
 assert.doesNotMatch(JSON.stringify(a),/rawBase64|referenceHash|rawLength/);
 a.reservations[0].intents[0].contentState='ALTERED';assert.deepEqual(await review.review(org),b);
 assert.equal(await l.count(),count);assert.deepEqual(await l.ledger.read(org),before);assert.deepEqual(await p.publisher.inspect(),publication);
});
test('review PG17 pins publication until read transaction commit and rejects lost commit ACK without appending',{timeout:120000},async t=>{
 const e=await reviewFixture(t),{l,p}=e,raw=await l.connect('reader');let intercept=false,commitLost=false,pinned=0;
 const wrapped={connectionParameters:raw.connectionParameters,query:async(...args)=>{
  if(intercept&&String(args[0])==='COMMIT'){
   await blocked(p.publisher.publish((await l.ledger.read(org)).checkpoint,{sequence:0,hash:zero}));
   await blocked(p.publisher.close());pinned++;
  }
  const result=await raw.query(...args);
  if(commitLost&&String(args[0])==='COMMIT')throw Error('SIMULATED_REVIEW_COMMIT_ACK_LOSS');
  return result;
 }};
 const reviewer=await e.review(wrapped),before=await l.count();intercept=true;
 await reviewer.review(org);assert.equal(pinned,1);commitLost=true;await blocked(reviewer.review(org));
 assert.equal(await l.count(),before);await blocked(reviewer.review(org));
 assert.equal((await l.ledger.read(org)).pendingUnits,'0.5');
});
test('review PG17 unpublished import and publication ACK uncertainty return no report',{timeout:120000},async t=>{
 for(const scenario of ['unpublished','ack']){
  let fail=false;const e=await evidenceLab(t,{publishFault:async point=>{if(fail&&point==='publication-ack')throw Error('SIMULATED_REVIEW_PUBLICATION_ACK_LOSS');}}),{l,r,i}=e;
  const ref=await l.ledger.preserveResponse(org,r.id,i.id,Buffer.from(ok),e.observedAt);
  await l.ledger.importResponse(org,ref);
  if(scenario==='ack'){fail=true;await blocked(l.ledger.publishCheckpoint(org));}
  const options={fixtureHash:l.fixtureHash,publisher:e.p.publisher,responseStore:e.store};
  if(scenario==='ack')await blocked(reconciliationReviewDailyLab(l.reader,options));
  else {const reviewer=await reconciliationReviewDailyLab(l.reader,options);await blocked(reviewer.review(org));}
  assert.equal((await l.ledger.read(org)).reservations[0].fakeSends,1);
 }
});
test('review PG17 missing or replaced original bytes and DB rollback block instead of returning a partial report',{timeout:120000},async t=>{
 for(const scenario of ['missing','replaced','db']){
  const e=await reviewFixture(t),{l}=e,reviewer=await e.review(l.reader),before=await l.count();
  if(scenario==='db'){
   await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry DISABLE TRIGGER immutable_record');
   await l.admin.query('DELETE FROM atlas_allium_daily_lab.entry WHERE ordinal=$1',[before]);
   await l.admin.query('ALTER TABLE atlas_allium_daily_lab.entry ENABLE TRIGGER immutable_record');
  }else{
   const path=join(e.path,e.ref.recordHash+'.json');
   if(scenario==='missing')await unlink(path);
   else {const {writeFile}=await import('node:fs/promises');await writeFile(path,'{}',{mode:0o600});}
  }
  await blocked(reviewer.review(org));assert.equal(await l.count(),before-(scenario==='db'?1:0));
 }
});
