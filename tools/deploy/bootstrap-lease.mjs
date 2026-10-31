import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {trusted,requireThat} from './files.mjs';
// Acquire flock on an inherited open-file description; Node retains that FD until release/crash.
export async function bootstrapLease(state,{trust=trusted,spawnLease=spawn,uid=process.getuid()}={}){
 await trust(state,{directory:true});let file,child,timer;
 try{
  file=await open(join(state,'bootstrap-install.flock'),constants.O_CREAT|constants.O_RDWR|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);
  const s=await file.stat();requireThat(s.isFile()&&s.uid===uid&&(s.mode&0o7777)===0o600&&s.nlink===1,'BOOTSTRAP_LOCK_UNSAFE');
  child=spawnLease('/usr/bin/bash',['-c',"/usr/bin/flock -n 3 || exit 73; printf 'LOCKED\\n'"],{stdio:['ignore','pipe','ignore',file.fd],env:{PATH:'/usr/bin:/bin'}});
  await new Promise((resolve,reject)=>{
   timer=setTimeout(()=>reject(Error('BOOTSTRAP_LOCK_TIMEOUT')),10000);let data='';
   child.once('error',()=>reject(Error('BOOTSTRAP_LOCK_FAILED')));child.once('close',code=>code===0&&data==='LOCKED\n'?resolve():reject(Error(code===73?'BOOTSTRAP_BUSY':'BOOTSTRAP_LOCK_FAILED')));
   child.stdout.on('data',bytes=>{data+=bytes.toString();if(data.length>64){child.kill('SIGTERM');reject(Error('BOOTSTRAP_LOCK_FAILED'));}});
  });clearTimeout(timer);const held=file;file=null;let released=false;
  return {release:async()=>{if(released)return;released=true;await held.close();}};
 }catch(error){clearTimeout(timer);child?.kill('SIGTERM');throw error;}finally{await file?.close();}
}
