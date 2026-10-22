import {validateRegistry} from '../../web/market-model.js';

const hosts = new Set(['developers.circle.com', 'tether.to', 'docs.ripple.com', 'github.com', 'www.startale.com', 'api-docs.defillama.com']);
export const exact = (row, keys) => row && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).length === keys.length && keys.every(k => Object.hasOwn(row, k));
export const isoTime = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const id = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const requireValue = value => { if (!value) throw Error('REGISTRATION_METADATA_INVALID'); };
const unique = (rows, key, max) => {
  requireValue(Array.isArray(rows) && rows.length <= max && new Set(rows.map(key)).size === rows.length);
};
export function validateRegistration(metadata, legacy) {
  validateRegistry(legacy);
  requireValue(exact(metadata, ['schemaVersion', 'revision', 'reviewedAt', 'reviewDocument', 'sources', 'coins', 'networks', 'coverage', 'newDeployments', 'selectionPolicy']));
  requireValue(metadata.schemaVersion === 2 && Number.isSafeInteger(metadata.revision) && metadata.revision >= 1 && isoTime(metadata.reviewedAt));
  requireValue(typeof metadata.reviewDocument === 'string' && /^docs\/research\/[a-z0-9-]+\.md$/.test(metadata.reviewDocument));
  unique(metadata.sources, s => s?.id, 32); unique(metadata.coins, c => c?.id, 5); unique(metadata.networks, n => n?.id, 64);
  unique(metadata.coverage, c => c?.coinId + ':' + c?.networkId, 256); unique(metadata.newDeployments, d => d?.id, 64);
  requireValue(metadata.coins.length > 0 && metadata.sources.length > 0);
  for (const source of metadata.sources) {
    requireValue(exact(source, ['id', 'title', 'url', 'kind']) && id(source.id) && text(source.title, 160) && ['ISSUER', 'PROVIDER'].includes(source.kind));
    let url; try { url = new URL(source.url); } catch { requireValue(false); }
    requireValue(text(source.url, 512) && url.protocol === 'https:' && hosts.has(url.hostname) && !url.username && !url.password && !url.port && !url.search && !url.hash && url.href === source.url);
  }
  const references = refs => {
    requireValue(Array.isArray(refs) && refs.length > 0 && refs.length <= 6 && new Set(refs).size === refs.length && refs.every(r => metadata.sources.some(s => s.id === r)));
  };
  for (const coin of metadata.coins) {
    requireValue(exact(coin, ['id', 'symbol', 'name', 'pegCurrency', 'productVariant', 'sources', 'notes', 'defillama', 'arkham']));
    requireValue(id(coin.id) && /^[A-Z0-9]{1,16}$/.test(coin.symbol) && text(coin.name, 64) && ['USD', 'JPY'].includes(coin.pegCurrency) && ['CURRENT', 'PREPAID'].includes(coin.productVariant));
    requireValue(Array.isArray(coin.notes) && coin.notes.length <= 4 && coin.notes.every(n => text(n, 400))); references(coin.sources);
    const provider = coin.defillama;
    requireValue(exact(provider, ['assetId', 'geckoId', 'pegType', 'primaryAddress']) && /^\d{1,8}$/.test(provider.assetId) && id(provider.geckoId) && provider.pegType === 'pegged' + coin.pegCurrency);
    requireValue(provider.primaryAddress === null || /^0x[0-9a-fA-F]{40}$/.test(provider.primaryAddress));
    const arkham = coin.arkham;
    requireValue(exact(arkham, ['state', 'pricingId']) && ['CONFIGURED', 'UNVERIFIED'].includes(arkham.state));
    requireValue(arkham.state === 'UNVERIFIED' ? arkham.pricingId === null : id(arkham.pricingId));
  }
  requireValue(new Set(metadata.coins.map(c => c.defillama.assetId)).size === metadata.coins.length && new Set(metadata.coins.map(c => c.defillama.geckoId)).size === metadata.coins.length);
  for (const network of metadata.networks) {
    requireValue(exact(network, ['id', 'name', 'family', 'networkIdentity', 'identityBasis', 'defillamaKey', 'arkhamKey', 'sources']));
    requireValue(id(network.id) && text(network.name, 64) && text(network.defillamaKey, 64) && (network.arkhamKey === null || /^[a-z][a-z0-9_]{0,63}$/.test(network.arkhamKey)));
    requireValue(['LEGACY_REGISTRY', 'ISSUER_LISTED', 'PENDING'].includes(network.identityBasis)); references(network.sources);
    requireValue(network.identityBasis === 'PENDING' ? network.family === null && network.networkIdentity === null : ['EVM', 'TRON', 'SOLANA', 'XRPL'].includes(network.family) && typeof network.networkIdentity === 'string' && /^[A-Za-z0-9]{1,64}$/.test(network.networkIdentity));
  }
  requireValue(new Set(metadata.networks.map(n => n.defillamaKey)).size === metadata.networks.length);
  const knownArkham = metadata.networks.map(n => n.arkhamKey).filter(n => n !== null);
  requireValue(new Set(knownArkham).size === knownArkham.length);
  for (const pair of metadata.coverage) {
    requireValue(exact(pair, ['coinId', 'networkId', 'relation', 'sources']) && metadata.coins.some(c => c.id === pair.coinId) && metadata.networks.some(n => n.id === pair.networkId) && ['ISSUER_LISTED', 'PROVIDER_AGGREGATE'].includes(pair.relation)); references(pair.sources);
  }
  const identities = new Set();
  for (const deployment of metadata.newDeployments) {
    requireValue(exact(deployment, ['id', 'coinId', 'networkId', 'standard', 'identity', 'sources']) && id(deployment.id) && deployment.standard === 'ERC-20');
    const network = metadata.networks.find(n => n.id === deployment.networkId), coin = metadata.coins.find(c => c.id === deployment.coinId);
    requireValue(coin && coin.productVariant === 'CURRENT' && network?.family === 'EVM' && network.identityBasis !== 'PENDING' && metadata.coverage.some(p => p.coinId === coin.id && p.networkId === network.id && p.relation === 'ISSUER_LISTED'));
    requireValue(exact(deployment.identity, ['kind', 'address']) && deployment.identity.kind === 'CONTRACT' && /^0x[0-9a-fA-F]{40}$/.test(deployment.identity.address)); references(deployment.sources);
    requireValue(deployment.sources.some(ref => metadata.sources.some(source => source.id === ref && source.kind === 'ISSUER')));
    const identity = network.id + ':' + deployment.identity.address.toLowerCase();
    requireValue(!identities.has(identity) && !legacy.deployments.some(d => d.id === deployment.id || d.networkId === network.id && d.identity.address?.toLowerCase() === deployment.identity.address.toLowerCase())); identities.add(identity);
    requireValue(coin.defillama.primaryAddress?.toLowerCase() === deployment.identity.address.toLowerCase());
  }
  const policy = metadata.selectionPolicy;
  requireValue(exact(policy, ['id', 'provider', 'metric', 'unit', 'limitPerCoin', 'scope', 'frequency', 'tieBreak']) && policy.id === 'defillama-network-circulating-usd-v1' && policy.provider === 'DEFILLAMA' && policy.metric === 'NETWORK_CIRCULATING_VALUE' && policy.unit === 'USD' && policy.limitPerCoin === 10 && policy.scope === 'PROVIDER_AGGREGATE_INCLUDING_BRIDGED' && policy.frequency === 'DAILY_UTC' && policy.tieBreak === 'CANONICAL_NETWORK_ID');
  // Existing runtime identifiers remain authoritative until a separate coordinated DB migration.
  for (const old of legacy.coins) {
    const next = metadata.coins.find(c => c.id === old.id);
    requireValue(next && next.pegCurrency === 'USD' && next.symbol === old.symbol && next.name === old.name && next.productVariant === 'CURRENT' && next.arkham.state === 'CONFIGURED' && next.arkham.pricingId === old.pricingId);
  }
  requireValue(metadata.coins.filter(c => c.arkham.state === 'CONFIGURED').every(c => legacy.coins.some(old => old.id === c.id && old.pricingId === c.arkham.pricingId)));
  for (const old of legacy.networks) {
    const next = metadata.networks.find(n => n.id === old.id);
    requireValue(next && next.family === old.family && next.networkIdentity === old.networkId && next.arkhamKey === old.providerKey && next.identityBasis === 'LEGACY_REGISTRY');
  }
  for (const old of legacy.deployments) requireValue(metadata.coverage.some(p => p.coinId === old.coinId && p.networkId === old.networkId));
  return metadata;
}

export const measurementContracts = Object.freeze({
  catalogueNetwork: Object.freeze({metric: 'NETWORK_CIRCULATING_VALUE', unit: 'USD', scope: 'COIN_NETWORK', amountKind: 'FIAT_VALUE', basis: 'PROVIDER_REPORTED', fxStatus: 'PROVIDER_INTERNAL_NOT_VERIFIED'}),
  dailyCirculating: Object.freeze({metric: 'NETWORK_CIRCULATING', unit: 'token', scope: 'COIN_NETWORK', amountKind: 'TOKEN_QUANTITY', definition: 'DEFILLAMA_NETWORK_CIRCULATING_V1'}),
  dailyMinted: Object.freeze({metric: 'NETWORK_MINTED', unit: 'token', scope: 'COIN_NETWORK', amountKind: 'TOKEN_QUANTITY', definition: 'DEFILLAMA_NATIVE_ISSUANCE_OUTSTANDING_V1'}),
});
