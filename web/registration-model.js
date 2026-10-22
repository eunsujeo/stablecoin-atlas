const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const id=s=>typeof s==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(s);
const text=(s,max)=>typeof s==='string'&&s.length>0&&s.length<=max&&!/[\x00-\x1f\x7f]/.test(s);
const iso=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const day=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&iso(s+'T00:00:00.000Z');
const metric=s=>['NETWORK_CIRCULATING','NETWORK_MINTED'].includes(s);
const requireValue=ok=>{if(!ok)throw Error('INVALID_REGISTERED_SUPPLY');};
const bound=x=>requireValue(new TextEncoder().encode(JSON.stringify(x)).length<=2*1024*1024);
export function validateRegistrationIndex(x){
 requireValue(x?.schemaVersion===1&&x.kind==='REGISTERED_SUPPLY_INDEX'&&hash(x.selectionId)&&Array.isArray(x.coins)&&x.coins.length<=5&&Array.isArray(x.networks)&&x.networks.length<=64);
 requireValue(new Set(x.coins.map(c=>c.id)).size===x.coins.length&&new Set(x.networks.map(n=>n.id)).size===x.networks.length);
 for(const n of x.networks)requireValue(id(n.id)&&text(n.name,64));
 for(const c of x.coins){
  requireValue(['usdt','usdc','rlusd','jpyc','jpysc'].includes(c.id)&&text(c.symbol,16)&&text(c.name,64)&&['USD','JPY'].includes(c.pegCurrency)&&Array.isArray(c.notes)&&c.notes.length<=4&&c.notes.every(n=>text(n,400))&&Array.isArray(c.metrics)&&c.metrics.length<=2&&new Set(c.metrics.map(m=>m.metric)).size===c.metrics.length);
  for(const m of c.metrics)requireValue(metric(m.metric)&&hash(m.sourceId)&&day(m.from)&&day(m.to)&&m.to>=m.from&&Date.parse(m.to)-Date.parse(m.from)<=365*86400000);
 }
 bound(x);return x;
}
export function validateRegisteredHistory(x,index,{coinId,metric:expected}={}){
 const coin=index.coins.find(c=>c.id===coinId);
 requireValue(coin&&x?.schemaVersion===1&&x.kind==='REGISTERED_SUPPLY_HISTORY'&&x.selectionId===index.selectionId&&x.coinId===coinId&&x.metric===expected&&metric(expected)&&x.pegCurrency===coin.pegCurrency&&day(x.from)&&day(x.to)&&x.to>=x.from&&Date.parse(x.to)-Date.parse(x.from)<=365*86400000);
 requireValue(x.contract?.metric===expected&&x.contract.unit==='token'&&x.contract.amountKind==='TOKEN_QUANTITY'&&x.contract.definition===(expected==='NETWORK_MINTED'?'DEFILLAMA_NATIVE_ISSUANCE_OUTSTANDING_V1':'DEFILLAMA_NETWORK_CIRCULATING_V1'));
 requireValue(['AVAILABLE','PARTIAL','MISSING'].includes(x.state)&&(x.updatedAt===null||iso(x.updatedAt))&&(x.sourceId===null||hash(x.sourceId))&&(x.sourceHash===null||hash(x.sourceHash))&&Array.isArray(x.series)&&x.series.length<=10&&new Set(x.series.map(n=>n.networkId)).size===x.series.length&&Array.isArray(x.missingNetworks)&&x.missingNetworks.length<=10&&new Set(x.missingNetworks).size===x.missingNetworks.length);
 for(const n of x.series){
  requireValue(index.networks.some(r=>r.id===n.networkId)&&!x.missingNetworks.includes(n.networkId)&&Array.isArray(n.points)&&n.points.length>0&&n.points.length<=366);
  let previous='';for(const p of n.points){requireValue(day(p.day)&&p.day>previous&&p.day>=x.from&&p.day<=x.to&&typeof p.amount==='string'&&/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(p.amount));previous=p.day;}
 }
 requireValue(x.missingNetworks.every(n=>index.networks.some(r=>r.id===n)));
 requireValue(x.series.length===0?x.state==='MISSING':x.state!=='MISSING');bound(x);return x;
}
// Chart-only view: no invented deployment, executable adapter or assessment result.
export function registrationChartData(index,detail){
 return {registry:{coins:index.coins,networks:index.networks,deployments:[]},supplyHistory:detail?[{coinId:detail.coinId,metric:detail.metric,to:detail.to,networks:detail.series}]:[],registeredSupply:true,updatedAt:detail?.updatedAt};
}
