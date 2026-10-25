import {connectDatabase,databaseConfig,runtimeRole,transaction} from './market-db/connection.mjs';

export async function verifyProductionReader(client){
  await client.query("SET default_transaction_read_only=on; SET statement_timeout='10s'; SET lock_timeout='3s'; SET idle_in_transaction_session_timeout='15s'");
  return transaction(client,async()=>{
    await runtimeRole(client);
    const {rows:[grant]}=await client.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=current_user');
    if(grant?.access_mode!=='reader')throw Error('DATABASE_READER_REQUIRED');
    // has_*_privilege includes inherited and PUBLIC grants, including column grants.
    const {rows:[bad]}=await client.query(`WITH effective_roles AS (SELECT oid FROM pg_roles WHERE rolname=current_user OR pg_has_role(current_user,oid,'MEMBER')) SELECT
      EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN effective_roles r WHERE n.nspname ~ '^atlas_' AND
        (has_schema_privilege(r.oid,n.oid,'CREATE') OR pg_has_role(r.oid,n.nspowner,'USAGE'))) AS schema_write,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN effective_roles r
        WHERE n.nspname ~ '^atlas_' AND c.relkind IN ('r','p','v','m','f') AND
        (pg_has_role(r.oid,c.relowner,'USAGE') OR has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r.oid,c.oid,'INSERT,UPDATE,REFERENCES'))) AS table_write,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN effective_roles r
        WHERE n.nspname ~ '^atlas_' AND c.relkind='S' AND
        (pg_has_role(r.oid,c.relowner,'USAGE') OR has_sequence_privilege(r.oid,c.oid,'USAGE,UPDATE'))) AS sequence_write,
      EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN effective_roles r
        WHERE n.nspname ~ '^atlas_' AND has_function_privilege(r.oid,p.oid,'EXECUTE')
        AND NOT(p.prokind='f' AND p.prorettype='pg_catalog.trigger'::regtype AND NOT p.prosecdef)) AS function_path`);
    if(Object.values(bad).some(Boolean))throw Error('DATABASE_WEB_PRIVILEGES_UNSAFE');
    return {state:'READER_READY'};
  },{readonly:true});
}

export function productionConnector(env,{open=connectDatabase,verify=verifyProductionReader,limit=2,queueLimit=8,queueTimeout=10000}={}){
  if(databaseConfig(env.DATABASE_URL).ssl?.rejectUnauthorized!==true)throw Error('DATABASE_TLS_REQUIRED');
  if(!Number.isInteger(limit)||limit<1||limit>4)throw Error('DATABASE_LIMIT_INVALID');
  let inUse=0,closing=false;const active=new Set(),queue=[],operations=new Set();
  const releaseSlot=()=>{
    inUse--;
    if(!closing&&queue.length){const next=queue.shift();clearTimeout(next.timer);inUse++;next.resolve();}
  };
  const acquire=()=>{
    if(closing)return Promise.reject(Error('DATABASE_BUSY'));
    if(inUse<limit){inUse++;return Promise.resolve();}
    if(queue.length>=queueLimit)return Promise.reject(Error('DATABASE_BUSY'));
    return new Promise((resolve,reject)=>{const slot={resolve,reject};slot.timer=setTimeout(()=>{queue.splice(queue.indexOf(slot),1);reject(Error('DATABASE_BUSY'));},queueTimeout);queue.push(slot);});
  };
  const run=async()=>{
    await acquire();if(closing){releaseSlot();throw Error('DATABASE_BUSY');}let client,release;
    try{
      client=await open(env);const end=client.end.bind(client);let ended=false;
      release=async()=>{if(ended)return;ended=true;try{await end();}finally{active.delete(client);releaseSlot();}};
      client.end=release;active.add(client);if(closing)throw Error('DATABASE_BUSY');await verify(client);return client;
    }catch{if(release)await release().catch(()=>{});else releaseSlot();throw Error('DATABASE_READER_UNAVAILABLE');}
  };
  const connect=()=>{const p=run();operations.add(p);p.then(()=>operations.delete(p),()=>operations.delete(p));return p;};
  return {connect,close:async()=>{closing=true;for(const slot of queue.splice(0)){clearTimeout(slot.timer);slot.reject(Error('DATABASE_BUSY'));}await Promise.allSettled([...operations]);await Promise.allSettled([...active].map(c=>c.end()));},get active(){return inUse;}};
}
