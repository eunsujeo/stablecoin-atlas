// Frozen reader/verification functions from 533281237c83c8517757b38d569d260d80faa491.
// Only relative import paths were relocated; no scheduler-aware checks are added.
import {importDaily,readDaily} from '../../tools/market-db/daily-history.mjs';
import {readFile} from 'node:fs/promises';
import {transaction,runtimeRole,safeRole} from '../../tools/market-db/connection.mjs';
import {structureHash,verifySchema,verifyRuntimeAccess} from '../../tools/market-db/schema.mjs';
import {canonical,digest,fail} from '../../tools/market-db/plan.mjs';
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
const exists=async client=>(await client.query("SELECT to_regnamespace('atlas_history') IS NOT NULL AS present")).rows[0].present;
async function verifyHistory(client){
  const {rows}=await client.query("SELECT version,encode(migration_hash,'hex') AS migration_hash,encode(structure_hash,'hex') AS structure_hash FROM atlas_history.schema_version ORDER BY version");
  const version=rows.at(-1)?.version;
  if(![1,2,3,4].includes(version)||rows.length!==version)fail('HISTORY_SCHEMA_MISMATCH');
  for(const [i,file]of [migration,secondMigration,thirdMigration,fourthMigration].slice(0,version).entries())if(rows[i].version!==i+1||rows[i].migration_hash!==digest(await readFile(file)))fail('HISTORY_SCHEMA_MISMATCH');
  if(rows.at(-1).structure_hash!==await structureHash(client,'atlas_history'))fail('HISTORY_SCHEMA_MISMATCH');
  const ownerId=(await client.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_history'")).rows[0].id;
  const roles=(await client.query('SELECT g.role_name,r.oid::text AS id FROM atlas_history.reader_grant g JOIN pg_roles r ON r.rolname=g.role_name ORDER BY g.role_name')).rows;
  const writers=version>=3?(await client.query('SELECT g.role_name,r.oid::text AS id FROM atlas_history.writer_grant g JOIN pg_roles r ON r.rolname=g.role_name ORDER BY g.role_name')).rows:[];
  const expected=[];for(const table of allTables(version)){
    expected.push({table,name:'installer',command:'*',id:ownerId,using:'true',check:'true'});
    for(const r of [...roles,...writers])expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_s_'+table,command:'r',id:r.id,using:'true',check:null});
    for(const r of writers){if(insertTables.includes(table))expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_i_'+table,command:'a',id:r.id,using:null,check:'true'});if(updateColumns[table])expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_u_'+table,command:'w',id:r.id,using:'true',check:'true'});}
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
