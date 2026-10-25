import {connectDatabase,databaseConfig,runtimeRole,transaction} from './market-db/connection.mjs';
import {addWebTiming} from './web-timing.mjs';

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

// Bounded physical sessions; each checkout gets an exclusive, revocable facade.
// Recheck privileges on every lease, including reuse. No permission TTL.
export function productionConnector(env,{open=connectDatabase,verify=verifyProductionReader,limit=2,queueLimit=8,queueTimeout=10000,idleTimeout=30000,maxLifetime=300000}={}){
  if(databaseConfig(env.DATABASE_URL).ssl?.rejectUnauthorized!==true)throw Error('DATABASE_TLS_REQUIRED');
  if(!Number.isInteger(limit)||limit<1||limit>4||!Number.isInteger(queueLimit)||queueLimit<0||queueLimit>32||
    ![queueTimeout,idleTimeout,maxLifetime].every(x=>Number.isInteger(x)&&x>0&&x<=300000))throw Error('DATABASE_LIMIT_INVALID');
  let inUse=0,closing=false,closePromise;
  const idle=[],sessions=new Set(),active=new Set(),queue=[],operations=new Set(),disposals=new Set();
  const removeIdle=entry=>{clearTimeout(entry.timer);const i=idle.indexOf(entry);if(i>=0)idle.splice(i,1);};
  const dispose=entry=>{
    removeIdle(entry);entry.broken=true;
    if(entry.disposal)return entry.disposal;
    const p=Promise.resolve().then(()=>entry.client.end()).catch(()=>{}).finally(()=>{sessions.delete(entry);disposals.delete(p);});
    entry.disposal=p;disposals.add(p);return p;
  };
  const releaseSlot=()=>{
    inUse--;
    if(!closing&&queue.length){const next=queue.shift();clearTimeout(next.timer);inUse++;next.resolve();}
  };
  const acquire=()=>{
    if(closing)return Promise.reject(Error('DATABASE_BUSY'));
    if(inUse<limit){inUse++;return Promise.resolve();}
    if(queue.length>=queueLimit)return Promise.reject(Error('DATABASE_BUSY'));
    return new Promise((resolve,reject)=>{const slot={resolve,reject};slot.timer=setTimeout(()=>{const i=queue.indexOf(slot);if(i>=0)queue.splice(i,1);reject(Error('DATABASE_BUSY'));},queueTimeout);queue.push(slot);});
  };
  const run=async()=>{
    const waitStarted=performance.now();try{await acquire();}finally{addWebTiming('dbWaitMs',performance.now()-waitStarted);}
    let entry,lease,release;
    try{
      if(closing)throw Error('DATABASE_BUSY');
      entry=idle.pop();
      while(entry&&(entry.broken||performance.now()-entry.born>=maxLifetime)){await dispose(entry);entry=idle.pop();}
      if(entry){clearTimeout(entry.timer);addWebTiming('dbReused');}
      else{
        // An expired idle session must finish closing before creating its replacement.
        await Promise.allSettled([...disposals]);
        if(closing)throw Error('DATABASE_BUSY');
        const started=performance.now();
        let client;try{client=await open(env);}finally{addWebTiming('dbConnectMs',performance.now()-started);}
        entry={client,born:performance.now(),broken:false};sessions.add(entry);
        client.on?.('error',()=>{entry.broken=true;if(idle.includes(entry))void dispose(entry);});
      }
      let released=false,releasing;const queries=new Set();
      lease={query:(...args)=>{
        if(released||entry.broken||closing)return Promise.reject(Error('DATABASE_LEASE_CLOSED'));
        const started=performance.now();addWebTiming('dbQueryCount');
        const p=Promise.resolve().then(()=>entry.client.query(...args)).catch(error=>{entry.broken=true;throw error;})
          .finally(()=>{addWebTiming('dbQueryMs',performance.now()-started);queries.delete(p);});
        queries.add(p);return p;
      },end:()=>release()};
      release=()=>{
        if(releasing)return releasing;released=true;
        releasing=(async()=>{
          try{
            await Promise.allSettled([...queries]);
            if(!entry.broken&&!closing&&performance.now()-entry.born<maxLifetime){
              // Remove transaction/session state before sharing a physical connection.
              for(const sql of ['ROLLBACK','DISCARD ALL']){
                const started=performance.now();addWebTiming('dbQueryCount');
                try{await entry.client.query(sql);}catch{entry.broken=true;break;}
                finally{addWebTiming('dbQueryMs',performance.now()-started);}
              }
            }else entry.broken=true;
            if(entry.broken||closing)await dispose(entry);
            else{
              idle.push(entry);
              entry.timer=setTimeout(()=>void dispose(entry),Math.min(idleTimeout,Math.max(1,maxLifetime-(performance.now()-entry.born))));entry.timer.unref();
            }
          }finally{active.delete(lease);releaseSlot();}
        })();return releasing;
      };
      active.add(lease);
      if(closing||entry.broken)throw Error('DATABASE_BUSY');
      const started=performance.now();try{await verify(lease);}finally{addWebTiming('dbVerifyMs',performance.now()-started);}
      if(closing||entry.broken)throw Error('DATABASE_BUSY');
      return lease;
    }catch{
      if(entry)entry.broken=true;
      if(release)await release().catch(()=>{});
      else{if(entry)await dispose(entry);releaseSlot();}
      throw Error('DATABASE_READER_UNAVAILABLE');
    }
  };
  const connect=()=>{const p=run();operations.add(p);p.then(()=>operations.delete(p),()=>operations.delete(p));return p;};
  const close=()=>closePromise??=(async()=>{
    closing=true;
    for(const slot of queue.splice(0)){clearTimeout(slot.timer);slot.reject(Error('DATABASE_BUSY'));}
    await Promise.allSettled([...operations]);
    await Promise.allSettled([...active].map(c=>c.end()));
    await Promise.allSettled([...sessions].map(dispose));
    await Promise.allSettled([...disposals]);
  })();
  return {connect,close,get active(){return inUse;}};
}
