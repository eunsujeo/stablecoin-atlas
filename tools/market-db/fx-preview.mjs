import {connectDatabase} from './connection.mjs';
import {readFXSnapshot} from './fx.mjs';
import {validateFX,usableFX} from '../../web/fx-model.js';

// Share only an in-flight read: every later request checks DB and freshness again.
export function databaseFXReader({env,connect=connectDatabase,read=readFXSnapshot,now=Date.now}={}){
 let pending;
 return ()=>{
  if(pending)return pending;
  pending=(async()=>{let c;try{
   c=await connect(env);const at=now(),p=validateFX(await read(c,{now:at}));
   if(!usableFX(p,at)||Date.parse(p.fetchedAt??p.importedAt)>at)throw Error('FX_UNAVAILABLE');
   return Object.fromEntries(['schemaVersion','kind','base','date','usdPerEUR','krwPerEUR','sourceHash','fetchedAt','importedAt'].map(k=>[k,p[k]]));
  }catch{throw Error('FX_UNAVAILABLE');}finally{await c?.end().catch(()=>{});}})();
  pending.finally(()=>{pending=null;}).catch(()=>{});return pending;
 };
}
