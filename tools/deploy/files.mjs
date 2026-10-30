import {open,lstat,mkdir,rename,unlink,readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,join,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const sha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export function requireThat(ok,code){if(!ok)throw Error(code);}
export async function atomicJSON(path,value){
 const temp=path+'.'+randomUUID();let f;
 try{f=await open(temp,'wx',0o600);await f.writeFile(JSON.stringify(value,null,2)+'\n');await f.sync();await f.close();f=null;await rename(temp,path);const dir=await open(dirname(path),'r');try{await dir.sync();}finally{await dir.close();}}
 finally{await f?.close();await unlink(temp).catch(()=>{});}
}
export async function json(path,fallback){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT'&&fallback!==undefined)return fallback;throw e;}}
// Every ancestor is checked: a root-owned file under an agent-writable directory is not trusted.
export async function trusted(path,{uid=0,privateFile=false,directory=false,limit=262144}={}){
 requireThat(resolve(path)===path,'PATH_INVALID');let current=path;
 for(;;){const s=await lstat(current);requireThat(!s.isSymbolicLink()&&s.uid===uid&&!(s.mode&0o022),'PATH_UNTRUSTED');if(current===path)requireThat(directory?s.isDirectory():s.isFile()&&s.size<=limit&&(!privateFile||!(s.mode&0o077)),'FILE_UNTRUSTED');else requireThat(s.isDirectory(),'PATH_UNTRUSTED');const parent=dirname(current);if(parent===current)break;current=parent;}
 return path;
}
export async function inventory(root){
 const result={};async function walk(path){for(const name of (await readdir(path)).sort()){const p=join(path,name),s=await lstat(p);requireThat(!s.isSymbolicLink(),'INSTALL_SYMLINK');if(s.isDirectory())await walk(p);else{requireThat(s.isFile()&&s.nlink===1,'INSTALL_FILE_INVALID');result[p.slice(root.length+1).split(sep).join('/')]=hash(await readFile(p));}}}await walk(root);return result;
}
export async function ensureDirectory(path){await mkdir(path,{recursive:true,mode:0o700});}

export async function syncDirectory(path){const file=await open(path,'r');try{await file.sync();}finally{await file.close();}}
