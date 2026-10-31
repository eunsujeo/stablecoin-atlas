import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile,writeFile,chmod,lstat,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildRelease} from '../tools/deploy/build.mjs';
import {localConfiguration} from '../tools/deploy/local-config.mjs';
import {localSourceClient,localBuildCommand,validateLocalBundle,readLocalOutput,localBuildPolicy,localMainCommand} from '../tools/deploy/local-source.mjs';
import {validateLocalLock,localRepository} from '../tools/deploy/local-build-worker.mjs';
import {packEntries,releaseManifest,validateBundle,tarEntries} from '../tools/deploy/archive.mjs';
import {policyFiles,payloadPolicies} from '../tools/deploy/policy.mjs';
import {validateConfig} from '../tools/deploy/config.mjs';
import {requiredFiles} from '../tools/deploy/system.mjs';
import {reconcile} from '../tools/deploy/controller.mjs';
import {hash,json} from '../tools/deploy/files.mjs';
const A='a'.repeat(40),B='b'.repeat(40),H='c'.repeat(64),config={source:'LOCAL_GIT',repository:'eunsujeo/stablecoin-atlas',enabled:true,components:{web:{enabled:true},collector:{enabled:false},usage:{enabled:false}}};
async function fixture(t){const p=await mkdtemp(join(tmpdir(),'atlas-local-'));t.after(()=>rm(p,{recursive:true,force:true}));return p;}
const trust=async p=>{const s=await lstat(p);assert.ok(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o022));};
test('main discovery uses builder-accessible cwd and preserves only proxy/CA environment',()=>{
 const {command,args,options}=localMainCommand({HTTPS_PROXY:'https://proxy.example.invalid',SSL_CERT_FILE:'/etc/pki/ca-bundle.crt',SSH_AUTH_SOCK:'/private/agent',GITHUB_TOKEN:'PRIVATE_SENTINEL',GIT_SSL_NO_VERIFY:'1',NODE_TLS_REJECT_UNAUTHORIZED:'0'},{uid:978,gid:979});assert.equal(command,'/usr/bin/git');assert.equal(options.uid,978);assert.equal(options.gid,979);assert.equal(options.cwd,'/var/cache/atlas-build');assert.ok(!args.includes('runuser'));assert.deepEqual(args.slice(-2),[localRepository,'refs/heads/main']);assert.equal(options.env.HTTPS_PROXY,'https://proxy.example.invalid');assert.equal(options.env.SSL_CERT_FILE,'/etc/pki/ca-bundle.crt');for(const name of ['SSH_AUTH_SOCK','GITHUB_TOKEN','GIT_SSL_NO_VERIFY','NODE_TLS_REJECT_UNAUTHORIZED'])assert.equal(options.env[name],undefined);
});
test('operator-state fixture creates its stated modes under the actual builder umask 077',()=>{
 const url=new URL('./deploy-bootstrap-fixture.mjs',import.meta.url).href;
 const script=`import {bootstrapFixture} from ${JSON.stringify(url)};import{lstat,rm}from'node:fs/promises';import{join}from'node:path';process.umask(0o077);const f=await bootstrapFixture();try{console.log(JSON.stringify({prefix:(await lstat(f.prefix)).mode&0o777,helper:(await lstat(join(f.layout.bin,'atlas-release'))).mode&0o777,unit:(await lstat(join(f.layout.unitDir,'atlas-deploy-agent.service'))).mode&0o777}));}finally{await rm(f.prefix,{recursive:true,force:true});}`;
 const observed=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'}));assert.deepEqual(observed,{prefix:0o700,helper:0o755,unit:0o640});
});
function bundle(c){const names=['REVISION','package.json','package-lock.json','tools/production-web.mjs','node_modules/pg/package.json',...new Set(Object.values(policyFiles).flat())];const entries=names.map(name=>({name,bytes:Buffer.from(name==='REVISION'?c.sha+'\n':'fixture')})),payload=packEntries(entries);const manifest=releaseManifest(payload,{commit:c.sha,component:'web',runId:c.id,attempt:1,kind:'ATLAS_LOCAL_RELEASE',policies:payloadPolicies(entries)});manifest.localBuild={policyHash:H,tested:true,repository:localRepository};return {payload,manifest};}
test('local config needs no Actions IDs, token or variable; collector/usage expansion is refused',()=>{
 const files=Object.fromEntries(['reader','web','ca'].map(id=>[id,{sha256:H,owner:'root',mode:id==='reader'?0o600:0o644}]));const c={...config,schemaVersion:1,files};assert.equal(validateConfig(c),c);assert.deepEqual(requiredFiles(c,'web'),['ca','reader','web']);assert.deepEqual(requiredFiles({...c,files:{...files,github:{sha256:H,owner:'root',mode:0o600}}},'all'),['reader','web','ca']);
 assert.throws(()=>validateConfig({...c,source:'OTHER'}),/CONFIG_INVALID/);assert.throws(()=>validateConfig({...c,components:{...c.components,collector:{enabled:true}}}),/LOCAL_WEB_ONLY/);
 const current={...c,enabled:false};const next=localConfiguration(current,A);assert.equal(next.bootstrapSha,A);assert.equal(next.enabled,false);assert.equal(next.files,current.files);assert.equal(next.components,current.components);assert.equal(current.bootstrapSha,undefined);assert.throws(()=>localConfiguration({...current,enabled:true},A),/LOCAL_CONFIG_ARGUMENTS/);
});
test('fixed sandbox commands keep every phase unprivileged and tests/pack offline with bounded resources',()=>{
 const job='/opt/stablecoin-atlas/builds/'+randomUUID();
 for(const phase of localBuildPolicy.phases){const [command,args]=localBuildCommand({phase,job,commit:A,id:100,codeRoot:'/usr/local/lib/atlas-deploy'});assert.equal(command,'/usr/bin/systemd-run');
  for(const p of ['User=atlasbuild','Group=atlasbuild','ProtectHome=true','ProtectSystem=strict','NoNewPrivileges=true','CapabilityBoundingSet=','KillMode=control-group','MemoryMax=2G','CPUQuota=200%','TasksMax=128'])assert.ok(args.includes('--property='+p),p);
  assert.ok(args.includes('--property=PrivateNetwork='+(['test','pack'].includes(phase))));assert.ok(args.includes('--property=ReadWritePaths='+job+' /var/cache/atlas-build/npm-cache'));assert.ok(args.includes('/usr/bin/node'));assert.equal(args.at(-1),'100');
 }
 for(const change of [{job:'/tmp/arbitrary'},{phase:'shell'},{commit:'--upload-pack=bad'}])assert.throws(()=>localBuildCommand({phase:'test',job,commit:A,id:100,codeRoot:'/usr/local/lib/atlas-deploy',...change}),/LOCAL_BUILD_COMMAND/);
});
test('npm lock permits integrity-pinned registry tarballs only, without Git/file/link or alternate hosts',async()=>{
 validateLocalLock(JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8')));
 const pin={version:'1.0.0',resolved:'https://registry.npmjs.org/example/-/example-1.0.0.tgz',integrity:'sha512-YWJjZA=='};
 for(const patch of [{resolved:'file:/etc/private'},{resolved:'https://attacker.invalid/pkg'},{resolved:'git+https://github.com/x/y'},{resolved:'https://user:pass@registry.npmjs.org/x'},{integrity:'sha1-YWJj'},{link:true}])assert.throws(()=>validateLocalLock({lockfileVersion:3,packages:{'':{},'node_modules/example':{...pin,...patch}}}));
});
test('candidate identity is durable, SHA/policy bound and monotonic across old CI attempts without API calls',async t=>{
 const state=await fixture(t);let main=A,policy=H;const client=localSourceClient({state,discover:async()=>main,policy:async()=>policy,clock:()=>10,trust});
 const first=await client.candidate(config,{web:{lastAttempt:40000000000}});assert.equal(first.id,40000000001);assert.equal(first.sha,A);assert.equal(first.component,'web');assert.deepEqual(await client.candidate(config),first);
 main=B;const second=await client.candidate(config);assert.equal(second.id,first.id+1);policy='d'.repeat(64);assert.equal((await client.candidate(config)).id,second.id+1);
 await client.status(second,{state:'READY'});assert.equal((await json(join(state,'local-status.json'))).state,'READY');await client.reportingReady();
});
test('local attestation cannot masquerade as CI or accept a different policy, SHA, ABI or damaged payload',()=>{
 const c={sha:A,id:10,attempt:1,component:'web'},b=bundle(c),files={'release.tar':b.payload,'release.json':Buffer.from(JSON.stringify(b.manifest))};assert.equal(validateLocalBundle(files,c,H).manifest.kind,'ATLAS_LOCAL_RELEASE');assert.throws(()=>validateBundle(files,c),/MANIFEST_INVALID/);
 for(const change of [{localBuild:{policyHash:H,tested:false,repository:localRepository}},{kind:'ATLAS_CI_RELEASE'},{commit:B},{nodeABI:'invalid'}]){const bad={'release.tar':b.payload,'release.json':Buffer.from(JSON.stringify({...b.manifest,...change}))};assert.throws(()=>validateLocalBundle(bad,c,H));}
 const damaged=Buffer.from(b.payload);damaged[0]^=1;assert.throws(()=>validateLocalBundle({...files,'release.tar':damaged},c,H));assert.throws(()=>validateLocalBundle(files,c,'d'.repeat(64)),/LOCAL_BUILD_ATTESTATION/);
});
test('tested local artifacts are root-snapshotted and reused; corruption/partial cache never triggers a rebuild',async t=>{
 const state=await fixture(t);let builds=0;const client=localSourceClient({state,codeRoot:'/usr/local/lib/atlas-deploy/',discover:async()=>A,policy:async()=>H,build:async(c,options)=>{assert.equal(options.codeRoot,'/usr/local/lib/atlas-deploy');localBuildCommand({phase:'prepare',job:'/opt/stablecoin-atlas/builds/'+randomUUID(),commit:c.sha,id:c.id,codeRoot:options.codeRoot});builds++;return bundle(c);},clock:()=>10,trust}),c=await client.candidate(config);
 const first=await client.bundle(c);assert.equal(first.manifest.commit,A);assert.equal(hash((await client.bundle(c)).payload),hash(first.payload));assert.equal(builds,1);
 const path=join(state,'local-artifacts',A+'-10','release.tar');await writeFile(path,'damaged');await assert.rejects(client.bundle(c));assert.equal(builds,1);
 await rm(join(state,'local-artifacts',A+'-10','release.json'));await assert.rejects(client.bundle(c),/LOCAL_ARTIFACT_INCOMPLETE/);assert.equal(builds,1);
});
test('no-follow bounded output read rejects links, writable/special modes, oversized and foreign files',async t=>{
 const root=await fixture(t),file=join(root,'result');await writeFile(file,'exact',{mode:0o600});const opts={uid:process.getuid(),limit:5};assert.equal((await readLocalOutput(file,opts)).toString(),'exact');
 await assert.rejects(readLocalOutput(file,{...opts,limit:4}),/LOCAL_OUTPUT_UNSAFE/);await assert.rejects(readLocalOutput(file,{...opts,uid:opts.uid+1}),/LOCAL_OUTPUT_UNSAFE/);await chmod(file,0o666);await assert.rejects(readLocalOutput(file,opts),/LOCAL_OUTPUT_UNSAFE/);await chmod(file,0o600);const link=join(root,'link');await symlink(file,link);await assert.rejects(readLocalOutput(link,opts));
});
test('failed local build never switches/restarts or retries the same SHA on the next poll',async t=>{
 const root=await fixture(t),state=join(root,'state');await mkdir(state);let builds=0,restarts=0;const client=localSourceClient({state,discover:async()=>B,policy:async()=>H,build:async()=>{builds++;throw Error('LOCAL_BUILD_TEST_FAILED');},clock:()=>10,trust});
 const ops={current:async c=>c==='web'?A:null,service:async()=> 'active',preflight:async()=>{},restart:async()=>{restarts++;},health:async()=>{}};
 const first=await reconcile({root,state,config,github:client,ops});assert.equal(first.state,'FAILED');assert.equal(first.reason,'LOCAL_BUILD_TEST_FAILED');assert.equal(first.current,A);await reconcile({root,state,config,github:client,ops});assert.equal(builds,1);assert.equal(restarts,0);assert.equal((await json(join(state,'transaction.json'))).terminal,true);
 const c=await client.candidate(config);await assert.rejects(client.bundle(c),/LOCAL_BUILD_CONSUMED/);assert.equal(builds,1);
});
test('local packing binds the real Git tree and refuses edits hidden with assume-unchanged',async t=>{
 const root=await fixture(t),source=join(root,'source');await mkdir(source);
 const put=async(name,bytes)=>{await mkdir(join(source,name,'..'),{recursive:true});await writeFile(join(source,name),bytes);};
 await put('.gitignore','node_modules/\n');await put('package.json',JSON.stringify({dependencies:{pg:'1.0.0'}}));await put('package-lock.json',JSON.stringify({lockfileVersion:3,packages:{'':{dependencies:{pg:'1.0.0'}},'node_modules/pg':{version:'1.0.0'}}}));
 await put('tools/production-web.mjs','// original');for(const name of new Set(Object.values(policyFiles).flat()))await put(name,'policy');
 const git=(...args)=>execFileSync('git',['-C',source,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});git('init','--quiet');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture');const commit=git('rev-parse','HEAD').trim();
 await put('node_modules/pg/package.json',JSON.stringify({name:'pg',version:'1.0.0'}));await put('node_modules/pg/index.js','module.exports={};');
 const options={root:source,output:join(root,'output'),commit,component:'web',runId:10,attempt:1,kind:'ATLAS_LOCAL_RELEASE',platform:'linux',arch:'arm64',nodeVersion:'24.18.0'};
 git('update-index','--assume-unchanged','tools/production-web.mjs');await put('tools/production-web.mjs','// hidden modification');assert.equal(git('diff','HEAD'),'');await assert.rejects(buildRelease(options));
 await put('tools/production-web.mjs','// original');await buildRelease(options);const manifest=await json(join(root,'output','release.json'));assert.equal(manifest.commit,commit);assert.equal(manifest.kind,'ATLAS_LOCAL_RELEASE');assert.equal(tarEntries(await readFile(join(root,'output','release.tar'))).find(e=>e.name==='tools/production-web.mjs').bytes.toString(),'// original');
});
