import {createHash} from 'node:crypto';
import {validateRegistration, measurementContracts, isoTime} from './metadata.mjs';
import {registrationDecimal, registrationUnits} from './decimal.mjs';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const label = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/.test(value);
const stable = value => Array.isArray(value) ? value.map(stable) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export const registrationHash = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

export function requireProviderIdentity(coin, source) {
  if (!object(source) || source.id !== coin.defillama.assetId || source.symbol !== coin.symbol || source.gecko_id !== coin.defillama.geckoId || source.pegType !== coin.defillama.pegType) throw Error('REGISTRATION_ASSET_IDENTITY_MISMATCH');
}

function selectCoin(metadata, coin, catalogue) {
  const pairs = metadata.coverage.filter(p => p.coinId === coin.id);
  const base = {contract: measurementContracts.catalogueNetwork, policyId: metadata.selectionPolicy.id, reviewedNetworks: pairs.length};
  if (coin.productVariant !== 'CURRENT') return {...base, state: 'NOT_CURRENT', selected: [], excluded: [], unreviewed: []};
  const matches = catalogue.peggedAssets.filter(a => object(a) && a.id === coin.defillama.assetId);
  if (matches.length !== 1) throw Error(matches.length ? 'REGISTRATION_ASSET_ID_AMBIGUOUS' : 'REGISTRATION_ASSET_MISSING');
  const asset = matches[0]; requireProviderIdentity(coin, asset);
  if (!Array.isArray(asset.chains) || asset.chains.length > 512 || !asset.chains.every(label) || new Set(asset.chains).size !== asset.chains.length || !object(asset.chainCirculating) || Object.keys(asset.chainCirculating).length > 512) throw Error('REGISTRATION_PROVIDER_SHAPE_INVALID');
  const selected = [], excluded = [], unreviewed = [], reviewedKeys = new Set();
  for (const pair of pairs) {
    const network = metadata.networks.find(n => n.id === pair.networkId), key = network.defillamaKey;
    reviewedKeys.add(key);
    const missing = reason => excluded.push({networkId: network.id, reason});
    if (!asset.chains.includes(key)) { missing('PROVIDER_NOT_LISTED'); continue; }
    const current = Object.hasOwn(asset.chainCirculating, key) ? asset.chainCirculating[key]?.current : null;
    if (!object(current) || !Object.hasOwn(current, coin.defillama.pegType) || current[coin.defillama.pegType] === null) { missing('VALUE_MISSING'); continue; }
    let reportedUsdValue;
    try { reportedUsdValue = registrationDecimal(current[coin.defillama.pegType]); }
    catch { missing('VALUE_INVALID'); continue; }
    selected.push({networkId: network.id, providerKey: key, relation: pair.relation, reportedUsdValue});
  }
  selected.sort((a, b) => {
    const left = registrationUnits(a.reportedUsdValue), right = registrationUnits(b.reportedUsdValue);
    return left > right ? -1 : left < right ? 1 : a.networkId < b.networkId ? -1 : a.networkId > b.networkId ? 1 : 0;
  });
  const rankedOut = selected.splice(metadata.selectionPolicy.limitPerCoin);
  excluded.push(...rankedOut.map(n => ({networkId: n.networkId, reason: 'BELOW_TOP_TEN'})));
  let outrankingUnreviewed = 0;
  for (const key of asset.chains.filter(key => !reviewedKeys.has(key))) {
    const current = Object.hasOwn(asset.chainCirculating, key) ? asset.chainCirculating[key]?.current : null;
    let reportedUsdValue = null;
    try { if (object(current) && Object.hasOwn(current, coin.defillama.pegType)) reportedUsdValue = registrationDecimal(current[coin.defillama.pegType]); } catch { /* Missing/invalid unknown values never become zero. */ }
    // An unknown candidate may change the true top ten. Report it without registering it.
    const mayOutrank = reportedUsdValue === null || selected.length < 10 || registrationUnits(reportedUsdValue) >= registrationUnits(selected.at(-1).reportedUsdValue);
    if (mayOutrank) outrankingUnreviewed++;
    unreviewed.push({providerKey: key, reportedUsdValue, reviewRequired: mayOutrank});
  }
  return {...base, state: outrankingUnreviewed ? 'REVIEW_REQUIRED' : excluded.some(n => n.reason !== 'BELOW_TOP_TEN') ? 'PARTIAL' : 'READY', selected: selected.map((n, i) => ({...n, rank: i + 1})), excluded, unreviewed};
}

export function registrationPlan(metadata, legacy, {catalogue, sourceHash, fetchedAt} = {}) {
  validateRegistration(metadata, legacy);
  if (catalogue !== undefined && (!object(catalogue) || !Array.isArray(catalogue.peggedAssets) || catalogue.peggedAssets.length > 2048 || !hash(sourceHash) || !isoTime(fetchedAt))) throw Error('REGISTRATION_SOURCE_INVALID');
  if (catalogue === undefined && (sourceHash !== undefined || fetchedAt !== undefined)) throw Error('REGISTRATION_SOURCE_INVALID');
  const coins = metadata.coins.map(coin => {
    let selection = null;
    if (catalogue !== undefined) {
      try { selection = selectCoin(metadata, coin, catalogue); }
      catch (error) {
        const allowed = new Set(['REGISTRATION_ASSET_IDENTITY_MISMATCH', 'REGISTRATION_ASSET_ID_AMBIGUOUS', 'REGISTRATION_ASSET_MISSING', 'REGISTRATION_PROVIDER_SHAPE_INVALID']);
        selection = {state: 'ERROR', errorCode: allowed.has(error.message) ? error.message : 'REGISTRATION_SOURCE_INVALID', selected: [], excluded: [], unreviewed: []};
      }
    }
    return {coinId: coin.id, symbol: coin.symbol, name: coin.name, pegCurrency: coin.pegCurrency, productVariant: coin.productVariant, notes: coin.notes,
      arkham: coin.arkham, defillama: coin.defillama, selection};
  });
  const state = catalogue === undefined ? 'METADATA_ONLY' : coins.some(c => c.selection.state === 'ERROR') ? 'SOURCE_ERRORS' : coins.some(c => ['REVIEW_REQUIRED', 'PARTIAL', 'NOT_CURRENT'].includes(c.selection.state)) ? 'REVIEW_REQUIRED' : 'READY_FOR_DB_REVIEW';
  const body = {schemaVersion: 1, kind: 'MARKET_REGISTRATION_PLAN_NOT_ACTIVE', state, metadataRevision: metadata.revision,
    metadataHash: registrationHash(metadata), legacyRegistryHash: registrationHash(legacy), reviewDocument: metadata.reviewDocument,
    catalogueSource: catalogue === undefined ? null : {hash: sourceHash, fetchedAt, sourceAsOf: null, observationClock: 'REQUEST'},
    counts: {configuredCoins: legacy.coins.length, plannedCoins: coins.length, newCoins: coins.filter(c => !legacy.coins.some(old => old.id === c.coinId)).length,
      reviewedNetworkPairs: metadata.coverage.length, newDeployments: metadata.newDeployments.length, selectedPairs: coins.reduce((n, c) => n + (c.selection?.selected.length ?? 0), 0)},
    coins, proposedDeployments: metadata.newDeployments, networkIdentityPending: metadata.networks.filter(n => n.identityBasis === 'PENDING').map(n => n.id), providerRequests: 0, databaseWrites: 0};
  return structuredClone({...body, planHash: registrationHash(body)});
}

export function verifyRegistrationPlanHash(plan) {
  if (!object(plan) || !hash(plan.planHash)) throw Error('REGISTRATION_PLAN_INVALID');
  const {planHash, ...body} = plan;
  if (planHash !== registrationHash(body)) throw Error('REGISTRATION_PLAN_INVALID');
  return plan;
}
