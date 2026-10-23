// Offline Fixture only. No environment, network, recovery CLI, or production activation path.
import {constants} from 'node:fs';
import {open,lstat,mkdir,readdir,unlink} from 'node:fs/promises';
import {resolve,parse,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {dailyHash,dailyFail,hashValue} from './allium-daily-plan.mjs';
import {canonical} from './market-db/plan.mjs';
const zero='0'.repeat(64),limit=8192;
const same=(a,b)=>canonical(a)===canonical(b);
const head=h=>h&&Object.keys(h).sort().join(',')==='count,hash'&&Number.isSafeInteger(h.count)&&h.count>=0&&h.count<=8192&&hashValue(h.hash)&&(h.count!==0||h.hash===zero);
const ref=r=>({sequence:r.sequence,hash:dailyHash(r)});
const filename=n=>String(n).padStart(8,'0')+'.json';
async function directory(path){
 const absolute=resolve(path);let current=parse(absolute).root;
 for(const part of absolute.slice(current.length).split('/').filter(Boolean)){
  current=join(current,part);const s=await lstat(current);
  // Ancestors may be system-owned/sticky (e.g. /tmp), but never symlinks or writable by strangers without sticky protection.
  if(!s.isDirectory()||s.isSymbolicLink()||![0,process.getuid()].includes(s.uid)||((s.mode&0o022)&&!(s.mode&0o1000)))dailyFail();
 }
 const s=await lstat(absolute);if(s.uid!==process.getuid()||(s.mode&0o777)!==0o700)dailyFail();return s;
}
async function file(path){
 const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const s=await f.stat();if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o777)!==0o600||s.nlink!==1||s.size>16384)dailyFail();return await f.readFile('utf8');}finally{await f.close();}
}
async function syncDir(path){const f=await open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{await f.sync();}finally{await f.close();}}
async function write(path,value,fault){
 const f=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{await f.writeFile(canonical(value));await fault('record-write');await f.sync();await fault('file-sync');}finally{await f.close();}
}
export async function createCheckpointStore(path,{fixtureHash,organizationHash}){
 try{
  if(![fixtureHash,organizationHash].every(hashValue))dailyFail();
  // Parent must already be a private, explicitly supplied owned Fixture directory.
  await directory(resolve(path,'..'));await mkdir(path,{mode:0o700});await directory(path);
  const genesis={schema:1,kind:'ALLIUM_OFFLINE_CHECKPOINT',fixtureHash,organizationHash,dbEpoch:fixtureHash,
   publisherEpoch:dailyHash(randomBytes(32)),sequence:0,publicationId:dailyHash(randomBytes(32)),previous:zero,
   checkpoint:{count:0,hash:zero}};
  await write(join(path,filename(0)),genesis,async()=>{});await syncDir(path);await syncDir(resolve(path,'..'));
  return {identity:{fixtureHash,organizationHash,dbEpoch:fixtureHash},trusted:ref(genesis)};
 }catch{dailyFail();}
}
export async function checkpointPublisher(path,{identity,trusted,fault=async()=>{}}){
 let lock,lockStat,poisoned=false,closed=false,busy=false;
 try{
  const root=await directory(path),binding=structuredClone(identity),anchor=structuredClone(trusted);
  if(!binding||Object.keys(binding).sort().join(',')!=='dbEpoch,fixtureHash,organizationHash'||!Object.values(binding).every(hashValue)||binding.dbEpoch!==binding.fixtureHash)dailyFail();
  if(!anchor||!Number.isSafeInteger(anchor.sequence)||anchor.sequence<0||!hashValue(anchor.hash))dailyFail();
  const token=dailyHash(randomBytes(32)),lockPath=join(path,'publisher.lock');
  lock=await open(lockPath,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  await lock.writeFile(token);await lock.sync();lockStat=await lock.stat();await syncDir(path);
  async function owned(){
   if(poisoned||closed)dailyFail();const s=await directory(path),l=await lstat(lockPath);
   if(s.dev!==root.dev||s.ino!==root.ino||l.dev!==lockStat.dev||l.ino!==lockStat.ino||await file(lockPath)!==token)dailyFail();
  }
  async function scan(){
   await owned();const names=(await readdir(path)).filter(n=>n!=='publisher.lock').sort();
   if(!names.length||names.length>limit||names.some((n,i)=>n!==filename(i)))dailyFail();
   let previous=zero,last,seen=false;
   for(const [i,n]of names.entries()){
    const bytes=await file(join(path,n)),r=JSON.parse(bytes);
    if(canonical(r)!==bytes||Object.keys(r).sort().join(',')!=='checkpoint,dbEpoch,fixtureHash,kind,organizationHash,previous,publicationId,publisherEpoch,schema,sequence'||
     r.schema!==1||r.kind!=='ALLIUM_OFFLINE_CHECKPOINT'||r.fixtureHash!==binding.fixtureHash||r.organizationHash!==binding.organizationHash||r.dbEpoch!==binding.dbEpoch||
     r.sequence!==i||r.previous!==previous||!head(r.checkpoint)||!hashValue(r.publicationId)||!hashValue(r.publisherEpoch)||
     (i===0&&r.checkpoint.count!==0)||(last&&r.checkpoint.count<=last.checkpoint.count))dailyFail();
    previous=dailyHash(r);if(i===anchor.sequence){if(previous!==anchor.hash)dailyFail();seen=true;}last=r;
   }
   if(!seen)dailyFail();return last;
  }
  let current=await scan();
  async function exclusive(fn){
   if(busy||poisoned||closed)dailyFail();busy=true;
   try{return await fn();}catch{poisoned=true;dailyFail();}finally{busy=false;}
  }
  return {
   identity:()=>structuredClone(binding),
   // A caller-held trusted head is never reconstructed from this directory.
   inspect:()=>exclusive(async()=>{current=await scan();return {trusted:ref(current),checkpoint:structuredClone(current.checkpoint),state:'SIMULATION_PUBLISHED'};}),
   publish:(checkpoint,expected)=>exclusive(async()=>{
    checkpoint=structuredClone(checkpoint);expected=structuredClone(expected);const latest=await scan();
    if(!same(ref(latest),expected)||!same(ref(latest),ref(current))||!head(checkpoint))dailyFail();
    if(same(checkpoint,latest.checkpoint))return {trusted:ref(latest),checkpoint:structuredClone(checkpoint),duplicate:true};
    if(checkpoint.count<=latest.checkpoint.count||latest.sequence+1>=limit)dailyFail();
    const r={...latest,publisherEpoch:token,sequence:latest.sequence+1,publicationId:dailyHash(randomBytes(32)),previous:dailyHash(latest),checkpoint};
    await write(join(path,filename(r.sequence)),r,fault);await syncDir(path);await fault('directory-sync');
    await owned();current=r;await fault('publication-ack');return {trusted:ref(r),checkpoint:structuredClone(checkpoint),duplicate:false};
   }),
   // Keep the publisher session pinned through the entire DB transaction/commit.
   withGate:fn=>exclusive(()=>fn(async checkpoint=>{
    const latest=await scan();if(!same(ref(latest),ref(current))||!same(latest.checkpoint,checkpoint))dailyFail();
   })),
   async close(){
    if(busy||closed)dailyFail();
    if(poisoned){closed=true;await lock?.close();lock=undefined;return;}
    return exclusive(async()=>{
     try{await owned();}catch{closed=true;await lock?.close();lock=undefined;throw Error('CHECKPOINT_CLOSE_UNCERTAIN');}
     closed=true;await lock.close();lock=undefined;
     await unlink(lockPath);await syncDir(path);
    });
   },
  };
 }catch{
  // Leave an acquired lock as evidence on every uncertain opening/publication. Never reclaim crash locks.
  await lock?.close().catch(()=>{});dailyFail();
 }
}
