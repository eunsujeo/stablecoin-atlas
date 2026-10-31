// Explicit one-time root bootstrap. No command starts/stops an existing web/collector service.
import {readFile,lstat,mkdir,writeFile,chmod,symlink,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {stageVerified} from './stage.mjs';
import {pointer,release} from '../release-switch.mjs';
import {loadConfig,validateConfig,destinations,verifyConfiguredFile} from './config.mjs';
import {githubToken} from './github-token.mjs';
import {githubClient} from './github.mjs';
import {artifactCache} from './artifact-cache.mjs';
import {timedDeployment} from './operation-timing.mjs';
import {bootstrapLayout,preflightInstallPaths,prospectiveTrusted,recoverBootstrapInstall,publishBootstrapInstall} from './bootstrap-install.mjs';
import {bootstrapLease} from './bootstrap-lease.mjs';
import {ensureProbeDirectory} from './probe-directory.mjs';
import {provision} from './vault.mjs';
import {extractRelease} from './archive.mjs';
import {uidFor,unitState,timerDefinition,operatingSystem,ROOT,STATE,INSTALL,services,verifyInstallation} from './system.mjs';
import {hash,requireThat,trusted,inventory,atomicJSON,json,syncDirectory} from './files.mjs';
const exec=promisify(execFile),unitDir='/etc/systemd/system';
export async function assertBootstrapIdle(readState=unitState){
 for(const unit of ['atlas-deploy-agent.timer','atlas-deploy-apply.service']){const s=await readState(unit,{allowMissing:true});if(s)requireThat(s.ActiveState==='inactive'&&s.MainPID==='0',unit.endsWith('.timer')?'STOP_AUTOMATION_BEFORE_UPGRADE':'BOOTSTRAP_APPLY_ACTIVE');}
}
export async function effectiveUnitPaths(config,readState=unitState){
 const paths=new Set();for(const component of ['web','collector','usage'])if(config.components[component].enabled)for(const name of services(config,component)){const s=await readState(name,{allowMissing:true});if(s)for(const path of [s.FragmentPath,...(s.DropInPaths??'').split(/\s+/)].filter(Boolean))paths.add(path);}return [...paths];
}
async function collectorStatePreflight(config){
 const paths=[...(config.components.collector.enabled?['/var/lib/atlas-collector','/var/lib/atlas-collector/receipts','/var/lib/atlas-collector/archive','/var/lib/atlas-collector/market-store']:[]),...(config.components.usage.enabled?['/var/lib/atlas-usage']:[])];
 if(paths.length){const uid=await uidFor('atlascollector');for(const path of paths){const s=await lstat(path);requireThat(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===uid&&!(s.mode&0o077),'STATE_DIRECTORY_UNSAFE');}}
}
export async function unitPlan({source,config,read=readFile,stat=lstat}){
 const result=[];for(const name of ['atlas-deploy-agent.service','atlas-deploy-agent.timer','atlas-deploy-apply.service'])result.push({path:join(unitDir,name),bytes:await read(join(source,'deploy',name))});
 for(const component of ['collector','usage']){
  const all=component==='collector'?(config.components.collector.selection?services(config,component):['atlas-collector.service','atlas-fx.service']):['atlas-usage.service'];
  for(const name of all.filter(n=>n.endsWith('.service')))result.push({path:join(unitDir,name+'.d','90-atlas-deploy-barrier.conf'),bytes:Buffer.from('[Unit]\nConditionPathExists=!'+STATE+'/quiesce-'+component+'\n')});
 }
 // Preserve existing base units; create only missing known units, with production working-directory drop-ins.
 const bases=['atlas-web.service','atlas-collector.service','atlas-registered-collector@.service','atlas-fx.service','atlas-fx.timer','atlas-usage.service','atlas-usage.timer'];
 if(config.components.collector.registeredUnit==='atlas-registered-collector.service')bases.push('atlas-registered-collector.service');
 for(const name of bases){try{await stat(join(unitDir,name));}catch(e){if(e.code!=='ENOENT')throw e;const template=name==='atlas-registered-collector.service'?'atlas-registered-collector@.service':name;let bytes=await read(join(source,'deploy',template));if(name==='atlas-registered-collector.service')bytes=Buffer.from(bytes.toString().replaceAll('%i',config.components.collector.selection));result.push({path:join(unitDir,name),bytes});const dropin={'atlas-collector.service':'atlas-collector.service','atlas-registered-collector@.service':'atlas-registered-collector@.service','atlas-registered-collector.service':'atlas-registered-collector@.service','atlas-fx.service':'atlas-fx.service'}[name];if(dropin)result.push({path:join(unitDir,name+'.d','production.conf'),bytes:await read(join(source,'deploy',dropin+'.d/production.conf'))});}}
 result.push({path:'/etc/tmpfiles.d/atlas-deploy.conf',bytes:await read(join(source,'deploy/atlas-deploy.tmpfiles'))},{path:'/etc/polkit-1/rules.d/50-atlas-deploy.rules',bytes:await read(join(source,'deploy/atlas-deploy.rules'))},{path:'/etc/logrotate.d/atlas-deploy',bytes:await read(join(source,'deploy/atlas-deploy.logrotate'))});
 for(const r of result){try{const s=await stat(r.path);requireThat(s.isFile()&&!s.isSymbolicLink(),'UNIT_UNSAFE');requireThat(hash(await read(r.path))===hash(r.bytes),'EXISTING_UNIT_CONFLICT');}catch(e){if(e.code!=='ENOENT')throw e;}}
 return result;
}
export async function bootstrap(args){
 requireThat(process.platform==='linux'&&process.arch==='arm64'&&process.getuid()===0,'BOOTSTRAP_CONTEXT');const [command,flag,path,...extra]=args;requireThat(!extra.length&&['inspect','plan','install','verify','enable','disable','provision','seal','status','recover'].includes(command),'BOOTSTRAP_ARGUMENTS');
 if(command==='inspect'){
  requireThat(flag==='--output'&&path,'BOOTSTRAP_ARGUMENTS');await trusted(dirname(path),{directory:true});await trusted(destinations.github,{privateFile:true});const env=parseEnv(await readFile(destinations.github,'utf8')),token=await githubToken(env);
  const response=async endpoint=>{const r=await fetch('https://api.github.com/repos/eunsujeo/stablecoin-atlas'+endpoint,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});requireThat(r.ok,'GITHUB_BOOTSTRAP_FAILED');const {boundedResponse}=await import('./github.mjs');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedResponse(r)));};
  const repo=await response(''),workflow=await response('/actions/workflows/production.yml'),remote=await response('/contents/.github/workflows/production.yml?ref=main');const local=await readFile(new URL('../../.github/workflows/production.yml',import.meta.url)),blob=createHash('sha1').update(Buffer.from('blob '+local.length+'\0')).update(local).digest('hex');requireThat(remote.sha===blob,'LOCAL_WORKFLOW_NOT_REVIEWED_MAIN');
  const c={schemaVersion:1,repository:'eunsujeo/stablecoin-atlas',repositoryId:repo.id,workflowId:workflow.id,workflowBlob:blob,enabled:false,components:{web:{enabled:true},collector:{enabled:false},usage:{enabled:false}},files:{}};
  const collectorUid=await uidFor('atlascollector');for(const [id,file]of Object.entries(destinations)){try{const s=await lstat(file);requireThat(s.isFile()&&!s.isSymbolicLink()&&[0,collectorUid].includes(s.uid)&&[0o600,0o644].includes(s.mode&0o7777),'EXISTING_FILE_UNSAFE');c.files[id]={sha256:hash(await readFile(file)),owner:s.uid===0?'root':'atlascollector',mode:s.mode&0o7777};}catch(e){if(e.code!=='ENOENT')throw e;}}
  const {stdout:loaded}=await exec('/usr/bin/systemctl',['list-units','--all','--type=service','--no-legend','--plain']);const {stdout:defined}=await exec('/usr/bin/systemctl',['list-unit-files','atlas-registered-collector*.service','--no-legend','--no-pager']);const stdout=loaded+'\n'+defined;const names=[...new Set(stdout.split('\n').map(s=>s.trim().split(/\s+/)[0]).filter(s=>/^atlas-registered-collector(?:@[a-f0-9]{64})?\.service$/.test(s)))];requireThat(names.length<=1,'REGISTERED_UNIT_AMBIGUOUS');if(names.length){const {stdout:command}=await exec('/usr/bin/systemctl',['show',names[0],'--property=ExecStart','--value']);const selection=/--selection(?:=|\s+)([a-f0-9]{64})/.exec(command)?.[1]??/@([a-f0-9]{64})/.exec(names[0])?.[1];requireThat(selection,'SELECTION_REQUIRED');Object.assign(c.components.collector,{selection,registeredUnit:names[0]});}
  c.timers={};for(const unit of ['atlas-fx.timer','atlas-usage.timer']){try{c.timers[unit]=timerDefinition(await unitState(unit));}catch{if(unit==='atlas-fx.timer')c.timers[unit]={unit:'atlas-fx.service',persistent:'yes',calendar:'*-*-* 00:10:00 UTC'};}}
  const client=githubClient({repository:c.repository,token,cache:artifactCache(join(STATE,'artifacts'))}),candidate=await client.candidate(c);requireThat(candidate,'SUCCESSFUL_CI_REQUIRED');const ready=await client.bundle(candidate);c.bootstrapSha=candidate.sha;c.components.collector.policyHash=ready.manifest.policies.collector;c.components.usage.policyHash=ready.manifest.policies.usage;
  validateConfig(c);const f=await (await import('node:fs/promises')).open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(c,null,2)+'\n');await f.sync();}finally{await f.close();}return {state:'INSPECTED_DISABLED',privateValuesPrinted:false,servicesChanged:0};
 }
 if(command==='provision'){requireThat(flag==='--manifest'&&path,'BOOTSTRAP_ARGUMENTS');await trusted(path,{privateFile:true});const m=await json(path);return provision({manifest:m,sealed:join(dirname(path),'sealed'),uidFor});}
 requireThat(flag==='--config'&&path,'BOOTSTRAP_ARGUMENTS');await trusted(path,{privateFile:true});const input=validateConfig(await json(path));
 if(command==='status'){const config=await loadConfig(),ops=operatingSystem(config),units={};for(const component of ['web','collector','usage']){try{units[component]=await ops.snapshot(component);}catch{units[component]={state:'NOT_CONFIGURED'};}}return {versions:await json(join(STATE,'versions.json'),{}),transaction:await json(join(STATE,'transaction.json'),null),units};}
 if(command==='recover'){const config=await loadConfig();await (await import('./system.mjs')).verifyInstallation();for(const [id,spec]of Object.entries(config.files))await verifyConfiguredFile(id,spec,{uidFor});const tx=await json(join(STATE,'transaction.json'));requireThat(tx.phase==='RECOVERY_BLOCKED'&&!tx.terminal,'NO_BLOCKED_RECOVERY');await atomicJSON(join(STATE,'transaction.json'),{...tx,phase:'RECOVERING',recoveryAttempts:0});return {state:'RECOVERY_REARMED',productionServicesChanged:0};}
 if(command==='seal'){
  const base='/var/lib/atlas-vault';await mkdir(base,{recursive:true,mode:0o700});await trusted(base,{directory:true});const output=join(base,'bundle-'+randomUUID());await mkdir(output,{mode:0o700});await mkdir(join(output,'sealed'),{mode:0o700});const manifest={schemaVersion:1,files:{}};
  for(const [id,spec]of Object.entries(input.files)){await verifyConfiguredFile(id,spec,{uidFor});const encrypted=join(output,'sealed',id+'.cred');await exec('/usr/bin/systemd-creds',['encrypt','--with-key=host','--name='+id,destinations[id],encrypted],{timeout:15000,maxBuffer:65536});await chmod(encrypted,0o600);manifest.files[id]={...spec,cipherHash:hash(await readFile(encrypted))};}
  await atomicJSON(join(output,'manifest.json'),manifest);return {state:'SEALED_BACKUP_CREATED',bundle:output,productionServicesChanged:0,hostKeyBackupRequired:true};
 }
 if(command==='plan'){
  const checks=[];for(const [id,spec]of Object.entries(input.files)){try{await verifyConfiguredFile(id,spec,{uidFor});checks.push({id,state:'READY'});}catch{checks.push({id,state:'MISSING_OR_UNSAFE'});}}
  let plan=[],effective=[];try{plan=await unitPlan({source:fileURLToPath(new URL('../../',import.meta.url)),config:input});checks.push({id:'install-unit-plan',state:'READY'});}catch{checks.push({id:'install-unit-plan',state:'MISSING_OR_UNSAFE'});}
  try{effective=await effectiveUnitPaths(input);checks.push({id:'effective-unit-paths',state:'READY'});}catch{checks.push({id:'effective-unit-paths',state:'MISSING_OR_UNSAFE'});}
  try{await collectorStatePreflight(input);checks.push({id:'collector-state-directories',state:'READY'});}catch{checks.push({id:'collector-state-directories',state:'MISSING_OR_UNSAFE'});}
  const installPaths=await preflightInstallPaths({files:plan,effectiveUnits:effective});return {state:'PLAN_ONLY',checks,installPaths,servicesChanged:0,defaults:{automation:false,usage:false},next:'install -> verify -> enable'};
 }
 if(command==='disable'){await exec('/usr/bin/systemctl',['disable','--now','atlas-deploy-agent.timer']);return {state:'DISABLED',productionServicesChanged:0};}
 if(command==='install'){
  requireThat(!input.enabled,'BOOTSTRAP_MUST_BE_DISABLED');
  await assertBootstrapIdle();const layout=bootstrapLayout();requireThat(layout.root===ROOT&&layout.state===STATE&&layout.install===INSTALL,'INSTALL_LAYOUT');
  requireThat((await preflightInstallPaths()).state==='READY','INSTALL_PATH_PREFLIGHT');await prospectiveTrusted(STATE,{directory:true});await mkdir(STATE,{recursive:true,mode:0o700});await trusted(STATE,{directory:true});await syncDirectory(dirname(STATE));await syncDirectory(STATE);
  const lease=await bootstrapLease(STATE),reload=()=>exec('/usr/bin/systemctl',['daemon-reload']);
  try{
   await assertBootstrapIdle();await recoverBootstrapInstall({layout,reload});await trusted(path,{privateFile:true});const config=validateConfig(await json(path));requireThat(!config.enabled,'BOOTSTRAP_MUST_BE_DISABLED');
   let hasReceipt=false;try{await lstat(layout.receipt);hasReceipt=true;}catch(e){if(e.code!=='ENOENT')throw e;}if(hasReceipt)await verifyInstallation();
   for(const [id,spec]of Object.entries(config.files))await verifyConfiguredFile(id,spec,{uidFor});await collectorStatePreflight(config);
   const env=parseEnv(await readFile(destinations.github,'utf8')),github=githubClient({repository:config.repository,token:await githubToken(env),cache:artifactCache(join(STATE,'artifacts'))});const candidate=await github.candidate(config);requireThat(candidate&&candidate.sha===config.bootstrapSha,'BOOTSTRAP_SHA_CHANGED');const bundle=await github.bundle(candidate);
   const next=INSTALL+'.next-'+randomUUID();await mkdir(next,{mode:0o700});await extractRelease(bundle.payload,next);const plan=await unitPlan({source:next,config}),effective=await effectiveUnitPaths(config);
   requireThat((await preflightInstallPaths({files:plan,effectiveUnits:effective})).state==='READY','INSTALL_PATH_PREFLIGHT');
   const verifyDir='/run/atlas-bootstrap-'+randomUUID();await mkdir(verifyDir,{mode:0o700});
   try{const unitFiles=[];for(const r of plan.filter(r=>r.path.startsWith(unitDir+'/')&&/\.(service|timer)$/.test(r.path))){const dest=join(verifyDir,r.path.split('/').at(-1));await writeFile(dest,r.bytes);unitFiles.push(dest);}await exec('/usr/bin/systemd-analyze',['verify',...unitFiles],{timeout:30000,maxBuffer:65536});}finally{await rm(verifyDir,{recursive:true,force:true});}
   for(const name of ['.stage-lock','.deployment-lock']){try{await lstat(join(ROOT,name));throw Error('LEGACY_DEPLOY_LOCK');}catch(e){if(e.code!=='ENOENT')throw e;}}
   await stageVerified(ROOT,candidate.sha,bundle);
   try{await exec('/usr/bin/getent',['passwd','atlaspull']);}catch(e){if(e.code!==2)throw e;await exec('/usr/sbin/useradd',['--system','--user-group','--no-create-home','--home-dir','/nonexistent','--shell','/usr/sbin/nologin','atlaspull']);}
   const {stdout:account}=await exec('/usr/bin/getent',['passwd','atlaspull']);const identity=account.trim().split(':');requireThat(identity[5]==='/nonexistent'&&['/usr/sbin/nologin','/sbin/nologin'].includes(identity[6]),'DEPLOY_ACCOUNT_PRIVILEGED');
   const {stdout:groups}=await exec('/usr/bin/id',['-Gn','atlaspull']);requireThat(groups.trim().split(/\s+/).every(g=>g==='atlaspull'),'DEPLOY_ACCOUNT_PRIVILEGED');
   for(const dir of [join(STATE,'reports'),dirname(layout.config),layout.log]){await prospectiveTrusted(dir,{directory:true});await mkdir(dir,{recursive:true,mode:0o700});await trusted(dir,{directory:true});}
   await ensureProbeDirectory();
   const units={};for(const r of plan)units[r.path]=hash(r.bytes);for(const target of effective){if(Object.hasOwn(units,target))continue;await trusted(target,{limit:65536});units[target]=hash(await readFile(target));}
   const helpers=await Promise.all(['atlas-deploy-admin','atlas-release'].map(async name=>({path:join(layout.bin,name),bytes:await readFile(join(next,'deploy',name)),mode:0o755})));for(const f of helpers)units[f.path]=hash(f.bytes);
   const receipt={schemaVersion:1,commit:candidate.sha,files:await inventory(next),units};
   return await publishBootstrapInstall({layout,next,commit:candidate.sha,files:[...plan.map(f=>({...f,mode:0o644})),...helpers,{path:layout.config,bytes:Buffer.from(JSON.stringify(config,null,2)+'\n'),mode:0o600}],receipt,reload,beforeReceipt:async()=>{for(const target of await effectiveUnitPaths(config)){await trusted(target,{limit:65536});requireThat(units[target]===hash(await readFile(target)),'INSTALL_UNIT_PATH_CHANGED');}}});
  }finally{await lease.release();}
 }
 const current=await loadConfig();requireThat(JSON.stringify({...current,enabled:false})===JSON.stringify({...input,enabled:false}),'CONFIG_MISMATCH');
 const result=await operatingSystem(current).preflightReport('all');await atomicJSON(join(STATE,'preflight.json'),result);if(result.state!=='READY')return {...result,state:'PREFLIGHT_FAILED'};
 const token=await githubToken(parseEnv(await readFile(destinations.github,'utf8'))),client=githubClient({repository:current.repository,token}),verified=await client.candidate(current);requireThat(verified,'SUCCESSFUL_CI_REQUIRED');await client.reportingReady();await client.status({...verified,component:'bootstrap'},{state:'SUCCESS',current:await pointer(ROOT,'current'),lastSuccess:await pointer(ROOT,'current'),service:'verified',reason:'PREFLIGHT_READY'});
 if(command==='verify')return result;
 if(current.components.usage.enabled&&!await pointer(ROOT,'usage-current')){requireThat(await unitState('atlas-usage.service').then(s=>s.ActiveState==='inactive'),'USAGE_MUST_BE_INACTIVE');requireThat(current.bootstrapSha,'BOOTSTRAP_SHA_REQUIRED');await symlink(await release(ROOT,current.bootstrapSha),join(ROOT,'usage-current'));await syncDirectory(ROOT);}
 let versions=await json(join(STATE,'versions.json'),{schemaVersion:1,web:{},collector:{},usage:{}});for(const component of ['web','collector','usage'])if(!versions[component]?.current){const value=await operatingSystem(current).current(component).catch(()=>null);versions[component]={...versions[component],current:value,lastSuccess:component==='web'?value:null,state:value?'ADOPTED':'NOT_DEPLOYED'};}await atomicJSON(join(STATE,'versions.json'),versions);
 const active={...current,enabled:true};await atomicJSON('/etc/atlas-deploy/config.json',active);await atomicJSON('/etc/atlas-deploy/enabled.json',{schemaVersion:1,configHash:hash(await readFile('/etc/atlas-deploy/config.json')),verifiedAt:new Date().toISOString()});await exec('/usr/bin/systemctl',['enable','--now','atlas-deploy-agent.timer']);if(current.components.usage.enabled&&current.components.usage.activateTimerOnBootstrap===true)await exec('/usr/bin/systemctl',['enable','--now','atlas-usage.timer']);return {state:'AUTOMATION_ENABLED',productionServicesChanged:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const result=await timedDeployment('bootstrap',()=>bootstrap(process.argv.slice(2)));console.log(JSON.stringify(result));if(result.state==='PREFLIGHT_FAILED')process.exitCode=1;}catch(e){console.error(/^[A-Z_]{1,64}$/.test(e.message)?e.message:'BOOTSTRAP_FAILED: inspect local protected configuration');process.exitCode=1;}}
