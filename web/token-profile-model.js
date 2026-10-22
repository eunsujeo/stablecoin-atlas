const standards={EVM:'ERC-20',TRON:'TRC-20',SOLANA:'SPL Token',XRPL:'XRPL Issued Token'};
const hosts=new Set(['developers.circle.com','tether.to','docs.ripple.com','solana.com','developers.tron.network','eips.ethereum.org']);
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value);
const exact=(o,fields)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===fields.length&&fields.every(k=>Object.hasOwn(o,k));
export function officialProfileUrl(value){
  if(typeof value!=='string'||value.length>320)return false;
  try{const url=new URL(value);return url.protocol==='https:'&&hosts.has(url.hostname)&&!url.port&&!url.username&&!url.password&&!url.search&&!url.hash&&url.href===value;}catch{return false;}
}
export function validateTokenProfiles(profiles,registry){
  const fail=()=>{throw new Error('CATALOG_PROFILE_INVALID');};
  if(!Array.isArray(profiles)||profiles.length>256)fail();const seen=new Set();
  for(const p of profiles){
    if(!exact(p,['deploymentId','revision','standard','assetDescription','networkDescription','identity','sources','reviewedAt']))fail();
    const d=registry.deployments.find(d=>d.id===p.deploymentId),n=registry.networks.find(n=>n.id===d?.networkId);
    if(!d||!n||seen.has(p.deploymentId)||!Number.isInteger(p.revision)||p.revision<1||p.revision>2147483647||p.standard!==standards[n.family])fail();seen.add(p.deploymentId);
    if(!text(p.assetDescription,300)||!text(p.networkDescription,400))fail();
    const fields=d.identity.kind==='ISSUED'?['kind','issuer','currency']:['kind','address'];
    if(!exact(p.identity,fields)||fields.some(k=>p.identity[k]!==d.identity[k]))fail();
    if(typeof p.reviewedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(p.reviewedAt)||!Number.isFinite(Date.parse(p.reviewedAt))||new Date(p.reviewedAt).toISOString()!==p.reviewedAt)fail();
    if(!Array.isArray(p.sources)||p.sources.length<1||p.sources.length>6||new Set(p.sources.map(s=>s?.url)).size!==p.sources.length)fail();
    for(const source of p.sources)if(!exact(source,['title','url'])||!text(source.title,120)||!officialProfileUrl(source.url))fail();
  }
  if(new TextEncoder().encode(JSON.stringify(profiles)).byteLength>256*1024)fail();
  return profiles;
}
