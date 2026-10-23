import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,chmod,symlink,readFile,writeFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createCheckpointStore,checkpointPublisher} from '../tools/allium-checkpoint.mjs';
import {dailyHash} from '../tools/allium-daily-plan.mjs';
import {canonical} from '../tools/market-db/plan.mjs';
const blocked=p=>assert.rejects(p,/ALLIUM_DAILY_OFFLINE_BLOCKED/),exec=promisify(execFile);
const fixtureHash=dailyHash('FAKE DB EPOCH'),organizationHash=dailyHash('FAKE ORGANIZATION');
const h=n=>({count:n,hash:dailyHash('FAKE LEDGER HEAD '+n)});
async function store(t){
 const root=await mkdtemp(join(await realpath(tmpdir()),'allium-checkpoint-'));await chmod(root,0o700);
 t.after(()=>rm(root,{recursive:true,force:true}));const path=join(root,'checkpoint');
 const setup=await createCheckpointStore(path,{fixtureHash,organizationHash});return {root,path,...setup};
}
test('checkpoint immutable durable chain, expected-head CAS, duplicate confirmation and independent restart trust',async t=>{
 const s=await store(t),p=await checkpointPublisher(s.path,s);t.after(()=>p.close().catch(()=>{}));
 const first=await p.publish(h(1),s.trusted);assert.equal(first.duplicate,false);
 const duplicate=await p.publish(h(1),first.trusted);assert.equal(duplicate.duplicate,true);assert.deepEqual(duplicate.trusted,first.trusted);
 await p.close();const q=await checkpointPublisher(s.path,{...s,trusted:first.trusted});t.after(()=>q.close().catch(()=>{}));
 assert.deepEqual((await q.inspect()).checkpoint,h(1));await q.withGate(check=>check(h(1)));
 await blocked(q.publish(h(2),s.trusted));await blocked(q.inspect());
});
test('checkpoint publisher exclusive claim is enforced in another process; pinned gate refuses close and publish',async t=>{
 const s=await store(t),p=await checkpointPublisher(s.path,s);t.after(()=>p.close().catch(()=>{}));
 const source=`import {checkpointPublisher} from './tools/allium-checkpoint.mjs';
 try{await checkpointPublisher(process.env.FIXTURE_CHECKPOINT_PATH,JSON.parse(process.env.FIXTURE_CHECKPOINT_SETUP));console.log('CLAIMED');}catch{console.log('BLOCKED');}`;
 assert.equal((await exec(process.execPath,['--input-type=module','-e',source],{env:{...process.env,FIXTURE_CHECKPOINT_PATH:s.path,FIXTURE_CHECKPOINT_SETUP:JSON.stringify(s)},timeout:20000})).stdout.trim(),'BLOCKED');
 await p.withGate(async check=>{await blocked(p.close());await blocked(p.publish(h(1),s.trusted));await check({count:0,hash:'0'.repeat(64)});});
 await p.publish(h(1),s.trusted);
});
for(const point of ['record-write','file-sync','directory-sync','publication-ack'])test('checkpoint '+point+' failure retains evidence, crash lock and blocks gate/rearm',async t=>{
 const s=await store(t),p=await checkpointPublisher(s.path,{...s,fault:async where=>{if(where===point)throw Error('FAKE FAILURE');}});
 await blocked(p.publish(h(1),s.trusted));await blocked(p.withGate(()=>assert.fail('send')));await p.close();
 assert.ok((await readFile(join(s.path,'publisher.lock'),'utf8')).length);await blocked(checkpointPublisher(s.path,s));
 // Explicit test-harness recovery of a NEW owned fixture: never an API crash-lock reclaim.
 await unlink(join(s.path,'publisher.lock'));const q=await checkpointPublisher(s.path,s);t.after(()=>q.close().catch(()=>{}));
 assert.deepEqual((await q.inspect()).checkpoint,h(1)); // Read confirmation confers no intent handle.
});
test('checkpoint rejects absent external trust, changed identity, symlink paths, permissions and partial records',async t=>{
 const s=await store(t);await blocked(checkpointPublisher(s.path,{identity:s.identity}));
 await blocked(checkpointPublisher(s.path,{...s,identity:{...s.identity,organizationHash:dailyHash('OTHER')}}));
 // Failed opening preserves its acquired lock; harness clears it only to test independent invalid inputs.
 await unlink(join(s.path,'publisher.lock'));
 const alias=join(s.root,'alias');await symlink(s.path,alias);await blocked(checkpointPublisher(alias,s));
 await chmod(s.path,0o755);await blocked(checkpointPublisher(s.path,s));await chmod(s.path,0o700);
 await writeFile(join(s.path,'00000001.json'),'{', {mode:0o600});await blocked(checkpointPublisher(s.path,s));
});
test('checkpoint rollback and same-sequence branch require separately retained latest trusted head',async t=>{
 const s=await store(t),p=await checkpointPublisher(s.path,s),r=await p.publish(h(1),s.trusted);await p.close();
 const path=join(s.path,'00000001.json'),bytes=await readFile(path,'utf8');
 await unlink(path);await blocked(checkpointPublisher(s.path,{...s,trusted:r.trusted}));await unlink(join(s.path,'publisher.lock'));
 const branch=JSON.parse(bytes);branch.checkpoint=h(2);await writeFile(path,canonical(branch),{mode:0o600});
 await blocked(checkpointPublisher(s.path,{...s,trusted:r.trusted}));
});
test('checkpoint stale publisher fence cannot proceed after an explicit fixture lock replacement',async t=>{
 const s=await store(t),p=await checkpointPublisher(s.path,s);t.after(()=>p.close().catch(()=>{}));
 await unlink(join(s.path,'publisher.lock'));const q=await checkpointPublisher(s.path,s);t.after(()=>q.close().catch(()=>{}));
 await blocked(p.publish(h(1),s.trusted));await q.publish(h(1),s.trusted);
});
