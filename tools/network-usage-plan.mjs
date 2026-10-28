import {readFile} from 'node:fs/promises';
import {canonical,digest} from './market-db/plan.mjs';
import {usageDays,usageTargets} from '../web/network-usage-model.js';
export async function networkUsagePlan(untilExclusive){
 const days=usageDays(untilExclusive),from=days[0],last=days.at(-1);
 const registryBytes=await readFile(new URL('../data/asset-registry.json',import.meta.url)),metadataBytes=await readFile(new URL('../data/market-registration.json',import.meta.url));
 const deployments=[...JSON.parse(registryBytes).deployments,...JSON.parse(metadataBytes).newDeployments];
 const jobs=usageTargets.map(t=>{
  const d=deployments.find(d=>d.id===t.deploymentId);if(!d||d.coinId!==t.coinId||d.networkId!==t.networkId||typeof d.identity?.address!=='string')throw Error('USAGE_REGISTRY_MISMATCH');
  return {id:t.deploymentId,coinId:t.coinId,networkId:t.networkId,method:'GET',path:'/transfers/histogram',query:{base:'all',chains:t.networkId,tokens:d.identity.address,timeGte:from+'T00:00:00Z',timeLte:last+'T23:59:59Z',granularity:'1d'}};
 });
 const p={schemaVersion:1,kind:'ARKHAM_NETWORK_USAGE_PLAN',slot:'arkham-network-usage-'+untilExclusive.replaceAll('-','')+'-v1',window:{from,untilExclusive},registryHash:digest(registryBytes),metadataHash:digest(metadataBytes),jobs,limits:{maxHTTP:5,maxResponseBytes:2097152,maxTotalBytes:10485760,requestMs:20000,totalMs:120000,spacingMs:1000,retries:0,extraPages:0,redirects:0},costStatus:'UNCONFIRMED',automatic:false};
 return {...p,planHash:digest(canonical(p))};
}
export async function validateUsagePlan(p){if(canonical(p)!==canonical(await networkUsagePlan(p?.window?.untilExclusive)))throw Error('USAGE_PLAN_MISMATCH');return p;}
