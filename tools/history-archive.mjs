import {mkdir,lstat,realpath,open,link,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {boundedRead} from './evidence-store.mjs';
import {hashHistory,sourceByteLimit} from './supply-history-source.mjs';
const fail=()=>{throw Error('HISTORY_ARCHIVE_INVALID');};
const validHash=hash=>typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash);
async function privateDirectory(path,create=false){if(create)await mkdir(path,{recursive:true,mode:0o700});const s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink()||process.platform!=='win32'&&((s.mode&0o077)!==0||s.uid!==process.getuid()))fail();return realpath(path);}
async function sync(path){const f=await open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{await f.sync();}finally{await f.close();}}
export async function readCompressedSource(root,hash){
 if(!validHash(hash))fail();const base=await privateDirectory(resolve(root)),folder=await privateDirectory(join(base,hash.slice(0,2))),path=join(folder,hash+'.json.gz'),s=await lstat(path);
 if(!s.isFile()||s.isSymbolicLink()||process.platform!=='win32'&&((s.mode&0o077)!==0||s.uid!==process.getuid()))fail();
 try{const bytes=gunzipSync(await boundedRead(path,sourceByteLimit+65536),{maxOutputLength:sourceByteLimit});if(hashHistory(bytes)!==hash)fail();return bytes;}catch{fail();}
}
export async function archiveCompressedSources(sources,root){
 if(!Array.isArray(sources)||!sources.length||sources.length>3)fail();const base=await privateDirectory(resolve(root),true);
 for(const {hash,bytes}of sources){
  if(!validHash(hash)||!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>sourceByteLimit||hashHistory(bytes)!==hash)fail();
  const folder=await privateDirectory(join(base,hash.slice(0,2)),true),path=join(folder,hash+'.json.gz'),temporary=path+'.'+randomUUID()+'.tmp';let f;
  try{f=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);await f.writeFile(gzipSync(bytes));await f.sync();await f.close();f=null;try{await link(temporary,path);}catch(e){if(e.code!=='EEXIST')throw e;}}
  finally{await f?.close();await unlink(temporary).catch(()=>{});}await sync(folder);await sync(base);
  if(!(await readCompressedSource(base,hash)).equals(bytes))fail();
 }
 return base;
}
