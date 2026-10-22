import {readFile} from 'node:fs/promises';
import {digest,canonical,fail} from './plan.mjs';
import {transaction,safeRole} from './connection.mjs';
export const schema='atlas_market';
const migrationUrl=new URL('../../db/market/001-initial.sql',import.meta.url);
export const metadataTables=['coin','network','deployment','subject','provider','provider_identifier','metric_definition','series','request_definition','request_series','request_network','artifact','legacy_observation','import_manifest'];
export const readTables=[...metadataTables,'collection_run','collection_request','observation','network_observation','series_latest','series_rollup','schema_version','access_grant'];
const insertTables=[...metadataTables,'collection_run','collection_request','observation','network_observation','series_latest'];
const columnsUpdate={collection_run:['state','finished_at'],series_latest:['observed_at','request_id']};
const identifier=name=>{if(typeof name!=='string'||!/[a-z]/.test(name)||!/^[a-z][a-z0-9_]{0,62}$/.test(name))fail('INVALID_IDENTIFIER');return '"'+name+'"';};
export async function lock(client){await client.query('SELECT pg_advisory_xact_lock(18471234,401)');}
export async function structureHash(client,namespace=schema){
  if(![schema,'atlas_catalog'].includes(namespace))fail('INVALID_IDENTIFIER');
  await client.query('SET LOCAL search_path=pg_catalog');
  const {rows}=await client.query(`WITH core AS (SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relkind IN ('r','p','v','m','f') AND c.relname !~ '^(observation|network_observation)_[0-9]{4}_[0-9]{2}$')
    SELECT 'table:'||relname AS key, relrowsecurity::text||':'||relforcerowsecurity::text AS value FROM core
    UNION ALL SELECT 'column:'||c.relname||':'||a.attnum, a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||a.attidentity::text
      FROM core c JOIN pg_attribute a ON a.attrelid=c.oid WHERE a.attnum>0 AND NOT a.attisdropped
    UNION ALL SELECT 'constraint:'||coalesce(c.relname,t.typname)||':'||con.conname,pg_get_constraintdef(con.oid,true)
      FROM pg_constraint con LEFT JOIN core c ON c.oid=con.conrelid LEFT JOIN pg_type t ON t.oid=con.contypid
      WHERE con.connamespace=$1::regnamespace AND con.conparentid=0 AND (c.oid IS NOT NULL OR t.oid IS NOT NULL)
    UNION ALL SELECT 'function:'||p.proname,pg_get_functiondef(p.oid) FROM pg_proc p WHERE p.pronamespace=$1::regnamespace
    UNION ALL SELECT 'trigger:'||c.relname||':'||t.tgname,pg_get_triggerdef(t.oid,true) FROM pg_trigger t JOIN core c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
    UNION ALL SELECT 'enum:'||t.typname||':'||e.enumsortorder,e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typnamespace=$1::regnamespace
    UNION ALL SELECT 'sequence:'||c.relname,concat_ws(':',q.seqtypid::regtype::text,q.seqstart,q.seqincrement,q.seqmax,q.seqmin,q.seqcache,q.seqcycle) FROM pg_sequence q JOIN pg_class c ON c.oid=q.seqrelid WHERE c.relnamespace=$1::regnamespace
    UNION ALL SELECT 'index:'||c.relname||':'||i.indexrelid::regclass::text,pg_get_indexdef(i.indexrelid) FROM pg_index i JOIN core c ON c.oid=i.indrelid
      WHERE NOT EXISTS(SELECT 1 FROM pg_constraint co WHERE co.conindid=i.indexrelid)
    ORDER BY key`,[namespace]);
  return digest(canonical(rows));
}
async function verifyPolicies(client){
  const owner=(await client.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_market'")).rows[0].id;
  const grants=(await client.query('SELECT g.role_name,g.access_mode,r.oid::text AS id FROM atlas_market.access_grant g JOIN pg_roles r ON r.rolname=g.role_name ORDER BY g.role_name')).rows;
  const expected=[];const add=(table,name,command,id,using,check)=>expected.push({table,name,command,id,using,check});
  for(const table of readTables)add(table,'installer','*',owner,'true','true');
  for(const g of grants){const prefix='app_'+digest(g.role_name).slice(0,12)+'_';
    for(const table of readTables)add(table,prefix+'s_'+table,'r',g.id,'true',null);
    if(g.access_mode==='writer'){
      for(const table of insertTables)add(table,prefix+'i_'+table,'a',g.id,null,'true');
      for(const table of Object.keys(columnsUpdate))add(table,prefix+'u_'+table,'w',g.id,'true','true');
    }
  }
  const actual=(await client.query(`SELECT c.relname AS table,p.polname AS name,p.polcmd::text AS command,array_to_string(p.polroles,',') AS id,
    pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check
    FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_market'::regnamespace AND p.polpermissive`)).rows;
  const sort=rows=>rows.sort((a,b)=>(a.table+':'+a.name).localeCompare(b.table+':'+b.name));
  if(canonical(sort(actual))!==canonical(sort(expected)))fail('DATABASE_POLICIES_MISMATCH');
  const bad=(await client.query(`SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_market'::regnamespace AND NOT p.polpermissive`)).rowCount;
  if(bad)fail('DATABASE_POLICIES_MISMATCH');
}
export async function verifySchema(client){
  const sql=await readFile(migrationUrl),hash=digest(sql);
  const {rows}=await client.query('SELECT version,encode(migration_hash,\'hex\') AS migration_hash,encode(structure_hash,\'hex\') AS structure_hash FROM atlas_market.schema_version');
  if(rows.length!==1||rows[0].version!==1||rows[0].migration_hash!==hash||rows[0].structure_hash!==await structureHash(client))fail('DATABASE_SCHEMA_MISMATCH');
  await verifyPolicies(client);
  const parts=(await client.query(`SELECT c.relname,c.relkind::text AS kind,c.relrowsecurity,c.relforcerowsecurity,pg_get_expr(c.relpartbound,c.oid) AS bound,p.inhparent::regclass::text AS parent
    FROM pg_class c JOIN pg_inherits p ON p.inhrelid=c.oid WHERE c.relnamespace='atlas_market'::regnamespace AND c.relispartition AND c.relkind NOT IN ('i','I')`)).rows;
  for(const p of parts){const m=/^(observation|network_observation)_(20[2-9][0-9]|2100)_(0[1-9]|1[0-2])$/.exec(p.relname);
    if(!m||p.kind!=='r'||!p.relrowsecurity||!p.relforcerowsecurity||p.parent!=='atlas_market.'+m[1])fail('PARTITION_CONFLICT');
    const year=Number(m[2]),month=Number(m[3]),start=`${m[2]}-${m[3]}-01`,end=month===12?`${year+1}-01-01`:`${year}-${String(month+1).padStart(2,'0')}-01`;
    if(p.bound!==`FOR VALUES FROM ('${start} 00:00:00+00') TO ('${end} 00:00:00+00')`)fail('PARTITION_CONFLICT');
  }
  const extras=(await client.query(`SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='atlas_market'::regnamespace AND c.relispartition AND NOT t.tgisinternal AND t.tgparentid=0`)).rowCount;
  if(extras)fail('PARTITION_CONFLICT');
}
export async function initialize(client){return transaction(client,async()=>{
  await lock(client);const version=(await client.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version;if(version<170000)fail('DATABASE_VERSION_UNSUPPORTED');
  const exists=(await client.query("SELECT to_regnamespace('atlas_market') AS schema")).rows[0].schema;
  if(exists){await requireOwner(client);return {state:'UNCHANGED',version:1};}
  const sql=await readFile(migrationUrl);await client.query(sql.toString('utf8'));
  // FORCE RLS still applies to a non-bypass owner. Only the installer gets an explicit private policy.
  const owner=(await client.query('SELECT current_user AS name')).rows[0].name;const quoted=identifier(owner);
  for(const table of readTables)await client.query(`CREATE POLICY installer ON atlas_market.${table} TO ${quoted} USING(true) WITH CHECK(true)`);
  await client.query('INSERT INTO atlas_market.schema_version(version,migration_hash,structure_hash) VALUES(1,$1,$2)',[Buffer.from(digest(sql),'hex'),Buffer.from(await structureHash(client),'hex')]);
  return {state:'INITIALIZED',version:1};
});}
async function requireOwner(client){await verifySchema(client);const {rows:[r]}=await client.query("SELECT current_user=session_user AND current_user=pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='atlas_market'");if(!r?.owner)fail('DATABASE_OWNER_REQUIRED');}
export async function partition(client,month){
  if(typeof month!=='string'||!/^(20[2-9][0-9]|2100)-(0[1-9]|1[0-2])$/.test(month))fail('INVALID_PARTITION_MONTH');
  const [year,m]=month.split('-').map(Number),end=m===12?`${year+1}-01-01`:`${year}-${String(m+1).padStart(2,'0')}-01`,start=month+'-01';
  return transaction(client,async()=>{await lock(client);await requireOwner(client);
    for(const table of ['observation','network_observation']){
      const name=table+'_'+month.replace('-','_'),exists=(await client.query('SELECT to_regclass($1) AS name',[schema+'.'+name])).rows[0].name;
      if(exists){const {rows:[r]}=await client.query(`SELECT c.relrowsecurity,c.relforcerowsecurity,pg_get_expr(c.relpartbound,c.oid) AS bound,p.inhparent::regclass::text AS parent FROM pg_class c JOIN pg_inherits p ON p.inhrelid=c.oid WHERE c.oid=$1::regclass`,[schema+'.'+name]);
        if(!r?.relrowsecurity||!r.relforcerowsecurity||r.parent!==schema+'.'+table||r.bound!==`FOR VALUES FROM ('${start} 00:00:00+00') TO ('${end} 00:00:00+00')`)fail('PARTITION_CONFLICT');continue;}
      await client.query(`CREATE TABLE atlas_market.${name} PARTITION OF atlas_market.${table} FOR VALUES FROM ('${start} 00:00:00+00') TO ('${end} 00:00:00+00')`);
      await client.query(`ALTER TABLE atlas_market.${name} ENABLE ROW LEVEL SECURITY; ALTER TABLE atlas_market.${name} FORCE ROW LEVEL SECURITY; REVOKE ALL ON atlas_market.${name} FROM PUBLIC`);
    }
    await verifySchema(client);return {state:'PARTITION_READY',month};
  });
}
export async function grantAccess(client,role,mode){identifier(role);if(!['reader','writer'].includes(mode))fail('INVALID_ACCESS_MODE');
  return transaction(client,async()=>{await lock(client);await requireOwner(client);await safeRole(client,role);
    const previous=(await client.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1',[role])).rows[0];
    if(previous){if(previous.access_mode!==mode)fail('DATABASE_GRANT_CONFLICT');await verifyRolePrivileges(client,role,mode);return {state:'UNCHANGED',access:mode};}
    const target=identifier(role),prefix='app_'+digest(role).slice(0,12)+'_';
    await client.query(`GRANT USAGE ON SCHEMA atlas_market TO ${target}`);
    for(const table of readTables){await client.query(`GRANT SELECT ON atlas_market.${table} TO ${target}`);await client.query(`CREATE POLICY ${identifier(prefix+'s_'+table)} ON atlas_market.${table} FOR SELECT TO ${target} USING(true)`);}
    if(mode==='writer'){
      for(const table of insertTables){await client.query(`GRANT INSERT ON atlas_market.${table} TO ${target}`);await client.query(`CREATE POLICY ${identifier(prefix+'i_'+table)} ON atlas_market.${table} FOR INSERT TO ${target} WITH CHECK(true)`);}
      for(const [table,cols]of Object.entries(columnsUpdate)){await client.query(`GRANT UPDATE(${cols.join(',')}) ON atlas_market.${table} TO ${target}`);await client.query(`CREATE POLICY ${identifier(prefix+'u_'+table)} ON atlas_market.${table} FOR UPDATE TO ${target} USING(true) WITH CHECK(true)`);}
      await client.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA atlas_market TO ${target}`);
    }
    await client.query('INSERT INTO atlas_market.access_grant VALUES($1,$2)',[role,mode]);await verifyRolePrivileges(client,role,mode);return {state:'GRANTED',access:mode};
  });
}
async function verifyRolePrivileges(client,role,mode){
  const {rows}=await client.query(`SELECT c.relname,a.attname,has_column_privilege($1,c.oid,a.attnum,'UPDATE') AS update,
    has_table_privilege($1,c.oid,'DELETE,TRUNCATE,TRIGGER,REFERENCES') AS forbidden,
    has_table_privilege($1,c.oid,'SELECT') AS readable,has_table_privilege($1,c.oid,'INSERT') AS insert
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE n.nspname='atlas_market' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped`,[role]);
  for(const row of rows){const allowedUpdate=mode==='writer'&&(columnsUpdate[row.relname]??[]).includes(row.attname),allowedInsert=mode==='writer'&&insertTables.includes(row.relname);
    if(row.forbidden||(row.update!==allowedUpdate)||(row.insert!==allowedInsert)||(readTables.includes(row.relname)&&!row.readable))fail('DATABASE_PRIVILEGES_UNSAFE');}
  const children=(await client.query(`SELECT c.oid FROM pg_class c WHERE c.relnamespace='atlas_market'::regnamespace AND c.relispartition
    AND has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')`,[role])).rows;
  if(children.length)fail('DATABASE_PRIVILEGES_UNSAFE');
  const sequences=(await client.query(`SELECT has_sequence_privilege($1,c.oid,'SELECT,UPDATE') AS mutation,
    has_sequence_privilege($1,c.oid,'USAGE') AS usage FROM pg_class c WHERE c.relnamespace='atlas_market'::regnamespace AND c.relkind='S'`,[role])).rows;
  if(sequences.some(s=>s.mutation||s.usage!==(mode==='writer')))fail('DATABASE_PRIVILEGES_UNSAFE');
}
export async function verifyRuntimeAccess(client,write=false){
  const {rows:[r]}=await client.query('SELECT role_name,access_mode FROM atlas_market.access_grant WHERE role_name=current_user');
  if(!r||(write&&r.access_mode!=='writer'))fail('DATABASE_ACCESS_DENIED');
  await verifyRolePrivileges(client,r.role_name,r.access_mode);
}
