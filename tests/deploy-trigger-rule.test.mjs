import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,lstat,chmod,rm,symlink,link,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {checkTriggerRule} from '../tools/deploy/trigger-rule.mjs';
import {hash} from '../tools/deploy/files.mjs';
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'atlas-trigger-'));t.after(()=>rm(root,{recursive:true,force:true}));const path=join(root,'50-atlas-deploy.rules'),bytes=Buffer.from('// approved public policy');await writeFile(path,bytes,{mode:0o600});return {root,path,bytes,options:{path,expectedHash:hash(bytes),uid:process.getuid(),trust:async()=>{}}};}
test('repair CLI loads without an await cycle and refuses arbitrary arguments before operational access',()=>{
 const r=spawnSync(process.execPath,[fileURLToPath(new URL('../tools/deploy/trigger-rule-repair.mjs',import.meta.url)),'--unexpected-path'],{encoding:'utf8',timeout:3000});assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/TRIGGER_REPAIR_CONTEXT/);
});
test('only hash-pinned legacy private trigger mode is atomically repaired with identical bytes and ownership',async t=>{
 const f=await fixture(t),before=await lstat(f.path);await assert.rejects(checkTriggerRule(f.options),/NOT_READABLE/);
 const r=await checkTriggerRule({...f.options,repair:true});assert.equal(r.repaired,true);assert.equal(r.servicesChanged,0);const after=await lstat(f.path);assert.equal(after.mode&0o7777,0o644);assert.equal(after.uid,before.uid);assert.equal(after.gid,before.gid);assert.notEqual(after.ino,before.ino);assert.deepEqual(await readFile(f.path),f.bytes);
 assert.equal((await checkTriggerRule({...f.options,repair:true})).repaired,false);assert.equal((await lstat(f.path)).ino,after.ino);
});
test('trigger repair refuses wrong hashes, foreign owners and arbitrary modes without altering metadata',async t=>{
 const f=await fixture(t);for(const change of [{expectedHash:'a'.repeat(64)},{uid:process.getuid()+1}]){await assert.rejects(checkTriggerRule({...f.options,repair:true,...change}));assert.equal((await lstat(f.path)).mode&0o7777,0o600);assert.deepEqual(await readFile(f.path),f.bytes);}
 for(const mode of [0o400,0o640,0o666,0o700,0o4644]){await chmod(f.path,mode);await assert.rejects(checkTriggerRule({...f.options,repair:true}),/TRIGGER_RULE_UNSAFE/);assert.equal((await lstat(f.path)).mode&0o7777,mode);}
});
test('trigger repair rejects symlinks and hardlinks and never widens access to their targets',async t=>{
 const f=await fixture(t),alias=join(f.root,'alias');await symlink(f.path,alias);await assert.rejects(checkTriggerRule({...f.options,path:alias,repair:true}));assert.equal((await lstat(f.path)).mode&0o777,0o600);
 await unlink(alias);await link(f.path,alias);await assert.rejects(checkTriggerRule({...f.options,repair:true}),/UNSAFE/);assert.equal((await lstat(f.path)).mode&0o777,0o600);
});
