import {mkdir,readFile,readlink,lstat,symlink,rename,unlink,rmdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as wait} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {syncDirectory} from './deploy/files.mjs';
import {loopbackRequest} from './loopback-http.mjs';
const exec=promisify(execFile),shaPattern=/^[a-f0-9]{40}$/;
export async function release(root,sha){
  if(!shaPattern.test(sha))throw Error('RELEASE_SHA_INVALID');
  const path=join(root,'releases',sha),stat=await lstat(path);
  const revision=join(path,'REVISION'),marker=await lstat(revision);
  if(!stat.isDirectory()||stat.isSymbolicLink()||!marker.isFile()||marker.isSymbolicLink()||(await readFile(revision,'utf8')).trim()!==sha)throw Error('RELEASE_INVALID');
  return path;
}
export async function pointer(root,name){
  const path=join(root,name);let value;
  try{value=await readlink(path);}catch(error){if(error.code==='ENOENT')return null;throw Error('RELEASE_POINTER_INVALID');}
  const target=resolve(dirname(path),value),sha=target.split('/').at(-1);
  if(target!==await release(root,sha))throw Error('RELEASE_POINTER_INVALID');return sha;
}
export async function point(root,name,sha){
  const target=await release(root,sha),temp=join(root,'.'+name+'-'+process.pid);
  try{await symlink(target,temp);await rename(temp,join(root,name));await syncDirectory(root);}finally{await unlink(temp).catch(()=>{});}
}
export async function activateRelease({root,sha,rollback=false,restart,health,stop,lockHeld=false}){
  const lock=join(root,'.deployment-lock');if(!lockHeld)await mkdir(lock,{mode:0o700});
  let old,switched=false;
  try{
    if(rollback)sha=await pointer(root,'previous');
    await release(root,sha);old=await pointer(root,'current');await point(root,'current',sha);switched=true;
    await restart();if(!await health(sha))throw Error('RELEASE_UNHEALTHY');
    if(old&&old!==sha)await point(root,'previous',old);
    return {state:'ACTIVATED',commit:sha};
  }catch(error){
    if(!switched)throw error;
    if(old){
      await point(root,'current',old);
      try{await restart();if(!await health(old))throw Error();}catch{throw Error('DEPLOY_ROLLBACK_UNHEALTHY');}
      throw Error('DEPLOY_FAILED_ROLLED_BACK');
    }
    await unlink(join(root,'current'));await stop();throw Error('FIRST_DEPLOY_FAILED_STOPPED');
  }finally{if(!lockHeld)await rmdir(lock);}
}
export async function checkWebHealth(sha,{host,port=4173,attempts=8}={}){
  for(let i=0;i<attempts;i++){
    try{
      const response=await loopbackRequest({port,path:'/healthz',timeout:3000,limit:1024});
      if(response.status===200&&JSON.parse(response.body).commit===sha){
        const data=await loopbackRequest({port,path:'/market-data.json',host});
        if(data.status===200&&JSON.parse(data.body).readState?.source==='POSTGRESQL')return true;
      }
    }catch{}
    if(i+1<attempts)await wait(1000);
  }
  return false;
}
export async function main(args){
  if(process.platform!=='linux'||process.getuid?.()!==0||args.length!==2||!['activate','rollback'].includes(args[0]))throw Error('DEPLOY_ARGUMENTS_INVALID');
  const root='/opt/stablecoin-atlas',sha=args[1];
  if(args[0]==='rollback'&&args[1]!=='previous')throw Error('DEPLOY_ARGUMENTS_INVALID');
  const config=JSON.parse(await readFile('/etc/atlas-web/web.json','utf8'));
  return activateRelease({root,sha,rollback:args[0]==='rollback',restart:()=>exec('/usr/bin/systemctl',['restart','atlas-web.service'],{timeout:70000}),stop:()=>exec('/usr/bin/systemctl',['stop','atlas-web.service'],{timeout:50000}),health:s=>checkWebHealth(s,{host:config.hosts[0],port:config.port})});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch(error){console.error(/^DEPLOY_|^FIRST_DEPLOY_/.test(error.message)?error.message:'RELEASE_SWITCH_FAILED: details omitted.');process.exitCode=1;}}
