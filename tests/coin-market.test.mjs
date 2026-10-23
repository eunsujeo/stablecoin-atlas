import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {coinMarketProjection,validateCoinMarketProjection} from '../tools/market-registration/coin-market.mjs';
import {registrationDatabaseArguments} from '../tools/market-db/registration-cli.mjs';
const metadata=JSON.parse(await readFile(new URL('../data/market-registration.json',import.meta.url))),legacy=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url)));
const input={selectionId:'a'.repeat(64),coinId:'jpyc',requestDay:'2026-10-22',fetchedAt:'2026-10-22T23:59:59.000Z'};
const raw=(coinId='jpyc',change={})=>{const c=metadata.coins.find(c=>c.id===coinId);return {id:c.defillama.assetId,symbol:c.symbol,gecko_id:c.defillama.geckoId,pegType:c.defillama.pegType,address:c.defillama.primaryAddress,price:'0.006313010246021263',tokens:[{date:'1792627200',circulating:{[c.defillama.pegType]:'9007199254740993.123456789012345678901234567890123456'}}],chainBalances:{Ethereum:{tokens:[]}},minted:'9999999999999999999999999',...change};};
const project=(change={},options={})=>coinMarketProjection(metadata,legacy,Buffer.from(JSON.stringify(raw('jpyc',change))),{...input,...options});
test('global market maps exact coin token quantity and cached USD price, independent of chains/minted/FX',()=>{
 for(const coin of metadata.coins){const p=coinMarketProjection(metadata,legacy,Buffer.from(JSON.stringify(raw(coin.id))),{...input,coinId:coin.id});assert.equal(p.pegCurrency,coin.pegCurrency);assert.equal(p.circulating.amount,'9007199254740993.123456789012345678901234567890123456');assert.equal(p.price.amount,'0.006313010246021263');assert.equal(p.price.sourceAsOf,null);validateCoinMarketProjection(p);assert(!Object.hasOwn(p,'total'));}
 const bytes=Buffer.from(JSON.stringify(raw()).replace('"0.006313010246021263"','6.313010246021263e-3'));
 assert.equal(coinMarketProjection(metadata,legacy,bytes,input).price.amount,'0.006313010246021263');
});
test('missing/invalid/explicit zero are distinct and malformed global facts never become chain sums',()=>{
 assert.equal(project({price:null,tokens:undefined}).price.state,'MISSING');assert.equal(project({tokens:undefined}).circulating.state,'MISSING');
 assert.equal(project({price:'-1'}).price.state,'INVALID');assert.equal(project({price:'0'}).price.amount,'0');
 for(const tokens of [null,{},[{date:'1792627200',circulating:'0'}],[...raw().tokens,...raw().tokens],[{date:'1792627201',circulating:{peggedJPY:'3'}}],[{date:'1792627200',circulating:{peggedJPY:'-1'}}]])assert.equal(project({tokens}).circulating.state,'INVALID');
 assert.equal(project({tokens:[{date:'1792627200',circulating:{peggedUSD:'100'}}]}).circulating.state,'MISSING');
 assert.equal(project({tokens:[{date:'1792627200',circulating:{peggedJPY:'0'}}]}).circulating.amount,'0');
 assert.equal(project({tokens:[{date:String(Date.parse('2026-10-24')/1000),circulating:{peggedJPY:'5'}}]}).circulating.state,'MISSING');
});
test('coin identity, reservation day and midnight collection clocks are bound, not inferred',()=>{
 assert.throws(()=>project({id:'427'}),/REGISTRATION_ASSET_IDENTITY_MISMATCH/);assert.throws(()=>project({address:'wrong'}),/REGISTRATION_CONTRACT_IDENTITY_MISMATCH/);
 for(const options of [{requestDay:undefined},{requestDay:'2026-02-30'},{fetchedAt:'2026-10-21T23:59:59.000Z'},{fetchedAt:'2026-10-23T00:01:00.000Z'}])assert.throws(()=>project({},options),/REGISTRATION_COIN_MARKET_INVALID/);
 assert.equal(project({},{fetchedAt:'2026-10-23T00:00:20.000Z'}).requestDay,'2026-10-22');
 assert.equal(registrationDatabaseArguments(['market-upgrade']).command,'market-upgrade');
 assert.throws(()=>registrationDatabaseArguments(['market-import','--selection',input.selectionId,'--coin','jpyc','--source','raw.json','--fetched-at',input.fetchedAt]),/MISSING_ARGUMENT/);
});
