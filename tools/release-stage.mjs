import {mkdtemp,mkdir,lstat,unlink,rename,rm,rmdir,chmod,readdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {syncDirectory} from './deploy/files.mjs';
const exec=promisify(execFile),shaPattern=/^[a-f0-9]{40}$/;
export async function stageRelease({root,sha,prepare,lockHeld=false}){
  if(!shaPattern.test(sha))throw Error('RELEASE_SHA_INVALID');
  const lock=join(root,'.stage-lock'),target=join(root,'releases',sha);if(!lockHeld)await mkdir(lock,{mode:0o700});
  let staging,claimed=false,published=false;
  try{
    try{await lstat(target);throw Error('RELEASE_ALREADY_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}
    staging=await mkdtemp(join(root,'releases','.staging-'));
    await prepare(staging,sha);
    const revision=join(staging,'REVISION');
    try{await unlink(revision);}catch(error){if(error.code!=='ENOENT')throw error;}
    const file=await open(revision,'wx',0o644);
    try{await file.writeFile(sha+'\n');await file.chmod(0o644);await file.sync();}finally{await file.close();}
    // mkdir claims even a dangling symlink atomically; rename replaces only our empty directory.
    await mkdir(target,{mode:0o700});claimed=true;await rename(staging,target);published=true;await syncDirectory(join(root,'releases'));
    return {state:'STAGED',commit:sha};
  }finally{
    if(staging&&!published)await rm(staging,{recursive:true,force:true});
    if(claimed&&!published)await rmdir(target).catch(()=>{});
    if(!lockHeld)await rmdir(lock);
  }
}
async function permissions(path){
  const stat=await lstat(path);if(stat.isSymbolicLink())return;
  await chmod(path,stat.isDirectory()?0o755:(stat.mode&0o111)?0o755:0o644);
  if(stat.isDirectory())for(const name of await readdir(path))await permissions(join(path,name));
}
async function child(command,args,{input,log,env}={}){
  const process=spawn(command,args,{env,stdio:[input?'pipe':'ignore',log??'ignore',log??'ignore']});
  if(input){process.stdin.on('error',()=>{});process.stdin.end(input);}
  await new Promise((resolve,reject)=>{process.on('error',reject);process.on('exit',code=>code===0?resolve():reject(Error('RELEASE_PREPARATION_FAILED')));});
}
export async function main(args){
  if(process.platform!=='linux'||process.getuid?.()!==0||args.length!==1||!shaPattern.test(args[0]))throw Error('RELEASE_ARGUMENTS_INVALID');
  const root='/opt/stablecoin-atlas',sha=args[0];
  return stageRelease({root,sha,prepare:async staging=>{
    const repository=join(root,'repository');
    await exec('/usr/bin/git',['-C',repository,'fetch','--no-tags','origin','refs/heads/main'],{timeout:60000,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},maxBuffer:1024*1024});
    await exec('/usr/bin/git',['-C',repository,'merge-base','--is-ancestor',sha,'FETCH_HEAD'],{timeout:10000,maxBuffer:1024*1024});
    const {stdout}=await exec('/usr/bin/git',['-C',repository,'archive',sha],{encoding:'buffer',maxBuffer:64*1024*1024});
    await child('/usr/bin/tar',['-x','-C',staging],{input:stdout});
    await exec('/usr/bin/chown',['-hR','atlasbuild:atlasbuild',staging]);await chmod(staging,0o755);
    const log=await open('/var/log/atlas-deploy/'+sha+'-'+randomUUID()+'.log','wx',0o600);
    try{await child('/usr/sbin/runuser',['-u','atlasbuild','--','/usr/bin/env','-i','PATH=/usr/bin:/bin','npm_config_cache=/var/cache/atlas-build','/usr/bin/npm','--prefix',staging,'ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{log:log.fd});}
    finally{await log.close();}
    await exec('/usr/bin/chown',['-hR','root:root',staging]);await permissions(staging);
  }});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch{console.error('RELEASE_STAGE_FAILED: previous releases preserved; inspect private deployment log.');process.exitCode=1;}}
