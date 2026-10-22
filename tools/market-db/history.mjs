import {readFile} from 'node:fs/promises';
import {transaction,runtimeRole,safeRole} from './connection.mjs';
import {structureHash,verifySchema,verifyRuntimeAccess} from './schema.mjs';
import {canonical,digest,fail} from './plan.mjs';
import {validateSupplyHistory} from '../../web/supply-history-model.js';
const migration=new URL('../../db/history/001-initial.sql',import.meta.url);
const secondMigration=new URL('../../db/history/002-supply-metric.sql',import.meta.url);
const tables=['schema_version','reader_grant','snapshot'];
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
  if(![1,2].includes(version)||rows.length!==version||rows[0].version!==1||rows[0].migration_hash!==digest(await readFile(migration))||version===2&&(rows[1].migration_hash!==digest(await readFile(secondMigration))||rows[1].version!==2)||rows.at(-1).structure_hash!==await structureHash(client,'atlas_history'))fail('HISTORY_SCHEMA_MISMATCH');
  const ownerId=(await client.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_history'")).rows[0].id;
  const roles=(await client.query('SELECT g.role_name,r.oid::text AS id FROM atlas_history.reader_grant g JOIN pg_roles r ON r.rolname=g.role_name ORDER BY g.role_name')).rows;
  const expected=[];for(const table of tables){
    expected.push({table,name:'installer',command:'*',id:ownerId,using:'true',check:'true'});
    for(const r of roles)expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_s_'+table,command:'r',id:r.id,using:'true',check:null});
  }
  const actual=(await client.query(`SELECT c.relname AS table,p.polname AS name,p.polcmd::text AS command,array_to_string(p.polroles,',') AS id,
    pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
    WHERE c.relnamespace='atlas_history'::regnamespace AND p.polpermissive`)).rows;
  const sort=rows=>rows.sort((a,b)=>(a.table+':'+a.name).localeCompare(b.table+':'+b.name));
  if(canonical(sort(actual))!==canonical(sort(expected)))fail('HISTORY_POLICIES_UNSAFE');
  const bad=(await client.query("SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_history'::regnamespace AND NOT p.polpermissive")).rowCount;
  if(bad)fail('HISTORY_POLICIES_UNSAFE');
  if((await client.query("SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='atlas_history'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'O'")).rowCount)fail('HISTORY_SCHEMA_MISMATCH');
  const publicAcl=(await client.query(`SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='atlas_history' AND a.grantee=0
    UNION ALL SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='atlas_history'::regnamespace AND a.grantee=0
    UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='atlas_history'::regnamespace AND a.grantee=0`)).rowCount;
  if(publicAcl)fail('HISTORY_PRIVILEGES_UNSAFE');
  const exposed=(await client.query(`SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role') AND (
    has_schema_privilege(r.oid,'atlas_history','USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='atlas_history'::regnamespace AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
    OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='atlas_history'::regnamespace AND has_function_privilege(r.oid,p.oid,'EXECUTE')))`)).rowCount;
  if(exposed)fail('HISTORY_PRIVILEGES_UNSAFE');
  const configured=(await client.query("SELECT current_setting('pgrst.db_schemas',true) AS schemas")).rows[0].schemas;
  if(configured?.split(',').some(s=>s.trim()==='atlas_history'))fail('HISTORY_PRIVILEGES_UNSAFE');
  return version;
}
async function readerPrivileges(client,role){
  await safeRole(client,role);
  const {rows:[schema]}=await client.query("SELECT has_schema_privilege($1,'atlas_history','USAGE') AS usage,has_schema_privilege($1,'atlas_history','CREATE') AS create",[role]);
  if(!schema.usage||schema.create)fail('HISTORY_ACCESS_DENIED');
  const rows=(await client.query(`SELECT has_table_privilege($1,c.oid,'SELECT') AS readable,has_table_privilege($1,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS mutation,
    has_column_privilege($1,c.oid,a.attnum,'INSERT,UPDATE,REFERENCES') AS column_mutation FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE c.relnamespace='atlas_history'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,[role])).rows;
  if(!rows.length||rows.some(r=>!r.readable||r.mutation||r.column_mutation))fail('HISTORY_PRIVILEGES_UNSAFE');
  if((await client.query("SELECT 1 FROM pg_proc WHERE pronamespace='atlas_history'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",[role])).rowCount)fail('HISTORY_PRIVILEGES_UNSAFE');
}
async function migrateHistory(client){
  const sql=await readFile(secondMigration);await client.query(sql.toString('utf8'));
  await client.query('INSERT INTO atlas_history.schema_version VALUES(2,$1,$2)',[Buffer.from(digest(sql),'hex'),Buffer.from(await structureHash(client,'atlas_history'),'hex')]);
  await verifyHistory(client);await verifySchema(client);
}
export async function upgradeHistory(client){return transaction(client,async()=>{
  await lock(client);await owner(client);const version=await verifyHistory(client);
  if(version===2)return {state:'UNCHANGED',version};await migrateHistory(client);return {state:'UPGRADED',version:2};
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
  await lock(client);await owner(client);await verifyHistory(client);await safeRole(client,role);
  if((await client.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1',[role])).rows[0]?.access_mode!=='reader')fail('HISTORY_READER_REQUIRED');
  const prior=(await client.query('SELECT 1 FROM atlas_history.reader_grant WHERE role_name=$1',[role])).rowCount;
  if(!prior){await client.query(`GRANT USAGE ON SCHEMA atlas_history TO ${identifier(role)}`);
    for(const table of tables){await client.query(`GRANT SELECT ON atlas_history.${table} TO ${identifier(role)}`);await client.query(`CREATE POLICY ${identifier('app_'+digest(role).slice(0,12)+'_s_'+table)} ON atlas_history.${table} FOR SELECT TO ${identifier(role)} USING(true)`);}
    await client.query('INSERT INTO atlas_history.reader_grant VALUES($1)',[role]);}
  await readerPrivileges(client,role);await verifyHistory(client);return {state:prior?'UNCHANGED':'GRANTED',access:'reader'};
});}
const hashProjection=p=>digest(canonical(p));
export async function importHistory(client,registry,snapshots){
  validateSupplyHistory(snapshots,registry);if(!snapshots.length)fail('HISTORY_INVALID');
  return transaction(client,async()=>{await lock(client);await owner(client);if(await verifyHistory(client)!==2)fail('HISTORY_UPGRADE_REQUIRED');let inserted=0,unchanged=0;
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
  const rows=(await client.query(`SELECT DISTINCT ON (s.coin_id${version===2?',s.metric':''}) c.code,${version===2?'s.metric':"'NETWORK_CIRCULATING'"} AS metric,payload.projection,encode(s.content_hash,'hex') AS hash,encode(s.source_hash,'hex') AS source,
    to_char(s.window_to,'YYYY-MM-DD') AS window_to,to_char(s.fetched_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS fetched
    FROM atlas_history.snapshot s JOIN atlas_market.coin c ON c.id=s.coin_id CROSS JOIN LATERAL (SELECT s.projection)payload
    ORDER BY s.coin_id${version===2?',s.metric':''},s.fetched_at DESC,s.source_hash DESC,s.window_to DESC LIMIT 7`)).rows;
  if(rows.length>6)fail('HISTORY_RESPONSE_LIMIT');
  const snapshots=rows.map(r=>{if(r.hash!==hashProjection(r.projection)||r.projection.coinId!==r.code||r.projection.metric!==r.metric||r.projection.sourceHash!==r.source||r.projection.to!==r.window_to||r.projection.fetchedAt!==r.fetched)fail('HISTORY_CONTENT_CONFLICT');return r.projection;});
  return validateSupplyHistory(snapshots,registry);
}

export async function verifyHistoryWriter(client){return transaction(client,async()=>{await owner(client);await verifyHistory(client);});}
