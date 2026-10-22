import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationRequest,databaseRegistrationReader} from '../tools/market-db/registration-preview.mjs';
import {validateRegistrationIndex,validateRegisteredHistory,registrationChartData} from '../web/registration-model.js';
import {dailySupplySegments,networkSupplySeries,sortSupplyGroups,chartTooltipPosition} from '../web/market-chart.js';
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

test('chart reuses a live index source pin and refreshes an expired snapshot without fallback',async()=>{
 let clock=0,indexCalls=0,fail=false;const pins=[];
 const reader=databaseRegistrationReader({now:()=>clock,connect:async()=>({end:async()=>{}}),index:async()=>{indexCalls++;if(fail)throw Error('unavailable');return index;},history:async(_c,filter)=>{pins.push(filter.sourceId);return detail;}});
 await reader('/registration-index.json');await reader(query);assert.equal(indexCalls,1);assert.deepEqual(pins,['b'.repeat(64)]);
 clock=10001;await reader(query);assert.equal(indexCalls,2);
 clock=20002;fail=true;await assert.rejects(reader(query),/unavailable/);assert.equal(pins.length,2);
});

test('supply legend sorts exact quantities descending with stable ties and tooltip fits each plot edge',()=>{
 const group=(id,amount)=>({network:{id},rows:[{amount}]});const input=[group('small','1'),group('b','9007199254740993.1'),group('a','9007199254740993.1'),group('large','9007199254740993.2')];
 assert.deepEqual(sortSupplyGroups(input).map(g=>g.network.id),['large','a','b','small']);assert.equal(input[0].network.id,'small');
 for(const [x,y]of [[0,0],[310,0],[310,210],[0,210],[155,105]]){
  const p=chartTooltipPosition({x,y,width:320,height:220,tipWidth:190,tipHeight:85});assert(p.left>=8&&p.left+190<=312);assert(p.top>=8&&p.top+85<=212);
 }
});

test('new index invalidates a still-live history cache and requests the new source ID',async()=>{
 let clock=0,version=0;const pins=[];
 const reader=databaseRegistrationReader({now:()=>clock,connect:async()=>({end:async()=>{}}),index:async()=>({...index,coins:[{...index.coins[0],metrics:[{...index.coins[0].metrics[0],sourceId:version?'d'.repeat(64):'b'.repeat(64)}]}]}),history:async(_c,filter)=>{pins.push(filter.sourceId);return {...detail,sourceId:filter.sourceId};}});
 await reader('/registration-index.json');clock=5000;await reader(query);
 clock=10001;version=1;await reader('/registration-index.json');const fresh=await reader(query);
 assert.equal(fresh.sourceId,'d'.repeat(64));assert.deepEqual(pins,['b'.repeat(64),'d'.repeat(64)]);
});
