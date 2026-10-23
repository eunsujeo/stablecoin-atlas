// Private owned offline Fixture files; no network or environment configuration.
import {constants} from 'node:fs';
import {open,lstat} from 'node:fs/promises';
import {resolve,parse,join} from 'node:path';
import {dailyFail} from './allium-daily-plan.mjs';
import {canonical} from './market-db/plan.mjs';
export async function directory(path){
 const absolute=resolve(path);let current=parse(absolute).root;
 for(const part of absolute.slice(current.length).split('/').filter(Boolean)){
  current=join(current,part);const s=await lstat(current);
  // Ancestors may be system-owned/sticky (e.g. /tmp), but never symlinks or writable by strangers without sticky protection.
  if(!s.isDirectory()||s.isSymbolicLink()||![0,process.getuid()].includes(s.uid)||((s.mode&0o022)&&!(s.mode&0o1000)))dailyFail();
 }
 const s=await lstat(absolute);if(s.uid!==process.getuid()||(s.mode&0o777)!==0o700)dailyFail();return s;
}
export async function file(path,maxBytes=16384,durable=false){
 const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const s=await f.stat();if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o777)!==0o600||s.nlink!==1||s.size>maxBytes)dailyFail();const text=await f.readFile('utf8');if(durable)await f.sync();return text;}finally{await f.close();}
}
export async function syncDir(path){const f=await open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{await f.sync();}finally{await f.close();}}
export async function write(path,value,fault){
 const f=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{await f.writeFile(canonical(value));await fault('record-write');await f.sync();await fault('file-sync');}finally{await f.close();}
}
