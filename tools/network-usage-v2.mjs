import {validateNetworkUsage,registeredUsageTargets} from '../web/network-usage-model.js';
export function expandedUsageSnapshot({planHash,receiptHash,sourceReceipts,window,rows}){
 const availability=registeredUsageTargets.map(t=>({deploymentId:t.deploymentId,coinId:t.coinId,networkId:t.networkId,state:t.reason?'NOT_TESTED':rows.some(r=>r.deploymentId===t.deploymentId&&r.state==='OBSERVED')?'OBSERVED':'MISSING',reason:t.reason}));
 return validateNetworkUsage({schemaVersion:2,kind:'ARKHAM_NETWORK_USAGE',id:'arkham-usage-v2-'+receiptHash,provider:'ARKHAM',planHash,receiptHash,sourceReceipts,window,dateBasis:'PROVIDER_DAY',aggregateTimezone:'UNKNOWN',coverage:'SUBSECOND_END_BOUNDARY_UNCONFIRMED',availability,rows});
}
