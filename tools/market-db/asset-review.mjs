import {verifySupplyApiBoundary} from './supply-api-boundary.mjs';
import {readFile} from 'node:fs/promises';
import {transaction,safeRole,runtimeRole} from './connection.mjs';
import {verifySchema,verifyRuntimeAccess,structureHash} from './schema.mjs';
import {canonical,digest} from './plan.mjs';
import {validateAssetReview,assetReviewByteLimit} from '../../web/asset-review-model.js';
const migration=new URL('../../db/asset-review/001-initial.sql',import.meta.url),tables=['schema_version','access_grant','snapshot'];
// Pinned from the committed DDL in a newly owned PG17 fixture.
export const assetReviewStructure='f007ae3a3f19a603b912e04d4269b4c45280c28f37e1c834b19f1001f0b23bda';
const fail=()=>{throw Error('ASSET_REVIEW_DATABASE_INVALID');};
const ident=s=>{if(typeof s!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(s))fail();return '"'+s+'"';};
const lock=c=>c.query('SELECT pg_advisory_xact_lock(18471234,414)');
const hashBytes=s=>Buffer.from(s,'hex');
async function owner(c){await verifySchema(c);if(!(await c.query("SELECT current_user=session_user AND current_user=pg_get_userbyid(nspowner) AS ok FROM pg_namespace WHERE nspname='atlas_market'")).rows[0]?.ok)fail();}
async function privileges(c,role,mode){
 await safeRole(c,role);
 const schema=(await c.query("SELECT has_schema_privilege($1,'atlas_asset_review','USAGE') AS usage,has_schema_privilege($1,'atlas_asset_review','CREATE') AS create",[role])).rows[0];if(!schema.usage||schema.create)fail();
 const rows=(await c.query(`SELECT c.relname,has_table_privilege($1,c.oid,'SELECT') AS read,has_table_privilege($1,c.oid,'INSERT') AS insert,
 has_table_privilege($1,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS other,
 has_column_privilege($1,c.oid,a.attnum,'INSERT') AS column_insert,has_column_privilege($1,c.oid,a.attnum,'UPDATE,REFERENCES') AS column_other
 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_asset_review'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,[role])).rows;
 if(!rows.length||rows.some(r=>!r.read||r.other||r.column_other||r.insert!==(mode==='writer'&&['snapshot'].includes(r.relname))||r.column_insert!==r.insert))fail();
 if((await c.query("SELECT 1 FROM pg_proc WHERE pronamespace='atlas_asset_review'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",[role])).rowCount)fail();
}
export async function verifyAssetReviewSchema(c){
 const rows=(await c.query("SELECT version,encode(migration_hash,'hex') AS migration,encode(structure_hash,'hex') AS structure FROM atlas_asset_review.schema_version")).rows;
 if(rows.length!==1||rows[0].version!==1||rows[0].migration!==digest(await readFile(migration))||rows[0].structure!==assetReviewStructure||await structureHash(c,'atlas_asset_review')!==assetReviewStructure)fail();
 const owner=(await c.query("SELECT nspowner::text AS id FROM pg_namespace WHERE nspname='atlas_asset_review'")).rows[0].id;
 const grants=(await c.query('SELECT g.role_name,g.access_mode,r.oid::text AS id FROM atlas_asset_review.access_grant g JOIN pg_roles r ON r.rolname=g.role_name')).rows;
 const expected=[];for(const table of tables){expected.push({table,name:'installer',command:'*',roles:owner,using:'true',check:'true'});for(const g of grants){const prefix='app_'+digest(g.role_name).slice(0,12);expected.push({table,name:prefix+'_s_'+table,command:'r',roles:g.id,using:'true',check:null});if(g.access_mode==='writer'&&['snapshot'].includes(table))expected.push({table,name:prefix+'_i_'+table,command:'a',roles:g.id,using:null,check:'true'});}}
 const actual=(await c.query(`SELECT c.relname AS table,p.polname AS name,p.polcmd::text AS command,array_to_string(p.polroles,',') AS roles,pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_asset_review'::regnamespace AND p.polpermissive`)).rows;
 const sorted=rs=>rs.sort((a,b)=>(a.table+':'+a.name).localeCompare(b.table+':'+b.name));if(canonical(sorted(actual))!==canonical(sorted(expected)))fail();
 if((await c.query("SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='atlas_asset_review'::regnamespace AND NOT p.polpermissive")).rowCount)fail();
 if((await c.query("SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='atlas_asset_review'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'O'")).rowCount)fail();
 const publicAcl=(await c.query(`SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='atlas_asset_review' AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='atlas_asset_review'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_attribute col JOIN pg_class c ON c.oid=col.attrelid CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE c.relnamespace='atlas_asset_review'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='atlas_asset_review'::regnamespace AND a.grantee=0`)).rowCount;if(publicAcl)fail();
 const exposed=(await c.query(`SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role') AND (has_schema_privilege(r.oid,'atlas_asset_review','USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='atlas_asset_review'::regnamespace AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='atlas_asset_review'::regnamespace AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(r.oid,c.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')) OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='atlas_asset_review'::regnamespace AND has_function_privilege(r.oid,p.oid,'EXECUTE')))`)).rowCount;if(exposed)fail();
 const schemas=(await c.query("SELECT current_setting('pgrst.db_schemas',true) AS schemas")).rows[0].schemas;if(schemas?.split(',').some(s=>s.trim()==='atlas_asset_review'))fail();
 for(const g of grants)await privileges(c,g.role_name,g.access_mode);
 return 1;
}
async function access(c,write=false){
 await runtimeRole(c);await verifySchema(c);await verifyRuntimeAccess(c,write);await verifyAssetReviewSchema(c);
 const g=(await c.query('SELECT access_mode FROM atlas_asset_review.access_grant WHERE role_name=current_user')).rows[0];
 if(!g||write&&g.access_mode!=='writer'||!write&&g.access_mode!=='reader')fail();
}
export async function initializeAssetReview(c,{reviewedDefiners=[]}={}){return transaction(c,async()=>{
 await lock(c);await owner(c);
 if((await c.query("SELECT to_regnamespace('atlas_asset_review') IS NOT NULL AS present")).rows[0].present){
  if(!(await c.query("SELECT current_user=pg_get_userbyid(nspowner) AS ok FROM pg_namespace WHERE nspname='atlas_asset_review'")).rows[0]?.ok)fail();
  await verifyAssetReviewSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_asset_review',reviewedDefiners});return {state:'UNCHANGED',version:1};
 }
 const sql=await readFile(migration);await c.query(sql.toString());const role=(await c.query('SELECT current_user AS role')).rows[0].role;
 for(const table of tables)await c.query(`CREATE POLICY installer ON atlas_asset_review.${table} TO ${ident(role)} USING(true) WITH CHECK(true)`);
 if(await structureHash(c,'atlas_asset_review')!==assetReviewStructure)fail();
 await c.query('INSERT INTO atlas_asset_review.schema_version VALUES(1,$1,$2)',[hashBytes(digest(sql)),hashBytes(assetReviewStructure)]);
 await verifyAssetReviewSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_asset_review',reviewedDefiners});return {state:'INITIALIZED',version:1};
});}
export function reviewedAssetImport(bytes,expectedHash){
 if(!Buffer.isBuffer(bytes)||bytes.length>assetReviewByteLimit||!(/^[a-f0-9]{64}$/.test(expectedHash))||digest(bytes)!==expectedHash)throw Error('ASSET_REVIEW_INPUT_HASH_MISMATCH');
 return validateAssetReview(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
export async function importAssetReview(c,bytes,expectedHash,{reviewedDefiners=[]}={}){
 const snapshot=reviewedAssetImport(bytes,expectedHash),hash=digest(canonical(snapshot));
 return transaction(c,async()=>{
  await lock(c);await access(c,true);await verifySupplyApiBoundary(c,{schema:'atlas_asset_review',reviewedDefiners});
  const old=(await c.query("SELECT encode(payload_hash,'hex') AS hash,payload FROM atlas_asset_review.snapshot WHERE snapshot_id=$1",[snapshot.id])).rows[0];
  if(old){if(old.hash!==hash||canonical(old.payload)!==canonical(snapshot))throw Error('ASSET_REVIEW_ID_CONFLICT');return {state:'UNCHANGED',inserted:0,profiles:snapshot.profiles.length,inputHash:expectedHash};}
  await c.query('INSERT INTO atlas_asset_review.snapshot(snapshot_id,reviewed_at,profile_count,payload_hash,payload) VALUES($1,$2,$3,$4,$5)',[snapshot.id,snapshot.reviewedAt,snapshot.profiles.length,hashBytes(hash),JSON.stringify(snapshot)]);
  await verifySupplyApiBoundary(c,{schema:'atlas_asset_review',reviewedDefiners});
  return {state:'IMPORTED',inserted:1,profiles:snapshot.profiles.length,features:snapshot.profiles.reduce((n,p)=>n+p.features.length,0),inputHash:expectedHash};
 });
}
export async function readAssetReview(c){return transaction(c,async()=>{
 await access(c);
 const r=(await c.query("SELECT snapshot_id,to_char(reviewed_at,'YYYY-MM-DD') AS reviewed_at,profile_count,encode(payload_hash,'hex') AS hash,payload FROM atlas_asset_review.snapshot ORDER BY reviewed_at DESC,imported_at DESC,snapshot_id DESC LIMIT 1")).rows[0];
 if(!r)throw Error('ASSET_REVIEW_NOT_AVAILABLE');const p=validateAssetReview(r.payload);
 if(p.id!==r.snapshot_id||p.reviewedAt!==r.reviewed_at||p.profiles.length!==r.profile_count||digest(canonical(p))!==r.hash)fail();return p;
},{repeatableRead:true});}
export async function grantAssetReview(c,role,mode,{reviewedDefiners=[]}={}){ident(role);if(!['reader','writer'].includes(mode))fail();return transaction(c,async()=>{await lock(c);await owner(c);await verifyAssetReviewSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_asset_review',reviewedDefiners});await safeRole(c,role);
 if((await c.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=$1',[role])).rows[0]?.access_mode!==mode)fail();
 const prior=(await c.query('SELECT access_mode FROM atlas_asset_review.access_grant WHERE role_name=$1',[role])).rows[0];if(prior){if(prior.access_mode!==mode)fail();return {state:'UNCHANGED',access:mode};}
 await c.query(`GRANT USAGE ON SCHEMA atlas_asset_review TO ${ident(role)}`);for(const table of tables){const prefix='app_'+digest(role).slice(0,12);await c.query(`GRANT SELECT ON atlas_asset_review.${table} TO ${ident(role)}`);await c.query(`CREATE POLICY ${ident(prefix+'_s_'+table)} ON atlas_asset_review.${table} FOR SELECT TO ${ident(role)} USING(true)`);if(mode==='writer'&&['snapshot'].includes(table)){await c.query(`GRANT INSERT ON atlas_asset_review.${table} TO ${ident(role)}`);await c.query(`CREATE POLICY ${ident(prefix+'_i_'+table)} ON atlas_asset_review.${table} FOR INSERT TO ${ident(role)} WITH CHECK(true)`);}}
 await c.query('INSERT INTO atlas_asset_review.access_grant VALUES($1,$2)',[role,mode]);await verifyAssetReviewSchema(c);await verifySupplyApiBoundary(c,{schema:'atlas_asset_review',reviewedDefiners});return {state:'GRANTED',access:mode};
});}
