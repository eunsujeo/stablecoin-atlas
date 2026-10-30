import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,symlink,rm,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {deflateRawSync} from 'node:zlib';
import {packEntries,tarEntries,extractRelease,artifactFiles,validateBundle,releaseManifest} from '../tools/deploy/archive.mjs';
import {hash,atomicJSON,json} from '../tools/deploy/files.mjs';
import {githubClient,boundedResponse} from '../tools/deploy/github.mjs';
import {reconcile} from '../tools/deploy/controller.mjs';
import {performManual} from '../tools/deploy/manual.mjs';
import {point,pointer} from '../tools/release-switch.mjs';
import {validateConfig} from '../tools/deploy/config.mjs';
import {provision} from '../tools/deploy/vault.mjs';
import {unitPlan} from '../tools/deploy/bootstrap.mjs';
import {policyFiles,payloadPolicies} from '../tools/deploy/policy.mjs';
const A='a'.repeat(40),B='b'.repeat(40),H='c'.repeat(64);
async function temp(t){const p=await mkdtemp(join(tmpdir(),'atlas-deploy-'));t.after(()=>rm(p,{recursive:true,force:true}));return p;}
const entry=(name,text)=>({name,bytes:Buffer.from(text)});
function zip(files){const locals=[],centrals=[];let offset=0;for(const[name,bytes]of Object.entries(files)){const compressed=deflateRawSync(bytes),n=Buffer.from(name),l=Buffer.alloc(30),c=Buffer.alloc(46);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(8,8);l.writeUInt32LE(compressed.length,18);l.writeUInt32LE(bytes.length,22);l.writeUInt16LE(n.length,26);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(8,10);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);locals.push(l,n,compressed);centrals.push(c,n);offset+=l.length+n.length+compressed.length;}const directory=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,directory,end]);}
function payload(commit=B){return packEntries([entry('REVISION',commit+'\n'),entry('package.json','{}'),entry('package-lock.json','{}'),entry('tools/production-web.mjs','// inert fixture'),entry('node_modules/pg/package.json','{}'),...[...new Set(Object.values(policyFiles).flat())].map(name=>entry(name,'policy fixture'))]);}
function bundle(c={sha:B,component:'web',id:10,attempt:1}){const bytes=payload(c.sha),manifest=releaseManifest(bytes,{commit:c.sha,component:c.component,runId:c.id,attempt:c.attempt,policies:payloadPolicies(tarEntries(bytes))});return {payload:bytes,manifest};}
async function harness(t,component='web'){
 const root=await temp(t),state=join(root,'state');await mkdir(join(root,'releases',A),{recursive:true});await writeFile(join(root,'releases',A,'REVISION'),A);for(const n of ['current','collector-current','usage-current'])await point(root,n,A);
 const config={enabled:true,components:{web:{enabled:true},collector:{enabled:true,policyHash:payloadPolicies(tarEntries(payload())).collector},usage:{enabled:true,policyHash:payloadPolicies(tarEntries(payload())).usage}}},c={sha:B,component,id:10,attempt:1,url:'https://github.com/eunsujeo/stablecoin-atlas/actions/runs/10'},calls={bundle:0,status:[],restart:0,hold:0,resume:0,requests:0},links={web:'current',collector:'collector-current',usage:'usage-current'};
 const gh={candidate:async()=>c,bundle:async()=>{calls.bundle++;return bundle(c);},status:async(_,r)=>calls.status.push(r)};
 let badHealth=false;
 const ops={current:c=>pointer(root,links[c]),preflight:async()=>{},restart:async()=>{calls.restart++;},stop:async()=>{},health:async(_,s)=>{if(badHealth&&s===B)throw Error('HEALTH_API');},snapshot:async()=>({timer:{ActiveState:'active'}}),quiesce:async()=>{calls.quiesced=true;},hold:async()=>{calls.hold++;return {release:async()=>{calls.released=true;}};},setPointer:(c,s)=>point(root,links[c],s),restore:(c,s)=>point(root,links[c],s),resume:async()=>{calls.resume++;},leaveStopped:async()=>{calls.stopped=true;},service:async()=>calls.stopped?'inactive':'active'};
 return {root,state,config,c,gh,ops,calls,failHealth:()=>badHealth=true,run:()=>reconcile({root,state,config,github:gh,ops})};
}
test('CI regular archive is bounded, lossless and excludes traversal/link/special/duplicate entries',async t=>{
 const root=await temp(t),bytes=packEntries([entry('web/a.js','const exact="9007199254740993"'),entry('nested/b','value')]);await extractRelease(bytes,root);assert.equal(await readFile(join(root,'nested/b'),'utf8'),'value');assert.equal((await lstat(join(root,'nested/b'))).mode&0o777,0o644);
 for(const name of ['../escape','/etc/passwd','a/../b','.state/key','.env.local','node_modules/a/private.key'])assert.throws(()=>packEntries([entry(name,'x')]));
 assert.throws(()=>tarEntries(packEntries([entry('same','a'),entry('same','b')])));
 for(const type of [49,50,51,53,120]){const b=Buffer.from(bytes);b[156]=type;b.fill(32,148,156);b.write([...b.subarray(0,512)].reduce((a,v)=>a+v,0).toString(8).padStart(7,'0')+'\0',148);assert.throws(()=>tarEntries(b));}
 assert.throws(()=>tarEntries(bytes.subarray(0,bytes.length-513)));assert.throws(()=>tarEntries(Buffer.concat([bytes,Buffer.from('bad')])));
});
test('Actions ZIP is read by fixed filenames without path extraction and binds SHA/run attempt/platform/payload',()=>{
 const c={sha:B,component:'web',id:10,attempt:1},b=bundle(c),files={'release.json':Buffer.from(JSON.stringify(b.manifest)),'release.tar':b.payload},output=artifactFiles(zip(files));assert.equal(validateBundle(output,c).payloadHash,hash(b.payload));
 for(const change of [{sha:A},{attempt:2},{component:'usage'},{id:11}])assert.throws(()=>validateBundle(output,{...c,...change}));
 assert.throws(()=>artifactFiles(zip({...files,'../escape':Buffer.from('x')})));assert.throws(()=>artifactFiles(Buffer.from('bad')));output['release.tar'][0]^=1;assert.throws(()=>validateBundle(output,c));
});
test('web success stages immutable bytes, switches only web and reuses durable same-run result without new dispatch',async t=>{
 const h=await harness(t);const r=await h.run();assert.equal(r.state,'SUCCESS');assert.equal(await pointer(h.root,'current'),B);assert.equal(await pointer(h.root,'collector-current'),A);assert.equal(await pointer(h.root,'usage-current'),A);assert.equal(await pointer(h.root,'previous'),A);assert.equal(h.calls.resume,0);assert.equal(h.calls.requests,0);await h.run();assert.equal(h.calls.bundle,1);assert.equal(h.calls.restart,1);
});
test('web failed health restores previous version and tests recovery health; archive and source remain immutable',async t=>{
 const h=await harness(t);h.failHealth();const r=await h.run();assert.equal(r.state,'ROLLED_BACK');assert.equal(r.reason,'DEPLOY_FAILED_ROLLED_BACK');assert.equal(await pointer(h.root,'current'),A);assert.equal(r.lastSuccess,A);assert.equal(h.calls.restart,2);assert.equal((await json(join(h.state,'versions.json'))).web.current,A);
});
test('failed rollback keeps nonterminal recovery, blocks manual entry and retries old health on the next poll',async t=>{
 const h=await harness(t);h.ops.health=async()=>{throw Error('HEALTH_API');};const r=await h.run();assert.equal(r.state,'RECOVERY_BLOCKED');assert.equal(r.reason,'DEPLOY_ROLLBACK_UNHEALTHY');assert.equal(await pointer(h.root,'current'),A);const tx=await json(join(h.state,'transaction.json'));assert.equal(tx.terminal,false);assert.equal(tx.phase,'RECOVERY_BLOCKED');await assert.rejects(performManual({command:'stage',candidate:h.c,root:h.root,state:h.state,ops:h.ops}),/RECOVERY_REQUIRED/);assert.equal((await h.run()).state,'RECOVERY_BLOCKED');h.ops.health=async()=>{};assert.equal((await h.run()).state,'CRASH_RECOVERED');assert.equal((await json(join(h.state,'transaction.json'))).terminal,true);
});
test('preflight failure leaves pointers, services, collector locks and provider budgets unchanged',async t=>{
 const h=await harness(t);h.ops.preflight=async()=>{throw Error('PREFLIGHT_FAILED');};const r=await h.run();assert.equal(r.state,'FAILED');assert.equal(h.calls.restart,0);assert.equal(h.calls.hold,0);assert.equal(await pointer(h.root,'current'),A);
});
test('GitHub acknowledgement failure preserves successful deployment and next poll repairs reporting only',async t=>{
 const h=await harness(t);h.gh.status=async()=>{throw Error('HTTP_FAILED');};const r=await h.run();assert.equal(r.state,'SUCCESS');assert.equal(r.notification,'GITHUB_REPORT_PENDING');assert.equal((await json(join(h.state,'versions.json'))).web.lastSuccess,B);h.gh.status=async(_,r)=>h.calls.status.push(r);await h.run();assert.equal(h.calls.restart,1);assert.equal(h.calls.bundle,1);
});
for(const component of ['collector','usage'])test(component+' requires policy pin and quiescent DB hold; no collection or shared pointer switch',async t=>{
 const h=await harness(t,component);const order=[];for(const key of ['quiesce','hold','setPointer','resume']){const fn=h.ops[key];h.ops[key]=async(...args)=>{order.push(key);return fn(...args);};}
 const r=await h.run();assert.equal(r.state,'SUCCESS');assert.deepEqual(order,['quiesce','hold','setPointer','resume']);assert.equal(await pointer(h.root,'current'),A);assert.equal(await pointer(h.root,component==='collector'?'usage-current':'collector-current'),A);assert.equal(h.calls.requests,0);assert.equal(h.calls.restart,0);assert.equal(h.calls.released,true);
});
test('pending/reserved/sender lock cannot be bypassed by deployment or retry; writers remain stopped on uncertain recovery',async t=>{
 const h=await harness(t,'usage');h.ops.hold=async()=>{throw Error('PENDING_RESERVATIONS');};const r=await h.run();assert.equal(r.state,'RECOVERY_BLOCKED');assert.equal(h.calls.resume,0);assert.equal(h.calls.stopped,true);assert.equal(await pointer(h.root,'usage-current'),A);await h.run();assert.equal(h.calls.bundle,1);assert.equal(h.calls.requests,0);
});
test('collector policy drift and disabled usage cannot be activated by a main workflow artifact',async t=>{
 const h=await harness(t,'collector');h.config.components.collector.policyHash='f'.repeat(64);assert.equal((await h.run()).reason,'COLLECTION_POLICY_CHANGED');assert.equal(h.calls.quiesced,undefined);
 const j=await harness(t,'usage');j.config.components.usage.enabled=false;assert.equal((await j.run()).reason,'COMPONENT_DISABLED');assert.equal(j.calls.bundle,0);
});
test('a real child crash after symlink switch recovers the old SHA without re-fetching or resuming a writer',async t=>{
 const h=await harness(t);const code=`import {reconcile} from ${JSON.stringify(new URL('../tools/deploy/controller.mjs',import.meta.url).href)};import {pointer,point} from ${JSON.stringify(new URL('../tools/release-switch.mjs',import.meta.url).href)};import {packEntries,releaseManifest} from ${JSON.stringify(new URL('../tools/deploy/archive.mjs',import.meta.url).href)};const root=process.argv[1],state=process.argv[2],sha='${B}',p=packEntries([{name:'REVISION',bytes:Buffer.from(sha)}]),c=${JSON.stringify(h.c)};await reconcile({root,state,config:${JSON.stringify(h.config)},github:{candidate:async()=>c,bundle:async()=>({payload:p,manifest:releaseManifest(p,{commit:sha,component:'web',runId:10,attempt:1,policies:{}})}),status:async()=>{}},ops:{current:()=>pointer(root,'current'),preflight:async()=>{},service:async()=>'active',restart:async()=>process.exit(42),stop:async()=>{},health:async()=>{}}});`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code,h.root,h.state],{encoding:'utf8',timeout:10000});assert.equal(child.status,42,child.stderr);assert.equal(await pointer(h.root,'current'),B);assert.equal((await json(join(h.state,'transaction.json'))).terminal,false);const r=await h.run();assert.equal(r.state,'CRASH_RECOVERED');assert.equal(await pointer(h.root,'current'),A);assert.equal(h.calls.bundle,0);
});
test('out-of-order successful runs cannot move a component backwards',async t=>{
 const h=await harness(t);await h.run();h.c.id=9;h.c.sha=A;assert.equal((await h.run()).state,'SUPERSEDED');assert.equal(await pointer(h.root,'current'),B);assert.equal(h.calls.bundle,1);
});
function fakeGitHub(options={}){
 const c={sha:B,component:'web',id:10,attempt:1},b=bundle(c),bytes=zip({'release.json':Buffer.from(JSON.stringify(b.manifest)),'release.tar':b.payload}),requests=[];
 const cfg={repositoryId:8,workflowId:7,workflowBlob:A},run={head_sha:B,head_branch:'main',status:'completed',conclusion:'success',workflow_id:7,repository:{id:8},head_repository:{id:8},event:'push',id:10,run_attempt:1,display_title:'web / '+B,...options.run};
 const fetcher=async(url,init={})=>{requests.push({url:String(url),init});if(String(url).includes('blob.core.windows.net'))return options.download?options.download(bytes,init):new Response(options.badPayload?Buffer.from('bad'):bytes);
  let value;const path=new URL(url).pathname;if(path.endsWith('/branches/main'))value={commit:{sha:B}};else if(path.endsWith('/stablecoin-atlas'))value={id:8,full_name:'eunsujeo/stablecoin-atlas'};else if(path.endsWith('/runs'))value={workflow_runs:options.runs??[run]};else if(path.endsWith('/production.yml'))value={sha:options.badWorkflow?B:A};else if(path.endsWith('/artifacts')){const selected=(options.runs??[run]).find(r=>path.includes('/runs/'+r.id+'/'))??run,component=selected.display_title.split(' / ')[0];value={artifacts:[{name:`atlas-${component}-${B}-${selected.id}-${selected.run_attempt}`,id:6,size_in_bytes:bytes.length,digest:'sha256:'+hash(bytes),workflow_run:{id:selected.id,head_sha:B},expired:false,...options.artifact}]};}else if(path.endsWith('/zip'))return new Response(null,{status:302,headers:{Location:options.location??'https://artifacts.blob.core.windows.net/a?sig=private'}});else if(path.includes('/statuses/'))value={id:1};else throw Error('UNEXPECTED_PATH');return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});};
 return {client:githubClient({repository:'eunsujeo/stablecoin-atlas',token:'private-test-token',fetcher,onDiagnostic:options.onDiagnostic??(()=>{})}),cfg,requests,run};
}
test('root GitHub adapter independently binds repository, protected main, workflow blob, run attempt, artifact and digest',async()=>{
 const f=fakeGitHub(),c=await f.client.candidate(f.cfg);assert.equal(c.sha,B);assert.equal((await f.client.bundle(c)).manifest.commit,B);const last=f.requests.at(-1);assert.equal(last.init.headers,undefined);assert(!JSON.stringify(c).includes('private-test-token'));
 for(const run of [{head_sha:A},{conclusion:'failure'},{workflow_id:9},{repository:{id:9}},{head_repository:{id:9}},{event:'pull_request'}]){const bad=fakeGitHub({run});assert.equal(await bad.client.candidate(bad.cfg),null);}
 for(const options of [{badWorkflow:true},{artifact:{digest:null}},{artifact:{expired:true}},{artifact:{name:'atlas-web-old'}}]){const bad=fakeGitHub(options);await assert.rejects(bad.client.candidate(bad.cfg));}
});
test('artifact redirects never forward credentials, arbitrary hosts and changed bytes fail closed',async()=>{
 for(const options of [{badPayload:true},{location:'http://artifacts.blob.core.windows.net/a'},{location:'https://attacker.invalid/a'}]){const f=fakeGitHub(options),c=await f.client.candidate(f.cfg);await assert.rejects(f.client.bundle(c));}
});
test('artifact headers are distinct from completed body timing and the 180 second signal covers EOF',async t=>{
 const timeout=AbortSignal.timeout.bind(AbortSignal),durations=[],events=[];let finish,headers,expectedBytes;
 const receivedHeaders=new Promise(r=>{headers=r;});
 t.mock.method(AbortSignal,'timeout',ms=>{durations.push(ms);return timeout(ms);});
 const f=fakeGitHub({onDiagnostic:e=>{events.push(e);if(e.phase==='headers')headers();},download:bytes=>{expectedBytes=bytes.length;return new Response(new ReadableStream({start(controller){controller.enqueue(bytes);finish=()=>controller.close();}}));}});
 const c={sha:B,component:'web',id:10,attempt:1,artifactId:6};
 const valid=fakeGitHub(),candidate=await valid.client.candidate(valid.cfg);Object.assign(c,candidate);
 const downloading=f.client.bundle(c);await receivedHeaders;await new Promise(r=>setTimeout(r,25));
 assert.deepEqual(events.map(e=>e.phase),['started','headers']);finish();assert.equal((await downloading).manifest.commit,B);
 assert(durations.includes(180000));assert(durations.includes(20000));assert(durations.every(ms=>[20000,180000].includes(ms)));assert.deepEqual(events.map(e=>e.phase),['started','headers','body_complete']);
 const done=events.at(-1);assert.equal(done.receivedBytes,expectedBytes);assert.equal(done.status,200);assert(done.elapsedMs>=events[1].elapsedMs+20);assert.equal(done.timeoutMs,180000);assert.equal(done.limitBytes,96*1024*1024);
 assert.equal(f.requests.length,2);assert.equal(f.requests[1].init.redirect,'error');assert.equal(f.requests[1].init.headers,undefined);
 for(const e of events)assert.deepEqual(Object.keys(e).sort(),['elapsedMs','event','limitBytes','phase','receivedBytes','status','timeoutMs'].sort());
 assert(!/private|sig=|https:|Authorization/.test(JSON.stringify(events)));
});
test('artifact timeout interrupts a stalled HTTP200 read even when underlying cancellation never settles',async t=>{
 const timeout=AbortSignal.timeout.bind(AbortSignal),controller=new AbortController(),events=[];let cancelled=0,response,timer;
 const reason=new DOMException('signed-url-and-token-must-stay-private','TimeoutError');
 t.after(()=>clearTimeout(timer));t.mock.method(AbortSignal,'timeout',ms=>ms===180000?controller.signal:timeout(ms));
 const f=fakeGitHub({onDiagnostic:e=>events.push(e),download:()=>{response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.alloc(3));},cancel(){cancelled++;return new Promise(()=>{});}}));timer=setTimeout(()=>controller.abort(reason),20);return response;}});
 await assert.rejects(f.client.bundle({artifactId:6}),e=>e===reason);assert.equal(cancelled,1);assert.equal(response.body.locked,false);assert.equal(f.requests.length,2);
 assert.deepEqual(events.map(e=>e.phase),['started','headers','failed']);assert.equal(events.at(-1).reason,'TIMEOUT');assert.equal(events.at(-1).receivedBytes,3);assert.equal(events.at(-1).status,200);assert(!JSON.stringify(events).includes(reason.message));
});
test('mid-body abort preserves its reason, cancels once and never validates or retries partial bytes',async t=>{
 const timeout=AbortSignal.timeout.bind(AbortSignal),controller=new AbortController(),events=[];let cancelled=0,timer;
 const reason=Error('https://private.invalid/?sig=SECRET');t.after(()=>clearTimeout(timer));t.mock.method(AbortSignal,'timeout',ms=>ms===180000?controller.signal:timeout(ms));
 const f=fakeGitHub({onDiagnostic:e=>events.push(e),download:bytes=>new Response(new ReadableStream({start(c){c.enqueue(bytes.subarray(0,10));timer=setTimeout(()=>controller.abort(reason),10);},cancel(){cancelled++;}}))});
 await assert.rejects(f.client.bundle({artifactId:6}),e=>e===reason);assert.equal(cancelled,1);assert.equal(f.requests.length,2);assert.equal(events.at(-1).reason,'ABORTED');assert.equal(events.at(-1).receivedBytes,10);assert(!events.some(e=>e.phase==='body_complete'));assert(!/SECRET|private.invalid/.test(JSON.stringify(events)));
 const before=new AbortController();before.abort(reason);await assert.rejects(boundedResponse(new Response('partial'),{signal:before.signal}),e=>e===reason);
 const atEOF=new AbortController();await assert.rejects(boundedResponse(new Response(new ReadableStream({pull(c){atEOF.abort(reason);c.close();}})),{signal:atEOF.signal}),e=>e===reason);
});
test('streamed 96MiB body is accepted exactly while one extra byte cancels without trusting Content-Length',async()=>{
 const limit=96*1024*1024,chunk=Buffer.alloc(1024*1024,7);let progress=0;
 const body=new Response(new ReadableStream({pull(c){if(progress++<96)c.enqueue(chunk);else c.close();}}));
 const bytes=await boundedResponse(body,{limit});assert.equal(bytes.length,limit);assert.equal(bytes[0],7);assert.equal(bytes.at(-1),7);
 let cancelled=0,pulls=0;const events=[];
 const f=fakeGitHub({onDiagnostic:e=>events.push(e),download:()=>new Response(new ReadableStream({pull(c){if(pulls++<96)c.enqueue(chunk);else c.enqueue(Buffer.alloc(1));},cancel(){cancelled++;}}),{headers:{'Content-Length':'1'}})});
 await assert.rejects(f.client.bundle({artifactId:6}),/HTTP_LIMIT/);assert.equal(cancelled,1);assert.equal(f.requests.length,2);assert.equal(events.at(-1).receivedBytes,limit+1);assert.equal(events.at(-1).reason,'HTTP_LIMIT');assert(!events.some(e=>e.phase==='body_complete'));
});
test('diagnostic failures cannot bypass SHA256 validation and download errors never expose raw messages',async()=>{
 const invalid=fakeGitHub({badPayload:true,onDiagnostic:()=>{throw Error('logger');}});const c=await invalid.client.candidate(invalid.cfg);await assert.rejects(invalid.client.bundle(c),/ARTIFACT_HASH_MISMATCH/);
 const events=[],reason=Error('https://signed.invalid/?sig=SECRET');const f=fakeGitHub({onDiagnostic:e=>events.push(e),download:()=>{throw reason;}});
 await assert.rejects(f.client.bundle({artifactId:6}),e=>e===reason);assert.equal(f.requests.length,2);assert.equal(events.at(-1).reason,'DOWNLOAD_FAILED');assert.equal(events.at(-1).status,null);assert(!/SECRET|signed.invalid/.test(JSON.stringify(events)));
});
test('rate limit is a single observation, oversized/invalid UTF8 API responses fail without retries',async()=>{
 let calls=0;const client=githubClient({repository:'eunsujeo/stablecoin-atlas',token:'test',fetcher:async()=>{calls++;return new Response(null,{status:429,headers:{'Retry-After':'3600'}});}});await assert.rejects(client.candidate({}),/RATE_LIMITED/);assert.equal(calls,1);
 await assert.rejects(boundedResponse(new Response(Buffer.alloc(12)),{limit:10}),/HTTP_LIMIT/);
});
test('vault validates entire encrypted set before provisioning and preserves matching existing secrets',async t=>{
 const root=await temp(t),sealed=join(root,'sealed');await mkdir(sealed);const bytes=Buffer.from('PRIVATE_DB_SENTINEL'),cipher=Buffer.from('encrypted-fixture');await writeFile(join(sealed,'reader.cred'),cipher);const manifest={schemaVersion:1,files:{reader:{sha256:hash(bytes),cipherHash:hash(cipher),owner:'root',mode:0o600}}},target=join(root,'reader.env'),options={manifest,sealed,uidFor:async()=>process.getuid(),decrypt:async()=>bytes,targetFor:()=>target,verifySource:false};
 assert.equal((await provision(options)).files[0].state,'PROVISIONED');assert.equal((await provision(options)).files[0].state,'PRESERVED');await writeFile(target,'OTHER');await assert.rejects(provision(options),/CONFLICT/);assert.equal(await readFile(target,'utf8'),'OTHER');await rm(target);await assert.rejects(provision({...options,decrypt:async()=>Buffer.from('wrong')}),/PLAINTEXT_HASH/);await assert.rejects(lstat(target));
});
test('unit planning cannot overwrite custom service units; no bootstrap operation starts production services',async()=>{
 const read=async p=>Buffer.from(p.includes('deploy/')?'template':'existing'),stat=async()=>{const e=Error();e.code='ENOENT';throw e;};const plan=await unitPlan({source:'/fixture',config:{components:{collector:{enabled:false},usage:{enabled:false}}},read,stat});assert(plan.some(p=>p.path.endsWith('atlas-deploy-agent.timer')));assert(plan.some(p=>p.path.includes('atlas-collector.service.d/')));assert(plan.some(p=>p.path==='/etc/systemd/system/atlas-web.service'));
 await assert.rejects(unitPlan({source:'/fixture',config:{components:{collector:{},usage:{}}},read,stat:async()=>({isFile:()=>true,isSymbolicLink:()=>false})}),/CONFLICT/);
});
test('root config rejects placeholders, unknown secret destinations and broad activation without pins',()=>{
 assert.throws(()=>validateConfig({}));const c={schemaVersion:1,repository:'eunsujeo/stablecoin-atlas',repositoryId:8,workflowId:7,workflowBlob:A,enabled:false,components:{web:{enabled:true},collector:{enabled:false},usage:{enabled:false}},files:Object.fromEntries(['reader','web','github','ca'].map(id=>[id,{sha256:H,owner:'root',mode:['web','ca'].includes(id)?0o644:0o600}]))};assert.equal(validateConfig(c),c);assert.throws(()=>validateConfig({...c,components:{...c.components,usage:{enabled:true}}}));assert.throws(()=>validateConfig({...c,files:{...c.files,arbitrary:{sha256:H,owner:'root',mode:0o600}}}));
});

test('real systemctl timer output has no service User/cwd/PID and validates its separate schedule policy',async()=>{
 const {parseUnitState,validateTimer,timerDefinition}=await import('../tools/deploy/system.mjs');
 const output='LoadState=loaded\nActiveState=active\nSubState=waiting\nUnit=atlas-usage.service\nPersistent=no\nTimersCalendar={ OnCalendar=*-*-* 00:20:00 UTC ; next_elapse=Fri 2026-10-30 00:20:00 UTC }\nNextElapseUSecRealtime=Fri 2026-10-30 00:20:00 UTC';
 const state=parseUnitState(output,'atlas-usage.timer');assert.equal(state.MainPID,'0');assert.equal(state.User,undefined);validateTimer('atlas-usage.timer',state,{timers:{'atlas-usage.timer':timerDefinition(state)}});
 assert.throws(()=>validateTimer('atlas-usage.timer',{...state,Persistent:'yes'},{}),/POLICY/);assert.throws(()=>validateTimer('atlas-usage.timer',{...state,Unit:'unrelated.service'},{}),/CONFIGURATION/);
});
test('resume blocks ambiguous or missed Persistent FX ticks and expired Usage authorization without new sends',async()=>{
 const {validateResumeWindow}=await import('../tools/deploy/system.mjs');const before={'atlas-fx.timer':{ActiveState:'active',Persistent:'yes',NextElapseUSecRealtime:'Fri 2026-10-30 00:10:00 UTC'}},now=Date.parse('2026-10-30T00:10:01Z');
 await assert.rejects(validateResumeWindow('collector',before,{now}),/CATCHUP_BLOCKED/);await validateResumeWindow('collector',before,{now,confirmedFX:async()=>true});await validateResumeWindow('collector',before,{now:now-2000});
 await assert.rejects(validateResumeWindow('collector',{'atlas-fx.timer':{...before['atlas-fx.timer'],NextElapseUSecRealtime:'n/a'}},{now}),/WINDOW_UNKNOWN/);
 await assert.rejects(validateResumeWindow('usage',{}, {now,usageAuthorization:{fromDay:'2026-10-29',untilExclusive:'2026-10-30'}}),/EXPIRED/);
});
test('failed crash recovery keeps a retryable journal, the actual new pointer and original last-good evidence',async t=>{
 const h=await harness(t,'usage');await mkdir(h.state,{recursive:true});await mkdir(join(h.root,'releases',B));await writeFile(join(h.root,'releases',B,'REVISION'),B);await point(h.root,'usage-current',B);
 await atomicJSON(join(h.state,'transaction.json'),{candidate:h.c,old:A,before:{timer:{ActiveState:'active'}},previousVersion:{lastSuccess:A},phase:'SWITCHING',terminal:false});h.ops.hold=async()=>{throw Error('REMOTE_WORKER_LOCKED');};
 const r=await h.run();assert.equal(r.state,'RECOVERY_BLOCKED');assert.equal(r.current,B);assert.equal(r.lastSuccess,A);assert.equal((await json(join(h.state,'transaction.json'))).terminal,false);assert.equal(await pointer(h.root,'usage-current'),B);assert.equal(h.calls.resume,0);
 h.ops.hold=async()=>({release:async()=>{}});const second=await h.run();assert.equal(second.state,'CRASH_RECOVERED');assert.equal(second.current,A);assert.equal(h.calls.bundle,0);
});
test('a first-deployment crash stops and clears only its own new pointer',async t=>{
 const h=await harness(t);await rm(join(h.root,'current'));await mkdir(h.state,{recursive:true});await mkdir(join(h.root,'releases',B));await writeFile(join(h.root,'releases',B,'REVISION'),B);await point(h.root,'current',B);let stopped=false;h.ops.stop=async()=>{stopped=true;};h.ops.clearPointer=async(c,expected)=>{assert.equal(expected,B);await rm(join(h.root,'current'));};
 await atomicJSON(join(h.state,'transaction.json'),{candidate:h.c,old:null,phase:'SWITCHING',terminal:false});const r=await h.run();assert.equal(r.state,'CRASH_RECOVERED');assert.equal(r.current,null);assert.equal(stopped,true);assert.equal(await pointer(h.root,'current'),null);
});
test('report storage failure is repaired separately from a committed healthy deployment',async t=>{
 const h=await harness(t);let fail=true;const store=async(p,v)=>{if(fail&&p.includes('/reports/'))throw Error('DISK_FULL');return atomicJSON(p,v);};
 const run=()=>reconcile({root:h.root,state:h.state,config:h.config,github:h.gh,ops:h.ops,store});const first=await run();assert.equal(first.state,'SUCCESS');assert.equal(first.notification,'REPORT_STORAGE_PENDING');assert.equal((await json(join(h.state,'transaction.json'))).phase,'COMMITTED');fail=false;await run();assert.equal(h.calls.restart,1);assert.equal(h.calls.bundle,1);
 const count=h.calls.status.length;await run();assert.equal(h.calls.status.length,count,'acknowledged status must not be posted forever');
});
test('a post-commit versions-cache failure does not roll back code or permit another dispatch',async t=>{
 const h=await harness(t);let fail=true;const store=async(p,v)=>{if(fail&&p.endsWith('versions.json'))throw Error('DISK_FULL');return atomicJSON(p,v);};const run=()=>reconcile({root:h.root,state:h.state,config:h.config,github:h.gh,ops:h.ops,store});
 const first=await run();assert.equal(first.state,'SUCCESS');assert.equal(await pointer(h.root,'current'),B);assert.equal((await json(join(h.state,'transaction.json'))).result.current,B);fail=false;await run();assert.equal((await json(join(h.state,'versions.json'))).web.lastSuccess,B);assert.equal(h.calls.restart,1);
});
test('recovery re-crash retains durable intent and never invents a restored current SHA',async t=>{
 const h=await harness(t,'collector');await mkdir(h.state,{recursive:true});await mkdir(join(h.root,'releases',B));await writeFile(join(h.root,'releases',B,'REVISION'),B);await point(h.root,'collector-current',B);await atomicJSON(join(h.state,'transaction.json'),{candidate:h.c,old:A,before:{},previousVersion:{lastSuccess:A},phase:'RECOVERING',terminal:false,recoveryAttempts:1});
 h.ops.restore=async()=>{throw Error('RESTORE_FAILED');};assert.equal((await h.run()).current,B);h.ops.restore=(c,s)=>point(h.root,'collector-current',s);assert.equal((await h.run()).current,A);assert.equal(h.calls.bundle,0);
});
test('GitHub Retry-After cooldown survives poll intervals and performs zero early retries',async()=>{
 let now=1000,calls=0,until;const c=githubClient({repository:'eunsujeo/stablecoin-atlas',token:'test',now:()=>now,onCooldown:async value=>until=value,fetcher:async()=>{calls++;return new Response(null,{status:429,headers:{'Retry-After':'3600'}});}});await assert.rejects(c.candidate({}),/RATE_LIMITED/);assert.equal(until,3601000);now=61000;await assert.rejects(c.candidate({}),/COOLDOWN/);assert.equal(calls,1);
});

test('real loopback release health validates all public assets and JSON APIs and rejects any corrupted asset or response',async()=>{
 const {startPreviewServer}=await import('../tools/ui-preview.mjs'),{normalizeSources}=await import('../tools/market-store.mjs'),{verifyWebRelease}=await import('../tools/deploy/web-health.mjs'),{loopbackRequest}=await import('../tools/loopback-http.mjs'),{reviewedAssetSnapshot}=await import('../tools/asset-review-source.mjs'),{usageV2Fixture}=await import('./network-usage-v2-fixture.mjs');
 const registry=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url))),market=normalizeSources(registry,[{hash:H,value:{requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-25T00:00:00.000Z',data:{price:'1',circulatingSupply:'100',totalSupply:'200'}}]}}]);
 market.readState={source:'POSTGRESQL',historyFrom:'2026-09-25T00:00:00.000Z',historyTo:'2026-10-25T00:00:00.000Z',pointsPerSeries:100,series:0,historyRows:'0',sampled:false,latestRequestFailures:0,latestMissingFields:0};
 const from='2025-10-23',to='2026-10-23',metric='NETWORK_CIRCULATING',index={schemaVersion:1,kind:'REGISTERED_SUPPLY_INDEX',selectionId:H,networks:[{id:'ethereum',name:'Ethereum'}],coins:[{id:'usdc',symbol:'USDC',name:'USD Coin',pegCurrency:'USD',notes:[],metrics:[{metric,sourceId:H,from,to}]}]},history={schemaVersion:1,kind:'REGISTERED_SUPPLY_HISTORY',selectionId:H,coinId:'usdc',metric,pegCurrency:'USD',contract:{metric,unit:'token',amountKind:'TOKEN_QUANTITY',definition:'DEFILLAMA_NETWORK_CIRCULATING_V1'},from,to,updatedAt:'2026-10-23T12:00:00.000Z',state:'AVAILABLE',sourceId:H,sourceHash:H,missingNetworks:[],series:[{networkId:'ethereum',points:[{day:to,amount:'9007199254740993.000000000000000001'}]}]};
 const fx={schemaVersion:1,kind:'ECB_REFERENCE_FX',base:'EUR',date:'2026-10-23',usdPerEUR:'2',krwPerEUR:'2000',sourceHash:H,fetchedAt:'2026-10-23T12:00:00.000Z',importedAt:null};
 const server=await startPreviewServer(0,{production:{hosts:['atlas.example.com'],commit:A},marketReader:async()=>market,registrationReader:async url=>url.startsWith('/registration-history')?history:index,assetReviewReader:async()=>reviewedAssetSnapshot,networkUsageReader:async()=>usageV2Fixture(),activityReader:async()=>{throw Error('UNUSED');},reviewedSupplyReader:async()=>{throw Error('UNUSED');},surveyReader:async()=>{throw Error('UNUSED');},fxReader:async()=>fx});
 const release=new URL('../',import.meta.url).pathname,config={port:server.address().port,hosts:['atlas.example.com']};
 try{
  assert.equal((await verifyWebRelease({sha:A,release,config})).state,'HEALTHY');await assert.rejects(verifyWebRelease({sha:B,release,config}),/SHA/);
  for(const path of ['/styles.css','/network-usage-data.json','/registration-index.json','/fx-data.json'])await assert.rejects(verifyWebRelease({sha:A,release,config,request:async o=>o.path===path?{status:200,body:Buffer.from('{}')}:loopbackRequest(o)}));
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('release readiness waits for the correct SHA/database before validating assets and APIs',async()=>{
 const {waitForWebRelease}=await import('../tools/deploy/web-health.mjs'),order=[];const options={sha:A,config:{hosts:['atlas.example.com'],port:4173}};await waitForWebRelease(options,{ready:async(s,o)=>{assert.equal(s,A);assert.equal(o.attempts,12);order.push('ready');return true;},verify:async()=>{order.push('assets-api');return {state:'HEALTHY'};}});assert.deepEqual(order,['ready','assets-api']);
 await assert.rejects(waitForWebRelease(options,{ready:async()=>false,verify:async()=>assert.fail('must not validate an unready service')}),/NOT_READY/);
});
test('CI builder uses only clean tracked source and regular production dependencies, never local credentials or report archives',async t=>{
 const {buildRelease}=await import('../tools/deploy/build.mjs'),root=await temp(t),git=(...args)=>{const r=spawnSync('git',['-C',root,'-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false',...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};git('init','-q');
 const files={'.gitignore':'node_modules/\n.env.local\nreports/\noutput/\n','package.json':'{}','package-lock.json':'{}','tools/production-web.mjs':'// fixture',...Object.fromEntries(Object.values(policyFiles).flat().map(n=>[n,'// policy']))};for(const[n,v]of Object.entries(files)){await mkdir(join(root,n,'..'),{recursive:true});await writeFile(join(root,n),v);}git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');const commit=git('rev-parse','HEAD');
 await mkdir(join(root,'node_modules/pg'),{recursive:true});await writeFile(join(root,'node_modules/pg/package.json'),'{}');await writeFile(join(root,'.env.local'),'SECRET_SENTINEL');await mkdir(join(root,'reports'));await writeFile(join(root,'reports/raw.json'),'PRIVATE_RAW_SENTINEL');
 const output=join(root,'output'),options={root,output,commit,component:'web',runId:1,attempt:1,platform:'linux',arch:'arm64',nodeVersion:'24.5.0'};const result=await buildRelease(options);assert.equal(result.commit,commit);const entries=tarEntries(await readFile(join(output,'release.tar')));assert(!entries.some(e=>e.name.includes('.env.local')||e.name.startsWith('reports/')));assert(entries.some(e=>e.name==='node_modules/pg/package.json'));
 await assert.rejects(buildRelease({...options,output:join(root,'bad'),arch:'x64'}),/PLATFORM/);await writeFile(join(root,'package.json'),'{"tampered":true}');await assert.rejects(buildRelease({...options,output:join(root,'bad')}));
});
test('GitHub App JWTs mint repository-limited short-lived tokens without executing helpers or copying keys into CI',async()=>{
 const {generateKeyPairSync,verify}=await import('node:crypto'),{githubToken}=await import('../tools/deploy/github-token.mjs');const pair=generateKeyPairSync('rsa',{modulusLength:2048}),privateBytes=pair.privateKey.export({type:'pkcs8',format:'pem'}),seen=[];const now=Date.now(),env={GITHUB_APP_ID:'123',GITHUB_INSTALLATION_ID:'456',GITHUB_APP_PRIVATE_KEY_FILE:'/etc/atlas-deploy/github-app.pem'};
 const fetcher=async(url,o)=>{const parts=o.headers.Authorization.slice(7).split('.');assert.equal(verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),pair.publicKey,Buffer.from(parts[2],'base64url')),true);const claim=JSON.parse(Buffer.from(parts[1],'base64url'));assert.equal(claim.iss,'123');assert.equal(claim.exp-claim.iat,600);seen.push({url:String(url),o});return new Response(JSON.stringify(String(url).endsWith('/installation')?{id:456,app_id:123}:{token:'TEMPORARY_TEST_TOKEN',expires_at:new Date(now+3600000).toISOString()}));};
 assert.equal(await githubToken(env,{readKey:async()=>privateBytes,fetcher,now:()=>now}),'TEMPORARY_TEST_TOKEN');const request=JSON.parse(seen[1].o.body);assert.deepEqual(request.repositories,['stablecoin-atlas']);assert.deepEqual(request.permissions,{actions:'read',contents:'read',statuses:'write',actions_variables:'read'});
 await assert.rejects(githubToken({...env,GITHUB_APP_PRIVATE_KEY_FILE:'/other/key'},{readKey:()=>assert.fail()}),/CREDENTIALS/);assert.equal(await githubToken({GITHUB_TOKEN:'FIXTURE_PAT'}),'FIXTURE_PAT');
});
test('the production agent can only start a fixed broker; manual and automatic entry points share the OS deployment lock',async()=>{
 const rule=await readFile(new URL('../deploy/atlas-deploy.rules',import.meta.url),'utf8'),agent=await readFile(new URL('../deploy/atlas-deploy-agent.service',import.meta.url),'utf8'),broker=await readFile(new URL('../deploy/atlas-deploy-apply.service',import.meta.url),'utf8'),manual=await readFile(new URL('../deploy/atlas-release',import.meta.url),'utf8');
 assert(rule.includes('subject.user === "atlaspull"')&&rule.includes('action.lookup("unit") === "atlas-deploy-apply.service"')&&rule.includes('action.lookup("verb") === "start"'));assert(agent.includes('NoNewPrivileges=true')&&agent.includes('PrivateNetwork=true'));assert(!agent.includes('sudo'));assert(broker.includes('/usr/bin/flock -n /run/lock/atlas-deploy.lock'));assert(manual.includes('/usr/bin/flock -n /run/lock/atlas-deploy.lock'));assert(!broker.includes('git ')&&!broker.includes('npm '));
});

test('the kernel deployment lease excludes another process and is released automatically after an interrupted owner',async t=>{
 const {spawn}=await import('node:child_process'),root=await temp(t),lock=join(root,'lock');const script='import fcntl,sys\nf=open(sys.argv[1],"a")\nfcntl.flock(f,fcntl.LOCK_EX)\nprint("LOCKED",flush=True)\nsys.stdin.read()';const child=spawn('python3',['-c',script,lock],{stdio:['pipe','pipe','pipe']});t.after(()=>child.kill('SIGTERM'));await new Promise((resolve,reject)=>{child.once('error',reject);child.stdout.once('data',b=>String(b).includes('LOCKED')?resolve():reject(Error('no lock')));});
 const attempt='import fcntl,sys\nf=open(sys.argv[1],"a")\ntry: fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)\nexcept BlockingIOError: sys.exit(7)';assert.equal(spawnSync('python3',['-c',attempt,lock]).status,7);const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exited;assert.equal(spawnSync('python3',['-c',attempt,lock]).status,0);
});
test('a real crash after durable commit repairs caches without rolling back a healthy new version',async t=>{
 const h=await harness(t),url=name=>JSON.stringify(new URL('../tools/deploy/'+name,import.meta.url).href);const code=`import {reconcile} from ${url('controller.mjs')};import {atomicJSON} from ${url('files.mjs')};import {packEntries,releaseManifest} from ${url('archive.mjs')};import {pointer} from ${JSON.stringify(new URL('../tools/release-switch.mjs',import.meta.url).href)};const [root,state]=process.argv.slice(1),c=${JSON.stringify(h.c)},p=packEntries([{name:'REVISION',bytes:Buffer.from(c.sha)}]);await reconcile({root,state,config:${JSON.stringify(h.config)},store:async(path,v)=>{await atomicJSON(path,v);if(path.endsWith('transaction.json')&&v.phase==='COMMITTED')process.exit(43);},github:{candidate:async()=>c,bundle:async()=>({payload:p,manifest:releaseManifest(p,{commit:c.sha,component:'web',runId:10,attempt:1,policies:{}})}),status:async()=>{}},ops:{current:()=>pointer(root,'current'),preflight:async()=>{},service:async()=>'active',restart:async()=>{},stop:async()=>{},health:async()=>{}}});`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',code,h.root,h.state],{encoding:'utf8',timeout:10000});assert.equal(result.status,43,result.stderr);assert.equal((await json(join(h.state,'transaction.json'))).phase,'COMMITTED');assert.equal(await pointer(h.root,'current'),B);const repaired=await h.run();assert.equal(repaired.state,'SUCCESS');assert.equal((await json(join(h.state,'versions.json'))).web.lastSuccess,B);assert.equal(h.calls.restart,0);assert.equal(h.calls.bundle,0);
});

test('manual entry refuses to overwrite a pending automated recovery journal',async t=>{
 const h=await harness(t);await mkdir(h.state);await atomicJSON(join(h.state,'transaction.json'),{terminal:false,phase:'RECOVERY_BLOCKED'});
 await assert.rejects(performManual({command:'stage',candidate:h.c,root:h.root,state:h.state,ops:h.ops,stage:async()=>assert.fail('stage must not execute')}),/RECOVERY_REQUIRED/);assert.equal((await json(join(h.state,'transaction.json'))).phase,'RECOVERY_BLOCKED');
});
test('manual activation commits before cache writes and automated reconciliation repairs without restart',async t=>{
 const h=await harness(t);await mkdir(h.state);await extractRelease(payload(),join(h.root,'releases',B));
 const result=await performManual({command:'activate',candidate:h.c,root:h.root,state:h.state,ops:h.ops,store:async(path,value)=>{if(path.endsWith('/versions.json'))throw Error('DISK_FULL');return atomicJSON(path,value);}});
 assert.equal(result.reason,'VERSION_CACHE_PENDING');assert.equal(await h.ops.current('web'),B);assert.equal((await json(join(h.state,'transaction.json'))).phase,'COMMITTED');const restarts=h.calls.restart;await h.run();assert.equal(h.calls.restart,restarts);assert.equal((await json(join(h.state,'versions.json'))).web.lastSuccess,B);
});
test('manual failed health restores the old pointer and preserves the failed outcome durably',async t=>{
 const h=await harness(t);await mkdir(h.state);await extractRelease(payload(),join(h.root,'releases',B));h.failHealth();
 await assert.rejects(performManual({command:'activate',candidate:h.c,root:h.root,state:h.state,ops:h.ops}));assert.equal(await h.ops.current('web'),A);const tx=await json(join(h.state,'transaction.json'));assert.equal(tx.terminal,true);assert.equal(tx.result.state,'FAILED');assert.equal(tx.result.lastSuccess,A);
});

test('manual web stage rejects a collector candidate before touching any journal',async t=>{
 const h=await harness(t,'collector');await mkdir(h.state);await assert.rejects(performManual({command:'stage',candidate:h.c,root:h.root,state:h.state,ops:h.ops}),/WEB_CANDIDATE_REQUIRED/);assert.equal(await json(join(h.state,'transaction.json'),null),null);
});
test('manual old-pointer restoration with unhealthy old service preserves nonterminal recovery',async t=>{
 const h=await harness(t);await mkdir(h.state);await extractRelease(payload(),join(h.root,'releases',B));h.ops.health=async()=>{throw Error('UNHEALTHY');};
 await assert.rejects(performManual({command:'activate',candidate:h.c,root:h.root,state:h.state,ops:h.ops}),/DEPLOY_ROLLBACK_UNHEALTHY/);assert.equal(await h.ops.current('web'),A);const tx=await json(join(h.state,'transaction.json'));assert.equal(tx.terminal,false);assert.equal(tx.phase,'RECOVERY_BLOCKED');
});
test('manual entry repairs prior committed versions and report before replacing the journal',async t=>{
 const h=await harness(t);await h.run();await rm(join(h.state,'versions.json'));await rm(join(h.state,'reports'),{recursive:true});
 const args={command:'stage',candidate:h.c,root:h.root,state:h.state,ops:h.ops,stage:async()=>{assert.equal((await json(join(h.state,'versions.json'))).web.lastSuccess,B);assert.equal(h.calls.status.at(-1).state,'SUCCESS');}};
 await assert.rejects(performManual(args),/COMMITTED_REPAIR_REQUIRED/);assert.equal((await json(join(h.state,'transaction.json'))).phase,'COMMITTED');
 await performManual({...args,repair:()=>reconcile({root:h.root,state:h.state,config:h.config,github:h.gh,ops:h.ops,repairOnly:true})});assert.equal((await json(join(h.state,'transaction.json'))).phase,'STAGED');
});
test('failed prior commit reporting blocks manual journal replacement without rolling back code',async t=>{
 const h=await harness(t);await h.run();await rm(join(h.state,'reports'),{recursive:true});h.gh.status=async()=>{throw Error('OFFLINE');};
 await assert.rejects(performManual({command:'stage',candidate:h.c,root:h.root,state:h.state,ops:h.ops,repair:()=>reconcile({root:h.root,state:h.state,config:h.config,github:h.gh,ops:h.ops,repairOnly:true})}),/REPORT_RECOVERY_REQUIRED/);assert.equal((await json(join(h.state,'transaction.json'))).phase,'COMMITTED');assert.equal(await h.ops.current('web'),B);
});
test('manual real process interruption after pointer switch is recovered by the automated journal path',async t=>{
 const h=await harness(t);await mkdir(h.state);await extractRelease(payload(),join(h.root,'releases',B));const url=JSON.stringify(new URL('../tools/deploy/manual.mjs',import.meta.url).href),switchUrl=JSON.stringify(new URL('../tools/release-switch.mjs',import.meta.url).href);
 const code=`import {performManual} from ${url};import {pointer} from ${switchUrl};const [root,state]=process.argv.slice(1);await performManual({command:'activate',root,state,candidate:${JSON.stringify(h.c)},ops:{current:()=>pointer(root,'current'),preflight:async()=>{},restart:async()=>process.exit(44),stop:async()=>{},health:async()=>{},service:async()=>'active'}});`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code,h.root,h.state],{encoding:'utf8',timeout:10000});assert.equal(child.status,44,child.stderr);assert.equal(await h.ops.current('web'),B);assert.equal((await json(join(h.state,'transaction.json'))).terminal,false);assert.equal((await h.run()).state,'CRASH_RECOVERED');assert.equal(await h.ops.current('web'),A);
});

test('first-deployment unlink with failed stop stays nonterminal until a later poll confirms stop',async t=>{
 const h=await harness(t),{unlink}=await import('node:fs/promises');await unlink(join(h.root,'current'));let stops=0;h.ops.stop=async()=>{stops++;throw Error('STOP_FAILED');};h.ops.health=async()=>{throw Error('UNHEALTHY');};
 const initial=await h.run();assert.equal(initial.state,'RECOVERY_BLOCKED');assert.equal(await h.ops.current('web'),null);assert.equal((await json(join(h.state,'transaction.json'))).terminal,false);const previousStops=stops;
 assert.equal((await h.run()).state,'RECOVERY_BLOCKED');assert.ok(stops>previousStops);await assert.rejects(performManual({command:'stage',candidate:h.c,root:h.root,state:h.state,ops:h.ops}),/RECOVERY_REQUIRED/);
 h.ops.stop=async()=>{stops++;};const recovered=await h.run();assert.equal(recovered.state,'CRASH_RECOVERED');assert.equal(recovered.current,null);assert.equal((await json(join(h.state,'transaction.json'))).terminal,true);
});
test('real interruption after first-deploy unlink rechecks stop before recording recovery',async t=>{
 const h=await harness(t),{unlink}=await import('node:fs/promises');await unlink(join(h.root,'current'));await mkdir(h.state);await extractRelease(payload(),join(h.root,'releases',B));const code=`import {performManual} from ${JSON.stringify(new URL('../tools/deploy/manual.mjs',import.meta.url).href)};import {pointer} from ${JSON.stringify(new URL('../tools/release-switch.mjs',import.meta.url).href)};const [root,state]=process.argv.slice(1);await performManual({command:'activate',candidate:${JSON.stringify(h.c)},root,state,ops:{current:()=>pointer(root,'current'),preflight:async()=>{},restart:async()=>{},health:async()=>{throw Error('BAD_HEALTH');},stop:async()=>process.exit(45)}});`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code,h.root,h.state],{encoding:'utf8',timeout:10000});assert.equal(child.status,45,child.stderr);assert.equal(await h.ops.current('web'),null);let stopped=false;h.ops.stop=async()=>{stopped=true;};assert.equal((await h.run()).state,'CRASH_RECOVERED');assert.equal(stopped,true);
});

test('independent candidates on the same SHA do not starve a pending web release after collector completion',async()=>{
 const {run}=fakeGitHub(),collector={...run,id:11,event:'workflow_dispatch',display_title:'collector / '+B},f=fakeGitHub({runs:[collector,run]});
 assert.equal((await f.client.candidate(f.cfg,{})).component,'collector');const versions={collector:{lastAttempt:11,lastAttemptNumber:1},web:{}};assert.equal((await f.client.candidate(f.cfg,versions)).component,'web');versions.web={lastAttempt:10,lastAttemptNumber:1};assert.equal(await f.client.candidate(f.cfg,versions),null);const retry=fakeGitHub({runs:[collector,{...run,run_attempt:2}]});assert.equal((await retry.client.candidate(retry.cfg,versions)).attempt,2);versions.web.lastAttemptNumber=2;assert.equal(await retry.client.candidate(retry.cfg,versions),null);
});
test('a pending committed report is acknowledged before processing another component candidate',async t=>{
 const h=await harness(t);await h.run();await rm(join(h.state,'reports'),{recursive:true});h.gh.status=async()=>{throw Error('OFFLINE');};let candidates=0;h.gh.candidate=async()=>{candidates++;return {...h.c,component:'collector',id:11};};const r=await h.run();assert.equal(r.notification,'GITHUB_REPORT_PENDING');assert.equal(candidates,0);assert.equal((await json(join(h.state,'transaction.json'))).candidate.component,'web');
});

test('reporting Bash uses the same component and newer run or attempt when classifying supersession',async t=>{
 const root=await temp(t),source=await readFile(new URL('../.github/workflows/deployment-result.yml',import.meta.url),'utf8'),begin=source.indexOf('            newest=$('),end=source.indexOf('            state=$(',begin),script=source.slice(begin,end)+'\necho NOT_SUPERSEDED >> "$GITHUB_STEP_SUMMARY"';
 const prefix='https://github.com/eunsujeo/stablecoin-atlas/actions/runs/',cases=[['atlas/collector',prefix+'11/attempts/1',false],['atlas/web',prefix+'10/attempts/2',true],['atlas/web',prefix+'11/attempts/1',true],['atlas/web',prefix+'9/attempts/9',false],['atlas/web','https://attacker.invalid/actions/runs/11/attempts/1',false]];
 for(const [i,[context,target_url,expected]]of cases.entries()){const path=join(root,'summary-'+i),r=spawnSync('bash',['-e','-u','-o','pipefail','-c',script],{encoding:'utf8',env:{...process.env,states:JSON.stringify([{context,target_url}]),component:'web',REPOSITORY:'eunsujeo/stablecoin-atlas',SOURCE_RUN:'10',SOURCE_ATTEMPT:'1',GITHUB_STEP_SUMMARY:path}});assert.equal(r.status,0,r.stderr);assert.equal((await readFile(path,'utf8')).startsWith('SUPERSEDED:'),expected);}
});
