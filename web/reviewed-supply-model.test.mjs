import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReviewedSupply,reviewedSupplyRows,reviewedSupplyChoice} from './reviewed-supply-model.js';
import {reviewedSupplyFixture} from '../tests/reviewed-supply-fixture.mjs';
test('reviewed supply retains exact strings, null and provenance, drops raw fields and marks absent days separately',()=>{
 const p=reviewedSupplyFixture();p.sql='private';p.series[0].points[0].raw='private';p.series[0].points[0].totalSupply='0';
 const value=validateReviewedSupply(p);assert(!JSON.stringify(value).includes('private'));assert.equal(value.series[0].points[0].totalSupply,'0');assert.equal(value.series[0].points[1].totalSupply,'1000.000000000000000001');assert.equal(value.series[0].points[0].adjustedCirculatingSupply,null);
 assert.equal(reviewedSupplyRows(value).length,14);assert.equal(reviewedSupplyRows(value,'usdt').length,7);
 p.series[0].points.splice(2,1);const partial=validateReviewedSupply(p),rows=reviewedSupplyRows(partial,'usdc');assert.equal(rows[2].day,'2026-10-18');assert.equal(rows[2].point,null);assert.deepEqual(rows[1].point,partial.series[0].points[1]);
 p.series=[];p.state='MISSING';assert(reviewedSupplyRows(validateReviewedSupply(p)).every(r=>r.point===null));
});
test('reviewed supply rejects expanded scope, invalid dates, amounts, identity, metadata and grid duplication',()=>{
 const mutations=[p=>p.networkIdentity='2',p=>p.networkId='tron',p=>p.requestedRange.to='2026-10-23',p=>p.requestedRange.coinId='usdc',p=>p.metrics.reverse(),p=>p.precision='VERIFIED',p=>p.aggregateTimezone='UTC',p=>p.usdAvailability='AVAILABLE',p=>p.series[0].coinId='rlusd',p=>p.series[0].deploymentId='usdc-other',p=>p.series[0].points[0].totalSupply=0,p=>p.series[0].points[0].totalSupply='1e9',p=>p.series[0].points[0].isNative=null,p=>p.series[0].points[0].day='2026-10-15',p=>p.series[0].points[1].day='2026-10-16',p=>p.series[0].points[0].queriedAt='2026-02-30T03:26:50.626271Z',p=>p.series[0].points[0].sourceHash='bad',p=>p.series.push(p.series[0]),p=>p.state='MISSING'];
 for(const mutate of mutations){const p=reviewedSupplyFixture();mutate(p);assert.throws(()=>validateReviewedSupply(p));}
});
test('reviewed supply distinguishes disabled, missing, first failure, last good, partial success and recovery',()=>{
 const good=validateReviewedSupply(reviewedSupplyFixture());
 assert.deepEqual(reviewedSupplyChoice(null,{status:'fulfilled',value:null}),{data:null,state:'DISABLED'});
 assert.equal(reviewedSupplyChoice(null,{status:'rejected'}).state,'UNAVAILABLE');
 const stale=reviewedSupplyChoice(good,{status:'rejected'});assert.equal(stale.state,'LAST_GOOD');assert.equal(stale.data,good);
 const missing={...good,state:'MISSING',series:[]};assert.deepEqual(reviewedSupplyChoice(good,{status:'fulfilled',value:missing}),{data:missing,state:'MISSING'});
 assert.deepEqual(reviewedSupplyChoice(stale.data,{status:'fulfilled',value:good}),{data:good,state:'AVAILABLE'});
 assert.equal(reviewedSupplyChoice(good,{status:'fulfilled',value:null}).data,null);
});
