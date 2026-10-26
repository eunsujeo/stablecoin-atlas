// Public vocabulary and validation only; no stored profiles or private inputs.
export const sourceProfileKey=p=>p.networkKey??p.chainId;
export const sourceProfileStatus=p=>p.scopeLabel??'소스 확인 완료';
export const sourceScopeSummary=profiles=>{const counts=new Map();for(const p of profiles){const label=p.scopeLabel??'기존 소스 확인';counts.set(label,(counts.get(label)??0)+1);}return [...counts].map(([label,count])=>`${label} ${count}곳`).join(' · ');};
export const sourceFeatureLabels={PRESENT:'있음',ABSENT_IN_REVIEWED_PATH:'없음',NOT_REVIEWED:'추가 검토',SOURCE_PRESENT:'소스 조건 확인',NOT_IN_REVIEWED_PATH:'없음(검토 경로)',PROTOCOL_CAPABILITY:'공통 프로토콜 기능',DOCUMENTED_ONLY:'공식 문서 기재',INPUT_REQUIRED:'추가 근거 필요',NOT_APPLICABLE:'해당 없음',STORED_SETTING:'과거 설정 관측'};
export const initialAssetProfileIds=Object.freeze(["jpyc-avalanche","jpyc-ethereum","jpyc-kaia","jpyc-polygon","jpysc-ethereum","rlusd-ethereum","rlusd-xrpl","usdc-arbitrum","usdc-arc","usdc-avalanche","usdc-base","usdc-bsc","usdc-ethereum","usdc-hyperliquid-l1","usdc-polygon","usdc-solana","usdc-stellar","usdt-aptos","usdt-arbitrum","usdt-bsc","usdt-ethereum","usdt-mantle","usdt-plasma","usdt-polygon","usdt-solana","usdt-ton"]);
const initialAssetFeatureIds={"usdc-ethereum":["approve","blocklist","burn","fee","forcedFunds","mint","pause","permit","recovery","revoke","transfer","transferFrom","upgrade","zeroReset"],"usdt-ethereum":["approve","blocklist","burn","fee","forcedFunds","mint","pause","permit","recovery","revoke","transfer","transferFrom","upgrade","zeroReset"],"rlusd-ethereum":["approve","blocklist","burn","fee","forcedFunds","mint","pause","permit","recovery","revoke","transfer","transferFrom","upgrade","zeroReset"],"jpyc-ethereum":["approve","blocklist","burn","fee","forcedFunds","mint","pause","permit","recovery","revoke","transfer","transferFrom","upgrade","zeroReset"],"jpyc-polygon":["approve","blocklist","burn","fee","forcedFunds","mint","pause","permit","recovery","revoke","transfer","transferFrom","upgrade","zeroReset"],"jpyc-avalanche":["approve","blocklist","burn","fee","forcedFunds","mint","pause","permit","recovery","revoke","transfer","transferFrom","upgrade","zeroReset"],"jpyc-kaia":["approve","blocklist","burn","fee","forcedFunds","mint","pause","permit","recovery","revoke","transfer","transferFrom","upgrade","zeroReset"],"jpysc-ethereum":["approve","blocklist","burn","fee","forcedFunds","mint","pause","permit","recovery","revoke","transfer","transferFrom","upgrade","zeroReset"],"usdc-base":["scope-0","scope-1","scope-2","scope-3","scope-4","scope-5","scope-6"],"usdc-arbitrum":["scope-0","scope-1","scope-2","scope-3","scope-4","scope-5","scope-6"],"usdc-polygon":["scope-0","scope-1","scope-2","scope-3","scope-4","scope-5","scope-6"],"usdc-bsc":["scope-0","scope-1","scope-2","scope-3"],"usdt-bsc":["scope-0","scope-1","scope-2"],"usdt-polygon":["scope-0","scope-1","scope-2","scope-3","scope-4"],"usdc-avalanche":["scope-0","scope-1"],"usdt-arbitrum":["scope-0","scope-1"],"usdt-plasma":["scope-0","scope-1"],"usdt-mantle":["scope-0","scope-1"],"usdc-solana":["scope-0","scope-1","scope-2","scope-3"],"usdt-solana":["scope-0","scope-1","scope-2","scope-3"],"usdt-ton":["scope-0","scope-1","scope-2","scope-3"],"usdt-aptos":["scope-0","scope-1","scope-2"],"usdc-stellar":["scope-0","scope-1","scope-2"],"rlusd-xrpl":["scope-0","scope-1","scope-2"],"usdc-hyperliquid-l1":["scope-0","scope-1","scope-2"],"usdc-arc":["scope-0","scope-1"]};
export const assetReviewByteLimit=262144;
const fail=()=>{throw Error('INVALID_ASSET_REVIEW');};
const keys=(o,required,optional=[])=>{if(!o||typeof o!=='object'||Array.isArray(o)||required.some(k=>!Object.hasOwn(o,k))||Object.keys(o).some(k=>![...required,...optional].includes(k)))fail();};
const text=s=>{if(typeof s!=='string'||!s.length||s.length>5000||/[\x00-\x08\x0b-\x1f]/.test(s)||/(?:https?:\/\/|postgres(?:ql)?:\/\/|\.state\/|RPC_URL|DATABASE_URL|API_KEY|PRIVATE_KEY|-----BEGIN)/i.test(s))fail();};
const list=(a,max,visit)=>{if(!Array.isArray(a)||a.length>max)fail();a.forEach(visit);};
const date=s=>{if(typeof s!=='string'||!/^\d{4}-\d\d-\d\d$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)fail();};
const id=s=>{if(typeof s!=='string'||!/^[a-z0-9][a-z0-9-]{0,95}$/.test(s))fail();};
export function validateAssetReview(p){
 keys(p,['schemaVersion','kind','id','reviewedAt','notice','profiles']);
 if(p.schemaVersion!==1||p.kind!=='REVIEWED_ASSET_PROFILES')fail();id(p.id);date(p.reviewedAt);text(p.notice);
 list(p.profiles,128,r=>{
  keys(r,['id','coinId','symbol','network','address','functions','authorities','observation','bindingDetail','limitations','references','reviewedAt','sourceReviewStatus','deploymentBinding','features'],['chainId','networkKey','identityLabel','reviewScope','scopeLabel','selectionDay','evidenceRecords']);
  for(const k of ['id','coinId','symbol','network','address','observation','bindingDetail','sourceReviewStatus','deploymentBinding'])text(r[k]);
  id(r.id);id(r.coinId);date(r.reviewedAt);if(r.reviewedAt>p.reviewedAt)fail();
  if(!['SOURCE_REVIEWED','RESEARCH_SCOPE_REVIEWED'].includes(r.sourceReviewStatus)||r.deploymentBinding!=='UNKNOWN')fail();
  if(r.chainId!==undefined&&(typeof r.chainId!=='string'||!/^[1-9][0-9]{0,30}$/.test(r.chainId)))fail();
  if(r.networkKey!==undefined)id(r.networkKey);if(!sourceProfileKey(r))fail();
  for(const k of ['identityLabel','reviewScope','scopeLabel'])if(r[k]!==undefined)text(r[k]);if(r.selectionDay!==undefined)date(r.selectionDay);
  for(const k of ['functions','authorities','limitations','references'])list(r[k],64,text);
  list(r.features,32,f=>{keys(f,['id','label','group','status','detail','evidence','profileId']);for(const v of Object.values(f))text(v);if(!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(f.id))fail();if(!Object.hasOwn(sourceFeatureLabels,f.status)||f.profileId!==r.id)fail();});
  if(!r.features.length||new Set(r.features.map(f=>f.id)).size!==r.features.length)fail();
  if(r.evidenceRecords)list(r.evidenceRecords,32,e=>{keys(e,['id','state','sha256','requestedAt']);text(e.id);text(e.state);if(!/^[a-f0-9]{64}$/.test(e.sha256)||typeof e.requestedAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(e.requestedAt)||!Number.isFinite(Date.parse(e.requestedAt)))fail();});
 });
 if(p.id==='asset-source-review-20261025-v1'&&p.profiles.some(r=>r.features.map(f=>f.id).sort().join('|')!==(initialAssetFeatureIds[r.id]??[]).join('|')))fail();
 if(p.id==='asset-source-review-20261025-v1'&&p.profiles.map(r=>r.id).sort().join('|')!==initialAssetProfileIds.join('|'))fail();
 if(!p.profiles.length||new Set(p.profiles.map(r=>r.id)).size!==p.profiles.length||new Set(p.profiles.map(r=>r.coinId+':'+sourceProfileKey(r))).size!==p.profiles.length||new TextEncoder().encode(JSON.stringify(p)).length>assetReviewByteLimit)fail();
 return p;
}
