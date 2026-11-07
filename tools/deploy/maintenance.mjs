import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const admin='/usr/local/sbin/atlas-deploy-admin';
export function maintenanceCommand(args){
 if(args.length!==1)throw Error('MAINTENANCE_ARGUMENTS');
 switch(args[0]){
  case 'status':return ['/usr/bin/systemctl',['show','--property=Id,ActiveState,SubState,MainPID,Result','atlas-deploy-apply.service','atlas-deploy-agent.timer','atlas-yahoo-fx.timer','atlas-web.service']];
  case 'verify':return [admin,['verify','--config','/etc/atlas-deploy/config.json']];
  case 'enable':return [admin,['enable','--config','/etc/atlas-deploy/config.json']];
  case 'deploy':return ['/usr/bin/systemctl',['start','--no-block','atlas-deploy-apply.service']];
  // This is a one-time, reviewed, SHA-pinned job, not a user-supplied script/path.
  case 'finish-yahoo-fx':return ['/usr/bin/bash',['/usr/local/libexec/atlas-maintenance/finish-yahoo-fx.sh']];
  default:throw Error('MAINTENANCE_ARGUMENTS');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [command,args]=maintenanceCommand(process.argv.slice(2));
  if(process.getuid()!==0||process.platform!=='linux')throw Error('MAINTENANCE_CONTEXT');
  const child=spawn(command,args,{stdio:'inherit',env:{...process.env,PATH:'/usr/sbin:/usr/bin:/sbin:/bin',NODE_OPTIONS:'',NODE_PATH:'',NODE_TLS_REJECT_UNAUTHORIZED:'1'}});
  child.on('error',()=>{console.error('MAINTENANCE_EXEC_FAILED');process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
 }catch(e){console.error(/^[A-Z_]+$/.test(e.message)?e.message:'MAINTENANCE_FAILED');process.exitCode=1;}
}
