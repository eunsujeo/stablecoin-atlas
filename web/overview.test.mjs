import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {overviewSummary,overviewRanking,overviewEvidenceRanking} from './overview-model.js';
import {dashboardEvidence} from './evidence-model.js';
import {normalizeSources} from '../tools/market-store.mjs';
import {projectResponse,readProvider} from '../tools/market-collect.mjs';
const report=(n,scope='STORED_READ_ONLY',extra={})=>({id:String(n).padStart(64,'0'),label:'USDC',asset:'USDC',chain:'EVM',identity:{networkId:'1'},scope,completedAt:'2026-10-22T00:00:00.000Z',...extra});
function evidence(verdicts,scope='STORED_READ_ONLY') {const r=report(1,scope);return {kind:'LOCAL_EVIDENCE_INDEX',reports:[r],items:verdicts.map((verdict,i)=>({key:String(i),reportId:r.id,scenarioId:'scenario-'+i,scenarioVersion:'1',verdict,support:'UNKNOWN',executionStatus:verdict==='NOT_TESTED'?'NOT_EXECUTED':verdict==='INCONCLUSIVE'?'ERROR':'COMPLETED'}))};}
const registry=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url),'utf8'));
test('dashboard excludes development fixtures from reports, items, totals and rankings without changing source evidence',()=>{
  const index=evidence(['PASS']);const fixture=report(2,'LOCAL_FIXTURE',{asset:'StandardToken'});
  index.reports.push(fixture);index.items.push({key:'private-control',reportId:fixture.id,verdict:'FAIL',support:'UNKNOWN',executionStatus:'COMPLETED'});
  const original=structuredClone(index),visible=dashboardEvidence(index);
  assert.equal(visible.reports.length,1);assert.equal(visible.items.length,1);assert.equal(overviewSummary(visible).total,1);
  assert.deepEqual(overviewEvidenceRanking(visible).map(r=>r.label),['USDC']);
  assert.equal(overviewEvidenceRanking(visible,{scope:'LOCAL_FIXTURE'}).length,0);
  assert.deepEqual(index,original);assert.equal(index.reports.length,2);
});
test('overview shows provisional scenario success separately from coverage and never changes verdict/support or scopes',()=>{
  const index=evidence(['PASS','PASS','FAIL','NOT_TESTED','INCONCLUSIVE','UNSUPPORTED','NOT_APPLICABLE']);const original=structuredClone(index);
  const fixture=report(2,'LOCAL_FIXTURE');index.reports.push(fixture);index.items.push({key:'fixture-fail',reportId:fixture.id,verdict:'FAIL',support:'UNKNOWN',executionStatus:'COMPLETED'});
  const summary=overviewSummary(index);assert.equal(summary.score,66);assert.equal(summary.grade,'D');assert.equal(summary.coverage,50);assert.equal(summary.provisional,true);assert.equal(summary.counts.FAIL,1);assert.equal(summary.executionCounts.ERROR,1);assert.equal(summary.executionCounts.NOT_EXECUTED,1);assert.equal(summary.policyVersion,'SCENARIO_SUCCESS_V1');
  const local=overviewSummary(index,'LOCAL_FIXTURE');assert.equal(local.score,0);assert.equal(local.grade,'F');assert.equal(local.counts.FAIL,1);assert.equal(local.total,1);assert.deepEqual(index.items.slice(0,original.items.length),original.items);
});
test('empty, wholly untested and all inapplicable evidence never become zero-score failures or perfect grades',()=>{
  for(const values of [[],['NOT_TESTED','INCONCLUSIVE','UNSUPPORTED'],['NOT_APPLICABLE']]){
    const summary=overviewSummary(evidence(values));assert.equal(summary.score,null);assert.equal(summary.grade,null);assert.equal(summary.coverage,values.includes('NOT_TESTED')?0:null);
  }
  assert.throws(()=>overviewSummary(evidence([]),'ALL'));
});
test('latest report per asset identity replaces older runs; other identities and scenario samples remain distinct',()=>{
  const index=evidence(['FAIL']);index.reports[0].completedAt='2026-10-21T00:00:00.000Z';const newer=report(2);index.reports.push(newer);index.items.push({key:'new',reportId:newer.id,verdict:'PASS',support:'UNKNOWN',executionStatus:'COMPLETED'});
  assert.equal(overviewSummary(index).score,100);assert.equal(overviewSummary(index).total,1);
  const other=report(3,'STORED_READ_ONLY',{chain:'SOLANA'});index.reports.push(other);index.items.push({key:'other',reportId:other.id,verdict:'FAIL',support:'UNKNOWN',executionStatus:'COMPLETED'});assert.equal(overviewSummary(index).score,50);assert.equal(overviewSummary(index).reports.length,2);
});
test('grade boundaries use the exact ratio, with floor applied only to the displayed score',()=>{
  for(const [passes,total,grade] of [[9,10,'A'],[89,100,'B'],[8,10,'B'],[7,10,'C'],[6,10,'D'],[59,100,'F']]){const s=overviewSummary(evidence([...Array(passes).fill('PASS'),...Array(total-passes).fill('FAIL')]));assert.equal(s.grade,grade);assert.equal(s.provisional,false);}
});
test('asset/network ranks aggregate counts across latest identities, preserve scopes and exact shared ranks',()=>{
  const a=report(1,'STORED_READ_ONLY',{identity:{networkId:'1'},completedAt:'2026-10-21T00:00:00Z'});
  const b=report(2,'STORED_READ_ONLY',{identity:{networkId:'1'}});
  const c=report(3,'STORED_READ_ONLY',{chain:'SOLANA',identity:{networkId:'mainnet'}});
  const d=report(4,'STORED_READ_ONLY',{asset:'USDT',chain:'EVM',identity:{networkId:'1'}});
  const fixture=report(5,'LOCAL_FIXTURE',{identity:{networkId:'31337'}});
  const make=(r,verdicts)=>verdicts.map((verdict,i)=>({key:r.id+'-'+i,reportId:r.id,verdict,support:'UNKNOWN',executionStatus:verdict==='NOT_TESTED'?'NOT_EXECUTED':'COMPLETED'}));
  const index={kind:'LOCAL_EVIDENCE_INDEX',reports:[a,b,c,d,fixture],items:[...make(a,['FAIL','FAIL']),...make(b,['PASS','NOT_TESTED']),...make(c,['FAIL','FAIL','FAIL','NOT_APPLICABLE']),...make(d,['PASS','FAIL','FAIL','FAIL']),...make(fixture,['PASS'])]};
  const original=structuredClone(index),assets=overviewEvidenceRanking(index),networks=overviewEvidenceRanking(index,{groupBy:'network'});
  assert.deepEqual(assets.map(r=>[r.label,r.rank,r.score,r.coverage]),[['USDC',1,25,80],['USDT',1,25,100]]);
  assert.equal(assets[0].reports.length,2);assert.equal(assets[0].networkCount,2);assert.equal(assets[0].counts.NOT_APPLICABLE,1);
  assert.deepEqual(networks.map(r=>[r.chain,r.score,r.coverage]),[['EVM',40,83],['SOLANA',0,100]]);
  assert.equal(overviewEvidenceRanking(index,{metric:'coverage'})[0].label,'USDT');
  assert.equal(overviewEvidenceRanking(index,{scope:'LOCAL_FIXTURE'})[0].score,100);
  assert.deepEqual(index,original);assert.throws(()=>overviewEvidenceRanking(index,{groupBy:'chain-family'}));
});
test('unknown score has no ordinal, zero coverage is meaningful, exact ratios do not tie just because display floors match',()=>{
  const index={kind:'LOCAL_EVIDENCE_INDEX',reports:[],items:[]};
  for(const [n,asset,verdicts]of [[1,'A',['PASS',...Array(100).fill('FAIL')]],[2,'B',['PASS',...Array(101).fill('FAIL')]],[3,'C',['NOT_TESTED']],[4,'D',['NOT_APPLICABLE']]]){
    const r=report(n,'STORED_READ_ONLY',{asset,identity:{networkId:'1'}});index.reports.push(r);
    index.items.push(...verdicts.map((verdict,i)=>({key:asset+i,reportId:r.id,verdict,support:'UNKNOWN',executionStatus:verdict==='NOT_TESTED'?'NOT_EXECUTED':'COMPLETED'})));
  }
  const rows=overviewEvidenceRanking(index);assert.deepEqual(rows.map(r=>r.rank),[1,2,null,null]);assert.equal(rows[0].score,0);assert.equal(rows[1].score,0);
  const coverage=overviewEvidenceRanking(index,{metric:'coverage'});assert.equal(coverage.find(r=>r.label==='C').coverage,0);assert.equal(coverage.find(r=>r.label==='C').rank,3);assert.equal(coverage.find(r=>r.label==='D').rank,null);
  const missing=structuredClone(index);for(const r of missing.reports){delete r.identity;delete r.asset;}
  assert.equal(overviewEvidenceRanking(missing,{groupBy:'network'}).length,4);assert.equal(overviewEvidenceRanking(missing).length,4);
});
test('circulating and total supply rank independently using precise decimals, while unknown volume has no rank',async()=>{
  const raw=await readProvider('/token/market/usd-coin','mock',async()=>new Response('{"circulatingSupply":9007199254740993.00001,"price":1,"totalSupply":999999999999999999.123456789,"totalVolume":123456789012345678.99}'));
  const projection=projectResponse('/token/market/usd-coin',raw,registry);assert.equal(projection.totalVolume,'123456789012345678.99');assert.equal(projection.totalSupply,'999999999999999999.123456789');
  const data=normalizeSources(registry,[{hash:'0'.repeat(64),value:{requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-22T00:00:00.000Z',data:projection},{endpoint:'/token/market/tether',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-22T00:00:00.000Z',data:{circulatingSupply:'9007199254740993.00002',totalSupply:'0',price:'1'}}]}}]);
  assert.equal(overviewRanking(data,'CIRCULATING')[0].coinId,'usdt');assert.equal(overviewRanking(data,'COIN_TOTAL')[0].coinId,'usdc');assert.equal(overviewRanking(data,'COIN_TOTAL')[1].amount,'0');assert.throws(()=>overviewRanking(data,'REPORTED_VOLUME'));assert.throws(()=>overviewRanking(data,'OBLIGATIONS'));assert.equal(data.observations.find(o=>o.metric==='REPORTED_VOLUME').unit,'UNKNOWN');
  const missing=projectResponse('/token/market/usd-coin',{circulatingSupply:'0',price:'1',totalSupply:null,totalVolume:null},registry);assert.ok(!Object.hasOwn(missing,'totalVolume'));assert.ok(!Object.hasOwn(missing,'totalSupply'));
});
