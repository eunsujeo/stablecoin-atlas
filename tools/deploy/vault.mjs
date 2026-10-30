import {readFile,lstat,mkdir,open,chown,chmod,unlink} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {destinations} from './config.mjs';
import {hash,hex,requireThat,trusted,atomicJSON,json} from './files.mjs';
const exec=promisify(execFile);
export async function provision({manifest,sealed,uidFor,decrypt=async(id,path)=>{const {stdout}=await exec('/usr/bin/systemd-creds',['decrypt','--name='+id,path,'-'],{encoding:'buffer',timeout:15000,maxBuffer:2097152});return stdout;},targetFor=id=>destinations[id],verifySource=true}){
 requireThat(manifest?.schemaVersion===1&&Object.keys(manifest.files??{}).length>0,'VAULT_MANIFEST');if(verifySource)await trusted(sealed,{directory:true});const prepared=[];
 // Validate/decrypt the entire set before installing any file. No plaintext is printed or archived in Git.
 for(const [id,s]of Object.entries(manifest.files)){
  requireThat(Object.hasOwn(destinations,id)&&hex(s.sha256)&&hex(s.cipherHash)&&['root','atlascollector'].includes(s.owner)&&(!['reader','web','github','githubKey','ca'].includes(id)||s.owner==='root')&&[0o600,0o644].includes(s.mode)&&(!['reader','github','githubKey','writer','registered','usageWriter','definers','usageAuthorization'].includes(id)||s.mode===0o600),'VAULT_MANIFEST');
  const source=join(sealed,id+'.cred');if(verifySource)await trusted(source,{privateFile:true,limit:3*1024*1024});requireThat(hash(await readFile(source))===s.cipherHash,'VAULT_CIPHER_HASH');const bytes=await decrypt(id,source);requireThat(bytes.length<=2097152&&hash(bytes)===s.sha256,'VAULT_PLAINTEXT_HASH');
  const target=targetFor(id);if(verifySource){let parent=dirname(target);for(;;){try{const st=await lstat(parent);requireThat(st.isDirectory()&&!st.isSymbolicLink()&&[0,await uidFor(s.owner)].includes(st.uid)&&!(st.mode&0o022),'VAULT_TARGET_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}const next=dirname(parent);if(parent===next)break;parent=next;}}try{const st=await lstat(target);requireThat(st.isFile()&&!st.isSymbolicLink()&&st.uid===await uidFor(s.owner)&&(st.mode&0o7777)===s.mode&&hash(await readFile(target))===s.sha256,'EXISTING_SECRET_CONFLICT');prepared.push({id,preserved:true});}catch(e){if(e.code!=='ENOENT')throw e;prepared.push({id,target,bytes,s});}
 }
 const result=[];for(const p of prepared){if(p.preserved){result.push({id:p.id,state:'PRESERVED'});continue;}await mkdir(dirname(p.target),{recursive:true,mode:0o755});const f=await open(p.target,'wx',0o600);try{await f.writeFile(p.bytes);await f.chmod(p.s.mode);await f.chown(await uidFor(p.s.owner),-1);await f.sync();}finally{await f.close();}result.push({id:p.id,state:'PROVISIONED'});}return {state:'READY',files:result};
}
