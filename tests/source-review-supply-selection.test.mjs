import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {registrationHash} from '../tools/market-registration/planner.mjs';
import {createHash} from 'node:crypto';
import {sourceSupplySelection} from '../tools/source-review-supply-selection.mjs';
const point=amount=>({date:'1792627200',circulating:{peggedUSD:amount},minted:{peggedUSD:'99999999999999999999999999999999999999999'}});
const source=balances=>({id:'2',symbol:'USDC',gecko_id:'usd-coin',pegType:'peggedUSD',price:'999999',chainBalances:balances});
function select(value,options={}){const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value));return sourceSupplySelection(bytes,{coinId:'usdc',sha256:createHash('sha256').update(bytes).digest('hex'),day:'2026-10-22',fetchedAt:'2026-10-22T06:00:51.936Z',...options});}
test('supply selection ranks exact token lexemes and ignores price/minted values and other dates',()=>{
 const value=source({B:{tokens:[point('9007199254740993.000000000000000001')]},A:{tokens:[point('9007199254740993.000000000000000002')]},C:{tokens:[{...point('99999999999999999999'),date:'1792540800'},point('1')]}});
 const out=select(value);assert.deepEqual(out.selected.map(x=>x.network),['A','B','C']);assert.equal(out.selected[0].amount,'9007199254740993.000000000000000002');assert.equal(out.unit,'token');
 const raw=JSON.stringify(source({A:{tokens:[point('1')]}})).replace('"peggedUSD":"1"','"peggedUSD":9007199254740993.000000000000000002');
 assert.equal(select(raw).selected[0].amount,'9007199254740993.000000000000000002');
});
test('supply selection caps ten, orders ties deterministically and never pads zeros or absent days',()=>{
 const balances=Object.fromEntries(Array.from({length:12},(_,i)=>['N'+String(i).padStart(2,'0'),{tokens:[point('1')]}]));balances.Zero={tokens:[point('0')]};balances.Missing={tokens:[]};
 const out=select(source(balances));assert.equal(out.selected.length,10);assert.deepEqual(out.selected.map(x=>x.network),Object.keys(balances).slice(0,10));assert.equal(out.zeroCount,1);assert.equal(out.state,'PARTIAL');assert.deepEqual(out.excluded,[{network:'Missing',reason:'DAY_MISSING'}]);
 assert.equal(select(source({A:{tokens:[point('2')]},B:{tokens:[point('1')]},C:{tokens:[point('0')]}})).selected.length,2);
});
test('missing, duplicate and malformed circulating evidence are excluded without minted fallback',()=>{
 const out=select(source({A:{tokens:[point('1'),point('2')]},B:{tokens:[{date:'1792627200',minted:{peggedUSD:'100'}}]},C:{tokens:[point('-1')]},D:{tokens:[point('NaN')]}}));
 assert.deepEqual(out.selected,[]);assert.equal(out.state,'PARTIAL');assert.deepEqual(out.excluded.map(x=>x.reason),['DUPLICATE_DAY','CIRCULATING_MISSING','CIRCULATING_INVALID','CIRCULATING_INVALID']);assert.equal(out.providerRequests,0);assert.equal(out.databaseWrites,0);
});
test('identity, hash, date and network shape mismatches fail before producing candidates',()=>{
 const value=source({A:{tokens:[point('1')]}});
 for(const options of [{coinId:'usdt'},{sha256:'0'.repeat(64)},{day:'2026-02-30'},{day:'2026-10-23'},{fetchedAt:'invalid'}])assert.throws(()=>select(value,options));
 assert.throws(()=>select({...value,symbol:'USDT'}));assert.throws(()=>select(source({'https://example.invalid':{tokens:[point('1')]}})));
});

test('unexecuted source intake plan pins eight passive URLs and uses the existing approval hash canonicalization',async()=>{
 const plan=JSON.parse(await readFile(new URL('../data/source-review-top10-intake-plan.json',import.meta.url),'utf8'));
 const {planSha256,...body}=plan;assert.equal(registrationHash(body),planSha256);
 assert.equal(plan.targets.length,8);assert.equal(plan.maximumRequests,8);assert.equal(plan.state,'NOT_EXECUTED');assert.equal(plan.authorizationRequired,true);assert.equal(plan.proxyResolutionRequested,false);assert.equal(plan.rpcRequests,0);assert.equal(plan.implementationFollowupRequests,0);
 for(const t of plan.targets){const u=new URL(t.url);assert.equal(u.origin,'https://sourcify.dev');assert.equal(u.pathname,`/server/v2/contract/${t.chainId}/${t.address}`);assert.equal(u.searchParams.get('fields'),'sources,compilation,abi,metadata');assert.match(t.address,/^0x[0-9a-fA-F]{40}$/);}
});
