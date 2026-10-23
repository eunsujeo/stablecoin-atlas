import {readFile} from 'node:fs/promises';
import {transaction,safeRole,runtimeRole} from './connection.mjs';
import {verifySchema,verifyRuntimeAccess,structureHash} from './schema.mjs';
import {canonical,instant} from './plan.mjs';
import {supplyHash as surveyHash} from '../allium-supply-source.mjs';
import {surveySource,surveyMapper,storedSurveyPlan} from '../allium-survey-source.mjs';
import {validateSurveySnapshot,validateStoredSurvey} from '../../web/survey-model.js';
import {archiveSources} from './files.mjs';
const migration=new URL('../../db/survey/001-initial.sql',import.meta.url),tables=['schema_version','access_grant','source'];
const fail=()=>{throw Error('ALLIUM_SURVEY_DATABASE_INVALID');};
const ident=s=>{if(typeof s!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(s))fail();return '"'+s+'"';};
const lock=c=>c.query('SELECT pg_advisory_xact_lock(18471234,412)');
const hashBytes=s=>Buffer.from(s,'hex');
async function owner(c){await verifySchema(c);if(!(await c.query("SELECT current_user=session_user AND current_user=pg_get_userbyid(nspowner) AS ok FROM pg_namespace WHERE nspname='atlas_market'")).rows[0]?.ok)fail();}
async function privileges(c,role,mode){
 await safeRole(c,role);
 const schema=(await c.query("SELECT has_schema_privilege($1,'atlas_survey','USAGE') AS usage,has_schema_privilege($1,'atlas_survey','CREATE') AS create",[role])).rows[0];if(!schema.usage||schema.create)fail();
 const rows=(await c.query(`SELECT c.relname,has_table_privilege($1,c.oid,'SELECT') AS read,has_table_privilege($1,c.oid,'INSERT') AS insert,
 has_table_privilege($1,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS other,
 has_column_privilege($1,c.oid,a.attnum,'INSERT') AS column_insert,has_column_privilege($1,c.oid,a.attnum,'UPDATE,REFERENCES') AS column_other
 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_survey'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,[role])).rows;
 if(!rows.length||rows.some(r=>!r.read||r.other||r.column_other||r.insert!==(mode==='writer'&&['source'].includes(r.relname))||r.column_insert!==r.insert))fail();
 if((await c.query("SELECT 1 FROM pg_proc WHERE pronamespace='atlas_survey'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",[role])).rowCount)fail();
}
export async function verifySurveySchema(c){
 const rows=(await c.query("SELECT version,encode(migration_hash,'hex') AS migration,encode(structure_hash,'hex') AS structure FROM atlas_survey.schema_version")).rows;
 if(rows.length!==1||rows[0].version!==1||rows[0].migration!==surveyHash(await readFile(migration))||rows[0].structure!==await structureHash(c,'atlas_survey'))fail();
 const owner=(await c.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_survey'")).rows[0].id;
 const grants=(await c.query('SELECT g.role_name,g.access_mode,r.oid::text AS id FROM atlas_survey.access_grant g JOIN pg_roles r ON r.rolname=g.role_name')).rows;
 const expected=[];for(const table of tables){expected.push({table,name:'installer',command:'*',roles:owner,using:'true',check:'true'});for(const g of grants){const prefix='app_'+surveyHash(g.role_name).slice(0,12);expected.push({table,name:prefix+'_s_'+table,command:'r',roles:g.id,using:'true',check:null});if(g.access_mode==='writer'&&['source'].includes(table))expected.push({table,name:prefix+'_i_'+table,command:'a',roles:g.id,using:null,check:'true'});}}
 const actual=(await c.query(`SELECT c.relname AS table,p.polname AS name,p.polcmd::text AS command,array_to_string(p.polroles,',') AS roles,pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_survey'::regnamespace AND p.polpermissive`)).rows;
 const sorted=rs=>rs.sort((a,b)=>(a.table+':'+a.name).localeCompare(b.table+':'+b.name));if(canonical(sorted(actual))!==canonical(sorted(expected)))fail();
 if((await c.query("SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_survey'::regnamespace AND NOT p.polpermissive")).rowCount)fail();
 if((await c.query("SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='atlas_survey'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'O'")).rowCount)fail();
 const publicAcl=(await c.query(`SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='atlas_survey' AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='atlas_survey'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_attribute col JOIN pg_class c ON c.oid=col.attrelid CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE c.relnamespace='atlas_survey'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='atlas_survey'::regnamespace AND a.grantee=0`)).rowCount;if(publicAcl)fail();
 const exposed=(await c.query(`SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role') AND (has_schema_privilege(r.oid,'atlas_survey','USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='atlas_survey'::regnamespace AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_survey'::regnamespace AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(r.oid,c.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')) OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='atlas_survey'::regnamespace AND has_function_privilege(r.oid,p.oid,'EXECUTE')))`)).rowCount;if(exposed)fail();
 const schemas=(await c.query("SELECT current_setting('pgrst.db_schemas',true) AS schemas")).rows[0].schemas;if(schemas?.split(',').some(s=>s.trim()==='atlas_survey'))fail();
 for(const g of grants)await privileges(c,g.role_name,g.access_mode);
}
async function access(c,write=false){await runtimeRole(c);await verifySchema(c);await verifyRuntimeAccess(c,write);await verifySurveySchema(c);const g=(await c.query('SELECT access_mode FROM atlas_survey.access_grant WHERE role_name=current_user')).rows[0];if(!g||write&&g.access_mode!=='writer')fail();}
export async function initializeSurvey(c){return transaction(c,async()=>{await lock(c);await owner(c);
 if((await c.query("SELECT to_regnamespace('atlas_survey') IS NOT NULL AS present")).rows[0].present){if(!(await c.query("SELECT current_user=pg_get_userbyid(nspowner) AS ok FROM pg_namespace WHERE nspname='atlas_survey'")).rows[0]?.ok)fail();await verifySurveySchema(c);return {state:'UNCHANGED',version:1};}
 const sql=await readFile(migration);await c.query(sql.toString());const role=(await c.query('SELECT current_user AS role')).rows[0].role;
 for(const table of tables)await c.query(`CREATE POLICY installer ON atlas_survey.${table} TO ${ident(role)} USING(true) WITH CHECK(true)`);
 await c.query('INSERT INTO atlas_survey.schema_version VALUES(1,$1,$2)',[hashBytes(surveyHash(sql)),hashBytes(await structureHash(c,'atlas_survey'))]);await verifySurveySchema(c);return {state:'INITIALIZED',version:1};
});}
export async function grantSurvey(c,role,mode){ident(role);if(!['reader','writer'].includes(mode))fail();return transaction(c,async()=>{await lock(c);await owner(c);await verifySurveySchema(c);await safeRole(c,role);
 if((await c.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1',[role])).rows[0]?.access_mode!==mode)fail();
 const prior=(await c.query('SELECT access_mode FROM atlas_survey.access_grant WHERE role_name=$1',[role])).rows[0];if(prior){if(prior.access_mode!==mode)fail();return {state:'UNCHANGED',access:mode};}
 await c.query(`GRANT USAGE ON SCHEMA atlas_survey TO ${ident(role)}`);for(const table of tables){const prefix='app_'+surveyHash(role).slice(0,12);await c.query(`GRANT SELECT ON atlas_survey.${table} TO ${ident(role)}`);await c.query(`CREATE POLICY ${ident(prefix+'_s_'+table)} ON atlas_survey.${table} FOR SELECT TO ${ident(role)} USING(true)`);if(mode==='writer'&&['source'].includes(table)){await c.query(`GRANT INSERT ON atlas_survey.${table} TO ${ident(role)}`);await c.query(`CREATE POLICY ${ident(prefix+'_i_'+table)} ON atlas_survey.${table} FOR INSERT TO ${ident(role)} WITH CHECK(true)`);}}
 await c.query('INSERT INTO atlas_survey.access_grant VALUES($1,$2)',[role,mode]);await verifySurveySchema(c);return {state:'GRANTED',access:mode};
});}
export async function importSurvey(c,bytes,options){
 const source=surveySource(bytes,options);if(typeof options.archiveRoot!=='string'||!options.archiveRoot)fail();
 return transaction(c,async()=>{
  await lock(c);await access(c,true);
  await archiveSources([{hash:source.sourceHash,bytes},{hash:source.reviewHash,bytes:options.reviewBytes},{hash:source.receiptHash,bytes:options.receiptBytes},
   ...(options.executionAuthorizationBytes?[{hash:surveyHash(options.executionAuthorizationBytes),bytes:options.executionAuthorizationBytes},{hash:surveyHash(options.userApprovalBytes),bytes:options.userApprovalBytes}]:[])],options.archiveRoot);
  const prior=(await c.query("SELECT encode(id,'hex') AS id FROM atlas_survey.source WHERE id=$1",[hashBytes(source.id)])).rows[0];
  if(prior)return {state:'UNCHANGED',rows:0,sourceHash:source.sourceHash};
  if((await c.query('SELECT 1 FROM atlas_survey.source WHERE kind=$1 AND plan_hash=$2 AND queried_at=$3',[source.kind,hashBytes(source.planHash),source.queriedAt])).rowCount)throw Error('ALLIUM_SURVEY_TIMESTAMP_CONFLICT');
  await c.query(`INSERT INTO atlas_survey.source(id,source_hash,mapper,kind,plan_hash,review_hash,receipt_hash,queried_at,window_from,window_to,projection_hash,payload)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[hashBytes(source.id),hashBytes(source.sourceHash),source.mapper,source.kind,hashBytes(source.planHash),hashBytes(source.reviewHash),hashBytes(source.receiptHash),source.queriedAt,source.from,source.to,hashBytes(source.projectionHash),JSON.stringify(source.snapshot)]);
  return {state:'IMPORTED',rows:source.snapshot.rows.filter(r=>r.state==='OBSERVED').length,inconclusive:source.snapshot.rows.filter(r=>r.state==='INCONCLUSIVE').length,sourceHash:source.sourceHash};
 });
}
export async function readSurvey(c){
 const plan=await storedSurveyPlan();
 return transaction(c,async()=>{
  await access(c);
  const rows=(await c.query(`SELECT DISTINCT ON(kind) encode(id,'hex') AS id,encode(source_hash,'hex') AS source_hash,mapper,kind,
   encode(plan_hash,'hex') AS plan_hash,encode(review_hash,'hex') AS review_hash,encode(receipt_hash,'hex') AS receipt_hash,
   to_char(queried_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS queried_at,
   to_char(window_from,'YYYY-MM-DD') AS window_from,to_char(window_to,'YYYY-MM-DD') AS window_to,
   encode(projection_hash,'hex') AS projection_hash,payload FROM atlas_survey.source
   WHERE plan_hash=$1 AND window_from='2026-10-16' AND window_to='2026-10-22'
   ORDER BY kind,queried_at DESC,id DESC`,[hashBytes(plan.planHash)])).rows;
  const snapshots=rows.map(r=>{
   const snapshot=validateSurveySnapshot(r.payload),metadata={mapper:r.mapper,kind:r.kind,planHash:r.plan_hash,sourceHash:r.source_hash,reviewHash:r.review_hash,receiptHash:r.receipt_hash,queriedAt:instant(r.queried_at),from:r.window_from,to:r.window_to,projectionHash:r.projection_hash};
   if(surveyHash(metadata)!==r.id||r.mapper!==surveyMapper||snapshot.survey!==r.kind||snapshot.planHash!==r.plan_hash||snapshot.sourceHash!==r.source_hash||snapshot.queriedAt!==metadata.queriedAt||snapshot.window.from!==r.window_from||r.window_to!=='2026-10-22'||surveyHash(snapshot)!==r.projection_hash||canonical(r.payload)!==canonical(snapshot)||snapshot.sqlHash!==plan.jobs.find(j=>j.kind===r.kind)?.sqlHash)fail();return snapshot;
  });
  return validateStoredSurvey({schemaVersion:1,kind:'ALLIUM_STORED_SURVEY',provider:'ALLIUM',snapshots});
 },{repeatableRead:true});
}
