import {dailyPlan,dailyHash} from '../tools/allium-daily-plan.mjs';

export const simulationOrg=dailyHash('SIMULATED ORGANIZATION ONLY');
export function simulation(at,mutate=()=>{}){
 const date=new Date(at),day=at.slice(0,10),plan=dailyPlan({asOfDay:day});
 const start=day.slice(0,7)+'-01T00:00:00.000000Z',end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1)).toISOString();
 const authorization={schemaVersion:1,kind:'ALLIUM_DAILY_SIMULATION_AUTHORIZATION',executionEnabled:false,planHash:plan.planHash,
  organizationHash:simulationOrg,keyHash:dailyHash('SIMULATED KEY FINGERPRINT'),controlsHash:dailyHash('SIMULATED CONTROLS ONLY'),legacyReviewHash:dailyHash('SIMULATED LEGACY RECONCILIATION ONLY'),
  transition:'SIMULATED_RECONCILED',unit:'EXPLORER_UNIT',providerHardCapIncludingInFlight:true,exclusiveConsumer:true,overagesDisabled:true,
  billingStart:start,billingEnd:end,allocationStart:start,allocationEnd:end,capStart:start,capEnd:end,reviewedAt:at,
  expiresAt:new Date(date.getTime()+1800000).toISOString(),includedUnits:'100',dayBudgetUnits:'1',periodBudgetUnits:'10',hardRemainingUnits:'10',
  maxUnits:{supply:'0.2',volume:'0.3',registry:'0.1'}};
 mutate(authorization);
 const usage={kind:'ALLIUM_SIMULATED_USAGE',organizationHash:authorization.organizationHash,allocationStart:authorization.allocationStart,allocationEnd:authorization.allocationEnd,
  includedUnits:authorization.includedUnits,consumedUnits:'1',sourceHash:dailyHash('SIMULATED USAGE ONLY')};
 return {plan,authorization,usage};
}
export function dailyResponse(plan,kind,{cost='0.1',echo,mutate=()=>{}}={}){
 const fields=kind==='supply'?['total_supply','circulating_supply','adjusted_circulating_supply','total_supply_usd','circulating_supply_usd','adjusted_circulating_supply_usd']:
  ['transfer_volume','transfer_volume_usd','transfer_count','transfer_tx_count','adjusted_volume_usd'];
 const data=[];
 for(const t of plan.targets.filter(t=>t.family!=='XRPL')){
  const absent=t.deploymentId==='jpyc-kaia';
  for(let d=0;d<(absent?1:7);d++){
   const provider_day=absent?null:new Date(Date.parse(plan.window.from)+d*86400000).toISOString().slice(0,10);
   data.push({deployment_id:t.deploymentId,coin_id:t.coinId,requested_chain:t.networkId,requested_address:t.identity.address,
    observed_chain:absent?null:t.networkId,observed_address:absent?null:t.identity.address,provider_day,
    ...Object.fromEntries(fields.map(f=>[f+'_str',absent||f==='adjusted_volume_usd'?null:f.endsWith('_count')?'1':'100.000000000000000001'])),
    ...(kind==='supply'?{is_native:absent?null:true}:{has_adjusted_volume:absent?null:false})});
  }
 }
 const result={sql:echo??plan.jobs.find(j=>j.kind===kind).sql,data,meta:{row_count:data.length,cost_explorer_units:cost},queried_at:plan.asOfDay+'T00:00:00.000000Z'};
 mutate(result);return JSON.stringify(result);
}
