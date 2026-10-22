import test from 'node:test';
import assert from 'node:assert/strict';
import {chartHistory,chartGeometry,decimalUnits,networkSupplySeries,supplyComparisonGeometry} from './market-chart.js';
import {units} from './market-model.js';
const row=(amount,day,id='a')=>({id,amount,coinId:'usdc',deploymentId:null,metric:'PRICE',provider:'ARKHAM',endpoint:'/token/market/usd-coin',selector:'data.price',observedAt:`2026-10-${String(day).padStart(2,'0')}T00:00:00.000Z`,unit:'USD'});
test('history windows anchor to the last stored observation, exclude other sources and resolve duplicate times deterministically',()=>{
  const first=row('1',1),last=row('2',22),data={observations:[last,{...last,id:'z',amount:'3'},row('1.5',21),first,{...last,id:'x',provider:'OTHER'},{...last,id:'y',selector:'data.other'},{...last,id:'w',metric:'CIRCULATING'},{...last,id:'v',coinId:'usdt'},{...last,id:'u',deploymentId:'usdc-ethereum'},{...last,id:'t',endpoint:'/other'}]};
  assert.deepEqual(chartHistory(data,last,'24h').map(o=>o.amount),['1.5','3']);
  assert.equal(chartHistory(data,last,'7d').length,2);assert.equal(chartHistory(data,last,'30d').length,3);assert.equal(chartHistory(data,last).length,3);
  assert.deepEqual(chartHistory(data,null),[]);assert.throws(()=>chartHistory(data,last,'5y'));
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

test('supply charts use a zero baseline without exaggerating tiny source changes or altering exact values',()=>{
  const values=['2356032947.1616707','2356032947.1616708'];
  const rows=values.map((value,i)=>row(value,i+1));
  const g=chartGeometry(rows,{zeroBaseline:true});
  assert.equal(g.ticks[0].amount,'0');
  assert.ok(g.points[0].y-g.points[1].y<0.000001);
  assert.deepEqual(g.points.map(p=>p.row.amount),values);
  assert.equal(g.direction,'up');
});

test('network overlay keeps separate deployment histories, excludes missing and obligations, and shares true time and zero supply axes',()=>{
  const chain=(amount,day,networkId)=>({...row(amount,day,networkId+day),deploymentId:'usdc-'+networkId,networkId,metric:'CHAIN_TOTAL',unit:'token'});
  const a=chain('100',1,'ethereum'),b=chain('101',22,'ethereum'),c=chain('25',21,'solana');
  const data={registry:{networks:['ethereum','solana','xrpl'].map(id=>({id,name:id})),deployments:['ethereum','solana','xrpl'].map(networkId=>({id:'usdc-'+networkId,coinId:'usdc',networkId}))},observations:[b,a,c,{...chain('90',22,'xrpl'),metric:'OBLIGATIONS'}]};
  const groups=networkSupplySeries(data,'usdc');assert.deepEqual(groups.map(s=>s.network.id),['ethereum','solana']);assert.deepEqual(groups.map(s=>s.rows.map(r=>r.amount)),[['100','101'],['25']]);
  assert.equal(networkSupplySeries(data,'usdc',{networkId:'solana'})[0].rows[0],c);assert.deepEqual(networkSupplySeries(data,'usdt'),[]);
  const geometry=chartGeometry(groups.flatMap(s=>s.rows).sort((a,b)=>a.observedAt.localeCompare(b.observedAt)),{zeroBaseline:true});assert.equal(geometry.ticks[0].amount,'0');assert.ok(geometry.points[1].x>geometry.points[0].x&&geometry.points[1].x<geometry.points[2].x);assert.ok(geometry.points[1].y>geometry.points[0].y);
});

test('daily history plots its own network circulating metric and calendar dates without joining Arkham totals',()=>{
 const data={registry:{networks:[{id:'ethereum',name:'Ethereum'},{id:'xrpl',name:'XRPL'}],deployments:[{id:'rlusd-ethereum',coinId:'rlusd',networkId:'ethereum'},{id:'rlusd-xrpl',coinId:'rlusd',networkId:'xrpl'}]},observations:[{...row('999',22),coinId:'rlusd',deploymentId:'rlusd-ethereum',metric:'CHAIN_TOTAL'}],supplyHistory:[{coinId:'rlusd',metric:'NETWORK_CIRCULATING',to:'2026-10-22',networks:[{networkId:'ethereum',points:[{day:'2025-10-22',amount:'10'},{day:'2026-07-24',amount:'15'},{day:'2026-10-22',amount:'20'}]},{networkId:'xrpl',points:[{day:'2026-10-22',amount:'5'}]}]}]};
 const year=networkSupplySeries(data,'rlusd',{source:'history',period:'1y'});assert.deepEqual(year.map(n=>n.rows.map(r=>r.amount)),[['10','15','20'],['5']]);assert.equal(year[0].rows[0].observedAt,'2025-10-22T00:00:00.000Z');
 assert.deepEqual(networkSupplySeries(data,'rlusd',{source:'history',period:'90d'})[0].rows.map(r=>r.amount),['15','20']);assert.deepEqual(networkSupplySeries(data,'rlusd',{source:'recent'})[0].rows.map(r=>r.amount),['999']);assert.equal(networkSupplySeries(data,'usdt',{source:'history'}).length,0);
});

test('change comparison exposes small-network moves on the same percentage scale while retaining exact amounts and negative changes',()=>{
 const a=[row('10000000000',1),row('12000000000',22)],b=[row('5000000',1),row('6000000',22)],c=[row('100',1),row('75',22)];
 const g=supplyComparisonGeometry([{network:{id:'ethereum'},rows:a},{network:{id:'xrpl'},rows:b},{network:{id:'down'},rows:c}],{comparison:'change'});
 const find=r=>g.points.find(p=>p.row===r);assert.equal(find(a[0]).change,'0');assert.equal(find(a[1]).change,'20');assert.equal(find(b[1]).change,'20');assert.equal(find(a[1]).y,find(b[1]).y);assert.equal(find(c[1]).change,'-25');assert.ok(find(c[1]).y>find(c[0]).y);assert.equal(find(b[1]).row.amount,'6000000');assert.ok(g.ticks.some(t=>t.amount.startsWith('-')));
 assert.ok(g.points.every(p=>Number.isFinite(p.y)&&p.y>=28&&p.y<=280));assert.throws(()=>supplyComparisonGeometry([],{comparison:'log'}));
});
test('zero baselines cannot be converted to percentages; flat, single and huge exact amounts stay finite and preserve originals',()=>{
 const zero={network:{id:'zero'},rows:[row('0',1),row('1',22)]},flat={network:{id:'flat'},rows:[row('1',1),row('1',22)]},single={network:{id:'single'},rows:[row('900719925474099300000.123456789',1)]};
 const g=supplyComparisonGeometry([zero,flat,single],{comparison:'change'});assert.deepEqual(g.unavailable,[zero]);assert.equal(g.groups.length,2);assert.ok(g.points.every(p=>p.change==='0'&&Number.isFinite(p.y)));assert.equal(g.points.find(p=>p.row===single.rows[0]).row.amount,single.rows[0].amount);
 assert.equal(supplyComparisonGeometry([zero],{comparison:'change'}).points.length,0);assert.equal(supplyComparisonGeometry([zero],{comparison:'amount'}).points.length,2);
});

test('log amount axes separate tiny positives from real zero and preserve exact decimals, gaps and percent mode',()=>{
 const group=(id,amounts)=>({network:{id},rows:amounts.map((a,i)=>row(a,i?22:1))});
 const a=group('large',['10000000000','20000000000']),b=group('tiny',['0','0.000000000000000000000000000000000001']);
 const g=supplyComparisonGeometry([a,b],{comparison:'amount'});assert.equal(g.axisScale,'log');
 const zero=g.points.find(p=>p.row===b.rows[0]),tiny=g.points.find(p=>p.row===b.rows[1]);assert.equal(zero.y,280);assert(tiny.y<=260);assert.equal(tiny.row.amount,b.rows[1].amount);assert(g.points.every(p=>Number.isFinite(p.y)&&p.y>=28&&p.y<=280));assert.equal(g.ticks[0].amount,'0');
 assert.equal(supplyComparisonGeometry([group('a',['1']),group('b',['99.999999999999999999999'])]).axisScale,'linear');
 assert.equal(supplyComparisonGeometry([group('a',['1']),group('b',['100'])]).axisScale,'log');
 assert.equal(supplyComparisonGeometry([group('a',['0']),group('b',['0'])]).axisScale,'linear');assert.equal(supplyComparisonGeometry([a]).axisScale,'linear');
 const percentage=supplyComparisonGeometry([a,b],{comparison:'change'});assert.equal(percentage.unavailable.length,1);assert.equal(percentage.points.at(-1).change,'100');
});
