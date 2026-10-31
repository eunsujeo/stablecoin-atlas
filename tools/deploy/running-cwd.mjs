import {lstat,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {requireThat} from './files.mjs';
export async function verifyRunningCwd(pid,expected,{procRoot='/proc',releaseRoot='/opt/stablecoin-atlas/releases',uid=process.getuid(),resolve=realpath}={}){
 requireThat(typeof pid==='string'&&/^[1-9]\d{0,9}$/.test(pid)&&Number(pid)>1&&expected.startsWith(releaseRoot+'/')&&/^[a-f0-9]{40}$/.test(expected.slice(releaseRoot.length+1))&&uid>0,'RUNNING_CONTEXT_INVALID');
 const path=join(procRoot,pid),before=await lstat(path);requireThat(before.isDirectory()&&!before.isSymbolicLink()&&before.uid===uid,'RUNNING_OWNER_MISMATCH');
 requireThat(await resolve(join(path,'cwd'))===expected,'RUNNING_VERSION_MISMATCH');
 const after=await lstat(path);requireThat(after.isDirectory()&&['ino','dev','uid'].every(k=>before[k]===after[k]),'RUNNING_PROCESS_CHANGED');return {state:'READY'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{requireThat(process.argv.length===4&&process.platform==='linux'&&process.getuid()>0,'RUNNING_CONTEXT_INVALID');console.log(JSON.stringify(await verifyRunningCwd(...process.argv.slice(2))));}catch(e){console.error(/^[A-Z_]{1,64}$/.test(e.message)?e.message:'RUNNING_CHECK_FAILED');process.exitCode=1;}}
