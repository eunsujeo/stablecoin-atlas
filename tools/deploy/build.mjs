import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,lstat,readdir,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {packEntries,releaseManifest} from './archive.mjs';
import {hash,sha,requireThat} from './files.mjs';
import {runtimeSource,runtimePackageDirectories} from './runtime-files.mjs';
import {deflateRawSync} from 'node:zlib';
const exec=promisify(execFile);
export {policyFiles} from './policy.mjs';
import {payloadPolicies} from './policy.mjs';
export async function verifiedGitFiles(root,commit){
 const gitDir=await lstat(join(root,'.git'));requireThat(gitDir.isDirectory()&&!gitDir.isSymbolicLink(),'BUILD_GIT_UNSAFE');
 const args=['--no-replace-objects','--git-dir='+join(root,'.git'),'--work-tree='+root,'-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false'];
 const index=await mkdtemp(join(tmpdir(),'atlas-build-index-')),env={...process.env,GIT_INDEX_FILE:join(index,'index'),GIT_NO_REPLACE_OBJECTS:'1',GIT_CONFIG_GLOBAL:'/dev/null'};let stdout;
 try{
 const {stdout:actual}=await exec('git',[...args,'rev-parse','HEAD'],{env});requireThat(actual.trim()===commit,'BUILD_SHA');
 // Repository tests cannot hide edits via replace refs, index flags or external diff drivers.
 await exec('git',[...args,'fsck','--strict'],{env,maxBuffer:16*1024*1024});await exec('git',[...args,'read-tree','--reset','HEAD'],{env});await exec('git',[...args,'diff','--no-ext-diff','--no-textconv','--exit-code','HEAD'],{env});
 ({stdout}=await exec('git',[...args,'ls-files','-z'],{env,maxBuffer:16*1024*1024}));
 }finally{await rm(index,{recursive:true,force:true});}
 return stdout.split('\0').filter(Boolean);
}
export async function buildRelease({root,output,commit,component,runId,attempt,kind='ATLAS_CI_RELEASE',platform=process.platform,arch=process.arch,nodeVersion=process.versions.node}){
 requireThat(platform==='linux'&&arch==='arm64'&&nodeVersion.startsWith('24.')&&Number(nodeVersion.split('.')[1])>=5&&sha(commit),'BUILD_PLATFORM');
 const names=await verifiedGitFiles(root,commit),entries=[];
 async function add(name){const path=join(root,name),s=await lstat(path);requireThat(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'BUILD_FILE_UNSAFE');entries.push({name,bytes:await readFile(path),mode:s.mode&0o111?0o755:0o644});}
 for(const name of names){if(runtimeSource(name))await add(name);}
 const packages=await runtimePackageDirectories(root);
 async function walk(dir){for(const name of (await readdir(join(root,dir))).sort()){if(name==='.bin'||name==='node_modules')continue;const p=dir+'/'+name,s=await lstat(join(root,p));requireThat(!s.isSymbolicLink(),'BUILD_SYMLINK');if(s.isDirectory())await walk(p);else await add(p);}}
 for(const directory of packages)await walk(directory);
 entries.sort((a,b)=>a.name.localeCompare(b.name));entries.push({name:'REVISION',bytes:Buffer.from(commit+'\n')});const payload=packEntries(entries),manifest=releaseManifest(payload,{commit,component,runId,attempt,kind,policies:payloadPolicies(entries)});
 await mkdir(output,{recursive:true,mode:0o700});await writeFile(join(output,'release.tar'),payload,{flag:'wx'});await writeFile(join(output,'release.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 // This is a compression estimate, not the GitHub ZIP digest or transfer size.
 return {commit,component,payloadHash:manifest.payloadHash,files:entries.length,packages:packages.length,sourceBytes:entries.filter(e=>!e.name.startsWith('node_modules/')).reduce((n,e)=>n+e.bytes.length,0),dependencyBytes:entries.filter(e=>e.name.startsWith('node_modules/')).reduce((n,e)=>n+e.bytes.length,0),payloadBytes:payload.length,deflate9EstimateBytes:deflateRawSync(payload,{level:9}).length,nativeFiles:entries.filter(e=>/\.(node|so(?:\.\d+)*)$/.test(e.name)).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const [output,component,commit,runId,attempt,...extra]=process.argv.slice(2);requireThat(!extra.length&&output,'BUILD_ARGUMENTS');console.log(JSON.stringify(await buildRelease({root:process.cwd(),output,component,commit,runId:Number(runId),attempt:Number(attempt)})));}catch{console.error('CI_RELEASE_BUILD_FAILED');process.exitCode=1;}}
