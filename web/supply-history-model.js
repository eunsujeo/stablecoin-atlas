// Provider-wide coin/network circulating supply, never a contract totalSupply claim.
export const historyAssets=Object.freeze({usdt:{id:'1',symbol:'USDT',gecko:'tether'},usdc:{id:'2',symbol:'USDC',gecko:'usd-coin'},rlusd:{id:'250',symbol:'RLUSD',gecko:'ripple-usd'}});
export const historyChains=Object.freeze({ethereum:'Ethereum',tron:'Tron',solana:'Solana',xrpl:'XRPL'});
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const iso=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const day=x=>iso(x+'T00:00:00.000Z')&&/^\d{4}-\d\d-\d\d$/.test(x);
export function validateSupplyHistory(snapshots,registry){
 const fail=()=>{throw Error('HISTORY_INVALID');};
 if(!Array.isArray(snapshots)||snapshots.length>3)fail();const coins=new Set();let networks=0;
 for(const s of snapshots){
  if(!exact(s,['coinId','provider','metric','unit','fetchedAt','sourceHash','endpoint','from','to','networks']))fail();
  if(!Object.hasOwn(historyAssets,s.coinId)||coins.has(s.coinId)||!registry.coins.some(c=>c.id===s.coinId)||s.provider!=='DEFILLAMA'||s.metric!=='NETWORK_CIRCULATING'||s.unit!=='token'||!iso(s.fetchedAt)||!/^[a-f0-9]{64}$/.test(s.sourceHash)||s.endpoint!=='/stablecoin/'+historyAssets[s.coinId].id||!day(s.from)||!day(s.to)||s.from>s.to||Date.parse(s.to)-Date.parse(s.from)>365*86400000||s.to>s.fetchedAt.slice(0,10))fail();coins.add(s.coinId);
  if(!Array.isArray(s.networks)||!s.networks.length||s.networks.length>4)fail();const seen=new Set();
  for(const n of s.networks){
   if(!exact(n,['networkId','points'])||!Object.hasOwn(historyChains,n.networkId)||seen.has(n.networkId)||!registry.deployments.some(d=>d.coinId===s.coinId&&d.networkId===n.networkId)||!Array.isArray(n.points)||!n.points.length||n.points.length>366)fail();seen.add(n.networkId);networks++;
   let previous='';for(const p of n.points){if(!exact(p,['day','amount'])||!day(p.day)||p.day<=previous||p.day<s.from||p.day>s.to||typeof p.amount!=='string'||!/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(p.amount))fail();previous=p.day;}
  }
 }
 if(networks>8||new TextEncoder().encode(JSON.stringify(snapshots)).byteLength>512*1024)fail();return snapshots;
}
