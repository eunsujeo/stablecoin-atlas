import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,rm,readlink,chmod,mkdir,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {bootstrapFixture,fixtureTrust,testBundle,commit} from './deploy-bootstrap-fixture.mjs';
import {publishBootstrapInstall,recoverBootstrapInstall,controlTreeHash} from '../tools/deploy/bootstrap-install.mjs';
import {bootstrapLease} from '../tools/deploy/bootstrap-lease.mjs';
import {stageVerified} from '../tools/deploy/stage.mjs';
import {json} from '../tools/deploy/files.mjs';
const exists=async path=>{try{await lstat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
async function fixture(t,options){const f=await bootstrapFixture(options);t.after(()=>rm(f.prefix,{recursive:true,force:true}));return f;}
async function pointers(f){return Promise.all(['current','collector-current','usage-current'].map(name=>readlink(join(f.layout.root,name))));}
async function metadata(path){const s=await lstat(path);return {uid:s.uid,gid:s.gid,mode:s.mode};}

test('legacy partial install with valid staged CI release and no receipt completes without altering pointers or existing metadata',async t=>{
 const f=await fixture(t),links=await pointers(f),manual=join(f.layout.bin,'atlas-release'),before=await metadata(manual),manifest=join(f.layout.root,'releases',commit,'ATLAS_RELEASE.json'),stored=await readFile(manifest);let reloads=0;
 const result=await publishBootstrapInstall({...await f.options(),reload:async()=>{reloads++;}});assert.equal(result.state,'INSTALLED_DISABLED');assert.equal(result.productionServicesChanged,0);assert.equal(reloads,1);assert.equal((await json(f.layout.receipt)).commit,commit);assert.equal((await json(join(f.layout.state,'bootstrap-install.json'))).phase,'COMMITTED');assert.deepEqual(await readFile(manifest),stored);assert.deepEqual(await pointers(f),links);assert.deepEqual(await metadata(manual),before);
 assert.equal((await lstat(join(f.layout.unitDir,'atlas-deploy-agent.service'))).mode&0o777,0o640);assert.equal(await readFile(join(f.layout.install,'new-control.mjs'),'utf8'),'NEW_CONTROL');
 const j=await json(join(f.layout.state,'bootstrap-install.json'));assert.equal(await readFile(join(j.previous,'old-control.mjs'),'utf8'),'OLD_CONTROL');assert.equal(await readFile(join(j.backups,'0'),'utf8'),'OLD_HELPER');
});

test('failure at each pre-commit boundary restores old control/config/helper state and preserves staged CI data',async t=>{
 for(const phase of ['PREPARED','FILES_WRITTEN','SWAPPING','OLD_MOVED','PUBLISHED']){
  const f=await fixture(t,{receipt:true}),before=await controlTreeHash(f.layout.install),links=await pointers(f),manual=join(f.layout.bin,'atlas-release'),mode=await metadata(manual),release=await readFile(join(f.layout.root,'releases',commit,'ATLAS_RELEASE.json'));
  await assert.rejects(publishBootstrapInstall({...await f.options(),onPhase:async value=>{if(value===phase)throw Error('INJECTED_FAILURE');}}),/INJECTED_FAILURE/);
  assert.equal(await controlTreeHash(f.layout.install),before);assert.equal(await readFile(f.layout.config,'utf8'),'ORIGINAL_CONFIG');assert.equal(await readFile(f.layout.receipt,'utf8'),'ORIGINAL_RECEIPT');assert.equal(await readFile(manual,'utf8'),'OLD_HELPER');assert.deepEqual(await metadata(manual),mode);assert.equal(await exists(join(f.layout.bin,'atlas-deploy-admin')),false);assert.equal(await exists(join(f.layout.unitDir,'atlas-fx.service.d/90-atlas-deploy-barrier.conf')),false);assert.deepEqual(await pointers(f),links);assert.deepEqual(await readFile(join(f.layout.root,'releases',commit,'ATLAS_RELEASE.json')),release);assert.equal((await json(join(f.layout.state,'bootstrap-install.json'))).phase,'ROLLED_BACK');
 }
});

test('reload and post-reload validation errors roll back without fabricating a control-plane receipt',async t=>{
 const f=await fixture(t);let calls=0;
 await assert.rejects(publishBootstrapInstall({...await f.options(),reload:async()=>{if(++calls===1)throw Error('RELOAD_FAILED');}}),/RELOAD_FAILED/);assert.equal(await exists(f.layout.receipt),false);assert.equal(calls,2);assert.equal(await readFile(f.layout.config,'utf8'),'ORIGINAL_CONFIG');
 await assert.rejects(publishBootstrapInstall({...await f.options(),beforeReceipt:async()=>{throw Error('UNIT_PATH_CHANGED');}}),/UNIT_PATH_CHANGED/);assert.equal(await exists(f.layout.receipt),false);
 assert.equal((await publishBootstrapInstall(await f.options())).state,'INSTALLED_DISABLED');
});

test('receipt is the final commit marker; failure after it preserves completed state and existing file modes',async t=>{
 const f=await fixture(t,{receipt:true});await chmod(f.layout.config,0o400);const before=await metadata(f.layout.config);
 const result=await publishBootstrapInstall({...await f.options(),onPhase:async phase=>{if(phase==='RECEIPT_WRITTEN')throw Error('ACK_LOST');}});assert.equal(result.state,'INSTALLED_DISABLED');assert.equal(result.recovered,true);assert.equal((await recoverBootstrapInstall(f)).state,'COMMITTED');assert.deepEqual(await metadata(f.layout.config),before);assert.equal(await readFile(f.layout.config,'utf8'),'NEW_CONFIG');
});

test('a failed first install restores absence of the original control directory while keeping the CI release',async t=>{
 const f=await fixture(t,{install:false});await assert.rejects(publishBootstrapInstall({...await f.options(),onPhase:async phase=>{if(phase==='PUBLISHED')throw Error('FAIL');}}),/FAIL/);assert.equal(await exists(f.layout.install),false);assert.equal(await exists(f.layout.receipt),false);assert(await exists(join(f.layout.root,'releases',commit,'ATLAS_RELEASE.json')));assert.equal((await publishBootstrapInstall(await f.options())).state,'INSTALLED_DISABLED');
});

test('identical old/new code trees restore the original directory identity on rollback',async t=>{
 const f=await fixture(t),options=await f.options(),before=await lstat(f.layout.install);await rm(join(options.next,'new-control.mjs'));await writeFile(join(options.next,'old-control.mjs'),'OLD_CONTROL',{mode:0o644});
 await assert.rejects(publishBootstrapInstall({...options,onPhase:async p=>{if(p==='PUBLISHED')throw Error('FAIL');}}),/FAIL/);assert.equal((await lstat(f.layout.install)).ino,before.ino);assert.equal(await exists(f.layout.receipt),false);
});

test('large previous receipts can be verified and restored from private backups within the original limit',async t=>{
 const f=await fixture(t,{receipt:true}),bytes=Buffer.from(JSON.stringify({inventory:'r'.repeat(300000)}));await writeFile(f.layout.receipt,bytes);
 await assert.rejects(publishBootstrapInstall({...await f.options(),onPhase:async p=>{if(p==='PUBLISHED')throw Error('FAIL');}}),/FAIL/);assert.deepEqual(await readFile(f.layout.receipt),bytes);assert.equal((await json(join(f.layout.state,'bootstrap-install.json'))).phase,'ROLLED_BACK');
});

test('unknown edits, permission drift and corrupt backups block recovery without clobbering operator state',async t=>{
 for(const kind of ['file','mode','backup','tree']){
  const f=await fixture(t,{receipt:true});let changed;
  await assert.rejects(publishBootstrapInstall({...await f.options(),onPhase:async(phase,j)=>{if(phase==='PUBLISHED'){
   if(kind==='file'){changed=join(f.layout.bin,'atlas-release');await writeFile(changed,'OPERATOR_EDIT');}
   if(kind==='mode'){changed=join(f.layout.bin,'atlas-release');await chmod(changed,0o700);}
   if(kind==='backup'){changed=join(j.backups,'0');await writeFile(changed,'DAMAGED_BACKUP');}
   if(kind==='tree'){changed=join(f.layout.install,'new-control.mjs');await writeFile(changed,'OPERATOR_TREE');}
   throw Error('FAIL');
  }}}),/BOOTSTRAP_RECOVERY_BLOCKED/);
  assert.equal((await json(join(f.layout.state,'bootstrap-install.json'))).phase,'RECOVERY_BLOCKED');assert.equal(await exists(f.layout.receipt),true);assert.equal(await readFile(f.layout.receipt,'utf8'),'ORIGINAL_RECEIPT');
  if(kind==='file')assert.equal(await readFile(changed,'utf8'),'OPERATOR_EDIT');if(kind==='mode')assert.equal((await lstat(changed)).mode&0o777,0o700);if(kind==='backup')assert.equal(await readFile(changed,'utf8'),'DAMAGED_BACKUP');if(kind==='tree')assert.equal(await readFile(changed,'utf8'),'OPERATOR_TREE');
 }
});

test('malformed journal targets cannot redirect recovery outside the approved install targets',async t=>{
 const f=await fixture(t),options=await f.options();let interrupted=false;
 await assert.rejects(publishBootstrapInstall({...options,onPhase:async(p,j)=>{if(p==='PUBLISHED'){interrupted=true;await writeFile(join(f.layout.bin,'atlas-release'),'OPERATOR_EDIT');throw Error('FAIL');}}}),/RECOVERY_BLOCKED/);assert(interrupted);
 const path=join(f.layout.state,'bootstrap-install.json'),j=await json(path);j.files[0].path=join(f.prefix,'outside-target');await writeFile(path,JSON.stringify(j));await assert.rejects(recoverBootstrapInstall(f),/JOURNAL_INVALID/);assert.equal(await readFile(join(f.layout.bin,'atlas-release'),'utf8'),'OPERATOR_EDIT');assert.equal(await exists(join(f.prefix,'outside-target')),false);
});

test('a replacement symlink is refused before install writes and backups remain private',async t=>{
 const f=await fixture(t),outside=join(f.prefix,'outside-file'),manual=join(f.layout.bin,'atlas-release');await writeFile(outside,'DO_NOT_TOUCH');await rm(manual);await symlink(outside,manual);
 await assert.rejects(publishBootstrapInstall(await f.options()),/PATH_UNTRUSTED/);assert.equal(await readFile(outside,'utf8'),'DO_NOT_TOUCH');assert.equal(await exists(f.layout.receipt),false);assert.equal(await exists(join(f.layout.state,'bootstrap-install.json')),false);
});

test('custom existing unit content is never overwritten even if changed after the first plan',async t=>{
 const f=await fixture(t),path=join(f.layout.unitDir,'atlas-deploy-agent.service');await writeFile(path,'CUSTOM_UNIT');await assert.rejects(publishBootstrapInstall(await f.options()),/EXISTING_UNIT_CONFLICT/);assert.equal(await readFile(path,'utf8'),'CUSTOM_UNIT');assert.equal(await readFile(join(f.layout.install,'old-control.mjs'),'utf8'),'OLD_CONTROL');assert.equal(await exists(f.layout.receipt),false);
});

test('real process exits before/after the receipt recover deterministically and retry does not re-stage verified releases',async t=>{
 for(const phase of ['FILES_WRITTEN','OLD_MOVED','PUBLISHED','RECEIPT_WRITTEN']){
  const f=await fixture(t),options=await f.options(),manifest=join(f.layout.root,'releases',commit,'ATLAS_RELEASE.json'),before=await readFile(manifest),beforeMeta=await metadata(manifest),links=await pointers(f);
  const request={...options,trust:undefined,files:options.files.map(x=>({...x,bytes:x.bytes.toString('base64')}))};
  const script=`import {publishBootstrapInstall} from ${JSON.stringify(new URL('../tools/deploy/bootstrap-install.mjs',import.meta.url).href)};import {fixtureTrust} from ${JSON.stringify(new URL('./deploy-bootstrap-fixture.mjs',import.meta.url).href)};const o=JSON.parse(process.argv[1]);o.trust=fixtureTrust(process.argv[2]);o.files=o.files.map(f=>({...f,bytes:Buffer.from(f.bytes,'base64')}));o.onPhase=async p=>{if(p===process.argv[3])process.exit(42);};await publishBootstrapInstall(o);`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script,JSON.stringify(request),f.prefix,phase],{encoding:'utf8',timeout:10000});assert.equal(child.status,42,child.stderr);
  assert.equal((await recoverBootstrapInstall(f)).state,phase==='RECEIPT_WRITTEN'?'COMMITTED':'ROLLED_BACK');assert.deepEqual(await pointers(f),links);assert.deepEqual(await readFile(manifest),before);assert.deepEqual(await metadata(manifest),beforeMeta);
  assert.equal((await stageVerified(f.layout.root,commit,f.bundle)).reused,true);assert.equal((await publishBootstrapInstall(await f.options())).state,'INSTALLED_DISABLED');
 }
});

test('staged release reuse re-hashes actual files and preserves original run metadata across attempts/components',async t=>{
 const f=await fixture(t),path=join(f.layout.root,'releases',commit),marker=join(path,'ATLAS_RELEASE.json'),original=await readFile(marker);assert.equal((await stageVerified(f.layout.root,commit,testBundle({attempt:2,component:'collector'}))).reused,true);assert.deepEqual(await readFile(marker),original);
 await writeFile(join(path,'tools/production-web.mjs'),'CORRUPTED');await assert.rejects(stageVerified(f.layout.root,commit,f.bundle),/RELEASE_CONFLICT/);assert.equal(await readFile(join(path,'tools/production-web.mjs'),'utf8'),'CORRUPTED');
});

test('staged release extra files/directories, symlinks and unsafe modes remain intact and are rejected',async t=>{
 for(const kind of ['extra','directory','symlink','mode','marker']){const f=await fixture(t),root=join(f.layout.root,'releases',commit),file=join(root,'tools/production-web.mjs');
  if(kind==='extra')await writeFile(join(root,'__proto__'),'unexpected');if(kind==='directory')await mkdir(join(root,'unexpected'));if(kind==='symlink'){await rm(file);await symlink('/etc/passwd',file);}if(kind==='mode')await chmod(file,0o666);if(kind==='marker'){await rm(join(root,'ATLAS_RELEASE.json'));await symlink('/etc/passwd',join(root,'ATLAS_RELEASE.json'));}
  await assert.rejects(stageVerified(f.layout.root,commit,f.bundle),/RELEASE_(?:INVALID|CONFLICT)/);assert(await exists(root));
 }
});

test('bootstrap kernel lease survives helper exit and is released by Node owner crash without stale PID cleanup',async t=>{
 const f=await fixture(t);
 const options={trust:f.trust};
 const python='import fcntl,sys\ntry: fcntl.flock(3,fcntl.LOCK_EX|fcntl.LOCK_NB)\nexcept BlockingIOError: sys.exit(73)\nprint("LOCKED",flush=True)';
 if(process.platform!=='linux')options.spawnLease=(command,args,stdio)=>{assert.equal(command,'/usr/bin/bash');assert(args[1].includes('/usr/bin/flock -n 3'));return spawn('python3',['-c',python],stdio);};
 const first=await bootstrapLease(f.layout.state,options);t.after(()=>first.release());await assert.rejects(bootstrapLease(f.layout.state,options),/BOOTSTRAP_BUSY/);await first.release();
 const code=`import {bootstrapLease} from ${JSON.stringify(new URL('../tools/deploy/bootstrap-lease.mjs',import.meta.url).href)};import {fixtureTrust} from ${JSON.stringify(new URL('./deploy-bootstrap-fixture.mjs',import.meta.url).href)};import {spawn} from 'node:child_process';const options={trust:fixtureTrust(process.argv[1])};if(process.platform!=='linux')options.spawnLease=(_c,_a,o)=>spawn('python3',['-c',${JSON.stringify(python)}],o);const lease=await bootstrapLease(process.argv[2],options);console.log('OWNER_READY');process.stdin.resume();`;
 const owner=spawn(process.execPath,['--input-type=module','-e',code,f.prefix,f.layout.state],{stdio:['pipe','pipe','pipe']});t.after(()=>owner.kill('SIGTERM'));await new Promise((resolve,reject)=>{owner.once('error',reject);owner.stdout.once('data',b=>String(b).includes('OWNER_READY')?resolve():reject(Error('NO_OWNER')));});await assert.rejects(bootstrapLease(f.layout.state,options),/BOOTSTRAP_BUSY/);
 const exited=new Promise(r=>owner.once('exit',r));owner.kill('SIGKILL');await exited;const next=await bootstrapLease(f.layout.state,options);await next.release();assert.equal((await lstat(join(f.layout.state,'bootstrap-install.flock'))).mode&0o777,0o600);
});
