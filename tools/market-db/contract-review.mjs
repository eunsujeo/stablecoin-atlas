import {verifySupplyApiBoundary} from './supply-api-boundary.mjs';
import {readFile} from 'node:fs/promises';
import {transaction,safeRole,runtimeRole} from './connection.mjs';
import {verifySchema,verifyRuntimeAccess,structureHash} from './schema.mjs';
import {canonical,digest} from './plan.mjs';
import {validateContractReviewStore,validateContractReport} from '../../web/contract-review-model.js';
const migration=new URL('../../db/contract-review/001-initial.sql',import.meta.url),tables=['schema_version','access_grant','report'];
// Pinned from the committed DDL in a newly owned PG17 fixture.
export const contractReviewStructure='07d95577cc9be113f7826139a546175793d40886d71f8da25156c58a43f2f3d6';
const fail=()=>{throw Error('CONTRACT_REVIEW_DATABASE_INVALID');};
const ident=s=>{if(typeof s!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(s))fail();return '"'+s+'"';};
const lock=c=>c.query('SELECT pg_advisory_xact_lock(18471234,413)');
const hashBytes=s=>Buffer.from(s,'hex');
async function owner(c){await verifySchema(c);if(!(await c.query("SELECT current_user=session_user AND current_user=pg_get_userbyid(nspowner) AS ok FROM pg_namespace WHERE nspname='atlas_market'")).rows[0]?.ok)fail();}
async function privileges(c,role,mode){
 await safeRole(c,role);
 const schema=(await c.query("SELECT has_schema_privilege($1,'atlas_contract_review','USAGE') AS usage,has_schema_privilege($1,'atlas_contract_review','CREATE') AS create",[role])).rows[0];if(!schema.usage||schema.create)fail();
 const rows=(await c.query(`SELECT c.relname,has_table_privilege($1,c.oid,'SELECT') AS read,has_table_privilege($1,c.oid,'INSERT') AS insert,
 has_table_privilege($1,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS other,
 has_column_privilege($1,c.oid,a.attnum,'INSERT') AS column_insert,has_column_privilege($1,c.oid,a.attnum,'UPDATE,REFERENCES') AS column_other
 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_contract_review'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,[role])).rows;
 if(!rows.length||rows.some(r=>!r.read||r.other||r.column_other||r.insert!==(mode==='writer'&&['report'].includes(r.relname))||r.column_insert!==r.insert))fail();
 if((await c.query("SELECT 1 FROM pg_proc WHERE pronamespace='atlas_contract_review'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",[role])).rowCount)fail();
}
export async function verifyContractReviewSchema(c){
 const rows=(await c.query("SELECT version,encode(migration_hash,'hex') AS migration,encode(structure_hash,'hex') AS structure FROM atlas_contract_review.schema_version")).rows;
 if(rows.length!==1||rows[0].version!==1||rows[0].migration!==digest(await readFile(migration))||rows[0].structure!==contractReviewStructure||await structureHash(c,'atlas_contract_review')!==contractReviewStructure)fail();
 const owner=(await c.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_contract_review'")).rows[0].id;
 const grants=(await c.query('SELECT g.role_name,g.access_mode,r.oid::text AS id FROM atlas_contract_review.access_grant g JOIN pg_roles r ON r.rolname=g.role_name')).rows;
 const expected=[];for(const table of tables){expected.push({table,name:'installer',command:'*',roles:owner,using:'true',check:'true'});for(const g of grants){const prefix='app_'+digest(g.role_name).slice(0,12);expected.push({table,name:prefix+'_s_'+table,command:'r',roles:g.id,using:'true',check:null});if(g.access_mode==='writer'&&['report'].includes(table))expected.push({table,name:prefix+'_i_'+table,command:'a',roles:g.id,using:null,check:'true'});}}
 const actual=(await c.query(`SELECT c.relname AS table,p.polname AS name,p.polcmd::text AS command,array_to_string(p.polroles,',') AS roles,pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_contract_review'::regnamespace AND p.polpermissive`)).rows;
 const sorted=rs=>rs.sort((a,b)=>(a.table+':'+a.name).localeCompare(b.table+':'+b.name));if(canonical(sorted(actual))!==canonical(sorted(expected)))fail();
 if((await c.query("SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_contract_review'::regnamespace AND NOT p.polpermissive")).rowCount)fail();
 if((await c.query("SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='atlas_contract_review'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'O'")).rowCount)fail();
 const publicAcl=(await c.query(`SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='atlas_contract_review' AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='atlas_contract_review'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_attribute col JOIN pg_class c ON c.oid=col.attrelid CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE c.relnamespace='atlas_contract_review'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='atlas_contract_review'::regnamespace AND a.grantee=0`)).rowCount;if(publicAcl)fail();
 const exposed=(await c.query(`SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role') AND (has_schema_privilege(r.oid,'atlas_contract_review','USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='atlas_contract_review'::regnamespace AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_contract_review'::regnamespace AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(r.oid,c.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')) OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='atlas_contract_review'::regnamespace AND has_function_privilege(r.oid,p.oid,'EXECUTE')))`)).rowCount;if(exposed)fail();
 const schemas=(await c.query("SELECT current_setting('pgrst.db_schemas',true) AS schemas")).rows[0].schemas;if(schemas?.split(',').some(s=>s.trim()==='atlas_contract_review'))fail();
 for(const g of grants)await privileges(c,g.role_name,g.access_mode);
 return 1;
}
async function access(c,write=false){
 await runtimeRole(c);await verifySchema(c);await verifyRuntimeAccess(c,write);await verifyContractReviewSchema(c);
 const g=(await c.query('SELECT access_mode FROM atlas_contract_review.access_grant WHERE role_name=current_user')).rows[0];
 if(!g||write&&g.access_mode!=='writer'||!write&&g.access_mode!=='reader')fail();
}
export async function initializeContractReview(c,{reviewedDefiners=[]}={}){return transaction(c,async()=>{
 await lock(c);await owner(c);
 if((await c.query("SELECT to_regnamespace('atlas_contract_review') IS NOT NULL AS present")).rows[0].present){
  if(!(await c.query("SELECT current_user=pg_get_userbyid(nspowner) AS ok FROM pg_namespace WHERE nspname='atlas_contract_review'")).rows[0]?.ok)fail();
  await verifyContractReviewSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_contract_review',reviewedDefiners});return {state:'UNCHANGED',version:1};
 }
 const sql=await readFile(migration);await c.query(sql.toString());const role=(await c.query('SELECT current_user AS role')).rows[0].role;
 for(const table of tables)await c.query(`CREATE POLICY installer ON atlas_contract_review.${table} TO ${ident(role)} USING(true) WITH CHECK(true)`);
 if(await structureHash(c,'atlas_contract_review')!==contractReviewStructure)fail();
 await c.query('INSERT INTO atlas_contract_review.schema_version VALUES(1,$1,$2)',[hashBytes(digest(sql)),hashBytes(contractReviewStructure)]);
 await verifyContractReviewSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_contract_review',reviewedDefiners});return {state:'INITIALIZED',version:1};
});}
export function reviewedImport(bytes,expectedHash){
 if(!Buffer.isBuffer(bytes)||bytes.length>131072||!(/^[a-f0-9]{64}$/.test(expectedHash))||digest(bytes)!==expectedHash)throw Error('CONTRACT_REVIEW_INPUT_HASH_MISMATCH');
 return validateContractReviewStore(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
export async function importContractReviews(c,bytes,expectedHash,{reviewedDefiners=[]}={}){
 const store=reviewedImport(bytes,expectedHash);
 return transaction(c,async()=>{
  await lock(c);await access(c,true);await verifySupplyApiBoundary(c,{schema:'atlas_contract_review',reviewedDefiners});let inserted=0;
  for(const report of store.reports){
   const hash=digest(canonical(report)),old=(await c.query("SELECT encode(payload_hash,'hex') AS hash,payload FROM atlas_contract_review.report WHERE report_id=$1",[report.id])).rows[0];
   if(old){if(old.hash!==hash||canonical(old.payload)!==canonical(report))throw Error('CONTRACT_REVIEW_ID_CONFLICT');continue;}
   await c.query('INSERT INTO atlas_contract_review.report(report_id,chain_id,address,observed_at,payload_hash,payload) VALUES($1,$2,$3,$4,$5,$6)',[report.id,report.chainId,report.address,report.observedAt,hashBytes(hash),JSON.stringify(report)]);inserted++;
  }
  await verifySupplyApiBoundary(c,{schema:'atlas_contract_review',reviewedDefiners});
  return {state:inserted?'IMPORTED':'UNCHANGED',inserted,total:store.reports.length,inputHash:expectedHash};
 });
}
export async function readContractReviews(c){return transaction(c,async()=>{
 await access(c);
 const rows=(await c.query("SELECT report_id,chain_id,address,to_char(observed_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS observed_at,encode(payload_hash,'hex') AS hash,payload FROM atlas_contract_review.report ORDER BY observed_at DESC,report_id LIMIT 33")).rows;
 if(rows.length>32)fail();
 const reports=rows.map(r=>{const p=validateContractReport(r.payload);if(p.id!==r.report_id||p.chainId!==r.chain_id||p.address!==r.address||p.observedAt!==r.observed_at||digest(canonical(p))!==r.hash)fail();return p;});
 return validateContractReviewStore({schemaVersion:1,kind:'REVIEWED_CONTRACT_SUMMARIES',reports});
},{repeatableRead:true});}
export async function grantContractReview(c,role,mode,{reviewedDefiners=[]}={}){ident(role);if(!['reader','writer'].includes(mode))fail();return transaction(c,async()=>{await lock(c);await owner(c);await verifyContractReviewSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_contract_review',reviewedDefiners});await safeRole(c,role);
 if((await c.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1',[role])).rows[0]?.access_mode!==mode)fail();
 const prior=(await c.query('SELECT access_mode FROM atlas_contract_review.access_grant WHERE role_name=$1',[role])).rows[0];if(prior){if(prior.access_mode!==mode)fail();return {state:'UNCHANGED',access:mode};}
 await c.query(`GRANT USAGE ON SCHEMA atlas_contract_review TO ${ident(role)}`);for(const table of tables){const prefix='app_'+digest(role).slice(0,12);await c.query(`GRANT SELECT ON atlas_contract_review.${table} TO ${ident(role)}`);await c.query(`CREATE POLICY ${ident(prefix+'_s_'+table)} ON atlas_contract_review.${table} FOR SELECT TO ${ident(role)} USING(true)`);if(mode==='writer'&&['report'].includes(table)){await c.query(`GRANT INSERT ON atlas_contract_review.${table} TO ${ident(role)}`);await c.query(`CREATE POLICY ${ident(prefix+'_i_'+table)} ON atlas_contract_review.${table} FOR INSERT TO ${ident(role)} WITH CHECK(true)`);}}
 await c.query('INSERT INTO atlas_contract_review.access_grant VALUES($1,$2)',[role,mode]);await verifyContractReviewSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_contract_review',reviewedDefiners});return {state:'GRANTED',access:mode};
});}
