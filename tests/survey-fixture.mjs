import {storedSurveyPlan,surveySource} from '../tools/allium-survey-source.mjs';
import {supplyHash} from '../tools/allium-supply-source.mjs';
export async function surveyFixture({kind='supply',queriedAt='2026-10-23T09:32:05.123456Z',amount='100.000000000000000001',mutate=()=>{}}={}){
 const plan=await storedSurveyPlan(),job=plan.jobs.find(j=>j.kind===kind);
 const data=plan.targets.filter(t=>t.family!=='XRPL').flatMap(t=>Array.from({length:t.networkId==='kaia'?1:7},(_,i)=>{
  const absent=t.networkId==='kaia';return {deployment_id:t.deploymentId,coin_id:t.coinId,requested_chain:t.networkId,requested_address:t.identity.address,observed_chain:absent?null:t.networkId,observed_address:absent?null:t.identity.address,provider_day:absent?null:`2026-10-${16+i}`,
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
