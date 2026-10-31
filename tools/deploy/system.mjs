import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,unlink,readFile,lstat,chown,chmod,rm,statfs,realpath} from 'node:fs/promises';
import {ensureProbeDirectory} from './probe-directory.mjs';
import {childIdentity} from './child-identity.mjs';
import {checkTriggerRule,triggerRulePath} from './trigger-rule.mjs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pointer,point} from '../release-switch.mjs';
import {deploymentRuntimeSupported} from '../collector-deploy.mjs';
import {waitForWebRelease} from './web-health.mjs';
import {destinations,verifyConfiguredFile,collectorFiles,usageFiles} from './config.mjs';
import {hash,hex,requireThat,trusted,json,inventory,atomicJSON,syncDirectory} from './files.mjs';
const exec=promisify(execFile);
export const ROOT='/opt/stablecoin-atlas',STATE='/var/lib/atlas-deploy',INSTALL='/usr/local/lib/atlas-deploy';
const systemctl=(...args)=>exec('/usr/bin/systemctl',args,{timeout:90000,maxBuffer:65536});
export async function uidFor(name){requireThat(['root','atlascollector','atlasweb','atlaspull'].includes(name),'USER_INVALID');const{stdout}=await exec('/usr/bin/id',['-u',name]);const uid=Number(stdout.trim());requireThat(Number.isSafeInteger(uid)&&uid>=0&&(name==='root'||uid>0),'USER_INVALID');return uid;}
export async function verifyInstallation(){
 const bootstrapJournal=join(STATE,'bootstrap-install.json');try{await trusted(bootstrapJournal,{privateFile:true});requireThat(['COMMITTED','ROLLED_BACK'].includes((await json(bootstrapJournal)).phase),'BOOTSTRAP_INSTALL_PENDING');}catch(e){if(e.code!=='ENOENT')throw e;}
 const receipt=await trusted('/etc/atlas-deploy/control-plane.json',{privateFile:true,limit:16*1024*1024});const expected=await json(receipt);await trusted(INSTALL,{directory:true});const actual=await inventory(INSTALL);requireThat(JSON.stringify(actual)===JSON.stringify(expected.files),'CONTROL_PLANE_CHANGED');
 for(const name of Object.keys(actual))await trusted(join(INSTALL,name),{limit:32*1024*1024});
 for(const [path,digest]of Object.entries(expected.units)){await trusted(path,{limit:65536});requireThat(hash(await readFile(path))===digest,'UNIT_CHANGED');}return expected;
}
export function services(config,component){
 if(component==='web')return ['atlas-web.service'];if(component==='usage')return ['atlas-usage.timer','atlas-usage.service'];
 const id=config.components.collector.selection;requireThat(hex(id),'SELECTION_REQUIRED');const registered=config.components.collector.registeredUnit??'atlas-registered-collector@'+id+'.service';requireThat(registered==='atlas-registered-collector.service'||registered==='atlas-registered-collector@'+id+'.service','REGISTERED_UNIT_INVALID');return ['atlas-fx.timer','atlas-collector.service',registered,'atlas-fx.service'];
}
export function parseUnitState(stdout,unit){
 const fields=Object.fromEntries(stdout.trim().split('\n').filter(Boolean).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
 if(unit.endsWith('.timer')){fields.MainPID='0';fields.Type='timer';fields.Result??='success';}
 requireThat(fields.LoadState==='loaded'&&['active','inactive','failed','activating','deactivating'].includes(fields.ActiveState)&&/^\d+$/.test(fields.MainPID),'UNIT_STATE_INVALID');return fields;
}
export async function unitState(unit,{allowMissing=false}={}){let stdout;try{({stdout}=await systemctl('show',unit,'--property=LoadState,ActiveState,SubState,MainPID,Result,User,WorkingDirectory,FragmentPath,DropInPaths,Type,Unit,TimersCalendar,Persistent,NextElapseUSecRealtime,LastTriggerUSec'));}catch(e){if(allowMissing&&/^LoadState=not-found$/m.test(e.stdout??''))return null;throw e;}if(allowMissing&&/^LoadState=not-found$/m.test(stdout))return null;return parseUnitState(stdout,unit);}
export function timerDefinition(s){return {unit:s.Unit,persistent:s.Persistent,calendar:[...(s.TimersCalendar??'').matchAll(/OnCalendar=([^;}]+)/g)].map(m=>m[1].trim().replace(/\s+/g,' ')).join('|')};}
export function validateTimer(unit,s,config){
 requireThat(s.Unit===unit.replace('.timer','.service')&&s.Type==='timer'&&!['failed','activating','deactivating'].includes(s.ActiveState),'TIMER_CONFIGURATION');
 if(unit==='atlas-usage.timer')requireThat(s.Persistent==='no'&&s.TimersCalendar?.includes('00:20:00')&&s.TimersCalendar.includes('UTC'),'USAGE_TIMER_POLICY');
 const pin=config.timers?.[unit];if(pin)requireThat(JSON.stringify(timerDefinition(s))===JSON.stringify(pin),'TIMER_CONFIGURATION');
}
export async function validateResumeWindow(component,before,{now=Date.now(),confirmedFX=async()=>false,usageAuthorization}={}){
 for(const [unit,s]of Object.entries(before)){if(s.ActiveState!=='active'||!unit.endsWith('.timer'))continue;
  if(s.Persistent==='yes'){const next=Date.parse(s.NextElapseUSecRealtime);requireThat(Number.isFinite(next),'TIMER_WINDOW_UNKNOWN');if(next<=now)requireThat(await confirmedFX(new Date(now).toISOString().slice(0,10)),'TIMER_CATCHUP_BLOCKED');}
 }
 if(component==='usage'&&usageAuthorization){const day=new Date(now).toISOString().slice(0,10);requireThat(day>=usageAuthorization.fromDay&&day<usageAuthorization.untilExclusive,'USAGE_AUTHORIZATION_EXPIRED');}
}
export function requiredFiles(config,component){const common=['ca',...(config.source==='LOCAL_GIT'?[]:['github',...(config.files.githubKey?['githubKey']:[])])];return component==='all'?(config.source==='LOCAL_GIT'?['reader','web','ca']:Object.keys(config.files)):[...common,...(component==='web'?['reader','web']:component==='collector'?collectorFiles:usageFiles)];}
export function operatingSystem(config){
 const barrier=c=>join(STATE,'quiesce-'+c),link=c=>c==='web'?'current':c==='collector'?'collector-current':'usage-current';
 async function snapshot(c){const result={};for(const u of services(config,c))result[u]=await unitState(u);return result;}
 async function quiesce(c){
  requireThat(c!=='web','QUIESCE_INVALID');await atomicJSON(barrier(c),{state:'QUIESCED'});
  const units=services(config,c);for(const u of units){let s=await unitState(u);if(s.Type==='oneshot'){const end=Date.now()+(c==='usage'?620000:60000);while(['active','activating','deactivating'].includes(s.ActiveState)&&Date.now()<end){await new Promise(r=>setTimeout(r,1000));s=await unitState(u);}requireThat(['inactive','failed'].includes(s.ActiveState)&&s.MainPID==='0','ONESHOT_NOT_DRAINED');}else await systemctl('stop',u);}
  for(const u of units){const s=await unitState(u);requireThat(['inactive','failed'].includes(s.ActiveState)&&s.MainPID==='0','SERVICE_NOT_QUIESCENT');}
  for(const path of c==='collector'?['/var/lib/atlas-collector/fx-store/.writer-lock']:[]){try{await lstat(path);throw Error('PERSISTENT_SEND_LOCK');}catch(e){if(e.code!=='ENOENT')throw e;}}
 }
 async function runProbe(c,{hold=false}={}){
  let temp,envFile='unused';const user=c==='web'?'atlasweb':'atlascollector';
  if(c==='web'){await ensureProbeDirectory();temp='/run/atlas-deploy-probes/probe-'+randomUUID();await mkdir(temp,{mode:0o700});await chown(temp,await uidFor(user),-1);envFile=join(temp,'reader.env');await writeFile(envFile,await readFile(destinations.reader),{mode:0o600,flag:'wx'});await chown(envFile,await uidFor(user),-1);}
  const identity=await childIdentity(user),options={...identity,env:{PATH:'/usr/bin:/bin'}};
  const args=['--max-old-space-size=256',join(INSTALL,'tools/deploy/runtime-probe.mjs'),c,config.components.collector.selection??'unused',envFile,...(hold?['hold']:[])];
  if(!hold){try{const {stdout}=await exec('/usr/bin/node',args,{...options,timeout:120000,maxBuffer:65536});requireThat(JSON.parse(stdout).state==='READY','PREFLIGHT_DATABASE');}catch(e){throw Error(/^[A-Z_]{1,64}$/.test((e.stderr??'').trim())?e.stderr.trim():'DATABASE_PROBE_FAILED');}finally{if(temp)await rm(temp,{recursive:true,force:true});}return;}
  const p=spawn('/usr/bin/node',args,{...options,stdio:['pipe','pipe','pipe']}),exit=new Promise(resolve=>p.once('exit',resolve));let data='';
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{p.kill('SIGTERM');reject(Error('PROBE_TIMEOUT'));},120000);p.once('error',()=>{clearTimeout(timer);reject(Error('PROBE_FAILED'));});p.once('exit',()=>{clearTimeout(timer);reject(Error('PROBE_FAILED'));});p.stdout.on('data',b=>{data+=b.toString();if(data.length>65536){p.kill('SIGTERM');clearTimeout(timer);reject(Error('PROBE_LIMIT'));}if(data.includes('\n')){clearTimeout(timer);try{requireThat(JSON.parse(data.split('\n')[0]).state==='READY','PROBE_FAILED');resolve();}catch{p.kill('SIGTERM');reject(Error('PROBE_FAILED'));}}});p.stderr.resume();});
  return {release:async()=>{p.stdin.end('\n');const timer=setTimeout(()=>p.kill('SIGTERM'),5000);try{requireThat(await exit===0,'PROBE_SESSION_LOST');}finally{clearTimeout(timer);}}};
 }
 async function preflight(component){
  const checks=[];let bad=false;const check=async(id,fn)=>{try{await fn();checks.push({id,state:'READY'});}catch(e){bad=true;checks.push({id,state:'FAILED',reason:/^[A-Z_]{1,64}$/.test(e.message)?e.message:'CHECK_FAILED'});}};
  await check('runtime',async()=>requireThat(process.platform==='linux'&&process.arch==='arm64'&&deploymentRuntimeSupported(),'RUNTIME_UNSUPPORTED'));
  await check('control-plane',verifyInstallation);for(const name of ['.stage-lock','.deployment-lock'])await check('legacy-lock:'+name,async()=>{try{await lstat(join(ROOT,name));throw Error('LEGACY_DEPLOY_LOCK');}catch(e){if(e.code!=='ENOENT')throw e;}});await check('disk',async()=>{const s=await statfs(ROOT,{bigint:true});requireThat(s.bavail*s.bsize>=1073741824n,'DISK_SPACE_LOW');});
  if(component==='all')await check('trigger-policy',async()=>checkTriggerRule({expectedHash:(await json('/etc/atlas-deploy/control-plane.json')).units?.[triggerRulePath]}));
  for(const id of requiredFiles(config,component))await check('file:'+id,()=>verifyConfiguredFile(id,config.files[id],{uidFor}));
  for(const c of component==='all'?['web','collector','usage']:[component])if(config.components[c].enabled){for(const unit of services(config,c))await check('unit:'+unit,async()=>{const s=await unitState(unit);if(unit.endsWith('.timer')){validateTimer(unit,s,config);return;}requireThat(s.User===(c==='web'?'atlasweb':'atlascollector')&&s.WorkingDirectory===join(ROOT,link(c))&&!['failed','activating','deactivating'].includes(s.ActiveState),'UNIT_CONFIGURATION');if(s.MainPID!=='0'){const current=await pointer(ROOT,link(c));requireThat(await realpath('/proc/'+s.MainPID+'/cwd')===join(ROOT,'releases',current),'RUNNING_VERSION_MISMATCH');}});}
  await check('pointer:web',()=>pointer(ROOT,'current'));if(!['web','all'].includes(component))await check('pointer:'+component,()=>pointer(ROOT,link(component)));
  // Probe all enabled components during bootstrap; an ordinary web rollout never stops writers.
  const targets=component==='all'?['web','collector','usage'].filter(c=>config.components[c].enabled):[component];
  for(const c of targets)await check('database:'+c,()=>runProbe(c));
  if(component==='all')await check('rollback-baseline',async()=>{const current=await pointer(ROOT,'current');requireThat(current,'CURRENT_RELEASE_REQUIRED');await health('web',current);});
  return {state:bad?'FAILED':'READY',checks,providerRequests:0};
 }
 async function health(c,revision){
  if(c==='web'){const web=JSON.parse(await readFile(destinations.web));await waitForWebRelease({sha:revision,release:join(ROOT,'releases',revision),config:web});}
  else{await new Promise(r=>setTimeout(r,5000));for(const u of services(config,c)){const s=await unitState(u);requireThat(!['failed','activating','deactivating'].includes(s.ActiveState)&&s.Result==='success','SERVICE_UNHEALTHY');if(s.MainPID!=='0')requireThat(await realpath('/proc/'+s.MainPID+'/cwd')===join(ROOT,'releases',revision),'RUNNING_VERSION_MISMATCH');}requireThat(await pointer(ROOT,link(c))===revision,'POINTER_MISMATCH');}
 }
 return {snapshot,quiesce,hold:async c=>{for(const id of requiredFiles(config,c))await verifyConfiguredFile(id,config.files[id],{uidFor});return runProbe(c,{hold:true});},preflight:async c=>{const r=await preflight(c);await atomicJSON(join(STATE,'preflight-'+c+'.json'),r);const failed=r.checks.find(s=>s.state==='FAILED');if(failed){const id=failed.id.replace(/@[a-f0-9]+/g,'_INSTANCE').replace(/[^a-zA-Z_]/g,'_').toUpperCase();throw Error(('PREFLIGHT_'+id+'_'+failed.reason).slice(0,64));}},preflightReport:preflight,
  current:c=>pointer(ROOT,link(c)),setPointer:(c,s)=>point(ROOT,link(c),s),restore:async(c,s)=>{await point(ROOT,link(c),s);if(c==='web'){await systemctl('reset-failed','atlas-web.service');await systemctl('restart','atlas-web.service');}},
  restart:async()=>{await systemctl('reset-failed','atlas-web.service');await systemctl('restart','atlas-web.service');},stop:async c=>{for(const u of services(config,c)){await systemctl('stop',u);const s=await unitState(u);requireThat(['inactive','failed'].includes(s.ActiveState)&&s.MainPID==='0','SERVICE_NOT_STOPPED');}},
  clearPointer:async(c,expected)=>{const current=await pointer(ROOT,link(c));requireThat(current===null||current===expected,'POINTER_CHANGED');if(current){await unlink(join(ROOT,link(c)));await syncDirectory(ROOT);}},
  resume:async(c,before)=>{await validateResumeWindow(c,before,{usageAuthorization:c==='usage'?JSON.parse(await readFile(destinations.usageAuthorization)):undefined,confirmedFX:async day=>{try{const p=JSON.parse(await readFile('/var/lib/atlas-collector/fx-store/receipts/'+day+'.json'));(await import('../../web/fx-model.js')).validateFX(p);const claim=JSON.parse(await readFile('/var/lib/atlas-collector/fx-store/claims/'+day+'.json'));return claim.day===day&&hash(await readFile('/var/lib/atlas-collector/fx-store/archive/'+p.sourceHash+'.xml'))===p.sourceHash;}catch{return false;}}});await unlink(barrier(c));await syncDirectory(STATE);for(const [u,s]of Object.entries(before)){requireThat(services(config,c).includes(u),'UNIT_INVALID');if(s.ActiveState==='active'&&s.Type!=='oneshot'){await systemctl('start',u);const now=await unitState(u);requireThat(now.ActiveState==='active'&&(!u.endsWith('.service')||now.MainPID!=='0'),'SERVICE_NOT_RESUMED');}}},
  leaveStopped:async c=>{await atomicJSON(barrier(c),{state:'RECOVERY_BLOCKED'});},health,
  service:async c=>{const states=await snapshot(c);return Object.values(states).some(s=>s.ActiveState==='failed')?'failed':Object.values(states).some(s=>s.ActiveState==='active')?'active':'inactive';}};
}
