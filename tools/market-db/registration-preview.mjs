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
// One connection, four pending keys; verified index 10s, immutable history 1h/10 entries/8MiB.
export function databaseRegistrationReader({env,connect=connectDatabase,index=readRegistrationIndex,history=readRegistrationHistory,now=Date.now}={}){
 const pending=new Map(),cache=new Map();let tail=Promise.resolve(),scope=null,bytesUsed=0;
 const pin=(input,value)=>{
  if(value.selectionId!==input.selectionId)throw Error('SELECTION_CHANGED');
  const metric=value.coins.find(c=>c.id===input.coinId)?.metrics.find(m=>m.metric===input.metric);
  if(!metric)throw Error('SUPPLY_UNAVAILABLE');
  return {...metric,key:[input.key,metric.sourceId,metric.from,metric.to].join(':')};
 };
 const hit=p=>{const entry=cache.get(p.key);return entry&&entry.expires>now()?entry.value:null;};
 const save=(p,value)=>{
  const bytes=Buffer.byteLength(JSON.stringify(value));if(bytes>2*1024*1024)throw Error('READ_LIMIT');
  for(const [key,entry]of cache)if(entry.expires<=now()||key===p.key){bytesUsed-=entry.bytes;cache.delete(key);}
  cache.set(p.key,{value,bytes,expires:now()+3600000});bytesUsed+=bytes;
  while(cache.size>10||bytesUsed>8*1024*1024){const key=cache.keys().next().value;bytesUsed-=cache.get(key).bytes;cache.delete(key);}
 };
 function request(input){
  if(scope&&scope.expires>now()){
   if(input.kind==='index')return Promise.resolve(scope.value);
   try{const value=hit(pin(input,scope.value));if(value)return Promise.resolve(value);}catch(error){return Promise.reject(error);}
  }
  if(pending.has(input.key))return pending.get(input.key);
  if(pending.size>=4)return Promise.reject(Error('READ_QUEUE_FULL'));
  const operation=tail.catch(()=>{}).then(async()=>{
   let client;const connection=async()=>client??=await connect(env);
   try{
    if(!scope||scope.expires<=now()){
     const value=await index(await connection());if(Buffer.byteLength(JSON.stringify(value))>2*1024*1024)throw Error('READ_LIMIT');
     scope={value,expires:now()+10000};
    }
    if(input.kind==='index')return scope.value;
    const p=pin(input,scope.value),cached=hit(p);if(cached)return cached;
    const result=await history(await connection(),{selectionId:input.selectionId,coinId:input.coinId,metric:input.metric,from:p.from,to:p.to,sourceId:p.sourceId});
    if(result.sourceId!==p.sourceId||result.selectionId!==input.selectionId||result.coinId!==input.coinId||result.contract.metric!==input.metric||result.from!==p.from||result.to!==p.to)throw Error('SOURCE_PIN_MISMATCH');
    const value={schemaVersion:1,kind:'REGISTERED_SUPPLY_HISTORY',selectionId:input.selectionId,coinId:input.coinId,metric:input.metric,
      pegCurrency:result.pegCurrency,contract:result.contract,from:result.from,to:result.to,updatedAt:result.updatedAt,state:result.state,
      sourceId:result.sourceId??null,sourceHash:result.sourceHash??null,missingNetworks:result.missingNetworks??[],series:result.series};
    save(p,value);return value;
   }finally{await client?.end().catch(()=>{});}
  });
  pending.set(input.key,operation);tail=operation;
  operation.finally(()=>pending.delete(input.key)).catch(()=>{});return operation;
 }
 return url=>request(registrationRequest(url));
}
