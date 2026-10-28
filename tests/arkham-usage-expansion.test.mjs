import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,realpath,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {collectUsageExpansion,expansionPlanHash} from '../tools/arkham-usage-expansion.mjs';
const raw=()=>'[{"time":"2026-10-27T00:00:00Z","count":9007199254740993,"usd":123456789012345678.000000000000000001}]';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function setup(t){
 const root=await realpath(await mkdtemp(join(tmpdir(),'atlas-usage-expansion-')));t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(join(root,'prior'),'immutable',{mode:0o600});
 const planBytes=await readFile(new URL('../data/arkham-network-usage-expansion-20261028-plan.json',import.meta.url)),approvalBytes=Buffer.from('FIXTURE ONLY discovery approval');let ms=0;
 return {plan:JSON.parse(planBytes),o:{root,planBytes,expectedPlanHash:expansionPlanHash,approvalBytes,expectedApprovalHash:hash(approvalBytes),key:'fixture-key',clock:()=>ms,sleep:async n=>{ms+=n;},now:()=> '2026-10-28T00:00:00.000Z'},advance:n=>ms+=n};
}
test('expansion sends only thirteen pinned GETs with bounded signals and spacing; records consumption and preserves originals',async t=>{
 const {plan,o}=await setup(t),calls=[];
 const r=await collectUsageExpansion({...o,fetcher:async(url,options)=>{calls.push({url,options,at:o.clock()});assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers['API-Key'],'fixture-key');assert(options.signal instanceof AbortSignal);return new Response(raw());}});
 assert.equal(r.state,'COMPLETE');assert.equal(r.attempts.length,13);assert.deepEqual(calls.map(c=>c.url),plan.jobs.map(j=>plan.origin+j.path+'?'+new URLSearchParams(j.query)));assert.deepEqual(calls.map(c=>c.at),Array.from({length:13},(_,i)=>i*1000));assert(r.previousPreserved);assert.equal(r.databaseWrites,0);assert.equal(await readFile(join(o.root,'prior'),'utf8'),'immutable');assert(!JSON.stringify(r).includes('fixture-key'));
 const dir=join(o.root,plan.slot);assert.equal(JSON.parse(await readFile(join(dir,'intent-0.json'))).method,'GET');assert.equal((await readFile(join(dir,'response-0.json'))).length,r.attempts[0].responseBytes);
 await assert.rejects(collectUsageExpansion({...o,fetcher:()=>assert.fail('no replay')}));
});
for(const kind of ['403','429','redirect','timeout','partial','oversize','invalid-json','invalid-utf8','duplicate','proxy'])test('expansion stops on '+kind+' without later requests or replay',async t=>{
 const {plan,o}=await setup(t);let calls=0,pulls=0;
 const r=await collectUsageExpansion({...o,fetcher:async()=>{calls++;
  if(kind==='redirect')throw Error('private transport details');
  if(kind==='timeout')throw new DOMException('private timeout','TimeoutError');
  if(kind==='partial')return new Response(new ReadableStream({pull(c){if(!pulls++)c.enqueue(Buffer.from('['));else c.error(Error('private stream failure'));}}));
  if(kind==='oversize')return new Response('x'.repeat(2097153));
  if(kind==='invalid-json')return new Response('<html>');
  if(kind==='invalid-utf8')return new Response(Buffer.from([0xff]));
  if(kind==='duplicate')return new Response('{"ethereum":1,"ethereum":2}');
  if(kind==='proxy')return new Response('denied',{status:451,headers:{'x-squid-error':'ERR_ACCESS_DENIED 0'}});
  return new Response('{}',{status:Number(kind)});
 }});
 assert.equal(calls,1);assert.equal(r.state,'STOPPED_UNKNOWN');assert(r.jobs.slice(1).every(j=>j.state==='NOT_TESTED'));assert(r.previousPreserved);assert(!JSON.stringify(r).includes('private'));
 if(kind==='oversize'){assert.equal(r.responseBytes,2097152);assert(r.attempts[0].truncated);}
 if(kind==='partial'){assert.equal(r.responseBytes,1);assert(r.attempts[0].partial);}
 if(kind==='proxy'){assert.equal(r.stopReason,'PROXY_ERROR');assert.equal(r.attempts[0].proxyError,'ERR_ACCESS_DENIED 0');}
 if(kind==='redirect'||kind==='timeout')await assert.rejects(readFile(join(o.root,plan.slot,'response-0.json')),{code:'ENOENT'});
 else assert.equal((await readFile(join(o.root,plan.slot,'response-0.json'))).length,r.responseBytes);
 if(kind==='timeout')assert.equal(r.attempts[0].transportClass,'TimeoutError');
 await assert.rejects(collectUsageExpansion({...o,fetcher:()=>assert.fail('no replay')}));
});
test('plan/approval drift, common lock and deadline reject before dispatch',async t=>{
 const {o,advance}=await setup(t),fetcher=()=>assert.fail('no dispatch');
 const p=JSON.parse(o.planBytes);p.jobs[0].path='/other';const planBytes=Buffer.from(JSON.stringify(p));
 await assert.rejects(collectUsageExpansion({...o,planBytes,expectedPlanHash:hash(planBytes),fetcher}));
 await assert.rejects(collectUsageExpansion({...o,expectedApprovalHash:'0'.repeat(64),fetcher}));
 await mkdir(join(o.root,'reservation-lock'),{mode:0o700});await assert.rejects(collectUsageExpansion({...o,fetcher}));await rm(join(o.root,'reservation-lock'),{recursive:true});
 let calls=0;const r=await collectUsageExpansion({...o,fetcher:async()=>{calls++;advance(300000);return new Response(raw());}});assert.equal(calls,1);assert.equal(r.stopReason,'LEASE_EXPIRED');assert(r.previousPreserved);
});
test('failed third request preserves two completed bodies and leaves later jobs untransmitted',async t=>{
 const {o}=await setup(t);let calls=0;const r=await collectUsageExpansion({...o,fetcher:async()=>new Response(++calls===3?'{}':raw(),{status:calls===3?429:200})});
 assert.equal(calls,3);assert.equal(r.stopReason,'HTTP_429');assert(r.jobs.slice(0,2).every(j=>j.state==='HTTP_200_JSON_OBSERVED'));assert(r.jobs.slice(3).every(j=>j.state==='NOT_TESTED'));assert(r.previousPreserved);
});
test('empty and exact-limit responses preserve missingness and integer/decimal precision',async t=>{
 const {o}=await setup(t);let calls=0;const exact=raw().padEnd(2097152,' ');const r=await collectUsageExpansion({...o,fetcher:async()=>new Response(++calls===1?exact:'[]')});
 assert.equal(r.state,'COMPLETE');assert.equal(r.attempts[0].responseBytes,2097152);assert.equal(r.jobs[0].rows,1);assert(r.jobs.slice(1).every(j=>j.state==='HTTP_200_EMPTY'));
 const {histogramPoints}=await import('../tools/network-usage-source.mjs');const points=histogramPoints(Buffer.from(raw()),{from:'2026-10-21',untilExclusive:'2026-10-28'});assert.equal(points[0].transfers,'9007199254740993');assert.equal(points[0].usd,'123456789012345678.000000000000000001');
});
