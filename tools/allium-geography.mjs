import {retiredAlliumFetch,assertAlliumFixtureTransport} from './retired-allium.mjs';
import {readdir,lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {alliumHash,alliumExecutionStorage as io,alliumBoundedRequest,withAlliumSendLock} from './allium-executor.mjs';
import {canonical} from './market-db/plan.mjs';
import {file} from './allium-offline-files.mjs';
import {parseHistorySource} from './supply-history-source.mjs';
import {dailyPlan} from './allium-daily-plan.mjs';

const fail=()=>{throw Error('ALLIUM_GEOGRAPHY_BLOCKED');};
const hash=x=>alliumHash(Buffer.from(canonical(x)));
const reference=x=>{if(typeof x!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(x))fail();return x;};
export const geographyDiscoverySQL="SELECT table_catalog, table_schema, table_name, column_name, data_type, TO_VARCHAR(ordinal_position) AS ordinal_position_str FROM allium_identity.information_schema.columns WHERE (LOWER(table_name) LIKE '%geo%' OR LOWER(table_schema) LIKE '%geo%') AND LOWER(table_schema) NOT IN ('demo', 'information_schema') ORDER BY table_schema, table_name, ordinal_position LIMIT 257";
export function geographyPlan(kind='discovery'){
 if(kind==='cex-flows'){
  const base=geographyPlan('balances'),values=base.targets.map(t=>`('${t.deploymentId}', '${t.coinId}', '${t.networkId}', '${t.identity.address}', '${t.family}')`).join(', ');
  const sql=`WITH approved(deployment_id, coin_id, chain, address, family) AS (SELECT column1, column2, column3, column4, column5 FROM VALUES ${values}) SELECT a.deployment_id, a.coin_id, a.chain AS requested_chain, g.chain AS observed_chain, g.token_address AS observed_address, TO_VARCHAR(g.date, 'YYYY-MM-DD') AS provider_day, g.from_key, g.to_key, g.from_entity, g.to_entity, g.from_category, g.to_category, g.from_grain, g.to_grain, TO_VARCHAR(g.amount) AS amount_str, TO_VARCHAR(g.usd_amount) AS usd_amount_str, TO_VARCHAR(g.transfer_count) AS transfer_count_str FROM allium_identity.aggregates.cex_attributed_flows g JOIN approved a ON g.chain = a.chain AND (CASE WHEN a.family = 'EVM' THEN LOWER(g.token_address) ELSE g.token_address END) = a.address WHERE g.date = '2026-10-22'::DATE AND ((g.from_grain = 'geo' AND g.to_category = 'cex' AND g.to_grain <> 'geo') OR (g.to_grain = 'geo' AND g.from_category = 'cex' AND g.from_grain <> 'geo')) ORDER BY a.deployment_id, g.from_key, g.to_key LIMIT 3301`;
  return {...base,kind,sql,sqlHash:alliumHash(Buffer.from(sql)),table:'allium_identity.aggregates.cex_attributed_flows'};
 }
 if(!['discovery','balances'].includes(kind))fail();
 const targets=kind==='balances'?dailyPlan({asOfDay:'2026-10-23'}).targets.filter(t=>t.family!=='XRPL'):null;
 const values=targets?.map(t=>`('${t.deploymentId}', '${t.coinId}', '${t.networkId}', '${t.identity.address}', '${t.family}')`).join(', ');
 const sql=kind==='discovery'?geographyDiscoverySQL:`WITH approved(deployment_id, coin_id, chain, address, family) AS (SELECT column1, column2, column3, column4, column5 FROM VALUES ${values}) SELECT a.deployment_id, a.coin_id, a.chain AS requested_chain, g.chain AS observed_chain, g.token_address AS observed_address, TO_VARCHAR(g.date, 'YYYY-MM-DD') AS provider_day, g.primary_country, g.primary_region, TO_VARCHAR(g.balance) AS balance_str, TO_VARCHAR(g.usd_balance) AS usd_balance_str FROM allium_identity.aggregates.geo_balances_daily g JOIN approved a ON g.chain = a.chain AND (CASE WHEN a.family = 'EVM' THEN LOWER(g.token_address) ELSE g.token_address END) = a.address WHERE g.date = '2026-10-22'::DATE ORDER BY a.deployment_id, g.primary_country, g.primary_region LIMIT 3301`;
 return {version:1,kind,sql,sqlHash:alliumHash(Buffer.from(sql)),...(targets?{day:'2026-10-22',targets,table:'allium_identity.aggregates.geo_balances_daily'}:{}),maxRows:targets?3300:256,resultLimit:targets?3301:257,maxRuns:1,maxHttpRequests:13,maxStatusReads:10,maxResponseBytes:2097152,pages:1,retries:0,leaseMs:900000,costLimit:null,costStatus:'UNCONFIRMED'};
}
// Hash only the pre-existing owned archive. No original file or consumed marker is changed.
export async function geographyLegacyManifest(root){
 const records=[];let size=0;
 async function walk(relative=''){
  for(const name of (await readdir(join(root,relative))).sort()){
   if(!relative&&['reservation-lock','geography-once'].includes(name))continue;
   const key=relative?relative+'/'+name:name,path=join(root,key),s=await lstat(path);
   if(s.isSymbolicLink()||s.uid!==process.getuid()||records.length>=1024)fail();
   if(s.isDirectory()){if(s.mode&0o077)fail();records.push([key,'directory',s.mode&0o777]);await walk(key);}
   else{await file(path,2097152);const b=await readFile(path);size+=b.length;if(size>67108864)fail();records.push([key,'file',b.length,alliumHash(b)]);}
  }
 }
 await walk();return hash(records);
}
export async function previousGeographyManifest(root,kind){
 const parent=join(root,'geography-once');let names;try{names=await readdir(parent);}catch(e){if(e.code==='ENOENT')return hash([]);throw e;}const records=[];
 for(const name of names.sort()){
  if(name===kind)continue;if(!['discovery','balances','balances-diagnosis-20261024','cex-flows'].includes(name))fail();
  const p=join(parent,name),s=await lstat(p);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==process.getuid()||s.mode&0o077)fail();
  for(const f of (await readdir(p)).sort()){const b=Buffer.from(await file(join(p,f),2097152));records.push([name,f,alliumHash(b)]);}
 }
 return hash(records);
}
export async function prepareGeography(root,{apiKey,approvalBytes,now=new Date().toISOString(),kind='discovery'}){
 const plan=geographyPlan(kind);
 if(typeof apiKey!=='string'||!apiKey||!Buffer.isBuffer(approvalBytes)||!approvalBytes.length||approvalBytes.length>65536||!Number.isFinite(Date.parse(now)))fail();
 return withAlliumSendLock(root,async()=>{
  const a={version:1,kind:'ALLIUM_GEOGRAPHY_MANUAL_ONCE',plan,planHash:hash(plan),authorizedAt:now,expiresAt:new Date(Date.parse(now)+plan.leaseMs).toISOString(),keyHash:alliumHash(Buffer.from(apiKey)),approvalHash:alliumHash(approvalBytes),legacyHash:await geographyLegacyManifest(root),previousPhaseHash:await previousGeographyManifest(root,kind),organizationIdentity:'UNKNOWN',otherPcExclusivity:'UNKNOWN',costAttribution:'UNKNOWN',globalBudgetGuaranteed:false};
  return Buffer.from(canonical(a));
 },{live:true});
}
export async function collectGeography(root,{apiKey,approvalBytes,authorizationBytes,reviewedHash,fetcher=retiredAlliumFetch,now=()=>new Date().toISOString(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 assertAlliumFixtureTransport(fetcher);
 return withAlliumSendLock(root,async()=>{
  if(!Buffer.isBuffer(authorizationBytes)||authorizationBytes.length>65536||alliumHash(authorizationBytes)!==reviewedHash)fail();
  const a=JSON.parse(authorizationBytes),plan=geographyPlan(a.plan?.kind);
  if(a.version!==1||a.kind!=='ALLIUM_GEOGRAPHY_MANUAL_ONCE'||canonical(a.plan)!==canonical(plan)||a.planHash!==hash(plan)||a.keyHash!==alliumHash(Buffer.from(apiKey??''))||!Buffer.isBuffer(approvalBytes)||a.approvalHash!==alliumHash(approvalBytes)||a.legacyHash!==await geographyLegacyManifest(root)||a.previousPhaseHash!==await previousGeographyManifest(root,plan.kind)||a.expiresAt!==new Date(Date.parse(a.authorizedAt)+plan.leaseMs).toISOString())fail();
  const validTime=()=>{const t=Date.parse(now());if(!Number.isFinite(t)||t<Date.parse(a.authorizedAt)||t>=Date.parse(a.expiresAt))fail();};validTime();
  const parent=join(root,'geography-once');await io.privateDirectory(parent);
  const archive=join(parent,plan.kind);await io.exclusiveDirectory(archive);
  await io.durableFile(join(archive,'authorization.json'),authorizationBytes);await io.durableFile(join(archive,'approval'),approvalBytes);
  // The common sender persists an intent before every HTTP request. This exclusive directory is never removed.
  const receipt={version:1,kind:'ALLIUM_GEOGRAPHY_RECEIPT',state:'RESERVED',planHash:a.planHash,authorizationHash:reviewedHash,attempts:[],failure:null};
  await io.snapshot(join(archive,'receipt.json'),receipt);
  async function call(kind,path,body){validTime();if(receipt.attempts.length>=plan.maxHttpRequests)fail();return alliumBoundedRequest(receipt,archive,kind,path,body,{fetcher,now,apiKey});}
  try{
   const q=await call('create','explorer/queries',{title:'Atlas bounded geography '+plan.kind,config:{sql:plan.sql,limit:plan.resultLimit}});
   receipt.queryId=reference(q.value.query_id??q.value.id);
   const r=await call('run',`explorer/queries/${receipt.queryId}/run-async`,{parameters:{},run_config:{limit:plan.resultLimit}});receipt.runId=reference(r.value.run_id);
   let done=false;
   for(let i=0;i<plan.maxStatusReads;i++){
    await sleep(2000);const s=await call('status',`explorer/query-runs/${receipt.runId}/status`,null),status=typeof s.value==='string'?s.value:s.value.status;
    if(status==='success'){done=true;break;}
    if(['failed','canceled','cancelled'].includes(status)){
     receipt.failure='PROVIDER_RUN_FAILED';
     if(plan.kind==='cex-flows'&&status==='failed'){
      receipt.diagnosisState='UNKNOWN';
      const detail=await call('diagnosis',`explorer/query-runs?query_id=${receipt.queryId}`,null),v=detail.value;
      if(v.query_id!==receipt.queryId||v.run_id!==receipt.runId||typeof v.query_config?.sql!=='string'||alliumHash(Buffer.from(v.query_config.sql))!==plan.sqlHash||v.status!=='failed'||typeof v.error!=='string'||!v.error.trim())fail();
      receipt.diagnosisState='OBSERVED';receipt.diagnosisAttempt=detail.attempt.index;receipt.errorHash=alliumHash(Buffer.from(v.error));
     }
     fail();
    }
    if(!['created','queued','running'].includes(status))fail();
   }
   if(!done){receipt.failure='RUN_NOT_CONFIRMED';fail();}
   const result=await call('result',`explorer/query-runs/${receipt.runId}/results`,null);
   receipt.resultAttempt=result.attempt.index;receipt.sourceHash=alliumHash(result.bytes);
   if(!Array.isArray(result.value.data)||result.value.data.length>plan.maxRows){receipt.failure='RESULT_TRUNCATED_OR_INVALID';fail();}
   if(result.value.sql!==plan.sql){receipt.failure='SQL_ECHO_REVIEW_REQUIRED';fail();}
   receipt.state='SUCCEEDED';receipt.queriedAt=result.value.queried_at;
  }catch{receipt.state='UNKNOWN';receipt.failure??='REQUEST_OR_EVIDENCE_UNCONFIRMED';}
  receipt.legacyPreserved=a.legacyHash===await geographyLegacyManifest(root)&&a.previousPhaseHash===await previousGeographyManifest(root,plan.kind);
  if(!receipt.legacyPreserved){receipt.state='UNKNOWN';receipt.failure='LEGACY_CHANGED';}
  await io.snapshot(join(archive,'receipt.json'),receipt);
  return geographyReceiptView(receipt);
 },{live:true});
}
export const geographyReceiptView=r=>({state:r.state,failure:r.failure,httpAttempts:r.attempts.length,runs:r.attempts.filter(a=>a.kind==='run').length,sourceHash:r.sourceHash??null,legacyPreserved:r.legacyPreserved??false,costStatus:'UNCONFIRMED',...(r.diagnosisState?{diagnosisState:r.diagnosisState,errorHash:r.errorHash??null}:{})});
export function projectGeographyFlows(raw,plan=geographyPlan('cex-flows')){
 if(plan.kind!=='cex-flows'||!Array.isArray(raw.data)||raw.data.length>plan.maxRows)fail();const seen=new Set();
 const text=v=>typeof v==='string'&&v.length>0&&v.length<=256&&!/[\x00-\x1f\x7f]/.test(v);
 const decimal=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(v);
 return raw.data.map(v=>{
  const t=plan.targets.find(t=>t.deploymentId===v.deployment_id),out=v.from_grain==='geo'&&v.to_grain!=='geo'&&v.to_category==='cex',incoming=v.to_grain==='geo'&&v.from_grain!=='geo'&&v.from_category==='cex';
  if(!t||v.coin_id!==t.coinId||v.requested_chain!==t.networkId||v.observed_chain!==t.networkId||typeof v.observed_address!=='string'||(t.family==='EVM'?v.observed_address.toLowerCase():v.observed_address)!==t.identity.address||v.provider_day!==plan.day||out===incoming||![v.from_key,v.to_key,v.from_category,v.to_category].every(text)||![v.from_entity,v.to_entity].every(x=>x===null||text(x))||![v.from_grain,v.to_grain].every(x=>['entity','category','geo','unattributed'].includes(x))||![v.amount_str,v.usd_amount_str].every(decimal)||!(v.transfer_count_str===null||typeof v.transfer_count_str==='string'&&/^(0|[1-9]\d{0,77})$/.test(v.transfer_count_str)))fail();
  const key=JSON.stringify([t.deploymentId,v.from_key,v.to_key]);if(seen.has(key))fail();seen.add(key);
  return {deploymentId:t.deploymentId,coinId:t.coinId,networkId:t.networkId,fromKey:v.from_key,toKey:v.to_key,fromEntity:v.from_entity,toEntity:v.to_entity,fromCategory:v.from_category,toCategory:v.to_category,fromGrain:v.from_grain,toGrain:v.to_grain,direction:out?'COUNTRY_TO_EXCHANGE':'EXCHANGE_TO_COUNTRY',country:out?v.from_entity:v.to_entity,exchange:out?v.to_entity:v.from_entity,amount:v.amount_str,usdAmount:v.usd_amount_str,transferCount:v.transfer_count_str};
 });
}
export function projectGeographyBalances(raw,plan=geographyPlan('balances')){
 if(plan.kind!=='balances'||!Array.isArray(raw.data)||raw.data.length>plan.maxRows)fail();const seen=new Set();
 const text=v=>v===null||typeof v==='string'&&v.length>0&&v.length<=96&&!/[\x00-\x1f\x7f]/.test(v);
 const decimal=v=>v===null||typeof v==='string'&&/^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(v);
 return raw.data.map(v=>{
  const t=plan.targets.find(t=>t.deploymentId===v.deployment_id);
  if(!t||v.coin_id!==t.coinId||v.requested_chain!==t.networkId||v.observed_chain!==t.networkId||typeof v.observed_address!=='string'||(t.family==='EVM'?v.observed_address.toLowerCase():v.observed_address)!==t.identity.address||v.provider_day!==plan.day||![v.primary_country,v.primary_region].every(text)||![v.balance_str,v.usd_balance_str].every(decimal))fail();
  const key=JSON.stringify([t.deploymentId,v.primary_country,v.primary_region]);if(seen.has(key))fail();seen.add(key);
  return {deploymentId:t.deploymentId,coinId:t.coinId,networkId:t.networkId,country:v.primary_country,region:v.primary_region,balance:v.balance_str,usdBalance:v.usd_balance_str};
 });
}
// Review consumes no authorization and makes no requests. It cannot resume or retransmit.
export async function reviewGeography(root,{kind='discovery',expectedSourceHash,expectedSqlHash,now=new Date().toISOString()}){
 const plan=geographyPlan(kind),archive=join(root,'geography-once',kind);
 const receiptBytes=Buffer.from(await file(join(archive,'receipt.json'),131072)),r=JSON.parse(receiptBytes);
 if(!['SUCCEEDED','UNKNOWN'].includes(r.state)||r.state==='UNKNOWN'&&r.failure!=='SQL_ECHO_REVIEW_REQUIRED'||!r.legacyPreserved||r.planHash!==hash(plan)||r.sourceHash!==expectedSourceHash||!Number.isInteger(r.resultAttempt)||r.resultAttempt!==r.attempts.length-1||r.attempts[r.resultAttempt]?.kind!=='result'||r.attempts.some(a=>a.httpStatus!==200)||r.attempts[r.resultAttempt].responseHash!==expectedSourceHash)fail();
 const bytes=Buffer.from(await file(join(archive,`response-${r.resultAttempt}.json`),2097152));
 if(alliumHash(bytes)!==expectedSourceHash)fail();parseHistorySource(bytes);const raw=JSON.parse(bytes);
 if(typeof raw.sql!=='string'||alliumHash(Buffer.from(raw.sql))!==expectedSqlHash||!Array.isArray(raw.data)||raw.data.length>plan.maxRows||String(raw.meta?.row_count)!==String(raw.data.length)||typeof raw.queried_at!=='string'||!Number.isFinite(Date.parse(raw.queried_at))||Date.parse(raw.queried_at)>Date.parse(now))fail();
 const seen=new Set();const rows=kind==='cex-flows'?projectGeographyFlows(raw,plan):kind==='balances'?projectGeographyBalances(raw,plan):raw.data.map(v=>{
  const keys=['table_catalog','table_schema','table_name','column_name','data_type','ordinal_position_str'];
  if(!keys.every(k=>typeof v[k]==='string'&&/^[A-Za-z0-9_ (),.-]{1,128}$/.test(v[k]))||v.table_catalog.toLowerCase()!=='allium_identity'||['demo','information_schema'].includes(v.table_schema.toLowerCase())||!/^\d+$/.test(v.ordinal_position_str))fail();
  const key=[v.table_schema,v.table_name,v.column_name].join('.');if(seen.has(key))fail();seen.add(key);return Object.fromEntries(keys.map(k=>[k,v[k]]));
 });
 const review={version:1,kind:kind==='cex-flows'?'ALLIUM_GEOGRAPHY_FLOW_REVIEW':kind==='balances'?'ALLIUM_GEOGRAPHY_BALANCES_REVIEW':'ALLIUM_GEOGRAPHY_SCHEMA_REVIEW',state:rows.length?'OBSERVED':'MISSING',reviewStatus:'SOURCE_REVIEWED',sourceHash:expectedSourceHash,responseSqlHash:expectedSqlHash,requestSqlHash:plan.sqlHash,receiptHash:alliumHash(receiptBytes),queriedAt:raw.queried_at,reviewedAt:now,...(kind!=='discovery'?{day:plan.day}:{}),rows};
 await io.durableFile(join(archive,'review.json'),Buffer.from(canonical(review)));return review;
}
