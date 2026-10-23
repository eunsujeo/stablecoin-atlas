import {readFile} from 'node:fs/promises';
import {transaction,safeRole,runtimeRole} from './connection.mjs';
import {verifySchema,verifyRuntimeAccess,structureHash} from './schema.mjs';
import {canonical,instant} from './plan.mjs';
import {activitySource,activityHash,activityMapper,validateActivityValues} from '../activity-source.mjs';
import {archiveSources} from './files.mjs';
import {validateActivity} from '../../web/activity-model.js';
const migration=new URL('../../db/activity/001-initial.sql',import.meta.url),tables=['schema_version','access_grant','source','daily_value'];
const fail=()=>{throw Error('ACTIVITY_DATABASE_INVALID');};
const ident=s=>{if(typeof s!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(s))fail();return '"'+s+'"';};
const lock=c=>c.query('SELECT pg_advisory_xact_lock(18471234,410)');
const hashBytes=s=>Buffer.from(s,'hex');
async function owner(c){await verifySchema(c);if(!(await c.query("SELECT current_user=session_user AND current_user=pg_get_userbyid(nspowner) AS ok FROM pg_namespace WHERE nspname='atlas_market'")).rows[0]?.ok)fail();}
async function privileges(c,role,mode){
 await safeRole(c,role);
 const schema=(await c.query("SELECT has_schema_privilege($1,'atlas_activity','USAGE') AS usage,has_schema_privilege($1,'atlas_activity','CREATE') AS create",[role])).rows[0];if(!schema.usage||schema.create)fail();
 const rows=(await c.query(`SELECT c.relname,has_table_privilege($1,c.oid,'SELECT') AS read,has_table_privilege($1,c.oid,'INSERT') AS insert,
 has_table_privilege($1,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS other,
 has_column_privilege($1,c.oid,a.attnum,'INSERT') AS column_insert,has_column_privilege($1,c.oid,a.attnum,'UPDATE,REFERENCES') AS column_other
 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_activity'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,[role])).rows;
 if(!rows.length||rows.some(r=>!r.read||r.other||r.column_other||r.insert!==(mode==='writer'&&['source','daily_value'].includes(r.relname))||r.column_insert!==r.insert))fail();
 if((await c.query("SELECT 1 FROM pg_proc WHERE pronamespace='atlas_activity'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",[role])).rowCount)fail();
}
export async function verifyActivitySchema(c){
 const rows=(await c.query("SELECT version,encode(migration_hash,'hex') AS migration,encode(structure_hash,'hex') AS structure FROM atlas_activity.schema_version")).rows;
 if(rows.length!==1||rows[0].version!==1||rows[0].migration!==activityHash(await readFile(migration))||rows[0].structure!==await structureHash(c,'atlas_activity'))fail();
 const owner=(await c.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_activity'")).rows[0].id;
 const grants=(await c.query('SELECT g.role_name,g.access_mode,r.oid::text AS id FROM atlas_activity.access_grant g JOIN pg_roles r ON r.rolname=g.role_name')).rows;
 const expected=[];for(const table of tables){expected.push({table,name:'installer',command:'*',roles:owner,using:'true',check:'true'});for(const g of grants){const prefix='app_'+activityHash(g.role_name).slice(0,12);expected.push({table,name:prefix+'_s_'+table,command:'r',roles:g.id,using:'true',check:null});if(g.access_mode==='writer'&&['source','daily_value'].includes(table))expected.push({table,name:prefix+'_i_'+table,command:'a',roles:g.id,using:null,check:'true'});}}
 const actual=(await c.query(`SELECT c.relname AS table,p.polname AS name,p.polcmd::text AS command,array_to_string(p.polroles,',') AS roles,pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_activity'::regnamespace AND p.polpermissive`)).rows;
 const sorted=rs=>rs.sort((a,b)=>(a.table+':'+a.name).localeCompare(b.table+':'+b.name));if(canonical(sorted(actual))!==canonical(sorted(expected)))fail();
 if((await c.query("SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_activity'::regnamespace AND NOT p.polpermissive")).rowCount)fail();
 if((await c.query("SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='atlas_activity'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'O'")).rowCount)fail();
 const publicAcl=(await c.query(`SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='atlas_activity' AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='atlas_activity'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='atlas_activity'::regnamespace AND a.grantee=0`)).rowCount;if(publicAcl)fail();
 const exposed=(await c.query(`SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role') AND (has_schema_privilege(r.oid,'atlas_activity','USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='atlas_activity'::regnamespace AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='atlas_activity'::regnamespace AND has_function_privilege(r.oid,p.oid,'EXECUTE')))`)).rowCount;if(exposed)fail();
 const schemas=(await c.query("SELECT current_setting('pgrst.db_schemas',true) AS schemas")).rows[0].schemas;if(schemas?.split(',').some(s=>s.trim()==='atlas_activity'))fail();
 for(const g of grants)await privileges(c,g.role_name,g.access_mode);
}
async function access(c,write=false){await runtimeRole(c);await verifySchema(c);await verifyRuntimeAccess(c,write);await verifyActivitySchema(c);const g=(await c.query('SELECT access_mode FROM atlas_activity.access_grant WHERE role_name=current_user')).rows[0];if(!g||write&&g.access_mode!=='writer')fail();}
export async function initializeActivity(c){return transaction(c,async()=>{await lock(c);await owner(c);
 if((await c.query("SELECT to_regnamespace('atlas_activity') IS NOT NULL AS present")).rows[0].present){if(!(await c.query("SELECT current_user=pg_get_userbyid(nspowner) AS ok FROM pg_namespace WHERE nspname='atlas_activity'")).rows[0]?.ok)fail();await verifyActivitySchema(c);return {state:'UNCHANGED',version:1};}
 const sql=await readFile(migration);await c.query(sql.toString());const role=(await c.query('SELECT current_user AS role')).rows[0].role;
 for(const table of tables)await c.query(`CREATE POLICY installer ON atlas_activity.${table} TO ${ident(role)} USING(true) WITH CHECK(true)`);
 await c.query('INSERT INTO atlas_activity.schema_version VALUES(1,$1,$2)',[hashBytes(activityHash(sql)),hashBytes(await structureHash(c,'atlas_activity'))]);await verifyActivitySchema(c);return {state:'INITIALIZED',version:1};
});}
export async function grantActivity(c,role,mode){ident(role);if(!['reader','writer'].includes(mode))fail();return transaction(c,async()=>{await lock(c);await owner(c);await verifyActivitySchema(c);await safeRole(c,role);
 if((await c.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1',[role])).rows[0]?.access_mode!==mode)fail();
 const prior=(await c.query('SELECT access_mode FROM atlas_activity.access_grant WHERE role_name=$1',[role])).rows[0];if(prior){if(prior.access_mode!==mode)fail();return {state:'UNCHANGED',access:mode};}
 await c.query(`GRANT USAGE ON SCHEMA atlas_activity TO ${ident(role)}`);for(const table of tables){const prefix='app_'+activityHash(role).slice(0,12);await c.query(`GRANT SELECT ON atlas_activity.${table} TO ${ident(role)}`);await c.query(`CREATE POLICY ${ident(prefix+'_s_'+table)} ON atlas_activity.${table} FOR SELECT TO ${ident(role)} USING(true)`);if(mode==='writer'&&['source','daily_value'].includes(table)){await c.query(`GRANT INSERT ON atlas_activity.${table} TO ${ident(role)}`);await c.query(`CREATE POLICY ${ident(prefix+'_i_'+table)} ON atlas_activity.${table} FOR INSERT TO ${ident(role)} WITH CHECK(true)`);}}
 await c.query('INSERT INTO atlas_activity.access_grant VALUES($1,$2)',[role,mode]);await verifyActivitySchema(c);return {state:'GRANTED',access:mode};
});}
export async function importActivity(c,bytes,options){const source=activitySource(bytes,options);return transaction(c,async()=>{await lock(c);await access(c,true);
 const prior=(await c.query("SELECT encode(id,'hex') AS id FROM atlas_activity.source WHERE source_hash=$1 AND mapper=$2",[hashBytes(source.sourceHash),activityMapper])).rows[0];if(prior){if(prior.id!==source.id)fail();return {state:'UNCHANGED',rows:0,sourceHash:source.sourceHash};}
 for(const r of source.rows){const conflict=await c.query(`SELECT 1 FROM atlas_activity.daily_value v JOIN atlas_activity.source s ON s.id=v.source_id WHERE v.coin=$1 AND v.network='ethereum' AND v.observed_day=$2 AND s.queried_at=$3 AND v.value_hash<>$4 LIMIT 1`,[r.coinId,r.day,source.queriedAt,hashBytes(r.valueHash)]);if(conflict.rowCount)throw Error('ACTIVITY_TIMESTAMP_CONFLICT');}
 if(options.archiveRoot)await archiveSources([{hash:source.sourceHash,bytes}],options.archiveRoot);
 await c.query('INSERT INTO atlas_activity.source(id,source_hash,mapper,provider,queried_at,window_from,window_to,rows_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[hashBytes(source.id),hashBytes(source.sourceHash),source.mapper,source.provider,source.queriedAt,source.from,source.to,hashBytes(source.rowsHash)]);
 for(const r of source.rows)await c.query('INSERT INTO atlas_activity.daily_value VALUES($1,$2,$3,$4,$5,$6)',[hashBytes(source.id),r.coinId,r.networkId,r.day,JSON.stringify(r.values),hashBytes(r.valueHash)]);
 return {state:'IMPORTED',rows:source.rows.length,sourceHash:source.sourceHash};
});}
export async function readActivity(c){return transaction(c,async()=>{await access(c);
 const rows=(await c.query(`WITH latest AS (SELECT DISTINCT ON(v.coin,v.network,v.observed_day) v.coin,v.network,v.observed_day,v.payload,encode(v.value_hash,'hex') AS value_hash,
 encode(s.id,'hex') AS source_id,encode(s.source_hash,'hex') AS source_hash,s.mapper,s.provider,to_char(s.queried_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS queried_at,
 to_char(s.window_from,'YYYY-MM-DD') AS window_from,to_char(s.window_to,'YYYY-MM-DD') AS window_to,encode(s.rows_hash,'hex') AS rows_hash
 FROM atlas_activity.daily_value v JOIN atlas_activity.source s ON s.id=v.source_id ORDER BY v.coin,v.network,v.observed_day,s.queried_at DESC,s.id DESC), ranked AS(SELECT *,row_number() OVER(PARTITION BY coin ORDER BY observed_day DESC) AS rank FROM latest)
 SELECT *,to_char(observed_day,'YYYY-MM-DD') AS day FROM ranked WHERE rank<=31 ORDER BY coin,observed_day`)).rows;
 const groups=new Map();for(const r of rows){validateActivityValues(r.payload);const meta={provider:r.provider,mapper:r.mapper,sourceHash:r.source_hash,queriedAt:instant(r.queried_at),from:r.window_from,to:r.window_to,rowsHash:r.rows_hash};if(activityHash(meta)!==r.source_id||r.mapper!==activityMapper||r.provider!=='ALLIUM'||r.day<r.window_from||r.day>r.window_to||activityHash({coinId:r.coin,networkId:r.network,day:r.day,values:r.payload})!==r.value_hash)fail();
 if(!groups.has(r.coin))groups.set(r.coin,{coinId:r.coin,networkId:r.network,points:[]});groups.get(r.coin).points.push({day:r.day,...r.payload,queriedAt:r.queried_at,sourceHash:r.source_hash});}
 return validateActivity({schemaVersion:1,kind:'DAILY_TRANSFERS',provider:'ALLIUM',metric:'TRANSFER_VOLUME',networkId:'ethereum',dateBasis:'PROVIDER_DAY',state:rows.length?'AVAILABLE':'MISSING',series:[...groups.values()]});
},{repeatableRead:true});}
