import {surveyTargets} from './survey-model.js';
export const geographyStates=Object.freeze({
 COUNTRY_BALANCE:'국가·지역별 추정 보유 잔액',
 COUNTRY_ACTIVITY:'국가·지역별 사용량',
 CROSS_BORDER_FLOW:'국가간 전송량',
});
const fail=()=>{throw Error('INVALID_GEOGRAPHY_AVAILABILITY');};
// This DTO contains availability evidence only. It cannot turn failed discovery into financial observations.
export function validateGeography(p){
 if(!p||p.version!==1||p.kind!=='ALLIUM_GEOGRAPHY_AVAILABILITY'||p.provider!=='allium'||!['NOT_TESTED','UNKNOWN','OBSERVED','MISSING'].includes(p.state)||!Number.isInteger(p.observations)||p.observations<0||p.observations>3300||!Array.isArray(p.metrics)||p.metrics.length!==3)fail();
 const attempted=p.state!=='NOT_TESTED',reviewed=['OBSERVED','MISSING'].includes(p.state);
 if(attempted?typeof p.checkedAt!=='string'||!Number.isFinite(Date.parse(p.checkedAt))||!Number.isInteger(p.httpAttempts)||p.httpAttempts<1||p.httpAttempts>13|| (reviewed?p.reason!==null:!['PROVIDER_RUN_FAILED','RUN_NOT_CONFIRMED','SQL_ECHO_REVIEW_REQUIRED','RESULT_TRUNCATED_OR_INVALID','REQUEST_OR_EVIDENCE_UNCONFIRMED','LEGACY_CHANGED'].includes(p.reason)): p.checkedAt!==null||p.reason!==null||p.httpAttempts!==0)fail();
 const balanceSnapshot=reviewed?validateBalanceSnapshot(p.balanceSnapshot):null;
 if(p.observations!==(balanceSnapshot?.rows.length??0)||p.state==='OBSERVED'&&!p.observations||p.state==='MISSING'&&p.observations)fail();
 const attemptKind=p.attemptKind??'discovery';if(!['discovery','balances'].includes(attemptKind))fail();
 const metrics=Object.keys(geographyStates).map(key=>{
  const matches=p.metrics.filter(m=>m.metric===key);if(matches.length!==1)fail();const m=matches[0];
  const state=key==='COUNTRY_BALANCE'?(reviewed?p.state:attemptKind==='balances'&&p.state==='UNKNOWN'?'INCONCLUSIVE':'NOT_TESTED'):'NOT_TESTED';
  if(m.state!==state||m.dataState!==(state==='OBSERVED'?'OBSERVED':'MISSING')||m.schemaState!==(key==='COUNTRY_BALANCE'?'PUBLIC_SCHEMA_REVIEWED':'UNKNOWN'))fail();
  return {metric:key,state,dataState:m.dataState,schemaState:m.schemaState};
 });
 let lastFailure;
 if(p.lastFailure){const f=p.lastFailure;if(!balanceSnapshot||typeof f.checkedAt!=='string'||!Number.isFinite(Date.parse(f.checkedAt))||!['discovery','balances'].includes(f.attemptKind)||!['PROVIDER_RUN_FAILED','RUN_NOT_CONFIRMED','SQL_ECHO_REVIEW_REQUIRED','RESULT_TRUNCATED_OR_INVALID','REQUEST_OR_EVIDENCE_UNCONFIRMED','LEGACY_CHANGED'].includes(f.reason))fail();lastFailure={checkedAt:f.checkedAt,attemptKind:f.attemptKind,reason:f.reason};}
 return {version:1,kind:'ALLIUM_GEOGRAPHY_AVAILABILITY',provider:'allium',attemptKind,state:p.state,checkedAt:p.checkedAt,reason:p.reason,httpAttempts:p.httpAttempts,observations:p.observations,metrics,...(balanceSnapshot?{balanceSnapshot}:{}),...(lastFailure?{lastFailure}:{})};
}
function validateBalanceSnapshot(p){
 const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),text=v=>v===null||typeof v==='string'&&v.length>0&&v.length<=96&&!/[\x00-\x1f\x7f]/.test(v),decimal=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(v);
 if(!p||p.day!=='2026-10-22'||typeof p.queriedAt!=='string'||!Number.isFinite(Date.parse(p.queriedAt))||p.reviewStatus!=='SOURCE_REVIEWED'||p.scope!=='ATTRIBUTED_WALLETS_ONLY'||![p.sourceHash,p.requestSqlHash,p.responseSqlHash].every(hex)||!Array.isArray(p.rows)||p.rows.length>3300)fail();
 const seen=new Set(),rows=p.rows.map(r=>{if(!r||!surveyTargets.some(t=>t.deploymentId===r.deploymentId&&t.coinId===r.coinId&&t.networkId===r.networkId)||![r.country,r.region].every(text)||![r.balance,r.usdBalance].every(decimal))fail();const k=JSON.stringify([r.deploymentId,r.country,r.region]);if(seen.has(k))fail();seen.add(k);return {deploymentId:r.deploymentId,coinId:r.coinId,networkId:r.networkId,country:r.country,region:r.region,balance:r.balance,usdBalance:r.usdBalance};});
 return {day:p.day,queriedAt:p.queriedAt,reviewStatus:p.reviewStatus,scope:p.scope,sourceHash:p.sourceHash,requestSqlHash:p.requestSqlHash,responseSqlHash:p.responseSqlHash,rows,missingDeployments:surveyTargets.filter(t=>!rows.some(r=>r.deploymentId===t.deploymentId)).map(t=>t.deploymentId)};
}
export function geographyBalanceRows(snapshot,{coin='all',network='all',country='all'}={}){
 const amount=v=>{const [a,b='']=(v??'0').split('.');return BigInt(a)*10n**36n+BigInt(b.padEnd(36,'0'));};
 return (snapshot?.rows??[]).filter(r=>(coin==='all'||r.coinId===coin)&&(network==='all'||r.networkId===network)&&(country==='all'||r.country===country||country==='__UNKNOWN__'&&r.country===null)).sort((a,b)=>a.usdBalance===null?b.usdBalance===null?0:1:b.usdBalance===null?-1:amount(a.usdBalance)>amount(b.usdBalance)?-1:amount(a.usdBalance)<amount(b.usdBalance)?1:0);
}
export function emptyGeography(){return validateGeography({version:1,kind:'ALLIUM_GEOGRAPHY_AVAILABILITY',provider:'allium',state:'NOT_TESTED',checkedAt:null,reason:null,httpAttempts:0,observations:0,metrics:Object.keys(geographyStates).map(metric=>({metric,state:'NOT_TESTED',dataState:'MISSING',schemaState:metric==='COUNTRY_BALANCE'?'PUBLIC_SCHEMA_REVIEWED':'UNKNOWN'}))});}
export function geographyChoice(previous,result){
 if(result.status==='rejected')return {data:previous,state:previous?'LAST_GOOD':'UNAVAILABLE'};
 return {data:validateGeography(result.value),state:'AVAILABLE'};
}
