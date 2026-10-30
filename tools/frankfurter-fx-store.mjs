import {createHash} from 'node:crypto';
import {mkdir,lstat,open,constants,readdir,link,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {boundedRead} from './evidence-store.mjs';
import {parsePriceBytes,numericLexeme} from './provider-price-review.mjs';
import {registrationDecimal} from './market-registration/decimal.mjs';
import {validateFX} from '../web/fx-model.js';
import {canonical} from './market-db/plan.mjs';
export const frankfurterEndpoint='https://api.frankfurter.dev/v2/rate/usd/krw';
export const frankfurterByteLimit=65536;
export const defaultFrankfurterDirectory='.state/frankfurter-fx-store';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('FRANKFURTER_FX_INVALID');};
export function parseFrankfurterFX(bytes,{at}={}){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>frankfurterByteLimit)fail();
 const p=parsePriceBytes(bytes);
 if(!p||p.base!=='USD'||p.quote!=='KRW')fail();
 return validateFX({schemaVersion:2,kind:'FRANKFURTER_REFERENCE_FX',provider:'FRANKFURTER',rateType:'BLENDED_REFERENCE',base:'USD',quote:'KRW',date:p.date,krwPerUSD:registrationDecimal(numericLexeme(p.rate)),sourceHash:hash(bytes),fetchedAt:at,importedAt:null});
}
async function directory(path,create=false){
 if(create)await mkdir(path,{recursive:true,mode:0o700});const s=await lstat(path);
 if(!s.isDirectory()||s.isSymbolicLink()||process.platform!=='win32'&&(s.uid!==process.getuid()||(s.mode&0o077)))fail();
}
async function syncDirectory(path){const f=await open(path,constants.O_RDONLY|constants.O_DIRECTORY);try{await f.sync();}finally{await f.close();}}
async function immutable(path,bytes){
 let f;try{f=await open(path,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);await f.writeFile(bytes);await f.sync();}
 catch(e){if(e.code!=='EEXIST')throw e;if(!(await boundedRead(path,frankfurterByteLimit)).equals(bytes))fail();}finally{await f?.close();}
 await syncDirectory(resolve(path,'..'));
}
async function publish(path,bytes){
 const temp=path+'.'+randomUUID()+'.tmp';try{await immutable(temp,bytes);try{await link(temp,path);}catch(e){if(e.code!=='EEXIST')throw e;if(!(await boundedRead(path,frankfurterByteLimit)).equals(bytes))fail();}await syncDirectory(resolve(path,'..'));}finally{await unlink(temp).catch(()=>{});}
}
async function input(root,day){
 const payload=JSON.parse((await boundedRead(join(root,'snapshots',day+'.json'),frankfurterByteLimit)).toString('utf8'));validateFX(payload);
 if(payload.schemaVersion!==2||payload.fetchedAt.slice(0,10)!==day)fail();
 const raw=await boundedRead(join(root,'archive',payload.sourceHash+'.json'),frankfurterByteLimit);
 if(canonical(parseFrankfurterFX(raw,{at:payload.fetchedAt}))!==canonical(payload))fail();return {payload,raw};
}
export async function storedFrankfurterInputs(directoryPath=defaultFrankfurterDirectory){
 const root=resolve(directoryPath);await directory(root);await directory(join(root,'snapshots'));await directory(join(root,'archive'));
 const names=(await readdir(join(root,'snapshots'))).sort();if(!names.length||names.some(n=>!/^\d{4}-\d\d-\d\d\.json$/.test(n)))fail();
 const results=[];for(const n of names)results.push(await input(root,n.slice(0,10)));return results;
}
export async function collectFrankfurterFX({directoryPath=defaultFrankfurterDirectory,at=new Date().toISOString(),fetcher=fetch}={}){
 if(typeof at!=='string'||new Date(at).toISOString()!==at)fail();
 const root=resolve(directoryPath),day=at.slice(0,10);await directory(root,true);
 for(const name of ['claims','receipts','snapshots','archive','failures'])await directory(join(root,name),true);
 // Validate every existing snapshot before consuming a new day or contacting the provider.
 if((await readdir(join(root,'snapshots'))).length)await storedFrankfurterInputs(root);
 const claim=join(root,'claims',day+'.json');let f;
 try{f=await open(claim,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);await f.writeFile(JSON.stringify({provider:'FRANKFURTER',day,at,endpoint:frankfurterEndpoint,maxGET:1,maxBytes:frankfurterByteLimit,timeoutMs:20000,retries:0}));await f.sync();}
 catch(e){if(e.code==='EEXIST')throw Error('FRANKFURTER_DAY_CONSUMED');throw e;}finally{await f?.close();}
 await syncDirectory(join(root,'claims'));
 let status=null,size=0,sourceHash=null;
 try{
  const response=await fetcher(frankfurterEndpoint,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});status=response.status;
  if(!response.body)throw Error('FRANKFURTER_HTTP_FAILED');
  const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>frankfurterByteLimit)throw Error('FRANKFURTER_RESPONSE_LIMIT');chunks.push(chunk);}
  const raw=Buffer.concat(chunks);sourceHash=hash(raw);
  await immutable(join(root,'archive',sourceHash+'.json'),raw);
  if(status!==200)throw Error('FRANKFURTER_HTTP_FAILED');
  const payload=parseFrankfurterFX(raw,{at});
  await publish(join(root,'receipts',day+'.json'),Buffer.from(JSON.stringify(payload)));
  await publish(join(root,'snapshots',day+'.json'),Buffer.from(JSON.stringify(payload)));
  return {state:'STORED',providerRequests:1,bytes:size,date:payload.date};
 }catch(e){
  const code=e.cause?.code??e.code??e.message;
  await immutable(join(root,'failures',day+'.json'),Buffer.from(JSON.stringify({state:'FAILED',day,at,httpStatus:status,bytes:size,sourceHash,errorCode:typeof code==='string'&&/^[A-Z_0-9]{1,80}$/.test(code)?code:'COLLECTION_FAILED'})));
  throw e;
 }
}
