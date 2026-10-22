import {connectDatabase} from './connection.mjs';
import {readRegistrationIndex,readRegistrationHistory} from './registration.mjs';
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export function registrationRequest(url){
 const u=new URL(url,'http://localhost');
 if(u.pathname==='/registration-index.json'&&u.search==='')return {kind:'index',key:'index'};
 if(u.pathname!=='/registration-history.json'||[...u.searchParams.keys()].length!==3||
  !['selection','coin','metric'].every(k=>u.searchParams.getAll(k).length===1))throw Error('INVALID_ARGUMENTS');
 const selectionId=u.searchParams.get('selection'),coinId=u.searchParams.get('coin'),metric=u.searchParams.get('metric');
 if(!hash(selectionId)||!['usdt','usdc','rlusd','jpyc','jpysc'].includes(coinId)||!['NETWORK_CIRCULATING','NETWORK_MINTED'].includes(metric))throw Error('INVALID_ARGUMENTS');
 return {kind:'history',selectionId,coinId,metric,key:[selectionId,coinId,metric].join(':')};
}
// One active connection, at most four distinct pending requests, 16 short-lived cached DTOs.
export function databaseRegistrationReader({env,connect=connectDatabase,index=readRegistrationIndex,history=readRegistrationHistory,now=Date.now}={}){
 const pending=new Map(),cache=new Map();let tail=Promise.resolve();
 function request(input){
  const hit=cache.get(input.key);if(hit&&hit.expires>now())return Promise.resolve(hit.value);
  if(pending.has(input.key))return pending.get(input.key);
  if(pending.size>=4)return Promise.reject(Error('READ_QUEUE_FULL'));
  const operation=tail.catch(()=>{}).then(async()=>{
   let client;try{
    client=await connect(env);let value;
    if(input.kind==='index')value=await index(client);
    else{
     const scope=await index(client);
     if(scope.selectionId!==input.selectionId)throw Error('SELECTION_CHANGED');
     const metric=scope.coins.find(c=>c.id===input.coinId)?.metrics.find(m=>m.metric===input.metric);
     if(!metric)throw Error('SUPPLY_UNAVAILABLE');
     const result=await history(client,{selectionId:input.selectionId,coinId:input.coinId,metric:input.metric,from:metric.from,to:metric.to,sourceId:metric.sourceId});
     value={schemaVersion:1,kind:'REGISTERED_SUPPLY_HISTORY',selectionId:input.selectionId,coinId:input.coinId,metric:input.metric,
      pegCurrency:result.pegCurrency,contract:result.contract,from:result.from,to:result.to,updatedAt:result.updatedAt,state:result.state,
      sourceId:result.sourceId??null,sourceHash:result.sourceHash??null,missingNetworks:result.missingNetworks??[],series:result.series};
    }
    if(Buffer.byteLength(JSON.stringify(value))>2*1024*1024)throw Error('READ_LIMIT');
    cache.delete(input.key);cache.set(input.key,{value,expires:now()+10000});
    while(cache.size>16)cache.delete(cache.keys().next().value);
    return value;
   }finally{await client?.end().catch(()=>{});}
  });
  pending.set(input.key,operation);tail=operation;
  operation.finally(()=>pending.delete(input.key)).catch(()=>{});return operation;
 }
 return url=>request(registrationRequest(url));
}
