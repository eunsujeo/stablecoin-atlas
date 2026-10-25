import {readFile,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parseHistorySource,sourceByteLimit} from './supply-history-source.mjs';
import {registrationDecimal,registrationUnits} from './market-registration/decimal.mjs';
const assets={usdc:['2','USDC','usd-coin'],usdt:['1','USDT','tether'],rlusd:['250','RLUSD','ripple-usd']};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const fail=()=>{throw Error('SOURCE_SUPPLY_INPUT_INVALID');};
// Offline candidate selection only. It neither authenticates token contracts nor reads networks.
export function sourceSupplySelection(bytes,{coinId,sha256,day,fetchedAt}){
 const spec=Object.hasOwn(assets,coinId)?assets[coinId]:null;
 if(!spec||!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>sourceByteLimit||!/^\d{4}-\d{2}-\d{2}$/.test(day??'')||!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(fetchedAt??'')||!Number.isFinite(Date.parse(fetchedAt)))fail();
 const date=new Date(day+'T00:00:00.000Z');
 if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==day||day>fetchedAt.slice(0,10))fail();
 const sourceHash=createHash('sha256').update(bytes).digest('hex');if(sourceHash!==sha256)fail();
 const source=parseHistorySource(bytes);
 if(!object(source)||source.id!==spec[0]||source.symbol!==spec[1]||source.gecko_id!==spec[2]||source.pegType!=='peggedUSD'||!object(source.chainBalances))fail();
 const balances=Object.entries(source.chainBalances);if(!balances.length||balances.length>512)fail();
 const timestamp=String(date.valueOf()/1000),positive=[],excluded=[];let zero=0;
 for(const [network,entry]of balances){
  if(!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/.test(network))fail();
  const reject=reason=>excluded.push({network,reason});
  if(!Array.isArray(entry?.tokens)||entry.tokens.length>20000){reject('INVALID_SERIES');continue;}
  const rows=entry.tokens.filter(row=>object(row)&&row.date===timestamp);
  if(rows.length!==1){reject(rows.length?'DUPLICATE_DAY':'DAY_MISSING');continue;}
  const amount=rows[0].circulating?.peggedUSD;
  if(amount===null||amount===undefined){reject('CIRCULATING_MISSING');continue;}
  let normalized;
  try{normalized=registrationDecimal(amount);}catch{reject('CIRCULATING_INVALID');continue;}
  if(normalized==='0'){zero++;continue;}
  positive.push({network,amount:normalized});
 }
 positive.sort((a,b)=>{const x=registrationUnits(a.amount),y=registrationUnits(b.amount);return x>y?-1:x<y?1:a.network<b.network?-1:a.network>b.network?1:0;});
 return {kind:'OFFLINE_SOURCE_REVIEW_CANDIDATES',coinId,symbol:spec[1],day,metric:'NETWORK_CIRCULATING',unit:'token',supplyScope:'PROVIDER_NETWORK_AGGREGATE',sourceHash,fetchedAt,sourceObservationClock:'REQUEST',state:excluded.length?'PARTIAL':'COMPLETE_FOR_STORED_SOURCE',networkCount:balances.length,positiveCount:positive.length,zeroCount:zero,selected:positive.slice(0,10).map((row,index)=>({ordinal:index+1,...row})),excluded,providerRequests:0,databaseWrites:0};
}
async function main(args){
 if(args.length!==10)fail();const input={};const allowed=['--coin','--source','--sha256','--day','--fetched-at'];
 for(let i=0;i<args.length;i+=2){if(!allowed.includes(args[i])||Object.hasOwn(input,args[i])||!args[i+1])fail();input[args[i]]=args[i+1];}
 const info=await stat(input['--source']);if(!info.isFile()||info.size>sourceByteLimit)fail();
 const result=sourceSupplySelection(await readFile(input['--source']),{coinId:input['--coin'],sha256:input['--sha256'],day:input['--day'],fetchedAt:input['--fetched-at']});
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(()=>{process.stderr.write('SOURCE_SUPPLY_INPUT_INVALID\n');process.exitCode=1;});
