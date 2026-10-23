import {createHash} from 'node:crypto';
import {validateRegistration,isoTime} from './metadata.mjs';
import {requireProviderIdentity} from './planner.mjs';
import {registrationDecimal} from './decimal.mjs';
import {parseHistorySource} from '../supply-history-source.mjs';
export const coinMarketMapper='defillama-global-market-v1';
const invalid=()=>{throw Error('REGISTRATION_COIN_MARKET_INVALID');};
export const marketDay=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const field=(state,amount=null)=>({state,amount});
function price(value){if(value===null||value===undefined)return field('MISSING');try{return field('AVAILABLE',registrationDecimal(value));}catch{return field('INVALID');}}
function circulating(source,coin,fetchedAt){
 if(source.tokens===undefined)return {...field('MISSING'),day:null};
 try{
  if(!Array.isArray(source.tokens)||source.tokens.length>12000)invalid();const seen=new Set();let last=null;
  for(const row of source.tokens){
   if(typeof row?.date!=='string'||!/^\d{1,11}$/.test(row.date)||BigInt(row.date)%86400n!==0n)invalid();
   const day=new Date(Number(row.date)*1000).toISOString().slice(0,10);if(!marketDay(day)||seen.has(day))invalid();seen.add(day);
   if(day<=fetchedAt.slice(0,10)&&(!last||day>last.day))last={day,row};
  }
  if(!last)return {...field('MISSING'),day:null};
  const value=last.row.circulating;if(value===undefined||value===null)return {...field('MISSING'),day:null};
  if(typeof value!=='object'||Array.isArray(value))invalid();
  if(value[coin.defillama.pegType]===undefined||value[coin.defillama.pegType]===null)return {...field('MISSING'),day:null};
  return {...field('AVAILABLE',registrationDecimal(value[coin.defillama.pegType])),day:last.day};
 }catch{return {...field('INVALID'),day:null};}
}
export function coinMarketProjection(metadata,legacy,bytes,{selectionId,coinId,fetchedAt,requestDay}={}){
 validateRegistration(metadata,legacy);const coin=metadata.coins.find(c=>c.id===coinId);
 if(!coin||!/^[a-f0-9]{64}$/.test(selectionId??'')||!isoTime(fetchedAt)||!marketDay(requestDay)||Date.parse(fetchedAt)<Date.parse(requestDay)||Date.parse(fetchedAt)>=Date.parse(requestDay)+86460000)invalid();
 const source=parseHistorySource(bytes);requireProviderIdentity(coin,source);
 if(coin.defillama.primaryAddress!==null&&(typeof source.address!=='string'||source.address.toLowerCase()!==coin.defillama.primaryAddress.toLowerCase()))throw Error('REGISTRATION_CONTRACT_IDENTITY_MISMATCH');
 return {schemaVersion:1,kind:'REGISTERED_COIN_MARKET',mapperVersion:coinMarketMapper,selectionId,coinId,pegCurrency:coin.pegCurrency,sourceHash:createHash('sha256').update(bytes).digest('hex'),requestDay,fetchedAt,
  price:{...price(source.price),unit:'USD',sourceAsOf:null},circulating:{...circulating(source,coin,fetchedAt),unit:'token'}};
}
export function validateCoinMarketProjection(p){
 if(!p||p.schemaVersion!==1||p.kind!=='REGISTERED_COIN_MARKET'||p.mapperVersion!==coinMarketMapper||!['usdt','usdc','rlusd','jpyc','jpysc'].includes(p.coinId)||!['USD','JPY'].includes(p.pegCurrency)||!/^[a-f0-9]{64}$/.test(p.selectionId)||!/^[a-f0-9]{64}$/.test(p.sourceHash)||!marketDay(p.requestDay)||!isoTime(p.fetchedAt)||Date.parse(p.fetchedAt)<Date.parse(p.requestDay)||Date.parse(p.fetchedAt)>=Date.parse(p.requestDay)+86460000||p.price?.unit!=='USD'||p.price.sourceAsOf!==null||p.circulating?.unit!=='token')invalid();
 for(const v of [p.price,p.circulating]){if(!['AVAILABLE','MISSING','INVALID'].includes(v.state))invalid();if(v.state==='AVAILABLE'){try{if(registrationDecimal(v.amount)!==v.amount)invalid();}catch{invalid();}}else if(v.amount!==null)invalid();}
 if(p.circulating.state==='AVAILABLE'? !marketDay(p.circulating.day)||p.circulating.day>p.fetchedAt.slice(0,10):p.circulating.day!==null)invalid();return p;
}
