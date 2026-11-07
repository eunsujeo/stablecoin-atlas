import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
const exec=promisify(execFile);
const units=['atlas-deploy-agent.service','atlas-deploy-apply.service'];
export function idleAction(s){
 if(!s||!['active','activating','deactivating','inactive','failed','reloading'].includes(s.ActiveState)||!/^\d+$/.test(s.MainPID??''))throw Error('MAINTENANCE_STATE_INVALID');
 if(s.MainPID!=='0')return 'WAIT';
 return s.ActiveState==='inactive'?'IDLE':s.ActiveState==='failed'?'RESET_FAILED':'WAIT';
}
export async function waitMaintenanceIdle({read,reset,sleep=ms=>new Promise(r=>setTimeout(r,ms)),attempts=120}={}){
 for(let i=0;i<attempts;i++){
  let idle=true;
  for(const unit of units){const action=idleAction(await read(unit));if(action!=='IDLE')idle=false;if(action==='RESET_FAILED')await reset(unit);}
  if(idle)return {state:'IDLE'};
  if(i+1<attempts)await sleep(2000);
 }
 throw Error('MAINTENANCE_BUSY');
}
export async function waitOperatingMaintenanceIdle(){
 return waitMaintenanceIdle({read:async unit=>{
  const {stdout}=await exec('/usr/bin/systemctl',['show',unit,'--property=ActiveState,MainPID'],{timeout:10000});
  return Object.fromEntries(stdout.trim().split('\n').map(line=>line.split('=')));
 },reset:unit=>exec('/usr/bin/systemctl',['reset-failed',unit],{timeout:10000})});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.getuid()!==0||process.argv.length!==2)throw Error('MAINTENANCE_CONTEXT');console.log(JSON.stringify(await waitOperatingMaintenanceIdle()));}
 catch(e){console.error(/^[A-Z_]+$/.test(e.message)?e.message:'MAINTENANCE_IDLE_FAILED');process.exitCode=1;}
}
