import {mkdir,lstat,open,realpath,link,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {boundedRead} from '../evidence-store.mjs';
import {fixedSources,sourceName,importPlan,digest,fail} from './plan.mjs';
async function syncDirectory(path){const handle=await open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{await handle.sync();}finally{await handle.close();}}
async function directory(path,{create=false,privateMode=false}={}){
  const firstCreated=create?await mkdir(path,{recursive:true,mode:0o700}):undefined;const stat=await lstat(path);
  if(!stat.isDirectory()||stat.isSymbolicLink()||(privateMode&&process.platform!=='win32'&&((stat.mode&0o077)!==0||stat.uid!==process.getuid())))fail('PRIVATE_DIRECTORY_REQUIRED');
  const canonicalPath=await realpath(path);
  if(firstCreated){const stop=await realpath(dirname(firstCreated));let current=canonicalPath;while(current!==stop){await syncDirectory(current);current=dirname(current);}await syncDirectory(stop);}
  return canonicalPath;
}
export async function loadSources({reportsDirectory,registryPath,names}){
  if(!Array.isArray(names)||names.length<1||names.length>12||new Set(names).size!==names.length)fail('INPUT_SOURCE_LIMIT');
  names.forEach(sourceName);const root=await directory(resolve(reportsDirectory));
  const registry=JSON.parse((await boundedRead(registryPath,128*1024)).toString('utf8'));
  const sources=[];
  for(const name of names){if(name.startsWith('market-store/collected/')){await directory(join(root,'market-store'));await directory(join(root,'market-store','collected'));}
    const bytes=await boundedRead(join(root,name),2*1024*1024);sources.push(importPlan(registry,bytes,{kind:fixedSources.includes(name)?'LEGACY_REPORT':'PROJECTION'}));}
  if(sources.reduce((n,p)=>n+p.observationCount+p.networkCount,0)>5000)fail('INPUT_OBSERVATION_LIMIT');
  return {registry,sources};
}
export async function archiveSources(plans,root){
  const directoryPath=await directory(resolve(root),{create:true,privateMode:true});
  for(const plan of plans){
    if(!Buffer.isBuffer(plan.bytes)||plan.bytes.length>2*1024*1024||!/^[a-f0-9]{64}$/.test(plan.hash)||digest(plan.bytes)!==plan.hash)fail('INVALID_ARTIFACT');
    const relative=`${plan.hash.slice(0,2)}/${plan.hash}.json`,path=join(directoryPath,relative);
    await directory(dirname(path),{create:true,privateMode:true});let handle;const temporary=path+'.'+randomUUID()+'.tmp';
    try{
      handle=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
      await handle.writeFile(plan.bytes);await handle.sync();await handle.close();handle=null;
      try{await link(temporary,path);}catch(error){if(error.code!=='EEXIST')throw error;}
    }finally{await handle?.close();await unlink(temporary).catch(()=>{});}
    await syncDirectory(dirname(path));
    const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||(process.platform!=='win32'&&(stat.mode&0o077)!==0))fail('ARTIFACT_COLLISION');
    const existing=await boundedRead(path,2*1024*1024);if(existing.length!==plan.bytes.length||digest(existing)!==plan.hash||!existing.equals(plan.bytes))fail('ARTIFACT_COLLISION');
  }
  return directoryPath;
}
