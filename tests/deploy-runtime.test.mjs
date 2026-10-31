import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeSource,runtimePackageDirectories,runtimeSchemaFiles} from '../tools/deploy/runtime-files.mjs';
import {packEntries,tarEntries,releaseManifest} from '../tools/deploy/archive.mjs';
import {policyFiles,payloadPolicies} from '../tools/deploy/policy.mjs';
import {operationalEntrypoints,smokeRuntime} from '../tools/deploy/runtime-smoke.mjs';
import {timedDeployment} from '../tools/deploy/operation-timing.mjs';
const version='1.0.0';
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'atlas-runtime-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
async function packageAt(root,path,name,extra={}){await mkdir(join(root,path),{recursive:true});await writeFile(join(root,path,'package.json'),JSON.stringify({name,version,...extra}));}
async function lock(root,entries){await writeFile(join(root,'package-lock.json'),JSON.stringify({lockfileVersion:3,packages:Object.fromEntries(entries.map(path=>[path,{version}]))}));}

test('runtime source policy preserves every operational/policy asset but excludes development and private paths',()=>{
 for(const name of [...runtimeSchemaFiles,...Object.values(policyFiles).flat(),...operationalEntrypoints.map(p=>'tools/'+p+'.mjs'),'.github/workflows/production.yml','deploy/atlas-release','tools/market-db/schema.sql','data/asset-registry.json','web/index.html','web/styles.css','docs/ui/mock-dashboard-data.json','package-lock.json'])assert(runtimeSource(name),name);
 assert.equal(runtimeSchemaFiles.length,21);assert(!runtimeSource('db/private.env'));assert(!runtimeSource('db/run.mjs'));
 for(const name of ['tests/production.test.mjs','fixtures/Token.sol','src/cli.ts','docs/research/report.md','docs/ui/mock.png','AGENTS.md','tools/research/probe.mjs','tools/intelligent-router/policy.json','tools/production-browser-check.mjs','web/model.test.mjs','.env.local','reports/index.json','.state/private.json'])assert(!runtimeSource(name),name);
});

test('runtime package graph keeps nested dependencies, installed optional/native peers and their complete assets',async t=>{
 const root=await fixture(t),paths=['node_modules/pg','node_modules/pg/node_modules/shared','node_modules/pg-native','node_modules/shared'];
 await packageAt(root,paths[0],'pg',{dependencies:{shared:'1'},peerDependencies:{'pg-native':'1'},peerDependenciesMeta:{'pg-native':{optional:true}},optionalDependencies:{absent:'1'}});
 await packageAt(root,paths[1],'shared');await packageAt(root,paths[2],'pg-native',{dependencies:{shared:'1'}});await packageAt(root,paths[3],'shared');
 await mkdir(join(root,paths[2],'build/Release'),{recursive:true});await writeFile(join(root,paths[2],'build/Release/binding.node'),Buffer.from('ARM64_NATIVE_FIXTURE'));
 await packageAt(root,'node_modules/solc','solc');await packageAt(root,'node_modules/viem','viem');await lock(root,paths);
 assert.deepEqual(await runtimePackageDirectories(root),paths.sort());assert.equal((await readFile(join(root,paths.find(p=>p==='node_modules/pg-native'),'build/Release/binding.node'))).toString(),'ARM64_NATIVE_FIXTURE');
});

test('missing, wrong-version, unpinned and symlinked production dependencies fail closed',async t=>{
 const root=await fixture(t);await packageAt(root,'node_modules/pg','pg',{dependencies:{missing:'1'}});await lock(root,['node_modules/pg']);await assert.rejects(runtimePackageDirectories(root),/MISSING/);
 await packageAt(root,'node_modules/pg','pg',{version:'2.0.0'});await assert.rejects(runtimePackageDirectories(root),/LOCK/);
 await packageAt(root,'node_modules/pg','pg');await lock(root,[]);await assert.rejects(runtimePackageDirectories(root),/LOCK/);
 await lock(root,['node_modules/pg']);await rm(join(root,'node_modules/pg'),{recursive:true});await packageAt(root,'elsewhere','pg');await symlink(join(root,'elsewhere'),join(root,'node_modules/pg'));await assert.rejects(runtimePackageDirectories(root),/UNSAFE/);
});

test('scoped dependency symlinks and dev-only lock entries are never promoted into runtime',async t=>{
 const root=await fixture(t);await packageAt(root,'node_modules/pg','pg',{dependencies:{'@scope/native':'1'}});await packageAt(root,'outside/native','@scope/native');await symlink(join(root,'outside'),join(root,'node_modules/@scope'));await lock(root,['node_modules/pg','node_modules/@scope/native']);await assert.rejects(runtimePackageDirectories(root),/UNSAFE/);
 await rm(join(root,'node_modules/@scope'));await packageAt(root,'node_modules/@scope/native','@scope/native');await writeFile(join(root,'package-lock.json'),JSON.stringify({lockfileVersion:3,packages:{'node_modules/pg':{version},'node_modules/@scope/native':{version,dev:true}}}));await assert.rejects(runtimePackageDirectories(root),/LOCK/);
});

test('native runtime files bind the Node ABI and package trimming never changes collector/usage policy hashes',()=>{
 const commit='a'.repeat(40),entries=[{name:'REVISION',bytes:Buffer.from(commit+'\n')},...['package.json','package-lock.json','tools/production-web.mjs','node_modules/pg/package.json','node_modules/pg-native/build/Release/binding.node',...new Set(Object.values(policyFiles).flat())].map(name=>({name,bytes:Buffer.from('fixture')}))];
 const payload=packEntries(entries),manifest=releaseManifest(payload,{commit,component:'web',runId:1,attempt:1,policies:payloadPolicies(entries)});assert.equal(manifest.nodeABI,process.versions.modules);assert(tarEntries(payload).some(e=>e.name.endsWith('/binding.node')));
 assert.deepEqual(payloadPolicies(entries),payloadPolicies([...entries,{name:'docs/unnecessary.md',bytes:Buffer.from('excluded')}].filter(e=>runtimeSource(e.name)||e.name==='REVISION'||e.name.startsWith('node_modules/'))));
});

test('offline runtime smoke rejects missing entrypoints and subprocesses cannot make external requests',async t=>{
 const root=await fixture(t),commit='a'.repeat(40),entries=[{name:'REVISION',bytes:Buffer.from(commit+'\n')},...[...runtimeSchemaFiles,'package-lock.json','node_modules/pg/package.json',...new Set(Object.values(policyFiles).flat())].map(name=>({name,bytes:Buffer.from('fixture')})),{name:'package.json',bytes:Buffer.from('{"type":"module"}')},...operationalEntrypoints.map(name=>({name:'tools/'+name+'.mjs',bytes:Buffer.from('// import-only fixture')}))];
 async function output(content){const selected=[...new Map(content.map(e=>[e.name,e])).values()],payload=packEntries(selected),manifest=releaseManifest(payload,{commit,component:'web',runId:1,attempt:1,policies:payloadPolicies(selected)});await writeFile(join(root,'release.tar'),payload);await writeFile(join(root,'release.json'),JSON.stringify(manifest));}
 await output(entries);assert.equal((await smokeRuntime(root)).state,'RUNTIME_IMPORTS_READY');
 for(const name of runtimeSchemaFiles){await output(entries.filter(e=>e.name!==name));await assert.rejects(smokeRuntime(root),/RUNTIME_SCHEMA_ASSET_MISSING/);}
 await output(entries.filter(e=>e.name!=='tools/collector-worker.mjs'));await assert.rejects(smokeRuntime(root));
 await output(entries.map(e=>e.name==='tools/collector-worker.mjs'?{...e,bytes:Buffer.from("await fetch('https://example.invalid/');")}:e));await assert.rejects(smokeRuntime(root));
});

test('overall deployment timing preserves results and failures without logging arguments or error text',async()=>{
 const events=[],result={state:'READY'},options={onDiagnostic:e=>events.push(e)};
 assert.equal(await timedDeployment('bootstrap',async()=>{await new Promise(r=>setTimeout(r,10));return result;},options),result);assert.deepEqual(events.map(e=>e.phase),['started','complete']);assert(events.at(-1).totalElapsedMs>=5);
 const reason=Error('private-url-and-key');await assert.rejects(timedDeployment('apply',async()=>{throw reason;},options),e=>e===reason);assert.equal(events.at(-1).phase,'failed');assert(!JSON.stringify(events).includes(reason.message));assert.equal(await timedDeployment('apply',async()=>result,{onDiagnostic:()=>{throw Error('log');}}),result);await assert.rejects(timedDeployment('unknown',async()=>{}),/OPERATION/);
});
