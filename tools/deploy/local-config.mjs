// Explicit migration plan only; never edits the installed configuration or enables a service.
import {open} from 'node:fs/promises';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadConfig,validateConfig,verifyConfiguredFile} from './config.mjs';
import {verifyInstallation,uidFor,requiredFiles} from './system.mjs';
import {sha,requireThat,trusted,syncDirectory} from './files.mjs';
export function localConfiguration(current,commit){
 requireThat(!current.enabled&&sha(commit),'LOCAL_CONFIG_ARGUMENTS');const result={...current,source:'LOCAL_GIT',bootstrapSha:commit,enabled:false};return validateConfig(result);
}
export async function prepareLocalConfiguration([commit,output,...extra]){
 requireThat(process.getuid()===0&&process.platform==='linux'&&process.arch==='arm64'&&!extra.length&&output,'LOCAL_CONFIG_CONTEXT');
 await trusted(dirname(output),{directory:true});await verifyInstallation();const current=await loadConfig(),config=localConfiguration(current,commit);for(const id of requiredFiles(config,'all'))await verifyConfiguredFile(id,config.files[id],{uidFor});
 const file=await open(output,'wx',0o600);try{await file.writeFile(JSON.stringify(config,null,2)+'\n');await file.sync();}finally{await file.close();}await syncDirectory(dirname(output));return {state:'LOCAL_PLAN_CREATED',commit,enabled:false,servicesChanged:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await prepareLocalConfiguration(process.argv.slice(2))));}catch(e){console.error(/^[A-Z_]{1,64}$/.test(e.message)?e.message:'LOCAL_CONFIG_FAILED');process.exitCode=1;}}
