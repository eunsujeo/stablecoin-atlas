import {readFile} from 'node:fs/promises';
import {transaction,runtimeRole,safeRole} from './connection.mjs';
import {structureHash,verifySchema,verifyRuntimeAccess} from './schema.mjs';
import {canonical,digest,fail} from './plan.mjs';

const migration=new URL('../../db/registration/001-initial.sql',import.meta.url);
const extraMigration=new URL('../../db/registration/002-daily-collection.sql',import.meta.url);
const extraTables=['writer_grant','collection_run','collection_result'];
const insertTables=new Set(['coverage','daily_value','daily_source','collection_run','collection_result']);
const tables=['schema_version','reader_grant','metadata_revision','selection','coverage','daily_value','daily_source'];
const identifier=value=>{if(typeof value!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(value))fail('INVALID_IDENTIFIER');return '"'+value+'"';};
const exists=async client=>(await client.query("SELECT to_regnamespace('atlas_registration') IS NOT NULL AS present")).rows[0].present;
const lock=client=>client.query('SELECT pg_advisory_xact_lock(18471234,406)');
async function owner(client){
  await verifySchema(client);
  const {rows:[r]}=await client.query("SELECT current_user=session_user AND current_user=pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='atlas_market'");
  if(!r?.owner)fail('DATABASE_OWNER_REQUIRED');
  if(await exists(client)){
    const {rows:[c]}=await client.query("SELECT current_user=pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='atlas_registration'");
    if(!c?.owner)fail('DATABASE_OWNER_REQUIRED');
  }
}
async function verifyRegistration(client){
  const {rows}=await client.query("SELECT version,encode(migration_hash,'hex') AS migration_hash,encode(structure_hash,'hex') AS structure_hash FROM atlas_registration.schema_version");
  const version=rows.length===2?2:1,latest=rows.find(r=>r.version===version);
  if(rows.length!==version||rows.find(r=>r.version===1)?.migration_hash!==digest(await readFile(migration))||!latest||version===2&&latest.migration_hash!==digest(await readFile(extraMigration))||latest.structure_hash!==await structureHash(client,'atlas_registration'))fail('REGISTRATION_DB_SCHEMA_MISMATCH');
  const ownerId=(await client.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_registration'")).rows[0].id;
  const roles=(await client.query('SELECT g.role_name,r.oid::text AS id FROM atlas_registration.reader_grant g JOIN pg_roles r ON r.rolname=g.role_name ORDER BY g.role_name')).rows;
  const writers=version===2?(await client.query('SELECT g.role_name,r.oid::text AS id FROM atlas_registration.writer_grant g JOIN pg_roles r ON r.rolname=g.role_name ORDER BY g.role_name')).rows:[];
  const expected=[];for(const table of [...tables,...(version===2?extraTables:[])]){
    expected.push({table,name:'installer',command:'*',id:ownerId,using:'true',check:'true'});
    for(const r of [...roles,...writers])expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_s_'+table,command:'r',id:r.id,using:'true',check:null});
    if(insertTables.has(table))for(const r of writers)expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_i_'+table,command:'a',id:r.id,using:null,check:'true'});
  }
  const actual=(await client.query(`SELECT c.relname AS table,p.polname AS name,p.polcmd::text AS command,array_to_string(p.polroles,',') AS id,
    pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
    WHERE c.relnamespace='atlas_registration'::regnamespace AND p.polpermissive`)).rows;
  const sort=rows=>rows.sort((a,b)=>(a.table+':'+a.name).localeCompare(b.table+':'+b.name));
  if(canonical(sort(actual))!==canonical(sort(expected)))fail('REGISTRATION_DB_POLICIES_UNSAFE');
  const bad=(await client.query("SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_registration'::regnamespace AND NOT p.polpermissive")).rowCount;
  if(bad)fail('REGISTRATION_DB_POLICIES_UNSAFE');
  if((await client.query("SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='atlas_registration'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'O'")).rowCount)fail('REGISTRATION_DB_SCHEMA_MISMATCH');
  const publicAcl=(await client.query(`SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='atlas_registration' AND a.grantee=0
    UNION ALL SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='atlas_registration'::regnamespace AND a.grantee=0
    UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='atlas_registration'::regnamespace AND a.grantee=0`)).rowCount;
  if(publicAcl)fail('REGISTRATION_DB_PRIVILEGES_UNSAFE');
  const exposed=(await client.query(`SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role') AND (
    has_schema_privilege(r.oid,'atlas_registration','USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='atlas_registration'::regnamespace AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
    OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='atlas_registration'::regnamespace AND has_function_privilege(r.oid,p.oid,'EXECUTE')))`)).rowCount;
  if(exposed)fail('REGISTRATION_DB_PRIVILEGES_UNSAFE');
  const configured=(await client.query("SELECT current_setting('pgrst.db_schemas',true) AS schemas")).rows[0].schemas;
  if(configured?.split(',').some(s=>s.trim()==='atlas_registration'))fail('REGISTRATION_DB_PRIVILEGES_UNSAFE');
  return version;
}
async function readerPrivileges(client,role){
  await safeRole(client,role);
  const {rows:[schema]}=await client.query("SELECT has_schema_privilege($1,'atlas_registration','USAGE') AS usage,has_schema_privilege($1,'atlas_registration','CREATE') AS create",[role]);
  if(!schema.usage||schema.create)fail('REGISTRATION_DB_ACCESS_DENIED');
  const rows=(await client.query(`SELECT has_table_privilege($1,c.oid,'SELECT') AS readable,has_table_privilege($1,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS mutation,
    has_column_privilege($1,c.oid,a.attnum,'INSERT,UPDATE,REFERENCES') AS column_mutation FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE c.relnamespace='atlas_registration'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,[role])).rows;
  if(!rows.length||rows.some(r=>!r.readable||r.mutation||r.column_mutation))fail('REGISTRATION_DB_PRIVILEGES_UNSAFE');
  if((await client.query("SELECT 1 FROM pg_proc WHERE pronamespace='atlas_registration'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",[role])).rowCount)fail('REGISTRATION_DB_PRIVILEGES_UNSAFE');
}
export async function initializeRegistration(client){return transaction(client,async()=>{
  await lock(client);await owner(client);
  if(await exists(client)){const version=await verifyRegistration(client);return {state:'UNCHANGED',version};}
  const sql=await readFile(migration);await client.query(sql.toString('utf8'));
  const role=(await client.query('SELECT current_user AS role')).rows[0].role;
  for(const table of tables)await client.query(`CREATE POLICY installer ON atlas_registration.${table} TO ${identifier(role)} USING(true) WITH CHECK(true)`);
  await client.query('INSERT INTO atlas_registration.schema_version VALUES(1,$1,$2)',[Buffer.from(digest(sql),'hex'),Buffer.from(await structureHash(client,'atlas_registration'),'hex')]);
  await verifyRegistration(client);await verifySchema(client);return {state:'INITIALIZED',version:1};
});}
export async function grantRegistrationReader(client,role){identifier(role);return transaction(client,async()=>{
  await lock(client);await owner(client);const version=await verifyRegistration(client);await safeRole(client,role);
  const grant=(await client.query("SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1",[role])).rows[0];
  if(grant?.access_mode!=='reader')fail('REGISTRATION_DB_READER_REQUIRED');
  const prior=(await client.query('SELECT 1 FROM atlas_registration.reader_grant WHERE role_name=$1',[role])).rowCount;
  if(!prior){
    await client.query(`GRANT USAGE ON SCHEMA atlas_registration TO ${identifier(role)}`);
    for(const table of [...tables,...(version===2?extraTables:[])]){await client.query(`GRANT SELECT ON atlas_registration.${table} TO ${identifier(role)}`);await client.query(`CREATE POLICY ${identifier('app_'+digest(role).slice(0,12)+'_s_'+table)} ON atlas_registration.${table} FOR SELECT TO ${identifier(role)} USING(true)`);}
    await client.query('INSERT INTO atlas_registration.reader_grant VALUES($1)',[role]);
  }
  await readerPrivileges(client,role);await verifyRegistration(client);return {state:prior?'UNCHANGED':'GRANTED',access:'reader'};
});}

export {verifyRegistration,owner,readerPrivileges,lock};

export async function upgradeRegistration(client){return transaction(client,async()=>{
 await lock(client);await owner(client);const version=await verifyRegistration(client);
 if(version===2)return {state:'UNCHANGED',version};
 await client.query((await readFile(extraMigration)).toString('utf8'));
 const role=(await client.query('SELECT current_user AS role')).rows[0].role;
 const readers=(await client.query('SELECT role_name FROM atlas_registration.reader_grant')).rows;
 for(const table of extraTables){
  await client.query(`CREATE POLICY installer ON atlas_registration.${table} TO ${identifier(role)} USING(true) WITH CHECK(true)`);
  for(const r of readers){await client.query(`GRANT SELECT ON atlas_registration.${table} TO ${identifier(r.role_name)}`);await client.query(`CREATE POLICY ${identifier('app_'+digest(r.role_name).slice(0,12)+'_s_'+table)} ON atlas_registration.${table} FOR SELECT TO ${identifier(r.role_name)} USING(true)`);}
 }
 await client.query('INSERT INTO atlas_registration.schema_version VALUES(2,$1,$2)',[Buffer.from(digest(await readFile(extraMigration)),'hex'),Buffer.from(await structureHash(client,'atlas_registration'),'hex')]);
 await verifyRegistration(client);for(const r of readers)await readerPrivileges(client,r.role_name);
 return {state:'UPGRADED',version:2};
});}
async function writerPrivileges(client,role){
 await safeRole(client,role);
 const schema=(await client.query("SELECT has_schema_privilege($1,'atlas_registration','USAGE') AS usage,has_schema_privilege($1,'atlas_registration','CREATE') AS create",[role])).rows[0];
 if(!schema.usage||schema.create)fail('REGISTRATION_DB_ACCESS_DENIED');
 const rows=(await client.query(`SELECT c.relname,has_table_privilege($1,c.oid,'SELECT') AS readable,has_table_privilege($1,c.oid,'INSERT') AS insert,
 has_table_privilege($1,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS other,
 has_column_privilege($1,c.oid,a.attnum,'INSERT') AS column_insert,has_column_privilege($1,c.oid,a.attnum,'UPDATE,REFERENCES') AS column_other
 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_registration'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,[role])).rows;
 if(!rows.length||rows.some(r=>!r.readable||r.other||r.column_other||r.insert!==insertTables.has(r.relname)||r.column_insert!==insertTables.has(r.relname)))fail('REGISTRATION_DB_PRIVILEGES_UNSAFE');
 if((await client.query("SELECT 1 FROM pg_proc WHERE pronamespace='atlas_registration'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",[role])).rowCount)fail('REGISTRATION_DB_PRIVILEGES_UNSAFE');
}
export async function requireRegistrationWriter(client){
 await runtimeRole(client);await verifyRuntimeAccess(client);
 if(await verifyRegistration(client)!==2)fail('REGISTRATION_DB_UPGRADE_REQUIRED');
 if(!(await client.query('SELECT 1 FROM atlas_registration.writer_grant WHERE role_name=current_user')).rowCount)fail('REGISTRATION_DB_WRITER_REQUIRED');
 const role=(await client.query('SELECT current_user AS role')).rows[0].role;await writerPrivileges(client,role);
}
export async function grantRegistrationWriter(client,role){identifier(role);return transaction(client,async()=>{
 await lock(client);await owner(client);if(await verifyRegistration(client)!==2)fail('REGISTRATION_DB_UPGRADE_REQUIRED');await safeRole(client,role);
 if((await client.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1',[role])).rows[0]?.access_mode!=='writer')fail('REGISTRATION_DB_WRITER_REQUIRED');
 const prior=(await client.query('SELECT 1 FROM atlas_registration.writer_grant WHERE role_name=$1',[role])).rowCount;
 if(!prior){
  await client.query(`GRANT USAGE ON SCHEMA atlas_registration TO ${identifier(role)}`);
  for(const table of [...tables,...extraTables]){
   await client.query(`GRANT SELECT ON atlas_registration.${table} TO ${identifier(role)}`);
   await client.query(`CREATE POLICY ${identifier('app_'+digest(role).slice(0,12)+'_s_'+table)} ON atlas_registration.${table} FOR SELECT TO ${identifier(role)} USING(true)`);
   if(insertTables.has(table)){
    await client.query(`GRANT INSERT ON atlas_registration.${table} TO ${identifier(role)}`);
    await client.query(`CREATE POLICY ${identifier('app_'+digest(role).slice(0,12)+'_i_'+table)} ON atlas_registration.${table} FOR INSERT TO ${identifier(role)} WITH CHECK(true)`);
   }
  }
  await client.query('INSERT INTO atlas_registration.writer_grant VALUES($1)',[role]);
 }
 await writerPrivileges(client,role);await verifyRegistration(client);return {state:prior?'UNCHANGED':'GRANTED',access:'writer'};
});}
