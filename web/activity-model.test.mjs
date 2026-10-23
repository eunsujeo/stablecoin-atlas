import test from 'node:test';import assert from 'node:assert/strict';
import {validateActivity,providerChoice} from './activity-model.js';
test('provider selection retains a whole last good dataset and never silently uses incompatible backup',()=>{
 const primary={name:'primary'},lastGood={name:'last'},backup={name:'backup'};assert.equal(providerChoice({primary,lastGood,backup,failed:true,compatible:true}).data,primary);assert.deepEqual(providerChoice({lastGood,failed:true,backup,compatible:true}),{data:lastGood,state:'LAST_GOOD'});assert.equal(providerChoice({backup,failed:true}).data,null);assert.equal(providerChoice({backup,failed:false,compatible:true}).data,null);assert.equal(providerChoice({backup,failed:true,compatible:true}).state,'BACKUP');
});
test('activity DTO distinguishes missing and real zero, rejects amount numbers and invalid provider dates',()=>{
 const p={schemaVersion:1,kind:'DAILY_TRANSFERS',provider:'ALLIUM',metric:'TRANSFER_VOLUME',networkId:'ethereum',dateBasis:'PROVIDER_DAY',state:'MISSING',series:[]};assert.equal(validateActivity(p),p);
 p.state='AVAILABLE';p.series=[{coinId:'usdc',networkId:'ethereum',points:[{day:'2026-10-21',volume:'0',volumeUSD:'0',transfers:'0',transactions:'0',hasAdjusted:true,adjustedUSD:null,queriedAt:'2026-10-23T00:00:00.000000Z',sourceHash:'a'.repeat(64)}]}];assert.equal(validateActivity(p),p);
 for(const mutate of [x=>x.series[0].points[0].volume=1,x=>x.series[0].points[0].day='2026-10-23',x=>x.state='MISSING',x=>x.series.push(x.series[0])]){const bad=structuredClone(p);mutate(bad);assert.throws(()=>validateActivity(bad));}
});
