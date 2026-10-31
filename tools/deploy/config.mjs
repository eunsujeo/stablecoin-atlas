import {readFile,lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname} from 'node:path';
import {hash,hex,sha,requireThat,trusted} from './files.mjs';
export const destinations={reader:'/etc/atlas-web/reader.env',web:'/etc/atlas-web/web.json',github:'/etc/atlas-deploy/github.env',githubKey:'/etc/atlas-deploy/github-app.pem',ca:'/etc/atlas-ca/supabase.crt',writer:'/etc/atlas-collector/writer.env',registered:'/etc/atlas-collector/registered-writer.env',schedule:'/etc/atlas-collector/schedule.env',usageConfig:'/etc/atlas-usage/config.json',usageAuthorization:'/etc/atlas-usage/authorization.json',definers:'/etc/atlas-usage/reviewed-definers.json',usageWriter:'/etc/atlas-usage/writer.env'};
export const collectorFiles=['writer','registered','schedule'];
export const usageFiles=['usageConfig','usageAuthorization','usageWriter'];
export function validateConfig(c){
 const local=c?.source==='LOCAL_GIT';requireThat(c?.schemaVersion===1&&c.repository==='eunsujeo/stablecoin-atlas'&&[undefined,'GITHUB_ACTIONS','LOCAL_GIT'].includes(c.source)&&(local||Number.isSafeInteger(c.repositoryId)&&c.repositoryId>0&&Number.isSafeInteger(c.workflowId)&&c.workflowId>0&&sha(c.workflowBlob))&&typeof c.enabled==='boolean','CONFIG_INVALID');
 if(c.bootstrapSha!==undefined)requireThat(sha(c.bootstrapSha),'BOOTSTRAP_SHA_INVALID');
 requireThat(Object.keys(c.components??{}).sort().join(',')==='collector,usage,web'&&Object.values(c.components).every(v=>typeof v.enabled==='boolean'),'CONFIG_INVALID');
 if(local)requireThat(c.components.web.enabled&&!c.components.collector.enabled&&!c.components.usage.enabled,'LOCAL_WEB_ONLY');
 for(const id of ['collector','usage'])if(c.components[id].enabled)requireThat(hex(c.components[id].policyHash),'POLICY_REQUIRED');
 if(c.components.collector.enabled)requireThat(hex(c.components.collector.selection),'SELECTION_REQUIRED');
 requireThat(c.files&&typeof c.files==='object'&&Object.entries(c.files).every(([id,v])=>Object.hasOwn(destinations,id)&&hex(v.sha256)&&['root','atlascollector'].includes(v.owner)&&(!['reader','web','github','githubKey','ca'].includes(id)||v.owner==='root')&&[0o600,0o644].includes(v.mode)&&(!['reader','github','githubKey','writer','registered','usageWriter','definers','usageAuthorization'].includes(id)||v.mode===0o600)),'FILES_INVALID');
 for(const id of ['reader','web','ca',...(!local?['github']:[]),...(c.components.collector.enabled?collectorFiles:[]),...(c.components.usage.enabled?usageFiles:[])])requireThat(c.files[id],'REQUIRED_FILE_MISSING');return c;
}
export async function loadConfig(file='/etc/atlas-deploy/config.json'){await trusted(file,{privateFile:true});return validateConfig(JSON.parse(await readFile(file,'utf8')));}
export async function verifyConfiguredFile(id,spec,{uidFor,stat=lstat,read=readFile,openFile=open}={}){
 const path=destinations[id],uid=await uidFor(spec.owner);const s=await stat(path);
 const safeFile=st=>st.isFile()&&!st.isSymbolicLink()&&st.uid===uid&&(st.mode&0o7777)===spec.mode&&st.size>=0&&st.size<=2097152;
 requireThat(safeFile(s),'CONFIGURED_FILE_UNSAFE');
 let collectorParent=null;
 let p=dirname(path);for(;;){
  const st=await stat(p);let allowedOwner=[0,uid].includes(st.uid);
  // The existing root-owned schedule is the sole cross-owner exception, only at its direct parent.
  if(!allowedOwner&&id==='schedule'&&path==='/etc/atlas-collector/schedule.env'&&p==='/etc/atlas-collector'&&spec.owner==='root'&&uid===0&&spec.mode===0o644&&(st.mode&0o7777)===0o700){
   const collectorUid=await uidFor('atlascollector');allowedOwner=Number.isSafeInteger(collectorUid)&&collectorUid>0&&st.uid===collectorUid;if(allowedOwner)collectorParent=st;
  }
  requireThat(st.isDirectory()&&!st.isSymbolicLink()&&allowedOwner&&!(st.mode&0o022),'CONFIGURED_PARENT_UNSAFE');const parent=dirname(p);if(parent===p)break;p=parent;
 }
 if(collectorParent){
  // A collector-owned directory can replace entries: pin the actual file, never follow its symlink.
  const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.uid===b.uid&&a.mode===b.mode;
  const file=await openFile(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
   const pinned=await file.stat();requireThat(safeFile(pinned)&&same(s,pinned)&&s.size===pinned.size,'CONFIGURED_FILE_UNSAFE');
   const bytes=Buffer.alloc(pinned.size+1);let length=0;
   while(length<bytes.length){const r=await file.read(bytes,length,bytes.length-length,length);if(!r.bytesRead)break;length+=r.bytesRead;}
   const after=await file.stat(),entry=await stat(path),parent=await stat('/etc/atlas-collector');
   requireThat(safeFile(after)&&same(pinned,after)&&after.size===pinned.size&&length===pinned.size&&safeFile(entry)&&same(pinned,entry)&&entry.size===pinned.size,'CONFIGURED_FILE_UNSAFE');
   requireThat(parent.isDirectory()&&!parent.isSymbolicLink()&&same(collectorParent,parent),'CONFIGURED_PARENT_UNSAFE');
   requireThat(hash(bytes.subarray(0,length))===spec.sha256,'CONFIGURED_FILE_HASH');
  }finally{await file.close();}
 }else requireThat(hash(await read(path))===spec.sha256,'CONFIGURED_FILE_HASH');
 return {id,state:'READY'};
}
