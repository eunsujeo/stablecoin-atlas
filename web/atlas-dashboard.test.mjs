import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {change,dashboardView,parseDashboardFilters,filterSearch,contiguousSegments,downsample,seriesIdentity} from './atlas-dashboard-model.js';
import {buildMarket} from '../tools/market-store.mjs';
const registry=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url),'utf8'));
const filters={coin:'usdc',metric:'CIRCULATING',network:'all',period:'all',sort:'time-desc',page:1};
const at=n=>new Date(Date.parse('2026-10-20T00:00:00Z')+n*60000).toISOString();
const row=(n,amount='1',extra={})=>({id:createHash('sha256').update(n+amount+JSON.stringify(extra)).digest('hex'),coinId:'usdc',deploymentId:null,networkId:null,metric:'CIRCULATING',unit:'token',provider:'ARKHAM',endpoint:'/token/market/usd-coin',selector:'$.requests[0].data.circulatingSupply',observedAt:at(n),sourceAt:null,amount,...extra});
const data=observations=>({registry,observations});
test('dashboard changes retain arbitrary decimal precision, negative changes, explicit zero and unavailable baselines',()=>{
 assert.equal(change('999999999999999999.123456789012345679','999999999999999999.123456789012345678').amount,'0.000000000000000001');
 assert.deepEqual(change('0','10'),{amount:'-10',percent:'-100.00',reason:null});
 assert.equal(change('2','0').percent,null);assert.equal(change('0','0').reason,'이전 값이 0');assert.equal(change('1',null).amount,null);
});
test('URL filters roundtrip, reject unknown values and never apply a chain filter to coin-wide metrics',()=>{
 const f=parseDashboardFilters('?coin=usdt&metric=CHAIN_TOTAL&network=tron&period=7d&sort=amount-asc&page=2',registry);
 assert.deepEqual(parseDashboardFilters(filterSearch(f),registry),f);
 assert.equal(parseDashboardFilters('?network=tron',registry).network,'all');
 assert.equal(parseDashboardFilters('?metric=__proto__&period=constructor&coin=bad&page=-1',registry).metric,'CIRCULATING');
 assert.equal(parseDashboardFilters('?metric=__proto__&period=constructor',registry).period,'24h');
});
test('same-time observations resolve deterministically within one identity; selectors, endpoints, units and deployments remain separate',()=>{
 const base=row(0,'2'),duplicate={...base,id:'f'.repeat(64)},other=row(0,'4',{selector:'$.additionalRequests[0].data.circulatingSupply'});
 const d=data([base,duplicate,other]);assert.notEqual(seriesIdentity(base),seriesIdentity(other));
 const v=dashboardView(d,filters);assert.equal(v.rows.length,2);assert.equal(v.series.length,2);assert.equal(v.last,null);assert.equal(v.interval.percent,null);
 assert.equal(v.rows.find(r=>r.selector===base.selector).id,duplicate.id);
 for(const extra of [{endpoint:'/other'},{unit:'USD'},{deploymentId:'usdc-ethereum'}])assert.notEqual(seriesIdentity(base),seriesIdentity({...base,...extra}));
});
test('all panels share a fixed end/window, network filtering and exact numeric sorting before bounded pagination',()=>{
 const observations=Array.from({length:35},(_,n)=>row(n,String(100-n),{metric:'CHAIN_TOTAL',networkId:'ethereum',deploymentId:'usdc-ethereum'}));
 observations.push(row(34,'999',{metric:'CHAIN_TOTAL',networkId:'solana',deploymentId:'usdc-solana'}));
 const v=dashboardView(data(observations),{...filters,metric:'CHAIN_TOTAL',network:'ethereum',sort:'amount-asc',page:2});
 assert.equal(v.rows.length,35);assert.equal(v.series.length,1);assert.equal(v.last.amount,'66');assert.equal(v.table[0].amount,'78');assert.equal(v.pages,3);
 assert.equal(dashboardView(data(observations),{...filters,metric:'CHAIN_TOTAL',network:'ethereum',page:999}).page,3);
 const window=dashboardView(data([row(0),row(1441)]),{...filters,period:'24h'});assert.equal(window.rows.length,1);assert.equal(window.previous.percent,null);
});
test('previous equal-length window needs complete unsampled coverage; gaps and missing windows do not become zero or interpolation',()=>{
 const observations=Array.from({length:577},(_,n)=>row(n*5,String(100+n)));
 const v=dashboardView(data(observations),{...filters,period:'24h'});assert.notEqual(v.previous.percent,null);assert.equal(v.previous.amount,'289');
 assert.equal(dashboardView(data(observations.slice(100)),{...filters,period:'24h'}).previous.percent,null);
 const sampled={...data(observations),readState:{sampled:true,historyFrom:at(0),historyTo:at(3000)}};
 assert.equal(dashboardView(sampled,{...filters,period:'24h'}).previous.percent,null);
 for(const flags of [{sampled:false,latestRequestFailures:1},{sampled:false,latestMissingFields:1}])assert.equal(dashboardView({...sampled,readState:{...sampled.readState,...flags}},{...filters,period:'24h'}).previous.percent,null);
 assert.equal(dashboardView({...data(observations),lastBuildState:'FAILED'},{...filters,period:'24h'}).previous.percent,null);
 const gap=[row(0,'0'),row(5,'1'),row(90,'3')];assert.equal(contiguousSegments(gap).length,2);assert.equal(dashboardView(data(gap),filters).gaps,1);
 assert.equal(dashboardView(data([]),filters).rows.length,0);
});
test('plot downsampling keeps first/last and bucket extrema while table and KPI retain full original rows',()=>{
 const rows=Array.from({length:1000},(_,n)=>row(n,n===500?'1000000':String(n)));
 const sampled=downsample(rows);assert.ok(sampled.length<=240);assert.equal(sampled[0],rows[0]);assert.equal(sampled.at(-1),rows.at(-1));assert.ok(sampled.includes(rows[500]));
 const v=dashboardView(data(rows),filters);assert.equal(v.rows.length,1000);assert.equal(v.last,rows.at(-1));
});
test('replaying the same saved collection preserves observation IDs/counts and original request times',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-idempotency-'));
 try{
  const path=join(directory,'source.json');await writeFile(path,JSON.stringify({requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:at(0),data:{circulatingSupply:'100.000001',price:'1'}}]}));
  const first=await buildMarket({directory,registryPath:new URL('../data/asset-registry.json',import.meta.url),sourcePaths:[path]});
  const second=await buildMarket({directory,registryPath:new URL('../data/asset-registry.json',import.meta.url),sourcePaths:[path]});
  assert.deepEqual(second.observations,first.observations);assert.equal(second.observations.length,2);assert.ok(second.observations.every(r=>r.observedAt===at(0)));
 }finally{await rm(directory,{recursive:true,force:true});}
});
