import {createHash} from 'node:crypto';
import {validateRegistration, isoTime, measurementContracts} from './metadata.mjs';
import {registrationDecimal} from './decimal.mjs';
import {requireProviderIdentity, registrationHash} from './planner.mjs';
import {parseHistorySource} from '../supply-history-source.mjs';

// Offline unit/identity preview. This does not emit the runtime history DTO or write facts.
export function registrationHistory(metadata, legacy, bytes, {coinId, fetchedAt, networks} = {}) {
  validateRegistration(metadata, legacy);
  const coin = metadata.coins.find(c => c.id === coinId);
  if (!coin || coin.productVariant !== 'CURRENT' || !isoTime(fetchedAt)) throw Error('REGISTRATION_SOURCE_INVALID');
  let source; try { source = parseHistorySource(bytes); } catch { throw Error('REGISTRATION_SOURCE_INVALID'); }
  requireProviderIdentity(coin, source);
  if (coin.defillama.primaryAddress !== null && (typeof source.address !== 'string' || source.address.toLowerCase() !== coin.defillama.primaryAddress.toLowerCase())) throw Error('REGISTRATION_CONTRACT_IDENTITY_MISMATCH');
  if (!source.chainBalances || typeof source.chainBalances !== 'object' || Array.isArray(source.chainBalances) || Object.keys(source.chainBalances).length > 512) throw Error('REGISTRATION_SOURCE_INVALID');
  const reviewed = metadata.coverage.filter(p => p.coinId === coin.id).map(p => metadata.networks.find(n => n.id === p.networkId));
  if (networks !== undefined && (!Array.isArray(networks) || !networks.length || networks.length > 10 || new Set(networks).size !== networks.length || networks.some(n => !reviewed.some(r => r.id === n)))) throw Error('REGISTRATION_NETWORK_SELECTION_INVALID');
  const candidates = reviewed.filter(n => (networks === undefined || networks.includes(n.id)) && Object.hasOwn(source.chainBalances, n.defillamaKey));
  if (candidates.length > 10) throw Error('REGISTRATION_NETWORK_SELECTION_REQUIRED');
  const to = fetchedAt.slice(0, 10), from = new Date(Date.parse(to) - 365 * 86400000).toISOString().slice(0, 10), metrics = [];
  for (const [field, contract] of [['circulating', measurementContracts.dailyCirculating], ['minted', measurementContracts.dailyMinted]]) {
    const series = [], missingNetworks = [];
    for (const network of reviewed.filter(n => networks === undefined || networks.includes(n.id))) {
      const tokens = Object.hasOwn(source.chainBalances, network.defillamaKey) ? source.chainBalances[network.defillamaKey]?.tokens : undefined;
      if (tokens === undefined) { missingNetworks.push(network.id); continue; }
      if (!Array.isArray(tokens) || tokens.length > 12000) throw Error('REGISTRATION_SOURCE_INVALID');
      const seen = new Set(), points = [];
      for (const row of tokens) {
        if (!row || typeof row.date !== 'string' || !/^\d{1,11}$/.test(row.date) || BigInt(row.date) % 86400n !== 0n) throw Error('REGISTRATION_SOURCE_INVALID');
        const day = new Date(Number(row.date) * 1000).toISOString().slice(0, 10);
        if (day < from || day > to) continue;
        if (seen.has(day)) throw Error('REGISTRATION_DUPLICATE_DAY');
        seen.add(day);
        const quantity = row[field];
        if (!quantity || !Object.hasOwn(quantity, coin.defillama.pegType) || quantity[coin.defillama.pegType] === null) continue;
        points.push({day, amount: registrationDecimal(quantity[coin.defillama.pegType])});
      }
      points.sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : 0);
      if (points.length) series.push({networkId: network.id, points}); else missingNetworks.push(network.id);
    }
    metrics.push({contract, state: series.length ? missingNetworks.length ? 'PARTIAL' : 'AVAILABLE' : 'MISSING', series, missingNetworks});
  }
  const body = {schemaVersion: 1, kind: 'REGISTRATION_HISTORY_PREVIEW_NOT_ACTIVE', coinId: coin.id, pegCurrency: coin.pegCurrency,
    metadataHash: registrationHash(metadata), sourceHash: createHash('sha256').update(bytes).digest('hex'), fetchedAt, from, to, metrics, notes: coin.notes,
    providerRequests: 0, databaseWrites: 0};
  return structuredClone({...body, previewHash: registrationHash(body)});
}
