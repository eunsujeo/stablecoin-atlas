import {prefetchValidation} from './validation-batch.mjs';
import {verifySchedulerSchema,grantSchedulerRead} from './scheduler-policy.mjs';
import {importDaily,readDaily} from './daily-history.mjs';
import {readFile} from 'node:fs/promises';
import {transaction,runtimeRole,safeRole} from './connection.mjs';
import {structureHash,verifySchema,verifyRuntimeAccess} from './schema.mjs';
import {canonical,digest,fail} from './plan.mjs';
import {validateSupplyHistory} from '../../web/supply-history-model.js';
const migration=new URL('../../db/history/001-initial.sql',import.meta.url);
const secondMigration=new URL('../../db/history/002-supply-metric.sql',import.meta.url);
const thirdMigration=new URL('../../db/history/003-periodic-normalized.sql',import.meta.url);
const fourthMigration=new URL('../../db/history/004-continuous-collection.sql',import.meta.url);
const tables=['schema_version','reader_grant','snapshot'];
const extraTables=['writer_grant','daily_source','daily_value','daily_latest','scheduler_day','scheduler_run'];
const allTables=v=>v>=3?[...tables,...extraTables]:tables;
const insertTables=['daily_source','daily_value','daily_latest','scheduler_day','scheduler_run'];
const updateColumns={daily_latest:['value_id','source_id'],scheduler_run:['state','finished_at','error_code']};
const identifier=value=>{if(typeof value!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(value))fail('INVALID_IDENTIFIER');return '"'+value+'"';};
const exists=async client=>(await client.query("SELECT to_regnamespace('atlas_history') IS NOT NULL AS present")).rows[0].present;
const lock=client=>client.query('SELECT pg_advisory_xact_lock(18471234,403)');
async function owner(client){
  await verifySchema(client);
  const {rows:[r]}=await client.query("SELECT current_user=session_user AND current_user=pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='atlas_market'");
  if(!r?.owner)fail('DATABASE_OWNER_REQUIRED');
  if(await exists(client)){
    const {rows:[c]}=await client.query("SELECT current_user=pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='atlas_history'");
    if(!c?.owner)fail('DATABASE_OWNER_REQUIRED');
  }
}
async function verifyHistory(client){
  const {rows}=await client.query("SELECT version,encode(migration_hash,'hex') AS migration_hash,encode(structure_hash,'hex') AS structure_hash FROM atlas_history.schema_version ORDER BY version");
  const version=rows.at(-1)?.version;
  if(![1,2,3,4].includes(version)||rows.length!==version)fail('HISTORY_SCHEMA_MISMATCH');
  for(const [i,file]of [migration,secondMigration,thirdMigration,fourthMigration].slice(0,version).entries())if(rows[i].version!==i+1||rows[i].migration_hash!==digest(await readFile(file)))fail('HISTORY_SCHEMA_MISMATCH');
  if(rows.at(-1).structure_hash!==await structureHash(client,'atlas_history'))fail('HISTORY_SCHEMA_MISMATCH');
  const checks=[
    "SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_history'",
    'SELECT g.role_name,r.oid::text AS id FROM atlas_history.reader_grant g JOIN pg_roles r ON r.rolname=g.role_name ORDER BY g.role_name',
    'SELECT g.role_name,r.oid::text AS id FROM atlas_history.writer_grant g JOIN pg_roles r ON r.rolname=g.role_name ORDER BY g.role_name',
    `SELECT c.relname AS table,p.polname AS name,p.polcmd::text AS command,array_to_string(p.polroles,',') AS id,
    pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
    WHERE c.relnamespace='atlas_history'::regnamespace AND p.polpermissive`,
    "SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_history'::regnamespace AND NOT p.polpermissive",
    "SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='atlas_history'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'O'",
    `SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='atlas_history' AND a.grantee=0
    UNION ALL SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='atlas_history'::regnamespace AND a.grantee=0
    UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='atlas_history'::regnamespace AND a.grantee=0`,
    `SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role') AND (
    has_schema_privilege(r.oid,'atlas_history','USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='atlas_history'::regnamespace AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
    OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='atlas_history'::regnamespace AND has_function_privilege(r.oid,p.oid,'EXECUTE')))`,
    "SELECT current_setting('pgrst.db_schemas',true) AS schemas"
  ];
  await prefetchValidation(client,version>=3?checks:checks.filter((_,i)=>i!==2));
  const ownerId=(await client.query(checks[0])).rows[0].id;
  const roles=(await client.query(checks[1])).rows;
  const writers=version>=3?(await client.query(checks[2])).rows:[];
  const expected=[];for(const table of allTables(version)){
    expected.push({table,name:'installer',command:'*',id:ownerId,using:'true',check:'true'});
    for(const r of [...roles,...writers])expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_s_'+table,command:'r',id:r.id,using:'true',check:null});
    for(const r of writers){if(insertTables.includes(table))expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_i_'+table,command:'a',id:r.id,using:null,check:'true'});if(updateColumns[table])expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_u_'+table,command:'w',id:r.id,using:'true',check:'true'});}
  }
  const actual=(await client.query(checks[3])).rows;
  const sort=rows=>rows.sort((a,b)=>(a.table+':'+a.name).localeCompare(b.table+':'+b.name));
  if(canonical(sort(actual))!==canonical(sort(expected)))fail('HISTORY_POLICIES_UNSAFE');
  const bad=(await client.query(checks[4])).rowCount;
  if(bad)fail('HISTORY_POLICIES_UNSAFE');
  if((await client.query(checks[5])).rowCount)fail('HISTORY_SCHEMA_MISMATCH');
  const publicAcl=(await client.query(checks[6])).rowCount;
  if(publicAcl)fail('HISTORY_PRIVILEGES_UNSAFE');
  const exposed=(await client.query(checks[7])).rowCount;
  if(exposed)fail('HISTORY_PRIVILEGES_UNSAFE');
  const configured=(await client.query(checks[8])).rows[0].schemas;
  if(configured?.split(',').some(s=>s.trim()==='atlas_history'))fail('HISTORY_PRIVILEGES_UNSAFE');
  return version;
}
async function readerPrivileges(client,role){
  await safeRole(client,role);
  const checks=[
    "SELECT has_schema_privilege($1,'atlas_history','USAGE') AS usage,has_schema_privilege($1,'atlas_history','CREATE') AS create",
    `SELECT has_table_privilege($1,c.oid,'SELECT') AS readable,has_table_privilege($1,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS mutation,
    has_column_privilege($1,c.oid,a.attnum,'INSERT,UPDATE,REFERENCES') AS column_mutation FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE c.relnamespace='atlas_history'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,
    "SELECT 1 FROM pg_proc WHERE pronamespace='atlas_history'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')"
  ];
  await prefetchValidation(client,checks,[role]);
  const {rows:[schema]}=await client.query(checks[0],[role]);
  if(!schema.usage||schema.create)fail('HISTORY_ACCESS_DENIED');
  const rows=(await client.query(checks[1],[role])).rows;
  if(!rows.length||rows.some(r=>!r.readable||r.mutation||r.column_mutation))fail('HISTORY_PRIVILEGES_UNSAFE');
  if((await client.query(checks[2],[role])).rowCount)fail('HISTORY_PRIVILEGES_UNSAFE');
}
async function migrateHistory(client){
  const sql=await readFile(secondMigration);await client.query(sql.toString('utf8'));
  await client.query('INSERT INTO atlas_history.schema_version VALUES(2,$1,$2)',[Buffer.from(digest(sql),'hex'),Buffer.from(await structureHash(client,'atlas_history'),'hex')]);
  await verifyHistory(client);await verifySchema(client);
}
export async function upgradeHistory(client){return transaction(client,async()=>{
  await lock(client);await owner(client);const version=await verifyHistory(client);
  if(version>=2)return {state:'UNCHANGED',version};await migrateHistory(client);return {state:'UPGRADED',version:2};
});}
export async function initializeHistory(client){return transaction(client,async()=>{
  await lock(client);await owner(client);
  if(await exists(client)){const version=await verifyHistory(client);return {state:'UNCHANGED',version};}
  const sql=await readFile(migration);await client.query(sql.toString('utf8'));const role=(await client.query('SELECT current_user AS role')).rows[0].role;
  for(const table of tables)await client.query(`CREATE POLICY installer ON atlas_history.${table} TO ${identifier(role)} USING(true) WITH CHECK(true)`);
  await client.query('INSERT INTO atlas_history.schema_version VALUES(1,$1,$2)',[Buffer.from(digest(sql),'hex'),Buffer.from(await structureHash(client,'atlas_history'),'hex')]);
  await verifyHistory(client);await migrateHistory(client);return {state:'INITIALIZED',version:2};
});}
export async function grantHistoryReader(client,role){identifier(role);return transaction(client,async()=>{
  await lock(client);await owner(client);const version=await verifyHistory(client);await safeRole(client,role);
  if((await client.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1',[role])).rows[0]?.access_mode!=='reader')fail('HISTORY_READER_REQUIRED');
  const prior=(await client.query('SELECT 1 FROM atlas_history.reader_grant WHERE role_name=$1',[role])).rowCount;
  if(!prior){await client.query(`GRANT USAGE ON SCHEMA atlas_history TO ${identifier(role)}`);
    for(const table of allTables(version)){await client.query(`GRANT SELECT ON atlas_history.${table} TO ${identifier(role)}`);await client.query(`CREATE POLICY ${identifier('app_'+digest(role).slice(0,12)+'_s_'+table)} ON atlas_history.${table} FOR SELECT TO ${identifier(role)} USING(true)`);}
    await client.query('INSERT INTO atlas_history.reader_grant VALUES($1)',[role]);}
  await readerPrivileges(client,role);await verifyHistory(client);return {state:prior?'UNCHANGED':'GRANTED',access:'reader'};
});}
const hashProjection=p=>digest(canonical(p));
export async function importHistory(client,registry,snapshots){
  validateSupplyHistory(snapshots,registry);if(!snapshots.length)fail('HISTORY_INVALID');
  return transaction(client,async()=>{await lock(client);const version=await requireImporter(client);if(version>=3)return importDaily(client,registry,snapshots);if(version!==2)fail('HISTORY_UPGRADE_REQUIRED');let inserted=0,unchanged=0;
    for(const p of snapshots){
      const coin=(await client.query('SELECT id,symbol FROM atlas_market.coin WHERE code=$1',[p.coinId])).rows[0];
      if(!coin||coin.symbol!==registry.coins.find(c=>c.id===p.coinId)?.symbol)fail('HISTORY_IDENTITY_MISMATCH');
      for(const network of p.networks){const expected=registry.networks.find(n=>n.id===network.networkId),actual=(await client.query('SELECT family,network_identity FROM atlas_market.network WHERE code=$1',[network.networkId])).rows[0];if(!actual||actual.family!==expected?.family||actual.network_identity!==expected.networkId)fail('HISTORY_IDENTITY_MISMATCH');}
      const old=(await client.query("SELECT projection,encode(content_hash,'hex') AS hash FROM atlas_history.snapshot WHERE coin_id=$1 AND source_hash=$2 AND window_to=$3::date AND metric=$4",[coin.id,Buffer.from(p.sourceHash,'hex'),p.to,p.metric])).rows[0];
      if(old){validateSupplyHistory([old.projection],registry);const {fetchedAt:ignored,...original}=old.projection,{fetchedAt:alsoIgnored,...incoming}=p;if(old.hash!==hashProjection(old.projection)||canonical(original)!==canonical(incoming))fail('HISTORY_CONTENT_CONFLICT');unchanged++;continue;}
      await client.query('INSERT INTO atlas_history.snapshot(coin_id,source_hash,window_to,fetched_at,projection,content_hash,metric) VALUES($1,$2,$3,$4,$5,$6,$7)',[coin.id,Buffer.from(p.sourceHash,'hex'),p.to,p.fetchedAt,JSON.stringify(p),Buffer.from(hashProjection(p),'hex'),p.metric]);inserted++;
    }return {state:'IMPORTED',inserted,unchanged};
  });
}
// Same read-only repeatable-read snapshot as market facts. Schema absence alone means no history.
export async function readHistory(client,registry){
  if(!await exists(client))return [];
  await runtimeRole(client);await verifyRuntimeAccess(client);
  if((await client.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=current_user')).rows[0]?.access_mode!=='reader')fail('HISTORY_READER_REQUIRED');
  const role=(await client.query('SELECT current_user AS name')).rows[0].name;await readerPrivileges(client,role);const version=await verifyHistory(client);
  if(!(await client.query('SELECT 1 FROM atlas_history.reader_grant WHERE role_name=current_user')).rowCount)fail('HISTORY_ACCESS_DENIED');
  if(version>=3)return readDaily(client,registry);
  const rows=(await client.query(`SELECT DISTINCT ON (s.coin_id${version===2?',s.metric':''}) c.code,${version===2?'s.metric':"'NETWORK_CIRCULATING'"} AS metric,payload.projection,encode(s.content_hash,'hex') AS hash,encode(s.source_hash,'hex') AS source,
    to_char(s.window_to,'YYYY-MM-DD') AS window_to,to_char(s.fetched_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS fetched
    FROM atlas_history.snapshot s JOIN atlas_market.coin c ON c.id=s.coin_id CROSS JOIN LATERAL (SELECT s.projection)payload
    ORDER BY s.coin_id${version===2?',s.metric':''},s.fetched_at DESC,s.source_hash DESC,s.window_to DESC LIMIT 7`)).rows;
  if(rows.length>6)fail('HISTORY_RESPONSE_LIMIT');
  const snapshots=rows.map(r=>{if(r.hash!==hashProjection(r.projection)||r.projection.coinId!==r.code||r.projection.metric!==r.metric||r.projection.sourceHash!==r.source||r.projection.to!==r.window_to||r.projection.fetchedAt!==r.fetched)fail('HISTORY_CONTENT_CONFLICT');return r.projection;});
  return validateSupplyHistory(snapshots,registry);
}

export async function verifyHistoryWriter(client){return transaction(client,()=>requireImporter(client));}

async function writerPrivileges(client,role){
 await safeRole(client,role);
 const schema=(await client.query("SELECT has_schema_privilege($1,'atlas_history','USAGE') AS usage,has_schema_privilege($1,'atlas_history','CREATE') AS create",[role])).rows[0];if(!schema.usage||schema.create)fail('HISTORY_ACCESS_DENIED');
 const rows=(await client.query(`SELECT c.relname,a.attname,has_table_privilege($1,c.oid,'SELECT') AS readable,has_table_privilege($1,c.oid,'INSERT') AS insert,
 has_table_privilege($1,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS unsafe,has_column_privilege($1,c.oid,a.attnum,'INSERT') AS column_insert,
 has_column_privilege($1,c.oid,a.attnum,'UPDATE') AS column_update,has_column_privilege($1,c.oid,a.attnum,'REFERENCES') AS reference
 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_history'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,[role])).rows;
 if(!rows.length||rows.some(r=>!r.readable||r.unsafe||r.reference||r.insert!==insertTables.includes(r.relname)||r.column_insert!==insertTables.includes(r.relname)||r.column_update!==(updateColumns[r.relname]??[]).includes(r.attname)))fail('HISTORY_PRIVILEGES_UNSAFE');
 if((await client.query("SELECT 1 FROM pg_proc WHERE pronamespace='atlas_history'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",[role])).rowCount)fail('HISTORY_PRIVILEGES_UNSAFE');
}
async function requireImporter(client){
 await verifySchema(client);
 const isOwner=(await client.query("SELECT current_user=session_user AND current_user=pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='atlas_market'")).rows[0]?.owner;
 if(isOwner){await owner(client);return verifyHistory(client);}
 await runtimeRole(client);await verifyRuntimeAccess(client,true);
 if(!(await client.query("SELECT has_schema_privilege(current_user,'atlas_history','USAGE') AS allowed")).rows[0].allowed)fail('DATABASE_OWNER_REQUIRED');
 const version=await verifyHistory(client);
 if((await client.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=current_user')).rows[0]?.access_mode!=='writer')fail('HISTORY_WRITER_REQUIRED');
 if(version<3)fail('HISTORY_UPGRADE_REQUIRED');
 const role=(await client.query('SELECT current_user AS name')).rows[0].name;await writerPrivileges(client,role);
 if(!(await client.query('SELECT 1 FROM atlas_history.writer_grant WHERE role_name=current_user')).rowCount)fail('HISTORY_ACCESS_DENIED');return version;
}
export async function requireHistoryRuntime(client){
 await runtimeRole(client);const version=await requireImporter(client);if(version<3)fail('HISTORY_UPGRADE_REQUIRED');return version;
}
export async function grantHistoryWriter(client,role){identifier(role);return transaction(client,async()=>{
 await lock(client);await owner(client);if(await verifyHistory(client)<3)fail('HISTORY_UPGRADE_REQUIRED');await safeRole(client,role);
 if((await client.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1',[role])).rows[0]?.access_mode!=='writer')fail('HISTORY_WRITER_REQUIRED');
 const prior=(await client.query('SELECT 1 FROM atlas_history.writer_grant WHERE role_name=$1',[role])).rowCount;
 if(!prior){await client.query(`GRANT USAGE ON SCHEMA atlas_history TO ${identifier(role)}`);
  for(const table of allTables(3)){
   await client.query(`GRANT SELECT ON atlas_history.${table} TO ${identifier(role)}`);await client.query(`CREATE POLICY ${identifier('app_'+digest(role).slice(0,12)+'_s_'+table)} ON atlas_history.${table} FOR SELECT TO ${identifier(role)} USING(true)`);
   if(insertTables.includes(table)){await client.query(`GRANT INSERT ON atlas_history.${table} TO ${identifier(role)}`);await client.query(`CREATE POLICY ${identifier('app_'+digest(role).slice(0,12)+'_i_'+table)} ON atlas_history.${table} FOR INSERT TO ${identifier(role)} WITH CHECK(true)`);}
   if(updateColumns[table]){await client.query(`GRANT UPDATE(${updateColumns[table].join(',')}) ON atlas_history.${table} TO ${identifier(role)}`);await client.query(`CREATE POLICY ${identifier('app_'+digest(role).slice(0,12)+'_u_'+table)} ON atlas_history.${table} FOR UPDATE TO ${identifier(role)} USING(true) WITH CHECK(true)`);}
  }await client.query('INSERT INTO atlas_history.writer_grant VALUES($1)',[role]);
 }if((await client.query("SELECT to_regnamespace('atlas_scheduler') IS NOT NULL AS present")).rows[0].present){await grantSchedulerRead(client,role);await verifySchedulerSchema(client);}await writerPrivileges(client,role);await verifyHistory(client);return {state:prior?'UNCHANGED':'GRANTED',access:'writer'};
});}
export async function normalizeHistory(client,registry){return transaction(client,async()=>{
 await lock(client);await owner(client);const version=await verifyHistory(client);if(version>=3)return {state:'UNCHANGED',version};if(version!==2)fail('HISTORY_UPGRADE_REQUIRED');
 const sources=(await client.query("SELECT projection,encode(content_hash,'hex') AS hash FROM atlas_history.snapshot ORDER BY fetched_at,source_hash,coin_id,metric LIMIT 10001")).rows;if(sources.length>10000)fail('HISTORY_RESPONSE_LIMIT');
 for(const s of sources){validateSupplyHistory([s.projection],registry);if(hashProjection(s.projection)!==s.hash)fail('HISTORY_CONTENT_CONFLICT');}
 const sql=await readFile(thirdMigration);await client.query(sql.toString('utf8'));const role=(await client.query('SELECT current_user AS name')).rows[0].name;
 for(const table of extraTables)await client.query(`CREATE POLICY installer ON atlas_history.${table} TO ${identifier(role)} USING(true) WITH CHECK(true)`);
 for(const reader of (await client.query('SELECT role_name FROM atlas_history.reader_grant')).rows)for(const table of extraTables){await client.query(`GRANT SELECT ON atlas_history.${table} TO ${identifier(reader.role_name)}`);await client.query(`CREATE POLICY ${identifier('app_'+digest(reader.role_name).slice(0,12)+'_s_'+table)} ON atlas_history.${table} FOR SELECT TO ${identifier(reader.role_name)} USING(true)`);}
 for(const s of sources)await importDaily(client,registry,[s.projection]);
 await client.query('INSERT INTO atlas_history.schema_version VALUES(3,$1,$2)',[Buffer.from(digest(sql),'hex'),Buffer.from(await structureHash(client,'atlas_history'),'hex')]);await verifyHistory(client);await verifySchema(client);return {state:'NORMALIZED',version:3,legacySnapshots:sources.length};
});}

// Explicit owner migration for the user-approved 24-hour schedule. Never resets reservations.
export async function enableContinuousHistory(client){return transaction(client,async()=>{
 await lock(client);await owner(client);const version=await verifyHistory(client);
 if(version===4)return {state:'UNCHANGED',version};if(version!==3)fail('HISTORY_UPGRADE_REQUIRED');
 if(!(await client.query('SELECT pg_try_advisory_xact_lock(18471234,405) AS locked')).rows[0].locked)fail('SCHEDULER_LOCKED');
 await client.query('SELECT pg_advisory_xact_lock(18471234,404)');
 const day=(await client.query("SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD') AS day")).rows[0].day;
 const previous=(await client.query("SELECT budget FROM atlas_history.scheduler_day WHERE job='ARKHAM' AND day=$1::date",[day])).rows[0]?.budget??null;
 if(previous!==null&&![12,288].includes(previous))fail('SCHEDULER_BUDGET_MISMATCH');
 const sql=await readFile(fourthMigration);await client.query(sql.toString('utf8'));
 await client.query('INSERT INTO atlas_history.schema_version VALUES(4,$1,$2)',[Buffer.from(digest(sql),'hex'),Buffer.from(await structureHash(client,'atlas_history'),'hex')]);
 await verifyHistory(client);await verifySchema(client);return {state:'UPGRADED',version:4,day,previousBudget:previous,budget:288};
});}

// Separate, explicit owner operation. Never edits existing day/run records.
export async function upgradeScheduler(client){return transaction(client,async()=>{
 await lock(client);await owner(client);const version=await verifyHistory(client);
 if(await verifySchedulerSchema(client,{required:false}))return {state:'UNCHANGED',version:1};if(version!==4)fail('HISTORY_UPGRADE_REQUIRED');
 await schedulerOwnerLocks(client);
 const originalHash=await structureHash(client,'atlas_history');
 const sql=await readFile(new URL('../../db/scheduler/001-configurable-schedule.sql',import.meta.url));await client.query(sql.toString('utf8'));
 const role=(await client.query('SELECT current_user AS name')).rows[0].name;
 for(const table of ['schema_version','arkham_policy'])await client.query(`CREATE POLICY installer ON atlas_scheduler.${table} TO ${identifier(role)} USING(true) WITH CHECK(true)`);
 for(const r of (await client.query('SELECT role_name FROM atlas_history.writer_grant')).rows)await grantSchedulerRead(client,r.role_name);
 const historyHash=await structureHash(client,'atlas_history');
 await client.query('UPDATE atlas_history.schema_version SET structure_hash=$1 WHERE version=4',[Buffer.from(historyHash,'hex')]);
 await client.query('INSERT INTO atlas_scheduler.schema_version VALUES(1,$1,$2,$3,$4)',[Buffer.from(digest(sql),'hex'),Buffer.from(await structureHash(client,'atlas_scheduler'),'hex'),Buffer.from(originalHash,'hex'),Buffer.from(historyHash,'hex')]);
 await verifyHistory(client);await verifySchedulerSchema(client);await verifySchema(client);return {state:'UPGRADED',version:1};
});}

async function schedulerOwnerLocks(client){
 if(!(await client.query('SELECT pg_try_advisory_xact_lock(18471234,405) AS locked')).rows[0].locked)fail('SCHEDULER_LOCKED');
 await client.query('SELECT pg_advisory_xact_lock(18471234,404)');
 if((await client.query("SELECT 1 FROM atlas_history.scheduler_run WHERE job='ARKHAM' AND state='CLAIMED' LIMIT 1")).rowCount)fail('SCHEDULER_RECONCILE_REQUIRED');
}
export async function configureScheduler(client,{effectiveDay,schedule}){
 if(typeof effectiveDay!=='string'||!/^\d{4}-\d\d-\d\d$/.test(effectiveDay)||!Number.isFinite(Date.parse(effectiveDay))||new Date(effectiveDay).toISOString().slice(0,10)!==effectiveDay||!schedule?.dailyRunLimit)fail('SCHEDULER_CONFIG_INVALID');
 const {arkhamSchedule}=await import('../arkham-schedule.mjs');schedule=arkhamSchedule({interval:schedule.interval,dailyRunLimit:schedule.dailyRunLimit});
 return transaction(client,async()=>{
  await lock(client);await owner(client);if(await verifyHistory(client)!==4)fail('HISTORY_UPGRADE_REQUIRED');await verifySchedulerSchema(client);await schedulerOwnerLocks(client);
  const today=(await client.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day")).rows[0].day;
  if(effectiveDay<=today)fail('SCHEDULER_POLICY_CONFLICT');
  const prior=(await client.query("SELECT interval_ms,budget FROM atlas_scheduler.arkham_policy WHERE effective_day=$1::date",[effectiveDay])).rows[0];
  if(prior){if(prior.interval_ms!==schedule.intervalMs||prior.budget!==schedule.dailyRunLimit)fail('SCHEDULER_POLICY_CONFLICT');return {state:'UNCHANGED',effectiveDay,schedule};}
  if((await client.query("SELECT 1 FROM atlas_scheduler.arkham_policy WHERE effective_day>$1::date UNION ALL SELECT 1 FROM atlas_history.scheduler_day WHERE job='ARKHAM' AND day>=$1::date LIMIT 1",[effectiveDay])).rowCount)fail('SCHEDULER_POLICY_CONFLICT');
  await client.query('INSERT INTO atlas_scheduler.arkham_policy(effective_day,interval_ms,budget) VALUES($1,$2,$3)',[effectiveDay,schedule.intervalMs,schedule.dailyRunLimit]);
  return {state:'CONFIGURED',effectiveDay,schedule};
 });
}
