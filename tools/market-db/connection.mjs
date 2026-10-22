import pg from 'pg';
import {boundedRead} from '../evidence-store.mjs';
import {fail} from './plan.mjs';
export function databaseConfig(value,{ca}={}){
  let url;try{url=new URL(value);}catch{fail('DATABASE_CONFIG_INVALID');}
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.username||!url.password||!url.pathname||url.pathname==='/')fail('DATABASE_CONFIG_INVALID');
  if(url.hash||[...url.searchParams.keys()].some(k=>k!=='sslmode')||url.searchParams.getAll('sslmode').length>1)fail('DATABASE_CONFIG_INVALID');
  const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname),mode=url.searchParams.get('sslmode');
  if(mode!==null&&!['require','verify-full'].includes(mode))fail('DATABASE_CONFIG_INVALID');
  const port=url.port?Number(url.port):5432;if(!Number.isInteger(port)||port<1||port>65535)fail('DATABASE_CONFIG_INVALID');
  return {host:url.hostname.replace(/^\[|\]$/g,''),port,user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:decodeURIComponent(url.pathname.slice(1)),
    ssl:local&&mode===null?false:{rejectUnauthorized:true,...(ca?{ca}:{})},connectionTimeoutMillis:5000,query_timeout:15000,application_name:'atlas-market-db'};
}
export async function connectDatabase(env){
  const ca=env.DATABASE_CA_FILE?(await boundedRead(env.DATABASE_CA_FILE,1024*1024)).toString('utf8'):undefined;
  const client=new pg.Client(databaseConfig(env.DATABASE_URL,{ca}));
  // Error text can contain credentials/hostnames. It must never reach CLI logs.
  client.on('error',()=>{});
  try{await client.connect();return client;}catch{await client.end().catch(()=>{});fail('DATABASE_CONNECT_FAILED');}
}
const activeTransactions=new WeakSet();
export async function transaction(client,operation,{readonly=false}={}){
  if(activeTransactions.has(client))fail('DATABASE_CLIENT_BUSY');activeTransactions.add(client);let begun=false;
  try{
    await client.query(readonly?'BEGIN READ ONLY':'BEGIN');begun=true;
    const version=(await client.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version;
    if(version<170000)fail('DATABASE_VERSION_UNSUPPORTED');
    await client.query("SET LOCAL search_path=pg_catalog; SET LOCAL timezone='UTC'; SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='3s'; SET LOCAL idle_in_transaction_session_timeout='15s'; SET LOCAL transaction_timeout='60s'");
    const result=await operation();await client.query('COMMIT');begun=false;return result;
  }catch(error){if(begun)await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{activeTransactions.delete(client);}
}
export async function safeRole(client,role){
  const {rows}=await client.query(`WITH RECURSIVE memberships AS (
    SELECT oid,rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,rolcanlogin FROM pg_roles WHERE rolname=$1
    UNION SELECT r.oid,r.rolname,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,r.rolcanlogin FROM memberships m JOIN pg_auth_members a ON a.member=m.oid JOIN pg_roles r ON r.oid=a.roleid
  ) SELECT count(*)::int AS count,bool_or(rolname=$1 AND rolcanlogin) AS login,coalesce(bool_or(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolname ~ '^pg_'
    OR oid=(SELECT nspowner FROM pg_namespace WHERE nspname='atlas_market')
    OR oid=(SELECT datdba FROM pg_database WHERE datname=current_database())),true) AS elevated FROM memberships`,[role]);
  if(rows[0].count===0||!rows[0].login||rows[0].elevated||/^(?:postgres|anon|authenticated|authenticator|service_role|supabase.*|pg_.*)$/.test(role))fail('DATABASE_ROLE_UNSAFE');
  const permissions=(await client.query("SELECT has_schema_privilege($1,'atlas_market','CREATE') OR has_database_privilege($1,current_database(),'CREATE') AS ddl",[role])).rows[0];
  if(permissions.ddl)fail('DATABASE_ROLE_UNSAFE');
}
export async function runtimeRole(client){
  const {rows:[row]}=await client.query('SELECT current_user AS active,session_user AS login');
  if(row.active!==row.login)fail('DATABASE_ROLE_UNSAFE');await safeRole(client,row.active);
}
