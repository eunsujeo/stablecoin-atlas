import {readFile} from 'node:fs/promises';
import {transaction,runtimeRole,safeRole} from './connection.mjs';
import {structureHash,verifySchema,verifyRuntimeAccess} from './schema.mjs';
import {canonical,digest,fail} from './plan.mjs';
import {validateTokenProfiles} from '../../web/token-profile-model.js';
const migration=new URL('../../db/catalog/001-initial.sql',import.meta.url);
const tables=['schema_version','reader_grant','token_profile'];
const identifier=value=>{if(typeof value!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(value))fail('INVALID_IDENTIFIER');return '"'+value+'"';};
const exists=async client=>(await client.query("SELECT to_regnamespace('atlas_catalog') IS NOT NULL AS present")).rows[0].present;
const lock=client=>client.query('SELECT pg_advisory_xact_lock(18471234,402)');
async function owner(client){
  await verifySchema(client);
  const {rows:[r]}=await client.query("SELECT current_user=session_user AND current_user=pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='atlas_market'");
  if(!r?.owner)fail('DATABASE_OWNER_REQUIRED');
  if(await exists(client)){
    const {rows:[c]}=await client.query("SELECT current_user=pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='atlas_catalog'");
    if(!c?.owner)fail('DATABASE_OWNER_REQUIRED');
  }
}
async function verifyCatalog(client){
  const {rows}=await client.query("SELECT version,encode(migration_hash,'hex') AS migration_hash,encode(structure_hash,'hex') AS structure_hash FROM atlas_catalog.schema_version");
  if(rows.length!==1||rows[0].version!==1||rows[0].migration_hash!==digest(await readFile(migration))||rows[0].structure_hash!==await structureHash(client,'atlas_catalog'))fail('CATALOG_SCHEMA_MISMATCH');
  const ownerId=(await client.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_catalog'")).rows[0].id;
  const roles=(await client.query('SELECT g.role_name,r.oid::text AS id FROM atlas_catalog.reader_grant g JOIN pg_roles r ON r.rolname=g.role_name ORDER BY g.role_name')).rows;
  const expected=[];for(const table of tables){
    expected.push({table,name:'installer',command:'*',id:ownerId,using:'true',check:'true'});
    for(const r of roles)expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_s_'+table,command:'r',id:r.id,using:'true',check:null});
  }
  const actual=(await client.query(`SELECT c.relname AS table,p.polname AS name,p.polcmd::text AS command,array_to_string(p.polroles,',') AS id,
    pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
    WHERE c.relnamespace='atlas_catalog'::regnamespace AND p.polpermissive`)).rows;
  const sort=rows=>rows.sort((a,b)=>(a.table+':'+a.name).localeCompare(b.table+':'+b.name));
  if(canonical(sort(actual))!==canonical(sort(expected)))fail('CATALOG_POLICIES_UNSAFE');
  const bad=(await client.query("SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_catalog'::regnamespace AND NOT p.polpermissive")).rowCount;
  if(bad)fail('CATALOG_POLICIES_UNSAFE');
  if((await client.query("SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='atlas_catalog'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'O'")).rowCount)fail('CATALOG_SCHEMA_MISMATCH');
  const publicAcl=(await client.query(`SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='atlas_catalog' AND a.grantee=0
    UNION ALL SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='atlas_catalog'::regnamespace AND a.grantee=0
    UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='atlas_catalog'::regnamespace AND a.grantee=0`)).rowCount;
  if(publicAcl)fail('CATALOG_PRIVILEGES_UNSAFE');
  const exposed=(await client.query(`SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role') AND (
    has_schema_privilege(r.oid,'atlas_catalog','USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='atlas_catalog'::regnamespace AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
    OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='atlas_catalog'::regnamespace AND has_function_privilege(r.oid,p.oid,'EXECUTE')))`)).rowCount;
  if(exposed)fail('CATALOG_PRIVILEGES_UNSAFE');
  const configured=(await client.query("SELECT current_setting('pgrst.db_schemas',true) AS schemas")).rows[0].schemas;
  if(configured?.split(',').some(s=>s.trim()==='atlas_catalog'))fail('CATALOG_PRIVILEGES_UNSAFE');
}
async function readerPrivileges(client,role){
  await safeRole(client,role);
  const {rows:[schema]}=await client.query("SELECT has_schema_privilege($1,'atlas_catalog','USAGE') AS usage,has_schema_privilege($1,'atlas_catalog','CREATE') AS create",[role]);
  if(!schema.usage||schema.create)fail('CATALOG_ACCESS_DENIED');
  const rows=(await client.query(`SELECT has_table_privilege($1,c.oid,'SELECT') AS readable,has_table_privilege($1,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS mutation,
    has_column_privilege($1,c.oid,a.attnum,'INSERT,UPDATE,REFERENCES') AS column_mutation FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE c.relnamespace='atlas_catalog'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,[role])).rows;
  if(!rows.length||rows.some(r=>!r.readable||r.mutation||r.column_mutation))fail('CATALOG_PRIVILEGES_UNSAFE');
  if((await client.query("SELECT 1 FROM pg_proc WHERE pronamespace='atlas_catalog'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",[role])).rowCount)fail('CATALOG_PRIVILEGES_UNSAFE');
}
export async function initializeCatalog(client){return transaction(client,async()=>{
  await lock(client);await owner(client);
  if(await exists(client)){await verifyCatalog(client);return {state:'UNCHANGED',version:1};}
  const sql=await readFile(migration);await client.query(sql.toString('utf8'));
  const role=(await client.query('SELECT current_user AS role')).rows[0].role;
  for(const table of tables)await client.query(`CREATE POLICY installer ON atlas_catalog.${table} TO ${identifier(role)} USING(true) WITH CHECK(true)`);
  await client.query('INSERT INTO atlas_catalog.schema_version VALUES(1,$1,$2)',[Buffer.from(digest(sql),'hex'),Buffer.from(await structureHash(client,'atlas_catalog'),'hex')]);
  await verifyCatalog(client);await verifySchema(client);return {state:'INITIALIZED',version:1};
});}
export async function grantCatalogReader(client,role){identifier(role);return transaction(client,async()=>{
  await lock(client);await owner(client);await verifyCatalog(client);await safeRole(client,role);
  const grant=(await client.query("SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1",[role])).rows[0];
  if(grant?.access_mode!=='reader')fail('CATALOG_READER_REQUIRED');
  const prior=(await client.query('SELECT 1 FROM atlas_catalog.reader_grant WHERE role_name=$1',[role])).rowCount;
  if(!prior){
    await client.query(`GRANT USAGE ON SCHEMA atlas_catalog TO ${identifier(role)}`);
    for(const table of tables){await client.query(`GRANT SELECT ON atlas_catalog.${table} TO ${identifier(role)}`);await client.query(`CREATE POLICY ${identifier('app_'+digest(role).slice(0,12)+'_s_'+table)} ON atlas_catalog.${table} FOR SELECT TO ${identifier(role)} USING(true)`);}
    await client.query('INSERT INTO atlas_catalog.reader_grant VALUES($1)',[role]);
  }
  await readerPrivileges(client,role);await verifyCatalog(client);return {state:prior?'UNCHANGED':'GRANTED',access:'reader'};
});}
export async function importCatalog(client,registry,profiles){
  validateTokenProfiles(profiles,registry);
  return transaction(client,async()=>{
    await lock(client);await owner(client);await verifyCatalog(client);let inserted=0,unchanged=0;
    for(const p of profiles){
      const d=registry.deployments.find(d=>d.id===p.deploymentId),n=registry.networks.find(n=>n.id===d.networkId),c=registry.coins.find(c=>c.id===d.coinId);
      const binding=(await client.query(`SELECT d.id,d.identity_display,c.code AS coin,n.code AS network,n.family,n.network_identity FROM atlas_market.deployment d
        JOIN atlas_market.coin c ON c.id=d.coin_id JOIN atlas_market.network n ON n.id=d.network_id WHERE d.code=$1`,[d.id])).rows[0];
      if(!binding||binding.coin!==c.id||binding.network!==n.id||binding.family!==n.family||binding.network_identity!==n.networkId||canonical(binding.identity_display)!==canonical(d.identity))fail('CATALOG_IDENTITY_MISMATCH');
      const hash=digest(canonical(p)),old=(await client.query(`SELECT revision,standard,asset_description,network_description,identity_snapshot,sources,to_char(reviewed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS reviewed_at,encode(content_hash,'hex') AS hash FROM atlas_catalog.token_profile WHERE deployment_id=$1 AND revision=$2`,[binding.id,p.revision])).rows[0];
      if(old){const original={deploymentId:p.deploymentId,revision:old.revision,standard:old.standard,assetDescription:old.asset_description,networkDescription:old.network_description,identity:old.identity_snapshot,sources:old.sources,reviewedAt:old.reviewed_at};if(old.hash!==hash||digest(canonical(original))!==hash)fail('CATALOG_CONTENT_CONFLICT');unchanged++;continue;}
      const latest=(await client.query('SELECT revision,reviewed_at FROM atlas_catalog.token_profile WHERE deployment_id=$1 ORDER BY revision DESC LIMIT 1',[binding.id])).rows[0];
      if(latest&&(p.revision<=latest.revision||Date.parse(p.reviewedAt)<Date.parse(latest.reviewed_at)))fail('CATALOG_REVISION_INVALID');
      await client.query(`INSERT INTO atlas_catalog.token_profile(deployment_id,revision,standard,asset_description,network_description,identity_snapshot,sources,reviewed_at,content_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[binding.id,p.revision,p.standard,p.assetDescription,p.networkDescription,p.identity,JSON.stringify(p.sources),p.reviewedAt,Buffer.from(hash,'hex')]);inserted++;
    }
    return {state:'IMPORTED',profiles:inserted,unchanged};
  });
}
// Called inside the market reader's existing repeatable-read, read-only transaction.
export async function readCatalog(client,registry){
  if(!await exists(client))return [];
  await runtimeRole(client);await verifyRuntimeAccess(client);
  if((await client.query("SELECT access_mode FROM atlas_market.access_grant WHERE role_name=current_user")).rows[0]?.access_mode!=='reader')fail('CATALOG_READER_REQUIRED');
  const {rows:[role]}=await client.query('SELECT current_user AS name');
  await readerPrivileges(client,role.name);await verifyCatalog(client);
  if(!(await client.query('SELECT 1 FROM atlas_catalog.reader_grant WHERE role_name=current_user')).rowCount)fail('CATALOG_ACCESS_DENIED');
  const {rows}=await client.query(`SELECT DISTINCT ON (p.deployment_id) d.code AS "deploymentId",p.revision,p.standard,p.asset_description AS "assetDescription",p.network_description AS "networkDescription",
    p.identity_snapshot AS identity,p.sources,to_char(p.reviewed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "reviewedAt",encode(p.content_hash,'hex') AS hash,d.identity_display AS binding
    FROM atlas_catalog.token_profile p JOIN atlas_market.deployment d ON d.id=p.deployment_id ORDER BY p.deployment_id,p.revision DESC LIMIT 257`);
  if(rows.length>256)fail('CATALOG_RESPONSE_LIMIT');
  const profiles=rows.map(({hash,binding,...p})=>{if(canonical(p.identity)!==canonical(binding)||digest(canonical(p))!==hash)fail('CATALOG_CONTENT_CONFLICT');return p;});
  return validateTokenProfiles(profiles,registry);
}
