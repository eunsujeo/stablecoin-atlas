// Stored ADR0083 responses only; no network, credentials, DB or UI.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {priceHash,parsePriceBytes,numericLexeme,utc,reviewCapabilitySources,savePriceReview} from './provider-price-review.mjs';
import {capabilitySlot} from './provider-capability-plan.mjs';

export const arkhamPriceIds=['arkham-market','arkham-price-history'];
export const marketFields=['price','totalVolume','price24hAgo','maxPrice24h','minPrice24h','circulatingSupply','totalSupply','price7dAgo','price30dAgo','price180dAgo','allTimeHigh','allTimeLow','marketCap','fullyDilutedValue'];
const historyFields=['usd','volume24h','marketCap'];
const fail=code=>{throw Error(code);};
function object(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('OBJECT_INVALID');
 if(Object.hasOwn(value,'error')||Object.hasOwn(value,'errors'))fail('PROVIDER_ERROR_BODY');
 return value;
}
function fields(row,names){return Object.fromEntries(names.map(key=>[key,numericLexeme(row[key])]));}
export function reviewArkhamPriceSource(id,bytes,expectedHash){
 const out={id,sourceHash:Buffer.isBuffer(bytes)?priceHash(bytes):null,state:'INCONCLUSIVE',issues:[],observations:null,
  requestAsset:'usd-coin',identityBasis:'PINNED_REQUEST_PATH_ONLY',responseAssetIdentity:'UNKNOWN',
  currencyStatus:'UNKNOWN',historyCompleteness:'UNKNOWN',providerDefinitions:'UNKNOWN',
  chainSupply:'NOT_OBSERVED',marketAsOf:'UNKNOWN'};
 try{
  if(!arkhamPriceIds.includes(id))fail('JOB_UNSUPPORTED');
  if(typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHash)||out.sourceHash!==expectedHash)fail('SOURCE_HASH_MISMATCH');
  const data=parsePriceBytes(bytes);
  if(id==='arkham-market'){
   object(data);
   out.observations={fields:fields(data,marketFields),supplyScope:'WHOLE_COIN_NOT_CHAIN',
    supplyFields:{circulatingSupply:'COIN_CIRCULATING_SUPPLY',totalSupply:'COIN_TOTAL_SUPPLY'},sourceTimestamp:null};
  }else{
   if(!Array.isArray(data)){object(data);fail('HISTORY_ARRAY_MISSING');}
   if(!data.length)fail('HISTORY_EMPTY');
   const points=data.map(row=>{object(row);return {time:utc(row.time),...fields(row,historyFields)};});
   if(points.some((p,i)=>i>0&&Date.parse(p.time)<=Date.parse(points[i-1].time)))fail('HISTORY_TIME_ORDER_INVALID');
   out.observations={points,pointCount:points.length,currencyFieldLabel:'usd',
    requestedWindow:null,observedWindow:{first:points[0].time,last:points.at(-1).time},order:'STRICTLY_ASCENDING'};
  }
  out.state='FIELD_CONTRACT_OBSERVED';
 }catch(e){out.observations=null;out.issues=[e.message];}
 return out;
}
export async function reviewArkhamPriceArchive(archive,receiptHash){
 return {...await reviewCapabilitySources(archive,receiptHash,arkhamPriceIds,reviewArkhamPriceSource),kind:'OFFLINE_ARKHAM_PRICE_REVIEW'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length!==4)fail('USAGE_RECEIPT_HASH_AND_NEW_REPORT_NAME_REQUIRED');
  const report=await reviewArkhamPriceArchive(resolve('.state/allium-executor',capabilitySlot),process.argv[2]);
  await savePriceReview(resolve('.state/provider-price-review'),process.argv[3],report);
  console.log(JSON.stringify({kind:report.kind,rows:report.rows.map(({id,state,issues})=>({id,state,issues}))}));
  if(report.rows.some(r=>r.state!=='FIELD_CONTRACT_OBSERVED'))process.exitCode=1;
 }catch(e){console.error(/^[A-Z_]+$/.test(e.message)?e.message:'OFFLINE_REVIEW_FAILED');process.exitCode=1;}
}
