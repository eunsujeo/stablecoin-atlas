import {createHash} from 'node:crypto';
import {mkdir,lstat,open,constants,readdir,link,unlink} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {rename} from 'node:fs/promises';
import {isCLIEntrypoint} from './cli-entrypoint.mjs';
import {availableFX} from '../web/fx-model.js';
import {randomUUID} from 'node:crypto';
import {boundedRead} from './evidence-store.mjs';
import {parsePriceBytes,numericLexeme} from './provider-price-review.mjs';
import {registrationDecimal} from './market-registration/decimal.mjs';
import {validateFX} from '../web/fx-model.js';
import {canonical} from './market-db/plan.mjs';
export const yahooEndpoint='https://query1.finance.yahoo.com/v8/finance/chart/KRW%3DX?interval=1d&range=5d';
export const yahooByteLimit=65536;
export const defaultYahooDirectory='.state/yahoo-fx-store';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('YAHOO_FX_INVALID');};
export function parseYahooFX(bytes,{at}={}){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>yahooByteLimit)fail();
 const envelope=parsePriceBytes(bytes),results=envelope?.chart?.result;
 if(envelope?.chart?.error!==null||!Array.isArray(results)||results.length!==1)fail();
 const p=results[0]?.meta;
 if(!['KRW=X','USDKRW=X'].includes(p?.symbol)||p.currency!=='KRW'||p.instrumentType!=='CURRENCY')fail();
 const timestamp=numericLexeme(p.regularMarketTime);
 if(!/^[0-9]{1,12}$/.test(timestamp))fail();
 const observedAt=new Date(Number(timestamp)*1000).toISOString();
 return validateFX({schemaVersion:3,kind:'YAHOO_REFERENCE_FX',provider:'YAHOO_FINANCE',rateType:'MARKET_QUOTE',symbol:'USDKRW=X',base:'USD',quote:'KRW',date:observedAt.slice(0,10),observedAt,krwPerUSD:registrationDecimal(numericLexeme(p.regularMarketPrice)),sourceHash:hash(bytes),fetchedAt:at,importedAt:null});
}
async function directory(path,create=false){
 if(create)await mkdir(path,{recursive:true,mode:0o700});const s=await lstat(path);
 if(!s.isDirectory()||s.isSymbolicLink()||process.platform!=='win32'&&(s.uid!==process.getuid()||(s.mode&0o077)))fail();
}
async function syncDirectory(path){const f=await open(path,constants.O_RDONLY|constants.O_DIRECTORY);try{await f.sync();}finally{await f.close();}}
async function immutable(path,bytes){
 let f;try{f=await open(path,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);await f.writeFile(bytes);await f.sync();}
 catch(e){if(e.code!=='EEXIST')throw e;if(!(await boundedRead(path,yahooByteLimit)).equals(bytes))fail();}finally{await f?.close();}
 await syncDirectory(resolve(path,'..'));
}
async function publish(path,bytes){
 const temp=path+'.'+randomUUID()+'.tmp';try{await immutable(temp,bytes);try{await link(temp,path);}catch(e){if(e.code!=='EEXIST')throw e;if(!(await boundedRead(path,yahooByteLimit)).equals(bytes))fail();}await syncDirectory(resolve(path,'..'));}finally{await unlink(temp).catch(()=>{});}
}
async function input(root,day){
 const payload=JSON.parse((await boundedRead(join(root,'snapshots',day+'.json'),yahooByteLimit)).toString('utf8'));validateFX(payload);
 if(payload.schemaVersion!==3||payload.fetchedAt.slice(0,10)!==day)fail();
 const raw=await boundedRead(join(root,'archive',payload.sourceHash+'.json'),yahooByteLimit);
 if(canonical(parseYahooFX(raw,{at:payload.fetchedAt}))!==canonical(payload))fail();return {payload,raw};
}
export async function storedYahooInputs(directoryPath=defaultYahooDirectory){
 const root=resolve(directoryPath);await directory(root);await directory(join(root,'snapshots'));await directory(join(root,'archive'));
 const names=(await readdir(join(root,'snapshots'))).sort();if(!names.length||names.some(n=>!/^\d{4}-\d\d-\d\d\.json$/.test(n)))fail();
 const results=[];for(const n of names)results.push(await input(root,n.slice(0,10)));return results;
}
export async function collectYahooFX({directoryPath=defaultYahooDirectory,at=new Date().toISOString(),fetcher=fetch}={}){
 if(typeof at!=='string'||new Date(at).toISOString()!==at)fail();
 const root=resolve(directoryPath),day=at.slice(0,10);await directory(root,true);
 for(const name of ['claims','receipts','snapshots','archive','failures'])await directory(join(root,name),true);
 // Validate every existing snapshot before consuming a new day or contacting the provider.
 if((await readdir(join(root,'snapshots'))).length)await storedYahooInputs(root);
 const claim=join(root,'claims',day+'.json');let f;
 try{f=await open(claim,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);await f.writeFile(JSON.stringify({provider:'YAHOO',day,at,endpoint:yahooEndpoint,maxGET:1,maxBytes:yahooByteLimit,timeoutMs:20000,retries:0}));await f.sync();}
 catch(e){if(e.code==='EEXIST')throw Error('YAHOO_DAY_CONSUMED');throw e;}finally{await f?.close();}
 await syncDirectory(join(root,'claims'));
 let status=null,size=0,sourceHash=null;
 try{
  const response=await fetcher(yahooEndpoint,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json','User-Agent':'StablecoinAtlas/1.0'}});status=response.status;
  if(!response.body)throw Error('YAHOO_HTTP_FAILED');
  const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>yahooByteLimit)throw Error('YAHOO_RESPONSE_LIMIT');chunks.push(chunk);}
  const raw=Buffer.concat(chunks);sourceHash=hash(raw);
  await immutable(join(root,'archive',sourceHash+'.json'),raw);
  if(status!==200)throw Error('YAHOO_HTTP_FAILED');
  const payload=parseYahooFX(raw,{at});
  await publish(join(root,'receipts',day+'.json'),Buffer.from(JSON.stringify(payload)));
  await publish(join(root,'snapshots',day+'.json'),Buffer.from(JSON.stringify(payload)));
  return {state:'STORED',providerRequests:1,bytes:size,date:payload.date};
 }catch(e){
  const code=e.cause?.code??e.code??e.message;
  await immutable(join(root,'failures',day+'.json'),Buffer.from(JSON.stringify({state:'FAILED',day,at,httpStatus:status,bytes:size,sourceHash,errorCode:typeof code==='string'&&/^[A-Z_0-9]{1,80}$/.test(code)?code:'COLLECTION_FAILED'})));
  throw e;
 }
}

export async function reconcileYahooFX(root,day){
 if(!/^\d{4}-\d\d-\d\d$/.test(day))fail();
 await directory(root);
 const claim=JSON.parse((await boundedRead(join(root,'claims',day+'.json'),65536)).toString());
 const failure=JSON.parse((await boundedRead(join(root,'failures',day+'.json'),65536)).toString());
 if(claim.day!==day||claim.endpoint!==yahooEndpoint||claim.at!==failure.at||failure.httpStatus!==200||!/^[a-f0-9]{64}$/.test(failure.sourceHash))fail();
 const raw=await boundedRead(join(root,'archive',failure.sourceHash+'.json'),yahooByteLimit);
 if(hash(raw)!==failure.sourceHash)fail();
 const p=parseYahooFX(raw,{at:claim.at});
 await publish(join(root,'receipts',day+'.json'),Buffer.from(JSON.stringify(p)));
 await publish(join(root,'snapshots',day+'.json'),Buffer.from(JSON.stringify(p)));
 return {state:'RECONCILED_OFFLINE',date:p.date,providerRequests:0};
}
// Publishing never reads credentials or exposes raw provider responses.
export async function publishYahooFX(root,target){
 const inputs=await storedYahooInputs(root),p=inputs.map(i=>i.payload).sort((a,b)=>a.observedAt.localeCompare(b.observedAt)).at(-1);
 if(!availableFX(p))throw Error('YAHOO_FX_INVALID');
 const parent=await lstat(dirname(target));
 if(!parent.isDirectory()||parent.isSymbolicLink()||parent.uid!==process.getuid()||(parent.mode&0o022))throw Error('YAHOO_PUBLIC_DIRECTORY');
 const temp=target+'.'+randomUUID()+'.tmp';let f;
 try{f=await open(temp,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o640);await f.chmod(0o640);await f.writeFile(JSON.stringify(p));await f.sync();await f.close();f=null;await rename(temp,target);await syncDirectory(dirname(target));}
 finally{await f?.close();await unlink(temp).catch(()=>{});}
 return {state:'PUBLISHED',provider:p.provider,date:p.date};
}
export async function readYahooFX(file,{now=Date.now()}={}){
 const p=validateFX(JSON.parse((await boundedRead(file,65536)).toString('utf8')));
 if(p.schemaVersion!==3||!availableFX(p,now))throw Error('YAHOO_FX_INVALID');
 const keys=['schemaVersion','kind','provider','rateType','symbol','base','quote','date','observedAt','krwPerUSD','sourceHash','fetchedAt','importedAt'];
 return Object.fromEntries(keys.map(k=>[k,p[k]]));
}
if(isCLIEntrypoint(import.meta.url)){
 try{
  const [command,root,target,...extra]=process.argv.slice(2);
  if(!['collect','publish'].includes(command)||!root||extra.length||(command==='publish'&&!target))throw Error('ARGUMENTS_INVALID');
  const result=command==='collect'?await collectYahooFX({directoryPath:root}):{state:'OFFLINE_PUBLISH',providerRequests:0};
  if(target)await publishYahooFX(root,target);
  console.log(JSON.stringify(result));
 }catch(e){console.error(/^[A-Z_0-9]{1,80}$/.test(e.message)?e.message:'YAHOO_COLLECTION_FAILED');process.exitCode=1;}
}
