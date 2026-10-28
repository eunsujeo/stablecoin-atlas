import {readFile} from 'node:fs/promises';
import {canonical,digest} from './market-db/plan.mjs';
import {usageDays,expandedUsageTargets} from '../web/network-usage-model.js';
import {networkUsagePlan} from './network-usage-plan.mjs';
const expansion=new URL('../data/arkham-network-usage-expansion-20261028-plan.json',import.meta.url);
export async function operatingUsagePlan(day){
 const days=usageDays(day),initial=await networkUsagePlan(day),extra=JSON.parse(await readFile(expansion));
 const jobs=expandedUsageTargets.map(t=>{const source=[...initial.jobs,...extra.jobs].find(j=>j.coinId===t.coinId&&j.networkId===t.networkId);if(!source)throw Error('USAGE_TARGET_UNKNOWN');return {id:t.deploymentId,coinId:t.coinId,networkId:t.networkId,method:'GET',path:'/transfers/histogram',query:{...source.query,chains:t.chain,timeGte:days[0]+'T00:00:00Z',timeLte:days.at(-1)+'T23:59:59Z'}};});
 const limits={maxHTTP:18,maxResponseBytes:2097152,maxTotalBytes:37748736,totalMs:420000,requestMs:20000,spacingMs:1000,retries:0,redirects:0,extraPages:0};
 const policyHash=digest(canonical({revision:1,targets:jobs.map(({query,...j})=>({...j,query:{base:query.base,chains:query.chains,tokens:query.tokens,granularity:query.granularity}})),limits,frequency:'UTC_ONCE_PER_DAY',sourcePins:{registry:initial.registryHash,metadata:initial.metadataHash,expansion:digest(await readFile(expansion))}}));
 const p={schemaVersion:1,kind:'ARKHAM_USAGE_DAILY_PLAN',day,slot:'arkham-usage-daily-'+day,window:{from:days[0],untilExclusive:day},policyHash,jobs,limits};return {...p,planHash:digest(canonical(p))};
}
export function validateUsageAuthorization(a,p){
 const days=(Date.parse(a?.untilExclusive)-Date.parse(a?.fromDay))/86400000;
 if(!a||a.kind!=='ARKHAM_USAGE_PERIOD_AUTHORIZATION'||a.policyHash!==p.policyHash||!Number.isInteger(days)||days<1||days>31||!/^\d{4}-\d\d-\d\d$/.test(a.fromDay)||!/^\d{4}-\d\d-\d\d$/.test(a.untilExclusive)||new Date(a.fromDay).toISOString().slice(0,10)!==a.fromDay||new Date(a.untilExclusive).toISOString().slice(0,10)!==a.untilExclusive||p.day<a.fromDay||p.day>=a.untilExclusive||a.maxHTTPPerDay!==18||a.maxTotalHTTP!==18*days||a.maxBytesPerDay!==37748736||a.maxTotalBytes!==37748736*days||a.costStatus!=='UNKNOWN_ACCEPTED')throw Error('USAGE_AUTHORIZATION_INVALID');return a;
}
