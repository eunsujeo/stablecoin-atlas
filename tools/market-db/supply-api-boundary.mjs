// Read-only, conservative checks of effective access. Dashboard exposure is a separate fact.
import {createHash} from 'node:crypto';
const apiRoles=['anon','authenticated','authenticator','service_role'];
const fail=()=>{throw Error('SUPPLY_API_BOUNDARY_UNCONFIRMED');};
const hash=value=>createHash('sha256').update(value).digest('hex');
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export async function definerSchemaHash(c,namespace){
 if(typeof namespace!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(namespace))fail();
 const foreignRules=(await c.query(`SELECT 1 FROM pg_rewrite rw JOIN pg_class t ON t.oid=rw.ev_class JOIN pg_namespace n ON n.oid=t.relnamespace
 JOIN pg_depend d ON d.classid='pg_rewrite'::regclass AND d.objid=rw.oid
 CROSS JOIN LATERAL pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid) obj(object_type,object_schema,object_name,object_identity)
 WHERE n.nspname=$1 AND obj.object_schema IS NOT NULL AND obj.object_schema NOT IN($1,'pg_catalog') LIMIT 1`,[namespace])).rowCount;
 if(foreignRules)fail();
 const rows=(await c.query(`SELECT 'schema:'||n.nspname AS key,n.nspowner::text||':'||coalesce(n.nspacl::text,'') AS value FROM pg_namespace n WHERE n.nspname=$1
 UNION ALL SELECT 'function:'||p.oid::text,p.proowner::text||':'||coalesce(p.proacl::text,'')||':'||pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1
 UNION ALL SELECT 'relation:'||t.oid::text,t.relname||':'||t.relkind::text||':'||t.relowner::text||':'||coalesce(t.relacl::text,'')||':'||t.relrowsecurity::text||':'||t.relforcerowsecurity::text FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1
 UNION ALL SELECT 'column:'||a.attrelid::text||':'||a.attnum::text,a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||coalesce(a.attacl::text,'')||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),'') FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid JOIN pg_namespace n ON n.oid=t.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname=$1 AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'view:'||t.oid::text,pg_get_viewdef(t.oid,true) FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 AND t.relkind IN('v','m')
 UNION ALL SELECT 'trigger:'||tr.oid::text,pg_get_triggerdef(tr.oid,true)||':'||tr.tgenabled::text FROM pg_trigger tr JOIN pg_class t ON t.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1
 UNION ALL SELECT 'rule:'||rw.oid::text,rw.ev_class::text||':'||rw.rulename||':'||rw.ev_enabled::text||':'||pg_get_ruledef(rw.oid,true) FROM pg_rewrite rw JOIN pg_class t ON t.oid=rw.ev_class JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1
 UNION ALL SELECT 'constraint:'||co.oid::text,pg_get_constraintdef(co.oid,true) FROM pg_constraint co JOIN pg_namespace n ON n.oid=co.connamespace WHERE n.nspname=$1
 UNION ALL SELECT 'index:'||i.indexrelid::text,pg_get_indexdef(i.indexrelid) FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1
 UNION ALL SELECT 'policy:'||p.oid::text,coalesce(pg_get_expr(p.polqual,p.polrelid),'')||':'||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')||':'||p.polroles::text||':'||p.polcmd::text||':'||p.polpermissive::text FROM pg_policy p JOIN pg_class t ON t.oid=p.polrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1
 UNION ALL SELECT 'extension:'||d.classid::text||':'||d.objid::text,e.extname||':'||e.extversion||':'||e.extowner::text FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid WHERE d.deptype='e' AND (d.objid IN(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1) OR d.objid IN(SELECT t.oid FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1))
 ORDER BY key`,[namespace])).rows;
 if(!rows.length)fail();return hash(JSON.stringify({version:2,namespace,rows}));
}
export async function verifySupplyApiBoundary(c,{privateRoles=[],reviewedDefiners=[],schema='atlas_supply'}={}){
 if(!['atlas_supply','atlas_survey','atlas_contract_review','atlas_asset_review'].includes(schema))fail();
 if(!Array.isArray(privateRoles)||privateRoles.some(r=>typeof r!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(r)))fail();
 if(!Array.isArray(reviewedDefiners)||reviewedDefiners.length>16||reviewedDefiners.some(r=>!r||r.state!=='SOURCE_REVIEWED'||typeof r.namespace!=='string'||typeof r.name!=='string'||typeof r.arguments!=='string'||r.arguments.length>512||!hex(r.definitionHash)||!hex(r.schemaHash)))fail();
 const roles=(await c.query('SELECT oid,rolname,rolsuper,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=ANY($1)',[apiRoles])).rows;
 if(roles.length!==4||roles.some(r=>r.rolsuper||r.rolcreaterole))fail();
 const forbidden=(await c.query(`WITH RECURSIVE reach(root,member) AS (
 SELECT oid,oid FROM pg_roles WHERE rolname=ANY($1)
 UNION SELECT r.root,m.roleid FROM reach r JOIN pg_auth_members m ON m.member=r.member)
 SELECT 1 FROM reach JOIN pg_roles r ON r.oid=reach.member WHERE r.rolsuper OR r.rolcreaterole
 OR r.oid=(SELECT nspowner FROM pg_namespace WHERE nspname='${schema}')
 OR r.rolname=ANY($2) OR r.rolname IN(SELECT role_name FROM ${schema}.access_grant) LIMIT 1`,[apiRoles,privateRoles])).rowCount;
 if(forbidden)fail();
 const acl=(await c.query(`SELECT 1 FROM pg_roles r WHERE r.rolname=ANY($1) AND (
 has_schema_privilege(r.oid,'${schema}','USAGE,CREATE')
 OR EXISTS(SELECT 1 FROM pg_class t WHERE t.relnamespace='${schema}'::regnamespace AND t.relkind IN('r','p','v','m','f') AND has_table_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
 OR EXISTS(SELECT 1 FROM pg_class t JOIN pg_attribute a ON a.attrelid=t.oid WHERE t.relnamespace='${schema}'::regnamespace AND t.relkind IN('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(r.oid,t.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES'))
 OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='${schema}'::regnamespace AND has_function_privilege(r.oid,p.oid,'EXECUTE'))) LIMIT 1`,[apiRoles])).rowCount;
 if(acl)fail();
 const publicAcl=(await c.query(`SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='${schema}' AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_class t CROSS JOIN LATERAL aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) a WHERE t.relnamespace='${schema}'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_attribute col JOIN pg_class t ON t.oid=col.attrelid CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE t.relnamespace='${schema}'::regnamespace AND a.grantee=0
 UNION ALL SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='${schema}'::regnamespace AND a.grantee=0`)).rowCount;
 if(publicAcl)fail();
 const defaults=(await c.query(`SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 WHERE d.defaclrole=(SELECT nspowner FROM pg_namespace WHERE nspname='${schema}') AND d.defaclnamespace IN(0,'${schema}'::regnamespace)
 AND (a.grantee=0 OR a.grantee IN(SELECT oid FROM pg_roles WHERE rolname=ANY($1))) LIMIT 1`,[apiRoles])).rowCount;
 if(defaults)fail();
 const viewBypass=(await c.query(`WITH RECURSIVE visible AS (
 SELECT t.oid FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE t.relkind IN('v','m') AND n.nspname NOT IN('pg_catalog','information_schema')
 AND EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname=ANY($1) AND has_schema_privilege(r.oid,n.oid,'USAGE') AND (has_table_privilege(r.oid,t.oid,'SELECT') OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(r.oid,t.oid,a.attnum,'SELECT'))))),
 dependencies(root,relation) AS (SELECT oid,oid FROM visible UNION SELECT v.root,d.refobjid FROM dependencies v JOIN pg_rewrite rw ON rw.ev_class=v.relation JOIN pg_depend d ON d.objid=rw.oid AND d.classid='pg_rewrite'::regclass AND d.refclassid='pg_class'::regclass)
 SELECT 1 FROM dependencies v JOIN pg_class t ON t.oid=v.relation WHERE t.relnamespace='${schema}'::regnamespace LIMIT 1`,[apiRoles])).rowCount;
 if(viewBypass)fail();
 // Unknown definers block. Explicit source reviews pin both the routine and its schema closure.
 const definers=(await c.query(`SELECT n.nspname AS namespace,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles owner ON owner.oid=p.proowner
 WHERE p.prosecdef AND n.nspname NOT IN('pg_catalog','information_schema')
 AND EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname=ANY($1) AND has_schema_privilege(r.oid,n.oid,'USAGE') AND has_function_privilege(r.oid,p.oid,'EXECUTE'))
 AND (owner.rolsuper OR (has_schema_privilege(owner.oid,'${schema}','USAGE') AND EXISTS(SELECT 1 FROM pg_class t WHERE t.relnamespace='${schema}'::regnamespace AND t.relkind IN('r','p','v','m','f') AND (has_table_privilege(owner.oid,t.oid,'SELECT') OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(owner.oid,t.oid,a.attnum,'SELECT')))))) LIMIT 17`,[apiRoles])).rows;
 if(definers.length>16)fail();const schemaHashes=new Map();
 for(const d of definers){const matches=reviewedDefiners.filter(r=>r.namespace===d.namespace&&r.name===d.name&&r.arguments===d.arguments&&r.definitionHash===hash(d.definition));if(matches.length!==1)fail();
  if(!schemaHashes.has(d.namespace))schemaHashes.set(d.namespace,await definerSchemaHash(c,d.namespace));if(schemaHashes.get(d.namespace)!==matches[0].schemaHash)fail();
 }
 return {state:'VERIFIED_EFFECTIVE_ACCESS_DENIED',apiRoles:roles.length,bypassRlsRoles:roles.filter(r=>r.rolbypassrls).length,
  dashboardExposedSchemas:'UNKNOWN',schemaTableColumnFunctionDenied:true,privateRolePathsDenied:true,publicAndDefaultAclChecked:true,viewAccessToSupplyDenied:true,reviewedDefiners:definers.length,unreviewedDefinersBlocked:true};
}
