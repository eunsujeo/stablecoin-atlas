// Offline field observations only. No provider client, environment loading, DB or UI.
import {createHash} from 'node:crypto';
import {open,constants} from 'node:fs/promises';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonical} from './market-db/plan.mjs';
import {directory,write} from './allium-offline-files.mjs';
import {providerCapabilityPlan,capabilitySlot,capabilityToken} from './provider-capability-plan.mjs';

export const priceByteLimit=2097152;
export const priceHash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Error(code);};
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
class Numeric {constructor(lexeme){this.lexeme=lexeme;}}
export function numericLexeme(value){
 if(value===undefined||value===null)fail('NUMERIC_FIELD_MISSING');
 if(!(value instanceof Numeric)||value.lexeme.length>256)fail('NUMERIC_FIELD_INVALID');
 return value.lexeme;
}

// Retain numeric tokens before conversion; reject duplicate (including escaped) keys.
export function parsePriceBytes(bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>priceByteLimit)fail('SOURCE_SIZE_INVALID');
 let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{fail('SOURCE_UTF8_INVALID');}
 let i=0;const ws=()=>{while(/[\x20\t\r\n]/.test(text[i]??'!'))i++;};
 function string(){
  const start=i++;let escaped=false;
  while(i<text.length){const c=text[i++];if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')return JSON.parse(text.slice(start,i));}
  fail('SOURCE_JSON_INVALID');
 }
 function value(depth=0){
  if(depth>32)fail('SOURCE_DEPTH_INVALID');ws();const c=text[i];
  if(c==='"')return string();
  if(c==='{'||c==='['){
   const object=c==='{',out=object?Object.create(null):[],end=object?'}':']',keys=new Set();i++;ws();
   if(text[i]===end){i++;return out;}
   while(i<text.length){
    ws();let key;if(object){if(text[i]!=='"')fail('SOURCE_JSON_INVALID');key=string();if(keys.has(key))fail('SOURCE_DUPLICATE_KEY');keys.add(key);ws();if(text[i++]!==':')fail('SOURCE_JSON_INVALID');}
    const v=value(depth+1);if(object)out[key]=v;else out.push(v);ws();
    const next=text[i++];if(next===end)return out;if(next!==',')fail('SOURCE_JSON_INVALID');
   }
   fail('SOURCE_JSON_INVALID');
  }
  for(const [token,v] of [['true',true],['false',false],['null',null]])if(text.startsWith(token,i)){i+=token.length;return v;}
  const n=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
  if(!n)fail('SOURCE_JSON_INVALID');i+=n[0].length;return new Numeric(n[0]);
 }
 try{const out=value();ws();if(i!==text.length)fail('SOURCE_JSON_INVALID');return out;}catch(e){if(e instanceof SyntaxError)fail('SOURCE_JSON_INVALID');throw e;}
}
const ohlc=['price','open','high','close','low'];
const stats=['latest_price','low_24h','high_24h','low_1h','high_1h','percent_change_24h','percent_change_1h'];
export function utc(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))fail('TIMESTAMP_INVALID');
 const time=Date.parse(value);if(!Number.isFinite(time)||new Date(time).toISOString()!==value.replace(/(?:\.(\d{1,3}))?Z$/,(_m,f)=>'.'+(f??'').padEnd(3,'0')+'Z'))fail('TIMESTAMP_INVALID');
 return value;
}
function point(row,fields){
 if(!row||typeof row!=='object')fail('POINT_INVALID');const out={timestamp:utc(row.timestamp)};
 for(const key of fields){
  if(row[key]===undefined||row[key]===null)fail('NUMERIC_FIELD_MISSING');
  if(!(row[key] instanceof Numeric)||row[key].lexeme.length>256)fail('NUMERIC_FIELD_INVALID');
  out[key]=row[key].lexeme;
 }
 return out;
}
export function reviewPriceSource(id,bytes,expectedHash){
 const base={id,sourceHash:Buffer.isBuffer(bytes)?priceHash(bytes):null,state:'INCONCLUSIVE',issues:[],observations:null,
  currencyStatus:'UNKNOWN',windowCompleteness:'UNKNOWN',percentChangeUnit:'UNKNOWN',windowDefinition:'UNKNOWN'};
 try{
  if(!['allium-price','allium-price-history','allium-price-stats'].includes(id))fail('JOB_UNSUPPORTED');
  if(!digest(expectedHash)||base.sourceHash!==expectedHash)fail('SOURCE_HASH_MISMATCH');
  const data=parsePriceBytes(bytes);
  if(!data||typeof data!=='object'||Array.isArray(data))fail('ENVELOPE_INVALID');
  if(Object.hasOwn(data,'error')||Object.hasOwn(data,'errors'))fail('PROVIDER_ERROR_BODY');
  if(!Array.isArray(data.items))fail('ITEMS_MISSING');
  if(data.items.length===0)fail('ITEMS_EMPTY');if(data.items.length!==1)fail('ITEM_COUNT_UNEXPECTED');
  if(data.cursor!==undefined&&data.cursor!==null&&data.cursor!=='')fail('PAGINATION_UNREVIEWED');
  const row=data.items[0],history=id==='allium-price-history',tokenField=id==='allium-price'?'address':'mint';
  if(row?.chain!=='ethereum'||typeof row[tokenField]!=='string'||row[tokenField].toLowerCase()!==capabilityToken)fail('ASSET_IDENTITY_MISMATCH');
  if(!(row.decimals instanceof Numeric)||row.decimals.lexeme!=='6')fail('DECIMALS_MISMATCH');
  let points;
  const request=providerCapabilityPlan().jobs.find(j=>j.id===id);
  if(history){
   if(!Array.isArray(row.prices))fail('PRICES_MISSING');if(!row.prices.length)fail('PRICES_EMPTY');
   points=row.prices.map(p=>point(p,ohlc));const times=points.map(p=>Date.parse(p.timestamp));
   if(times.some((t,i)=>t<Date.parse(request.body.start_timestamp)||t>=Date.parse(request.body.end_timestamp)||(i>0&&t<=times[i-1])))fail('HISTORY_TIME_RANGE_OR_ORDER_INVALID');
  }else points=[point(row,id==='allium-price'?ohlc:stats)];
  base.observations={chain:row.chain,token:row[tokenField],decimals:row.decimals.lexeme,points,
   requestedWindow:history?{from:request.body.start_timestamp,toExclusive:request.body.end_timestamp,granularity:request.body.time_granularity}:null};
  base.state='FIELD_CONTRACT_OBSERVED';
 }catch(e){base.issues=[e.message];}
 return base;
}

async function privateBytes(path){
 const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const s=await f.stat();if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o777)!==0o600||s.nlink!==1||s.size>priceByteLimit)fail('PRIVATE_FILE_INVALID');const bytes=await f.readFile();if(bytes.length>priceByteLimit)fail('SOURCE_SIZE_INVALID');return bytes;}finally{await f.close();}
}
// The caller pins an independently reviewed receipt digest. This is integrity binding,
// not provider authentication or proof against coordinated source/receipt replacement.
export async function reviewPriceArchive(archive,expectedReceiptHash){
 const report=await reviewCapabilitySources(archive,expectedReceiptHash,
  ['allium-price','allium-price-history','allium-price-stats'],reviewPriceSource);
 return {...report,kind:'OFFLINE_PROVIDER_PRICE_REVIEW'};
}
// Shared offline evidence binding; selected jobs must belong to the fixed plan.
export async function reviewCapabilitySources(archive,expectedReceiptHash,ids,review){
 await directory(archive);const receiptBytes=await privateBytes(join(archive,'receipt.json'));
 if(!digest(expectedReceiptHash)||priceHash(receiptBytes)!==expectedReceiptHash)fail('RECEIPT_HASH_MISMATCH');
 // Strict preflight catches duplicate keys and malformed UTF-8 in the receipt too.
 parsePriceBytes(receiptBytes);const receipt=JSON.parse(receiptBytes.toString('utf8')),plan=providerCapabilityPlan();
 if(receipt.version!==1||receipt.kind!=='PROVIDER_CAPABILITY_RECEIPT'||receipt.planHash!==priceHash(Buffer.from(canonical(plan)))||!Array.isArray(receipt.jobs)||!Array.isArray(receipt.attempts))fail('RECEIPT_INVALID');
 const rows=[];
 if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!plan.jobs.some(j=>j.id===id)))fail('JOB_UNSUPPORTED');
 for(const job of plan.jobs.filter(j=>ids.includes(j.id))){
  const matches=receipt.jobs.filter(j=>j.id===job.id),attempts=receipt.attempts.filter(a=>a.jobId===job.id);
  const a=attempts[0],result=matches[0];
  const expectedBodyHash=job.body===null?null:priceHash(Buffer.from(canonical(job.body)));
  if(matches.length!==1||attempts.length!==1||result.provider!==job.provider||result.type!=='rest'||result.state!=='HTTP_200_JSON'||result.httpStatus!==200||a.provider!==job.provider||a.step!=='read'||a.method!==job.method||a.path!==job.path||a.bodyHash!==expectedBodyHash||a.httpStatus!==200||a.responseTruncated||a.proxyError||!Number.isSafeInteger(a.index)||a.index<0||receipt.attempts.filter(x=>x.index===a.index).length!==1||!digest(a.responseHash))fail('RECEIPT_JOB_INVALID');
  utc(a.at);const bytes=await privateBytes(join(archive,`response-${a.index}.json`));
  if(bytes.length!==a.responseBytes)fail('RECEIPT_BYTE_COUNT_MISMATCH');
  rows.push({...review(job.id,bytes,a.responseHash),receiptHash:expectedReceiptHash,recordedRequestAt:a.at,receiptState:result.state});
 }
 return {version:1,kind:'OFFLINE_PROVIDER_FIELD_REVIEW',receiptHash:expectedReceiptHash,planHash:receipt.planHash,
  originalObservationPreserved:true,costStatus:'UNCONFIRMED',rows};
}
export async function savePriceReview(outputDirectory,name,report){
 if(!/^[a-z0-9][a-z0-9-]{0,79}\.json$/.test(name))fail('REPORT_NAME_INVALID');
 await mkdir(outputDirectory,{mode:0o700,recursive:true});await directory(outputDirectory);
 await write(join(outputDirectory,name),report,async()=>{});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length!==4)fail('USAGE_RECEIPT_HASH_AND_NEW_REPORT_NAME_REQUIRED');
  const report=await reviewPriceArchive(resolve('.state/allium-executor',capabilitySlot),process.argv[2]);
  await savePriceReview(resolve('.state/provider-price-review'),process.argv[3],report);
  console.log(JSON.stringify({kind:report.kind,rows:report.rows.map(({id,state,issues})=>({id,state,issues}))}));
  if(report.rows.some(r=>r.state!=='FIELD_CONTRACT_OBSERVED'))process.exitCode=1;
 }catch(e){console.error(/^[A-Z_]+$/.test(e.message)?e.message:'OFFLINE_REVIEW_FAILED');process.exitCode=1;}
}
