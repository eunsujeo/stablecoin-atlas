import {connectDatabase} from './connection.mjs';
import {readContractReviews} from './contract-review.mjs';
import {validateContractReviewStore} from '../../web/contract-review-model.js';
export const contractReviewCacheTtlMs=60*60*1000;
export function databaseContractReviewReader({env,connect=connectDatabase,read=readContractReviews,now=Date.now}={}){
 let pending,cache,expires=0;
 return ()=>{
  if(cache&&expires>now())return Promise.resolve(cache);
  if(pending)return pending;
  pending=(async()=>{let c;try{
   c=await connect(env);cache=validateContractReviewStore(await read(c));expires=now()+contractReviewCacheTtlMs;return cache;
  }catch{throw Error('CONTRACT_REVIEW_UNAVAILABLE');}finally{await c?.end().catch(()=>{});}})();
  pending.finally(()=>{pending=null;}).catch(()=>{});return pending;
 };
}
