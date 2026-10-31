import {mkdtemp,readFile,rm,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {extractRelease,validateBundle} from './archive.mjs';
import {requireThat} from './files.mjs';
export const operationalEntrypoints=Object.freeze(['production-web','collector-worker','registered-collector','fx-store','usage-operating-cli','deploy/bootstrap','deploy/apply','deploy/runtime-probe']);
export async function smokeRuntime(output,{kind='ATLAS_CI_RELEASE'}={}){
 const manifest=JSON.parse(await readFile(join(output,'release.json'),'utf8')),payload=await readFile(join(output,'release.tar'));
 validateBundle({'release.json':Buffer.from(JSON.stringify(manifest)),'release.tar':payload},{sha:manifest.commit,id:manifest.runId,attempt:manifest.attempt,component:manifest.component},{kind});
 const root=await realpath(await mkdtemp(join(tmpdir(),'atlas-runtime-smoke-')));
 try{
  await extractRelease(payload,root);
  // Import only; never invoke main/probe/run or connect to a database/provider.
  const code=`globalThis.fetch=()=>{throw Error('RUNTIME_NETWORK_DISABLED');};for(const p of ${JSON.stringify(operationalEntrypoints)})await import(new URL('./tools/'+p+'.mjs',${JSON.stringify(pathToFileURL(root+'/').href)}));console.log('RUNTIME_IMPORTS_READY');`;
  const {stdout}=await promisify(execFile)(process.execPath,['--permission','--allow-fs-read='+root,'--input-type=module','-e',code],{cwd:root,env:{PATH:process.env.PATH},timeout:30000,maxBuffer:65536});
  requireThat(stdout.trim()==='RUNTIME_IMPORTS_READY','RUNTIME_IMPORTS_FAILED');return {state:'RUNTIME_IMPORTS_READY',entrypoints:operationalEntrypoints.length,externalRequests:0};
 }finally{await rm(root,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{requireThat(process.argv.length===3,'RUNTIME_SMOKE_ARGUMENTS');console.log(JSON.stringify(await smokeRuntime(resolve(process.argv[2]))));}catch{console.error('RUNTIME_IMPORTS_FAILED');process.exitCode=1;}}
