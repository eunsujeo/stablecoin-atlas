import {inflateRawSync} from 'node:zlib';
import {mkdir,open,lstat,chmod,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {hash,requireThat,hex,sha,syncDirectory} from './files.mjs';
import {payloadPolicies} from './policy.mjs';
const MAX=192*1024*1024;
const safe=name=>typeof name==='string'&&name.length>0&&name.length<=240&&!name.startsWith('/')&&!/[\\\x00-\x1f]/.test(name)&&name.split('/').every(p=>p&&p!=='.'&&p!=='..')&&!name.split('/').some(p=>['.git','.state','.venv','reports','source-intake'].includes(p))&&!/\.(?:pem|key|p12|pfx)$/.test(name)&&!/(?:^|\/)\.env(?!\.example$)/.test(name);
// A small ZIP reader for the single named Actions artifact. Never extracts paths or executes unzip.
export function artifactFiles(bytes){
 requireThat(Buffer.isBuffer(bytes)&&bytes.length<=96*1024*1024,'ARTIFACT_LIMIT');let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
 requireThat(end>=0&&bytes.readUInt16LE(end+4)===0&&bytes.readUInt16LE(end+6)===0&&bytes.readUInt16LE(end+8)===2&&bytes.readUInt16LE(end+10)===2&&end+22+bytes.readUInt16LE(end+20)===bytes.length,'ZIP_INVALID');
 let pos=bytes.readUInt32LE(end+16),total=0;const files={},ranges=[];requireThat(pos+bytes.readUInt32LE(end+12)===end,'ZIP_INVALID');
 for(let n=0;n<2;n++){
  requireThat(pos+46<=end&&bytes.readUInt32LE(pos)===0x02014b50,'ZIP_INVALID');const method=bytes.readUInt16LE(pos+10),size=bytes.readUInt32LE(pos+24),compressed=bytes.readUInt32LE(pos+20),len=bytes.readUInt16LE(pos+28),extra=bytes.readUInt16LE(pos+30),comment=bytes.readUInt16LE(pos+32),local=bytes.readUInt32LE(pos+42),flags=bytes.readUInt16LE(pos+8),name=bytes.subarray(pos+46,pos+46+len).toString('utf8');
  requireThat(['release.json','release.tar'].includes(name)&&!files[name]&&[0,8].includes(method)&&!(flags&1)&&size<=MAX&&local+30<=bytes.length&&bytes.readUInt32LE(local)===0x04034b50,'ZIP_INVALID');
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28),finish=start+compressed;requireThat(finish<=bytes.readUInt32LE(end+16)&&!ranges.some(([a,b])=>local<b&&finish>a),'ZIP_INVALID');ranges.push([local,finish]);
  const output=method===8?inflateRawSync(bytes.subarray(start,finish),{maxOutputLength:size||1}):bytes.subarray(start,finish);requireThat(output.length===size,'ZIP_INVALID');files[name]=output;total+=size;requireThat(total<=MAX+65536,'ARTIFACT_LIMIT');pos+=46+len+extra+comment;
 }
 requireThat(pos===end,'ZIP_INVALID');return files;
}
const oct=(b,start,len)=>{const s=b.subarray(start,start+len).toString('ascii').replace(/\0.*$/,'').trim();requireThat(/^[0-7]+$/.test(s),'TAR_INVALID');return parseInt(s,8);};
export function tarEntries(bytes){
 requireThat(Buffer.isBuffer(bytes)&&bytes.length<=MAX&&bytes.length%512===0,'TAR_INVALID');const entries=[],seen=new Set();let pos=0,ended=false;
 while(pos+512<=bytes.length){const h=bytes.subarray(pos,pos+512);if(h.every(b=>b===0)){requireThat(bytes.subarray(pos).every(b=>b===0),'TAR_TRAILING_DATA');ended=true;break;}
  const text=(s,l)=>new TextDecoder('utf-8',{fatal:true}).decode(h.subarray(s,s+l)).replace(/\0.*$/,'');const name=(text(345,155)?text(345,155)+'/':'')+text(0,100),size=oct(h,124,12),type=h[156],mode=oct(h,100,8);let checksum=0;for(let i=0;i<512;i++)checksum+=i>=148&&i<156?32:h[i];
  requireThat(checksum===oct(h,148,8)&&text(257,6)==='ustar'&&[0,48].includes(type)&&safe(name)&&!seen.has(name)&&!(mode&0o7022)&&size<=MAX&&pos+512+size<=bytes.length,'TAR_ENTRY_INVALID');
  seen.add(name);entries.push({name,mode:mode&0o111?0o755:0o644,bytes:bytes.subarray(pos+512,pos+512+size)});requireThat(entries.length<=40000,'TAR_LIMIT');pos+=512+Math.ceil(size/512)*512;
 }
 requireThat(ended&&entries.length>0,'TAR_INVALID');return entries;
}
export async function extractRelease(bytes,target){
 const entries=tarEntries(bytes),directories=new Set([target]);for(const entry of entries){const path=join(target,entry.name);await mkdir(dirname(path),{recursive:true,mode:0o755});let dir=dirname(path);while(dir.startsWith(target)){directories.add(dir);if(dir===target)break;dir=dirname(dir);}const f=await open(path,'wx',entry.mode);try{await f.writeFile(entry.bytes);await f.chmod(entry.mode);await f.sync();}finally{await f.close();}}
 for(const dir of [...directories].sort((a,b)=>b.length-a.length))await syncDirectory(dir);await chmod(target,0o755);await syncDirectory(target);
}
export function releaseManifest(files,{commit,component,policies,runId,attempt}){
 requireThat(sha(commit)&&['web','collector','usage'].includes(component)&&Number.isSafeInteger(runId)&&runId>0&&Number.isSafeInteger(attempt)&&attempt>0,'MANIFEST_INVALID');
 return {schemaVersion:1,kind:'ATLAS_CI_RELEASE',commit,component,runId,attempt,platform:'linux',arch:'arm64',nodeMajor:24,nodeABI:tarEntries(files).some(e=>e.name.endsWith('.node'))?process.versions.modules:null,payloadHash:hash(files),policies};
}
export function validateBundle(files,expected){
 const m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(files['release.json']));requireThat(m.schemaVersion===1&&m.kind==='ATLAS_CI_RELEASE'&&m.commit===expected.sha&&m.runId===expected.id&&m.attempt===expected.attempt&&m.component===expected.component&&m.platform==='linux'&&m.arch==='arm64'&&m.nodeMajor===24&&hex(m.payloadHash)&&hash(files['release.tar'])===m.payloadHash,'MANIFEST_INVALID');
 const entries=tarEntries(files['release.tar']);requireThat(entries.some(e=>e.name.endsWith('.node'))?m.nodeABI===process.versions.modules:m.nodeABI===null,'NODE_ABI_MISMATCH');requireThat(JSON.stringify(m.policies)===JSON.stringify(payloadPolicies(entries)),'POLICY_MANIFEST_MISMATCH');requireThat(entries.some(e=>e.name==='REVISION'&&e.bytes.toString().trim()===m.commit)&&['package.json','package-lock.json','tools/production-web.mjs','node_modules/pg/package.json'].every(name=>entries.some(e=>e.name===name)),'RELEASE_INCOMPLETE');return m;
}
// Deterministic regular-file ustar builder, also used by offline tests.
export function packEntries(entries){const chunks=[];for(const {name,bytes,mode=0o644}of entries){requireThat(safe(name)&&Buffer.isBuffer(bytes),'TAR_ENTRY_INVALID');const h=Buffer.alloc(512);const split=name.lastIndexOf('/');let short=name,prefix='';if(Buffer.byteLength(name)>100){requireThat(split>0,'TAR_NAME_LIMIT');prefix=name.slice(0,split);short=name.slice(split+1);}requireThat(Buffer.byteLength(short)<=100&&Buffer.byteLength(prefix)<=155,'TAR_NAME_LIMIT');h.write(short);h.write(prefix,345);const writeOct=(v,s,l)=>h.write(v.toString(8).padStart(l-1,'0')+'\0',s,l,'ascii');writeOct(mode,100,8);writeOct(0,108,8);writeOct(0,116,8);writeOct(bytes.length,124,12);writeOct(0,136,12);h.fill(32,148,156);h[156]=48;h.write('ustar\0',257);h.write('00',263);writeOct([...h].reduce((a,b)=>a+b,0),148,8);chunks.push(h,bytes,Buffer.alloc((512-bytes.length%512)%512));}chunks.push(Buffer.alloc(1024));const output=Buffer.concat(chunks);requireThat(output.length<=MAX,'TAR_LIMIT');return output;}
