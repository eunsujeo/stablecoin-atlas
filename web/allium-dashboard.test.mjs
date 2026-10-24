import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {surveyDto} from '../tests/survey-fixture.mjs';
import {alliumSeries,alliumCoins,alliumGeometry} from './allium-dashboard-model.js';
import {localSurveyReader,parsePreviewArguments,startPreviewServer} from '../tools/ui-preview.mjs';
test('Allium display omits absent fields/deployments, preserves zero, exact decimals and distinct provider clocks',async()=>{
 const dto=await surveyDto(),original=structuredClone(dto),supply=alliumSeries(dto,'usdc','supply','total_supply');
 assert.equal(supply.length,2);assert.equal(supply[0].points[0].amount,'100.000000000000000001');
 assert.equal(alliumSeries(dto,'jpyc','supply','total_supply').some(s=>s.networkId==='kaia'),false);
 assert.deepEqual(alliumSeries(dto,'usdc','supply','adjusted_circulating_supply'),[]);
 assert.equal(alliumSeries(dto,'usdc','supply','circulating_supply')[0].points[0].amount,'0');
 assert.equal(alliumCoins(null).length,0);assert.equal(alliumCoins(dto).length,5);assert.deepEqual(dto,original);
 const v=dto.snapshots.find(s=>s.survey==='volume');v.queriedAt='2026-10-23T10:00:00.123456Z';
 assert.equal(alliumSeries(dto,'usdc','volume','transfer_count')[0].queriedAt,v.queriedAt);
 assert.equal(alliumSeries(dto,'usdc','supply','total_supply')[0].queriedAt,supply[0].queriedAt);
 dto.snapshots=dto.snapshots.filter(s=>s.survey==='supply');assert.deepEqual(alliumSeries(dto,'usdc','volume','transfer_volume'),[]);
 assert.throws(()=>alliumSeries(dto,'usdc','supply','minted'));
});
test('missing days split chart segments; zero and huge decimal values retain their exact table values',()=>{
 const points=[{day:'2026-10-16',amount:'0'},{day:'2026-10-17',amount:'9007199254740993.000000000000000001'},{day:'2026-10-19',amount:'9007199254740993.000000000000000002'}];
 const segments=alliumGeometry(points);assert.deepEqual(segments.map(s=>s.length),[2,1]);assert.equal(segments[0][0].y,150);assert.equal(segments[1][0].amount,points[2].amount);
 assert.equal(alliumGeometry([{day:'2026-10-16',amount:'0'}])[0][0].y,150);
});
test('explicit offline survey file serves only validated DTO; failures never fall back to another source',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'allium-preview-')),path=join(dir,'index.json'),dto=await surveyDto();dto.secret='PRIVATE';
 await writeFile(path,JSON.stringify(dto));const server=await startPreviewServer(0,{surveyReader:localSurveyReader(path)}),base='http://127.0.0.1:'+server.address().port;
 try{
  const r=await fetch(base+'/survey-data.json');assert.equal(r.status,200);const text=await r.text();assert(!text.includes('PRIVATE'));assert.equal(JSON.parse(text).snapshots.length,2);
  for(const p of ['/allium-dashboard.js','/allium-dashboard-model.js'])assert.equal((await fetch(base+p)).status,200);
  await writeFile(path,'{}');assert.equal((await fetch(base+'/survey-data.json')).status,503);
  await writeFile(path,' '.repeat(128*1024+1));await assert.rejects(localSurveyReader(path)());
  assert.equal(parsePreviewArguments(['--survey-file',path]).surveyFile,path);
  assert.throws(()=>parsePreviewArguments(['--survey-file',path,'--database']));
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
