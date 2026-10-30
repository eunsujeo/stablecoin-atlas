import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readdir,chmod,symlink,rm,lstat,truncate,link,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {artifactCache,artifactLimit} from '../tools/deploy/artifact-cache.mjs';
import {hash} from '../tools/deploy/files.mjs';

async function fixture(t){const root=await mkdtemp(join(process.cwd(),'.state/cache-fixture-'));t.after(()=>rm(root,{recursive:true,force:true}));return {root,directory:join(root,'artifacts'),cache:artifactCache(join(root,'artifacts'))};}
test('complete hash-bound cache survives new clients, contains no URL and ignores interrupted publication files',async t=>{
 const f=await fixture(t),bytes=Buffer.from('VERIFIED_ZIP_FIXTURE'),digest=hash(bytes);assert.equal(await f.cache.get(digest),null);assert.equal(await f.cache.put(digest,bytes),true);
 assert.deepEqual(await artifactCache(f.directory).get(digest),bytes);assert.equal((await lstat(f.directory)).mode&0o777,0o700);assert.equal((await lstat(join(f.directory,digest+'.zip'))).mode&0o777,0o600);
 await writeFile(join(f.directory,'incomplete.partial'),'PARTIAL',{mode:0o600});assert.equal(await f.cache.get(hash(Buffer.from('PARTIAL'))),null);assert.deepEqual((await readdir(f.directory)).sort(),[digest+'.zip','incomplete.partial'].sort());
});
test('cache rejects corruption, oversize, unsafe permissions and symlinked paths rather than trusting disk',async t=>{
 const f=await fixture(t),bytes=Buffer.from('VALID'),digest=hash(bytes);await f.cache.put(digest,bytes);const path=join(f.directory,digest+'.zip');
 await writeFile(path,'BAD');await assert.rejects(f.cache.get(digest),/INVALID/);await writeFile(path,bytes);await chmod(path,0o666);await assert.rejects(f.cache.get(digest),/UNSAFE/);await chmod(path,0o600);
 await link(path,path+'.link');await assert.rejects(f.cache.get(digest),/UNSAFE/);await unlink(path+'.link');await truncate(path,artifactLimit+1);await assert.rejects(f.cache.get(digest),/UNSAFE/);await writeFile(path,bytes);
 await assert.rejects(artifactCache(f.directory,{uid:process.getuid()+1}).get(digest),/UNSAFE/);
 await rm(path);await writeFile(join(f.root,'outside'),bytes,{mode:0o600});await symlink(join(f.root,'outside'),path);await assert.rejects(f.cache.get(digest),/UNSAFE/);
 await rm(path);await chmod(f.directory,0o770);await assert.rejects(f.cache.get(digest),/UNSAFE/);await chmod(f.directory,0o700);
 await assert.rejects(f.cache.put(digest,Buffer.alloc(artifactLimit+1)),/INVALID/);await assert.rejects(f.cache.put('0'.repeat(64),bytes),/INVALID/);
 const parent=join(f.root,'parent');await symlink(f.directory,parent);await assert.rejects(artifactCache(join(parent,'nested')).get(digest),/UNSAFE/);
});
test('missing protected parent leaves caching unavailable without creating operational state',async t=>{
 const f=await fixture(t),path=join(f.root,'missing','cache'),bytes=Buffer.from('VALID'),cache=artifactCache(path);assert.equal(await cache.get(hash(bytes)),null);assert.equal(await cache.put(hash(bytes),bytes),false);await assert.rejects(lstat(join(f.root,'missing')),e=>e.code==='ENOENT');
});
test('cache retains at most two completed digests and never caches mismatching or partial content',async t=>{
 const f=await fixture(t);for(let i=0;i<4;i++){const bytes=Buffer.from('VALID'+i);assert.equal(await f.cache.put(hash(bytes),bytes),true);}
 const names=await readdir(f.directory);assert.equal(names.filter(n=>n.endsWith('.zip')).length,2);assert(!names.some(n=>n.endsWith('.partial')));
 const bytes=Buffer.from('VALID3');assert.deepEqual(await f.cache.get(hash(bytes)),bytes);await assert.rejects(f.cache.put(hash(bytes),Buffer.from('VALID')),/INVALID/);
});
