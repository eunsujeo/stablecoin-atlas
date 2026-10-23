import {createHash} from 'node:crypto';
import {validateRegistration} from './market-registration/metadata.mjs';
import {canonical, instant, epochMicros} from './market-db/plan.mjs';
import {parseHistorySource} from './supply-history-source.mjs';

const hash = value => createHash('sha256').update(Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
const fail = () => { throw Error('ALLIUM_PLAN_INVALID'); };
const day = value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const decimal = value => value === null || typeof value === 'string' && /^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(value);
const text = value => typeof value === 'string' && /^[A-Za-z0-9_. -]{1,128}$/.test(value);
const networks = Object.freeze({ethereum: ['EVM', '1'], polygon: ['EVM', '137'], avalanche: ['EVM', '43114'], kaia: ['EVM', '8217'], tron: ['TRON', '728126428'], solana: ['SOLANA', '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'], xrpl: ['XRPL', '0']});
const ids = ['usdc-ethereum', 'usdt-ethereum', 'rlusd-ethereum', 'usdt-tron', 'usdc-solana', 'usdt-solana', 'usdc-xrpl', 'rlusd-xrpl', 'jpyc-ethereum', 'jpyc-polygon', 'jpyc-avalanche', 'jpyc-kaia', 'jpysc-ethereum'];
const metricFields = {
  supply: ['total_supply', 'circulating_supply', 'adjusted_circulating_supply', 'total_supply_usd', 'circulating_supply_usd', 'adjusted_circulating_supply_usd'],
  volume: ['transfer_volume', 'transfer_volume_usd', 'transfer_count', 'transfer_tx_count', 'adjusted_volume_usd'],
};

export function alliumPlan(metadata, legacy, {asOfDay} = {}) {
  validateRegistration(metadata, legacy);
  if (!day(asOfDay) || asOfDay < '2000-01-08') fail();
  const from = new Date(Date.parse(asOfDay) - 7 * 86400000).toISOString().slice(0, 10);
  const deployments = [...legacy.deployments, ...metadata.newDeployments].sort((a, b) => a.id.localeCompare(b.id));
  if (deployments.length !== ids.length || !ids.every(id => deployments.some(d => d.id === id))) fail();
  const targets = deployments.map(d => {
    const n = metadata.networks.find(n => n.id === d.networkId), expected = networks[d.networkId];
    if (d.id !== d.coinId + '-' + d.networkId || !expected || n?.family !== expected[0] || n.networkIdentity !== expected[1] || n.identityBasis === 'PENDING') fail();
    return {deploymentId: d.id, coinId: d.coinId, networkId: d.networkId, networkIdentity: n.networkIdentity, family: n.family,
      identity: {...d.identity, ...(n.family === 'EVM' ? {address: d.identity.address.toLowerCase()} : {})},
      currency: metadata.coins.find(c => c.id === d.coinId).pegCurrency,
      state: 'NOT_TESTED', reason: n.family === 'XRPL' ? 'ISSUER_CURRENCY_MAPPING_UNCONFIRMED' : 'PROVIDER_MAPPING_UNCONFIRMED'};
  });
  const eligible = targets.filter(t => t.family !== 'XRPL');
  // Chain names below are survey candidates, not verified Allium coverage mappings.
  const values = eligible.map(t => `    ('${t.deploymentId}', '${t.coinId}', '${t.networkId}', '${t.identity.address}', '${t.family}')`).join(',\n');
  const cte = `WITH approved(deployment_id, coin_id, chain, address, family) AS (\n  SELECT column1, column2, column3, column4, column5 FROM VALUES\n${values}\n)`;
  const jobs = ['registry', 'supply', 'volume'].map(kind => {
    const registry = kind === 'registry', dateColumn = kind === 'supply' ? 'date' : 'activity_date';
    const table = registry ? 'stablecoins.registry.deployments' : kind === 'supply' ? 'stablecoins.core.supply_daily' : 'stablecoins.metrics.volume_daily';
    const address = registry ? 'address' : 'token_address';
    const fields = registry ? 's.product_id, s.currency, TO_VARCHAR(s.decimals) AS decimals_str, s.is_native, s.is_verified' :
      `TO_VARCHAR(s.${dateColumn}, 'YYYY-MM-DD') AS provider_day,\n       ${metricFields[kind].map(f => `TO_VARCHAR(s.${f}) AS ${f}_str`).join(',\n       ')}${kind === 'volume' ? ', s.has_adjusted_volume' : ', s.is_native'}`;
    const expectedMaxRows = eligible.length * (registry ? 1 : 7), resultLimit = expectedMaxRows + 1;
    const sql = `-- Offline survey plan; LIMIT does not cap scan cost. Do not execute automatically.\n${cte}\nSELECT a.deployment_id, a.coin_id, a.chain AS requested_chain, a.address AS requested_address,\n       s.chain AS observed_chain, s.${address} AS observed_address, ${fields}\nFROM approved a\nLEFT JOIN ${table} s ON s.chain = a.chain\n AND (CASE WHEN a.family = 'EVM' THEN LOWER(s.${address}) ELSE s.${address} END) = a.address${registry ? '' : `\n AND s.${dateColumn} >= '${from}'::DATE AND s.${dateColumn} < '${asOfDay}'::DATE`}\nORDER BY a.deployment_id${registry ? '' : ', provider_day'}\nLIMIT ${resultLimit};\n`;
    return {kind, sql, sqlHash: hash(Buffer.from(sql)), expectedMaxRows, resultLimit, state: 'NOT_TESTED'};
  });
  const body = {schemaVersion: 1, kind: 'ALLIUM_OFFLINE_SURVEY_PLAN', mapper: 'allium-survey-v1', asOfDay, window: {from, untilExclusive: asOfDay, days: 7, dateBasis: 'PROVIDER_DAY', aggregateTimezone: 'UNKNOWN'},
    registryHash: hash(legacy), metadataHash: hash(metadata), targets, jobs,
    budget: {maxQueryCreates: 3, maxRuns: 3, maxStatusReadsPerRun: 10, maxResultReads: 3, maxHttpRequests: 39, maxResponseBytes: 2097152, requestTimeoutMs: 20000, pollIntervalMs: 2000, retries: 0, pages: 1, billingLimit: null, billingStatus: 'UNCONFIRMED'},
    providerRequests: 0, databaseWrites: 0, scheduleWrites: 0, executionEnabled: false};
  return {...body, planHash: hash(body)};
}

// Projects only reviewed response evidence. SQL and account query/run identifiers never leave this function.
export function alliumSurveyResult(plan, kind, bytes, {expectedHash, now = new Date().toISOString()} = {}) {
  const {planHash, ...body} = plan;
  if (planHash !== hash(body) || plan.kind !== 'ALLIUM_OFFLINE_SURVEY_PLAN' || !Buffer.isBuffer(bytes) || bytes.length > 2097152 || !/^[a-f0-9]{64}$/.test(expectedHash) || hash(bytes) !== expectedHash) fail();
  const job = plan.jobs.find(j => j.kind === kind);
  if (!job) fail();
  parseHistorySource(bytes); // Bound nesting and validate UTF-8, then retain JSON types for amount checks.
  const p = JSON.parse(bytes.toString('utf8'));
  if (!p || p.sql !== job.sql || !Array.isArray(p.data) || String(p.meta?.row_count) !== String(p.data.length) || p.data.length > job.expectedMaxRows) fail();
  const queriedAt = instant(p.queried_at);
  if (epochMicros(queriedAt) > epochMicros(now) || queriedAt.slice(0, 10) < plan.asOfDay) fail();
  const eligible = plan.targets.filter(t => t.family !== 'XRPL'), seen = new Set(), rows = [];
  for (const r of p.data) {
    const t = eligible.find(t => t.deploymentId === r.deployment_id);
    if (!t || r.coin_id !== t.coinId || r.requested_chain !== t.networkId || r.requested_address !== t.identity.address) fail();
    const absent = r.observed_chain === null && r.observed_address === null;
    if (!absent && (r.observed_chain !== t.networkId || typeof r.observed_address !== 'string' || (t.family === 'EVM' ? r.observed_address.toLowerCase() : r.observed_address) !== t.identity.address)) fail();
    let providerDay = null, values = null;
    if (kind !== 'registry') {
      providerDay = r.provider_day;
      if (absent ? providerDay !== null : !day(providerDay) || providerDay < plan.window.from || providerDay >= plan.window.untilExclusive) fail();
      values = Object.fromEntries(metricFields[kind].map(f => [f, r[f + '_str']]));
      if (!Object.values(values).every(decimal) || absent && !Object.values(values).every(v => v === null)) fail();
      if (kind === 'volume') {
        if (absent ? r.has_adjusted_volume !== null : typeof r.has_adjusted_volume !== 'boolean') fail();
        if (r.has_adjusted_volume === false && values.adjusted_volume_usd !== null) fail();
        for (const f of ['transfer_count', 'transfer_tx_count']) if (values[f] !== null && !/^(0|[1-9]\d{0,77})$/.test(values[f])) fail();
        values.hasAdjusted = r.has_adjusted_volume;
      } else if (absent ? r.is_native !== null : typeof r.is_native !== 'boolean') fail();
    } else {
      if (absent ? [r.product_id, r.currency, r.decimals_str, r.is_native, r.is_verified].some(v => v !== null) :
        !text(r.product_id) || r.currency !== t.currency.toLowerCase() || !(r.decimals_str === null || typeof r.decimals_str === 'string' && /^(0|[1-9]\d{0,2})$/.test(r.decimals_str) && BigInt(r.decimals_str) <= 255n) || typeof r.is_native !== 'boolean' || typeof r.is_verified !== 'boolean') fail();
      values = {productId: r.product_id, currency: r.currency, decimals: r.decimals_str, isNative: r.is_native, providerVerified: r.is_verified};
    }
    const key = t.deploymentId + ':' + providerDay;
    if (seen.has(key)) fail();
    seen.add(key);
    rows.push({deploymentId: t.deploymentId, providerDay, state: absent ? 'INCONCLUSIVE' : 'OBSERVED', values,
      ...(kind === 'supply' ? {isNative: r.is_native} : {})});
  }
  // A LEFT JOIN must cover every eligible deployment; an empty/truncated response cannot attest to absence.
  for (const t of eligible) {
    const matches = rows.filter(r => r.deploymentId === t.deploymentId);
    if (!matches.length || matches.some(r => r.state === 'INCONCLUSIVE') && matches.length !== 1) fail();
  }
  return {schemaVersion: 1, kind: 'ALLIUM_SURVEY_EVIDENCE', planHash, sourceHash: expectedHash, sqlHash: job.sqlHash,
    mapper: plan.mapper, survey: kind, queriedAt, window: plan.window, precision: 'PROVIDER_DECIMAL_STRING_NOT_BASE_UNIT_VERIFIED', rows,
    deferred: plan.targets.filter(t => t.family === 'XRPL').map(t => ({deploymentId: t.deploymentId, state: 'NOT_TESTED', reason: t.reason}))};
}
