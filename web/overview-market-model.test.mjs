import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {overviewMarketRows} from './overview-market-model.js';
import {normalizeSources} from '../tools/market-store.mjs';
import {coinMarketProjection} from '../tools/market-registration/coin-market.mjs';
import {validateRegistrationIndex} from './registration-model.js';
const metadata=JSON.parse(await readFile(new URL('../data/market-registration.json',import.meta.url))),legacy=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url))),selectionId='a'.repeat(64),fetchedAt='2026-10-22T02:00:00.000Z';
function index(){return {schemaVersion:1,kind:'REGISTERED_SUPPLY_INDEX',selectionId,networks:[],coins:metadata.coins.map(c=>({id:c.id,symbol:c.symbol,name:c.name,pegCurrency:c.pegCurrency,notes:[],metrics:[],market:{...coinMarketProjection(metadata,legacy,Buffer.from(JSON.stringify({id:c.defillama.assetId,symbol:c.symbol,gecko_id:c.defillama.geckoId,pegType:c.defillama.pegType,address:c.defillama.primaryAddress,price:'0.0063',tokens:[{date:'1792627200',circulating:{[c.defillama.pegType]:'99999999999999999999.1234567890123456789'}}]})),{selectionId,coinId:c.id,requestDay:'2026-10-22',fetchedAt}),sourceId:'b'.repeat(64)}}))};}
test('five coin comparison separates peg currencies and explicit providers, never totals chain values or unknown volume',()=>{
 const market=normalizeSources(legacy,[{hash:'0'.repeat(64),value:{requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:fetchedAt,data:{price:'1.0001',circulatingSupply:'0',totalSupply:'12',totalVolume:'555'}}]}}]);
 const rows=overviewMarketRows(market,index());assert.equal(rows.length,5);assert.deepEqual(rows.map(r=>r.pegCurrency),['USD','USD','USD','JPY','JPY']);
 const usdc=rows.find(r=>r.coin.id==='usdc');assert.equal(usdc.price.amount,'1.0001');assert.equal(usdc.circulating.amount,'0');assert.equal(usdc.total.amount,'12');assert.equal(usdc.volume,null);
 const usdt=rows.find(r=>r.coin.id==='usdt');assert.equal(usdt.circulating,null);assert.equal(usdt.price,null); // no daily fallback even though available
 const jpyc=rows.find(r=>r.coin.id==='jpyc');assert.equal(jpyc.circulating.amount,'99999999999999999999.1234567890123456789');assert.equal(jpyc.total,null);assert.equal(jpyc.price.observedAt,null);assert.equal(jpyc.price.fetchedAt,fetchedAt);assert.equal(jpyc.circulating.day,'2026-10-22');
 assert.equal(overviewMarketRows(market,null).length,3);assert.deepEqual(overviewMarketRows(null,null),[]);
});
test('client rejects price/supply unit, selection, identity, clocks and malformed amounts before rendering',()=>{
 for(const mutate of [p=>p.price.unit='JPY',p=>p.price.amount=1,p=>p.coinId='jpyc',p=>p.selectionId='b'.repeat(64),p=>p.fetchedAt='2026-10-23T02:00:00.000Z',p=>p.circulating.day='2026-10-24',p=>p.sourceId='bad']){const x=index();mutate(x.coins[0].market);assert.throws(()=>validateRegistrationIndex(x));}
 const x=index();delete x.coins[0].market;assert.equal(validateRegistrationIndex(x),x); // pre-v3 scopes remain readable
});
