import {readFile} from 'node:fs/promises';
import {transaction,runtimeRole,safeRole} from './connection.mjs';
import {structureHash,verifySchema,verifyRuntimeAccess} from './schema.mjs';
import {canonical,digest,fail} from './plan.mjs';

const migration=new URL('../../db/registration/001-initial.sql',import.meta.url);
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
  if(rows.length!==1||rows[0].version!==1||rows[0].migration_hash!==digest(await readFile(migration))||rows[0].structure_hash!==await structureHash(client,'atlas_registration'))fail('REGISTRATION_DB_SCHEMA_MISMATCH');
  const ownerId=(await client.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_registration'")).rows[0].id;
  const roles=(await client.query('SELECT g.role_name,r.oid::text AS id FROM atlas_registration.reader_grant g JOIN pg_roles r ON r.rolname=g.role_name ORDER BY g.role_name')).rows;
  const expected=[];for(const table of tables){
    expected.push({table,name:'installer',command:'*',id:ownerId,using:'true',check:'true'});
    for(const r of roles)expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_s_'+table,command:'r',id:r.id,using:'true',check:null});
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
  if(await exists(client)){await verifyRegistration(client);return {state:'UNCHANGED',version:1};}
  const sql=await readFile(migration);await client.query(sql.toString('utf8'));
  const role=(await client.query('SELECT current_user AS role')).rows[0].role;
  for(const table of tables)await client.query(`CREATE POLICY installer ON atlas_registration.${table} TO ${identifier(role)} USING(true) WITH CHECK(true)`);
  await client.query('INSERT INTO atlas_registration.schema_version VALUES(1,$1,$2)',[Buffer.from(digest(sql),'hex'),Buffer.from(await structureHash(client,'atlas_registration'),'hex')]);
  await verifyRegistration(client);await verifySchema(client);return {state:'INITIALIZED',version:1};
});}
export async function grantRegistrationReader(client,role){identifier(role);return transaction(client,async()=>{
  await lock(client);await owner(client);await verifyRegistration(client);await safeRole(client,role);
  const grant=(await client.query("SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1",[role])).rows[0];
  if(grant?.access_mode!=='reader')fail('REGISTRATION_DB_READER_REQUIRED');
  const prior=(await client.query('SELECT 1 FROM atlas_registration.reader_grant WHERE role_name=$1',[role])).rowCount;
  if(!prior){
    await client.query(`GRANT USAGE ON SCHEMA atlas_registration TO ${identifier(role)}`);
    for(const table of tables){await client.query(`GRANT SELECT ON atlas_registration.${table} TO ${identifier(role)}`);await client.query(`CREATE POLICY ${identifier('app_'+digest(role).slice(0,12)+'_s_'+table)} ON atlas_registration.${table} FOR SELECT TO ${identifier(role)} USING(true)`);}
    await client.query('INSERT INTO atlas_registration.reader_grant VALUES($1)',[role]);
  }
  await readerPrivileges(client,role);await verifyRegistration(client);return {state:prior?'UNCHANGED':'GRANTED',access:'reader'};
});}

export {verifyRegistration,owner,readerPrivileges,lock};
