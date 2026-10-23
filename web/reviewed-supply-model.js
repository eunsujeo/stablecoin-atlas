export const reviewedWindow=Object.freeze({from:'2026-10-16',to:'2026-10-22'});
export const reviewedCoins=Object.freeze(['usdc','usdt']);
const metrics=['TOTAL_SUPPLY','CIRCULATING_SUPPLY','ADJUSTED_CIRCULATING_SUPPLY'];
const decimal=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(v);
const day=v=>typeof v==='string'&&/^2026-10-(16|17|18|19|20|21|22)$/.test(v);
// Validate and allowlist the projection. Raw provider records never belong in this DTO.
export function validateReviewedSupply(p){
 const fail=()=>{throw Error('INVALID_REVIEWED_SUPPLY');};
 if(!p||p.schemaVersion!==1||p.kind!=='DAILY_SUPPLY'||p.provider!=='ALLIUM'||p.networkId!=='ethereum'||p.networkIdentity!=='1'||p.unit!=='token'||p.dateBasis!=='PROVIDER_DAY'||p.aggregateTimezone!=='UNKNOWN'||p.precision!=='PROVIDER_DECIMAL_STRING_NOT_BASE_UNIT_VERIFIED'||p.usdAvailability!=='NOT_REQUESTED'||!Array.isArray(p.metrics)||p.metrics.join(',')!==metrics.join(',')||p.requestedRange?.coinId!==null||p.requestedRange.from!==reviewedWindow.from||p.requestedRange.to!==reviewedWindow.to||!['AVAILABLE','MISSING'].includes(p.state)||!Array.isArray(p.series)||p.series.length>2)fail();
 const seen=new Set();let count=0;
 const series=p.series.map(s=>{
  if(!reviewedCoins.includes(s.coinId)||seen.has(s.coinId)||s.networkId!=='ethereum'||s.deploymentId!==s.coinId+'-ethereum'||!Array.isArray(s.points)||!s.points.length||s.points.length>7)fail();seen.add(s.coinId);let prior='';
  const points=s.points.map(r=>{
   if(!r||!day(r.day)||r.day<=prior||![r.totalSupply,r.circulatingSupply,r.adjustedCirculatingSupply].every(decimal)||typeof r.isNative!=='boolean'||typeof r.queriedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(r.queriedAt)||!Number.isFinite(Date.parse(r.queriedAt))||new Date(r.queriedAt).toISOString().slice(0,19)!==r.queriedAt.slice(0,19)||r.queriedAt.slice(0,10)<=reviewedWindow.to||typeof r.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(r.sourceHash))fail();
   prior=r.day;count++;return {day:r.day,totalSupply:r.totalSupply,circulatingSupply:r.circulatingSupply,adjustedCirculatingSupply:r.adjustedCirculatingSupply,isNative:r.isNative,queriedAt:r.queriedAt,sourceHash:r.sourceHash};
  });
  return {coinId:s.coinId,networkId:'ethereum',deploymentId:s.deploymentId,points};
 });
 if((p.state==='AVAILABLE')!==(count>0)||count>14)fail();
 return {schemaVersion:1,kind:'DAILY_SUPPLY',provider:'ALLIUM',networkId:'ethereum',networkIdentity:'1',unit:'token',dateBasis:'PROVIDER_DAY',aggregateTimezone:'UNKNOWN',precision:'PROVIDER_DECIMAL_STRING_NOT_BASE_UNIT_VERIFIED',metrics:[...metrics],usdAvailability:'NOT_REQUESTED',requestedRange:{coinId:null,...reviewedWindow},state:p.state,series};
}
export function reviewedSupplyRows(data,coin='all'){
 if(coin!=='all'&&!reviewedCoins.includes(coin))throw Error('INVALID_COIN');
 return reviewedCoins.filter(c=>coin==='all'||c===coin).flatMap(coinId=>Array.from({length:7},(_,i)=>{
  const day=`2026-10-${16+i}`;return {coinId,day,point:data?.series.find(s=>s.coinId===coinId)?.points.find(p=>p.day===day)??null};
 }));
}
export function reviewedSupplyChoice(previous,result){
 if(result.status==='rejected')return {data:previous??null,state:previous?'LAST_GOOD':'UNAVAILABLE'};
 return {data:result.value,state:result.value===null?'DISABLED':result.value.state};
}
