import {readFile,readdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadConfig} from './config.mjs';
import {timedDeployment} from './operation-timing.mjs';
import {reconcile} from './controller.mjs';
import {deploymentSource} from './source.mjs';
import {ROOT,STATE,operatingSystem,verifyInstallation,uidFor} from './system.mjs';
import {requireThat,atomicJSON,json,trusted} from './files.mjs';
export async function apply(){
 requireThat(process.platform==='linux'&&process.arch==='arm64'&&process.getuid()===0&&process.argv.length===2,'BROKER_CONTEXT');
 await trusted(ROOT,{directory:true});await trusted(STATE,{directory:true});const config=await loadConfig();requireThat(config.enabled,'AUTOMATION_DISABLED');await verifyInstallation();
 const enabled=await json('/etc/atlas-deploy/enabled.json');requireThat(enabled.configHash===(await import('./files.mjs')).hash(await readFile('/etc/atlas-deploy/config.json')),'BOOTSTRAP_NOT_VERIFIED');
 const github=await deploymentSource(config,{state:STATE,uidFor});
 const result=await reconcile({root:ROOT,state:STATE,config,github,ops:operatingSystem(config)});await atomicJSON(join(STATE,'latest.json'),result);
 // Only sanitized terminal reports, bounded retention. Versions/journal/claims are never pruned.
 const reports=(await readdir(join(STATE,'reports'))).filter(n=>/^\d+-\d+-(web|collector|usage)\.json$/.test(n)).sort((a,b)=>Number(a.split('-')[0])-Number(b.split('-')[0]));for(const n of reports.slice(0,-1000))await unlink(join(STATE,'reports',n));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await timedDeployment('apply',apply)));}catch(e){const reason=/^[A-Z_]{1,64}$/.test(e.message)?e.message:'BROKER_FAILED';console.error(JSON.stringify({state:'BLOCKED',reason}));process.exitCode=1;}}
