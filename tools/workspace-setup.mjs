import { open, mkdir, lstat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {boundedRead} from './evidence-store.mjs';
export async function setupWorkspace(root = new URL('../',import.meta.url)) {
  await mkdir(new URL('reports/',root),{recursive:true,mode:0o700});
  const destination=new URL('.env.local',root);
  try {
    const template=await boundedRead(new URL('.env.example',root),65536);
    // Exclusive creation preserves existing keys, including an intentionally empty file.
    const file=await open(destination,'wx',0o600);try{await file.writeFile(template);}finally{await file.close();}
    return 'CREATED';
  }catch(error){if(error.code!=='EEXIST')throw error;const stat=await lstat(destination);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('UNSAFE_ENV_PATH');return 'PRESERVED';}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{if(process.argv.length!==2)throw new Error();console.log(`Workspace ready; .env.local ${await setupWorkspace()}. Keys not read. Run npm run doctor, then npm run ui.`);}
  catch{console.error('Workspace setup failed; existing environment files were not overwritten.');process.exitCode=1;}
}
