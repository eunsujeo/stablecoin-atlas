import {connectDatabase} from './connection.mjs';
import {readSupply} from './allium-supply.mjs';
import {validateReviewedSupply,reviewedWindow} from '../../web/reviewed-supply-model.js';
// One fixed dataset, one connection at a time; failures also receive a 10s cooldown.
export function databaseReviewedSupplyReader({env,connect=connectDatabase,read=readSupply,now=Date.now}={}){
 let pending,cache,failed=false,expires=0;
 return ()=>{
  if(expires>now())return failed?Promise.reject(Error('REVIEWED_SUPPLY_UNAVAILABLE')):Promise.resolve(cache);
  if(pending)return pending;
  pending=(async()=>{
   let c;try{
    c=await connect(env);const raw=await read(c,{...reviewedWindow});
    if(Buffer.byteLength(JSON.stringify(raw))>32*1024)throw Error('READ_LIMIT');
    cache=validateReviewedSupply(raw);failed=false;return cache;
   }catch{failed=true;throw Error('REVIEWED_SUPPLY_UNAVAILABLE');}
   finally{await c?.end().catch(()=>{});expires=now()+10000;}
  })();
  pending.finally(()=>{pending=null;}).catch(()=>{});return pending;
 };
}
