import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isAddress } from 'viem';
import { tronAddress } from '../src/tron/address.js';
const url = new URL('../docs/research/stablecoin-profiles.json', import.meta.url);
const catalog = JSON.parse(readFileSync(url, 'utf8'));
test('stablecoin research catalog preserves unique deployment identities and official per-claim provenance across four chains', () => {
  assert.equal(catalog.purpose, 'RESEARCH_CATALOG_NOT_ASSESSMENT');
  assert.deepEqual(new Set(catalog.profiles.map((p: any) => p.id)), new Set(['ethereum-usdc', 'ethereum-usdt', 'ethereum-rlusd', 'tron-usdt', 'solana-usdc', 'solana-usdt', 'xrpl-usdc', 'xrpl-rlusd']));
  const sources = new Map(catalog.sources.map((s: any) => [s.id, s]));
  assert.equal(sources.size, catalog.sources.length); assert.equal(catalog.profiles.length, 8);
  const allowed = new Set(['developers.circle.com', 'www.circle.com', 'tether.to', 'docs.ripple.com', 'solana.com', 'xrpl.org']);
  for (const s of catalog.sources) { const u = new URL(s.url); assert.equal(u.protocol, 'https:'); assert(allowed.has(u.hostname)); assert(s.title && s.section); assert.equal(s.provenance, 'DOCUMENTED'); assert(Number.isFinite(Date.parse(s.reviewedAt))); }
  const identities = new Set<string>();
  for (const p of catalog.profiles) {
    const key = JSON.stringify([p.chain.family, p.chain.network, p.identifier]); assert(!identities.has(key)); identities.add(key);
    assert(p.documentedClaims.length > 0);
    for (const c of p.documentedClaims) { assert(sources.has(c.sourceId)); assert(c.section && c.value); assert.equal(c.provenance, 'DOCUMENTED'); }
    const ref = p.documentedClaims.find((c: any) => ['ADDRESS_REFERENCE', 'PROXY_ADDRESS_REFERENCE'].includes(c.kind));
    if (p.chain.family === 'EVM') { assert(isAddress(p.identifier.contractAddress)); assert.equal(p.identifier.kind, 'CONTRACT'); assert.equal(ref.value.toLowerCase(), p.identifier.contractAddress.toLowerCase()); }
    if (p.chain.family === 'TRON') { assert.equal(tronAddress(p.identifier.contractAddress).base58, ref.value); assert.equal(p.identifier.kind, 'CONTRACT'); }
  }
  for (const r of catalog.privateFixtureReferences) { assert(existsSync(fileURLToPath(new URL(r.reference, url)))); assert.equal(r.scope, 'ENGINE_HARNESS_ONLY_NOT_REAL_STABLECOIN_EXECUTION'); }
});
test('Solana mint references and XRPL currency/issuer identities never masquerade as deployed contracts or implemented adapters', () => {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  for (const p of catalog.profiles.filter((p: any) => ['SOLANA', 'XRPL'].includes(p.chain.family))) {
    assert.equal(p.currentAssessment.adapterState, 'NOT_IMPLEMENTED'); assert.equal(p.historicalObservations.length, 0);
    assert.equal(p.currentAssessment.newRpcObservation, 'NOT_TESTED'); assert.equal(p.currentAssessment.mainnetStateChange, 'NOT_TESTED');
    assert.equal(p.chain.networkId, 'UNKNOWN'); assert(!('contractAddress' in p.identifier));
    if (p.chain.family === 'SOLANA') {
      assert.equal(p.identifier.kind, 'MINT_CANDIDATE'); assert.equal(p.identifier.accountTypeObservation, 'UNKNOWN'); assert.equal(p.currentAssessment.tokenProgramId, 'UNKNOWN');
      let n = 0n; for (const ch of p.identifier.mintAddress) { assert(alphabet.includes(ch)); n = n * 58n + BigInt(alphabet.indexOf(ch)); }
      assert.equal(Buffer.from(n.toString(16).padStart(64, '0'), 'hex').length, 32);
      assert.equal(p.documentedClaims.find((c: any) => c.kind === 'ADDRESS_REFERENCE').value, p.identifier.mintAddress);
    } else {
      assert.equal(p.identifier.kind, 'ISSUED_CURRENCY'); assert.match(p.identifier.currency, /^[A-F0-9]{40}$/); assert.match(p.identifier.issuerAddress, /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/);
      assert.equal(Buffer.from(p.identifier.currency, 'hex').toString('ascii').replace(/\0/g, ''), p.assetSymbol); assert.equal(p.identifier.ledgerObservation, 'UNKNOWN'); assert(!('mintAddress' in p.identifier));
    }
  }
});
test('research claims, historical observations and private fixtures stay separate and each gap has evidence requirements and a next step', () => {
  const gaps = new Map(catalog.gapDefinitions.map((g: any) => [g.id, g])); assert.equal(gaps.size, catalog.gapDefinitions.length);
  for (const g of catalog.gapDefinitions) { assert(g.requiredEvidence && g.currentEvidence && g.unresolvedReason && g.nextAllowedAction); assert.equal(g.status, 'UNKNOWN'); }
  for (const p of catalog.profiles) {
    assert.equal(p.currentAssessment.issuerVerificationStatus, 'UNKNOWN'); assert.equal(p.currentAssessment.nativeOrBridgedOnChain, 'UNKNOWN'); assert.equal(p.currentAssessment.authorityState, 'UNKNOWN');
    assert.equal(p.currentAssessment.mainnetStateChange, 'NOT_TESTED'); assert(p.gaps.every((g: string) => gaps.has(g)));
    for (const o of p.historicalObservations) {
      assert.equal(o.provenance, 'OBSERVED'); assert.equal(o.scope, 'HISTORICAL_READ_ONLY'); assert.match(o.report, /^\.\.\/\.\.\/reports\/[^/]+\.json$/); assert.match(o.sha256, /^[a-f0-9]{64}$/);
      assert.equal(o.chainFamily, p.chain.family); assert.equal(o.networkId, p.chain.networkId); assert.equal(o.assetAddress.toLowerCase(), p.identifier.contractAddress.toLowerCase());
      assert(Date.parse(o.observedAt) < Date.parse(catalog.reviewedAt)); assert.equal(o.issuerVerificationStatus, 'UNKNOWN'); assert.equal(o.nativeOrBridged.status, 'UNKNOWN');
      assert(o.results.every((r: any) => r.support === 'UNKNOWN'));
    }
  }
  const t = catalog.profiles.find((p: any) => p.id === 'tron-usdt').historicalObservations[0];
  assert.equal(t.observedBlockOrSlot, 'UNKNOWN'); assert.equal(t.allowanceSample.owner, t.assetAddress); assert.equal(t.allowanceSample.spender, t.assetAddress); assert.equal(t.allowanceSample.allowance, '0');
  assert(!catalog.profiles.some((p: any) => p.assetSymbol === 'XRP'));
});
