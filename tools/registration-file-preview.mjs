import {boundedRead} from './evidence-store.mjs';
import {validateRegistrationIndex,validateRegisteredHistory} from '../web/registration-model.js';
import {registrationRequest} from './market-db/registration-preview.mjs';
// Explicit offline projection only; never a provider or DB fallback.
export function localRegistrationReader(path){return async url=>{
 const request=registrationRequest(url);
 const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedRead(path,8*1024*1024)));
 if(data?.schemaVersion!==1||data.kind!=='LOCAL_REGISTERED_SUPPLY'||!Array.isArray(data.histories)||data.histories.length>5)throw Error('INVALID_LOCAL_SUPPLY');
 validateRegistrationIndex(data.index);
 const index={schemaVersion:1,kind:'REGISTERED_SUPPLY_INDEX',selectionId:data.index.selectionId,
  networks:data.index.networks.map(n=>({id:n.id,name:n.name})),coins:data.index.coins.map(c=>({id:c.id,symbol:c.symbol,name:c.name,pegCurrency:c.pegCurrency,notes:c.notes,
   metrics:c.metrics.filter(m=>m.metric==='NETWORK_CIRCULATING').map(m=>({metric:m.metric,sourceId:m.sourceId,from:m.from,to:m.to}))}))};
 const seen=new Set(),histories=data.histories.map(h=>{
  if(h.metric!=='NETWORK_CIRCULATING'||seen.has(h.coinId))throw Error('INVALID_LOCAL_SUPPLY');seen.add(h.coinId);
  validateRegisteredHistory(h,index,{coinId:h.coinId,metric:h.metric});
  return {schemaVersion:1,kind:'REGISTERED_SUPPLY_HISTORY',selectionId:h.selectionId,coinId:h.coinId,metric:h.metric,pegCurrency:h.pegCurrency,
   contract:{metric:h.contract.metric,unit:h.contract.unit,amountKind:h.contract.amountKind,definition:h.contract.definition},from:h.from,to:h.to,updatedAt:h.updatedAt,state:h.state,sourceId:h.sourceId,sourceHash:h.sourceHash,
   missingNetworks:[...h.missingNetworks],series:h.series.map(s=>({networkId:s.networkId,points:s.points.map(p=>({day:p.day,amount:p.amount}))}))};
 });
 if(index.coins.some(c=>c.metrics.length&&!seen.has(c.id)))throw Error('INCOMPLETE_LOCAL_SUPPLY');
 if(request.kind==='index')return index;
 if(request.selectionId!==index.selectionId)throw Error('SELECTION_CHANGED');
 const detail=histories.find(h=>h.coinId===request.coinId&&h.metric===request.metric);if(!detail)throw Error('SUPPLY_UNAVAILABLE');return detail;
};}
