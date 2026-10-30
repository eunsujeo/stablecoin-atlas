import {lstat,open,mkdir,rename,unlink,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hash,hex,requireThat,syncDirectory} from './files.mjs';
export const artifactLimit=96*1024*1024;
// Full ZIPs only, keyed by the independently obtained GitHub digest. No URLs or partial downloads.
export function artifactCache(directory,{uid=process.getuid()}={}){
 requireThat(resolve(directory)===directory,'ARTIFACT_CACHE_UNSAFE');
 async function ancestors(){let path=dirname(directory);for(;;){const s=await lstat(path);requireThat(s.isDirectory()&&!s.isSymbolicLink()&&[0,uid].includes(s.uid)&&!(s.mode&0o022),'ARTIFACT_CACHE_UNSAFE');const parent=dirname(path);if(parent===path)break;path=parent;}}
 async function ready(create=false){
  try{
   await ancestors();
   if(create)try{await mkdir(directory,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}
   const s=await lstat(directory);requireThat(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===uid&&(s.mode&0o7777)===0o700,'ARTIFACT_CACHE_UNSAFE');return true;
  }catch(e){if(e.code==='ENOENT')return false;throw e;}
 }
 const safe=s=>s.isFile()&&!s.isSymbolicLink()&&s.uid===uid&&(s.mode&0o7777)===0o600&&s.nlink===1&&s.size>0&&s.size<=artifactLimit;
 async function get(digest){
  requireThat(hex(digest),'ARTIFACT_CACHE_KEY');if(!await ready())return null;
  const path=join(directory,digest+'.zip');let file;
  try{
   const entry=await lstat(path);requireThat(safe(entry),'ARTIFACT_CACHE_UNSAFE');
   file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const s=await file.stat();requireThat(safe(s)&&s.dev===entry.dev&&s.ino===entry.ino,'ARTIFACT_CACHE_UNSAFE');
   const bytes=Buffer.alloc(s.size+1);let length=0;
   while(length<bytes.length){const r=await file.read(bytes,length,bytes.length-length,length);if(!r.bytesRead)break;length+=r.bytesRead;}
   const after=await file.stat();requireThat(safe(after)&&after.size===s.size&&length===s.size,'ARTIFACT_CACHE_UNSAFE');
   const value=bytes.subarray(0,length);requireThat(hash(value)===digest,'ARTIFACT_CACHE_INVALID');return value;
  }catch(e){if(e.code==='ENOENT')return null;throw e;}finally{await file?.close();}
 }
 async function put(digest,bytes){
  requireThat(hex(digest)&&Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=artifactLimit&&hash(bytes)===digest,'ARTIFACT_CACHE_INVALID');
  if(!await ready(true))return false;
  if(await get(digest))return true;
  const temporary=join(directory,digest+'.'+randomUUID()+'.partial');let file;
  try{
   file=await open(temporary,'wx',0o600);await file.writeFile(bytes);await file.sync();await file.close();file=null;
   await ready();await rename(temporary,join(directory,digest+'.zip'));await syncDirectory(directory);
   const others=[];for(const name of await readdir(directory))if(/^[a-f0-9]{64}\.zip$/.test(name)&&name!==digest+'.zip'){const s=await lstat(join(directory,name));requireThat(safe(s),'ARTIFACT_CACHE_UNSAFE');others.push({name,time:s.mtimeMs});}
   // Retain the current digest plus at most one other completed ZIP. Existing broker flock serializes it.
   others.sort((a,b)=>b.time-a.time||a.name.localeCompare(b.name));for(const entry of others.slice(1))await unlink(join(directory,entry.name));
   return true;
  }finally{await file?.close();await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 }
 return {get,put};
}
