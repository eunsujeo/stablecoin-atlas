import {createHash} from 'node:crypto';
import {tronAddress} from '../../src/tron/address.ts';
import {USDT,TXID} from '../../web/wallet-flow/model.mjs';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
// JSON numeric tokens are retained as strings before Number rounding can occur.
export function parseExact(text){return JSON.parse(text,(key,value,context)=>typeof value==='number'?context.source:value);}
const amount=x=>{if(typeof x==='number'&&!Number.isSafeInteger(x))throw Error('UNSAFE_AMOUNT');const s=String(x);if(!/^(0|[1-9][0-9]{0,77})$/.test(s))throw Error('INVALID_AMOUNT');return s;};
const optional=x=>x===undefined||x===null?null:amount(x);
const integer=x=>{const n=Number(amount(x));if(!Number.isSafeInteger(n))throw Error('INVALID_INTEGER');return n;};
const address=x=>tronAddress(x).base58;
const TRANSFER='ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
function topicAddress(x){if(typeof x!=='string'||!/^0{24}[a-fA-F0-9]{40}$/.test(x))throw Error('INVALID_TRANSFER_ADDRESS');return address('41'+x.slice(24));}
export function normalizeTransaction(body,receipt,sourceHash){
 if(!TXID.test(body?.txID)||receipt?.id!==body.txID||!Array.isArray(body.raw_data?.contract)||body.raw_data.contract.length!==1)throw Error('TRANSACTION_BINDING');
 if(body.raw_data_hex!==undefined&&(!/^(?:[a-fA-F0-9]{2})+$/.test(body.raw_data_hex)||sha256(Buffer.from(body.raw_data_hex,'hex'))!==body.txID))throw Error('TRANSACTION_HASH_MISMATCH');
 const contract=body.raw_data.contract[0],p=contract.parameter?.value;if(!p?.owner_address)throw Error('MISSING_CALLER');
 const result=body.ret?.[0]?.contractRet;if(typeof result!=='string')throw Error('MISSING_TRANSACTION_STATUS');
 const success=result==='SUCCESS'&&(!receipt.receipt?.result||receipt.receipt.result==='SUCCESS');
 const tx={txid:body.txID,blockNumber:integer(receipt.blockNumber),timestamp:integer(receipt.blockTimeStamp),status:success?'SUCCESS':'FAILED',caller:address(p.owner_address),feeSun:optional(receipt.fee),energyUsage:optional(receipt.receipt?.energy_usage_total),energyFeeSun:optional(receipt.receipt?.energy_fee),netUsage:optional(receipt.receipt?.net_usage),netFeeSun:optional(receipt.receipt?.net_fee),sourceHash};
 const events=[];if(!success)return {tx,events};
 for(const [index,log]of (receipt.log??[]).entries()){
  if(log.topics?.[0]?.toLowerCase()!==TRANSFER)continue;
  const token=address(log.address.length===40?'41'+log.address:log.address);if(token!==USDT)continue;
  if(log.topics.length!==3||!/^([a-fA-F0-9]{64})$/.test(log.data))throw Error('INVALID_USDT_LOG');
  events.push({id:`${tx.txid}:log:${index}`,txid:tx.txid,kind:'USDT_TRANSFER',from:topicAddress(log.topics[1]),to:topicAddress(log.topics[2]),amountRaw:BigInt('0x'+log.data).toString(),resource:null});
 }
 if(contract.type==='TransferContract')events.push({id:`${tx.txid}:contract:0`,txid:tx.txid,kind:'TRX_TRANSFER',from:tx.caller,to:address(p.to_address),amountRaw:amount(p.amount),resource:null});
 if(['DelegateResourceContract','UnDelegateResourceContract'].includes(contract.type)){
 const r=p.resource??'BANDWIDTH',resource=['ENERGY','1',1].includes(r)?'ENERGY':['BANDWIDTH','0',0].includes(r)?'BANDWIDTH':null;if(!resource)throw Error('UNKNOWN_RESOURCE');
 events.push({id:`${tx.txid}:contract:0`,txid:tx.txid,kind:contract.type==='DelegateResourceContract'?'RESOURCE_DELEGATE':'RESOURCE_UNDELEGATE',from:tx.caller,to:address(p.receiver_address),amountRaw:amount(p.balance),resource});
 }
 return {tx,events};
}
export function normalizeBalance(data,expected,sourceHash,asOf){
 if(!Array.isArray(data?.data)||data.data.length>1)throw Error('ACCOUNT_RESPONSE');if(!data.data.length)return null;const a=data.data[0];if(address(a.address)!==expected)throw Error('ACCOUNT_BINDING');
 const entries=(a.trc20??[]).filter(v=>Object.hasOwn(v,USDT));if(entries.length>1)throw Error('DUPLICATE_BALANCE');return {trxSun:optional(a.balance),usdtRaw:entries.length?amount(entries[0][USDT]):null,asOf,blockNumber:null,sourceHash};
}
