// Root-owned, fixed instructions; this process and all repository code run as atlasbuild.
import {readFile,readdir,lstat,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {sha,requireThat} from './files.mjs';
import {buildRelease,verifiedGitFiles} from './build.mjs';
import {smokeRuntime} from './runtime-smoke.mjs';
const exec=promisify(execFile);
export const localRepository='https://github.com/eunsujeo/stablecoin-atlas.git';
export function validateLocalLock(lock){
 requireThat(lock?.lockfileVersion>=3&&lock.packages&&Object.keys(lock.packages).length<=2000,'LOCAL_LOCK_INVALID');
 for(const [path,p]of Object.entries(lock.packages)){if(!path)continue;
  requireThat(path.startsWith('node_modules/')&&!path.split('/').some(s=>!s||s==='.'||s==='..')&&!p.link&&typeof p.version==='string','LOCAL_LOCK_INVALID');
  const u=new URL(p.resolved);requireThat(u.protocol==='https:'&&u.hostname==='registry.npmjs.org'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^sha(?:256|512)-[A-Za-z0-9+/]+={0,2}$/.test(p.integrity??''),'LOCAL_DEPENDENCY_ORIGIN');
 }
}
async function run(command,args,cwd){try{const {stdout}=await exec(command,args,{cwd,timeout:900000,maxBuffer:4*1024*1024,env:{...process.env,PATH:'/usr/bin:/bin',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0',NODE_OPTIONS:'',NODE_PATH:'',NODE_TLS_REJECT_UNAUTHORIZED:'1'}});process.stdout.write(stdout);}catch(e){
 // The root parent captures these only in its private phase log, never Git/web/CLI diagnostics.
 process.stdout.write(e.stdout??'');process.stderr.write(e.stderr??'');console.error(JSON.stringify({event:'LOCAL_BUILD_CHILD_FAILED',code:typeof e.code==='number'?e.code:null,signal:e.signal??null}));throw e;
}}
export async function localBuildWorker([phase,job,commit,identity,...extra]){
 requireThat(!extra.length&&process.getuid()>0&&process.platform==='linux'&&process.arch==='arm64'&&process.versions.node.startsWith('24.')&&Number(process.versions.node.split('.')[1])>=5,'LOCAL_BUILD_CONTEXT');
 requireThat(['prepare','test','production','pack'].includes(phase)&&resolve(job)===job&&/^\/opt\/stablecoin-atlas\/builds\/[a-f0-9-]{36}$/.test(job)&&sha(commit)&&/^[1-9]\d{0,15}$/.test(identity),'LOCAL_BUILD_ARGUMENTS');
 const root=join(job,'source'),output=join(job,'output'),id=Number(identity),cache='/var/cache/atlas-build/npm-cache';
 if(phase==='prepare'){
  await mkdir(root,{mode:0o700});await run('/usr/bin/git',['init','--quiet',root],job);
  await run('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','http.followRedirects=false','-c','transfer.fsckObjects=true','fetch','--depth=1','--no-tags',localRepository,commit],root);
  await run('/usr/bin/git',['-c','core.hooksPath=/dev/null','checkout','--quiet','--detach','FETCH_HEAD'],root);
 }
 const {stdout:head}=await exec('/usr/bin/git',['-C',root,'rev-parse','HEAD']);requireThat(head.trim()===commit,'LOCAL_SOURCE_CHANGED');
 await verifiedGitFiles(root,commit);
 const {stdout:tracked}=await exec('/usr/bin/git',['-C',root,'ls-files','--stage'],{maxBuffer:16*1024*1024});requireThat(!/^(120000|160000) /m.test(tracked),'LOCAL_SOURCE_LINK');
 try{await lstat(join(root,'.npmrc'));throw Error('LOCAL_NPM_CONFIG');}catch(e){if(e.code!=='ENOENT')throw e;}
 validateLocalLock(JSON.parse(await readFile(join(root,'package-lock.json'),'utf8')));
 if(phase==='prepare'||phase==='production'){
  const configs=await mkdtemp(join(job,'npm-config-')),userconfig=join(configs,'user.conf');await writeFile(userconfig,'',{mode:0o600,flag:'wx'});
  // Preserve the OS-managed global CA/proxy config. Never load repository/user npmrc.
  await run('/usr/bin/npm',['ci',...(phase==='production'?['--omit=dev']:[]),'--ignore-scripts','--no-audit','--no-fund','--fetch-retries=0','--fetch-timeout=120000','--prefer-offline','--strict-ssl=true','--registry=https://registry.npmjs.org/','--userconfig='+userconfig,'--cache='+cache],root);
 }else if(phase==='test'){
  await run('/usr/bin/npm',['run','build','--ignore-scripts'],root);
  const files=[];for(const dir of ['tests','web']){const selected=(await readdir(join(root,dir))).filter(n=>(dir==='web'?/\.test\.mjs$/:/^(deploy|production).*\.test\.mjs$/).test(n)).sort();requireThat(selected.length>0,'LOCAL_TESTS_MISSING');files.push(...selected.map(n=>join(dir,n)));}
  await run('/usr/bin/node',['--use-env-proxy','--import','tsx','--test','--test-concurrency=2',...files],root);
 }else{
  await buildRelease({root,output,commit,component:'web',runId:id,attempt:1,kind:'ATLAS_LOCAL_RELEASE'});
  await smokeRuntime(output,{kind:'ATLAS_LOCAL_RELEASE'});
 }
 return {state:'COMPLETE',phase,commit};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await localBuildWorker(process.argv.slice(2))));}catch(e){console.error(/^[A-Z_]{1,64}$/.test(e.message)?e.message:'LOCAL_BUILD_WORKER_FAILED');process.exitCode=1;}}
