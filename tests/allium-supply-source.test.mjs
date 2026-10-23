import test from 'node:test';import assert from 'node:assert/strict';
import {alliumSupplySource,supplyHash,supplyReadRange} from '../tools/allium-supply-source.mjs';
import {supplyArguments} from '../tools/market-db/allium-supply-cli.mjs';
import {supplyFixture} from './allium-supply-fixture.mjs';

test('Allium supply projection preserves three distinct token quantities, original day/time, native and null without private metadata',()=>{
 const f=supplyFixture(),p=alliumSupplySource(f.bytes,f.options);assert.equal(p.rows.length,14);assert.equal(p.rows[0].values.totalSupply,'1000.000000000000000001');
 assert.equal(p.rows[0].values.circulatingSupply,'900');assert.equal(p.rows[0].values.adjustedCirculatingSupply,null);assert.equal(p.rows[0].day,'2026-10-16');assert.equal(p.queriedAt,f.data.queried_at);
 assert.equal(p.rows[0].values.isNative,true);assert(!JSON.stringify(p).includes('private'));assert(!JSON.stringify(p).includes('SELECT'));assert.deepEqual(alliumSupplySource(f.bytes,f.options),p);
 const upper=supplyFixture({mutate:p=>p.data[0].token_address=p.data[0].token_address.toUpperCase()});assert.equal(alliumSupplySource(upper.bytes,upper.options).rows.length,14);
});
test('supply validation rejects Number amounts, invalid decimals, time, deployment drift and unexpected SQL even with a new reviewed hash',()=>{
 for(const mutate of [p=>p.data[0].total_supply_str=1,p=>p.data[0].circulating_supply_str='-1',p=>p.data[0].adjusted_circulating_supply_str='1e5',p=>p.data[0].total_supply_str='1'.repeat(79),
  p=>p.data[0].chain='solana',p=>p.data[0].token_address='wrong',p=>p.data[0].coin_id='rlusd',p=>p.data[0].date='2026-10-23T00:00:00',p=>p.data[0].date='2026-10-16T01:00:00',
  p=>p.data[0].is_native=null,p=>p.queried_at='2026-10-22T23:59:59Z',p=>p.queried_at='2026-10-25T00:00:00Z',p=>p.sql+=' ',p=>p.meta.row_count=13]){
  const f=supplyFixture({mutate});assert.throws(()=>alliumSupplySource(f.bytes,f.options));
 }
 const f=supplyFixture();assert.throws(()=>alliumSupplySource(f.bytes,{...f.options,expectedHash:'0'.repeat(64)}));
 for(const bytes of [Buffer.from([0xff]),Buffer.from('['.repeat(33)+'0'+']'.repeat(33)),Buffer.alloc(2097153)])assert.throws(()=>alliumSupplySource(bytes,{...f.options,expectedHash:supplyHash(bytes)}));
});
test('fixed historical LIMIT result requires the full distinct 2×7 grid and preserves zero/all-null rows',()=>{
 for(const mutate of [p=>p.data.pop(),p=>p.data.push(p.data[0]),p=>p.data[0]=p.data[1],p=>p.data=[]]){
  const f=supplyFixture({mutate:p=>{mutate(p);p.meta.row_count=p.data.length;}});assert.throws(()=>alliumSupplySource(f.bytes,f.options));
 }
 const f=supplyFixture({mutate:p=>{p.data[0].total_supply_str='0';p.data[0].circulating_supply_str=null;p.data[0].is_native=false;}}),r=alliumSupplySource(f.bytes,f.options).rows[0];
 assert.equal(r.values.totalSupply,'0');assert.equal(r.values.circulatingSupply,null);assert.equal(r.values.isNative,false);
});
test('supply CLI has explicit bounded reads and cannot collect, change providers or pass extra flags',()=>{
 assert.equal(supplyArguments(['read','--from','2026-10-16','--to','2026-10-22']).command,'read');
 for(const args of [['collect'],['read'],['read','--from','2026-10-16','--to','2026-10-22','--coin','rlusd'],['read','--from','2026-10-16','--to','2026-10-22','--from','2026-10-16'],['grant','--role','x','--mode','admin'],['import','--source','x'],['read','--from','2026-10-16','--to','2026-10-22','--provider','defillama']])assert.throws(()=>supplyArguments(args));
 for(const o of [{from:'2026-02-30',to:'2026-03-01'},{from:'2026-10-01',to:'2026-11-01'},{from:'2026-10-22',to:'2026-10-16'}])assert.throws(()=>supplyReadRange(o));
});
