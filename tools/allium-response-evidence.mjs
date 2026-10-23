// Simulated response bytes only. No provider, environment, scan/resume, or execution API.
import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {dailyHash,dailyFail,hashValue} from './allium-daily-plan.mjs';
import {canonical,instant} from './market-db/plan.mjs';
import {directory,file,syncDir,write} from './allium-offline-files.mjs';
const maxRaw=2097152,maxRecord=2900000;
const keys=(v,k)=>v&&Object.keys(v).sort().join(',')===k.split(',').sort().join(',');
export function validateResponseEvidence(r){
 if(!keys(r,'schema,kind,storeHash,fixtureHash,dbEpoch,organizationHash,reservationId,intentId,job,operation,sendHead,observedAt,rawHash,rawLength,rawBase64')||
  r.schema!==1||r.kind!=='ALLIUM_OFFLINE_SIMULATED_RESPONSE'||
  ![r.storeHash,r.fixtureHash,r.dbEpoch,r.organizationHash,r.reservationId,r.intentId,r.rawHash].every(hashValue)||r.dbEpoch!==r.fixtureHash||
  !['supply','volume'].includes(r.job)||!['create','run','status','result'].includes(r.operation)||
  !keys(r.sendHead,'count,hash')||!Number.isSafeInteger(r.sendHead.count)||r.sendHead.count<1||r.sendHead.count>8192||!hashValue(r.sendHead.hash)||
  !Number.isSafeInteger(r.rawLength)||r.rawLength<0||r.rawLength>maxRaw||typeof r.rawBase64!=='string'||r.rawBase64.length>2796204)dailyFail();
 instant(r.observedAt);const bytes=Buffer.from(r.rawBase64,'base64');
 if(bytes.toString('base64')!==r.rawBase64||bytes.length!==r.rawLength||dailyHash(bytes)!==r.rawHash)dailyFail();
 return bytes;
}
export async function createResponseStore(path,{fixtureHash,organizationHash}){
 try{
  if(![fixtureHash,organizationHash].every(hashValue))dailyFail();
  await directory(resolve(path,'..'));await mkdir(path,{mode:0o700});await directory(path);
  const manifest={schema:1,kind:'ALLIUM_OFFLINE_RESPONSE_STORE',fixtureHash,dbEpoch:fixtureHash,organizationHash,nonce:dailyHash(randomBytes(32))};
  await write(join(path,'manifest.json'),manifest,async()=>{});await syncDir(path);await syncDir(resolve(path,'..'));
  return {identity:{fixtureHash,dbEpoch:fixtureHash,organizationHash},trustedStoreHash:dailyHash(manifest)};
 }catch{dailyFail();}
}
export async function responseStore(path,{identity,trustedStoreHash,fault=async()=>{}}){
 try{
  const binding=structuredClone(identity),root=await directory(path);
  if(!keys(binding,'fixtureHash,dbEpoch,organizationHash')||!Object.values(binding).every(hashValue)||binding.fixtureHash!==binding.dbEpoch||!hashValue(trustedStoreHash))dailyFail();
  let poisoned=false,busy=false;
  async function owned(){
   const s=await directory(path),text=await file(join(path,'manifest.json')),m=JSON.parse(text);
   if(s.dev!==root.dev||s.ino!==root.ino||canonical(m)!==text||dailyHash(m)!==trustedStoreHash||
    !keys(m,'schema,kind,fixtureHash,dbEpoch,organizationHash,nonce')||m.schema!==1||m.kind!=='ALLIUM_OFFLINE_RESPONSE_STORE'||!hashValue(m.nonce)||
    Object.entries(binding).some(([k,v])=>m[k]!==v))dailyFail();
  }
  await owned();
  return {
   identity:()=>({...binding,storeHash:trustedStoreHash}),
   async preserve(metadata,bytes){
    if(poisoned||busy)dailyFail();busy=true;
    try{
     await owned();if(!Buffer.isBuffer(bytes)||bytes.length>maxRaw)dailyFail();bytes=Buffer.from(bytes);
     const r={...structuredClone(metadata),...binding,schema:1,kind:'ALLIUM_OFFLINE_SIMULATED_RESPONSE',storeHash:trustedStoreHash,
      rawHash:dailyHash(bytes),rawLength:bytes.length,rawBase64:bytes.toString('base64')};
     validateResponseEvidence(r);const recordHash=dailyHash(r);
     // Existing/partial records are never overwritten or retried by this writer.
     await write(join(path,recordHash+'.json'),r,fault);await syncDir(path);await fault('directory-sync');await owned();await fault('response-ack');
     return {storeHash:trustedStoreHash,recordHash};
    }catch{poisoned=true;dailyFail();}finally{busy=false;}
   },
   async read(reference){
    try{
     if(poisoned)dailyFail();reference=structuredClone(reference);await owned();
     if(!keys(reference,'storeHash,recordHash')||reference.storeHash!==trustedStoreHash||!hashValue(reference.recordHash))dailyFail();
     const text=await file(join(path,reference.recordHash+'.json'),maxRecord,true),r=JSON.parse(text);await fault('read-file-sync');
     if(canonical(r)!==text||dailyHash(r)!==reference.recordHash||r.storeHash!==trustedStoreHash||Object.entries(binding).some(([k,v])=>r[k]!==v))dailyFail();
     validateResponseEvidence(r);await syncDir(path);await fault('read-directory-sync');await owned();return r;
    }catch{dailyFail();}
   },
  };
 }catch{dailyFail();}
}
