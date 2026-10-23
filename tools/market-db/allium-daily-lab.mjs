import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {transaction} from './connection.mjs';
import {canonical,instant} from './plan.mjs';
import {dailyHash,dailyFail,hashValue} from '../allium-daily-plan.mjs';
import {initialDailyState,applyDailyEvent,dailyView,dailyEntryHash,sentDailyContext} from '../allium-daily-state.mjs';
export {dailyEntryHash} from '../allium-daily-state.mjs';

const schema='atlas_allium_daily_lab',migration=new URL('../../db/allium-daily-lab/001-initial.sql',import.meta.url),zero='0'.repeat(64);
const quote=v=>{if(typeof v!=='string'||!/^atlas_test_[a-z]+$/.test(v))dailyFail();return '"'+v+'"';};
async function fixtureGuard(c,fixtureHash){
 if(!hashValue(fixtureHash)||!['127.0.0.1','localhost','::1'].includes(c.connectionParameters?.host))dailyFail();
 const r=(await c.query("SELECT current_database() AS name,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()")).rows[0];
 if(!/^atlas_daily_fixture_[a-f0-9]{16}$/.test(r.name)||r.marker!=='ALLIUM_DAILY_OFFLINE:'+fixtureHash)dailyFail();
}
async function shape(c){
 const tables=(await c.query(`SELECT c.relname,c.relkind::text,c.relrowsecurity,c.relforcerowsecurity,c.relowner::text,c.relacl::text,
 (SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl::text) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 (SELECT jsonb_agg(pg_get_constraintdef(k.oid,true) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid) AS constraints,
 (SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled::text,pg_get_triggerdef(t.oid,true)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS triggers,
 (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=c.oid) AS indexes
 FROM pg_class c WHERE c.relnamespace=$1::regnamespace AND c.relkind IN ('r','p','v','m','f') ORDER BY c.relname`,[schema])).rows;
 const functions=(await c.query('SELECT proname,prosecdef,proacl::text,pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace=$1::regnamespace ORDER BY proname',[schema])).rows;
 const policies=(await c.query('SELECT polname,polrelid::regclass::text,polcmd::text,polpermissive,polroles::text,pg_get_expr(polqual,polrelid) AS using,pg_get_expr(polwithcheck,polrelid) AS check FROM pg_policy WHERE polrelid IN(SELECT oid FROM pg_class WHERE relnamespace=$1::regnamespace) ORDER BY polrelid::regclass::text,polname',[schema])).rows;
 const namespace=(await c.query('SELECT nspowner::text,nspacl::text FROM pg_namespace WHERE nspname=$1',[schema])).rows;
 const defaults=(await c.query('SELECT defaclrole::text,defaclobjtype::text,defaclacl::text FROM pg_default_acl WHERE defaclnamespace=$1::regnamespace ORDER BY defaclrole,defaclobjtype',[schema])).rows;
 return dailyHash({tables,functions,policies,namespace,defaults});
}
async function roles(c,writer,reader){
 for(const name of [writer,reader]){
  quote(name);
  const r=(await c.query(`SELECT oid,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,rolcanlogin,
   oid=(SELECT datdba FROM pg_database WHERE datname=current_database()) AS owner,
   has_database_privilege(oid,current_database(),'CREATE') AS ddl FROM pg_roles WHERE rolname=$1`,[name])).rows[0];
  if(!r||!r.rolcanlogin||r.rolsuper||r.rolbypassrls||r.rolcreaterole||r.rolcreatedb||r.rolreplication||r.owner||r.ddl||
   (await c.query('SELECT 1 FROM pg_auth_members WHERE member=$1 OR roleid=$1',[r.oid])).rowCount)dailyFail();
 }
 if(writer===reader)dailyFail();
}
async function verify(c,fixtureHash,write){
 await fixtureGuard(c,fixtureHash);
 const row=(await c.query('SELECT * FROM atlas_allium_daily_lab.configuration')).rows;
 if(row.length!==1)dailyFail();const a=row[0];
 if(a.version!==1||a.fixture_hash!==fixtureHash||a.migration_hash!==dailyHash(await readFile(migration))||a.structure_hash!==await shape(c))dailyFail();
 await roles(c,a.writer_name,a.reader_name);
 const r=(await c.query('SELECT current_user AS role,session_user AS login,pg_backend_pid() AS pid')).rows[0];
 if(r.role!==r.login||!(write?[a.writer_name]:[a.writer_name,a.reader_name]).includes(r.role))dailyFail();
 return r.pid;
}
export async function initializeDailyLab(c,{fixtureHash,writer,reader}){
 try{return await transaction(c,async()=>{
  await fixtureGuard(c,fixtureHash);quote(writer);quote(reader);await roles(c,writer,reader);
  await c.query('SELECT pg_advisory_xact_lock(18471236,0)');
  if((await c.query("SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('public','information_schema')")).rowCount)dailyFail();
  await c.query((await readFile(migration)).toString());
  const owner=(await c.query('SELECT current_user AS name')).rows[0].name;
  if(!/^[a-z_][a-z0-9_]*$/.test(owner))dailyFail();
  for(const table of ['configuration','entry']){
   await c.query(`CREATE POLICY installer ON atlas_allium_daily_lab.${table} TO "${owner}" USING(true) WITH CHECK(true)`);
   for(const [role,name]of [[writer,'lab_writer'],[reader,'lab_reader']]){
    await c.query(`GRANT USAGE ON SCHEMA atlas_allium_daily_lab TO ${quote(role)}; GRANT SELECT ON atlas_allium_daily_lab.${table} TO ${quote(role)}`);
    await c.query(`CREATE POLICY ${name} ON atlas_allium_daily_lab.${table} FOR SELECT TO ${quote(role)} USING(true)`);
   }
  }
  await c.query(`GRANT INSERT ON atlas_allium_daily_lab.entry TO ${quote(writer)}; CREATE POLICY lab_insert ON atlas_allium_daily_lab.entry FOR INSERT TO ${quote(writer)} WITH CHECK(true)`);
  const structureHash=await shape(c);
  await c.query('INSERT INTO atlas_allium_daily_lab.configuration VALUES(1,$1,$2,$3,$4,$5)',[fixtureHash,writer,reader,dailyHash(await readFile(migration)),structureHash]);
  return {state:'SIMULATION_INITIALIZED',executionEnabled:false};
 });}catch{dailyFail();}
}
// No environment reader, connection factory, provider client, activation path, or CLI is exposed.
export async function checkpointDailyLab(c,{fixtureHash,publisher,responseStore}){
 try{
  const identity=publisher.identity();if(identity.fixtureHash!==fixtureHash||identity.dbEpoch!==fixtureHash)dailyFail();
  if(responseStore){const r=responseStore.identity();if(['fixtureHash','dbEpoch','organizationHash'].some(k=>r[k]!==identity[k]))dailyFail();}
  const published=await publisher.inspect();
  return dailyLab(c,{fixtureHash,checkpoints:{[identity.organizationHash]:published.checkpoint},checkpointPublisher:publisher,responseStore});
 }catch{dailyFail();}
}
export function dailyLab(c,{fixtureHash,checkpoints={},checkpointPublisher,responseStore}){
 const anchors=new Map(Object.entries(structuredClone(checkpoints))),workers=new Map(),confirmedReservations=new Map(),confirmedIntents=new Set();
 async function lock(org){if(!hashValue(org))dailyFail();await c.query('SELECT pg_advisory_xact_lock(18471236,hashtext($1))',[org]);}
 async function worker(org,pid){
  const w=workers.get(org);if(!w||w.pid!==pid)dailyFail();
  const row=(await c.query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND classid=18471237 AND objid=(hashtext($1)::bigint & 4294967295)::oid AND objsubid=2 AND granted",[org])).rowCount;
  if(!row)dailyFail();return w;
 }
 async function replay(org){
  const totals=(await c.query('SELECT count(*)::text AS count,coalesce(sum(octet_length(payload)),0)::text AS bytes FROM atlas_allium_daily_lab.entry WHERE organization_hash=$1',[org])).rows[0];
  if(BigInt(totals.count)>8192n||BigInt(totals.bytes)>16777216n)dailyFail();
  const rows=(await c.query('SELECT * FROM atlas_allium_daily_lab.entry WHERE organization_hash=$1 ORDER BY ordinal',[org])).rows;
  if(rows.length>8192||rows.reduce((n,r)=>n+Buffer.byteLength(r.payload),0)>16777216)dailyFail();
  const expected=anchors.get(org);
  if(expected&&(!Number.isInteger(expected.count)||expected.count<0||!hashValue(expected.hash)||rows.length<expected.count||
   (expected.count?rows[expected.count-1].event_hash:zero)!==expected.hash))dailyFail();
  let previous=zero;const s=initialDailyState(org);
  for(const [index,r]of rows.entries()){
   if(r.ordinal!==index+1||r.previous_hash!==previous||r.event_hash!==dailyEntryHash(org,r.ordinal,previous,r.payload))dailyFail();
   const e=JSON.parse(r.payload);if(canonical(e)!==r.payload)dailyFail();applyDailyEvent(s,e);previous=r.event_hash;
   if(e.type==='RESPONSE_IMPORTED'&&e.evidence.fixtureHash!==fixtureHash)dailyFail();
   if(e.type==='RESPONSE_IMPORTED'&&responseStore){
    const saved=await responseStore.read({storeHash:e.evidence.storeHash,recordHash:e.evidenceHash});
    if(canonical(saved)!==canonical(e.evidence))dailyFail();
   }
  }
  return {s,head:{count:rows.length,hash:previous},bytes:BigInt(totals.bytes)};
 }
 async function run(org,build,{readonly=false,needsWorker=false,gate}={}){
  let next;
  try{
   const result=await transaction(c,async()=>{
    const pid=await verify(c,fixtureHash,!readonly);if(!readonly)await lock(org);
    const w=needsWorker?await worker(org,pid):undefined;
    const {s,head,bytes}=await replay(org);
    if(checkpointPublisher&&checkpointPublisher.identity().organizationHash!==org)dailyFail();
    if(gate)await gate(head);
    if(gate&&needsWorker)await worker(org,pid);
    const at=instant((await c.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS at")).rows[0].at);
    const e=build?.(s,at,w);
    if(e){
     const event={...e,organizationHash:org,at};applyDailyEvent(s,event);
     const payload=canonical(event),n=head.count+1,hash=dailyEntryHash(org,n,head.hash,payload);
     if(n>8192||bytes+BigInt(Buffer.byteLength(payload))>16777216n)dailyFail();
     await c.query('INSERT INTO atlas_allium_daily_lab.entry VALUES($1,$2,$3,$4,$5)',[org,n,head.hash,hash,payload]);
     next={count:n,hash};
    }else next=head;
    return {...dailyView(s),checkpoint:next,...(e?.id?{id:e.id}:{})};
   },{readonly,repeatableRead:readonly});
   anchors.set(org,structuredClone(next));return result;
  }catch{dailyFail();}
 }
 return {
  read:org=>run(org,null,{readonly:true}),
  async publishCheckpoint(org){
   if(!checkpointPublisher)dailyFail();
   try{
    const previous=await checkpointPublisher.inspect(),v=await run(org,null,{readonly:true});
    return await checkpointPublisher.publish(v.checkpoint,previous.trusted);
   }catch{confirmedIntents.clear();confirmedReservations.clear();dailyFail();}
  },
  async claimWorker(org){
   try{return await transaction(c,async()=>{
    const pid=await verify(c,fixtureHash,true);if(workers.has(org)){await worker(org,pid);return {state:'SIMULATION_WORKER_CLAIMED'};}
    if(!hashValue(org)||(await c.query('SELECT pg_try_advisory_lock(18471237,hashtext($1)) AS ok',[org])).rows[0].ok!==true)dailyFail();
    const w={pid,token:dailyHash(randomBytes(32))};workers.set(org,w);return {state:'SIMULATION_WORKER_CLAIMED'};
   });}catch{workers.delete(org);dailyFail();}
  },
  async releaseWorker(org){try{return await transaction(c,async()=>{const pid=await verify(c,fixtureHash,true);await worker(org,pid);await c.query('SELECT pg_advisory_unlock(18471237,hashtext($1))',[org]);workers.delete(org);});}catch{dailyFail();}},
  usageIntent:org=>run(org,(_s,_at,w)=>({type:'USAGE_INTENT',id:dailyHash({organizationHash:org,day:_at.slice(0,10),kind:'usage'}),workerToken:w.token}),{needsWorker:true}),
  usageResponse:(org,intentId,body)=>run(org,()=>({type:'USAGE_RESPONSE',intentId,body})),
  async reserve(org,plan,authorization,kind='daily'){
   const ackHash=dailyHash(randomBytes(32));
   const r=await run(org,()=>({type:'RESERVE',id:dailyHash({organizationHash:org,day:plan.asOfDay,kind}),kind,plan,authorization,ackHash}));
   const confirmed=await run(org,()=>({type:'CONFIRM_RESERVATION',reservationId:r.id,ackHash}));
   confirmedReservations.set(r.id,ackHash);return {...confirmed,id:r.id};
  },
  async intent(org,reservationId,job,operation){const result=await run(org,(s,_at,w)=>{
   const r=s.reservations.find(r=>r.id===reservationId);if(!r)dailyFail();
   if(confirmedReservations.get(reservationId)!==r.ackHash)dailyFail();
   return {type:'INTENT',id:dailyHash({reservationId,ordinal:r.intents.length}),reservationId,job,operation,workerToken:w.token};
  },{needsWorker:true});confirmedIntents.add(result.id);return result;},
  async fakeSend(org,reservationId,intentId){
   const send=gate=>run(org,(s,_at,w)=>{
   const original=s.events.find(e=>e.type==='INTENT'&&e.id===intentId);
   if(original?.workerToken!==w.token||!confirmedIntents.has(intentId))dailyFail();
   confirmedIntents.delete(intentId);return {type:'FAKE_SEND',reservationId,intentId};
  },{needsWorker:true,gate});
   try{return checkpointPublisher?await checkpointPublisher.withGate(send):await send();}
   catch{confirmedIntents.delete(intentId);dailyFail();}
  },
  response:async(org,reservationId,intentId,body)=>{if(responseStore)dailyFail();return run(org,()=>({type:'RESPONSE',reservationId,intentId,body}));},
  async preserveResponse(org,reservationId,intentId,bytes,observedAt){
   try{
    if(!responseStore)dailyFail();const identity=responseStore.identity();
    if(identity.fixtureHash!==fixtureHash||identity.dbEpoch!==fixtureHash||identity.organizationHash!==org)dailyFail();
    let metadata;await run(org,s=>{metadata={...sentDailyContext(s,reservationId,intentId),observedAt};return null;},{readonly:true});
    return await responseStore.preserve(metadata,bytes);
   }catch{dailyFail();}
  },
  async importResponse(org,reference){
   try{
    reference=structuredClone(reference);
    if(!responseStore)dailyFail();const evidence=await responseStore.read(reference);
    if(evidence.fixtureHash!==fixtureHash||evidence.organizationHash!==org)dailyFail();
    return await run(org,s=>{
     const existing=s.events.find(e=>e.type==='RESPONSE_IMPORTED'&&e.evidenceHash===reference.recordHash);
     if(existing){if(canonical(existing.evidence)!==canonical(evidence))dailyFail();return null;}
     return {type:'RESPONSE_IMPORTED',evidenceHash:reference.recordHash,evidence};
    });
   }catch{dailyFail();}
  },
 };
}
// Recovery has no worker/intent/send/ordinary response/reservation entry point.
export async function responseImportDailyLab(c,options){
 if(!options.publisher||!options.responseStore)dailyFail();
 const lab=await checkpointDailyLab(c,options);
 return {read:lab.read,importResponse:lab.importResponse,publishCheckpoint:lab.publishCheckpoint};
}
