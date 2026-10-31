import {lstat,readFile,mkdir,open,rename,unlink,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {trusted,hash,hex,sha,requireThat,atomicJSON,json,syncDirectory} from './files.mjs';

export function bootstrapLayout(prefix='/'){
 const path=p=>join(prefix,p.slice(1));
 return {root:path('/opt/stablecoin-atlas'),state:path('/var/lib/atlas-deploy'),install:path('/usr/local/lib/atlas-deploy'),bin:path('/usr/local/sbin'),unitDir:path('/etc/systemd/system'),config:path('/etc/atlas-deploy/config.json'),receipt:path('/etc/atlas-deploy/control-plane.json'),tmpfiles:path('/etc/tmpfiles.d/atlas-deploy.conf'),polkit:path('/etc/polkit-1/rules.d/50-atlas-deploy.rules'),logrotate:path('/etc/logrotate.d/atlas-deploy'),log:path('/var/log/atlas-deploy'),probes:path('/run/atlas-deploy-probes')};
}
const scriptPaths=l=>[join(l.bin,'atlas-deploy-admin'),join(l.bin,'atlas-release')];
const absent=e=>e.code==='ENOENT';
async function present(path,stat=lstat){try{return await stat(path);}catch(e){if(absent(e))return null;throw e;}}
export async function prospectiveTrusted(path,{directory=false,privateFile=false,trust=trusted,stat=lstat}={}){
 const exists=await present(path,stat);if(exists){await trust(path,{directory,privateFile,limit:16*1024*1024});return true;}
 let parent=dirname(path);while(!await present(parent,stat)){const next=dirname(parent);requireThat(next!==parent,'INSTALL_PARENT_MISSING');parent=next;}
 await trust(parent,{directory:true});return false;
}
export async function preflightInstallPaths({layout=bootstrapLayout(),files=[],effectiveUnits=[],trust=trusted,stat=lstat}={}){
 const checks=[],seen=new Set(),scripts=scriptPaths(layout);
 const required=new Set([dirname(layout.install),layout.root,join(layout.root,'releases'),layout.bin]);
 const targets=[...[dirname(layout.install),layout.install,layout.root,join(layout.root,'releases'),layout.state,join(layout.state,'reports'),join(layout.state,'bootstrap-backups'),dirname(layout.config),layout.log,layout.probes,layout.bin,layout.unitDir].map(path=>({path,directory:true,required:required.has(path)})),...files.map(f=>({path:f.path})),...[layout.tmpfiles,layout.polkit,layout.logrotate].map(path=>({path})),...scripts.map(path=>({path,executable:true})),...effectiveUnits.map(path=>({path,required:!files.some(f=>f.path===path)})),... [layout.config,layout.receipt,join(layout.state,'bootstrap-install.json'),join(layout.state,'bootstrap-install.flock')].map(path=>({path,privateFile:true}))];
 targets.sort((a,b)=>Number(!!b.privateFile||!!b.executable)-Number(!!a.privateFile||!!a.executable));
 for(const spec of targets)if(spec.required)required.add(spec.path);
 for(const spec of targets){if(seen.has(spec.path))continue;seen.add(spec.path);try{
  const exists=await prospectiveTrusted(spec.path,{...spec,trust,stat});
  requireThat(exists||!required.has(spec.path),'INSTALL_PATH_MISSING');
  if(exists&&!spec.directory){const s=await stat(spec.path);requireThat(!(s.mode&0o7000),'INSTALL_FILE_MODE');if(spec.executable)requireThat(s.mode&0o100,'INSTALL_HELPER_NOT_EXECUTABLE');}
  checks.push({path:spec.path,state:'READY',exists});
 }catch(e){checks.push({path:spec.path,state:'FAILED',reason:/^[A-Z_]{1,64}$/.test(e.message)?e.message:'INSTALL_PATH_UNSAFE'});}}
 return {state:checks.some(c=>c.state==='FAILED')?'FAILED':'READY',checks,servicesChanged:0};
}

// Content and metadata identity, not just REVISION or a manifest's claimed payload hash.
export async function controlTreeHash(root,{uid=process.getuid()}={}){
 const entries=[];
 async function walk(path,name){const s=await lstat(path);requireThat((name!==''||s.isDirectory())&&!s.isSymbolicLink()&&s.uid===uid&&!(s.mode&0o022),'INSTALL_TREE_UNSAFE');
  if(s.isDirectory()){entries.push([name,'directory',s.mode&0o7777,s.uid,s.gid]);for(const child of (await readdir(path)).sort())await walk(join(path,child),name?name+'/'+child:child);}
  else{requireThat(s.isFile()&&s.nlink===1&&!(s.mode&0o7000)&&s.size<=32*1024*1024,'INSTALL_TREE_UNSAFE');entries.push([name,'file',s.mode&0o7777,s.uid,s.gid,hash(await readFile(path))]);}
 }
 await walk(root,'');return hash(JSON.stringify(entries));
}
function allowedTarget(l,path){
 if(typeof path!=='string')return false;
 if([...scriptPaths(l),l.config,l.receipt,l.tmpfiles,l.polkit,l.logrotate].includes(path))return true;
 if(!path.startsWith(l.unitDir+'/'))return false;
 return /^atlas-(?:deploy-agent|deploy-apply|web|collector|registered-collector(?:@(?:[a-f0-9]{64})?)?|fx|usage)\.(?:service|timer)(?:\.d\/(?:production|90-atlas-deploy-barrier)\.conf)?$/.test(path.slice(l.unitDir.length+1));
}
async function fileSnapshot(path,{trust,uid}){
 if(!await present(path))return null;await trust(path,{limit:16*1024*1024});const s=await lstat(path);
 requireThat(s.isFile()&&!s.isSymbolicLink()&&s.uid===uid&&s.nlink===1&&!(s.mode&0o7022)&&s.size<=16*1024*1024,'INSTALL_FILE_UNSAFE');const bytes=await readFile(path);
 return {bytes,hash:hash(bytes),mode:s.mode&0o7777,uid:s.uid,gid:s.gid};
}
async function replaceFile(path,bytes,metadata,{trust,uid}){
 await prospectiveTrusted(path,{trust});const created=[];let parent=dirname(path);while(!await present(parent)){created.push(parent);parent=dirname(parent);}await mkdir(dirname(path),{recursive:true,mode:0o755});await trust(dirname(path),{directory:true});
 const temp=join(dirname(path),'.atlas-bootstrap-'+randomUUID());let file;
 try{file=await open(temp,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);await file.writeFile(bytes);const s=await file.stat();if(s.uid!==uid||s.gid!==metadata.gid)await file.chown(uid,metadata.gid);await file.chmod(metadata.mode);await file.sync();await file.close();file=null;await rename(temp,path);await syncDirectory(dirname(path));for(const directory of created)await syncDirectory(dirname(directory));}
 finally{await file?.close();await unlink(temp).catch(e=>{if(!absent(e))throw e;});}
}
function validateJournal(j,l,uid){
 requireThat(j?.schemaVersion===1&&/^[a-f0-9-]{36}$/.test(j.id)&&sha(j.commit)&&j.install===l.install&&j.next===l.install+'.next-'+j.id&&j.previous===l.install+'.previous-'+j.id&&j.backups===join(l.state,'bootstrap-backups',j.id)&&hex(j.afterTree)&&(j.beforeTree===null||hex(j.beforeTree)),'BOOTSTRAP_JOURNAL_INVALID');
 const mode=n=>Number.isInteger(n)&&n>=0&&n<=0o777&&!(n&0o022),gid=n=>Number.isSafeInteger(n)&&n>=0&&n<=4294967295;
 requireThat(Array.isArray(j.files)&&j.files.every(f=>f&&typeof f.path==='string')&&new Set(j.files.map(f=>f.path)).size===j.files.length&&j.files.every(f=>allowedTarget(l,f.path)&&resolve(f.path)===f.path&&hex(f.after)&&mode(f.mode)&&gid(f.gid)&&(!f.before||hex(f.before.hash)&&f.before.uid===uid&&gid(f.before.gid)&&mode(f.before.mode)&&f.mode===f.before.mode&&f.gid===f.before.gid)),'BOOTSTRAP_JOURNAL_INVALID');
 requireThat(j.files.some(f=>f.path===l.receipt)&&['PREPARED','FILES_WRITTEN','SWAPPING','PUBLISHED','COMMITTED','ROLLING_BACK','ROLLED_BACK','RECOVERY_BLOCKED'].includes(j.phase),'BOOTSTRAP_JOURNAL_INVALID');
}
async function treeAt(path,options){return await present(path)?controlTreeHash(path,options):null;}
export async function recoverBootstrapInstall({layout=bootstrapLayout(),trust=trusted,uid=process.getuid(),reload=async()=>{}}={}){
 const journal=join(layout.state,'bootstrap-install.json');if(!await present(journal))return {state:'NONE'};await trust(journal,{privateFile:true});let j=await json(journal);validateJournal(j,layout,uid);
 if(['COMMITTED','ROLLED_BACK'].includes(j.phase))return {state:j.phase};
 const options={trust,uid},save=async phase=>{j={...j,phase};await atomicJSON(journal,j);};
 try{
  const snapshots=await Promise.all(j.files.map(f=>fileSnapshot(f.path,options))),actual=await treeAt(layout.install,{uid}),previous=await treeAt(j.previous,{uid}),next=await treeAt(j.next,{uid});
  const receiptIndex=j.files.findIndex(f=>f.path===layout.receipt);
  const metadata=(s,f)=>s?.mode===f.mode&&s?.gid===f.gid;
  if(snapshots[receiptIndex]?.hash===j.files[receiptIndex].after&&actual===j.afterTree&&snapshots.every((s,i)=>s?.hash===j.files[i].after&&metadata(s,j.files[i]))){
   await save('COMMITTED');return {state:'COMMITTED'};
  }
  // Validate the entire rollback before changing anything; never overwrite an operator's unknown edit.
  for(let i=0;i<j.files.length;i++){const f=j.files[i],s=snapshots[i];requireThat(s?(s.hash===f.after||s.hash===f.before?.hash)&&metadata(s,f):!f.before,'BOOTSTRAP_FILE_CHANGED');if(f.before){const backup=join(j.backups,String(i));await trust(backup,{privateFile:true,limit:16*1024*1024});requireThat(hash(await readFile(backup))===f.before.hash,'BOOTSTRAP_BACKUP_CHANGED');}}
  requireThat([null,j.beforeTree,j.afterTree].includes(actual)&&[null,j.beforeTree].includes(previous)&&[null,j.afterTree].includes(next),'BOOTSTRAP_TREE_CHANGED');
  if(j.beforeTree)requireThat(actual===j.beforeTree||previous===j.beforeTree,'BOOTSTRAP_PREVIOUS_MISSING');
  await save('ROLLING_BACK');
  if(actual!==null&&(previous!==null||j.beforeTree===null)){requireThat(actual===j.afterTree&&next===null,'BOOTSTRAP_STAGING_CONFLICT');await rename(layout.install,j.next);await syncDirectory(dirname(layout.install));}
  if(j.beforeTree&&previous!==null){await rename(j.previous,layout.install);await syncDirectory(dirname(layout.install));}
  for(let i=j.files.length-1;i>=0;i--){const f=j.files[i],s=await fileSnapshot(f.path,options);requireThat(s?(s.hash===f.after||s.hash===f.before?.hash)&&metadata(s,f):!f.before,'BOOTSTRAP_FILE_CHANGED');if(s?.hash===f.before?.hash)continue;if(f.before)await replaceFile(f.path,await readFile(join(j.backups,String(i))),f.before,options);else if(s){await unlink(f.path);await syncDirectory(dirname(f.path));}}
  await reload();requireThat(await treeAt(layout.install,{uid})===j.beforeTree,'BOOTSTRAP_TREE_CHANGED');for(const f of j.files){const s=await fileSnapshot(f.path,options);requireThat(f.before?s?.hash===f.before.hash&&metadata(s,f):s===null,'BOOTSTRAP_FILE_CHANGED');}await save('ROLLED_BACK');return {state:'ROLLED_BACK'};
 }catch{await save('RECOVERY_BLOCKED').catch(()=>{});throw Error('BOOTSTRAP_RECOVERY_BLOCKED');}
}

export async function publishBootstrapInstall({layout=bootstrapLayout(),next,commit,files,receipt,trust=trusted,uid=process.getuid(),gid=process.getgid(),reload=async()=>{},beforeReceipt=async()=>{},onPhase=async()=>{}}){
 const id=next.slice((layout.install+'.next-').length);requireThat(next===layout.install+'.next-'+id&&/^[a-f0-9-]{36}$/.test(id),'BOOTSTRAP_STAGING_INVALID');
 const options={trust,uid},journal=join(layout.state,'bootstrap-install.json'),backups=join(layout.state,'bootstrap-backups',id);
 await recoverBootstrapInstall({layout,trust,uid,reload});await trust(layout.state,{directory:true});await trust(next,{directory:true});
 const prior=await treeAt(layout.install,{uid}),afterTree=await controlTreeHash(next,{uid});await syncDirectory(dirname(next));requireThat(!await present(backups)&&!await present(layout.install+'.previous-'+id),'BOOTSTRAP_STAGING_REUSE');await mkdir(backups,{recursive:true,mode:0o700});await trust(backups,{directory:true});await syncDirectory(dirname(backups));
 const actions=[...files.filter(f=>f.path!==layout.receipt),{path:layout.receipt,bytes:Buffer.from(JSON.stringify(receipt,null,2)+'\n'),mode:0o600}],records=[];
 requireThat(new Set(actions.map(f=>f.path)).size===actions.length&&actions.every(f=>allowedTarget(layout,f.path)),'BOOTSTRAP_TARGET_INVALID');
 for(let i=0;i<actions.length;i++){const f=actions[i],before=await fileSnapshot(f.path,options);if(before&&(f.path.startsWith(layout.unitDir+'/')||[layout.tmpfiles,layout.polkit,layout.logrotate].includes(f.path)))requireThat(before.hash===hash(f.bytes),'EXISTING_UNIT_CONFLICT');if(before)await writeBackup(join(backups,String(i)),before.bytes);records.push({path:f.path,mode:before?.mode??f.mode,gid:before?.gid??gid,before:before?{hash:before.hash,mode:before.mode,uid,gid:before.gid}:null,after:hash(f.bytes)});}
 let j={schemaVersion:1,id,commit,phase:'PREPARED',install:layout.install,next,previous:layout.install+'.previous-'+id,backups,beforeTree:prior,afterTree,files:records};validateJournal(j,layout,uid);
 await atomicJSON(join(backups,'manifest.json'),j);const save=async phase=>{j={...j,phase};await atomicJSON(journal,j);await onPhase(phase,j);};
 try{
  await save('PREPARED');
  const unchanged=(current,r)=>current?current.hash===r.before?.hash&&current.mode===r.mode&&current.gid===r.gid:!r.before;
  for(let i=0;i<actions.length-1;i++){const f=actions[i],r=records[i],current=await fileSnapshot(f.path,options);requireThat(unchanged(current,r),'BOOTSTRAP_FILE_CHANGED');if(current?.hash!==r.after)await replaceFile(f.path,f.bytes,r,options);}
  await save('FILES_WRITTEN');await save('SWAPPING');if(prior){await rename(layout.install,j.previous);await syncDirectory(dirname(layout.install));await onPhase('OLD_MOVED',j);}await rename(next,layout.install);await syncDirectory(dirname(layout.install));await save('PUBLISHED');
  await reload();await beforeReceipt();requireThat(await controlTreeHash(layout.install,{uid})===afterTree,'BOOTSTRAP_TREE_CHANGED');
  const f=actions.at(-1),r=records.at(-1);requireThat(unchanged(await fileSnapshot(f.path,options),r),'BOOTSTRAP_FILE_CHANGED');await replaceFile(f.path,f.bytes,r,options);await onPhase('RECEIPT_WRITTEN',j);await save('COMMITTED');return {state:'INSTALLED_DISABLED',commit,productionServicesChanged:0,next:'verify'};
 }catch(error){const recovered=await recoverBootstrapInstall({layout,trust,uid,reload});if(recovered.state==='COMMITTED')return {state:'INSTALLED_DISABLED',commit,productionServicesChanged:0,next:'verify',recovered:true};throw error;}
}
async function writeBackup(path,bytes){const f=await open(path,'wx',0o600);try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}}
