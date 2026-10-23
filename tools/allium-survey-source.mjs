import {readFile} from 'node:fs/promises';
import {alliumPlan,alliumSurveyResult} from './allium-plan.mjs';
import {supplyHash} from './allium-supply-source.mjs';
import {parseHistorySource} from './supply-history-source.mjs';
import {validateSurveySnapshot,surveyTargets} from '../web/survey-model.js';
export const surveyMapper='allium-stored-survey-v1';
export const surveyPlanHash='1b4318b699f0620bcff4c52587201d8bbaa0b45860dd777df35f6b81407e8797';
const fail=()=>{throw Error('ALLIUM_SURVEY_SOURCE_INVALID');};
export async function storedSurveyPlan(){
 const [metadata,legacy]=await Promise.all([readFile(new URL('../data/market-registration.json',import.meta.url)),readFile(new URL('../data/asset-registry.json',import.meta.url))]);
 const plan=alliumPlan(JSON.parse(metadata),JSON.parse(legacy),{asOfDay:'2026-10-23'});
 if(plan.planHash!==surveyPlanHash||surveyTargets.some(t=>!plan.targets.some(p=>p.deploymentId===t.deploymentId&&p.coinId===t.coinId&&p.networkId===t.networkId&&p.networkIdentity===t.networkIdentity)))fail();return plan;
}
export function surveySource(bytes,{plan,kind,expectedHash,reviewBytes,reviewHash,receiptBytes,now=new Date().toISOString()}={}){
 if(plan?.planHash!==surveyPlanHash||!['supply','volume'].includes(kind)||!Buffer.isBuffer(reviewBytes)||reviewBytes.length>65536||supplyHash(reviewBytes)!==reviewHash||!Buffer.isBuffer(receiptBytes)||receiptBytes.length>131072)fail();
 parseHistorySource(reviewBytes);parseHistorySource(receiptBytes);
 const manifest=JSON.parse(reviewBytes),receipt=JSON.parse(receiptBytes),record=receipt.jobs?.find(j=>j.kind===kind);
 if(manifest.schemaVersion!==1||manifest.kind!=='ALLIUM_REVIEWED_SQL_ECHO'||manifest.planHash!==plan.planHash||manifest.receiptHash!==supplyHash(receiptBytes)||!Array.isArray(manifest.reviews)||manifest.reviews.length>3||manifest.reviews.filter(r=>r.kind===kind).length!==1||receipt.kind!=='ALLIUM_SURVEY_RECEIPT'||receipt.planHash!==plan.planHash||receipt.state!=='UNKNOWN'||record?.sourceHash!==expectedHash||receipt.attempts?.[record.resultAttempt]?.responseHash!==expectedHash)fail();
 const sqlReview=manifest.reviews.find(r=>r.kind===kind);
 if(sqlReview.reviewStatus!=='SOURCE_REVIEWED')fail();
 const snapshot=validateSurveySnapshot(alliumSurveyResult(plan,kind,bytes,{expectedHash,now,sqlReview}));
 if(snapshot.sqlReviewStatus!=='SOURCE_REVIEWED')fail();
 const metadata={mapper:surveyMapper,kind,planHash:plan.planHash,sourceHash:expectedHash,reviewHash,receiptHash:manifest.receiptHash,queriedAt:snapshot.queriedAt,from:snapshot.window.from,to:'2026-10-22',projectionHash:supplyHash(snapshot)};
 return {...metadata,id:supplyHash(metadata),snapshot};
}
