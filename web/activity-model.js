const coins=['usdt','usdc','rlusd','jpyc','jpysc'];
const decimal=s=>typeof s==='string'&&/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(s);
export function validateActivity(p){
 const fail=()=>{throw Error('INVALID_ACTIVITY');};
 if(!p||p.schemaVersion!==1||p.kind!=='DAILY_TRANSFERS'||p.provider!=='ALLIUM'||p.metric!=='TRANSFER_VOLUME'||p.networkId!=='ethereum'||p.dateBasis!=='PROVIDER_DAY'||!['AVAILABLE','MISSING'].includes(p.state)||!Array.isArray(p.series)||p.series.length>5)fail();
 const seen=new Set();for(const s of p.series){if(!coins.includes(s.coinId)||seen.has(s.coinId)||s.networkId!=='ethereum'||!Array.isArray(s.points)||!s.points.length||s.points.length>31)fail();seen.add(s.coinId);let prior='';for(const r of s.points){if(typeof r.day!=='string'||!/^\d{4}-\d\d-\d\d$/.test(r.day)||!Number.isFinite(Date.parse(r.day))||new Date(r.day).toISOString().slice(0,10)!==r.day||r.day<=prior||!decimal(r.volume)||!decimal(r.volumeUSD)||![r.transfers,r.transactions].every(v=>typeof v==='string'&&/^(0|[1-9]\d{0,77})$/.test(v))||typeof r.hasAdjusted!=='boolean'||(r.adjustedUSD!==null&&!decimal(r.adjustedUSD))||!r.hasAdjusted&&r.adjustedUSD!==null||typeof r.queriedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(r.queriedAt)||!Number.isFinite(Date.parse(r.queriedAt))||r.day>=r.queriedAt.slice(0,10)||!/^[a-f0-9]{64}$/.test(r.sourceHash))fail();prior=r.day;}}
 if((p.state==='AVAILABLE')!==(p.series.length>0))fail();return p;
}
// Provider choice is explicit and operates on a whole compatible dataset, never points.
export function providerChoice({primary,lastGood,backup,failed=false,compatible=false}={}){
 if(primary)return {data:primary,state:'PRIMARY'};
 if(lastGood)return {data:lastGood,state:failed?'LAST_GOOD':'PRIMARY'};
 if(failed&&compatible&&backup)return {data:backup,state:'BACKUP'};
 return {data:null,state:failed?'UNAVAILABLE':'MISSING'};
}
