import {connectDatabase} from './connection.mjs';
import {readNetworkUsage} from './network-usage.mjs';
import {validateNetworkUsage} from '../../web/network-usage-model.js';
export const networkUsageCacheTtlMs=5*60*1000;
export function databaseNetworkUsageReader({env,connect=connectDatabase,read=readNetworkUsage,now=Date.now}={}){
 let pending,cache,expires=0;
 return ()=>{
  if(cache&&expires>now())return Promise.resolve(cache);
  if(pending)return pending;
  pending=(async()=>{let c;try{
   c=await connect(env);cache=validateNetworkUsage(await read(c));expires=now()+networkUsageCacheTtlMs;return cache;
  }catch{throw Error('NETWORK_USAGE_UNAVAILABLE');}finally{await c?.end().catch(()=>{});}})();
  pending.finally(()=>{pending=null;}).catch(()=>{});return pending;
 };
}
