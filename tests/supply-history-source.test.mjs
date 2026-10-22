import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {historyProjection,parseHistorySource,fetchHistorySource,sourceByteLimit} from '../tools/supply-history-source.mjs';
import {validateSupplyHistory} from '../web/supply-history-model.js';
const registry=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url)));
const at='2026-10-22T04:50:00.000Z',stamp=String(Date.parse('2026-10-22T00:00:00.000Z')/1000);
const response=amount=>Buffer.from('{"id":"250","symbol":"RLUSD","gecko_id":"ripple-usd","pegType":"peggedUSD","chainBalances":{"Ethereum":{"tokens":[{"date":'+stamp+',"circulating":{"peggedUSD":'+amount+'}}]},"XRPL":{"tokens":[{"date":'+stamp+',"circulating":{"peggedUSD":0}}]}}}');
test('daily provider supply retains numeric lexemes, zero, source identity and a bounded year; missing networks remain missing',()=>{
 const amount='900719925474099300000.123456789012345678901234567890123456',bytes=response(amount),p=historyProjection(bytes,'rlusd',registry,at);
 assert.equal(p.networks[0].points[0].amount,amount);assert.equal(p.networks[1].points[0].amount,'0');assert.equal(p.metric,'NETWORK_CIRCULATING');assert.equal(p.fetchedAt,at);assert.equal(p.networks[0].points[0].day,'2026-10-22');assert.equal(p.from,'2025-10-22');
 const raw=parseHistorySource(bytes);delete raw.chainBalances.XRPL;const missing=historyProjection(Buffer.from(JSON.stringify(raw)),'rlusd',registry,at);assert.equal(missing.networks.length,1);
 const old={date:'1609459200',circulating:{peggedUSD:'5'}},future={date:String(BigInt(stamp)+86400n),circulating:{peggedUSD:'6'}};raw.chainBalances.Ethereum.tokens.push(old,future);
 assert.equal(historyProjection(Buffer.from(JSON.stringify(raw)),'rlusd',registry,at).networks[0].points.length,1);
});
test('wrong asset, duplicate days, non-daily dates, negative/rounded/exponent amounts and unsafe shapes fail closed',()=>{
 for(const amount of ['-1','1e3','0.0000000000000000000000000000000000001'])assert.throws(()=>historyProjection(response(amount),'rlusd',registry,at));
 for(const mutate of [x=>x.symbol='USDC',x=>x.gecko_id='other',x=>x.chainBalances.Ethereum.tokens.push(x.chainBalances.Ethereum.tokens[0]),x=>x.chainBalances.Ethereum.tokens[0].date=String(BigInt(stamp)+1n)]){
  const raw=parseHistorySource(response('1'));mutate(raw);assert.throws(()=>historyProjection(Buffer.from(JSON.stringify(raw)),'rlusd',registry,at));
 }
 assert.throws(()=>parseHistorySource(Buffer.from('['.repeat(33)+']'.repeat(33))));assert.throws(()=>parseHistorySource(Buffer.from([0xff])));
 const p=historyProjection(response('1'),'rlusd',registry,at);p.networks[0].points[0].deploymentId='rlusd-ethereum';assert.throws(()=>validateSupplyHistory([p],registry));
});
test('fixed endpoint fetch is one read-only bounded request with no redirects, retries, alternate endpoints or credentials',async()=>{
 let count=0;const bytes=await fetchHistorySource('rlusd',async(url,options)=>{count++;assert.equal(url,'https://stablecoins.llama.fi/stablecoin/250');assert.equal(options.redirect,'error');assert.equal(options.headers['API-Key'],undefined);return new Response(response('1'));});assert.equal(count,1);assert.deepEqual(bytes,response('1'));
 for(const coin of ['unknown','constructor','__proto__'])await assert.rejects(fetchHistorySource(coin,()=>{throw Error('must not fetch');}),/HISTORY_INVALID/);
 let failures=0;await assert.rejects(fetchHistorySource('rlusd',async()=>{failures++;return new Response('',{status:429});}),/HISTORY_HTTP_FAILED/);assert.equal(failures,1);
 await assert.rejects(fetchHistorySource('rlusd',async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(sourceByteLimit+1));c.close();}}))),/HISTORY_RESPONSE_LIMIT/);
});

test('minted history is a separate metric from the same raw source; absent minted values never borrow circulating values',()=>{
 const bytes=response('10'),raw=parseHistorySource(bytes);raw.chainBalances.Ethereum.tokens[0].minted={peggedUSD:'20'};
 const source=Buffer.from(JSON.stringify(raw)),circulating=historyProjection(source,'rlusd',registry,at),minted=historyProjection(source,'rlusd',registry,at,{metric:'NETWORK_MINTED'});
 assert.equal(minted.sourceHash,circulating.sourceHash);assert.equal(minted.metric,'NETWORK_MINTED');assert.deepEqual(minted.networks.map(n=>[n.networkId,n.points[0].amount]),[['ethereum','20']]);assert.equal(circulating.networks.length,2);assert.equal(validateSupplyHistory([circulating,minted],registry).length,2);
 assert.throws(()=>validateSupplyHistory([minted,minted],registry));assert.throws(()=>historyProjection(source,'rlusd',registry,at,{metric:'OTHER'}));
});
