import {connectDatabase} from './connection.mjs';
import {readActivity} from './activity.mjs';
export function databaseActivityReader({env,connect=connectDatabase,read=readActivity,now=Date.now}={}){
 let pending,cache,expires=0;
 return ()=>{if(cache&&expires>now())return Promise.resolve(cache);if(pending)return pending;pending=(async()=>{let c;try{c=await connect(env);const value=await read(c);if(Buffer.byteLength(JSON.stringify(value))>128*1024)throw Error('READ_LIMIT');cache=value;expires=now()+10000;return value;}finally{await c?.end().catch(()=>{});}})();pending.finally(()=>{pending=null;}).catch(()=>{});return pending;};
}
