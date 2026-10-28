import {registeredUsageTargets,expandedUsageTargets} from './network-usage-targets.js';
export {registeredUsageTargets,expandedUsageTargets};
export const networkUsageByteLimit=131072;
export const usageTargets=Object.freeze([
 ['usdt-ethereum','usdt','ethereum'],['usdt-tron','usdt','tron'],['usdt-solana','usdt','solana'],
 ['usdc-ethereum','usdc','ethereum'],['usdc-solana','usdc','solana'],
].map(([deploymentId,coinId,networkId])=>Object.freeze({deploymentId,coinId,networkId})));
const fail=()=>{throw Error('NETWORK_USAGE_INVALID');};
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const decimal=v=>typeof v==='string'&&/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(v);
const day=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const keys=(v,expected)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...expected].sort().join(',');
export function usageDays(untilExclusive){
 if(!day(untilExclusive))fail();return Array.from({length:7},(_,i)=>new Date(Date.parse(untilExclusive)-(7-i)*86400000).toISOString().slice(0,10));
}
export function validateNetworkUsage(p){
 const v2=p?.schemaVersion===2,targets=v2?expandedUsageTargets:usageTargets;
 if(!keys(p,['schemaVersion','kind','id','provider','planHash','receiptHash','window','dateBasis','aggregateTimezone','coverage','rows',...(v2?['sourceReceipts','availability']:[])])||![1,2].includes(p.schemaVersion)||p.kind!=='ARKHAM_NETWORK_USAGE'||p.provider!=='ARKHAM'||!hex(p.planHash)||!hex(p.receiptHash)||p.id!==(v2?'arkham-usage-v2-':'arkham-usage-')+p.receiptHash||p.dateBasis!=='PROVIDER_DAY'||p.aggregateTimezone!=='UNKNOWN'||p.coverage!=='SUBSECOND_END_BOUNDARY_UNCONFIRMED'||!keys(p.window,['from','untilExclusive']))fail();
 const days=usageDays(p.window.untilExclusive);if(p.window.from!==days[0]||!Array.isArray(p.rows)||p.rows.length!==targets.length*7)fail();
 const seen=new Set(),rows=p.rows.map(r=>{
  if(!keys(r,['deploymentId','coinId','networkId','day','providerTime','state','usd','transfers','transactions','sourceHash','queriedAt'])||!targets.some(t=>t.deploymentId===r.deploymentId&&t.coinId===r.coinId&&t.networkId===r.networkId)||!days.includes(r.day)||!['OBSERVED','MISSING'].includes(r.state)||r.transactions!==null||!hex(r.sourceHash)||typeof r.queriedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.queriedAt)||!Number.isFinite(Date.parse(r.queriedAt))||new Date(r.queriedAt).toISOString()!==r.queriedAt||r.queriedAt.slice(0,10)<p.window.untilExclusive)fail();
  if(r.state==='MISSING'?r.providerTime!==null:![r.day+'T00:00:00Z',r.day+'T00:00:00.000Z'].includes(r.providerTime))fail();
  const k=r.deploymentId+':'+r.day;if(seen.has(k))fail();seen.add(k);
  if(r.state==='MISSING'?(r.usd!==null||r.transfers!==null):(!decimal(r.usd)||typeof r.transfers!=='string'||!/^(0|[1-9]\d{0,77})$/.test(r.transfers)))fail();return {...r};
 });
 if(!rows.some(r=>r.state==='OBSERVED'))fail();
 for(const t of targets){const rs=rows.filter(r=>r.deploymentId===t.deploymentId);if(rs.length!==7||new Set(rs.map(r=>r.sourceHash)).size!==1||new Set(rs.map(r=>r.queriedAt)).size!==1)fail();}
 if(v2){
  if(!Array.isArray(p.sourceReceipts)||!p.sourceReceipts.length||p.sourceReceipts.length>2||p.sourceReceipts.some(h=>!hex(h))||new Set(p.sourceReceipts).size!==p.sourceReceipts.length||!p.sourceReceipts.includes(p.receiptHash)||!Array.isArray(p.availability)||p.availability.length!==33)fail();
  const seenAvailability=new Set();for(const a of p.availability){const t=registeredUsageTargets.find(t=>t.deploymentId===a.deploymentId);if(!keys(a,['deploymentId','coinId','networkId','state','reason'])||!t||a.coinId!==t.coinId||a.networkId!==t.networkId||seenAvailability.has(t.deploymentId)||a.reason!==t.reason)fail();seenAvailability.add(t.deploymentId);const state=t.reason?'NOT_TESTED':rows.some(r=>r.deploymentId===t.deploymentId&&r.state==='OBSERVED')?'OBSERVED':'MISSING';if(a.state!==state)fail();}
 }
 return {...p,window:{...p.window},rows};
}
// Internal display projection only; never labels Arkham observations as Allium evidence.
export function networkUsageView(p){
 p=validateNetworkUsage(p);
 return {provider:'ARKHAM',targets:p.schemaVersion===2?p.availability:usageTargets,coverage:p.coverage,window:p.window,snapshots:[{survey:'volume',sourceHash:p.receiptHash,queriedAt:p.rows.map(r=>r.queriedAt).sort().at(-1),window:{...p.window,dateBasis:p.dateBasis,aggregateTimezone:p.aggregateTimezone},rows:p.rows.map(r=>({deploymentId:r.deploymentId,providerDay:r.day,state:r.state,sourceHash:r.sourceHash,queriedAt:r.queriedAt,providerTime:r.providerTime,values:{transfer_volume:null,transfer_volume_usd:r.usd,transfer_count:r.transfers,transfer_tx_count:null}}))}]};
}
