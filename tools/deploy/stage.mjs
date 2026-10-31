import {join} from 'node:path';
import {lstat,readFile,readdir,rmdir} from 'node:fs/promises';
import {stageRelease} from '../release-stage.mjs';
import {extractRelease,tarEntries} from './archive.mjs';
import {atomicJSON,json,requireThat,hash,sha} from './files.mjs';
import {isDeepStrictEqual} from 'node:util';
async function verifyExisting(target,commit,bundle,entries){
 const marker=await lstat(join(target,'ATLAS_RELEASE.json'));requireThat(marker.isFile()&&!marker.isSymbolicLink()&&marker.uid===process.getuid()&&marker.nlink===1&&!(marker.mode&0o7077)&&marker.size<=65536,'RELEASE_INVALID');
 const m=await json(join(target,'ATLAS_RELEASE.json'));requireThat(m.payloadHash===bundle.manifest.payloadHash&&m.commit===commit,'RELEASE_CONFLICT');
 requireThat(Number.isSafeInteger(m.runId)&&m.runId>0&&Number.isSafeInteger(m.attempt)&&m.attempt>0&&['web','collector','usage'].includes(m.component),'RELEASE_INVALID');
 for(const key of ['schemaVersion','kind','platform','arch','nodeMajor','nodeABI','policies'])requireThat(isDeepStrictEqual(m[key],bundle.manifest[key]),'RELEASE_CONFLICT');
 const expected=new Map(entries.map(e=>[e.name,{hash:hash(e.name==='REVISION'?Buffer.from(commit+'\n'):e.bytes),mode:e.mode}])),seen=new Set();
 const directories=new Set(['']);for(const name of expected.keys()){const parts=name.split('/');while(parts.length>1){parts.pop();directories.add(parts.join('/'));}}
 async function walk(path,prefix=''){
  const s=await lstat(path);requireThat(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o022),'RELEASE_INVALID');
  for(const name of await readdir(path)){const child=join(path,name),relative=prefix?prefix+'/'+name:name,st=await lstat(child);requireThat(!st.isSymbolicLink()&&st.uid===process.getuid()&&!(st.mode&0o022),'RELEASE_INVALID');
   if(st.isDirectory()){requireThat(directories.has(relative),'RELEASE_CONFLICT');await walk(child,relative);}else{
    requireThat(st.isFile()&&st.nlink===1,'RELEASE_INVALID');if(relative==='ATLAS_RELEASE.json'){requireThat(!(st.mode&0o077)&&st.size<=65536,'RELEASE_INVALID');continue;}
    const want=expected.get(relative);requireThat(want&&(st.mode&0o7777)===want.mode&&st.size<=32*1024*1024&&hash(await readFile(child))===want.hash,'RELEASE_CONFLICT');seen.add(relative);
   }
  }
 }
 await walk(target);requireThat(seen.size===expected.size,'RELEASE_CONFLICT');
}
export async function stageVerified(root,commit,bundle){
 for(const path of [root,join(root,'releases')]){const s=await lstat(path);requireThat(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o022),'RELEASE_INVALID');}
 requireThat(sha(commit)&&bundle.manifest.commit===commit,'RELEASE_INVALID');const entries=tarEntries(bundle.payload);requireThat(!entries.some(e=>e.name==='ATLAS_RELEASE.json')&&hash(bundle.payload)===bundle.manifest.payloadHash,'RELEASE_CONFLICT');
 const target=join(root,'releases',commit);let absent=false;
 try{const s=await lstat(target);requireThat(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid(),'RELEASE_INVALID');if((await readdir(target)).length===0){await rmdir(target);absent=true;}else{const r=await lstat(join(target,'REVISION'));requireThat(r.isFile()&&!r.isSymbolicLink()&&r.uid===process.getuid()&&r.nlink===1&&r.size<=128,'RELEASE_INVALID');requireThat((await readFile(join(target,'REVISION'),'utf8')).trim()===commit,'RELEASE_INVALID');await verifyExisting(target,commit,bundle,entries);return {state:'STAGED',commit,reused:true};}}
 catch(e){if(e.code!=='ENOENT')throw e;try{await lstat(target);throw Error('RELEASE_INVALID');}catch(e2){if(e2.code!=='ENOENT')throw e2;}absent=true;}
 requireThat(absent,'RELEASE_INVALID');return stageRelease({root,sha:commit,lockHeld:true,prepare:async folder=>{await extractRelease(bundle.payload,folder);await atomicJSON(join(folder,'ATLAS_RELEASE.json'),bundle.manifest);}});
}
