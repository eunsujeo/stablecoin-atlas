import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,lstat,mkdir,chown,open,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {trusted,requireThat,sha,hex,hash,atomicJSON,json,syncDirectory} from './files.mjs';
import {validateBundle} from './archive.mjs';
import {serviceChildCommand} from './service-child.mjs';
import {localRepository} from './local-build-worker.mjs';
const exec=promisify(execFile),cache='/var/cache/atlas-build';
export const localBuildPolicy=Object.freeze({version:1,repository:localRepository,branch:'main',component:'web',nodeMajor:24,phases:['prepare','test','production','pack'],scripts:false,testNetwork:false,memoryBytes:2147483648,cpuPercent:200});
const phaseSeconds={prepare:600,test:480,production:300,pack:120};
const codeFiles=['service-child.mjs','local-source.mjs','local-build-worker.mjs','build.mjs','archive.mjs','runtime-smoke.mjs','runtime-files.mjs','policy.mjs','files.mjs'];
export async function localPolicyHash(codeRoot=fileURLToPath(new URL('../../',import.meta.url))){const files={};for(const name of codeFiles){const p=join(codeRoot,'tools/deploy',name);await trusted(p,{limit:1048576});files[name]=hash(await readFile(p));}return hash(JSON.stringify({policy:localBuildPolicy,files}));}
export function localBuildCommand({phase,job,commit,id,codeRoot}){
 requireThat(localBuildPolicy.phases.includes(phase)&&resolve(job)===job&&/^\/opt\/stablecoin-atlas\/builds\/[a-f0-9-]{36}$/.test(job)&&sha(commit)&&Number.isSafeInteger(id)&&id>0&&resolve(codeRoot)===codeRoot,'LOCAL_BUILD_COMMAND');
 const network=['prepare','production'].includes(phase);
 return ['/usr/bin/systemd-run',['--quiet','--wait','--pipe','--collect','--service-type=exec','--unit=atlas-local-build-'+job.split('/').at(-1)+'-'+phase,
  ...['User=atlasbuild','Group=atlasbuild','WorkingDirectory='+job,'ProtectSystem=strict','ProtectHome=true','PrivateTmp=true','PrivateDevices=true','NoNewPrivileges=true','CapabilityBoundingSet=','KillMode=control-group','RuntimeMaxSec='+phaseSeconds[phase],'MemoryMax=2G','CPUQuota=200%','TasksMax=128','UMask=0077','ReadWritePaths='+job+' '+cache+'/npm-cache','PrivateNetwork='+(!network),'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6','EnvironmentFile=-/etc/atlas-deploy/proxy.env'].map(v=>'--property='+v),
  '--setenv=PATH=/usr/bin:/bin','--setenv=NODE_OPTIONS=','--setenv=NODE_PATH=','--setenv=NODE_TLS_REJECT_UNAUTHORIZED=1','/usr/bin/node','--use-env-proxy',join(codeRoot,'tools/deploy/local-build-worker.mjs'),phase,job,commit,String(id)]];
}
export async function readLocalOutput(path,{uid,limit}){
 const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const s=await f.stat();requireThat(s.isFile()&&s.uid===uid&&s.nlink===1&&!(s.mode&0o7022)&&s.size>0&&s.size<=limit,'LOCAL_OUTPUT_UNSAFE');const bytes=await f.readFile(),after=await f.stat();requireThat(bytes.length===s.size&&after.size===s.size&&after.mtimeMs===s.mtimeMs&&after.ctimeMs===s.ctimeMs,'LOCAL_OUTPUT_CHANGED');return bytes;}finally{await f.close();}
}
export function validateLocalBundle(files,c,policyHash){
 requireThat(hex(policyHash),'LOCAL_BUILD_POLICY');const manifest=validateBundle(files,c,{kind:'ATLAS_LOCAL_RELEASE'});
 requireThat(manifest.localBuild?.policyHash===policyHash&&manifest.localBuild.tested===true&&manifest.localBuild.repository===localRepository,'LOCAL_BUILD_ATTESTATION');return {manifest,payload:files['release.tar']};
}
async function buildLocal(c,{state,codeRoot,policyHash}){
 const {stdout:active}=await exec('/usr/bin/systemctl',['list-units','--plain','--no-legend','--state=active,activating','atlas-local-build-*']);requireThat(!active.trim(),'LOCAL_BUILD_BUSY');
 const {stdout}=await exec('/usr/bin/id',['-u','atlasbuild']);const uid=Number(stdout.trim());requireThat(Number.isSafeInteger(uid)&&uid>0,'LOCAL_BUILD_USER');
 const {stdout:groups}=await exec('/usr/bin/id',['-Gn','atlasbuild']),{stdout:passwd}=await exec('/usr/bin/getent',['passwd','atlasbuild']);const account=passwd.trim().split(':');requireThat(groups.trim()==='atlasbuild'&&account[0]==='atlasbuild'&&Number(account[2])===uid&&['/usr/sbin/nologin','/sbin/nologin'].includes(account[6]),'LOCAL_BUILD_USER_PRIVILEGED');
 const s=await lstat(cache);requireThat(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===uid&&(s.mode&0o7777)===0o700,'LOCAL_BUILD_CACHE');
 // Root-owned parent prevents another job from replacing this job's directory entry.
 const jobs='/opt/stablecoin-atlas/builds';try{await mkdir(jobs,{mode:0o711});}catch(e){if(e.code!=='EEXIST')throw e;}await trusted(jobs,{directory:true});
 await (await import('node:fs/promises')).chmod(jobs,0o711);
 const npmCache=join(cache,'npm-cache');try{await lstat(npmCache);}catch(e){if(e.code!=='ENOENT')throw e;await mkdir(npmCache,{mode:0o700});await chown(npmCache,uid,-1);}const ns=await lstat(npmCache);requireThat(ns.isDirectory()&&!ns.isSymbolicLink()&&ns.uid===uid&&!(ns.mode&0o077),'LOCAL_NPM_CACHE');
 const job=join(jobs,randomUUID());await mkdir(job,{mode:0o700});await chown(job,uid,-1);
 for(const phase of localBuildPolicy.phases){const [command,args]=localBuildCommand({phase,job,commit:c.sha,id:c.id,codeRoot}),started=Date.now();try{const result=await exec(command,args,{timeout:(phaseSeconds[phase]+30)*1000,maxBuffer:4*1024*1024});await writeFile(join(state,'local-build-'+c.id+'-'+phase+'.log'),result.stdout+result.stderr,{mode:0o600,flag:'wx'});}catch(e){await writeFile(join(state,'local-build-'+c.id+'-'+phase+'.log'),(e.stdout??'')+(e.stderr??''),{mode:0o600,flag:'wx'}).catch(()=>{});throw Error('LOCAL_BUILD_'+phase.toUpperCase()+'_FAILED');}finally{console.error(JSON.stringify({event:'LOCAL_BUILD',phase,commit:c.sha,elapsedMs:Date.now()-started}));}}
 // All transient units have exited with KillMode=control-group before snapshotting.
 const output=join(job,'output'),os=await lstat(output);requireThat(os.isDirectory()&&!os.isSymbolicLink()&&os.uid===uid&&!(os.mode&0o022),'LOCAL_OUTPUT_UNSAFE');
 const payload=await readLocalOutput(join(output,'release.tar'),{uid,limit:192*1024*1024}),raw=await readLocalOutput(join(output,'release.json'),{uid,limit:65536});
 const manifest=JSON.parse(raw);validateBundle({'release.tar':payload,'release.json':raw},c,{kind:'ATLAS_LOCAL_RELEASE'});manifest.localBuild={policyHash,tested:true,repository:localRepository};return validateLocalBundle({'release.tar':payload,'release.json':Buffer.from(JSON.stringify(manifest))},c,policyHash);
}
export function localMainCommand(){
 return serviceChildCommand({user:'atlasbuild',command:'/usr/bin/git',args:['-c','http.followRedirects=false','ls-remote','--exit-code',localRepository,'refs/heads/main'],cwd:cache,proxy:true});
}
async function discoverMain(){
 const {command,args,options}=localMainCommand();try{const {stdout}=await exec(command,args,options);const parts=stdout.trim().split(/\s+/);requireThat(parts.length===2&&sha(parts[0])&&parts[1]==='refs/heads/main','LOCAL_MAIN_INVALID');return parts[0];}catch(e){throw Error(e.message==='LOCAL_MAIN_INVALID'?e.message:'LOCAL_SOURCE_UNAVAILABLE');}
}
export function localSourceClient({state,codeRoot=fileURLToPath(new URL('../../',import.meta.url)),discover=discoverMain,policy=()=>localPolicyHash(codeRoot),build=buildLocal,clock=Date.now,trust=trusted}){
 codeRoot=resolve(codeRoot);
 async function candidate(config,versions={}){
  requireThat(config.source==='LOCAL_GIT'&&config.repository==='eunsujeo/stablecoin-atlas'&&!config.components.collector.enabled&&!config.components.usage.enabled,'LOCAL_SOURCE_CONFIG');
  const commit=await discover();requireThat(sha(commit),'LOCAL_MAIN_INVALID');const policyHash=await policy(),path=join(state,'local-source.json');requireThat(hex(policyHash),'LOCAL_BUILD_POLICY');let c=await json(path,null);
  if(c)requireThat(sha(c.sha)&&Number.isSafeInteger(c.id)&&c.id>0&&c.attempt===1&&c.component==='web'&&c.event==='local_git'&&hex(c.policyHash)&&c.url==='https://github.com/eunsujeo/stablecoin-atlas/commit/'+c.sha,'LOCAL_STATE_INVALID');
  if(!c||c.sha!==commit||c.policyHash!==policyHash){const id=Math.max(clock(),(c?.id??0)+1,(versions?.web?.lastAttempt??0)+1);requireThat(Number.isSafeInteger(id)&&id>0,'LOCAL_ID_INVALID');c={sha:commit,id,attempt:1,component:'web',event:'local_git',policyHash,url:'https://github.com/eunsujeo/stablecoin-atlas/commit/'+commit};await atomicJSON(path,c);}return c;
 }
 async function bundle(c){
  requireThat(sha(c.sha)&&c.component==='web'&&hex(c.policyHash)&&c.policyHash===await policy(),'LOCAL_CANDIDATE_INVALID');
  const folder=join(state,'local-artifacts',c.sha+'-'+c.id);try{await trust(folder,{directory:true});const files={'release.tar':await readLocalOutput(join(folder,'release.tar'),{uid:process.getuid(),limit:192*1024*1024}),'release.json':await readLocalOutput(join(folder,'release.json'),{uid:process.getuid(),limit:65536})};return validateLocalBundle(files,c,c.policyHash);}catch(e){if(e.code!=='ENOENT')throw e;try{await lstat(folder);throw Error('LOCAL_ARTIFACT_INCOMPLETE');}catch(e2){if(e2.code!=='ENOENT')throw e2;}}
  const claims=join(state,'local-build-claims');await mkdir(claims,{mode:0o700,recursive:true});await trust(claims,{directory:true});let claim;
  try{claim=await open(join(claims,c.sha+'-'+c.policyHash+'.json'),'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('LOCAL_BUILD_CONSUMED');throw e;}
  try{await claim.writeFile(JSON.stringify({schemaVersion:1,commit:c.sha,id:c.id,policyHash:c.policyHash}));await claim.sync();}finally{await claim.close();}await syncDirectory(claims);
  const result=await build(c,{state,codeRoot,policyHash:c.policyHash});validateLocalBundle({'release.tar':result.payload,'release.json':Buffer.from(JSON.stringify(result.manifest))},c,c.policyHash);
  await mkdir(join(state,'local-artifacts'),{mode:0o700,recursive:true});await trust(join(state,'local-artifacts'),{directory:true});await mkdir(folder,{mode:0o700});
  for(const [name,bytes]of [['release.tar',result.payload],['release.json',Buffer.from(JSON.stringify(result.manifest,null,2)+'\n')]]){const f=await open(join(folder,name),'wx',0o600);try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}}await syncDirectory(folder);await syncDirectory(join(state,'local-artifacts'));return result;
 }
 return {candidate,bundle,reportingReady:async()=>{},status:async(c,result)=>atomicJSON(join(state,'local-status.json'),{commit:c.sha,buildId:c.id,attempt:c.attempt,...result})};
}
