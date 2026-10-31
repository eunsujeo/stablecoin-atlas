import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,chmod,lstat,readFile,symlink,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {extractRelease,packEntries} from '../tools/deploy/archive.mjs';
import {ensureProbeDirectory} from '../tools/deploy/probe-directory.mjs';

async function fixture(t){const root=await mkdtemp(join(tmpdir(),'atlas-extract-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
test('root wrapper umask 077 leaves every extracted runtime directory traversable and exact file modes',async t=>{
 const root=await fixture(t),target=join(root,'next'),url=new URL('../tools/deploy/archive.mjs',import.meta.url).href;
 const script=`import {extractRelease,packEntries} from ${JSON.stringify(url)};process.umask(0o077);await extractRelease(packEntries([
 {name:'tools/deploy/probe.mjs',bytes:Buffer.from("import pg from '../../node_modules/pg/index.mjs';export default pg;"),mode:0o644},
 {name:'node_modules/pg/index.mjs',bytes:Buffer.from('export default "MODULE_READY";'),mode:0o644},
 {name:'deploy/helper',bytes:Buffer.from('#!/bin/sh\\n'),mode:0o755}
 ]),process.argv[1]);`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',script,target],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 for(const name of ['','tools','tools/deploy','node_modules','node_modules/pg','deploy'])assert.equal((await lstat(join(target,name))).mode&0o7777,0o755,name);
 assert.equal((await lstat(join(target,'tools/deploy/probe.mjs'))).mode&0o7777,0o644);
 assert.equal((await lstat(join(target,'deploy/helper'))).mode&0o7777,0o755);
 const {pathToFileURL}=await import('node:url');assert.equal((await import(pathToFileURL(join(target,'tools/deploy/probe.mjs')).href)).default,'MODULE_READY');
});
test('extraction refuses symlinked or writable directories without touching their targets',async t=>{
 const root=await fixture(t),outside=join(root,'outside');await mkdir(outside,{mode:0o700});
 for(const kind of ['symlink','writable']){
  const target=join(root,kind);await mkdir(target);const nested=join(target,'node_modules');
  if(kind==='symlink')await symlink(outside,nested);else{await mkdir(nested);await chmod(nested,0o777);}
  await assert.rejects(extractRelease(packEntries([{name:'node_modules/pg/index.mjs',bytes:Buffer.from('x')}]),target),/EXTRACT_DIRECTORY_UNSAFE/);
  assert.equal((await lstat(outside)).mode&0o7777,0o700);await assert.rejects(readFile(join(outside,'pg/index.mjs')),{code:'ENOENT'});
 }
 const alias=join(root,'alias');await symlink(outside,alias);
 await assert.rejects(extractRelease(packEntries([{name:'x',bytes:Buffer.from('x')}]),alias),/EXTRACT_DIRECTORY_UNSAFE/);
 assert.equal((await lstat(outside)).mode&0o7777,0o700);
});
test('probe parent is 0711 under umask 077 and exact legacy 0700 is repaired without exposing reader bytes',async t=>{
 const root=await fixture(t),path=join(root,'probes'),url=new URL('../tools/deploy/probe-directory.mjs',import.meta.url).href;
 const script=`import {ensureProbeDirectory} from ${JSON.stringify(url)};process.umask(0o077);await ensureProbeDirectory({path:process.argv[1],uid:process.getuid(),trust:async()=>{}});`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',script,path],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal((await lstat(path)).mode&0o7777,0o711);
 const privateDir=join(path,'probe-test'),env=join(privateDir,'reader.env');await mkdir(privateDir,{mode:0o700});await writeFile(env,'PRIVATE_SENTINEL',{mode:0o600});
 await chmod(path,0o700);const trust=async p=>{assert.ok(p===root||p===path);const s=await lstat(p);assert.ok(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o022));};
 for(let i=0;i<2;i++)await ensureProbeDirectory({path,uid:process.getuid(),trust});
 assert.equal((await lstat(path)).mode&0o7777,0o711);assert.equal((await lstat(privateDir)).mode&0o7777,0o700);assert.equal((await lstat(env)).mode&0o7777,0o600);assert.equal(await readFile(env,'utf8'),'PRIVATE_SENTINEL');
});
test('probe parent refuses links, arbitrary modes and foreign ownership without chmod',async t=>{
 const root=await fixture(t),uid=process.getuid(),trust=async()=>{};
 const outside=join(root,'outside');await mkdir(outside,{mode:0o700});const alias=join(root,'alias');await symlink(outside,alias);await assert.rejects(ensureProbeDirectory({path:alias,uid,trust}));assert.equal((await lstat(outside)).mode&0o7777,0o700);
 for(const mode of [0o755,0o777,0o1711]){const path=join(root,'mode-'+mode);await mkdir(path);await chmod(path,mode);await assert.rejects(ensureProbeDirectory({path,uid,trust}),/PROBE_DIRECTORY_UNSAFE/);assert.equal((await lstat(path)).mode&0o7777,mode);}
 await assert.rejects(ensureProbeDirectory({path:outside,uid:uid+1,trust}),/PROBE_DIRECTORY_UNSAFE/);assert.equal((await lstat(outside)).mode&0o7777,0o700);
});
