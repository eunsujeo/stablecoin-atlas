import {parsePriceBytes} from '../provider-price-review.mjs';
import {verifySupplyApiBoundary} from './supply-api-boundary.mjs';
import {readFile} from 'node:fs/promises';
import {transaction,safeRole,runtimeRole} from './connection.mjs';
import {verifySchema,verifyRuntimeAccess,structureHash} from './schema.mjs';
import {canonical,digest} from './plan.mjs';
import {validateNetworkUsage,networkUsageByteLimit} from '../../web/network-usage-model.js';
const migration=new URL('../../db/network-usage/001-initial.sql',import.meta.url),tables=['schema_version','access_grant','snapshot'];
// Pinned from the committed DDL in a newly owned PG17 fixture.
export const networkUsageStructure='5a19f99626ccd958de1357795eb4fed2327b4fad30644b34e7e6cd06a449d905';
const expansionMigration=new URL('../../db/network-usage/002-expanded.sql',import.meta.url);
export const networkUsageExpandedStructure='152b5e259f323e594dbfd52bf3208d9f0bb9ecf59c600f2a1b5a953a47b42f99';
const fail=()=>{throw Error('NETWORK_USAGE_DATABASE_INVALID');};
const ident=s=>{if(typeof s!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(s))fail();return '"'+s+'"';};
const lock=c=>c.query('SELECT pg_advisory_xact_lock(18471234,415)');
const hashBytes=s=>Buffer.from(s,'hex');
async function owner(c){await verifySchema(c);if(!(await c.query("SELECT current_user=session_user AND current_user=pg_get_userbyid(nspowner) AS ok FROM pg_namespace WHERE nspname='atlas_market'")).rows[0]?.ok)fail();}
async function privileges(c,role,mode){
 await safeRole(c,role);
 const schema=(await c.query("SELECT has_schema_privilege($1,'atlas_network_usage','USAGE') AS usage,has_schema_privilege($1,'atlas_network_usage','CREATE') AS create",[role])).rows[0];if(!schema.usage||schema.create)fail();
 const rows=(await c.query(`SELECT c.relname,has_table_privilege($1,c.oid,'SELECT') AS read,has_table_privilege($1,c.oid,'INSERT') AS insert,
 has_table_privilege($1,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS other,
 has_column_privilege($1,c.oid,a.attnum,'INSERT') AS column_insert,has_column_privilege($1,c.oid,a.attnum,'UPDATE,REFERENCES') AS column_other
 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_network_usage'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,[role])).rows;
 if(!rows.length||rows.some(r=>!r.read||r.other||r.column_other||r.insert!==(mode==='writer'&&['snapshot','snapshot_v2','collection_day'].includes(r.relname))||r.column_insert!==r.insert))fail();
 if((await c.query("SELECT 1 FROM pg_proc WHERE pronamespace='atlas_network_usage'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",[role])).rowCount)fail();
}
export async function verifyNetworkUsageSchema(c){
 const rows=(await c.query("SELECT version,encode(migration_hash,'hex') AS migration,encode(structure_hash,'hex') AS structure FROM atlas_network_usage.schema_version")).rows;
 if(rows.length!==1||rows[0].version!==1||rows[0].migration!==digest(await readFile(migration))||rows[0].structure!==networkUsageStructure)fail();
 const expanded=(await c.query("SELECT to_regclass('atlas_network_usage.upgrade_version') IS NOT NULL AS present")).rows[0].present;
 const version=expanded?2:1,tables=expanded?['schema_version','access_grant','snapshot','upgrade_version','snapshot_v2','collection_day']:['schema_version','access_grant','snapshot'];
 if(expanded){const v=(await c.query("SELECT version,encode(migration_hash,'hex') AS migration,encode(structure_hash,'hex') AS structure FROM atlas_network_usage.upgrade_version")).rows;if(v.length!==1||v[0].version!==2||v[0].migration!==digest(await readFile(expansionMigration))||v[0].structure!==networkUsageExpandedStructure)fail();}
 if(await structureHash(c,'atlas_network_usage')!==(expanded?networkUsageExpandedStructure:networkUsageStructure))fail();
 const owner=(await c.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_network_usage'")).rows[0].id;
 const grants=(await c.query('SELECT g.role_name,g.access_mode,r.oid::text AS id FROM atlas_network_usage.access_grant g JOIN pg_roles r ON r.rolname=g.role_name')).rows;
 const expected=[];for(const table of tables){expected.push({table,name:'installer',command:'*',roles:owner,using:'true',check:'true'});for(const g of grants){const prefix='app_'+digest(g.role_name).slice(0,12);expected.push({table,name:prefix+'_s_'+table,command:'r',roles:g.id,using:'true',check:null});if(g.access_mode==='writer'&&['snapshot','snapshot_v2','collection_day'].includes(table))expected.push({table,name:prefix+'_i_'+table,command:'a',roles:g.id,using:null,check:'true'});}}
 const actual=(await c.query(`SELECT c.relname AS table,p.polname AS name,p.polcmd::text AS command,array_to_string(p.polroles,',') AS roles,pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_network_usage'::regnamespace AND p.polpermissive`)).rows;
 const sorted=rs=>rs.sort((a,b)=>(a.table+':'+a.name).localeCompare(b.table+':'+b.name));if(canonical(sorted(actual))!==canonical(sorted(expected)))fail();
 if((await c.query("SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_network_usage'::regnamespace AND NOT p.polpermissive")).rowCount)fail();
 if((await c.query("SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='atlas_network_usage'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'O'")).rowCount)fail();
 const publicAcl=(await c.query(`SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='atlas_network_usage' AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='atlas_network_usage'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_attribute col JOIN pg_class c ON c.oid=col.attrelid CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE c.relnamespace='atlas_network_usage'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='atlas_network_usage'::regnamespace AND a.grantee=0`)).rowCount;if(publicAcl)fail();
 const exposed=(await c.query(`SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role') AND (has_schema_privilege(r.oid,'atlas_network_usage','USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='atlas_network_usage'::regnamespace AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_network_usage'::regnamespace AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(r.oid,c.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')) OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='atlas_network_usage'::regnamespace AND has_function_privilege(r.oid,p.oid,'EXECUTE')))`)).rowCount;if(exposed)fail();
 const schemas=(await c.query("SELECT current_setting('pgrst.db_schemas',true) AS schemas")).rows[0].schemas;if(schemas?.split(',').some(s=>s.trim()==='atlas_network_usage'))fail();
 for(const g of grants)await privileges(c,g.role_name,g.access_mode);
 return version;
}
async function access(c,write=false){
 await runtimeRole(c);await verifySchema(c);await verifyRuntimeAccess(c,write);const version=await verifyNetworkUsageSchema(c);
 const g=(await c.query('SELECT access_mode FROM atlas_network_usage.access_grant WHERE role_name=current_user')).rows[0];
 if(!g||write&&g.access_mode!=='writer'||!write&&g.access_mode!=='reader')fail();return version;
}
export async function initializeNetworkUsage(c,{reviewedDefiners=[]}={}){return transaction(c,async()=>{
 await lock(c);await owner(c);
 if((await c.query("SELECT to_regnamespace('atlas_network_usage') IS NOT NULL AS present")).rows[0].present){
  if(!(await c.query("SELECT current_user=pg_get_userbyid(nspowner) AS ok FROM pg_namespace WHERE nspname='atlas_network_usage'")).rows[0]?.ok)fail();
  await verifyNetworkUsageSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_network_usage',reviewedDefiners});return {state:'UNCHANGED',version:1};
 }
 const sql=await readFile(migration);await c.query(sql.toString());const role=(await c.query('SELECT current_user AS role')).rows[0].role;
 for(const table of tables)await c.query(`CREATE POLICY installer ON atlas_network_usage.${table} TO ${ident(role)} USING(true) WITH CHECK(true)`);
 if(await structureHash(c,'atlas_network_usage')!==networkUsageStructure)fail();
 await c.query('INSERT INTO atlas_network_usage.schema_version VALUES(1,$1,$2)',[hashBytes(digest(sql)),hashBytes(networkUsageStructure)]);
 await verifyNetworkUsageSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_network_usage',reviewedDefiners});return {state:'INITIALIZED',version:1};
});}
export function reviewedNetworkUsageImport(bytes,expectedHash){
 if(!Buffer.isBuffer(bytes)||bytes.length>networkUsageByteLimit||!(/^[a-f0-9]{64}$/.test(expectedHash))||digest(bytes)!==expectedHash)throw Error('NETWORK_USAGE_INPUT_HASH_MISMATCH');
 parsePriceBytes(bytes);return validateNetworkUsage(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
export async function importNetworkUsage(c,bytes,expectedHash,{reviewedDefiners=[]}={}){
 const snapshot=reviewedNetworkUsageImport(bytes,expectedHash),hash=digest(canonical(snapshot));
 return transaction(c,async()=>{
  await lock(c);const version=await access(c,true);if(snapshot.schemaVersion===2&&version!==2)fail();const table=snapshot.schemaVersion===2?'snapshot_v2':'snapshot';await verifySupplyApiBoundary(c,{schema:'atlas_network_usage',reviewedDefiners});
  const old=(await c.query(`SELECT encode(payload_hash,'hex') AS hash,payload FROM atlas_network_usage.${table} WHERE snapshot_id=$1`,[snapshot.id])).rows[0];
  if(old){if(old.hash!==hash||canonical(old.payload)!==canonical(snapshot))throw Error('NETWORK_USAGE_ID_CONFLICT');return {state:'UNCHANGED',inserted:0,rows:snapshot.rows.length,inputHash:expectedHash};}
  await c.query(`INSERT INTO atlas_network_usage.${table}(snapshot_id,window_end,queried_at,row_count,payload_hash,payload) VALUES($1,$2,$3,$4,$5,$6)`,[snapshot.id,snapshot.window.untilExclusive,snapshot.rows.map(r=>r.queriedAt).sort().at(-1),snapshot.rows.length,hashBytes(hash),JSON.stringify(snapshot)]);
  await verifySupplyApiBoundary(c,{schema:'atlas_network_usage',reviewedDefiners});
  return {state:'IMPORTED',inserted:1,rows:snapshot.rows.length,inputHash:expectedHash};
 });
}
export async function readNetworkUsage(c){return transaction(c,async()=>{
 const version=await access(c),source=version===2?'(SELECT * FROM atlas_network_usage.snapshot UNION ALL SELECT * FROM atlas_network_usage.snapshot_v2)':'atlas_network_usage.snapshot';
 const r=(await c.query(`SELECT snapshot_id,to_char(window_end,'YYYY-MM-DD') AS window_end,to_char(queried_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS queried_at,row_count,encode(payload_hash,'hex') AS hash,payload FROM ${source} s ORDER BY window_end DESC,(payload->>'schemaVersion')::int DESC,queried_at DESC,imported_at DESC,snapshot_id DESC LIMIT 1`)).rows[0];
 if(!r)throw Error('NETWORK_USAGE_NOT_AVAILABLE');const p=validateNetworkUsage(r.payload);
 if(p.id!==r.snapshot_id||p.window.untilExclusive!==r.window_end||p.rows.length!==r.row_count||p.rows.map(v=>v.queriedAt).sort().at(-1)!==r.queried_at||digest(canonical(p))!==r.hash)fail();return p;
},{repeatableRead:true});}
export async function grantNetworkUsage(c,role,mode,{reviewedDefiners=[]}={}){ident(role);if(!['reader','writer'].includes(mode))fail();return transaction(c,async()=>{await lock(c);await owner(c);const version=await verifyNetworkUsageSchema(c),tables=version===2?['schema_version','access_grant','snapshot','upgrade_version','snapshot_v2','collection_day']:['schema_version','access_grant','snapshot'];await verifySupplyApiBoundary(c,{schema:'atlas_network_usage',reviewedDefiners});await safeRole(c,role);
 if((await c.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1',[role])).rows[0]?.access_mode!==mode)fail();
 const prior=(await c.query('SELECT access_mode FROM atlas_network_usage.access_grant WHERE role_name=$1',[role])).rows[0];if(prior){if(prior.access_mode!==mode)fail();return {state:'UNCHANGED',access:mode};}
 await c.query(`GRANT USAGE ON SCHEMA atlas_network_usage TO ${ident(role)}`);for(const table of tables){const prefix='app_'+digest(role).slice(0,12);await c.query(`GRANT SELECT ON atlas_network_usage.${table} TO ${ident(role)}`);await c.query(`CREATE POLICY ${ident(prefix+'_s_'+table)} ON atlas_network_usage.${table} FOR SELECT TO ${ident(role)} USING(true)`);if(mode==='writer'&&['snapshot','snapshot_v2','collection_day'].includes(table)){await c.query(`GRANT INSERT ON atlas_network_usage.${table} TO ${ident(role)}`);await c.query(`CREATE POLICY ${ident(prefix+'_i_'+table)} ON atlas_network_usage.${table} FOR INSERT TO ${ident(role)} WITH CHECK(true)`);}}
 await c.query('INSERT INTO atlas_network_usage.access_grant VALUES($1,$2)',[role,mode]);await verifyNetworkUsageSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_network_usage',reviewedDefiners});return {state:'GRANTED',access:mode};
});}

export async function upgradeNetworkUsage(c,{reviewedDefiners=[]}={}){return transaction(c,async()=>{
 await lock(c);await owner(c);
 if(!(await c.query("SELECT current_user=pg_get_userbyid(nspowner) AS ok FROM pg_namespace WHERE nspname='atlas_network_usage'")).rows[0]?.ok)fail();
 if(await verifyNetworkUsageSchema(c)===2)return {state:'UNCHANGED',version:2};
 await verifySupplyApiBoundary(c,{schema:'atlas_network_usage',reviewedDefiners});
 const sql=await readFile(expansionMigration);await c.query(sql.toString());const role=(await c.query('SELECT current_user AS role')).rows[0].role;
 const grants=(await c.query('SELECT role_name,access_mode FROM atlas_network_usage.access_grant')).rows;
 for(const table of ['upgrade_version','snapshot_v2','collection_day']){
  await c.query(`CREATE POLICY installer ON atlas_network_usage.${table} TO ${ident(role)} USING(true) WITH CHECK(true)`);
  for(const g of grants){const prefix='app_'+digest(g.role_name).slice(0,12);await c.query(`GRANT SELECT ON atlas_network_usage.${table} TO ${ident(g.role_name)}`);await c.query(`CREATE POLICY ${ident(prefix+'_s_'+table)} ON atlas_network_usage.${table} FOR SELECT TO ${ident(g.role_name)} USING(true)`);if(g.access_mode==='writer'&&['snapshot_v2','collection_day'].includes(table)){await c.query(`GRANT INSERT ON atlas_network_usage.${table} TO ${ident(g.role_name)}`);await c.query(`CREATE POLICY ${ident(prefix+'_i_'+table)} ON atlas_network_usage.${table} FOR INSERT TO ${ident(g.role_name)} WITH CHECK(true)`);}}
 }
 if(await structureHash(c,'atlas_network_usage')!==networkUsageExpandedStructure)fail();
 await c.query('INSERT INTO atlas_network_usage.upgrade_version VALUES(2,$1,$2)',[hashBytes(digest(sql)),hashBytes(networkUsageExpandedStructure)]);
 await verifyNetworkUsageSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_network_usage',reviewedDefiners});return {state:'UPGRADED',version:2};
});}

export async function claimNetworkUsageDay(c,{day,planHash,ownerId},{reviewedDefiners=[]}={}){
 if(!/^\d{4}-\d\d-\d\d$/.test(day)||new Date(day).toISOString().slice(0,10)!==day||!/^[a-f0-9]{64}$/.test(planHash)||!/^[a-f0-9-]{36}$/.test(ownerId))fail();
 return transaction(c,async()=>{await lock(c);if(await access(c,true)!==2)fail();await verifySupplyApiBoundary(c,{schema:'atlas_network_usage',reviewedDefiners});
 const actual=(await c.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day")).rows[0].day;if(day!==actual)throw Error('NETWORK_USAGE_DAY_NOT_CURRENT');
 const r=await c.query("INSERT INTO atlas_network_usage.collection_day(day,plan_hash,owner_id) SELECT $1::date,$2,$3::uuid WHERE $1::date=(clock_timestamp() AT TIME ZONE 'UTC')::date ON CONFLICT(day) DO NOTHING RETURNING owner_id",[day,hashBytes(planHash),ownerId]);return {state:r.rowCount?'CLAIMED':'ALREADY_CLAIMED',day};
 });
}
