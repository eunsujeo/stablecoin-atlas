import {readFile,lstat} from 'node:fs/promises';
import {dirname} from 'node:path';
import {hash,hex,sha,requireThat,trusted} from './files.mjs';
export const destinations={reader:'/etc/atlas-web/reader.env',web:'/etc/atlas-web/web.json',github:'/etc/atlas-deploy/github.env',githubKey:'/etc/atlas-deploy/github-app.pem',ca:'/etc/atlas-ca/supabase.crt',writer:'/etc/atlas-collector/writer.env',registered:'/etc/atlas-collector/registered-writer.env',schedule:'/etc/atlas-collector/schedule.env',usageConfig:'/etc/atlas-usage/config.json',usageAuthorization:'/etc/atlas-usage/authorization.json',definers:'/etc/atlas-usage/reviewed-definers.json',usageWriter:'/etc/atlas-usage/writer.env'};
export const collectorFiles=['writer','registered','schedule'];
export const usageFiles=['usageConfig','usageAuthorization','definers','usageWriter'];
export function validateConfig(c){
 requireThat(c?.schemaVersion===1&&c.repository==='eunsujeo/stablecoin-atlas'&&Number.isSafeInteger(c.repositoryId)&&c.repositoryId>0&&Number.isSafeInteger(c.workflowId)&&c.workflowId>0&&sha(c.workflowBlob)&&typeof c.enabled==='boolean','CONFIG_INVALID');
 if(c.bootstrapSha!==undefined)requireThat(sha(c.bootstrapSha),'BOOTSTRAP_SHA_INVALID');
 requireThat(Object.keys(c.components??{}).sort().join(',')==='collector,usage,web'&&Object.values(c.components).every(v=>typeof v.enabled==='boolean'),'CONFIG_INVALID');
 for(const id of ['collector','usage'])if(c.components[id].enabled)requireThat(hex(c.components[id].policyHash),'POLICY_REQUIRED');
 if(c.components.collector.enabled)requireThat(hex(c.components.collector.selection),'SELECTION_REQUIRED');
 requireThat(c.files&&typeof c.files==='object'&&Object.entries(c.files).every(([id,v])=>Object.hasOwn(destinations,id)&&hex(v.sha256)&&['root','atlascollector'].includes(v.owner)&&(!['reader','web','github','githubKey','ca'].includes(id)||v.owner==='root')&&[0o600,0o644].includes(v.mode)&&(!['reader','github','githubKey','writer','registered','usageWriter','definers','usageAuthorization'].includes(id)||v.mode===0o600)),'FILES_INVALID');
 for(const id of ['reader','web','github','ca',...(c.components.collector.enabled?collectorFiles:[]),...(c.components.usage.enabled?usageFiles:[])])requireThat(c.files[id],'REQUIRED_FILE_MISSING');return c;
}
export async function loadConfig(file='/etc/atlas-deploy/config.json'){await trusted(file,{privateFile:true});return validateConfig(JSON.parse(await readFile(file,'utf8')));}
export async function verifyConfiguredFile(id,spec,{uidFor}={}){
 const path=destinations[id],uid=await uidFor(spec.owner);const s=await lstat(path);
 requireThat(s.isFile()&&!s.isSymbolicLink()&&s.uid===uid&&(s.mode&0o7777)===spec.mode&&s.size<=2097152,'CONFIGURED_FILE_UNSAFE');
 let p=dirname(path);for(;;){const st=await lstat(p);requireThat(st.isDirectory()&&!st.isSymbolicLink()&&[0,uid].includes(st.uid)&&!(st.mode&0o022),'CONFIGURED_PARENT_UNSAFE');const parent=dirname(p);if(parent===p)break;p=parent;}
 requireThat(hash(await readFile(path))===spec.sha256,'CONFIGURED_FILE_HASH');return {id,state:'READY'};
}
