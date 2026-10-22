import test from 'node:test';
import assert from 'node:assert/strict';
import {chartHistory,chartGeometry,decimalUnits} from './market-chart.js';
import {units} from './market-model.js';
const row=(amount,day,id='a')=>({id,amount,coinId:'usdc',deploymentId:null,metric:'PRICE',provider:'ARKHAM',endpoint:'/token/market/usd-coin',selector:'data.price',observedAt:`2026-10-${String(day).padStart(2,'0')}T00:00:00.000Z`,unit:'USD'});
test('history windows anchor to the last stored observation, exclude other sources and resolve duplicate times deterministically',()=>{
  const first=row('1',1),last=row('2',22),data={observations:[last,{...last,id:'z',amount:'3'},row('1.5',21),first,{...last,id:'x',provider:'OTHER'},{...last,id:'y',selector:'data.other'},{...last,id:'w',metric:'CIRCULATING'},{...last,id:'v',coinId:'usdt'},{...last,id:'u',deploymentId:'usdc-ethereum'},{...last,id:'t',endpoint:'/other'}]};
  assert.deepEqual(chartHistory(data,last,'24h').map(o=>o.amount),['1.5','3']);
  assert.equal(chartHistory(data,last,'7d').length,2);assert.equal(chartHistory(data,last,'30d').length,3);assert.equal(chartHistory(data,last).length,3);
  assert.deepEqual(chartHistory(data,null),[]);assert.throws(()=>chartHistory(data,last,'1y'));
});
test('geometry preserves tiny differences on huge decimal amounts and derives only bounded numeric coordinates',()=>{
  const a='900719925474099300000.000000000000000000000000000000000001',b='900719925474099300000.000000000000000000000000000000000003';
  const g=chartGeometry([row(a,1),row(b,22)]);assert.equal(g.direction,'up');assert.ok(g.points[0].y-g.points[1].y>100);assert.deepEqual(g.points.map(p=>p.row.amount),[a,b]);
  for(const p of g.points){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.y>=28&&p.y<=280);}
  assert.equal(decimalUnits(units(a)),a);assert.equal(decimalUnits(-units('0.000000000000000000000000000000000001')),'-0.000000000000000000000000000000000001');
});
test('missing, single, flat, zero and descending histories never invent extra points',()=>{
  assert.equal(chartGeometry([]).points.length,0);
  const one=chartGeometry([row('0',1)]);assert.equal(one.points.length,1);assert.equal(one.points[0].x,451);assert.equal(one.direction,'flat');
  const flat=chartGeometry([row('1',1),row('1',22)]);assert.equal(flat.points[0].y,flat.points[1].y);assert.equal(flat.direction,'flat');
  const down=chartGeometry([row('2',1),row('0',22)]);assert.equal(down.direction,'down');assert.ok(down.points[1].y>down.points[0].y);assert.equal(down.points.length,2);
});
test('DB history uses the declared query window and excludes old pinned latest values',()=>{
  const old=row('1',1),recent=row('2',21),data={observations:[old,recent],readState:{historyFrom:'2026-10-10T00:00:00.000Z',historyTo:'2026-10-23T00:00:00.000Z'}};
  assert.deepEqual(chartHistory(data,recent).map(o=>o.amount),['2']);
  assert.deepEqual(chartHistory(data,recent,'24h'),[]);
  assert.deepEqual(chartHistory(data,recent,'7d').map(o=>o.amount),['2']);
  assert.deepEqual(chartHistory({...data,observations:[old]},old),[]);
});
