import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {usageTargets} from '../web/network-usage-model.js';
export async function networkUsageInventory(){
 const registration=JSON.parse(await readFile(new URL('../data/market-registration.json',import.meta.url),'utf8'));
 return {schemaVersion:1,kind:'REGISTERED_NETWORK_USAGE_SCOPE',source:'data/market-registration.json',registrationReviewedAt:registration.reviewedAt,
  rows:registration.coverage.map(row=>({coinId:row.coinId,networkId:row.networkId,state:usageTargets.some(t=>t.coinId===row.coinId&&t.networkId===row.networkId)?'STORED_WINDOW_AVAILABLE':'NOT_COLLECTED',providerSupport:usageTargets.some(t=>t.coinId===row.coinId&&t.networkId===row.networkId)?'HISTOGRAM_OBSERVED_FOR_STORED_WINDOW':'NOT_VERIFIED',requestedWindow:{from:'2026-10-21',untilExclusive:'2026-10-28'}}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await networkUsageInventory(),null,2));
