import {open,rename,unlink,lstat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {isCLIEntrypoint} from './cli-entrypoint.mjs';
import {readFX} from './fx-store.mjs';
import {boundedRead} from './evidence-store.mjs';
import {validateFX,usableFX} from '../web/fx-model.js';
const fields=['schemaVersion','kind','base','date','usdPerEUR','krwPerEUR','sourceHash','fetchedAt','importedAt'];
function publicProjection(value){
  validateFX(value);return Object.fromEntries(fields.map(key=>[key,value[key]]));
}
export async function readPublicFX(path,{now=Date.now()}={}){
  const p=publicProjection(JSON.parse((await boundedRead(path,32768)).toString('utf8')));
  if(!usableFX(p,now))throw Error('PUBLIC_FX_EXPIRED');return p;
}
export async function publishPublicFX(source,target){
  const parent=await lstat(dirname(target));if(!parent.isDirectory()||parent.isSymbolicLink())throw Error('PUBLIC_FX_DIRECTORY_INVALID');
  const projection=publicProjection(await readFX(source)),temp=join(dirname(target),'.fx-'+randomUUID());let file;
  try{file=await open(temp,'wx',0o640);await file.chmod(0o640);await file.writeFile(JSON.stringify(projection));await file.sync();await file.close();file=null;await rename(temp,target);}
  finally{await file?.close();await unlink(temp).catch(()=>{});}
  let dir;
  try{dir=await open(dirname(target),'r');await dir.sync();await dir.close();dir=null;}
  catch{throw Error('PUBLIC_FX_DURABILITY_UNCONFIRMED');}
  finally{await dir?.close().catch(()=>{});}
  return {state:'PUBLISHED'};
}
if(isCLIEntrypoint(import.meta.url)){
  try{if(process.argv.length!==4)throw Error();await publishPublicFX(...process.argv.slice(2));console.log('PUBLIC_FX_PUBLISHED');}
  catch(e){console.error(e.message==='PUBLIC_FX_DURABILITY_UNCONFIRMED'?'PUBLIC_FX_DURABILITY_UNCONFIRMED: file replaced; directory sync failed.':'PUBLIC_FX_PUBLISH_FAILED: previous file preserved.');process.exitCode=1;}
}
