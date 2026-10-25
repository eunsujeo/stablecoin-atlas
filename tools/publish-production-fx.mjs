import {open,rename,unlink,lstat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {readFX} from './fx-store.mjs';
export async function publishPublicFX(source,target){
  const parent=await lstat(dirname(target));if(!parent.isDirectory()||parent.isSymbolicLink())throw Error('PUBLIC_FX_DIRECTORY_INVALID');
  const projection=await readFX(source),temp=join(dirname(target),'.fx-'+randomUUID());let file;
  try{file=await open(temp,'wx',0o640);await file.chmod(0o640);await file.writeFile(JSON.stringify(projection));await file.sync();await file.close();file=null;await rename(temp,target);}
  finally{await file?.close();await unlink(temp).catch(()=>{});}
  return {state:'PUBLISHED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{if(process.argv.length!==4)throw Error();await publishPublicFX(...process.argv.slice(2));console.log('PUBLIC_FX_PUBLISHED');}
  catch{console.error('PUBLIC_FX_PUBLISH_FAILED: previous file preserved.');process.exitCode=1;}
}
