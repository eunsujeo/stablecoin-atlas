import {readFile} from 'node:fs/promises';
import {structureHash} from './schema.mjs';
import {digest,canonical,fail} from './plan.mjs';
const tables=['schema_version','arkham_policy'];
const identifier=name=>{if(!/^[a-z][a-z0-9_]{0,62}$/.test(name))fail('INVALID_IDENTIFIER');return '"'+name+'"';};
export async function grantSchedulerRead(client,role){
 await client.query(`GRANT USAGE ON SCHEMA atlas_scheduler TO ${identifier(role)}`);
 for(const table of tables){
  await client.query(`GRANT SELECT ON atlas_scheduler.${table} TO ${identifier(role)}`);
  const policy='app_'+digest(role).slice(0,12)+'_s_'+table;
  if(!(await client.query("SELECT 1 FROM pg_policy WHERE polrelid=$1::regclass AND polname=$2",['atlas_scheduler.'+table,policy])).rowCount)await client.query(`CREATE POLICY ${identifier(policy)} ON atlas_scheduler.${table} FOR SELECT TO ${identifier(role)} USING(true)`);
 }
}
export async function verifySchedulerSchema(client,{required=true}={}){
 if(!(await client.query("SELECT to_regnamespace('atlas_scheduler') IS NOT NULL AS present")).rows[0].present){if(required)fail('SCHEDULER_POLICY_UPGRADE_REQUIRED');return false;}
 const rows=(await client.query("SELECT version,encode(migration_hash,'hex') AS migration,encode(structure_hash,'hex') AS structure,encode(history_hash,'hex') AS history FROM atlas_scheduler.schema_version")).rows;
 const expectedMigration=digest(await readFile(new URL('../../db/scheduler/001-configurable-schedule.sql',import.meta.url)));
 if(rows.length!==1||rows[0].version!==1||rows[0].migration!==expectedMigration||rows[0].structure!==await structureHash(client,'atlas_scheduler')||rows[0].history!==await structureHash(client,'atlas_history'))fail('SCHEDULER_SCHEMA_MISMATCH');
 const owner=(await client.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_scheduler' AND nspowner=(SELECT nspowner FROM pg_namespace WHERE nspname='atlas_history')")).rows[0]?.id;
 if(!owner)fail('SCHEDULER_SCHEMA_MISMATCH');
 const writers=(await client.query('SELECT g.role_name,r.oid::text AS id FROM atlas_history.writer_grant g JOIN pg_roles r ON r.rolname=g.role_name')).rows,expected=[];
 for(const table of tables){expected.push({table,name:'installer',command:'*',id:owner,using:'true',check:'true'});for(const r of writers)expected.push({table,name:'app_'+digest(r.role_name).slice(0,12)+'_s_'+table,command:'r',id:r.id,using:'true',check:null});}
 const actual=(await client.query(`SELECT c.relname AS table,p.polname AS name,p.polcmd::text AS command,array_to_string(p.polroles,',') AS id,pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_scheduler'::regnamespace AND p.polpermissive`)).rows;
 const sort=rows=>rows.sort((a,b)=>(a.table+':'+a.name).localeCompare(b.table+':'+b.name));
 if(canonical(sort(actual))!==canonical(sort(expected))||(await client.query("SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_scheduler'::regnamespace AND NOT p.polpermissive")).rowCount)fail('SCHEDULER_SCHEMA_MISMATCH');
 const exposed=(await client.query(`SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='atlas_scheduler' AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='atlas_scheduler'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='atlas_scheduler'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role') AND (has_schema_privilege(r.oid,'atlas_scheduler','USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='atlas_scheduler'::regnamespace AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='atlas_scheduler'::regnamespace AND has_function_privilege(r.oid,p.oid,'EXECUTE')))`)).rowCount;
 if(exposed||(await client.query("SELECT current_setting('pgrst.db_schemas',true) AS schemas")).rows[0].schemas?.split(',').some(s=>s.trim()==='atlas_scheduler'))fail('SCHEDULER_PRIVILEGES_UNSAFE');
 for(const r of writers){
  const schema=(await client.query("SELECT has_schema_privilege($1,'atlas_scheduler','USAGE') AND NOT has_schema_privilege($1,'atlas_scheduler','CREATE') AS safe",[r.role_name])).rows[0];
  const bad=(await client.query(`SELECT 1 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_scheduler'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped AND (NOT has_table_privilege($1,c.oid,'SELECT') OR has_table_privilege($1,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_column_privilege($1,c.oid,a.attnum,'INSERT,UPDATE,REFERENCES'))
   UNION ALL SELECT 1 FROM pg_proc p WHERE p.pronamespace='atlas_scheduler'::regnamespace AND has_function_privilege($1,p.oid,'EXECUTE')`,[r.role_name])).rowCount;
  if(!schema.safe||bad)fail('SCHEDULER_PRIVILEGES_UNSAFE');
 }
 return true;
}
