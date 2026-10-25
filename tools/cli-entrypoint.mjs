import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Node normally resolves the entry module's symlinks but leaves argv[1] as invoked.
// Canonicalize both sides, including when --preserve-symlinks-main is used.
export function isCLIEntrypoint(moduleURL,entry=process.argv[1]){
 if(!entry)return false;
 try{
  const url=new URL(moduleURL);
  if(url.protocol!=='file:'||url.search||url.hash)return false;
  return realpathSync(fileURLToPath(url))===realpathSync(entry);
 }catch{return false;}
}
