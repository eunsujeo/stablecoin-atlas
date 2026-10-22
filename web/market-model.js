import {validateSupplyHistory} from './supply-history-model.js';
import {validateTokenProfiles} from './token-profile-model.js';
// Provider observations remain separate from compatibility assessments and mock data.
export const METRICS = {
  CIRCULATING: { label: '코인 전체 · 공급자 유통량', unit: 'token', scope: 'COIN' },
  CHAIN_TOTAL: { label: '체인별 · 공급자 총공급량', unit: 'token', scope: 'DEPLOYMENT' },
  OBLIGATIONS: { label: 'XRPL obligations · 범위 제한', unit: 'token', scope: 'DEPLOYMENT' },
  COIN_TOTAL: { label: '코인 전체 · 공급자 총공급량', unit: 'token', scope: 'COIN' },
  REPORTED_VOLUME: { label: '공급자 거래량 · 기간/단위 미확인', unit: 'UNKNOWN', scope: 'COIN' },
  PRICE: { label: '공급자 가격', unit: 'USD', scope: 'COIN' },
};
const id = x => typeof x === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(x);
export const decimal = x => typeof x === 'string' && /^(0|[1-9]\d{0,77})(\.\d{1,36})?$/.test(x);
export function units(x) {
  if (!decimal(x)) throw new Error('INVALID_DECIMAL');
  const [a, b = ''] = x.split('.'); return BigInt(a) * 10n ** 36n + BigInt(b.padEnd(36, '0'));
}
export function exactDecimal(x) {
  if (!decimal(x)) throw new Error('INVALID_DECIMAL');
  const [a, b] = x.split('.'); return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : '');
}
export function displayAmount(x) {
  const n = units(x); if (n < 100000000n * 10n ** 36n) return exactDecimal(x);
  const hundredths = n * 100n / (100000000n * 10n ** 36n);
  return `${hundredths / 100n}.${String(hundredths % 100n).padStart(2, '0')}억`;
}
export function ratio(a, b) { const total = units(b); return total === 0n ? 0 : Number(units(a) * 10000n / total) / 100; }
const time = x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT/.test(x) && Number.isFinite(Date.parse(x));
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
function ensure(ok) { if (!ok) throw new Error('INVALID_MARKET_DATA'); }
const keys = (row, allowed) => ensure(row && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).every(k=>allowed.includes(k)));
export function validateRegistry(registry) {
  keys(registry, ['schemaVersion','coins','networks','deployments']);
  ensure(registry?.schemaVersion === 1);
  const sets = {};
  for (const group of ['coins', 'networks', 'deployments']) {
    ensure(Array.isArray(registry[group]) && registry[group].length <= 256);
    sets[group] = new Set();
    for (const row of registry[group]) { ensure(id(row.id) && !sets[group].has(row.id)); sets[group].add(row.id); }
  }
  for (const c of registry.coins) { keys(c,['id','symbol','name','pricingId']); ensure(/^[A-Z0-9]{1,16}$/.test(c.symbol) && /^[A-Za-z0-9 .-]{1,64}$/.test(c.name) && id(c.pricingId)); }
  for (const n of registry.networks) { keys(n,['id','name','family','networkId','providerKey']); ensure(/^[A-Za-z0-9 .-]{1,64}$/.test(n.name) && ['EVM','TRON','SOLANA','XRPL'].includes(n.family) && /^[A-Za-z0-9]{1,64}$/.test(n.networkId) && (n.providerKey === null || id(n.providerKey))); }
  ensure(new Set(registry.coins.map(c=>c.pricingId)).size===registry.coins.length);
  ensure(new Set(registry.networks.map(n=>n.family+':'+n.networkId)).size===registry.networks.length);
  const providerKeys=registry.networks.map(n=>n.providerKey).filter(Boolean); ensure(new Set(providerKeys).size===providerKeys.length);
  const identities = new Set(), pairs = new Set();
  for (const d of registry.deployments) {
    const n = registry.networks.find(n => n.id === d.networkId), i = d.identity;
    keys(d,['id','coinId','networkId','identity','origin','reference']); keys(i,i?.kind==='ISSUED'?['kind','issuer','currency']:['kind','address']);
    ensure(sets.coins.has(d.coinId) && n && d.origin === 'UNKNOWN' && /^[a-z0-9-]+\.json$/.test(d.reference));
    ensure(i && (n.family === 'XRPL' ? i.kind === 'ISSUED' && /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(i.issuer) && /^[A-F0-9]{40}$/.test(i.currency) : n.family === 'SOLANA' ? i.kind === 'MINT' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(i.address) : i.kind === 'CONTRACT' && (n.family === 'EVM' ? /^0x[a-fA-F0-9]{40}$/.test(i.address) : /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(i.address))));
    const identity = `${n.id}:${i.kind}:${i.kind === 'ISSUED' ? i.issuer + ':' + i.currency : n.family === 'EVM' ? i.address.toLowerCase() : i.address}`;
    const pair = `${d.coinId}:${n.id}`; ensure(!identities.has(identity) && !pairs.has(pair)); identities.add(identity); pairs.add(pair);
  }
  return registry;
}
export function validateMarket(data) {
  keys(data,['schemaVersion','kind','publishedAt','registry','observations','networks','omittedSupplyEntries','lastBuildState','collectionState','schedulerState','databaseState','readState','tokenProfiles','supplyHistory','periodicState']);
  ensure(data?.schemaVersion === 1 && data.kind === 'STORED_PROVIDER_OBSERVATIONS_NOT_ASSESSMENT' && time(data.publishedAt));
  validateRegistry(data.registry); ensure(Array.isArray(data.observations) && data.observations.length <= 5000);
  const seen = new Set();
  for (const o of data.observations) {
    keys(o,['id','coinId','networkId','deploymentId','metric','unit','amount','provider','endpoint','selector','sourceHash','groupId','observedAt','sourceAt','observationClock','ledgerHash','ledgerIndex']);
    ensure(hash(o.id) && !seen.has(o.id)); seen.add(o.id);
    const c = data.registry.coins.find(c => c.id === o.coinId), d = data.registry.deployments.find(d => d.id === o.deploymentId), metric = METRICS[o.metric];
    ensure(c && metric && o.unit === metric.unit && decimal(o.amount) && time(o.observedAt) && (o.sourceAt === null || time(o.sourceAt)) && hash(o.sourceHash) && hash(o.groupId));
    ensure(['REQUEST','REPORT_FALLBACK'].includes(o.observationClock) && ['ARKHAM','XRPL_RPC'].includes(o.provider));
    ensure(/^\/[A-Za-z0-9_/-]{1,180}$/.test(o.endpoint) && /^\$[A-Za-z0-9_.\[\]-]{1,240}$/.test(o.selector));
    ensure(metric.scope === 'COIN' ? o.deploymentId === null && o.networkId === null : d && d.coinId === c.id && d.networkId === o.networkId);
    ensure(o.metric === 'OBLIGATIONS' ? o.provider === 'XRPL_RPC' && o.networkId === 'xrpl' : o.provider === 'ARKHAM');
    if(o.metric === 'OBLIGATIONS') ensure(typeof o.ledgerHash==='string' && /^[a-fA-F0-9]{64}$/.test(o.ledgerHash) && /^\d+$/.test(o.ledgerIndex));
  }
  ensure(Array.isArray(data.networks) && data.networks.length <= 256);
  for (const n of data.networks) { keys(n,['networkId','active','tip','observedAt','sourceAt','sourceHash']); ensure(data.registry.networks.some(x=>x.id===n.networkId) && typeof n.active === 'boolean' && /^\d{1,30}$/.test(n.tip) && time(n.observedAt) && (n.sourceAt === null || time(n.sourceAt)) && hash(n.sourceHash)); }
  ensure(Number.isInteger(data.omittedSupplyEntries) && data.omittedSupplyEntries >= 0 && data.omittedSupplyEntries <= 10000);
  ensure(data.lastBuildState === undefined || ['SUCCESS','FAILED','UNKNOWN'].includes(data.lastBuildState));
  if(data.collectionState!==undefined) validateCollectionState(data.collectionState);
  if(data.schedulerState!==undefined) validateSchedulerState(data.schedulerState);
  if(data.periodicState!==undefined)validatePeriodicState(data.periodicState);
  if(data.supplyHistory!==undefined)validateSupplyHistory(data.supplyHistory,data.registry);
  if(data.tokenProfiles!==undefined)validateTokenProfiles(data.tokenProfiles,data.registry);
  if(data.databaseState!==undefined) validateDatabaseState(data.databaseState);
  if(data.readState!==undefined) {
    const r=data.readState;
    keys(r,['source','historyFrom','historyTo','pointsPerSeries','series','historyRows','sampled','latestRequestFailures','latestMissingFields']);
    ensure(r.source==='POSTGRESQL' && time(r.historyFrom) && time(r.historyTo) && Date.parse(r.historyTo)-Date.parse(r.historyFrom)===30*86400000);
    ensure(Number.isInteger(r.pointsPerSeries) && r.pointsPerSeries>=100 && r.pointsPerSeries<=200 && Number.isInteger(r.series) && r.series>=0 && r.series<=24 && typeof r.historyRows==='string' && /^\d{1,20}$/.test(r.historyRows) && typeof r.sampled==='boolean');
    for(const value of [r.latestRequestFailures,r.latestMissingFields])ensure(Number.isInteger(value)&&value>=0);
  }
  return data;
}
export function validateDatabaseState(row) {
  keys(row,['state','updatedAt','localPublished','sourceName','sourceHash','errorCode']);
  ensure(['CHECKING','COLLECTING','IMPORTING','STORED','FAILED','UNCONFIRMED'].includes(row.state) && time(row.updatedAt));
  ensure(typeof row.localPublished==='boolean' && (row.sourceName===null || /^[a-f0-9-]{36}\.json$/.test(row.sourceName)));
  ensure(row.sourceHash===null || hash(row.sourceHash));
  ensure(row.errorCode===null || typeof row.errorCode==='string' && /^[A-Z_]{1,64}$/.test(row.errorCode));
  return row;
}
export function validateSchedulerState(row) {
  keys(row,['state','updatedAt','nextAt','intervalSeconds','runs','maxRuns','requestLimit']);
  ensure(['COLLECTING','WAITING','STOPPED','FAILED','LIMIT_REACHED'].includes(row.state) && time(row.updatedAt));
  ensure(row.intervalSeconds===300 && Number.isInteger(row.maxRuns) && row.maxRuns>=1 && row.maxRuns<=288);
  ensure(Number.isInteger(row.runs) && row.runs>=0 && row.runs<=row.maxRuns && row.requestLimit===row.maxRuns*7);
  ensure(row.state==='WAITING'?time(row.nextAt):row.nextAt===null);
  return row;
}
export function validateCollectionState(row) {
  keys(row,['state','attemptedAt','requests','completedRequests','published','httpStatus','retryAfterSeconds']);
  ensure(['RUNNING','SUCCESS','FAILED'].includes(row.state)&&time(row.attemptedAt)&&Number.isInteger(row.requests)&&row.requests>=0&&row.requests<=7);
  ensure(Number.isInteger(row.completedRequests)&&row.completedRequests>=0&&row.completedRequests<=row.requests&&typeof row.published==='boolean');
  ensure(row.httpStatus===null||(Number.isInteger(row.httpStatus)&&row.httpStatus>=100&&row.httpStatus<=599));
  ensure(row.retryAfterSeconds===null||(typeof row.retryAfterSeconds==='string'&&/^\d{1,8}$/.test(row.retryAfterSeconds)));
  return row;
}
export function latest(data, {coinId, metric, deploymentId} = {}) {
  const groups = new Map();
  for (const o of data.observations) {
    if ((coinId && coinId !== o.coinId) || (metric && metric !== o.metric) || (deploymentId && deploymentId !== o.deploymentId)) continue;
    const key = [o.coinId,o.deploymentId,o.metric,o.provider,o.endpoint].join(':');
    const previous = groups.get(key);
    if (!previous || o.observedAt > previous.observedAt || (o.observedAt === previous.observedAt && o.id > previous.id)) groups.set(key, o);
  }
  return [...groups.values()];
}
export function rank(data, coinId = null) {
  // Chain comparisons must come from one provider request/snapshot for one coin.
  let rows = latest(data, { coinId, metric: coinId ? 'CHAIN_TOTAL' : 'CIRCULATING' });
  if (coinId) { const newest = [...rows].sort((a,b)=>b.observedAt.localeCompare(a.observedAt))[0]; rows = newest ? rows.filter(r=>r.groupId===newest.groupId) : []; }
  return rows.sort((a,b) => units(a.amount)>units(b.amount)?-1:units(a.amount)<units(b.amount)?1:a.coinId.localeCompare(b.coinId)||String(a.deploymentId).localeCompare(String(b.deploymentId)));
}
export function series(data, observation) {
  return data.observations.filter(o => (!data.readState || Date.parse(o.observedAt)>=Date.parse(data.readState.historyFrom)&&Date.parse(o.observedAt)<Date.parse(data.readState.historyTo)) && ['coinId','deploymentId','metric','provider','endpoint','selector'].every(k=>o[k]===observation[k])).sort((a,b)=>a.observedAt.localeCompare(b.observedAt)||a.id.localeCompare(b.id));
}

export function validatePeriodicState(row){
 keys(row,['state','updatedAt','nextAt','arkhamRunsPerDay']);ensure(['STARTING','RUNNING','WAITING','STOPPED','FAILED'].includes(row.state)&&time(row.updatedAt)&&Number.isInteger(row.arkhamRunsPerDay)&&row.arkhamRunsPerDay>=0&&row.arkhamRunsPerDay<=288);ensure(row.state==='WAITING'?time(row.nextAt):row.nextAt===null);return row;
}
