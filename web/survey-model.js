export const surveyWindow=Object.freeze({from:'2026-10-16',untilExclusive:'2026-10-23'});
export const surveyTargets=Object.freeze([
 ['jpyc-avalanche','jpyc','avalanche','43114'],['jpyc-ethereum','jpyc','ethereum','1'],
 ['jpyc-kaia','jpyc','kaia','8217'],['jpyc-polygon','jpyc','polygon','137'],
 ['jpysc-ethereum','jpysc','ethereum','1'],['rlusd-ethereum','rlusd','ethereum','1'],
 ['usdc-ethereum','usdc','ethereum','1'],['usdc-solana','usdc','solana','5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'],
 ['usdt-ethereum','usdt','ethereum','1'],['usdt-solana','usdt','solana','5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'],['usdt-tron','usdt','tron','728126428'],
].map(([deploymentId,coinId,networkId,networkIdentity])=>Object.freeze({deploymentId,coinId,networkId,networkIdentity})));
export const surveyMetrics=Object.freeze({
 supply:['total_supply','circulating_supply','adjusted_circulating_supply','total_supply_usd','circulating_supply_usd','adjusted_circulating_supply_usd'],
 volume:['transfer_volume','transfer_volume_usd','transfer_count','transfer_tx_count','adjusted_volume_usd'],
});
const fail=()=>{throw Error('INVALID_STORED_SURVEY');};
const day=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&v>='2000-01-01'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function surveyWindowForDay(untilExclusive){
 if(!day(untilExclusive))fail();
 const from=new Date(Date.parse(untilExclusive)-7*86400000).toISOString().slice(0,10);if(!day(from))fail();return {from,untilExclusive};
}
export function validateSurveyWindow(w){
 const expected=surveyWindowForDay(w?.untilExclusive);if(w.from!==expected.from)fail();return expected;
}
export const surveyWindowDays=w=>Array.from({length:7},(_,i)=>new Date(Date.parse(validateSurveyWindow(w).from)+i*86400000).toISOString().slice(0,10));
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const decimal=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(v);
const timestamp=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,19)===v.slice(0,19);
// Rebuild an allowlisted DTO; SQL, account identifiers and arbitrary provider fields are discarded.
export function validateSurveySnapshot(p){
 const dynamic=p?.schemaVersion===2,window=dynamic?validateSurveyWindow(p.window):surveyWindow;
 if(!p||![1,2].includes(p.schemaVersion)||p.kind!=='ALLIUM_SURVEY_EVIDENCE'||p.mapper!==(dynamic?'allium-survey-window-v2':'allium-survey-v1')||!Object.hasOwn(surveyMetrics,p.survey)||!hex(p.planHash)||!hex(p.sourceHash)||!hex(p.sqlHash)||!timestamp(p.queriedAt)||p.queriedAt.slice(0,10)<window.untilExclusive||p.precision!=='PROVIDER_DECIMAL_STRING_NOT_BASE_UNIT_VERIFIED'||p.window?.from!==window.from||p.window.untilExclusive!==window.untilExclusive||p.window.days!==7||p.window.dateBasis!=='PROVIDER_DAY'||p.window.aggregateTimezone!=='UNKNOWN'||!Array.isArray(p.rows)||p.rows.length<11||p.rows.length>77)fail();
 if(p.sqlReviewStatus!==undefined&&(p.sqlReviewStatus!=='SOURCE_REVIEWED'||!hex(p.responseSqlHash)))fail();
 const seen=new Set(),rows=p.rows.map(r=>{
  if(!r||!surveyTargets.some(t=>t.deploymentId===r.deploymentId)||!['OBSERVED','INCONCLUSIVE'].includes(r.state))fail();
  const absent=r.state==='INCONCLUSIVE',key=r.deploymentId+':'+r.providerDay;
  if(seen.has(key)|| (absent?r.providerDay!==null:!day(r.providerDay)||r.providerDay<window.from||r.providerDay>=window.untilExclusive))fail();seen.add(key);
  const fields=surveyMetrics[p.survey],v=r.values;
  if(!v||Object.keys(v).sort().join(',')!==[...fields,...(p.survey==='volume'?['hasAdjusted']:[])].sort().join(',')||!fields.every(f=>decimal(v[f]))||absent&&!fields.every(f=>v[f]===null))fail();
  if(p.survey==='supply'?(absent?r.isNative!==null:typeof r.isNative!=='boolean'):(absent?v.hasAdjusted!==null:typeof v.hasAdjusted!=='boolean')||v.hasAdjusted===false&&v.adjusted_volume_usd!==null||['transfer_count','transfer_tx_count'].some(f=>v[f]!==null&&!/^(0|[1-9]\d{0,77})$/.test(v[f])))fail();
  return {deploymentId:r.deploymentId,providerDay:r.providerDay,state:r.state,values:Object.fromEntries([...fields,...(p.survey==='volume'?['hasAdjusted']:[])].map(f=>[f,v[f]])),...(p.survey==='supply'?{isNative:r.isNative}:{})};
 }).sort((a,b)=>(a.deploymentId+':'+a.providerDay).localeCompare(b.deploymentId+':'+b.providerDay));
 for(const t of surveyTargets){const rs=rows.filter(r=>r.deploymentId===t.deploymentId);if(!rs.length||rs.some(r=>r.state==='INCONCLUSIVE')&&rs.length!==1)fail();}
 if(!Array.isArray(p.deferred)||p.deferred.length!==2||!['usdc-xrpl','rlusd-xrpl'].every(id=>p.deferred.filter(d=>d.deploymentId===id&&d.state==='NOT_TESTED'&&d.reason==='ISSUER_CURRENCY_MAPPING_UNCONFIRMED').length===1))fail();
 return {schemaVersion:p.schemaVersion,kind:'ALLIUM_SURVEY_EVIDENCE',planHash:p.planHash,sourceHash:p.sourceHash,sqlHash:p.sqlHash,...(p.sqlReviewStatus?{sqlReviewStatus:p.sqlReviewStatus,responseSqlHash:p.responseSqlHash}:{}),mapper:p.mapper,survey:p.survey,queriedAt:p.queriedAt,window:{...window,days:7,dateBasis:'PROVIDER_DAY',aggregateTimezone:'UNKNOWN'},precision:p.precision,rows,deferred:p.deferred.map(d=>({deploymentId:d.deploymentId,state:d.state,reason:d.reason}))};
}
export function validateStoredSurvey(p){
 if(!p||![1,2].includes(p.schemaVersion)||p.kind!=='ALLIUM_STORED_SURVEY'||p.provider!=='ALLIUM'||!Array.isArray(p.snapshots)||p.snapshots.length>2)fail();
 const snapshots=p.snapshots.map(validateSurveySnapshot);if(new Set(snapshots.map(s=>s.survey)).size!==snapshots.length)fail();
 const window=p.schemaVersion===2?validateSurveyWindow(p.window):surveyWindow;
 if(snapshots.some(s=>s.window.from!==window.from||s.window.untilExclusive!==window.untilExclusive||p.schemaVersion===1&&s.schemaVersion!==1))fail();
 return {schemaVersion:p.schemaVersion,kind:'ALLIUM_STORED_SURVEY',provider:'ALLIUM',...(p.schemaVersion===2?{window}:{}),snapshots};
}
export function surveyRows(snapshot,{coin='all',network='all',window=snapshot?.window??surveyWindow}={}){
 if(coin!=='all'&&!surveyTargets.some(t=>t.coinId===coin)||network!=='all'&&!surveyTargets.some(t=>t.networkId===network))fail();
 const days=surveyWindowDays(window);if(snapshot&&(snapshot.window.from!==window.from||snapshot.window.untilExclusive!==window.untilExclusive))fail();
 return surveyTargets.filter(t=>(coin==='all'||t.coinId===coin)&&(network==='all'||t.networkId===network)).flatMap(t=>days.map(day=>{
  const rs=snapshot?.rows.filter(r=>r.deploymentId===t.deploymentId)??[],point=rs.find(r=>r.providerDay===day)??null;
  return {...t,day,state:point?'OBSERVED':rs.some(r=>r.state==='INCONCLUSIVE')?'INCONCLUSIVE':'MISSING',point};
 }));
}
export function storedSurveyChoice(previous,result){
 if(result.status==='rejected')return {data:previous??null,state:previous?'LAST_GOOD':'UNAVAILABLE'};
 return {data:result.value,state:result.value===null?'DISABLED':result.value.snapshots.length?'AVAILABLE':'MISSING'};
}
