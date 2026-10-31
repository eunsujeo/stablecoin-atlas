import {open,lstat,unlink,rename} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {trusted,hash,hex,requireThat,syncDirectory} from './files.mjs';
export const triggerRulePath='/etc/polkit-1/rules.d/50-atlas-deploy.rules';
// Only this receipt-pinned public rule may migrate the old umask-created 0600 to 0644.
// Options are filesystem/UID test seams; the CLI accepts no path or digest arguments.
export async function checkTriggerRule({repair=false,expectedHash,path=triggerRulePath,uid=0,trust=trusted}={}){
 requireThat(hex(expectedHash),'TRIGGER_RULE_HASH_REQUIRED');await trust(path,{limit:65536});
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);let temp,output;
 try{
  const before=await file.stat();requireThat(before.isFile()&&before.uid===uid&&before.nlink===1&&before.size>0&&before.size<=65536&&[0o600,0o644].includes(before.mode&0o7777),'TRIGGER_RULE_UNSAFE');
  const bytes=await file.readFile();requireThat(bytes.length===before.size&&hash(bytes)===expectedHash,'TRIGGER_RULE_HASH_MISMATCH');
  if((before.mode&0o7777)===0o644)return {state:'READY',repaired:false,servicesChanged:0};
  requireThat(repair,'TRIGGER_RULE_NOT_READABLE');
  temp=join(dirname(path),'.atlas-trigger-'+randomUUID()+'.tmp');output=await open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  await output.writeFile(bytes);const own=await output.stat();if(own.uid!==before.uid||own.gid!==before.gid)await output.chown(before.uid,before.gid);await output.chmod(0o644);await output.sync();await output.close();output=null;
  const after=await file.stat(),entry=await lstat(path);requireThat(['dev','ino','uid','gid','mode','size','mtimeMs','ctimeMs'].every(k=>before[k]===after[k]&&after[k]===entry[k])&&!entry.isSymbolicLink(),'TRIGGER_RULE_CHANGED');
  // Atomic same-content publication also tells polkit's rule watcher to reload, without a service restart.
  await rename(temp,path);temp=null;await syncDirectory(dirname(path));return {state:'READY',repaired:true,servicesChanged:0};
 }finally{await output?.close();await file.close();if(temp)await unlink(temp).catch(()=>{});}
}
