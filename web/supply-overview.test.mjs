import {surveyDto} from '../tests/survey-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {overviewSupplyGroups,readOverviewHistories,legacyOverviewDetails,overviewNetworkRanking,supplyQuantityLabel,overviewTransferGroups,transferComposition} from './supply-overview-model.js';
import {supplyComparisonGeometry,dailySupplySegments} from './market-chart.js';
import {localRegistrationReader} from '../tools/registration-file-preview.mjs';
import {parsePreviewArguments,startPreviewServer} from '../tools/ui-preview.mjs';
function fixture(){
 const ids=['usdc','usdt','rlusd','jpysc','jpyc'],selectionId='a'.repeat(64),from='2025-10-23',to='2026-10-23',metric='NETWORK_CIRCULATING';
 const index={schemaVersion:1,kind:'REGISTERED_SUPPLY_INDEX',selectionId,networks:[{id:'ethereum',name:'Ethereum'}],coins:ids.map((id,i)=>({id,symbol:id.toUpperCase(),name:id,pegCurrency:id.startsWith('jpy')?'JPY':'USD',notes:[],metrics:[{metric,sourceId:String(i+1).repeat(64),from,to}]}))};
 const histories=index.coins.map(c=>({schemaVersion:1,kind:'REGISTERED_SUPPLY_HISTORY',selectionId,coinId:c.id,metric,pegCurrency:c.pegCurrency,contract:{metric,unit:'token',amountKind:'TOKEN_QUANTITY',definition:'DEFILLAMA_NETWORK_CIRCULATING_V1'},from,to,updatedAt:'2026-10-23T12:00:00.000Z',state:'AVAILABLE',sourceId:c.metrics[0].sourceId,sourceHash:'b'.repeat(64),missingNetworks:[],series:[{networkId:'ethereum',points:[{day:from,amount:'9007199254740993.000000000000000001'},{day:'2026-10-22',amount:'100'},{day:to,amount:'80'}]}]}));
 return {schemaVersion:1,kind:'LOCAL_REGISTERED_SUPPLY',index,histories};
}
test('fixed five coins share a year axis; window-relative decline, zero baseline and missing days stay distinct',()=>{
 const {histories}=fixture(),original=structuredClone(histories),year=overviewSupplyGroups(histories);
 assert.equal(year.from,'2025-10-23');assert.equal(year.to,'2026-10-23');assert.equal(year.groups.length,5);assert.equal(new Set(year.groups.map(g=>g.key)).size,5);
 assert.equal(year.groups[0].rows[0].amount,'9007199254740993.000000000000000001');
 assert.equal(overviewSupplyGroups(histories,{period:'90d'}).from,'2026-07-25');
 const month=overviewSupplyGroups(histories,{period:'30d'});assert.equal(month.from,'2026-09-23');assert.equal(month.groups[0].rows.length,2);
 const geometry=supplyComparisonGeometry(month.groups,{comparison:'change'});assert.equal(geometry.points.find(p=>p.row===month.groups[0].rows.at(-1)).change,'-20');
 const points=year.groups[0].rows.map(row=>({row}));assert.deepEqual(dailySupplySegments(points).map(s=>s.length),[1,2]);
 month.groups[0].rows[0].amount='0';assert.equal(supplyComparisonGeometry(month.groups,{comparison:'change'}).unavailable.length,1);
 assert.deepEqual(histories,original);assert.deepEqual(overviewSupplyGroups([]).groups,[]);assert.throws(()=>overviewSupplyGroups(histories,{period:'7d'}));
 const later=structuredClone(histories);later[0].to='2026-10-24';assert.equal(overviewSupplyGroups(later).to,'2026-10-24');
 assert.deepEqual(legacyOverviewDetails({supplyHistory:[{...histories[0],provider:'OTHER'}]}),[]);
});
test('stored reads are bounded to two and last-good requires every immutable source pin',async()=>{
 const {index,histories}=fixture();let active=0,max=0,calls=0;
 const result=await readOverviewHistories(index,async url=>{active++;max=Math.max(max,active);calls++;await new Promise(r=>setTimeout(r,2));active--;return histories.find(h=>h.coinId===new URL(url,'http://localhost').searchParams.get('coin'));});
 assert.equal(max,2);assert.equal(calls,5);assert.equal(result.failed,false);assert.equal(result.details.length,5);
 const failed=await readOverviewHistories(index,async()=>{throw Error('FAIL');},histories);assert.equal(failed.details.length,5);assert.equal(failed.failed,true);
 for(const field of ['sourceId','from','to']){const changed=structuredClone(index);changed.coins[0].metrics[0][field]=field==='sourceId'?'c'.repeat(64):'2026-10-22';assert.equal((await readOverviewHistories(changed,async()=>{throw Error();},histories)).details.length,4);}
 const changed=structuredClone(index);changed.selectionId='d'.repeat(64);assert.equal((await readOverviewHistories(changed,async()=>{throw Error();},histories)).details.length,0);
 const bad=structuredClone(histories[0]);bad.coinId='usdt';const invalid=await readOverviewHistories(index,async()=>bad);assert.equal(invalid.details.length,0);assert.equal(invalid.failed,true);
});
test('explicit offline registration bundle validates all pins, discards extra fields and rejects unsafe files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'year-overview-')),path=join(dir,'index.json'),bundle=fixture();bundle.index.private='SECRET';bundle.histories[0].series[0].points[0].secret='SECRET';
 await writeFile(path,JSON.stringify(bundle));const reader=localRegistrationReader(path),server=await startPreviewServer(0,{registrationReader:reader}),base='http://127.0.0.1:'+server.address().port;
 try{
  const index=await (await fetch(base+'/registration-index.json')).json();assert(!JSON.stringify(index).includes('SECRET'));
  const query='/registration-history.json?'+new URLSearchParams({selection:index.selectionId,coin:'usdc',metric:'NETWORK_CIRCULATING'});
  const detail=await (await fetch(base+query)).json();assert(!JSON.stringify(detail).includes('SECRET'));assert.equal(detail.series[0].points[0].amount,bundle.histories[0].series[0].points[0].amount);
  assert.equal(parsePreviewArguments(['--registration-file',path]).registrationFile,path);assert.throws(()=>parsePreviewArguments(['--registration-file',path,'--database']));
  assert.equal((await fetch(base+'/supply-overview.js')).status,200);
  await writeFile(path,JSON.stringify({...bundle,histories:[bundle.histories[0],bundle.histories[0]]}));assert.equal((await fetch(base+'/registration-index.json')).status,503);
  await writeFile(path,'{}');assert.equal((await fetch(base+query)).status,503);
  await writeFile(path,' '.repeat(8*1024*1024+1));await assert.rejects(reader('/registration-index.json'));
  const link=join(dir,'link.json');await symlink(path,link);await assert.rejects(localRegistrationReader(link)('/registration-index.json'));
 }finally{server.closeIdleConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

test('network ranking uses exact latest quantities, ties and independent days; display never changes source amounts',()=>{
 const group=(networkId,amount,day)=>({key:'usdc:'+networkId,networkId,rows:[{amount:'999999999999999999999',observedAt:'2025-10-23T00:00:00.000Z'},{amount,observedAt:day+'T00:00:00.000Z'}]});
 const groups=[group('a','9007199254740993.000000000000000001','2026-10-21'),group('b','9007199254740993.000000000000000002','2026-10-22'),group('c','0','2026-10-20'),group('d','9007199254740993.000000000000000002','2026-10-19')],original=structuredClone(groups);
 const ranked=overviewNetworkRanking(groups);assert.deepEqual(ranked.map(g=>g.networkId),['b','d','a','c']);assert.deepEqual(ranked.map(g=>g.rank),[1,1,3,4]);assert.equal(ranked[3].width,0);assert.equal(ranked[0].width,100);assert.equal(ranked[1].last.observedAt,'2026-10-19T00:00:00.000Z');assert.deepEqual(groups,original);
 assert.equal(overviewNetworkRanking([group('zero','0','2026-10-22')])[0].width,0);assert.deepEqual(overviewNetworkRanking([]),[]);
 for(const [amount,label]of [['0','0'],['10000000','1000만'],['100000000','1억'],['44826999999','448.26억'],['1000000000000','1조'],['1234.567891','1,234.5678…']])assert.equal(supplyQuantityLabel(amount),label);
});

test('restored transfers keep their own stored window, exact volumes, real zero and gaps without supply fallback',async()=>{
 const dto=await surveyDto(),original=structuredClone(dto),view=overviewTransferGroups(dto,'usdc');
 assert.equal(view.from,'2026-10-16');assert.equal(view.to,'2026-10-22');assert.equal(view.groups.length,2);
 assert.equal(view.groups[0].rows[0].amount,'100.000000000000000001');assert.equal(view.groups[0].dateBasis,'PROVIDER_DAY');assert.equal(view.groups[0].aggregateTimezone,'UNKNOWN');assert.deepEqual(dto,original);
 const volume=dto.snapshots.find(s=>s.survey==='volume');volume.queriedAt='2026-10-23T13:33:40.559550Z';
 const row=day=>volume.rows.find(r=>r.deploymentId==='usdc-ethereum'&&r.providerDay===day);
 row('2026-10-17').values.transfer_volume=null;row('2026-10-18').values.transfer_volume='0';volume.rows=volume.rows.filter(r=>!(r.deploymentId==='usdc-ethereum'&&r.providerDay==='2026-10-19'));
 const ethereum=overviewTransferGroups(dto,'usdc').groups.find(g=>g.networkId==='ethereum');
 assert.deepEqual(ethereum.rows.map(r=>r.observedAt.slice(0,10)),['2026-10-16','2026-10-18','2026-10-20','2026-10-21','2026-10-22']);assert.equal(ethereum.rows[1].amount,'0');assert.equal(ethereum.updatedAt,volume.queriedAt);
 assert.deepEqual(dailySupplySegments(ethereum.rows.map(row=>({row}))).map(s=>s.length),[1,1,3]);
 assert.equal(overviewTransferGroups(dto,'jpysc').groups[0].rows.length,4);assert(!overviewTransferGroups(dto,'jpyc').groups.some(g=>g.networkId==='kaia'));
 dto.snapshots=dto.snapshots.filter(s=>s.survey==='supply');assert.deepEqual(overviewTransferGroups(dto,'usdc'),{groups:[],from:null,to:null});assert.deepEqual(overviewTransferGroups(null,'usdc').groups,[]);
});

test('transfer composition pins token/source/window/day and never carries missing networks or invents zero shares',async()=>{
 const dto=await surveyDto(),groups=overviewTransferGroups(dto,'usdc').groups,original=structuredClone(groups);
 groups[0].rows[0].amount='9007199254740993.000000000000000001';groups[1].rows[0].amount='3002399751580331.000000000000000001';
 const view=transferComposition(groups,'2026-10-16');assert.equal(view.totalAmount,'12009599006321324.000000000000000002');assert.equal(view.entries[0].share,'75.00');assert.equal(view.entries[1].share,'25.00');assert.equal(view.dateBasis,'PROVIDER_DAY');assert.equal(view.aggregateTimezone,'UNKNOWN');
 const thirds=structuredClone(groups);thirds.push({...structuredClone(thirds[0]),networkId:'third',key:'usdc:third'});for(const group of thirds)group.rows[0].amount='1';assert.deepEqual(transferComposition(thirds,'2026-10-16').entries.map(e=>e.share),['33.33','33.33','33.33']);
 const missing=transferComposition(groups,'2026-10-15');assert.equal(missing.state,'MISSING');assert.equal(missing.totalAmount,null);assert.equal(missing.day,'2026-10-15');
 const partial=structuredClone(groups);partial[1].rows=partial[1].rows.slice(1);const one=transferComposition(partial,'2026-10-16');assert.equal(one.entries.length,1);assert.equal(one.entries[0].share,'100.00');
 const hidden=transferComposition(groups,'2026-10-16',new Set(groups.map(g=>g.key)));assert.equal(hidden.state,'FILTERED');assert.equal(hidden.totalAmount,null);assert(hidden.entries.every(e=>e.share===null));
 const zero=structuredClone(groups);for(const g of zero)g.rows[0].amount='0';const emptyValue=transferComposition(zero,'2026-10-16');assert.equal(emptyValue.state,'ZERO');assert.equal(emptyValue.totalAmount,'0');assert(emptyValue.entries.every(e=>e.share===null&&e.arc===0));
 for(const field of ['coinId','sourceHash','updatedAt','dateBasis','aggregateTimezone']){const mixed=structuredClone(groups);mixed[1][field]='different';assert.throws(()=>transferComposition(mixed));}
 const mixedWindow=structuredClone(groups);mixedWindow[1].sourceWindow.from='2026-10-17';assert.throws(()=>transferComposition(mixedWindow));assert.throws(()=>transferComposition(groups,'2026-02-30'));
 const unchanged=overviewTransferGroups(dto,'usdc').groups;assert.deepEqual(unchanged,original);const saved=structuredClone(groups);transferComposition(groups);assert.deepEqual(groups,saved);
});
