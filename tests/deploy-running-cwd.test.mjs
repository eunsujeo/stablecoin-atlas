import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,symlink,rm,rename,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyRunningCwd} from '../tools/deploy/running-cwd.mjs';
const A='a'.repeat(40),B='b'.repeat(40);
async function fixture(t){const root=await realpath(await mkdtemp(join(tmpdir(),'atlas-cwd-')));t.after(()=>rm(root,{recursive:true,force:true}));const procRoot=join(root,'proc'),releaseRoot=join(root,'releases'),expected=join(releaseRoot,A);await mkdir(join(procRoot,'123'),{recursive:true});await mkdir(expected,{recursive:true});await symlink(expected,join(procRoot,'123/cwd'));return {procRoot,releaseRoot,expected};}
test('running version proves exact cwd and matching service UID without ptrace capability',async t=>{
 const f=await fixture(t);assert.deepEqual(await verifyRunningCwd('123',f.expected,f),{state:'READY'});
 await assert.rejects(verifyRunningCwd('123',join(f.releaseRoot,B),f),/RUNNING_VERSION_MISMATCH/);
 await assert.rejects(verifyRunningCwd('123',f.expected,{...f,uid:process.getuid()+1}),/RUNNING_OWNER_MISMATCH/);
 for(const pid of ['0','1','../123','123/x','-2'])await assert.rejects(verifyRunningCwd(pid,f.expected,f),/RUNNING_CONTEXT_INVALID/);
 for(const path of ['/tmp',f.expected+'/extra',join(f.releaseRoot,'../'+A)])await assert.rejects(verifyRunningCwd('123',path,f),/RUNNING_CONTEXT_INVALID/);
});
test('process directory symlinks and replacement during cwd resolution are rejected',async t=>{
 const f=await fixture(t);await symlink(join(f.procRoot,'123'),join(f.procRoot,'124'));await assert.rejects(verifyRunningCwd('124',f.expected,f),/RUNNING_OWNER_MISMATCH/);
 await assert.rejects(verifyRunningCwd('123',f.expected,{...f,resolve:async()=>{await rename(join(f.procRoot,'123'),join(f.procRoot,'old'));await mkdir(join(f.procRoot,'123'));return f.expected;}}),/RUNNING_PROCESS_CHANGED/);
});
