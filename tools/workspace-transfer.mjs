import {mkdir,mkdtemp,lstat,writeFile,link,unlink,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseArgs,parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {buildEvidence,sources} from './evidence-build.mjs';
import {buildMarket} from './market-store.mjs';
import {boundedRead,digest} from './evidence-store.mjs';
export const marketSources=['arkham-api-smoke.json','arkham-market-additional.json','arkham-chain-supply-research.json','arkham-additional-data-research.json','xrpl-gateway-obligations-readonly.json'];
export const transferNames=[...sources.map(row=>row[0]),...marketSources];
const defaultReports=fileURLToPath(new URL('../reports/',import.meta.url));
const registryPath=new URL('../data/asset-registry.json',import.meta.url);
const maxTotal=32*1024*1024,maxBundle=46*1024*1024,maxFile=10*1024*1024;
const forbidden=/private.?key|mnemonic|authorization|password|rpc.?url|api.?key|access.?token/i;
const credentials=/-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bxox[baprs]-[A-Za-z0-9-]{30,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}/;
function ensure(ok){if(!ok)throw new Error('INVALID_TRANSFER');}
function guard(value,depth=0,secrets=[]){
  ensure(depth<=120);
  if(typeof value==='number')ensure(Number.isFinite(value)&&(!Number.isInteger(value)||Number.isSafeInteger(value)));
  if(typeof value==='string')ensure(value.length<=2000000&&!/https?:\/\/|bearer\s+\S+/i.test(value)&&!credentials.test(value)&&!secrets.some(secret=>value.includes(secret)));
  if(value&&typeof value==='object')for(const[k,v]of Object.entries(value)){ensure(!forbidden.test(k));guard(v,depth+1,secrets);}
}
async function regularDirectory(path){await mkdir(path,{recursive:true,mode:0o700});const stat=await lstat(path);ensure(stat.isDirectory()&&!stat.isSymbolicLink());}
function decodeBundle(bundle,secrets=[]){
  ensure(bundle?.kind==='ATLAS_LOCAL_REPORT_TRANSFER'&&bundle.version===1&&typeof bundle.exportedAt==='string'&&Number.isFinite(Date.parse(bundle.exportedAt))&&Object.keys(bundle).every(k=>['kind','version','exportedAt','files'].includes(k)));
  ensure(Array.isArray(bundle.files)&&bundle.files.length===transferNames.length);const decoded=new Map();let size=0;
  for(const f of bundle.files){
    ensure(f&&Object.keys(f).every(k=>['name','sha256','base64'].includes(k))&&transferNames.includes(f.name)&&!decoded.has(f.name)&&/^[a-f0-9]{64}$/.test(f.sha256));
    ensure(typeof f.base64==='string'&&f.base64.length<=Math.ceil(maxFile/3)*4&&f.base64.length%4===0&&!/[^A-Za-z0-9+/=]/.test(f.base64));
    const bytes=Buffer.from(f.base64,'base64');ensure(bytes.length<=maxFile&&f.base64===bytes.toString('base64')&&digest(bytes)===f.sha256&&(size+=bytes.length)<=maxTotal);
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);guard(JSON.parse(text),0,secrets);decoded.set(f.name,bytes);
  }
  return decoded;
}
async function validateReports(decoded){
  // Reuse the production publishers in an isolated scratch directory, without RPC or tests.
  const scratch=await mkdtemp(join(tmpdir(),'atlas-transfer-validation-'));
  try{
    for(const[name,bytes]of decoded)await writeFile(join(scratch,name),bytes,{mode:0o600,flag:'wx'});
    const evidence=await buildEvidence({root:pathToFileURL(join(scratch,'evidence')+'/'),readSource:name=>Promise.resolve(decoded.get(name))});
    const market=await buildMarket({registryPath,sourcePaths:marketSources.map(name=>join(scratch,name)),directory:join(scratch,'market')});
    return{reports:evidence.reports.length,items:evidence.items.length,observations:market.observations.length};
  }finally{await rm(scratch,{recursive:true,force:true});}
}
export async function exportWorkspace(reportsDirectory=defaultReports){
  const root=resolve(reportsDirectory);await regularDirectory(root);const files=[];let size=0;
  for(const name of transferNames){const bytes=await boundedRead(join(root,name),maxFile);ensure((size+=bytes.length)<=maxTotal);files.push({name,sha256:digest(bytes),base64:bytes.toString('base64')});}
  const secrets=[];
  try{for(const[k,v]of Object.entries(parseEnv((await boundedRead(join(root,'../.env.local'),65536)).toString('utf8'))))if(forbidden.test(k)&&v.length>=12)secrets.push(v);}catch(error){if(error.code!=='ENOENT')throw new Error('ENV_SCAN_FAILED');}
  const bundle={kind:'ATLAS_LOCAL_REPORT_TRANSFER',version:1,exportedAt:new Date().toISOString(),files};const decoded=decodeBundle(bundle,secrets),counts=await validateReports(decoded);
  const directory=join(root,'transfers');await regularDirectory(directory);const path=join(directory,`atlas-reports-${Date.now()}-${randomUUID().slice(0,8)}.json`);
  const bytes=Buffer.from(JSON.stringify(bundle)+'\n');ensure(bytes.length<=maxBundle);await writeFile(path,bytes,{mode:0o600,flag:'wx'});
  return{file:path,files:files.length,bytes:bytes.length,...counts};
}
export async function importWorkspace(file,reportsDirectory=defaultReports){
  const bytes=await boundedRead(file,maxBundle),bundle=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const decoded=decodeBundle(bundle),counts=await validateReports(decoded),root=resolve(reportsDirectory);await regularDirectory(root);
  // Preflight all destinations; existing different reports are never replaced.
  const missing=[];
  for(const[name,content]of decoded){try{ensure(digest(await boundedRead(join(root,name),maxFile))===digest(content));}catch(error){if(error.code!=='ENOENT')throw new Error('EXISTING_REPORT_CONFLICT');missing.push(name);}}
  const scratch=await mkdtemp(join(root,'.transfer-')),created=[];
  try{
    for(const name of missing)await writeFile(join(scratch,name),decoded.get(name),{mode:0o600,flag:'wx'});
    for(const name of missing){await link(join(scratch,name),join(root,name));const stat=await lstat(join(scratch,name));created.push({name,device:stat.dev,inode:stat.ino});}
  }catch{
    for(const {name,device,inode} of created){try{const stat=await lstat(join(root,name));if(stat.dev===device&&stat.ino===inode&&digest(await boundedRead(join(root,name),maxFile))===digest(decoded.get(name)))await unlink(join(root,name));}catch{}}
    throw new Error('IMPORT_FAILED');
  }finally{await rm(scratch,{recursive:true,force:true});}
  return{imported:created.length,preserved:decoded.size-created.length,...counts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const action=process.argv[2],{values}=parseArgs({args:process.argv.slice(3),options:{file:{type:'string'}},allowPositionals:false,strict:true});
    if(action==='export'&&!values.file){const result=await exportWorkspace();console.log(JSON.stringify(result,null,2));console.log('Local transfer only: contains report observations, not environment files or keys. Do not commit this bundle.');}
    else if(action==='import'&&values.file){console.log(JSON.stringify(await importWorkspace(values.file),null,2));console.log('Original observations imported. Next: npm run evidence:build and npm run market:build.');}
    else throw new Error();
  }catch{console.error('WORKSPACE_TRANSFER_FAILED: check the complete bundle and fixed reports; existing different files are never overwritten. Details omitted.');process.exitCode=1;}
}
