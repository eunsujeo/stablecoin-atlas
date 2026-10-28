import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {assertAlliumFixtureTransport} from '../tools/retired-allium.mjs';
import {networkUsageInventory} from '../tools/network-usage-inventory.mjs';
import {alliumUsage,executeAlliumSurvey,executeAlliumManualSurvey,resumeAlliumManualSurvey} from '../tools/allium-executor.mjs';
import {executeLiveOnce} from '../tools/allium-live-once.mjs';
import {collectGeography} from '../tools/allium-geography.mjs';
import {collectGeographyDiagnosis} from '../tools/allium-geography-diagnosis.mjs';
import {collectCapabilityProbe} from '../tools/provider-capability-probe.mjs';
test('retired Allium entry points reject injected live transports before filesystem writes or dispatch',async()=>{
 let calls=0;const options={root:'/nonexistent-retired-allium-test',fetcher:async()=>{calls++;throw Error('SHOULD_NOT_SEND');}};
 for(const fn of [()=>alliumUsage(options),()=>executeAlliumSurvey({},options),()=>executeAlliumManualSurvey({},options),()=>resumeAlliumManualSurvey({},options),()=>executeLiveOnce({},options),()=>collectGeography(options.root,options),()=>collectGeographyDiagnosis(options.root,options),()=>collectCapabilityProbe(options.root,options)])await assert.rejects(fn,/ALLIUM_COLLECTION_RETIRED/);
 for(const fetcher of [globalThis.fetch,globalThis.fetch.bind(globalThis),(...args)=>globalThis.fetch(...args)])assert.throws(()=>assertAlliumFixtureTransport(fetcher),/ALLIUM_COLLECTION_RETIRED/);
 assert.equal(calls,0);
});
test('archived fixture sandbox denies even wrapped fetch at the Node network boundary',()=>{
 const source=`import assert from 'node:assert/strict';import{assertAlliumFixtureTransport}from'./tools/retired-allium.mjs';const wrapped=(...args)=>fetch(...args);assertAlliumFixtureTransport(wrapped);await assert.rejects(wrapped('http://127.0.0.1:65534'),e=>e.code==='ERR_ACCESS_DENIED'||e.cause?.code==='ERR_ACCESS_DENIED');`;
 const r=spawnSync(process.execPath,['--permission','--allow-fs-read=*','--input-type=module','-e',source],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
test('live npm aliases are removed and expanded scope covers registered pairs without synthetic observations',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
 for(const name of ['allium:execute','allium:live','allium:geography'])assert.equal(pkg.scripts[name],undefined);
 const p=await networkUsageInventory();assert.equal(p.rows.length,33);assert.equal(new Set(p.rows.map(r=>r.coinId+'/'+r.networkId)).size,33);assert.equal(new Set(p.rows.map(r=>r.coinId)).size,5);assert.equal(p.rows.filter(r=>r.state==='STORED_WINDOW_AVAILABLE').length,5);assert.equal(p.rows.filter(r=>r.state==='NOT_COLLECTED').length,28);
 assert.deepEqual(JSON.parse(await readFile(new URL('../data/network-usage-expansion-scope.json',import.meta.url))),p);
 assert.ok(p.rows.every(r=>!Object.hasOwn(r,'usd')&&!Object.hasOwn(r,'transfers')&&!Object.hasOwn(r,'queriedAt')));
});

test('historical CLI commands reject collection before opening credentials or approval files',async()=>{
 const {executionMain}=await import('../tools/allium-execute-cli.mjs');
 const {liveMain}=await import('../tools/allium-live-cli.mjs');
 const {geographyMain}=await import('../tools/allium-geography-cli.mjs');
 await assert.rejects(executionMain(['usage']),/ALLIUM_COLLECTION_RETIRED/);
 await assert.rejects(liveMain(['prepare','--day','2026-10-23','--approval','missing','--output','missing']),/ALLIUM_COLLECTION_RETIRED/);
 await assert.rejects(geographyMain(['collect']),/ALLIUM_COLLECTION_RETIRED/);
 for(const file of ['tools/provider-capability-probe.mjs','tools/balance-array-probe.mjs','tools/allium-geography-diagnosis.mjs']){
  const r=spawnSync(process.execPath,[file,'collect'],{encoding:'utf8'});assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/ALLIUM_COLLECTION_RETIRED/);
 }
});
