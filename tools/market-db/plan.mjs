import {createHash} from 'node:crypto';
import {normalizeSources} from '../market-store.mjs';
import {validateRegistry,METRICS} from '../../web/market-model.js';
export const fixedSources=Object.freeze(['arkham-api-smoke.json','arkham-market-additional.json','arkham-chain-supply-research.json','arkham-additional-data-research.json','xrpl-gateway-obligations-readonly.json']);
export const fail=code=>{throw new Error(code);};
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function sourceName(name){if(typeof name!=='string'||!(fixedSources.includes(name)||/^market-store\/collected\/[a-f0-9-]{36}\.json$/.test(name)))fail('INVALID_SOURCE_NAME');return name;}
export function instant(value){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/.test(value))fail('INVALID_TIMESTAMP');
  const [whole,fraction='']=value.slice(0,-1).split('.');const stamp=whole+'.'+fraction.padEnd(6,'0')+'Z';
  if(!Number.isFinite(Date.parse(stamp))||new Date(stamp).toISOString().slice(0,19)!==whole)fail('INVALID_TIMESTAMP');return stamp;
}
export function sourceInstant(value){
  if(value===null)return {value:null,original:null};
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value))fail('INVALID_SOURCE_TIMESTAMP');
  const [whole,fraction='']=value.slice(0,-1).split('.');const normalized=instant(whole+'.'+fraction.slice(0,6).padEnd(6,'0')+'Z');
  return {value:normalized,original:fraction.length>6?value:null};
}
export const epochMicros=value=>{const at=instant(value);return BigInt(Date.parse(at.slice(0,19)+'Z'))*1000n+BigInt(at.slice(20,26));};
const targetFor=(registry,endpoint)=>{
  const coin=registry.coins.find(c=>endpoint===`/token/market/${c.pricingId}`||endpoint===`/token/holders/${c.pricingId}`);
  return coin?{scope:'COIN',coinId:coin.id}:null;
};
function safeSource(value,depth=0){
  if(depth>40)fail('INPUT_DEPTH');
  if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){
    if(/^(?:api[-_]?key|authorization|password|private[-_]?key|access[-_]?token|refresh[-_]?token|auth[-_]?token|secret|rpc[-_]?url|database[-_]?url)$/i.test(key)&&v!=null&&v!=='')fail('SENSITIVE_INPUT');
    if(typeof v==='string'&&/(?:postgres(?:ql)?:\/\/|https?:\/\/[^/\s]*@|https?:\/\/\S*[?&](?:api[-_]?key|access_token|token|secret|password|auth)=)/i.test(v))fail('SENSITIVE_INPUT');safeSource(v,depth+1);
  }
}
export function importPlan(registry,bytes,{kind='LEGACY_REPORT'}={}){
  validateRegistry(registry);if(!Buffer.isBuffer(bytes)||bytes.length>2*1024*1024||!['LEGACY_REPORT','PROJECTION'].includes(kind))fail('INVALID_SOURCE');
  const report=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));safeSource(report);
  if(kind==='PROJECTION'&&(report.kind!=='ARKHAM_COLLECTED_PROJECTION_NOT_ASSESSMENT'||report.schemaVersion!==1))fail('INVALID_PROJECTION');
  const hash=digest(bytes),normalized=normalizeSources(registry,[{value:report,hash}]);const units=[];let omittedUnits=0;
  const add=(raw,position)=>{
    const target=targetFor(registry,raw.endpoint),isNetwork=raw.endpoint==='/networks/status';
    if(!target&&!isNetwork){omittedUnits++;return;}
    const observedAt=raw.observedAt??report.observedAt;if(!observedAt){omittedUnits++;return;}instant(observedAt);
    const observations=normalized.observations.filter(o=>o.selector.startsWith(position+'.')).map(o=>{
      instant(o.observedAt);if(o.sourceAt!==null)sourceInstant(o.sourceAt);
      return {metric:o.metric,scope:o.metric==='CHAIN_TOTAL'?'COIN_NETWORK':METRICS[o.metric].scope,
        coinId:o.coinId,networkId:o.networkId,deploymentId:o.metric==='CHAIN_TOTAL'?null:o.deploymentId,
        suffix:o.selector.slice(position.length),state:'OBSERVED',amount:o.amount,sourceAt:o.sourceAt,legacy:o};
    });
    const networks=[];
    if(isNetwork&&raw.state==='SUCCESS'&&raw.httpStatus===200){
      for(const n of registry.networks.filter(n=>n.providerKey)){const row=raw.data?.[n.providerKey];if(!row)continue;
        if(typeof row.active!=='boolean'||typeof row.tip!=='string'||!/^\d{1,30}$/.test(row.tip))fail('INVALID_NETWORK_ROW');
        const sourceAt=row.asOf?.tip??null;if(sourceAt!==null)sourceInstant(sourceAt);
        networks.push({networkId:n.id,active:row.active,tip:row.tip,sourceAt});
      }
    }
    // An explicit null is missing; an absent optional field supplies no evidence.
    if(target&&raw.state==='SUCCESS'&&raw.httpStatus===200&&raw.endpoint.startsWith('/token/market/')){
      for(const [field,metric]of [['price','PRICE'],['circulatingSupply','CIRCULATING'],['totalSupply','COIN_TOTAL'],['totalVolume','REPORTED_VOLUME']]){
        if(Object.hasOwn(raw.data??{},field)&&raw.data[field]===null)observations.push({metric,scope:'COIN',coinId:target.coinId,networkId:null,deploymentId:null,suffix:'.data.'+field,state:'MISSING',amount:null,sourceAt:null,legacy:null});
      }
    }
    const state=raw.state==='SUCCESS'&&raw.httpStatus===200?'SUCCESS':raw.state==='FAILED'?'FAILED':raw.state==='NOT_ATTEMPTED'?'NOT_ATTEMPTED':null;
    if(!state){omittedUnits++;return;}
    units.push({position,endpoint:raw.endpoint,provider:'ARKHAM',target,state,evidenceKind:'IMPORTED_REQUEST',observedAt,
      clock:raw.observedAt?'REQUEST':'REPORT_FALLBACK',httpStatus:Number.isInteger(raw.httpStatus)?raw.httpStatus:null,
      ledgerHash:null,ledgerIndex:null,observations,networks});
  };
  for(const [field,rows]of [['additionalRequests',report.additionalRequests??[]],['requests',report.requests??[]]]){
    if(!Array.isArray(rows)||rows.length>256)fail('INPUT_REQUEST_LIMIT');
    if(report.kind==='XRPL_GATEWAY_OBLIGATIONS_RESEARCH_NOT_ASSESSMENT')break;
    rows.forEach((r,i)=>add(r,`$.${field}[${i}]`));
  }
  if(report.kind==='XRPL_GATEWAY_OBLIGATIONS_RESEARCH_NOT_ASSESSMENT')for(const [i,row]of (report.observations??[]).entries()){
    const position=`$.observations[${i}]`,legacy=normalized.observations.find(o=>o.selector===position+'.value');if(!legacy){omittedUnits++;continue;}
    instant(legacy.observedAt);const d=registry.deployments.find(d=>d.id===legacy.deploymentId),n=registry.networks.find(n=>n.id===d.networkId);
    if(report.networkBinding!==undefined&&report.networkBinding!=='MATCHED_SERVER_REPORTED_MAINNET_ID')fail('XRPL_NETWORK_BINDING_MISMATCH');
    if(report.networkBinding==='MATCHED_SERVER_REPORTED_MAINNET_ID'&&n.networkId!=='0')fail('XRPL_NETWORK_BINDING_MISMATCH');
    units.push({position,endpoint:'/gateway_balances',provider:'XRPL_RPC',target:{scope:'DEPLOYMENT',coinId:d.coinId,networkId:d.networkId,deploymentId:d.id},
      state:'RECORDED',evidenceKind:'IMPORTED_UNIT',observedAt:legacy.observedAt,clock:'REPORT_FALLBACK',httpStatus:null,
      ledgerHash:legacy.ledgerHash,ledgerIndex:legacy.ledgerIndex,
      networkEvidence:report.networkBinding??'UNCONFIRMED',
      xrplTarget:{issuer:d.identity.issuer,currency:d.identity.currency,network_identity:n.networkId},
      observations:[{metric:'OBLIGATIONS',scope:'DEPLOYMENT',coinId:d.coinId,networkId:d.networkId,deploymentId:d.id,suffix:'.value',state:'OBSERVED',amount:legacy.amount,sourceAt:legacy.sourceAt,legacy}],networks:[]});
  }
  const observationCount=units.reduce((n,u)=>n+u.observations.length,0),networkCount=units.reduce((n,u)=>n+u.networks.length,0);
  if(units.length>256||observationCount+networkCount>5000||!units.length)fail('EMPTY_OR_OVERSIZE_IMPORT');
  const coinIds=new Set(),networkIds=new Set(),deploymentIds=new Set();
  for(const u of units){if(u.target?.coinId)coinIds.add(u.target.coinId);if(u.target?.networkId)networkIds.add(u.target.networkId);
    if(u.target?.deploymentId)deploymentIds.add(u.target.deploymentId);
    for(const o of u.observations){coinIds.add(o.coinId);if(o.networkId)networkIds.add(o.networkId);if(o.legacy?.deploymentId)deploymentIds.add(o.legacy.deploymentId);}
    for(const n of u.networks)networkIds.add(n.networkId);
  }
  const bindings={schemaVersion:1,coins:registry.coins.filter(c=>coinIds.has(c.id)),networks:registry.networks.filter(n=>networkIds.has(n.id)),deployments:registry.deployments.filter(d=>deploymentIds.has(d.id))};
  for(const group of Object.values(bindings))if(Array.isArray(group))group.sort((a,b)=>a.id.localeCompare(b.id));
  const bindingBytes=Buffer.from(canonical(bindings)),bindingHash=digest(bindingBytes);
  const body={mapperVersion:1,hash,kind,bindings,units,observationCount,networkCount,omittedUnits};
  return {...body,planHash:digest(canonical(body)),bindingBytes,bindingHash,bytes};
}
