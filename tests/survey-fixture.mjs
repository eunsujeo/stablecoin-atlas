import {storedSurveyPlan,surveySource} from '../tools/allium-survey-source.mjs';
import {supplyHash} from '../tools/allium-supply-source.mjs';
import {dailyPlan} from '../tools/allium-daily-plan.mjs';
import {liveAuthorization} from '../tools/allium-live-once.mjs';
export async function surveyFixture({kind='supply',asOfDay='2026-10-23',queriedAt='2026-10-23T09:32:05.123456Z',amount='100.000000000000000001',mutate=()=>{}}={}){
 const plan=await storedSurveyPlan(asOfDay),job=plan.jobs.find(j=>j.kind===kind);
 const data=plan.targets.filter(t=>t.family!=='XRPL').flatMap(t=>Array.from({length:t.networkId==='kaia'?1:7},(_,i)=>{
  const absent=t.networkId==='kaia';return {deployment_id:t.deploymentId,coin_id:t.coinId,requested_chain:t.networkId,requested_address:t.identity.address,observed_chain:absent?null:t.networkId,observed_address:absent?null:t.identity.address,provider_day:absent?null:new Date(Date.parse(plan.window.from)+i*86400000).toISOString().slice(0,10),
   ...(kind==='supply'?{total_supply_str:absent?null:amount,circulating_supply_str:absent?null:'0',adjusted_circulating_supply_str:null,total_supply_usd_str:absent?null:'1',circulating_supply_usd_str:absent?null:'0',adjusted_circulating_supply_usd_str:null,is_native:absent?null:true}:
    {transfer_volume_str:absent?null:amount,transfer_volume_usd_str:absent?null:'1',transfer_count_str:absent?null:'9007199254740993',transfer_tx_count_str:absent?null:'0',adjusted_volume_usd_str:null,has_adjusted_volume:absent?null:false})};
 }));
 const raw={sql:job.sql+' ',queried_at:queriedAt,data,meta:{row_count:data.length},run_id:'private-run-id'};mutate(raw);raw.meta.row_count=raw.data.length;
 const bytes=Buffer.from(JSON.stringify(raw)),expectedHash=supplyHash(bytes);
 const receiptBytes=Buffer.from(JSON.stringify({kind:'ALLIUM_SURVEY_RECEIPT',state:'UNKNOWN',planHash:plan.planHash,jobs:[{kind,sourceHash:expectedHash,resultAttempt:0}],attempts:[{responseHash:expectedHash}]}));
 const manifest={schemaVersion:1,kind:'ALLIUM_REVIEWED_SQL_ECHO',planHash:plan.planHash,receiptHash:supplyHash(receiptBytes),reviews:[{kind,reviewStatus:'SOURCE_REVIEWED',planHash:plan.planHash,sourceHash:expectedHash,requestSqlHash:job.sqlHash,responseSqlHash:supplyHash(Buffer.from(raw.sql)),reviewedAt:'2026-10-23T10:00:00.000000Z'}]};
 const reviewBytes=Buffer.from(JSON.stringify(manifest)),options={plan,kind,expectedHash,reviewBytes,reviewHash:supplyHash(reviewBytes),receiptBytes,now:'2026-10-24T00:00:00.000000Z'};
 return {bytes,options,source:()=>surveySource(bytes,options)};
}
export async function surveyDto(){const a=await surveyFixture(),b=await surveyFixture({kind:'volume',mutate:p=>{p.data=p.data.filter(r=>r.deployment_id!=='jpysc-ethereum'||r.provider_day>='2026-10-19');}});return {schemaVersion:1,kind:'ALLIUM_STORED_SURVEY',provider:'ALLIUM',snapshots:[a.source().snapshot,b.source().snapshot]};}

export async function liveSurveyFixture({kind='supply',asOfDay='2026-10-23',queriedAt=asOfDay+'T13:00:05.123456Z',amount='200.000000000000000001',mutate=()=>{}}={}) {
 const f=await surveyFixture({kind,asOfDay,queriedAt,amount,mutate}),daily=dailyPlan({asOfDay:f.options.plan.asOfDay});
 const userApprovalBytes=Buffer.from('TEST ONLY: local live once user approval');
 const authorization=liveAuthorization(daily,{apiKey:'TEST_ONLY_PRIVATE_KEY',approvalBytes:userApprovalBytes,
  legacyManifest:{entries:[]},now:asOfDay+'T13:00:00.000Z',grantId:'00000000-0000-4000-8000-000000000001'});
 const executionAuthorizationBytes=Buffer.from(JSON.stringify(authorization)),authorizationHash=supplyHash(executionAuthorizationBytes);
 const raw=JSON.parse(f.bytes);raw.meta.run_id='private-live-run-'+kind;
 const bytes=Buffer.from(JSON.stringify(raw)),expectedHash=supplyHash(bytes);
 const jobs=daily.jobs.map(j=>({kind:j.kind,sqlHash:j.sqlHash,resultLimit:j.resultLimit,state:j.kind===kind?'UNKNOWN':kind==='volume'?'SUCCEEDED':'RESERVED',
  ...(j.kind===kind||kind==='volume'?{sourceHash:j.kind===kind?expectedHash:'1'.repeat(64),resultAttempt:j.kind==='supply'?3:7,
   queryId:'private-live-query-'+j.kind,runId:'private-live-run-'+j.kind}:{})}));
 const resultAt=new Date(Date.parse(queriedAt)+1000).toISOString().replace('Z','000Z');
 const attempts=Array.from({length:kind==='supply'?4:8},(_,i)=>({index:i,kind:['create','run','status','result'][i%4],
  at:i===jobs.find(j=>j.kind===kind).resultAttempt?resultAt:asOfDay+'T13:00:00.000000Z',httpStatus:200,
  responseHash:i===jobs.find(j=>j.kind===kind).resultAttempt?expectedHash:'1'.repeat(64)}));
 const receipt={schemaVersion:1,kind:'ALLIUM_LIVE_ONCE_RECEIPT',day:daily.asOfDay,planHash:daily.planHash,
  authorizationHash,authorization,state:'UNKNOWN',failure:'SQL_ECHO_REVIEW_REQUIRED',jobs,attempts};
 const receiptBytes=Buffer.from(JSON.stringify(receipt)),legacyReview=JSON.parse(f.options.reviewBytes).reviews[0];
 const review={...legacyReview,sourceHash:expectedHash,reviewedAt:new Date(Date.parse(queriedAt)+2000).toISOString().replace('Z','000Z')};
 const manifest={schemaVersion:1,kind:'ALLIUM_LIVE_REVIEWED_SQL_ECHO',planHash:daily.planHash,authorizationHash,
  receiptHash:supplyHash(receiptBytes),review};
 const reviewBytes=Buffer.from(JSON.stringify(manifest)),options={...f.options,expectedHash,reviewBytes,reviewHash:supplyHash(reviewBytes),
  receiptBytes,executionAuthorizationBytes,userApprovalBytes,now:new Date(Date.parse(queriedAt)+86400000).toISOString()};
 return {bytes,options,source:()=>surveySource(bytes,options)};
}
