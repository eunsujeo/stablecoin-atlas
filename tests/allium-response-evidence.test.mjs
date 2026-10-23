import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,realpath,chmod,rm,readFile,writeFile,symlink,link,rename} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createResponseStore,responseStore,validateResponseEvidence} from '../tools/allium-response-evidence.mjs';
import {dailyHash} from '../tools/allium-daily-plan.mjs';
const blocked=p=>assert.rejects(p,/ALLIUM_DAILY_OFFLINE_BLOCKED/);
const fixtureHash=dailyHash('FAKE EPOCH'),organizationHash=dailyHash('FAKE ORG');
const metadata={reservationId:dailyHash('FAKE RESERVATION'),intentId:dailyHash('FAKE INTENT'),job:'supply',operation:'create',
 sendHead:{count:6,hash:dailyHash('FAKE SEND')},observedAt:'2026-10-23T02:00:00.000000Z'};
async function setup(t,fault){
 const root=await mkdtemp(join(await realpath(tmpdir()),'allium-response-'));await chmod(root,0o700);t.after(()=>rm(root,{recursive:true,force:true}));
 const path=join(root,'responses'),config=await createResponseStore(path,{fixtureHash,organizationHash});
 return {root,path,config,store:await responseStore(path,{...config,fault})};
}
test('response evidence preserves exact bytes, original timestamp and independently supplied immutable reference',async t=>{
 const s=await setup(t),raw=Buffer.from(' { "state": "OK", "text": "가상" }\n'),ref=await s.store.preserve(metadata,raw);raw.fill(0);
 const reopened=await responseStore(s.path,s.config),r=await reopened.read(ref);
 assert.equal(Buffer.from(r.rawBase64,'base64').toString(),' { "state": "OK", "text": "가상" }\n');
 assert.equal(r.rawHash,dailyHash(Buffer.from(r.rawBase64,'base64')));assert.equal(r.observedAt,metadata.observedAt);
 await blocked(responseStore(s.path,{identity:s.config.identity}));await blocked(reopened.read({...ref,recordHash:'../manifest'}));
 await blocked(responseStore(s.path,{...s.config,identity:{...s.config.identity,fixtureHash:dailyHash('OTHER')}}));
});
for(const point of ['record-write','file-sync','directory-sync','response-ack'])test('response '+point+' failure returns no ACK, preserves bytes and poisons writer',async t=>{
 const s=await setup(t,async where=>{if(where===point)throw Error('SIMULATED_FAILURE');});
 await blocked(s.store.preserve(metadata,Buffer.from('{')));await blocked(s.store.preserve(metadata,Buffer.from('retry')));
 const {readdir}=await import('node:fs/promises'),names=await readdir(s.path);assert.equal(names.length,2);
 const name=names.find(n=>n!=='manifest.json'),saved=JSON.parse(await readFile(join(s.path,name),'utf8'));
 await blocked(s.store.read({storeHash:s.config.trustedStoreHash,recordHash:dailyHash(saved)}));
 // Explicit harness review retains the reference; reopen only reads/re-syncs and never resends.
 const reviewed=await responseStore(s.path,s.config);assert.equal((await reviewed.read({storeHash:s.config.trustedStoreHash,recordHash:dailyHash(saved)})).rawLength,1);
});
test('response files reject partial bytes, unsafe permissions, symlinks, hard links and directory replacement',async t=>{
 for(const mode of ['partial','permissions','symlink','hardlink','replacement']){
  const s=await setup(t),ref=await s.store.preserve(metadata,Buffer.from('FAKE')),path=join(s.path,ref.recordHash+'.json');
  if(mode==='partial')await writeFile(path,'{');
  if(mode==='permissions')await chmod(path,0o644);
  if(mode==='symlink'){await rename(path,join(s.root,'saved'));await symlink(join(s.root,'saved'),path);}
  if(mode==='hardlink')await link(path,join(s.root,'hardlink'));
  if(mode==='replacement'){await rename(s.path,join(s.root,'old'));await createResponseStore(s.path,{fixtureHash,organizationHash});}
  await blocked(s.store.read(ref));
 }
});
test('response validates raw length/hash/base64 and metadata before publishing; read fsync failures block',async t=>{
 const s=await setup(t),ref=await s.store.preserve(metadata,Buffer.from('FAKE')),r=await s.store.read(ref);
 for(const patch of [{rawLength:1},{rawHash:dailyHash('OTHER')},{rawBase64:r.rawBase64+'='},{rawLength:2097153},{job:'other'},{sendHead:{count:0,hash:r.rawHash}}])
  assert.throws(()=>validateResponseEvidence({...r,...patch}),/ALLIUM_DAILY_OFFLINE_BLOCKED/);
 for(const point of ['read-file-sync','read-directory-sync']){
  const q=await responseStore(s.path,{...s.config,fault:async p=>{if(p===point)throw Error('SIMULATED_FAILURE');}});await blocked(q.read(ref));
 }
 const alias=join(s.root,'alias');await symlink(s.path,alias);await blocked(responseStore(alias,s.config));
});
