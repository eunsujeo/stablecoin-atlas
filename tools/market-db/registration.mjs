import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {transaction,runtimeRole} from './connection.mjs';
import {verifyRuntimeAccess} from './schema.mjs';
import {registryMatches} from './preview.mjs';
import {verifyRegistration,owner,readerPrivileges,lock,requireRegistrationWriter} from './registration-access.mjs';
import {validateRegistration,measurementContracts,isoTime} from '../market-registration/metadata.mjs';
import {registrationPlan,registrationHash,verifyRegistrationPlanHash} from '../market-registration/planner.mjs';
import {registrationHistory} from '../market-registration/history.mjs';
import {registrationDecimal} from '../market-registration/decimal.mjs';
import {parseHistorySource} from '../supply-history-source.mjs';

const hex=s=>Buffer.from(s,'hex'),hash=registrationHash;
const requireValue=(ok,code='REGISTRATION_DB_CONTENT_CONFLICT')=>{if(!ok)throw Error(code);};
const isHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const day=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const metricContract=m=>Object.values(measurementContracts).find(c=>c.metric===m&&c.amountKind==='TOKEN_QUANTITY');
const stamp=c=>`to_char(${c} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const mapperVersion='registration-daily-v1';
const sourceHash=bytes=>createHash('sha256').update(bytes).digest('hex');
const valueHash=(coverage,network,p)=>hash({metadataId:coverage.metadataId,coinId:coverage.coinId,contract:coverage.contract,pegCurrency:coverage.pegCurrency,networkId:network,day:p.day,amount:p.amount});

export function registrationFilter(input){
 requireValue(input&&Object.keys(input).every(k=>['selectionId','coinId','metric','from','to','sourceId'].includes(k))&&isHash(input.selectionId)&&typeof input.coinId==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(input.coinId)&&metricContract(input.metric)&&day(input.from)&&day(input.to)&&input.to>=input.from&&(Date.parse(input.to)-Date.parse(input.from))/86400000<=365&&(input.sourceId===undefined||isHash(input.sourceId)),'REGISTRATION_DB_FILTER_INVALID');
 return input;
}

export async function selectionContext(client,id){
 const r=(await client.query(`SELECT encode(s.id,'hex') AS id,encode(s.metadata_id,'hex') AS metadata_id,encode(s.source_hash,'hex') AS source_hash,${stamp('s.fetched_at')} AS fetched,
 s.document AS plan,m.document AS metadata,m.legacy_document AS legacy,m.contracts,encode(m.legacy_hash,'hex') AS legacy_hash,m.revision
 FROM atlas_registration.selection s JOIN atlas_registration.metadata_revision m ON m.id=s.metadata_id WHERE s.id=$1`,[hex(id)])).rows[0];
 requireValue(r,'REGISTRATION_DB_SELECTION_REQUIRED');
 validateRegistration(r.metadata,r.legacy);verifyRegistrationPlanHash(r.plan);
 requireValue(hash(r.metadata)===r.metadata_id&&hash(r.legacy)===r.legacy_hash&&r.revision===r.metadata.revision&&hash(r.contracts)===hash(measurementContracts)&&r.plan.planHash===r.id&&r.plan.metadataHash===r.metadata_id&&r.plan.legacyRegistryHash===r.legacy_hash&&r.plan.catalogueSource.hash===r.source_hash&&r.plan.catalogueSource.fetchedAt===r.fetched);
 return r;
}

// Owner-only additive installation; supplied plan DTOs are never accepted as authority.
export async function installRegistration(client,metadata,legacy,bytes,{fetchedAt}={}){
 validateRegistration(metadata,legacy);requireValue(isoTime(fetchedAt),'REGISTRATION_SOURCE_INVALID');
 requireValue(Buffer.isBuffer(bytes)&&bytes.length<=16*1024*1024,'REGISTRATION_SOURCE_INVALID');
 const catalogue=parseHistorySource(bytes),rawHash=sourceHash(bytes),metadataId=hash(metadata);
 return transaction(client,async()=>{
  await lock(client);await owner(client);await verifyRegistration(client);await registryMatches(client,legacy);
  const existing=(await client.query('SELECT encode(id,\'hex\') AS id,encode(legacy_hash,\'hex\') AS legacy_hash FROM atlas_registration.metadata_revision WHERE revision=$1',[metadata.revision])).rows[0];
  if(existing)requireValue(existing.id===metadataId&&existing.legacy_hash===hash(legacy));
  else{
   const latest=(await client.query('SELECT max(revision) AS revision FROM atlas_registration.metadata_revision')).rows[0].revision;
   requireValue(latest===null||metadata.revision>latest,'REGISTRATION_DB_REVISION_INVALID');
   await client.query('INSERT INTO atlas_registration.metadata_revision VALUES($1,$2,$3,$4,$5,$6)',[hex(metadataId),metadata.revision,hex(hash(legacy)),metadata,legacy,measurementContracts]);
  }
  const prior=(await client.query(`SELECT encode(id,'hex') AS id,${stamp('fetched_at')} AS fetched FROM atlas_registration.selection WHERE metadata_id=$1 AND source_hash=$2 AND selection_day=$3::date`,[hex(metadataId),hex(rawHash),fetchedAt.slice(0,10)])).rows[0];
  const plan=registrationPlan(metadata,legacy,{catalogue,sourceHash:rawHash,fetchedAt:prior?.fetched??fetchedAt});
  if(prior)requireValue(prior.id===plan.planHash);
  else await client.query('INSERT INTO atlas_registration.selection(id,metadata_id,source_hash,fetched_at,document) VALUES($1,$2,$3,$4,$5)',[hex(plan.planHash),hex(metadataId),hex(rawHash),fetchedAt,plan]);
  await selectionContext(client,plan.planHash);
  return {state:prior?'UNCHANGED':'INSTALLED',metadataId,selectionId:plan.planHash,selectionState:plan.state,selectedPairs:plan.counts.selectedPairs,activeInDashboard:false};
 });
}

export async function importRegistrationHistory(client,{selectionId,coinId,bytes,fetchedAt}){
 requireValue(isHash(selectionId)&&typeof coinId==='string'&&Buffer.isBuffer(bytes)&&bytes.length<=32*1024*1024&&isoTime(fetchedAt),'REGISTRATION_SOURCE_INVALID');
 return transaction(client,async()=>{
  await lock(client);
  if(!(await client.query("SELECT has_schema_privilege(current_user,'atlas_registration','USAGE') AS allowed")).rows[0].allowed)await owner(client);
  const version=await verifyRegistration(client);
  const installer=(await client.query("SELECT current_user=pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='atlas_registration'")).rows[0].owner;
  if(installer||version===1)await owner(client);else {await requireRegistrationWriter(client);await requireCurrentRegistrationSelection(client,selectionId);}
  const c=await selectionContext(client,selectionId);await registryMatches(client,c.legacy);
  const coin=c.plan.coins.find(coin=>coin.coinId===coinId),networks=coin?.selection?.selected.map(n=>n.networkId);
  requireValue(networks?.length>0&&networks.length<=10&&['READY','PARTIAL'].includes(coin.selection.state),'REGISTRATION_DB_REVIEW_REQUIRED');
  // The raw detailed response, provider identity and contract are checked again here.
  const preview=registrationHistory(c.metadata,c.legacy,bytes,{coinId,fetchedAt,networks});
  let sourcesInserted=0,valuesInserted=0,coverageInserted=0;
  for(const metric of preview.metrics){
   const coverage={mapperVersion,metadataId:c.metadata_id,selectionId,coinId,pegCurrency:preview.pegCurrency,from:preview.from,to:preview.to,contract:metric.contract,state:metric.state,missingNetworks:metric.missingNetworks,
    series:metric.series.map(n=>({networkId:n.networkId,points:n.points.map(p=>({day:p.day,valueId:valueHash({metadataId:c.metadata_id,coinId,pegCurrency:preview.pegCurrency,contract:metric.contract},n.networkId,p)}))}))};
   const coverageId=hash(coverage),payload=gzipSync(Buffer.from(JSON.stringify(coverage)),{level:9});
   coverageInserted+=(await client.query('INSERT INTO atlas_registration.coverage VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[hex(coverageId),payload])).rowCount;
   const priorCoverage=(await client.query('SELECT payload FROM atlas_registration.coverage WHERE id=$1',[hex(coverageId)])).rows[0];
   requireValue(hash(decodeCoverage(priorCoverage.payload))===coverageId);
   const rows=metric.series.flatMap(n=>n.points.map(p=>({id:valueHash(coverage,n.networkId,p),network:n.networkId,day:p.day,amount:p.amount})));
   if(rows.length)valuesInserted+=(await client.query(`INSERT INTO atlas_registration.daily_value
    SELECT decode(v.id,'hex'),$2,$3,$4,v.network,v.day::date,v.amount FROM jsonb_to_recordset($1::jsonb) AS v(id text,network text,day text,amount text) ON CONFLICT(id) DO NOTHING`,[JSON.stringify(rows),hex(c.metadata_id),coinId,metric.contract.metric])).rowCount;
   await verifyValues(client,coverage);
   const prior=(await client.query(`SELECT encode(id,'hex') AS id,${stamp('fetched_at')} AS fetched FROM atlas_registration.daily_source WHERE selection_id=$1 AND coin=$2 AND metric=$3 AND source_hash=$4 AND window_to=$5::date`,[hex(selectionId),coinId,metric.contract.metric,hex(preview.sourceHash),preview.to])).rows[0];
   const body={mapperVersion,selectionId,metadataId:c.metadata_id,coinId,metric:metric.contract.metric,sourceHash:preview.sourceHash,from:preview.from,to:preview.to,fetchedAt:prior?.fetched??fetchedAt,coverageId};
   if(prior)requireValue(prior.id===hash(body));
   else sourcesInserted+=(await client.query('INSERT INTO atlas_registration.daily_source VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[hex(hash(body)),hex(selectionId),hex(c.metadata_id),coinId,metric.contract.metric,hex(preview.sourceHash),preview.from,preview.to,fetchedAt,hex(coverageId)])).rowCount;
  }
  return {state:'IMPORTED',sourcesInserted,valuesInserted,coverageInserted,providerRequests:0};
 });
}

function decodeCoverage(bytes){
 try{return JSON.parse(gunzipSync(bytes,{maxOutputLength:2*1024*1024}).toString('utf8'));}catch{throw Error('REGISTRATION_DB_CONTENT_CONFLICT');}
}
async function verifyValues(client,coverage){
 const refs=coverage.series.flatMap(n=>n.points.map(p=>({...p,networkId:n.networkId})));
 requireValue(refs.length<=3660);
 const rows=(await client.query(`SELECT encode(id,'hex') AS id,encode(metadata_id,'hex') AS metadata_id,coin,metric,network,to_char(observed_day,'YYYY-MM-DD') AS day,amount
  FROM atlas_registration.daily_value WHERE id=ANY($1::bytea[]) LIMIT 3661`,[refs.map(p=>hex(p.valueId))])).rows;
 const map=new Map(rows.map(r=>[r.id,r]));requireValue(map.size===refs.length);
 return coverage.series.map(n=>({networkId:n.networkId,points:n.points.map(p=>{
  const v=map.get(p.valueId);requireValue(v&&v.metadata_id===coverage.metadataId&&v.coin===coverage.coinId&&v.metric===coverage.contract.metric&&v.network===n.networkId&&v.day===p.day&&registrationDecimal(v.amount)===v.amount&&valueHash(coverage,n.networkId,v)===v.id);
  return {day:p.day,amount:v.amount};
 })}));
}

async function authorizeRegistrationReader(client){
  await runtimeRole(client);await verifyRuntimeAccess(client);await verifyRegistration(client);
  const role=(await client.query('SELECT current_user AS name')).rows[0].name;
  await readerPrivileges(client,role);
  requireValue((await client.query('SELECT 1 FROM atlas_registration.reader_grant WHERE role_name=current_user')).rowCount,'REGISTRATION_DB_ACCESS_DENIED');
}
export async function readRegistrationIndex(client){
 return transaction(client,async()=>{
  await authorizeRegistrationReader(client);
  const latest=(await client.query(`SELECT encode(id,'hex') AS id FROM atlas_registration.selection
   WHERE metadata_id=(SELECT id FROM atlas_registration.metadata_revision ORDER BY revision DESC LIMIT 1)
   ORDER BY fetched_at DESC,id DESC LIMIT 1`)).rows[0];
  requireValue(latest,'REGISTRATION_DB_SELECTION_REQUIRED');
  const c=await selectionContext(client,latest.id);await registryMatches(client,c.legacy);
  const sources=(await client.query(`SELECT DISTINCT ON (coin,metric) coin,metric,encode(id,'hex') AS "sourceId",to_char(window_from,'YYYY-MM-DD') AS "from",to_char(window_to,'YYYY-MM-DD') AS "to"
   FROM atlas_registration.daily_source WHERE selection_id=$1 ORDER BY coin,metric,fetched_at DESC,id DESC LIMIT 11`,[hex(latest.id)])).rows;
  requireValue(sources.length<=10,'REGISTRATION_DB_RESPONSE_LIMIT');
  return {schemaVersion:1,kind:'REGISTERED_SUPPLY_INDEX',selectionId:latest.id,
   coins:c.plan.coins.map(coin=>({id:coin.coinId,symbol:coin.symbol,name:coin.name,pegCurrency:coin.pegCurrency,notes:coin.notes,
    basicInfo:{reviewedAt:c.metadata.reviewedAt,networks:coin.selection.selected.map(n=>n.networkId),sources:c.metadata.coins.find(m=>m.id===coin.coinId).sources.map(id=>{const s=c.metadata.sources.find(s=>s.id===id);return {title:s.title,url:s.url};}),profiles:c.metadata.newDeployments.filter(d=>d.coinId===coin.coinId).map(d=>({networkId:d.networkId,standard:d.standard,identity:d.identity}))},
    metrics:sources.filter(s=>s.coin===coin.coinId).map(({metric,from,to,sourceId})=>({metric,from,to,sourceId}))})),
   networks:c.metadata.networks.map(({id,name})=>({id,name}))};
 },{repeatableRead:true});
}
export async function readRegistrationHistory(client,input){
 const filter=registrationFilter(input);
 return transaction(client,async()=>{
  await authorizeRegistrationReader(client);
  const c=await selectionContext(client,filter.selectionId);await registryMatches(client,c.legacy);
  const coin=c.plan.coins.find(coin=>coin.coinId===filter.coinId);requireValue(coin,'REGISTRATION_DB_FILTER_INVALID');
  const base={schemaVersion:1,coinId:coin.coinId,symbol:coin.symbol,pegCurrency:coin.pegCurrency,notes:coin.notes,contract:metricContract(filter.metric),selectionId:filter.selectionId,selectionState:coin.selection.state,selected:coin.selection.selected,excluded:coin.selection.excluded,from:filter.from,to:filter.to,activeInDashboard:false};
  const s=(await client.query(`SELECT encode(id,'hex') AS id,encode(metadata_id,'hex') AS metadata_id,encode(source_hash,'hex') AS source_hash,to_char(window_from,'YYYY-MM-DD') AS "from",to_char(window_to,'YYYY-MM-DD') AS "to",${stamp('fetched_at')} AS fetched,encode(coverage_id,'hex') AS coverage_id
   FROM atlas_registration.daily_source WHERE selection_id=$1 AND coin=$2 AND metric=$3 ${filter.sourceId?'AND id=$4':''} ORDER BY fetched_at DESC,id DESC LIMIT 1`,[hex(filter.selectionId),filter.coinId,filter.metric,...(filter.sourceId?[hex(filter.sourceId)]:[])])).rows[0];
  if(!s){requireValue(!filter.sourceId,'REGISTRATION_DB_SOURCE_REQUIRED');return {...base,state:'MISSING',updatedAt:null,series:[]};}
  requireValue(hash({mapperVersion,selectionId:filter.selectionId,metadataId:s.metadata_id,coinId:filter.coinId,metric:filter.metric,sourceHash:s.source_hash,from:s.from,to:s.to,fetchedAt:s.fetched,coverageId:s.coverage_id})===s.id);
  const blob=(await client.query('SELECT payload FROM atlas_registration.coverage WHERE id=$1',[hex(s.coverage_id)])).rows[0];requireValue(blob);
  const coverage=decodeCoverage(blob.payload);
  requireValue(hash(coverage)===s.coverage_id&&coverage.mapperVersion===mapperVersion&&coverage.selectionId===filter.selectionId&&coverage.metadataId===c.metadata_id&&s.metadata_id===c.metadata_id&&coverage.coinId===filter.coinId&&coverage.pegCurrency===coin.pegCurrency&&hash(coverage.contract)===hash(base.contract)&&coverage.from===s.from&&coverage.to===s.to&&Array.isArray(coverage.series)&&coverage.series.length<=10&&new Set(coverage.series.map(n=>n.networkId)).size===coverage.series.length);
  for(const n of coverage.series)requireValue(coin.selection.selected.some(s=>s.networkId===n.networkId)&&Array.isArray(n.points)&&n.points.length<=366&&new Set(n.points.map(p=>p.day)).size===n.points.length&&n.points.every(p=>day(p.day)&&p.day>=coverage.from&&p.day<=coverage.to&&isHash(p.valueId)));
  const series=(await verifyValues(client,coverage)).map(n=>({...n,points:n.points.filter(p=>p.day>=filter.from&&p.day<=filter.to)})).filter(n=>n.points.length);
  const result={...base,state:series.length?coverage.state:'MISSING',updatedAt:s.fetched,sourceId:s.id,sourceHash:s.source_hash,mapperVersion,missingNetworks:coverage.missingNetworks,series};
  requireValue(Buffer.byteLength(JSON.stringify(result))<=2*1024*1024,'REGISTRATION_DB_RESPONSE_LIMIT');return result;
 },{repeatableRead:true});
}

export async function requireCurrentRegistrationSelection(client,selectionId){
 const latest=(await client.query(`SELECT encode(id,'hex') AS id FROM atlas_registration.selection
 WHERE metadata_id=(SELECT id FROM atlas_registration.metadata_revision ORDER BY revision DESC LIMIT 1)
 ORDER BY fetched_at DESC,id DESC LIMIT 1`)).rows[0];
 requireValue(latest?.id===selectionId,'REGISTRATION_DB_SELECTION_CHANGED');
 const c=await selectionContext(client,selectionId);await registryMatches(client,c.legacy);return c;
}
