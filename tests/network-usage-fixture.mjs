import {usageTargets,usageDays,validateNetworkUsage} from '../web/network-usage-model.js';
import {networkUsagePlan} from '../tools/network-usage-plan.mjs';
export async function networkUsageFixture({untilExclusive='2026-10-28',receiptHash='c'.repeat(64)}={}){
 const plan=await networkUsagePlan(untilExclusive),days=usageDays(untilExclusive);
 return validateNetworkUsage({schemaVersion:1,kind:'ARKHAM_NETWORK_USAGE',id:'arkham-usage-'+receiptHash,provider:'ARKHAM',planHash:plan.planHash,receiptHash,window:plan.window,dateBasis:'PROVIDER_DAY',aggregateTimezone:'UNKNOWN',coverage:'SUBSECOND_END_BOUNDARY_UNCONFIRMED',rows:usageTargets.flatMap(t=>days.map(day=>({...t,day,providerTime:day+'T00:00:00Z',state:'OBSERVED',usd:'1000.123456789012345678901234567890123456',transfers:'9007199254740993',transactions:null,sourceHash:'b'.repeat(64),queriedAt:untilExclusive+'T01:00:00.000Z'})))});
}
