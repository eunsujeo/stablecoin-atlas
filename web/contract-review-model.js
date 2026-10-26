const fail=()=>{throw Error('INVALID_REVIEWED_CONTRACT_SUMMARY');};
const keys=(o,required,optional=[])=>{if(!o||typeof o!=='object'||Array.isArray(o)||required.some(k=>!Object.hasOwn(o,k))||Object.keys(o).some(k=>![...required,...optional].includes(k)))fail();};
const text=s=>{if(typeof s!=='string'||!s.length||s.length>3000||/[\x00-\x08\x0b-\x1f]/.test(s)||/(?:https?:\/\/|postgres(?:ql)?:\/\/|\.state\/|RPC_URL|DATABASE_URL|API_KEY|PRIVATE_KEY|snapshot\.private|-----BEGIN)/i.test(s))fail();};
const list=(xs,max,visit)=>{if(!Array.isArray(xs)||xs.length>max)fail();xs.forEach(visit);};
const pair=xs=>{if(!Array.isArray(xs)||xs.length!==2)fail();xs.forEach(text);};
const stamp=s=>{if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString()!==s)fail();};
const groups=['overview','behavior','risks','evidence'];
export function validateContractReport(p){
 keys(p,['id','name','network','chainId','address','status','reviewedAt','observedAt','analysisDate','purpose','source','sections'],['runtime']);
 for(const k of ['id','name','network','chainId','address','status','reviewedAt','analysisDate','purpose','source'])text(p[k]);
 if(!/^[a-z0-9-]{1,96}$/.test(p.id)||!/^[1-9][0-9]{0,30}$/.test(p.chainId)||!/^0x[0-9a-f]{40}$/.test(p.address)||p.status!=='UNKNOWN'||!/^docs\/research\/[a-z0-9-]+\.md$/.test(p.source))fail();
 for(const k of ['analysisDate','reviewedAt'])if(!/^\d{4}-\d\d-\d\d$/.test(p[k])||!Number.isFinite(Date.parse(p[k]))||new Date(p[k]).toISOString().slice(0,10)!==p[k])fail();
 stamp(p.observedAt);
 if(p.runtime){
  keys(p.runtime,['state','equality','blockNumber','blockHash','codeBytes','codeHash','endedAt','compiler','sourceAuthenticity','proxy','permissions']);
  if(p.runtime.state!=='OBSERVED'||p.runtime.equality!=='PASS'||(typeof p.runtime.blockNumber!=='string'||!(/^[1-9][0-9]*$/.test(p.runtime.blockNumber)))||!Number.isSafeInteger(p.runtime.codeBytes)||p.runtime.codeBytes<=0||p.runtime.codeBytes>1000000)fail();
  for(const k of ['blockHash','codeHash'])if(!/^0x[0-9a-f]{64}$/.test(p.runtime[k]))fail();
  stamp(p.runtime.endedAt);if(p.runtime.endedAt<p.observedAt||p.runtime.compiler!=='NOT_RUN'||p.runtime.sourceAuthenticity!=='UNKNOWN'||p.runtime.proxy!=='NOT_TESTED'||p.runtime.permissions!=='NOT_TESTED')fail();
 }
 list(p.sections,24,s=>{
  keys(s,['id','group','title','intro'],['facts','columns','rows','notes']);
  for(const k of ['id','group','title','intro'])text(s[k]);
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(s.id)||!groups.includes(s.group))fail();
  if(s.facts)list(s.facts,32,pair);
  if(Boolean(s.columns)!==Boolean(s.rows))fail();
  if(s.columns){list(s.columns,8,text);if(!s.columns.length)fail();list(s.rows,64,r=>{if(!Array.isArray(r)||r.length!==s.columns.length)fail();r.forEach(text);});}
  if(s.notes)list(s.notes,32,text);
 });
 if(!p.sections.length||new Set(p.sections.map(s=>s.id)).size!==p.sections.length||groups.some(g=>!p.sections.some(s=>s.group===g))||JSON.stringify(p).length>64000)fail();
 return p;
}
export function validateContractReviewStore(p){
 keys(p,['schemaVersion','kind','reports']);if(p.schemaVersion!==1||p.kind!=='REVIEWED_CONTRACT_SUMMARIES')fail();
 list(p.reports,32,validateContractReport);if(new Set(p.reports.map(r=>r.id)).size!==p.reports.length||new TextEncoder().encode(JSON.stringify(p)).length>131072)fail();return p;
}
