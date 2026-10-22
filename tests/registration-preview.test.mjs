import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationRequest,databaseRegistrationReader} from '../tools/market-db/registration-preview.mjs';
import {validateRegistrationIndex,validateRegisteredHistory,registrationChartData} from '../web/registration-model.js';
import {dailySupplySegments,networkSupplySeries} from '../web/market-chart.js';
const selection='a'.repeat(64),query='/registration-history.json?'+new URLSearchParams({selection,coin:'jpyc',metric:'NETWORK_CIRCULATING'});
const index={schemaVersion:1,kind:'REGISTERED_SUPPLY_INDEX',selectionId:selection,coins:[{id:'jpyc',name:'JPYC',symbol:'JPYC',pegCurrency:'JPY',notes:[],metrics:[{metric:'NETWORK_CIRCULATING',sourceId:'b'.repeat(64),from:'2025-10-22',to:'2026-10-22'}]}],networks:[{id:'ethereum',name:'Ethereum'}]};
const detail={schemaVersion:1,kind:'REGISTERED_SUPPLY_HISTORY',selectionId:selection,coinId:'jpyc',metric:'NETWORK_CIRCULATING',pegCurrency:'JPY',contract:{metric:'NETWORK_CIRCULATING',unit:'token',amountKind:'TOKEN_QUANTITY',definition:'DEFILLAMA_NETWORK_CIRCULATING_V1'},from:'2025-10-22',to:'2026-10-22',updatedAt:'2026-10-22T06:00:00.000Z',sourceId:'b'.repeat(64),sourceHash:'c'.repeat(64),state:'AVAILABLE',missingNetworks:[],series:[{networkId:'ethereum',points:[{day:'2026-10-20',amount:'9007199254740993.123456789012345678901234567890123456'},{day:'2026-10-22',amount:'0'}]}]};
test('supply requests reject duplicate, unknown, missing, oversized and arbitrary filters before connecting',()=>{
 assert.equal(registrationRequest('/registration-index.json').kind,'index');assert.equal(registrationRequest(query).coinId,'jpyc');
 for(const q of ['/registration-index.json?x=1',query+'&coin=usdt',query+'&url=https://private.test','/registration-history.json',query.replace('jpyc','unregistered'),query.replace('NETWORK_CIRCULATING','REPORTED_VOLUME')])assert.throws(()=>registrationRequest(q));
});
test('supply request queue coalesces, serializes connections, caps queue, closes and recovers without stale fallback',async()=>{
 let opened=0,closed=0,active=0,maximum=0,release;
 const gate=new Promise(r=>release=r);
 const reader=databaseRegistrationReader({connect:async()=>{opened++;maximum=Math.max(maximum,++active);return{end:async()=>{closed++;active--;}};},index:async()=>{await gate;return index;},history:async(_client,filter)=>{assert.equal(filter.sourceId,'b'.repeat(64));return detail;}});
 const first=reader('/registration-index.json'),same=reader('/registration-index.json');assert.equal(first,same);
 const second=reader(query),third=reader(query.replace('jpyc','usdc')),fourth=reader(query.replace('jpyc','usdt'));
 await assert.rejects(reader(query.replace('jpyc','rlusd')),/READ_QUEUE_FULL/);
 release();const outcomes=await Promise.allSettled([first,second,third,fourth]);assert.equal(outcomes[0].status,'fulfilled');assert.equal(outcomes[1].status,'fulfilled');assert.equal(outcomes[2].status,'rejected');assert.equal(maximum,1);assert.equal(closed,opened);
 assert.deepEqual(await reader(query),outcomes[1].value);assert.equal(opened,4);
 let calls=0;const fail=databaseRegistrationReader({connect:async()=>({end:async()=>{}}),index:async()=>{calls++;throw Error('password=secret');}});
 await assert.rejects(fail('/registration-index.json'));await assert.rejects(fail('/registration-index.json'));assert.equal(calls,2);
});
test('separate chart DTO preserves bigint quantity, JPY peg, short series, zero and missing dates without deployments',()=>{
 validateRegistrationIndex(index);validateRegisteredHistory(detail,index,{coinId:'jpyc',metric:'NETWORK_CIRCULATING'});
 const data=registrationChartData(index,detail);assert.deepEqual(data.registry.deployments,[]);
 const series=networkSupplySeries(data,'jpyc',{source:'history'});assert.equal(series[0].rows[0].amount,detail.series[0].points[0].amount);assert.equal(series[0].rows.length,2);assert.equal(series[0].rows[1].amount,'0');
 const points=series[0].rows.map(row=>({row}));assert.equal(dailySupplySegments(points).length,2);assert.equal(dailySupplySegments(points,false).length,1);assert.equal(dailySupplySegments(points.slice(0,1))[0].length,1);
 for(const change of [{selectionId:'f'.repeat(64)},{pegCurrency:'USD'},{series:[...detail.series,...detail.series]},{series:[{networkId:'ethereum',points:[{day:'2026-10-20',amount:1}]}]},{series:[{networkId:'ethereum',points:Array.from({length:367},()=>detail.series[0].points[0])}]}])assert.throws(()=>validateRegisteredHistory({...detail,...change},index,{coinId:'jpyc',metric:'NETWORK_CIRCULATING'}));
});
