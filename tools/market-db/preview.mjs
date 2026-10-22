import {readHistory} from './history.mjs';
import {readCatalog} from './catalog.mjs';
import { connectDatabase, transaction, runtimeRole } from './connection.mjs';
import { verifySchema, verifyRuntimeAccess } from './schema.mjs';
import { canonical, fail } from './plan.mjs';
import { boundedJson, publishedMarketStatus } from '../market-store.mjs';
import { validateMarket, validateRegistry } from '../../web/market-model.js';

const stamp = column => `to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const registryPath = new URL('../../data/asset-registry.json', import.meta.url);
const seriesLimit = 24, byteLimit = 2 * 1024 * 1024;
async function registryMatches(client, registry) {
  const coins = (await client.query('SELECT code,symbol,name FROM atlas_market.coin ORDER BY code LIMIT 257')).rows;
  const networks = (await client.query('SELECT code,family,network_identity FROM atlas_market.network ORDER BY code LIMIT 257')).rows;
  const deployments = (await client.query(`SELECT d.code,c.code AS coin,n.code AS network,d.identity_display AS identity,d.origin
    FROM atlas_market.deployment d JOIN atlas_market.coin c ON c.id=d.coin_id JOIN atlas_market.network n ON n.id=d.network_id ORDER BY d.code LIMIT 257`)).rows;
  const identifiers = (await client.query(`SELECT p.code AS provider,i.namespace,i.external_id,c.code AS coin,n.code AS network
    FROM atlas_market.provider_identifier i JOIN atlas_market.provider p ON p.id=i.provider_id JOIN atlas_market.subject s ON s.id=i.subject_id
    LEFT JOIN atlas_market.coin c ON c.id=s.coin_id LEFT JOIN atlas_market.network n ON n.id=s.network_id ORDER BY p.code,i.namespace,i.external_id LIMIT 513`)).rows;
  const sorted = rows => [...rows].sort((a,b) => canonical(a).localeCompare(canonical(b)));
  const same = (a,b) => canonical(sorted(a)) === canonical(sorted(b));
  if (!same(coins,registry.coins.map(c=>({code:c.id,symbol:c.symbol,name:c.name}))) ||
      !same(networks,registry.networks.map(n=>({code:n.id,family:n.family,network_identity:n.networkId}))) ||
      !same(deployments,registry.deployments.map(d=>({code:d.id,coin:d.coinId,network:d.networkId,identity:d.identity,origin:d.origin}))) ||
      !same(identifiers,[...registry.coins.map(c=>({provider:'ARKHAM',namespace:'pricingId',external_id:c.pricingId,coin:c.id,network:null})),
        ...registry.networks.filter(n=>n.providerKey).map(n=>({provider:'ARKHAM',namespace:'chain',external_id:n.providerKey,coin:null,network:n.id}))])) fail('DATABASE_REGISTRY_MISMATCH');
}

// All values and provenance come from one DB snapshot. Static registry supplies display names only.
export async function databaseMarket(client, registry, { now = Date.now() } = {}) {
  validateRegistry(registry);
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) fail('INVALID_TIMESTAMP');
  const to = new Date(now).toISOString(), from = new Date(now - 30 * 86400000).toISOString();
  return transaction(client, async () => {
    await runtimeRole(client); await verifySchema(client); await verifyRuntimeAccess(client);
    const access = (await client.query('SELECT access_mode FROM atlas_market.access_grant WHERE role_name=current_user')).rows[0];
    if (access?.access_mode !== 'reader') fail('DATABASE_READER_REQUIRED');
    await registryMatches(client,registry);
    const definitions = (await client.query('SELECT id FROM atlas_market.series ORDER BY id LIMIT 25')).rows;
    if (definitions.length > seriesLimit) fail('QUERY_SERIES_LIMIT');
    const ids = definitions.map(s=>s.id);
    // Keep multi-series responses practical within the independent byte limit.
    const pointsPerSeries = Math.min(200,Math.floor(2400/Math.max(ids.length,1)));
    const { rows } = await client.query(`WITH numbered AS (
      SELECT o.series_id,o.observed_at,o.request_id,
        row_number() OVER (PARTITION BY o.series_id ORDER BY o.observed_at,o.request_id) AS rn,
        count(*) OVER (PARTITION BY o.series_id) AS total
      FROM atlas_market.observation o WHERE o.series_id=ANY($1::int[]) AND o.state='OBSERVED'
        AND o.observed_at >= $2::timestamptz AND o.observed_at < $3::timestamptz
    ), sampled AS (
      SELECT series_id,observed_at,request_id FROM numbered WHERE total <= $4 OR rn=1
        OR ((rn-1)*($4-1)/greatest(total-1,1)) > ((rn-2)*($4-1)/greatest(total-1,1))
    ), chosen AS (
      SELECT * FROM sampled UNION SELECT series_id,observed_at,request_id FROM atlas_market.series_latest WHERE series_id=ANY($1::int[])
    ) SELECT c.code AS "coinId",n.code AS "networkId",d.code AS "deploymentId",m.code AS metric,m.unit,p.code AS provider,s.endpoint_path AS endpoint,
      o.amount::text AS amount,${stamp('o.observed_at')} AS "observedAt",coalesce(o.source_at_original,${stamp('o.source_at')}) AS "sourceAt",
      r.observation_clock AS "observationClock",encode(a.content_hash,'hex') AS "sourceHash",encode(l.legacy_id,'hex') AS id,
      encode(l.legacy_group_id,'hex') AS "groupId",l.original_selector AS selector,encode(r.ledger_hash,'hex') AS "ledgerHash",r.ledger_index::text AS "ledgerIndex"
      FROM chosen k JOIN atlas_market.observation o USING(series_id,observed_at,request_id)
      JOIN atlas_market.series s ON s.id=o.series_id JOIN atlas_market.subject sub ON sub.id=s.subject_id
      JOIN atlas_market.coin c ON c.id=sub.coin_id LEFT JOIN atlas_market.network n ON n.id=sub.network_id
      JOIN atlas_market.metric_definition m ON m.id=s.metric_id JOIN atlas_market.provider p ON p.id=s.provider_id
      JOIN atlas_market.collection_request r ON r.id=o.request_id AND r.observed_at=o.observed_at JOIN atlas_market.artifact a ON a.id=r.artifact_id
      LEFT JOIN atlas_market.legacy_observation l ON l.series_id=o.series_id AND l.observed_at=o.observed_at AND l.request_id=o.request_id
      LEFT JOIN atlas_market.deployment d ON d.id=coalesce(l.legacy_deployment_id,sub.deployment_id)
      ORDER BY o.series_id,o.observed_at,o.request_id LIMIT 5001`, [ids,from,to,pointsPerSeries]);
    const observations = rows.map(row => {
      if (row.metric !== 'OBLIGATIONS') { delete row.ledgerHash; delete row.ledgerIndex; }
      return row;
    });
    const counts = (await client.query(`SELECT s.id::text AS series,count(o.*)::text AS count FROM atlas_market.series s
      LEFT JOIN atlas_market.observation o ON o.series_id=s.id AND o.state='OBSERVED' AND o.observed_at >= $1::timestamptz AND o.observed_at < $2::timestamptz
      WHERE s.id=ANY($3::int[]) GROUP BY s.id ORDER BY s.id`,[from,to,ids])).rows;
    const networks = (await client.query(`SELECT n.code AS "networkId",head.active,head.tip,head."observedAt",head."sourceAt",head."sourceHash"
      FROM atlas_market.network n JOIN LATERAL (
        SELECT o.active,o.tip::text AS tip,${stamp('o.observed_at')} AS "observedAt",coalesce(o.source_at_original,${stamp('o.source_at')}) AS "sourceAt",encode(a.content_hash,'hex') AS "sourceHash"
        FROM atlas_market.network_observation o JOIN atlas_market.collection_request r ON r.id=o.request_id AND r.observed_at=o.observed_at
        JOIN atlas_market.request_definition def ON def.id=r.definition_id JOIN atlas_market.provider p ON p.id=def.provider_id JOIN atlas_market.artifact a ON a.id=r.artifact_id
        WHERE o.network_id=n.id AND o.state='OBSERVED' AND p.code='ARKHAM' ORDER BY o.observed_at DESC,o.request_id DESC LIMIT 1
      )head ON true ORDER BY n.code LIMIT 257`)).rows;
    const { rows: [health] } = await client.query(`WITH latest AS (
      SELECT DISTINCT ON (d.provider_id,d.endpoint_path,d.target_subject_id) q.id,q.observed_at,q.state
      FROM atlas_market.request_definition d JOIN atlas_market.collection_request q ON q.definition_id=d.id
      ORDER BY d.provider_id,d.endpoint_path,d.target_subject_id,q.observed_at DESC,q.id DESC
    ) SELECT (SELECT count(*)::int FROM latest WHERE state NOT IN ('SUCCESS','RECORDED')) AS failures,
      (SELECT count(*)::int FROM latest q JOIN atlas_market.observation o ON o.request_id=q.id AND o.observed_at=q.observed_at WHERE o.state='MISSING') AS missing`);
    const data = validateMarket({ schemaVersion:1,kind:'STORED_PROVIDER_OBSERVATIONS_NOT_ASSESSMENT',publishedAt:to,registry,observations,networks,omittedSupplyEntries:0,tokenProfiles:await readCatalog(client,registry),supplyHistory:await readHistory(client,registry),
      readState:{source:'POSTGRESQL',historyFrom:from,historyTo:to,pointsPerSeries,series:counts.length,historyRows:counts.reduce((n,c)=>n+BigInt(c.count),0n).toString(),
        sampled:counts.some(c=>BigInt(c.count)>BigInt(pointsPerSeries)),latestRequestFailures:health.failures,latestMissingFields:health.missing} });
    if (Buffer.byteLength(JSON.stringify(data)) > byteLimit) fail('QUERY_RESPONSE_LIMIT');
    return data;
  }, {readonly:true,repeatableRead:true});
}

// At most one connection/query in flight and one short-lived successful response.
export function databaseMarketReader({env,marketDirectory,connect=connectDatabase,read=databaseMarket,now=Date.now}={}) {
  let pending, cached, expires=0;
  return async () => {
    if (cached && now() < expires) return cached;
    if (pending) return pending;
    pending = (async () => {
      let client;
      try {
        const registry = (await boundedJson(registryPath,128*1024)).value;
        client = await connect(env);
        const data = {...await read(client,registry,{now:now()}),...await publishedMarketStatus(marketDirectory)};
        if (Buffer.byteLength(JSON.stringify(data)) > byteLimit) fail('QUERY_RESPONSE_LIMIT');
        cached=data; expires=now()+10000; return data;
      } finally { await client?.end().catch(()=>{}); }
    })();
    try { return await pending; } finally { pending=undefined; }
  };
}
