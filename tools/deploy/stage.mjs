import {join} from 'node:path';
import {lstat,readFile,readdir,rmdir} from 'node:fs/promises';
import {stageRelease} from '../release-stage.mjs';
import {extractRelease} from './archive.mjs';
import {atomicJSON,json,requireThat} from './files.mjs';
export async function stageVerified(root,commit,bundle){
 const target=join(root,'releases',commit);let absent=false;
 try{const s=await lstat(target);requireThat(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid(),'RELEASE_INVALID');if((await readdir(target)).length===0){await rmdir(target);absent=true;}else{requireThat((await readFile(join(target,'REVISION'),'utf8')).trim()===commit,'RELEASE_INVALID');const m=await json(join(target,'ATLAS_RELEASE.json'));requireThat(m.payloadHash===bundle.manifest.payloadHash,'RELEASE_CONFLICT');return {state:'STAGED',commit,reused:true};}}
 catch(e){if(e.code!=='ENOENT')throw e;try{await lstat(target);throw Error('RELEASE_INVALID');}catch(e2){if(e2.code!=='ENOENT')throw e2;}absent=true;}
 requireThat(absent,'RELEASE_INVALID');return stageRelease({root,sha:commit,lockHeld:true,prepare:async folder=>{await extractRelease(bundle.payload,folder);await atomicJSON(join(folder,'ATLAS_RELEASE.json'),bundle.manifest);}});
}
