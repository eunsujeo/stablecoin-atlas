import {parseEnv} from 'node:util';
import {boundedRead} from './evidence-store.mjs';

export const arkhamIntervals=Object.freeze({'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'2h':7200000,'6h':21600000,'12h':43200000,'24h':86400000});
const keys=['ARKHAM_COLLECTION_INTERVAL','ARKHAM_DAILY_RUN_LIMIT'];
const invalid=()=>{throw Error('SCHEDULER_CONFIG_INVALID');};
export function arkhamSchedule({interval='1h',dailyRunLimit=24}={}){
 if(!['number','string'].includes(typeof dailyRunLimit)||!Object.hasOwn(arkhamIntervals,interval)||typeof dailyRunLimit==='string'&&!/^(0|[1-9]\d{0,2})$/.test(dailyRunLimit))invalid();
 const limit=Number(dailyRunLimit),intervalMs=arkhamIntervals[interval],slotsPerDay=86400000/intervalMs;
 if(!Number.isInteger(limit)||limit<0||limit>288||limit>slotsPerDay)invalid();
 return {interval,intervalMs,dailyRunLimit:limit,slotsPerDay,maxRequestsPerRun:7,maxRequestsPerDay:limit*7};
}
// Schedule variables deliberately stay separate from writer credentials. Explicit
// --env-file continues to ignore inherited credentials, but not schedule settings.
export async function collectorScheduleEnvironment(path,inherited=process.env){
 const env=Object.fromEntries(keys.filter(k=>Object.hasOwn(inherited,k)).map(k=>[k,inherited[k]]));
 if(path!==undefined){
  const parsed=parseEnv((await boundedRead(path,4096)).toString('utf8'));
  if(Object.keys(parsed).some(k=>!keys.includes(k)))invalid();
  for(const k of keys)if(!Object.hasOwn(env,k)&&Object.hasOwn(parsed,k))env[k]=parsed[k];
 }
 return env;
}
export function resolveArkhamSchedule(options={},env={}){
 return arkhamSchedule({interval:options.arkhamInterval??env.ARKHAM_COLLECTION_INTERVAL??'1h',dailyRunLimit:options.arkhamRunsPerDay??env.ARKHAM_DAILY_RUN_LIMIT??24});
}
