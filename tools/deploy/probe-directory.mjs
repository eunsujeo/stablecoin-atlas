import {mkdir,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname} from 'node:path';
import {trusted,requireThat} from './files.mjs';

export const probeDirectory='/run/atlas-deploy-probes';
// The parent allows traversal only; each user's probe and reader.env remain 0700/0600.
// Permit the exact 0700 left by older bootstrap's umask, and no other permission drift.
export async function ensureProbeDirectory({path=probeDirectory,trust=trusted,uid=0}={}){
 await trust(dirname(path),{directory:true});
 try{await mkdir(path,{mode:0o711});}catch(e){if(e.code!=='EEXIST')throw e;}
 const file=await open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
 try{
  const s=await file.stat();requireThat(s.isDirectory()&&s.uid===uid&&[0o700,0o711].includes(s.mode&0o7777),'PROBE_DIRECTORY_UNSAFE');
  if((s.mode&0o7777)!==0o711){await file.chmod(0o711);await file.sync();}
 }finally{await file.close();}
 await trust(path,{directory:true});return path;
}
