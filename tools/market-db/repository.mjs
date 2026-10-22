import {METRICS} from '../../web/market-model.js';
import {canonical,digest,importPlan,instant,sourceInstant,epochMicros,fail} from './plan.mjs';
import {archiveSources} from './files.mjs';
import {transaction,runtimeRole} from './connection.mjs';
import {verifySchema,verifyRuntimeAccess,lock} from './schema.mjs';
const hex=value=>Buffer.from(value,'hex');
const quote=name=>{if(!/^[a-z][a-z0-9_]*$/.test(name))fail('INTERNAL_IDENTIFIER');return '"'+name+'"';};
const table=name=>'atlas_market.'+quote(name);
async function record(client,name,keys,fields,{id=true,existingOnly=false}={}){
  const keyNames=Object.keys(keys),values=Object.values(keys),where=keyNames.map((k,i)=>`${quote(k)} IS NOT DISTINCT FROM $${i+1}`).join(' AND ');
  const compare=Object.entries(fields).map(([key,value])=>{values.push(value);return `${quote(key)} IS NOT DISTINCT FROM $${values.length}`;});
  const {rows}=await client.query(`SELECT ${id?'id,':''} (${compare.join(' AND ')||'true'}) AS same FROM ${table(name)} WHERE ${where} LIMIT 2`,values);
  if(rows.length){if(rows.length!==1||!rows[0].same)fail('DATABASE_CONTENT_CONFLICT');return id?rows[0].id:null;}
  if(existingOnly)fail('DATABASE_CONTENT_CONFLICT');
  const data={...keys,...fields},names=Object.keys(data);
  const result=await client.query(`INSERT INTO ${table(name)}(${names.map(quote).join(',')}) VALUES(${names.map((_,i)=>'$'+(i+1)).join(',')})${id?' RETURNING id':''}`,Object.values(data));
  return id?result.rows[0].id:null;
}
async function registryIds(client,registry){
  const ids={coins:new Map(),networks:new Map(),deployments:new Map(),subjects:new Map(),providers:new Map(),metrics:new Map()};
  for(const c of registry.coins)ids.coins.set(c.id,await record(client,'coin',{code:c.id},{symbol:c.symbol,name:c.name}));
  for(const n of registry.networks)ids.networks.set(n.id,await record(client,'network',{code:n.id},{family:n.family,network_identity:n.networkId}));
  for(const d of registry.deployments){const network=registry.networks.find(n=>n.id===d.networkId),identity=d.identity;
    const key=identity.kind==='ISSUED'?identity.issuer+':'+identity.currency:network.family==='EVM'?identity.address.toLowerCase():identity.address;
    ids.deployments.set(d.id,await record(client,'deployment',{code:d.id},{coin_id:ids.coins.get(d.coinId),network_id:ids.networks.get(d.networkId),identity_kind:identity.kind,identity_key:key,identity_display:identity,origin:d.origin}));
  }
  for(const code of ['ARKHAM','XRPL_RPC'])ids.providers.set(code,await record(client,'provider',{code},{name:code}));
  for(const [code,definition]of Object.entries(METRICS)){
    const scope=code==='CHAIN_TOTAL'?'COIN_NETWORK':definition.scope;
    ids.metrics.set(code,await record(client,'metric_definition',{code,version:1},{scope,unit:definition.unit,period_seconds:null,semantic_state:code==='REPORTED_VOLUME'?'UNCONFIRMED':'DEFINED',definition:definition.label,official_reference:null}));
  }
  for(const c of registry.coins){const sid=await subjectId(client,ids,{scope:'COIN',coinId:c.id});
    await record(client,'provider_identifier',{provider_id:ids.providers.get('ARKHAM'),namespace:'pricingId',external_id:c.pricingId},{subject_id:sid},{id:false});}
  for(const n of registry.networks)if(n.providerKey){const sid=await subjectId(client,ids,{scope:'NETWORK',networkId:n.id});
    await record(client,'provider_identifier',{provider_id:ids.providers.get('ARKHAM'),namespace:'chain',external_id:n.providerKey},{subject_id:sid},{id:false});}
  return ids;
}
async function subjectId(client,ids,subject){
  if(!subject)return null;const key=canonical({scope:subject.scope,coinId:subject.coinId??null,networkId:subject.networkId??null,deploymentId:subject.deploymentId??null});
  if(ids.subjects.has(key))return ids.subjects.get(key);
  const id=await record(client,'subject',{scope:subject.scope,coin_id:ids.coins.get(subject.coinId)??null,network_id:ids.networks.get(subject.networkId)??null,deployment_id:ids.deployments.get(subject.deploymentId)??null},{ });ids.subjects.set(key,id);return id;
}
async function seriesId(client,ids,unit,o){
  const subject=await subjectId(client,ids,o);
  return record(client,'series',{subject_id:subject,metric_id:ids.metrics.get(o.metric),provider_id:ids.providers.get(unit.provider),endpoint_path:unit.endpoint,selector_suffix:o.suffix},{scope:o.scope});
}
async function definitionId(client,ids,unit,series){
  const provider=ids.providers.get(unit.provider),target=await subjectId(client,ids,unit.target);
  const shape={mapperVersion:1,evidenceKind:unit.evidenceKind,networkEvidence:unit.networkEvidence??null,target:unit.xrplTarget??unit.target,
    fields:unit.observations.map((o,i)=>({seriesId:series[i],metric:o.metric,suffix:o.suffix})).sort((a,b)=>a.seriesId-b.seriesId),
    networks:unit.networks.map(n=>n.networkId).sort()};
  const {rows}=await client.query(`SELECT id,request_kind,request_shape FROM atlas_market.request_definition WHERE provider_id=$1 AND endpoint_path=$2 AND target_subject_id IS NOT DISTINCT FROM $3 ORDER BY version`,[provider,unit.endpoint,target]);
  const previous=rows.find(r=>canonical(r.request_shape)===canonical(shape));
  let id;if(previous){if(previous.request_kind!=='IMPORTED_EVIDENCE')fail('DATABASE_CONTENT_CONFLICT');id=previous.id;}
  else{
    const version=(await client.query('SELECT coalesce(max(version),0)+1 AS version FROM atlas_market.request_definition WHERE provider_id=$1 AND endpoint_path=$2 AND target_subject_id IS NOT DISTINCT FROM $3',[provider,unit.endpoint,target])).rows[0].version;
    id=await record(client,'request_definition',{provider_id:provider,endpoint_path:unit.endpoint,target_subject_id:target,version},{request_kind:'IMPORTED_EVIDENCE',request_shape:shape});
  }
  for(const sid of series)await record(client,'request_series',{request_definition_id:id,series_id:sid},{provider_id:provider,endpoint_path:unit.endpoint},{id:false});
  for(const n of unit.networks)await record(client,'request_network',{request_definition_id:id,network_id:ids.networks.get(n.networkId)},{},{id:false});
  return id;
}
async function artifact(client,plan,kind=plan.kind){return record(client,'artifact',{content_hash:hex(plan.hash)},{kind,byte_length:String(plan.bytes.length),storage_key:plan.hash.slice(0,2)+'/'+plan.hash+'.json'});}
async function persistUnits(client,ids,plan,run,artifactId,existingOnly=false){
  for(const [ordinal,unit]of plan.units.entries()){
    const series=[];for(const o of unit.observations)series.push(await seriesId(client,ids,unit,o));
    const definition=await definitionId(client,ids,unit,series);
    const request=await record(client,'collection_request',{run_id:run,ordinal},{definition_id:definition,state:unit.state,evidence_kind:unit.evidenceKind,source_position:unit.position,
      observed_at:unit.observedAt,observation_clock:unit.clock,artifact_id:artifactId,selector_prefix:unit.position,
      ledger_hash:unit.ledgerHash?hex(unit.ledgerHash):null,ledger_index:unit.ledgerIndex,http_status:unit.httpStatus},{existingOnly});
    for(const [i,o]of unit.observations.entries()){
      await record(client,'observation',{series_id:series[i],observed_at:unit.observedAt,request_id:request},{request_definition_id:definition,state:o.state,amount:o.amount,source_at:sourceInstant(o.sourceAt).value,source_at_original:sourceInstant(o.sourceAt).original},{id:false,existingOnly});
      if(o.legacy)await record(client,'legacy_observation',{legacy_id:hex(o.legacy.id)},{legacy_group_id:hex(o.legacy.groupId),original_selector:o.legacy.selector,legacy_deployment_id:ids.deployments.get(o.legacy.deploymentId)??null,series_id:series[i],observed_at:unit.observedAt,request_id:request},{id:false,existingOnly});
      if(!existingOnly&&o.state==='OBSERVED')await client.query(`INSERT INTO atlas_market.series_latest VALUES($1,$2,$3) ON CONFLICT(series_id) DO UPDATE SET observed_at=excluded.observed_at,request_id=excluded.request_id
        WHERE (excluded.observed_at,excluded.request_id)>(atlas_market.series_latest.observed_at,atlas_market.series_latest.request_id)`,[series[i],unit.observedAt,request]);
    }
    for(const n of unit.networks)await record(client,'network_observation',{network_id:ids.networks.get(n.networkId),observed_at:unit.observedAt,request_id:request},{request_definition_id:definition,state:'OBSERVED',active:n.active,tip:n.tip,source_at:sourceInstant(n.sourceAt).value,source_at_original:sourceInstant(n.sourceAt).original},{id:false,existingOnly});
  }
  if(existingOnly){const {rows:[counts]}=await client.query(`SELECT
    (SELECT count(*)::int FROM atlas_market.collection_request WHERE run_id=$1) AS units,
    (SELECT count(*)::int FROM atlas_market.observation o JOIN atlas_market.collection_request r ON r.id=o.request_id WHERE r.run_id=$1) AS observations,
    (SELECT count(*)::int FROM atlas_market.network_observation o JOIN atlas_market.collection_request r ON r.id=o.request_id WHERE r.run_id=$1) AS networks`,[run]);
    if(counts.units!==plan.units.length||counts.observations!==plan.observationCount||counts.networks!==plan.networkCount)fail('DATABASE_CONTENT_CONFLICT');
  }
}
async function ready(client,write=false){await runtimeRole(client);await verifySchema(client);await verifyRuntimeAccess(client,write);}
export async function importSources(client,{registry,sources,archiveDirectory}){
  if(!Array.isArray(sources)||!sources.length||sources.length>12)fail('INPUT_SOURCE_LIMIT');
  // Rebuild rather than trust a caller-supplied normalized plan.
  const plans=sources.map(p=>importPlan(registry,p.bytes,{kind:p.kind}));
  if(plans.reduce((n,p)=>n+p.observationCount+p.networkCount,0)>5000)fail('INPUT_OBSERVATION_LIMIT');
  // Validate role/schema before producing private files; no DB writes yet.
  await transaction(client,()=>ready(client,true),{readonly:true});
  await archiveSources(plans.flatMap(p=>[p,{hash:p.bindingHash,bytes:p.bindingBytes}]),archiveDirectory);
  return transaction(client,async()=>{
    await lock(client);await ready(client,true);const ids=await registryIds(client,registry);
    let imported=0,unchanged=0,observations=0,networks=0;
    for(const plan of plans){
      const artifactId=await artifact(client,plan),bindingId=await artifact(client,{hash:plan.bindingHash,bytes:plan.bindingBytes,kind:'IMPORT_BINDING'});
      const prior=(await client.query("SELECT run_id::text AS run,encode(plan_hash,'hex') AS hash,mapper_version,observation_count,network_count,unit_count,binding_artifact_id::text AS binding FROM atlas_market.import_manifest WHERE artifact_id=$1",[artifactId])).rows[0];
      if(prior){if(prior.hash!==plan.planHash||prior.mapper_version!==1||prior.observation_count!==plan.observationCount||prior.network_count!==plan.networkCount||prior.unit_count!==plan.units.length||prior.binding!==bindingId)fail('IMPORT_MAPPING_CONFLICT');
        await record(client,'collection_run',{id:prior.run},{kind:'IMPORT',state:'SUCCESS',idempotency_key:hex(digest('atlas-market-import-v1:'+plan.hash))},{existingOnly:true});
        await persistUnits(client,ids,plan,prior.run,artifactId,true);unchanged++;continue;}
      const run=(await client.query(`INSERT INTO atlas_market.collection_run(idempotency_key,kind,state,started_at) VALUES($1,'IMPORT','RUNNING',clock_timestamp()) RETURNING id`,[hex(digest('atlas-market-import-v1:'+plan.hash))])).rows[0].id;
      await persistUnits(client,ids,plan,run,artifactId);
      await client.query("UPDATE atlas_market.collection_run SET state='SUCCESS',finished_at=clock_timestamp() WHERE id=$1",[run]);
      await client.query('INSERT INTO atlas_market.import_manifest(artifact_id,run_id,binding_artifact_id,mapper_version,plan_hash,observation_count,network_count,unit_count) VALUES($1,$2,$3,1,$4,$5,$6,$7)',[artifactId,run,bindingId,hex(plan.planHash),plan.observationCount,plan.networkCount,plan.units.length]);
      imported++;observations+=plan.observationCount;networks+=plan.networkCount;
    }
    return {state:'IMPORTED',sources:imported,unchanged,observations,networks};
  });
}
const integer=(value,max)=>{if(typeof value==='number'&&Number.isInteger(value)&&value>0&&value<=max)return value;if(typeof value==='string'&&/^[1-9]\d{0,9}$/.test(value)&&BigInt(value)<=BigInt(max))return Number(value);fail('INVALID_QUERY_LIMIT');};
const key=value=>{if(typeof value!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(value))fail('INVALID_QUERY_FILTER');return value;};
const id=value=>{if(typeof value!=='string'||!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)fail('INVALID_QUERY_ID');return value;};
const stamp=column=>`to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const bounded=result=>{if(Buffer.byteLength(JSON.stringify(result))>512*1024)fail('QUERY_RESPONSE_LIMIT');return result;};
export async function listSeries(client,{coin,after='0',limit=100}={}){
  if(coin!==undefined)key(coin);if(after!=='0')id(after);limit=integer(limit,200);
  return transaction(client,async()=>{await ready(client);
    const {rows}=await client.query(`SELECT s.id::text AS id,c.code AS coin,n.code AS network,d.code AS deployment,sub.scope,m.code AS metric,m.version,m.unit,m.semantic_state,p.code AS provider,s.endpoint_path,s.selector_suffix
      FROM atlas_market.series s JOIN atlas_market.subject sub ON sub.id=s.subject_id JOIN atlas_market.metric_definition m ON m.id=s.metric_id JOIN atlas_market.provider p ON p.id=s.provider_id
      LEFT JOIN atlas_market.coin c ON c.id=sub.coin_id LEFT JOIN atlas_market.network n ON n.id=sub.network_id LEFT JOIN atlas_market.deployment d ON d.id=sub.deployment_id
      WHERE ($1::text IS NULL OR c.code=$1) AND s.id>$2::bigint ORDER BY s.id LIMIT $3`,[coin??null,after,limit+1]);
    const more=rows.length>limit;return bounded({series:rows.slice(0,limit),next:more?rows[limit-1].id:null});
  },{readonly:true});
}
export async function history(client,{series,from,to,limit=1200,cursor}={}){
  id(series);integer(series,2147483647);limit=integer(limit,1200);from=instant(from);to=instant(to);if(from>=to||epochMicros(to)-epochMicros(from)>31n*86400000000n)fail('INVALID_QUERY_RANGE');
  let afterTime=from,afterId='0';if(cursor){if(typeof cursor!=='string'||cursor.length>512)fail('INVALID_CURSOR');let c;try{c=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));}catch{fail('INVALID_CURSOR');}
    if(c.series!==series||c.from!==from||c.to!==to)fail('INVALID_CURSOR');afterTime=instant(c.at);afterId=id(c.request);if(afterTime<from||afterTime>=to)fail('INVALID_CURSOR');}
  return transaction(client,async()=>{await ready(client);
    const {rows}=await client.query(`SELECT ${stamp('o.observed_at')} AS at,o.request_id::text AS request,o.state,o.amount::text AS amount,coalesce(o.source_at_original,${stamp('o.source_at')}) AS source_at,r.observation_clock,r.evidence_kind,
      encode(a.content_hash,'hex') AS source_hash,encode(l.legacy_id,'hex') AS legacy_id,l.original_selector
      FROM atlas_market.observation o JOIN atlas_market.collection_request r ON r.id=o.request_id AND r.observed_at=o.observed_at
      JOIN atlas_market.artifact a ON a.id=r.artifact_id LEFT JOIN atlas_market.legacy_observation l ON l.series_id=o.series_id AND l.observed_at=o.observed_at AND l.request_id=o.request_id
      WHERE o.series_id=$1 AND o.observed_at >= $2::timestamptz AND o.observed_at < $3::timestamptz
        AND (o.observed_at,o.request_id)>($4::timestamptz,$5::bigint) ORDER BY o.observed_at,o.request_id LIMIT $6`,[series,from,to,afterTime,afterId,limit+1]);
    const more=rows.length>limit,points=rows.slice(0,limit),last=points.at(-1);
    return bounded({series,from,to,points,next:more?Buffer.from(JSON.stringify({series,from,to,at:last.at,request:last.request})).toString('base64url'):null});
  },{readonly:true});
}
export async function latestValues(client,{coin,after='0',limit=100}={}){
  if(coin!==undefined)key(coin);if(after!=='0')id(after);limit=integer(limit,200);
  return transaction(client,async()=>{await ready(client);
    const {rows}=await client.query(`SELECT s.id::text AS series,c.code AS coin,sub.scope,n.code AS network,d.code AS deployment,m.code AS metric,m.unit,p.code AS provider,
      o.amount::text AS amount,${stamp('o.observed_at')} AS observed_at,coalesce(o.source_at_original,${stamp('o.source_at')}) AS source_at,
      o.request_id::text AS request,r.evidence_kind,r.observation_clock,encode(a.content_hash,'hex') AS source_hash,
      health.state AS latest_request_state,health.field_state AS latest_field_state,${stamp('health.observed_at')} AS latest_request_at
      FROM atlas_market.series s JOIN atlas_market.subject sub ON sub.id=s.subject_id JOIN atlas_market.metric_definition m ON m.id=s.metric_id JOIN atlas_market.provider p ON p.id=s.provider_id
      LEFT JOIN atlas_market.coin c ON c.id=sub.coin_id LEFT JOIN atlas_market.network n ON n.id=sub.network_id LEFT JOIN atlas_market.deployment d ON d.id=sub.deployment_id
      LEFT JOIN atlas_market.series_latest head ON head.series_id=s.id LEFT JOIN atlas_market.observation o ON o.series_id=head.series_id AND o.observed_at=head.observed_at AND o.request_id=head.request_id
      LEFT JOIN atlas_market.collection_request r ON r.id=o.request_id LEFT JOIN atlas_market.artifact a ON a.id=r.artifact_id
      LEFT JOIN LATERAL(SELECT q.state,q.observed_at,field.state AS field_state FROM atlas_market.request_definition def
        JOIN atlas_market.collection_request q ON q.definition_id=def.id
        LEFT JOIN atlas_market.subject target ON target.id=def.target_subject_id
        LEFT JOIN atlas_market.observation field ON field.series_id=s.id AND field.observed_at=q.observed_at AND field.request_id=q.id
        WHERE def.provider_id=s.provider_id AND def.endpoint_path=s.endpoint_path
          AND (def.target_subject_id=sub.id OR (target.scope='COIN' AND sub.scope='COIN_NETWORK' AND target.coin_id=sub.coin_id))
        ORDER BY q.observed_at DESC,q.id DESC LIMIT 1)health ON true
      WHERE ($1::text IS NULL OR c.code=$1) AND s.id>$2::bigint ORDER BY s.id LIMIT $3`,[coin??null,after,limit+1]);
    const more=rows.length>limit;return bounded({values:rows.slice(0,limit),next:more?rows[limit-1].series:null});
  },{readonly:true});
}
const providerKey=value=>{if(typeof value!=='string'||!/^[A-Z][A-Z0-9_]{1,31}$/.test(value))fail('INVALID_QUERY_FILTER');return value;};
export async function networkHistory(client,{network,provider='ARKHAM',from,to,limit=1200,cursor}={}){
  key(network);providerKey(provider);limit=integer(limit,1200);from=instant(from);to=instant(to);
  if(from>=to||epochMicros(to)-epochMicros(from)>31n*86400000000n)fail('INVALID_QUERY_RANGE');
  let afterTime=from,afterId='0';if(cursor){if(typeof cursor!=='string'||cursor.length>512)fail('INVALID_CURSOR');let c;try{c=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));}catch{fail('INVALID_CURSOR');}
    if(c.network!==network||c.provider!==provider||c.from!==from||c.to!==to)fail('INVALID_CURSOR');afterTime=instant(c.at);afterId=id(c.request);if(afterTime<from||afterTime>=to)fail('INVALID_CURSOR');}
  return transaction(client,async()=>{await ready(client);
    const {rows}=await client.query(`SELECT ${stamp('o.observed_at')} AS at,o.request_id::text AS request,o.state,o.active,o.tip::text AS tip,
      coalesce(o.source_at_original,${stamp('o.source_at')}) AS source_at,r.observation_clock,r.evidence_kind,encode(a.content_hash,'hex') AS source_hash
      FROM atlas_market.network_observation o JOIN atlas_market.network n ON n.id=o.network_id
      JOIN atlas_market.collection_request r ON r.id=o.request_id AND r.observed_at=o.observed_at
      JOIN atlas_market.request_definition def ON def.id=r.definition_id JOIN atlas_market.provider p ON p.id=def.provider_id JOIN atlas_market.artifact a ON a.id=r.artifact_id
      WHERE n.code=$1 AND p.code=$2 AND o.observed_at >= $3::timestamptz AND o.observed_at < $4::timestamptz
        AND (o.observed_at,o.request_id)>($5::timestamptz,$6::bigint) ORDER BY o.observed_at,o.request_id LIMIT $7`,[network,provider,from,to,afterTime,afterId,limit+1]);
    const more=rows.length>limit,points=rows.slice(0,limit),last=points.at(-1);
    return bounded({network,provider,from,to,points,next:more?Buffer.from(JSON.stringify({network,provider,from,to,at:last.at,request:last.request})).toString('base64url'):null});
  },{readonly:true});
}
export async function latestNetworks(client,{provider='ARKHAM',after='0',limit=100}={}){
  providerKey(provider);if(after!=='0')id(after);limit=integer(limit,200);
  return transaction(client,async()=>{await ready(client);
    const {rows}=await client.query(`SELECT n.id::text AS id,n.code AS network,n.family,head.active,head.tip,head.observed_at,head.source_at,head.request,head.source_hash,
      health.state AS latest_request_state,${stamp('health.observed_at')} AS latest_request_at
      FROM atlas_market.network n LEFT JOIN LATERAL(
        SELECT o.active,o.tip::text AS tip,${stamp('o.observed_at')} AS observed_at,coalesce(o.source_at_original,${stamp('o.source_at')}) AS source_at,o.request_id::text AS request,encode(a.content_hash,'hex') AS source_hash
        FROM atlas_market.network_observation o JOIN atlas_market.collection_request r ON r.id=o.request_id AND r.observed_at=o.observed_at JOIN atlas_market.request_definition def ON def.id=r.definition_id
          JOIN atlas_market.provider p ON p.id=def.provider_id JOIN atlas_market.artifact a ON a.id=r.artifact_id
        WHERE o.network_id=n.id AND o.state='OBSERVED' AND p.code=$1 ORDER BY o.observed_at DESC,o.request_id DESC LIMIT 1
      )head ON true LEFT JOIN LATERAL(
        SELECT q.state,q.observed_at FROM atlas_market.request_definition def JOIN atlas_market.collection_request q ON q.definition_id=def.id JOIN atlas_market.provider p ON p.id=def.provider_id
        WHERE p.code=$1 AND def.endpoint_path='/networks/status' AND EXISTS(SELECT 1 FROM atlas_market.provider_identifier pi WHERE pi.provider_id=p.id AND pi.namespace='chain' AND pi.subject_id IN(SELECT id FROM atlas_market.subject WHERE scope='NETWORK' AND network_id=n.id))
        ORDER BY q.observed_at DESC,q.id DESC LIMIT 1
      )health ON true WHERE n.id>$2::bigint ORDER BY n.id LIMIT $3`,[provider,after,limit+1]);
    const more=rows.length>limit;return bounded({provider,networks:rows.slice(0,limit),next:more?rows[limit-1].id:null});
  },{readonly:true});
}
