import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {emptyGeography,validateGeography} from '../web/geography-model.js';
import {geographyPlan,projectGeographyBalances} from './allium-geography.mjs';
import {alliumHash,alliumExecutionStorage as io} from './allium-executor.mjs';
import {canonical} from './market-db/plan.mjs';
import {file} from './allium-offline-files.mjs';
import {boundedRead} from './evidence-store.mjs';
const root=fileURLToPath(new URL('../.state/allium-executor/',import.meta.url));
const published=fileURLToPath(new URL('../.state/allium-geography-preview/',import.meta.url));
// Explicit offline publication. The web reader never reads the executor archive or executes this publisher.
export async function publishGeographyAvailability({executionRoot=root,outputDirectory=published,kind='discovery'}={}){
 if(!['discovery','balances'].includes(kind))throw Error('GEOGRAPHY_PUBLISH_BLOCKED');
 const archive=join(executionRoot,'geography-once',kind);
 const receiptBytes=Buffer.from(await file(join(archive,'receipt.json'),131072)),r=JSON.parse(receiptBytes),b=Buffer.from(await file(join(archive,'authorization.json'),65536)),a=JSON.parse(b),plan=geographyPlan(kind);
 if(r.kind!=='ALLIUM_GEOGRAPHY_RECEIPT'||!['UNKNOWN','SUCCEEDED'].includes(r.state)||r.authorizationHash!==alliumHash(b)||r.planHash!==alliumHash(Buffer.from(canonical(plan)))||canonical(a.plan)!==canonical(plan)||!Array.isArray(r.attempts)||!r.attempts.length||r.attempts.length>13||r.attempts.filter(x=>x.kind==='run').length>1)throw Error('GEOGRAPHY_PUBLISH_BLOCKED');
 for(const [i,attempt]of r.attempts.entries()){
  const intent=JSON.parse(await file(join(archive,`intent-${i}.json`),65536));
  if(attempt.index!==i||intent.index!==i||attempt.at!==intent.at||attempt.kind!==intent.kind||Date.parse(attempt.at)<Date.parse(a.authorizedAt)||Date.parse(attempt.at)>=Date.parse(a.expiresAt))throw Error('GEOGRAPHY_PUBLISH_BLOCKED');
  if(attempt.responseHash&&alliumHash(Buffer.from(await file(join(archive,`response-${i}.json`),2097152)))!==attempt.responseHash)throw Error('GEOGRAPHY_PUBLISH_BLOCKED');
 }
 let dto;
 if(kind==='balances'&&(r.state==='SUCCEEDED'||r.failure==='SQL_ECHO_REVIEW_REQUIRED')){
  const review=JSON.parse(await file(join(archive,'review.json'),2097152)),rawBytes=Buffer.from(await file(join(archive,`response-${r.resultAttempt}.json`),2097152)),raw=JSON.parse(rawBytes);
  if(review.kind!=='ALLIUM_GEOGRAPHY_BALANCES_REVIEW'||review.reviewStatus!=='SOURCE_REVIEWED'||review.sourceHash!==r.sourceHash||review.sourceHash!==alliumHash(rawBytes)||review.receiptHash!==alliumHash(receiptBytes)||review.requestSqlHash!==plan.sqlHash||review.responseSqlHash!==alliumHash(Buffer.from(raw.sql))||review.queriedAt!==raw.queried_at||review.day!==plan.day||canonical(review.rows)!==canonical(projectGeographyBalances(raw,plan)))throw Error('GEOGRAPHY_PUBLISH_BLOCKED');
  const state=review.rows.length?'OBSERVED':'MISSING';
  dto=validateGeography({...emptyGeography(),attemptKind:kind,state,checkedAt:r.attempts.at(-1).at,reason:null,httpAttempts:r.attempts.length,observations:review.rows.length,balanceSnapshot:{day:plan.day,queriedAt:review.queriedAt,reviewStatus:'SOURCE_REVIEWED',scope:'ATTRIBUTED_WALLETS_ONLY',sourceHash:review.sourceHash,requestSqlHash:plan.sqlHash,responseSqlHash:review.responseSqlHash,rows:review.rows},metrics:emptyGeography().metrics.map(m=>m.metric==='COUNTRY_BALANCE'?{...m,state,dataState:state==='OBSERVED'?'OBSERVED':'MISSING'}:m)});
 }else dto=validateGeography({...emptyGeography(),attemptKind:kind,state:'UNKNOWN',checkedAt:r.attempts.at(-1).at,reason:r.failure,httpAttempts:r.attempts.length,metrics:emptyGeography().metrics.map(m=>kind==='balances'&&m.metric==='COUNTRY_BALANCE'?{...m,state:'INCONCLUSIVE'}:m)});
 if(dto.state==='UNKNOWN'){
  const previous=await geographyReader({directory:outputDirectory})();
  if(previous.balanceSnapshot)dto=validateGeography({...previous,lastFailure:{checkedAt:dto.checkedAt,attemptKind:kind,reason:dto.reason}});
 }
 await io.privateDirectory(outputDirectory);await io.snapshot(join(outputDirectory,'index.json'),dto);return dto;
}
export function geographyReader({directory=published}={}){return async()=>{
 try{const b=await boundedRead(join(directory,'index.json'),2097152);return validateGeography(JSON.parse(b));}
 catch(e){if(e.code==='ENOENT')return emptyGeography();throw Error('GEOGRAPHY_UNAVAILABLE');}
};}
