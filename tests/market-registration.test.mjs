import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {validateRegistration, measurementContracts} from '../tools/market-registration/metadata.mjs';
import {registrationDecimal, registrationUnits} from '../tools/market-registration/decimal.mjs';
import {registrationPlan, verifyRegistrationPlanHash} from '../tools/market-registration/planner.mjs';
import {registrationHistory} from '../tools/market-registration/history.mjs';
import {main, parseRegistrationArguments} from '../tools/market-registration/cli.mjs';

const metadata = JSON.parse(await readFile(new URL('../data/market-registration.json', import.meta.url)));
const legacy = JSON.parse(await readFile(new URL('../data/asset-registry.json', import.meta.url)));
const at = '2026-10-22T06:27:10.991Z', proof = {sourceHash: 'a'.repeat(64), fetchedAt: at};
const run = promisify(execFile);
function catalogue() {
  return {peggedAssets: metadata.coins.map(coin => {
    const networks = metadata.coverage.filter(p => p.coinId === coin.id).map(p => metadata.networks.find(n => n.id === p.networkId));
    return {id: coin.defillama.assetId, symbol: coin.symbol, gecko_id: coin.defillama.geckoId, pegType: coin.defillama.pegType, price: null,
      chains: networks.map(n => n.defillamaKey), chainCirculating: Object.fromEntries(networks.map((n, i) => [n.defillamaKey, {current: {[coin.defillama.pegType]: String(i + 1)}}]))};
  })};
}
const sourceCoin = (data, id) => data.peggedAssets.find(a => a.id === metadata.coins.find(c => c.id === id).defillama.assetId);
const plannedCoin = (plan, id) => plan.coins.find(c => c.coinId === id);
function detail({amount = '100', minted = '200', network = 'Ethereum', coinId = 'jpyc'} = {}) {
  const coin = metadata.coins.find(c => c.id === coinId);
  return {id: coin.defillama.assetId, symbol: coin.symbol, gecko_id: coin.defillama.geckoId, pegType: coin.defillama.pegType, address: coin.defillama.primaryAddress,
    chainBalances: {[network]: {tokens: [{date: '1792627200', circulating: {[coin.defillama.pegType]: amount}, ...(minted === undefined ? {} : {minted: {[coin.defillama.pegType]: minted}})}]}}};
}
const preview = data => registrationHistory(metadata, legacy, Buffer.from(JSON.stringify(data)), {coinId: 'jpyc', fetchedAt: at});

test('registration metadata keeps legacy identifiers and five official new contracts separate from activation, including pending network identities', () => {
  const original = JSON.stringify(legacy);
  assert.equal(validateRegistration(metadata, legacy), metadata);
  const plan = registrationPlan(metadata, legacy);
  assert.equal(plan.kind, 'MARKET_REGISTRATION_PLAN_NOT_ACTIVE'); assert.equal(plan.state, 'METADATA_ONLY');
  assert.deepEqual(plan.counts, {configuredCoins: 3, plannedCoins: 5, newCoins: 2, reviewedNetworkPairs: 33, newDeployments: 5, selectedPairs: 0});
  assert.ok(plan.networkIdentityPending.includes('hyperliquid-l1')); assert.equal(plan.databaseWrites, 0); assert.equal(plan.providerRequests, 0);
  assert.equal(plannedCoin(plan, 'jpyc').arkham.pricingId, null); assert.equal(plannedCoin(plan, 'jpyc').pegCurrency, 'JPY');
  assert.equal(JSON.stringify(legacy), original); assert.equal(verifyRegistrationPlanHash(plan), plan);
  const before = metadata.newDeployments[0].identity.address; plan.proposedDeployments[0].identity.address = '0x' + '1'.repeat(40); assert.equal(metadata.newDeployments[0].identity.address, before); assert.throws(() => verifyRegistrationPlanHash(plan));
});

test('metadata rejects currency/peg confusion, implicit Arkham activation, duplicate bindings, forged source hosts and legacy drift', () => {
  for (const mutate of [
    m => m.coins.find(c => c.id === 'jpyc').defillama.pegType = 'peggedUSD',
    m => m.coins.find(c => c.id === 'usdc').pegCurrency = 'JPY',
    m => m.coins.find(c => c.id === 'jpyc').arkham = {state: 'CONFIGURED', pricingId: 'jpycoin'},
    m => m.coins[1].defillama.assetId = m.coins[0].defillama.assetId,
    m => m.coverage.push(structuredClone(m.coverage[0])),
    m => m.sources[0].url = 'https://developers.circle.com.attacker.invalid/',
    m => m.sources[0].url = 'https://credential@developers.circle.com/',
    m => m.sources[0].url = 'http://developers.circle.com/',
    m => m.networks.find(n => n.id === 'ethereum').networkIdentity = '2',
    m => m.networks.find(n => n.id === 'polygon').identityBasis = 'PENDING',
    m => m.newDeployments[0].sources = ['llama-api'],
    m => m.selectionPolicy.limitPerCoin = 11,
  ]) { const m = structuredClone(metadata); mutate(m); assert.throws(() => validateRegistration(m, legacy)); }
});

test('decimal normalization preserves numeric lexemes beyond safe integers and bounded exponents without rounding or underflow to zero', () => {
  for (const [value, expected] of [['1.2300e3', '1230'], ['1e-7', '0.0000001'], ['1000e-3', '1'], ['0.00000e+20', '0'], ['1.0e-36', '0.' + '0'.repeat(35) + '1'], ['9'.repeat(78), '9'.repeat(78)]]) assert.equal(registrationDecimal(value), expected);
  assert.equal(registrationDecimal('9007199254740993.123456789012345678901234567890123456'), '9007199254740993.123456789012345678901234567890123456');
  assert.ok(registrationUnits('9007199254740993') > registrationUnits('9007199254740992.999999999999999999999999999999999999'));
  for (const invalid of [1, -1, null, '-0', '-1', 'NaN', 'Infinity', '0x10', '+1', '01', '1e-37', '1e78', '1e999', '1.1e-36', '1'.repeat(221)]) assert.throws(() => registrationDecimal(invalid));
});

test('top ten is deterministic and reports USD value with unknown provider FX, never reversed into token quantity', () => {
  const data = catalogue(), usdc = sourceCoin(data, 'usdc');
  for (const key of usdc.chains) usdc.chainCirculating[key].current.peggedUSD = '9007199254740992.999999999999999999999999999999999999';
  usdc.chainCirculating.Ethereum.current.peggedUSD = '9007199254740993';
  const plan = registrationPlan(metadata, legacy, {catalogue: data, ...proof}), selected = plannedCoin(plan, 'usdc').selection;
  assert.equal(selected.state, 'READY'); assert.equal(selected.selected.length, 10); assert.equal(selected.selected[0].networkId, 'ethereum');
  assert.deepEqual(selected.selected.slice(1).map(n => n.networkId), selected.selected.slice(1).map(n => n.networkId).sort());
  assert.deepEqual(selected.selected.map(n => n.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); assert.equal(selected.excluded.filter(n => n.reason === 'BELOW_TOP_TEN').length, 1);
  assert.equal(selected.contract.unit, 'USD'); assert.equal(selected.contract.amountKind, 'FIAT_VALUE'); assert.equal(selected.contract.fxStatus, 'PROVIDER_INTERNAL_NOT_VERIFIED');
  assert.equal(plan.catalogueSource.sourceAsOf, null); assert.equal(plan.catalogueSource.observationClock, 'REQUEST');
  const jpy = plannedCoin(plan, 'jpyc').selection; assert.equal(jpy.contract.unit, 'USD'); assert.equal(jpy.selected.length, 4);
  assert.equal(verifyRegistrationPlanHash(plan), plan);
});

test('missing networks, expected peg fields, invalid amounts and real zero remain distinct and never fill ten artificially', () => {
  const data = catalogue(), rlusd = sourceCoin(data, 'rlusd'); rlusd.chains = ['Ethereum', 'XRPL'];
  rlusd.chainCirculating.Ethereum.current.peggedUSD = '0';
  const plan = registrationPlan(metadata, legacy, {catalogue: data, ...proof}), result = plannedCoin(plan, 'rlusd').selection;
  assert.equal(result.state, 'PARTIAL'); assert.equal(result.selected.length, 2); assert.equal(result.selected.at(-1).reportedUsdValue, '0'); assert.equal(result.excluded.length, 5);
  assert.ok(result.excluded.every(n => n.reason === 'PROVIDER_NOT_LISTED'));
  const jpy = sourceCoin(data, 'jpyc'); jpy.chainCirculating.Ethereum.current = {peggedUSD: '999'}; jpy.chainCirculating.Polygon.current.peggedJPY = 'NaN'; jpy.chainCirculating.Kaia.current.peggedJPY = null;
  const jpyResult = plannedCoin(registrationPlan(metadata, legacy, {catalogue: data, ...proof}), 'jpyc').selection;
  assert.equal(jpyResult.selected.length, 1); assert.equal(jpyResult.excluded.filter(n => n.reason === 'VALUE_MISSING').length, 2); assert.equal(jpyResult.excluded.filter(n => n.reason === 'VALUE_INVALID').length, 1);
});

test('unknown networks may require review but never register automatically or alias HyperEVM to Hyperliquid L1', () => {
  const data = catalogue(), usdc = sourceCoin(data, 'usdc'); usdc.chains = usdc.chains.filter(n => n !== 'Hyperliquid L1'); usdc.chains.push('HyperEVM'); usdc.chainCirculating.HyperEVM = {current: {peggedUSD: '1e30'}};
  const result = plannedCoin(registrationPlan(metadata, legacy, {catalogue: data, ...proof}), 'usdc').selection;
  assert.equal(result.state, 'REVIEW_REQUIRED'); assert.ok(result.unreviewed.find(n => n.providerKey === 'HyperEVM').reviewRequired);
  assert.ok(!result.selected.some(n => n.networkId === 'hyperliquid-l1' || n.providerKey === 'HyperEVM'));
});

test('provider identity failure and duplicate asset records are isolated to their coin and unsafe shape text is not echoed', () => {
  const data = catalogue(); sourceCoin(data, 'jpyc').gecko_id = 'jpy-coin-prepaid';
  let plan = registrationPlan(metadata, legacy, {catalogue: data, ...proof});
  assert.equal(plan.state, 'SOURCE_ERRORS'); assert.equal(plannedCoin(plan, 'jpyc').selection.errorCode, 'REGISTRATION_ASSET_IDENTITY_MISMATCH'); assert.equal(plannedCoin(plan, 'usdc').selection.selected.length, 10);
  data.peggedAssets.push(structuredClone(sourceCoin(data, 'usdt'))); plan = registrationPlan(metadata, legacy, {catalogue: data, ...proof}); assert.equal(plannedCoin(plan, 'usdt').selection.errorCode, 'REGISTRATION_ASSET_ID_AMBIGUOUS');
  sourceCoin(data, 'rlusd').chains.push('https://unsafe.invalid/private-marker'); plan = registrationPlan(metadata, legacy, {catalogue: data, ...proof}); assert.equal(plannedCoin(plan, 'rlusd').selection.state, 'ERROR'); assert.ok(!JSON.stringify(plan).includes('private-marker'));
});

test('detailed JPY preview uses native token quantities, pins current contract, separates circulating and outstanding issuance, and preserves zero/missing days', () => {
  const data = detail({amount: '9007199254740993.123456789012345678901234567890123456', minted: '1e20'}), p = preview(data);
  assert.equal(p.kind, 'REGISTRATION_HISTORY_PREVIEW_NOT_ACTIVE'); assert.equal(p.pegCurrency, 'JPY'); assert.equal(p.providerRequests, 0); assert.equal(p.databaseWrites, 0);
  assert.deepEqual(p.metrics[0].contract, measurementContracts.dailyCirculating); assert.equal(p.metrics[0].contract.unit, 'token'); assert.equal(p.metrics[0].series[0].points[0].amount, data.chainBalances.Ethereum.tokens[0].circulating.peggedJPY);
  assert.equal(p.metrics[1].series[0].points[0].amount, '100000000000000000000'); assert.equal(p.metrics[1].contract.definition, 'DEFILLAMA_NATIVE_ISSUANCE_OUTSTANDING_V1');
  const row = data.chainBalances.Ethereum.tokens[0]; row.date = '1792540800'; row.circulating.peggedJPY = '0'; delete row.minted;
  data.chainBalances.Ethereum.tokens.push({date: '1792627200', minted: {peggedJPY: '123'}});
  const missing = preview(data); assert.deepEqual(missing.metrics[0].series[0].points, [{day: '2026-10-21', amount: '0'}]); assert.deepEqual(missing.metrics[1].series[0].points, [{day: '2026-10-22', amount: '123'}]);
});

test('detail preview rejects prepaid/foreign identities, duplicate dates, precision loss and unknown selections; absent metric never borrows another value', () => {
  for (const mutate of [d => d.address = '0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB', d => d.id = '1', d => d.pegType = 'peggedUSD', d => d.chainBalances.Ethereum.tokens.push(d.chainBalances.Ethereum.tokens[0]), d => d.chainBalances.Ethereum.tokens[0].circulating.peggedJPY = '1e-37']) {
    const data = detail(); mutate(data); assert.throws(() => preview(data));
  }
  const data = detail(); delete data.chainBalances.Ethereum.tokens[0].minted; const p = preview(data);
  assert.equal(p.metrics[1].state, 'MISSING'); assert.deepEqual(p.metrics[1].series, []); assert.ok(p.metrics[0].series.length);
  const bytes = Buffer.from(JSON.stringify(detail()));
  for (const networks of [[], ['ethereum', 'ethereum'], ['unreviewed-chain'], Array.from({length: 11}, (_, i) => 'chain-' + i)]) assert.throws(() => registrationHistory(metadata, legacy, bytes, {coinId: 'jpyc', fetchedAt: at, networks}));
});

test('offline CLI validates real files without network/DB, preserves input and runtime registry bytes, and redacts unsafe failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas registration ')), file = join(root, 'catalogue.json'), link = join(root, 'linked.json'), original = await readFile(new URL('../data/asset-registry.json', import.meta.url));
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = () => { throw Error('NETWORK_MUST_NOT_RUN'); };
    await writeFile(file, JSON.stringify(catalogue())); const bytes = await readFile(file);
    const plan = await main(['plan', '--catalogue', file, '--fetched-at', at]); assert.equal(plan.providerRequests, 0); assert.equal(plan.databaseWrites, 0); assert.equal(plan.counts.selectedPairs, 32);
    assert.deepEqual(await readFile(file), bytes); assert.deepEqual(await readFile(new URL('../data/asset-registry.json', import.meta.url)), original);
    await symlink(file, link); await assert.rejects(main(['plan', '--catalogue', link, '--fetched-at', at]));
    const script = fileURLToPath(new URL('../tools/market-registration/cli.mjs', import.meta.url));
    const {stdout, stderr} = await run(process.execPath, [script, 'plan'], {env: {...process.env, DATABASE_URL: 'private-registration-marker', ARKM_API_KEY: 'private-registration-marker'}});
    assert.equal(JSON.parse(stdout).state, 'METADATA_ONLY'); assert.equal(stderr, ''); assert.ok(!stdout.includes('private-registration-marker'));
    await assert.rejects(run(process.execPath, [script, 'plan', '--catalogue', join(root, 'private-registration-marker'), '--fetched-at', at]), e => !e.stderr.includes('private-registration-marker') && e.stderr.includes('INPUT_UNAVAILABLE'));
  } finally { globalThis.fetch = originalFetch; await rm(root, {recursive: true, force: true}); }
});

test('registration CLI has no activation, API URL, environment loading, or unbounded selector arguments', () => {
  assert.equal(parseRegistrationArguments(['plan']).command, 'plan'); assert.equal(parseRegistrationArguments(['detail', '--coin', 'jpyc', '--source', 'input.json', '--fetched-at', at]).command, 'detail');
  for (const args of [['activate'], ['plan', '--env-file', '.env.local'], ['plan', '--url', 'https://example.com'], ['plan', '--catalogue', 'input.json'], ['plan', '--fetched-at', at], ['plan', '--catalogue', 'a', '--catalogue', 'b'], ['detail', '--coin', 'jpyc']]) assert.throws(() => parseRegistrationArguments(args));
});
