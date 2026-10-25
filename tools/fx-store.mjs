import {createHash} from 'node:crypto';
import {mkdir,lstat,open,link,unlink,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {isCLIEntrypoint} from './cli-entrypoint.mjs';
import {boundedRead} from './evidence-store.mjs';
import {registrationDecimal} from './market-registration/decimal.mjs';
import {validateFX,usableFX} from '../web/fx-model.js';
export const fxEndpoint='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
export const defaultFXDirectory=new URL('../.state/fx-store/',import.meta.url);
const digest=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('FX_INVALID');};
const size=65536;
export function parseFX(bytes,{at,imported=false}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length>size||typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)fail();
 const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(/<!|&/.test(xml)||!xml.includes('xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"')||!xml.includes('<gesmes:name>European Central Bank</gesmes:name>'))fail();
 const header=/^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<gesmes:Envelope xmlns:gesmes="http:\/\/www\.gesmes\.org\/xml\/2002-08-01" xmlns="http:\/\/www\.ecb\.int\/vocabulary\/2002-08-01\/eurofxref">\s*<gesmes:subject>Reference rates<\/gesmes:subject>\s*<gesmes:Sender>\s*<gesmes:name>European Central Bank<\/gesmes:name>\s*<\/gesmes:Sender>\s*/;
 if(!header.test(xml))fail();
 const match=/^<Cube>\s*<Cube time=(['"])(\d{4}-\d\d-\d\d)\1>([\s\S]*?)<\/Cube>\s*<\/Cube>\s*<\/gesmes:Envelope>\s*$/.exec(xml.replace(header,''));if(!match||[...xml.matchAll(/\btime=/g)].length!==1)fail();
 const rates={},token=/<Cube currency=(['"])([A-Z]{3})\1 rate=(['"])([0-9.]+)\3\s*\/>/g;
 let previous=0,count=0;for(const m of match[3].matchAll(token)){if(match[3].slice(previous,m.index).trim()||Object.hasOwn(rates,m[2])||++count>64)fail();rates[m[2]]=registrationDecimal(m[4]);previous=m.index+m[0].length;}
 if(match[3].slice(previous).trim())fail();
 return validateFX({schemaVersion:1,kind:'ECB_REFERENCE_FX',base:'EUR',date:match[2],usdPerEUR:rates.USD,krwPerEUR:rates.KRW,sourceHash:digest(bytes),fetchedAt:imported?null:at,importedAt:imported?at:null});
}
async function privateDirectory(path,create=false){if(create)await mkdir(path,{recursive:true,mode:0o700});const s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink()||process.platform!=='win32'&&((s.mode&0o077)!==0||s.uid!==process.getuid()))fail();return path;}
async function immutable(path,bytes){let file;try{file=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);await file.writeFile(bytes);await file.sync();}catch(e){if(e.code!=='EEXIST')throw e;const old=await boundedRead(path,size);if(!old.equals(bytes))fail();}finally{await file?.close();}const dir=await open(resolve(path,'..'),constants.O_RDONLY|constants.O_DIRECTORY);try{await dir.sync();}finally{await dir.close();}}
async function publish(path,bytes){const temp=path+'.'+randomUUID()+'.tmp';try{await immutable(temp,bytes);try{await link(temp,path);}catch(e){if(e.code!=='EEXIST')throw e;if(!(await boundedRead(path,size)).equals(bytes))fail();}}finally{await unlink(temp).catch(()=>{});}const dir=await open(resolve(path,'..'),constants.O_RDONLY|constants.O_DIRECTORY);try{await dir.sync();}finally{await dir.close();}}
async function json(path){return JSON.parse((await boundedRead(path,size)).toString('utf8'));}
async function verifiedSnapshot(root,day){
 const p=validateFX(await json(join(root,'snapshots',day+'.json')));
 if((p.fetchedAt??p.importedAt).slice(0,10)!==day)fail();
 let raw;try{raw=await boundedRead(join(root,'archive',p.sourceHash+'.xml'),size);}catch(e){if(e.code==='ENOENT')fail();throw e;}
 const mapped=parseFX(raw,{at:p.fetchedAt??p.importedAt,imported:p.importedAt!==null});
 if(JSON.stringify(mapped)!==JSON.stringify(p))fail();return p;
}
export async function readFX(directory=defaultFXDirectory,{now=Date.now()}={}){
 const root=directory instanceof URL?fileURLToPath(directory):resolve(directory);await privateDirectory(root);await privateDirectory(join(root,'snapshots'));await privateDirectory(join(root,'archive'));
 for(let i=0;i<=7;i++){
  const day=new Date(now-i*86400000).toISOString().slice(0,10);let p;
  // A missing archive for an existing snapshot is corruption, not an absent day.
  try{await lstat(join(root,'snapshots',day+'.json'));}catch(e){if(e.code==='ENOENT')continue;throw e;}
  p=await verifiedSnapshot(root,day);if(usableFX(p,now))return p;
 }
 throw Error('FX_UNAVAILABLE');
}
export async function checkFX(directory=defaultFXDirectory,{now=Date.now()}={}){
 const root=directory instanceof URL?fileURLToPath(directory):resolve(directory);
 try{
  try{await lstat(root);}catch(e){if(e.code==='ENOENT')throw Error('FX_STORE_MISSING');throw e;}
  let p;
  try{p=await readFX(root,{now});}catch(e){
   if(e.message!=='FX_UNAVAILABLE')throw e;
   const days=(await readdir(join(root,'snapshots'))).filter(n=>/^\d{4}-\d\d-\d\d\.json$/.test(n)).sort();
   if(!days.length)throw Error('FX_STORE_EMPTY');
   p=await verifiedSnapshot(root,days.at(-1).slice(0,10));
   if((p.fetchedAt??p.importedAt)>new Date(now).toISOString())fail();
   if(!usableFX(p,now))throw Error('FX_STORE_EXPIRED');
  }
  return {state:'READY',scope:'STORED_FX_ONLY',providerRequests:0,date:p.date,fetchedAt:p.fetchedAt,importedAt:p.importedAt,sourceHash:p.sourceHash};
 }catch(e){if(['FX_STORE_MISSING','FX_STORE_EMPTY','FX_STORE_EXPIRED'].includes(e.message))throw e;throw Error('FX_STORE_INVALID');}
}
export async function storeFX({directory,source,fetcher=fetch,at=new Date().toISOString()}={}){
 const root=resolve(directory??'.state/fx-store'),day=at.slice(0,10);if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(at)||new Date(at).toISOString()!==at)fail();
 await privateDirectory(root,true);for(const n of ['claims','receipts','snapshots','archive'])await privateDirectory(join(root,n),true);
 const claim=join(root,'claims',day+'.json'),receipt=join(root,'receipts',day+'.json');let claimed=false;
 try{const f=await open(claim,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await f.writeFile(JSON.stringify({day,at}));await f.sync();claimed=true;}finally{await f.close();}}catch(e){if(e.code!=='EEXIST')throw e;}
 const claimDir=await open(join(root,'claims'),constants.O_RDONLY|constants.O_DIRECTORY);try{await claimDir.sync();}finally{await claimDir.close();}
 const claimStat=await lstat(claim);if(!claimStat.isFile()||claimStat.isSymbolicLink()||process.platform!=='win32'&&((claimStat.mode&0o077)!==0||claimStat.uid!==process.getuid()))fail();
 if(!claimed){let p;try{p=validateFX(await json(receipt));}catch(e){if(e.code==='ENOENT')throw Error('FX_UNCONFIRMED');throw e;}const raw=await boundedRead(join(root,'archive',p.sourceHash+'.xml'),size);if((p.fetchedAt??p.importedAt).slice(0,10)!==day||JSON.stringify(parseFX(raw,{at:p.fetchedAt??p.importedAt,imported:p.importedAt!==null}))!==JSON.stringify(p)||source&&digest(await boundedRead(source,size))!==p.sourceHash)fail();await publish(join(root,'snapshots',day+'.json'),Buffer.from(JSON.stringify(p)));return {state:'STORED',providerRequests:0,recovered:true};}
 let bytes,requests=0;
 if(source)bytes=await boundedRead(source,size);
 else{requests++;const response=await fetcher(fxEndpoint,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok||!response.body)throw Error('FX_HTTP_FAILED');const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>size)throw Error('FX_RESPONSE_LIMIT');chunks.push(chunk);}bytes=Buffer.concat(chunks);}
 const projection=parseFX(bytes,{at,imported:!!source});
 let prior;try{prior=await readFX(root,{now:Date.parse(at)});}catch(e){if(e.code!=='ENOENT'&&e.message!=='FX_UNAVAILABLE')throw e;}
 if(prior&&projection.date<prior.date)fail();
 await publish(join(root,'archive',projection.sourceHash+'.xml'),bytes);await publish(receipt,Buffer.from(JSON.stringify(projection)));await publish(join(root,'snapshots',day+'.json'),Buffer.from(JSON.stringify(projection)));
 return {state:'STORED',providerRequests:requests,recovered:false,date:projection.date};
}
export async function main(args){
 if(!['collect','import','check'].includes(args[0]))fail();const options={};for(let i=1;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!['--directory',...(args[0]==='import'?['--source']:[])].includes(k)||options[k]||!v||v.startsWith('--')||/[\x00-\x1f]/.test(v))fail();options[k]=v;}
 if(args[0]==='check')return checkFX(options['--directory']);
 if(args[0]==='import'&&!options['--source'])fail();return storeFX({directory:options['--directory'],source:options['--source']});
}
if(isCLIEntrypoint(import.meta.url)){try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch(e){const code=/^FX_[A-Z_]+$/.test(e.message)?e.message:'FX_FAILED';console.error((process.argv[2]==='check'?'FX_CHECK_FAILED':'FX_COLLECTION_FAILED')+' ('+code+'): details omitted.');process.exitCode=1;}}
