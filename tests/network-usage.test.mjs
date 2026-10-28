import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,realpath,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {networkUsagePlan} from '../tools/network-usage-plan.mjs';
import {collectNetworkUsage} from '../tools/arkham-network-usage.mjs';
import {histogramPoints,projectUsageArchive} from '../tools/network-usage-source.mjs';
import {digest} from '../tools/market-db/plan.mjs';
import {validateNetworkUsage,networkUsageView} from '../web/network-usage-model.js';
import {overviewUsageRows,overviewTransferGroups} from '../web/supply-overview-model.js';
import {networkUsageFixture} from './network-usage-fixture.mjs';
import {databaseNetworkUsageReader} from '../tools/market-db/network-usage-preview.mjs';
import {reviewedNetworkUsageImport} from '../tools/market-db/network-usage.mjs';
import {startPreviewServer} from '../tools/ui-preview.mjs';
async function setup(t){const root=await realpath(await mkdtemp(join(tmpdir(),'atlas-usage-bundle-')));t.after(()=>rm(root,{recursive:true,force:true}));const plan=await networkUsagePlan('2026-10-28'),planBytes=Buffer.from(JSON.stringify(plan)),approvalBytes=Buffer.from('FIXTURE ONLY: five request approval');let clock=0;return {plan,o:{root,planBytes,expectedPlanHash:digest(planBytes),approvalBytes,expectedApprovalHash:digest(approvalBytes),key:'fixture-key',clock:()=>clock,now:()=>new Date(Date.parse('2026-10-28T01:00:00Z')+clock).toISOString(),sleep:async ms=>{clock+=ms;}}};}
const raw=()=>Buffer.from('[{"time":"2026-10-27T00:00:00Z","count":9007199254740993,"usd":1.234567890123456789012345678901234567}]');
test('five fixed deployments execute once, preserve previous evidence and project missing buckets without zero fill',async t=>{
 const {plan,o}=await setup(t);await writeFile(join(o.root,'previous'),'old',{mode:0o600});const urls=[];
 const r=await collectNetworkUsage({...o,fetcher:async(u,options)=>{urls.push(u);assert.equal(options.redirect,'error');assert.equal(options.method,'GET');assert(options.signal);return new Response(raw());}});
 assert.equal(r.state,'COMPLETE');assert.equal(r.attempts.length,5);assert(r.previousPreserved);assert.equal(new Set(urls).size,5);assert(urls.every(u=>u.includes('/transfers/histogram?')&&!u.includes('timeLast')));assert.equal(Date.parse(r.attempts[4].at)-Date.parse(r.attempts[0].at),4000);
 const dir=join(o.root,plan.slot),rb=await readFile(join(dir,'receipt.json')),opts={planFileHash:o.expectedPlanHash,receiptHash:digest(rb),approvalHash:o.expectedApprovalHash};
 const p=await projectUsageArchive(dir,opts);assert.equal(p.rows.length,35);assert.equal(p.rows.filter(r=>r.state==='OBSERVED').length,5);assert(p.rows.filter(r=>r.state==='MISSING').every(r=>r.usd===null&&r.transfers===null&&r.providerTime===null));assert.equal(p.rows.at(-1).transfers,'9007199254740993');assert.equal(p.rows.at(-1).providerTime,'2026-10-27T00:00:00Z');assert(p.rows.every(r=>r.transactions===null));
 await assert.rejects(collectNetworkUsage({...o,fetcher:()=>assert.fail('consumed')}));
 const altered=Buffer.from(raw().toString().replace('9007199254740993','1'));await writeFile(join(dir,'response-0.json'),altered,{mode:0o600});await assert.rejects(projectUsageArchive(dir,opts));
});
for(const kind of ['403','429','redirect','timeout','partial','oversize'])test('bundle stops on '+kind+' and never publishes partial evidence',async t=>{
 const {o}=await setup(t);let calls=0,pulls=0;
 const r=await collectNetworkUsage({...o,fetcher:async()=>{calls++;if(kind==='redirect'||kind==='timeout')throw Error('private transport');if(kind==='partial')return new Response(new ReadableStream({pull(c){if(!pulls++)c.enqueue(Buffer.from('['));else c.error(Error('private body'));}}));if(kind==='oversize')return new Response('x'.repeat(2097153));return new Response('{}',{status:Number(kind)});}});
 assert.equal(calls,1);assert.equal(r.state,'STOPPED_UNKNOWN');assert(r.jobs.slice(1).every(j=>j.state==='NOT_TESTED'));assert(r.previousPreserved);assert(!JSON.stringify(r).includes('private'));if(kind==='partial'){assert.equal(r.attempts[0].partial,true);assert.equal(r.responseBytes,1);}if(kind==='oversize')assert.equal(r.responseBytes,2097152);
});
test('strict source rejects duplicates, strings as numbers, exponents, invalid dates and repeated days',async()=>{
 const plan=await networkUsagePlan('2026-10-28');for(const text of ['[{"time":"2026-10-27T00:00:00Z","count":1,"count":2,"usd":3}]','[{"time":"2026-10-27T00:00:00Z","count":"1","usd":3}]','[{"time":"2026-10-27T00:00:00Z","count":1,"usd":1e9}]','[{"time":"2026-10-28T00:00:00Z","count":1,"usd":3}]','['+raw().toString().slice(1,-1)+','+raw().toString().slice(1,-1)+']'])assert.throws(()=>histogramPoints(Buffer.from(text),plan.window));
 assert.deepEqual(histogramPoints(Buffer.from('[]'),plan.window),[]);assert.equal(histogramPoints(Buffer.from('[{"time":"2026-10-27T00:00:00.000Z","count":0,"usd":0}]'),plan.window)[0].usd,'0');
});
test('approval mismatch, plan mutation and incomplete days stop before any dispatch',async t=>{
 const {o}=await setup(t),fetcher=()=>assert.fail('must not send');
 await assert.rejects(collectNetworkUsage({...o,expectedApprovalHash:'0'.repeat(64),fetcher}));
 const changed=JSON.parse(o.planBytes);changed.limits.maxHTTP=6;const planBytes=Buffer.from(JSON.stringify(changed));await assert.rejects(collectNetworkUsage({...o,planBytes,expectedPlanHash:digest(planBytes),fetcher}));
 await assert.rejects(collectNetworkUsage({...o,now:()=> '2026-10-27T01:00:00.000Z',fetcher}));
});
test('all-empty successful responses remain evidence and cannot replace a stored data snapshot',async t=>{
 const {plan,o}=await setup(t),r=await collectNetworkUsage({...o,fetcher:async()=>new Response('[]')});assert.equal(r.state,'COMPLETE');assert(r.jobs.every(j=>j.state==='HTTP_200_EMPTY'));
 const dir=join(o.root,plan.slot),rb=await readFile(join(dir,'receipt.json'));await assert.rejects(projectUsageArchive(dir,{planFileHash:o.expectedPlanHash,receiptHash:digest(rb),approvalHash:o.expectedApprovalHash}));
});
test('display preserves Arkham identity, precision, original times and unsupported transactions',async()=>{
 const p=await networkUsageFixture(),view=networkUsageView(p),original=structuredClone(p),rows=overviewUsageRows(view,'usdc','2026-10-27');assert.equal(view.provider,'ARKHAM');assert(rows.every(r=>r.transactions===null));assert.equal(rows[0].providerTime,'2026-10-27T00:00:00Z');assert.equal(rows[0].usd,p.rows.at(-1).usd);assert.equal(overviewTransferGroups(view,'usdc','transfer_count').groups[0].rows[0].amount,'9007199254740993');assert.equal(overviewTransferGroups(view,'usdc','transfer_tx_count').groups.length,0);assert.deepEqual(p,original);
 for(const edit of [x=>x.rows.pop(),x=>x.rows[0].transactions='1',x=>x.rows[0].providerTime=null,x=>x.rows[0].queriedAt='2026-10-27T01:00:00.000Z',x=>x.rows[0].transfers=1,x=>x.rows[0].rpcUrl='secret',x=>x.provider='ALLIUM',x=>x.rows[0].day='2026-02-30']){const x=structuredClone(p);edit(x);assert.throws(()=>validateNetworkUsage(x));}
});
test('reader cache and HTTP API serve validated snapshots without collection or leaking failures',async()=>{
 const data=await networkUsageFixture(),bytes=Buffer.from(JSON.stringify(data));assert.deepEqual(reviewedNetworkUsageImport(bytes,digest(bytes)),data);assert.throws(()=>reviewedNetworkUsageImport(bytes,'0'.repeat(64)));
 const missing=structuredClone(data);missing.rows.forEach(r=>Object.assign(r,{state:'MISSING',providerTime:null,usd:null,transfers:null}));const mb=Buffer.from(JSON.stringify(missing));assert.throws(()=>reviewedNetworkUsageImport(mb,digest(mb)));
 let calls=0,clock=0,broken=false;const read=databaseNetworkUsageReader({now:()=>clock,connect:async()=>{calls++;return {end:async()=>{}};},read:async()=>{if(broken)throw Error('postgresql://secret');return data;}});
 await Promise.all([read(),read()]);assert.equal(calls,1);clock=299999;await read();assert.equal(calls,1);clock=300000;broken=true;await assert.rejects(read(),/NETWORK_USAGE_UNAVAILABLE/);broken=false;assert.deepEqual(await read(),data);
 const server=await startPreviewServer(0,{networkUsageReader:async()=>{if(broken)throw Error('postgresql://secret');return data;}}),base='http://127.0.0.1:'+server.address().port;
 try{const r=await fetch(base+'/network-usage-data.json');assert.equal(r.status,200);assert.deepEqual(await r.json(),data);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await fetch(base+'/network-usage-data.json',{method:'HEAD'})).status,200);assert.equal((await fetch(base+'/network-usage-data.json?file=private')).status,404);assert.equal((await fetch(base+'/network-usage-data.json',{method:'POST'})).status,405);broken=true;const e=await fetch(base+'/network-usage-data.json');assert.equal(e.status,503);assert.equal(await e.text(),'NETWORK_USAGE_UNAVAILABLE');}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
