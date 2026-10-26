import {connectDatabase} from './connection.mjs';
import {readAssetReview} from './asset-review.mjs';
import {validateAssetReview} from '../../web/asset-review-model.js';
export const assetReviewCacheTtlMs=60*60*1000;
export function databaseAssetReviewReader({env,connect=connectDatabase,read=readAssetReview,now=Date.now}={}){
 let pending,cache,expires=0;
 return ()=>{
  if(cache&&expires>now())return Promise.resolve(cache);
  if(pending)return pending;
  pending=(async()=>{let c;try{
   c=await connect(env);cache=validateAssetReview(await read(c));expires=now()+assetReviewCacheTtlMs;return cache;
  }catch{throw Error('ASSET_REVIEW_UNAVAILABLE');}finally{await c?.end().catch(()=>{});}})();
  pending.finally(()=>{pending=null;}).catch(()=>{});return pending;
 };
}
