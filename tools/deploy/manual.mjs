// Legacy operator interface under the same OS flock as the pull broker.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
import {loadConfig,destinations} from './config.mjs';
import {githubToken} from './github-token.mjs';
import {githubClient} from './github.mjs';
import {activateRelease,pointer} from '../release-switch.mjs';
import {stageVerified} from './stage.mjs';
import {operatingSystem,ROOT,STATE,verifyInstallation} from './system.mjs';
import {sha,requireThat,json,atomicJSON} from './files.mjs';
import {reconcile} from './controller.mjs';
export async function performManual({command,candidate,root,state,ops,stage,repair,store=atomicJSON}){
 requireThat(candidate.component==='web','WEB_CANDIDATE_REQUIRED');
 const pending=await json(join(state,'transaction.json'),null);requireThat(!pending||pending.terminal,'RECOVERY_REQUIRED');
 if(pending?.phase==='COMMITTED'&&pending.result){requireThat(repair,'COMMITTED_REPAIR_REQUIRED');const repaired=await repair();requireThat(!repaired.notification,'REPORT_RECOVERY_REQUIRED');}
 const versions=await json(join(state,'versions.json'),{schemaVersion:1,web:{},collector:{},usage:{}}),old=await ops.current('web');
 const tx={schemaVersion:1,candidate,old,previousVersion:{...versions.web},phase:command==='stage'?'STAGING':'SWITCHING',terminal:false,manual:true};
 await store(join(state,'transaction.json'),tx);let result,error;
 try{
  await ops.preflight('web');
  if(command==='stage'){await stage();await store(join(state,'transaction.json'),{...tx,phase:'STAGED',terminal:true});return {state:'STAGED',commit:candidate.sha};}
  await activateRelease({root,sha:candidate.sha,lockHeld:true,restart:()=>ops.restart('web'),stop:()=>ops.stop('web'),health:async s=>{try{await ops.health('web',s);return true;}catch{return false;}}});
  result={state:'SUCCESS',current:candidate.sha,lastSuccess:candidate.sha,previous:old,service:await ops.service('web'),reason:null};
 }catch(e){
  error=e;const current=await ops.current('web');
  let healthy=current===old;try{if(healthy){if(old)await ops.health('web',old);else await ops.stop('web');}}catch{healthy=false;}
  if(!healthy){await store(join(state,'transaction.json'),{...tx,phase:'RECOVERY_BLOCKED',terminal:false});throw e;}
  result={state:'FAILED',current,lastSuccess:versions.web.lastSuccess??old,service:await ops.service('web').catch(()=>'unknown'),reason:/^[A-Z_]{1,64}$/.test(e.message)?e.message:'RELEASE_FAILED'};
 }
 // A completed activation is durable before cache publication, exactly like automated deployment.
 await store(join(state,'transaction.json'),{...tx,phase:'COMMITTED',terminal:true,result});
 versions.web={...versions.web,...result};
 try{await store(join(state,'versions.json'),versions);}catch{if(error)throw error;return {...result,reason:'VERSION_CACHE_PENDING'};}
 if(error)throw error;return result;
}
export async function manual(args){
 requireThat(process.platform==='linux'&&process.arch==='arm64'&&process.getuid()===0&&args.length===2,'RELEASE_ARGUMENTS_INVALID');const [command,value]=args;requireThat(['stage','activate','rollback'].includes(command)&&(command==='rollback'?value==='previous':sha(value)),'RELEASE_ARGUMENTS_INVALID');
 const config=await loadConfig();await verifyInstallation();const ops=operatingSystem(config),credentials=parseEnv(await readFile(destinations.github,'utf8')),github=githubClient({repository:config.repository,token:await githubToken(credentials)});
 const target=command==='rollback'?await pointer(ROOT,'previous'):value;requireThat(sha(target),'RELEASE_INVALID');
 const c=command==='stage'?await github.candidate(config):await json(join(ROOT,'releases',target,'ATLAS_RELEASE.json'),{runId:0,attempt:0});
 requireThat(c&&(command!=='stage'||c.sha===target),'SUCCESSFUL_CI_REQUIRED');const candidate=command==='stage'?c:{sha:target,id:c.runId,attempt:c.attempt,component:'web',url:`https://github.com/${config.repository}/actions/runs/${c.runId}/attempts/${c.attempt}`};
 return performManual({command,candidate,root:ROOT,state:STATE,ops,stage:async()=>stageVerified(ROOT,target,await github.bundle(c)),repair:()=>reconcile({root:ROOT,state:STATE,config,github,ops,repairOnly:true})});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await manual(process.argv.slice(2))));}catch(e){console.error(/^[A-Z_]{1,64}$/.test(e.message)?e.message:'RELEASE_FAILED');process.exitCode=1;}}
