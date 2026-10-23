import {readFileSync} from 'node:fs';
import {alliumPlan, alliumSurveyResult} from './allium-plan.mjs';
import {canonical, digest, instant, epochMicros} from './market-db/plan.mjs';

const metadata=JSON.parse(readFileSync(new URL('../data/market-registration.json',import.meta.url)));
const registry=JSON.parse(readFileSync(new URL('../data/asset-registry.json',import.meta.url)));
export const dailyHash=value=>digest(Buffer.isBuffer(value)?value:canonical(value));
export const dailyFail=()=>{throw Error('ALLIUM_DAILY_OFFLINE_BLOCKED');};
export const hashValue=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const dailyDay=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function eu(value){
 if(typeof value!=='string'||!/^(0|[1-9]\d{0,20})(\.\d{1,18})?$/.test(value))dailyFail();
 const [a,b='']=value.split('.');return BigInt(a)*10n**18n+BigInt(b.padEnd(18,'0'));
}
export function euText(value){if(typeof value!=='bigint'||value<0n)dailyFail();const a=value/10n**18n,b=(value%10n**18n).toString().padStart(18,'0').replace(/0+$/,'');return a+(b?'.'+b:'');}
export function dailyPlan({asOfDay}={}){
 const survey=alliumPlan(metadata,registry,{asOfDay});
 const body={schemaVersion:1,kind:'ALLIUM_OFFLINE_DAILY_PLAN',mapper:'allium-daily-plan-v1',asOfDay,
  window:survey.window,registryHash:survey.registryHash,metadataHash:survey.metadataHash,targets:survey.targets,
  jobs:survey.jobs.filter(j=>j.kind!=='registry'),
  policy:{maxRuns:2,maxQueryCreates:2,maxStatusReadsPerRun:10,maxResultReads:2,maxHttpRequests:26,maxUsageRequests:1,
   maxTotalHttpRequests:27,maxResponseBytes:2097152,requestTimeoutMs:20000,pollIntervalMs:2000,retries:0,pages:1,computeProfile:'PROVIDER_DEFAULT_PINNED_POLICY'},
  executionEnabled:false,providerRequests:0,databaseWrites:0,scheduleWrites:0,billingLimit:null,billingStatus:'UNCONFIRMED'};
 return {...body,planHash:dailyHash(body)};
}
export function verifyDailyPlan(plan){if(!plan||canonical(plan)!==canonical(dailyPlan({asOfDay:plan.asOfDay})))dailyFail();return plan;}
export function dailyResult(plan,kind,bytes,now){
 verifyDailyPlan(plan);if(!['supply','volume'].includes(kind))dailyFail();
 return alliumSurveyResult(alliumPlan(metadata,registry,{asOfDay:plan.asOfDay}),kind,bytes,{expectedHash:dailyHash(bytes),...(now?{now}:{})});
}
const authKeys=['schemaVersion','kind','executionEnabled','planHash','organizationHash','keyHash','controlsHash','legacyReviewHash','transition',
 'unit','providerHardCapIncludingInFlight','exclusiveConsumer','overagesDisabled','billingStart','billingEnd','allocationStart','allocationEnd',
 'capStart','capEnd','reviewedAt','expiresAt','includedUnits','dayBudgetUnits','periodBudgetUnits','hardRemainingUnits','maxUnits'];
const keys=(v,w)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...w].sort().join(',');
export function validateSimulationAuthorization(a,plan,now){
 verifyDailyPlan(plan);instant(now);
 if(!keys(a,authKeys)||a.schemaVersion!==1||a.kind!=='ALLIUM_DAILY_SIMULATION_AUTHORIZATION'||a.executionEnabled!==false||a.planHash!==plan.planHash||
  ![a.organizationHash,a.keyHash,a.controlsHash,a.legacyReviewHash].every(hashValue)||a.transition!=='SIMULATED_RECONCILED'||a.unit!=='EXPLORER_UNIT'||
  ![a.providerHardCapIncludingInFlight,a.exclusiveConsumer,a.overagesDisabled].every(v=>v===true)||!keys(a.maxUnits,['supply','volume','registry']))dailyFail();
 const t=epochMicros(now);
 for(const [s,e]of [['billingStart','billingEnd'],['allocationStart','allocationEnd'],['capStart','capEnd'],['reviewedAt','expiresAt']]){
  if(epochMicros(a[s])>t||t>=epochMicros(a[e])||epochMicros(a[s])>=epochMicros(a[e]))dailyFail();
 }
 if(t-epochMicros(a.reviewedAt)>3600n*1000000n||epochMicros(a.expiresAt)-epochMicros(a.reviewedAt)>3600n*1000000n||now.slice(0,10)!==plan.asOfDay)dailyFail();
 for(const k of ['includedUnits','dayBudgetUnits','periodBudgetUnits','hardRemainingUnits'])if(eu(a[k])<=0n)dailyFail();
 for(const v of Object.values(a.maxUnits))if(eu(v)<=0n)dailyFail();
 return a;
}
export function authorizationPolicy(a){
 const {planHash,keyHash,reviewedAt,expiresAt,...stable}=a;return dailyHash(stable);
}
// This calculator consumes explicit reservations. It cannot attest real provider controls.
export function dailyBudget({authorization:a,usage,reservations,kind,now}){
 if(!['daily','registry'].includes(kind)||usage?.state!=='SUCCEEDED'||usage.organizationHash!==a.organizationHash||usage.allocationStart!==a.allocationStart||
  usage.allocationEnd!==a.allocationEnd||eu(usage.includedUnits)!==eu(a.includedUnits)||epochMicros(now)<epochMicros(usage.at)||
  epochMicros(now)-epochMicros(usage.at)>3600n*1000000n||usage.at.slice(0,10)!==now.slice(0,10))dailyFail();
 const relevant=reservations.filter(r=>r.authorization.organizationHash===a.organizationHash);
 let day=0n,period=0n,pending=0n;
 for(const r of relevant){
  const b=eu(r.reservedUnits); // No reconciliation/release operation is enabled: c_i stays zero.
  pending+=b;
  if(r.day===now.slice(0,10))day+=b;
  if(r.authorization.allocationStart===a.allocationStart&&r.authorization.allocationEnd===a.allocationEnd){
   period+=b;if(authorizationPolicy(r.authorization)!==authorizationPolicy(a))dailyFail();
  }else dailyFail(); // Carryover needs a separately reviewed transition, never an automatic reset.
  if(r.authorization.capStart!==a.capStart||r.authorization.capEnd!==a.capEnd)dailyFail();
 }
 const reserved=kind==='daily'?eu(a.maxUnits.supply)+eu(a.maxUnits.volume):eu(a.maxUnits.registry);
 if(day+reserved>eu(a.dayBudgetUnits)||period+reserved>eu(a.periodBudgetUnits)||eu(usage.consumedUnits)+pending+reserved>eu(a.includedUnits)||pending+reserved>eu(a.hardRemainingUnits))dailyFail();
 return {reservedUnits:euText(reserved),dayReservedUnits:euText(day),periodReservedUnits:euText(period),pendingUnits:euText(pending),reconciliation:'NOT_ENABLED_C_ZERO',executionEnabled:false};
}
