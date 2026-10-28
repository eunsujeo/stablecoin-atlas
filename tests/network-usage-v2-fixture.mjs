import {expandedUsageSnapshot} from '../tools/network-usage-v2.mjs';
import {expandedUsageTargets,usageDays} from '../web/network-usage-model.js';
export function usageV2Fixture(){
 const rows=expandedUsageTargets.flatMap(t=>usageDays('2026-10-28').map(day=>{const missing=t.coinId==='jpysc'&&['2026-10-24','2026-10-25'].includes(day);return {deploymentId:t.deploymentId,coinId:t.coinId,networkId:t.networkId,day,providerTime:missing?null:day+'T00:00:00Z',state:missing?'MISSING':'OBSERVED',usd:missing?null:'9007199254740993.000000000000000001',transfers:missing?null:'9007199254740993',transactions:null,sourceHash:'a'.repeat(64),queriedAt:'2026-10-28T00:00:00.000Z'};}));
 return expandedUsageSnapshot({planHash:'b'.repeat(64),receiptHash:'c'.repeat(64),sourceReceipts:['c'.repeat(64)],window:{from:'2026-10-21',untilExclusive:'2026-10-28'},rows});
}
