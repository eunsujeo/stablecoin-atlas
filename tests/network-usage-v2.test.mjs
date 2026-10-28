import test from 'node:test';import assert from 'node:assert/strict';
import {usageV2Fixture} from './network-usage-v2-fixture.mjs';
import {validateNetworkUsage,networkUsageView} from '../web/network-usage-model.js';
import {overviewUsageRows,overviewTransferGroups} from '../web/supply-overview-model.js';
test('expanded usage retains 18 source series and 33 availability entries without manufacturing observations',()=>{
 const p=usageV2Fixture(),v=networkUsageView(p);assert.equal(p.rows.length,126);assert.equal(p.rows.filter(r=>r.state==='OBSERVED').length,124);assert.equal(p.availability.filter(a=>a.state==='NOT_TESTED').length,15);
 const usdc=overviewUsageRows(v,'usdc','2026-10-27');assert.equal(usdc.length,11);assert.equal(usdc.filter(r=>r.usd!==null).length,7);assert(usdc.filter(r=>r.state==='NOT_TESTED').every(r=>r.sourceHash===null&&r.queriedAt===null));
 assert.equal(overviewTransferGroups(v,'usdc','transfer_count').groups.length,7);assert.equal(overviewTransferGroups(v,'usdt','transfer_count').groups.length,6);assert.equal(overviewTransferGroups(v,'jpyc','transfer_volume_usd').groups.length,3);assert.equal(overviewUsageRows(v,'jpysc','2026-10-24')[0].usd,null);assert.equal(p.rows[0].usd,'9007199254740993.000000000000000001');for(const r of p.rows)if(r.networkId==='base')r.queriedAt='2026-10-28T01:00:00.000Z';const missing=overviewUsageRows(networkUsageView(p),'jpysc','2026-10-24')[0];assert.equal(missing.queriedAt,'2026-10-28T00:00:00.000Z');assert.equal(missing.sourceHash,'a'.repeat(64));
});
test('expanded validation rejects drift, missing source lineage, fabricated availability and false zeros',()=>{
 for(const edit of [p=>p.rows.pop(),p=>p.availability.pop(),p=>p.availability[0].state='NOT_TESTED',p=>p.sourceReceipts=[],p=>p.sourceReceipts=['d'.repeat(64)],p=>p.rows[0].usd=1,p=>p.rows.find(r=>r.state==='MISSING').usd='0',p=>p.rows[0].queriedAt=null,p=>p.rows[0].coinId='other']){const p=usageV2Fixture();edit(p);assert.throws(()=>validateNetworkUsage(p));}
});
