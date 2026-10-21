import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {collectMarket,collectionEndpoints,readProvider} from '../tools/market-collect.mjs';
import {buildMarket,publishedMarket,withMarketWriter} from '../tools/market-store.mjs';
import {rank,latest,series} from './market-model.js';
const registryPath=new URL('../data/asset-registry.json',import.meta.url);
const secret='test-credential-never-persist';
const makeResponse=endpoint=>new Response(endpoint.includes('/market/')?'{"circulatingSupply":999999999999999999.123456789,"price":1.00001,"account":"omit"}':endpoint.includes('/holders/')?'{"totalSupply":{"ethereum":999999999999999999.123456789,"solana":0},"addressTopHolders":[{"secret":"omit"}]}':'{"ethereum":{"active":true,"tip":12345678,"asOf":{"tip":"2026-10-22T00:00:00.000Z"},"price":999}}');
async function temporary(run){const directory=await mkdtemp(join(tmpdir(),'atlas collect '));try{await run(directory);}finally{await rm(directory,{recursive:true,force:true});}}
const at='2026-10-22T01:00:00.000Z',later='2026-10-22T02:00:00.000Z';
test('collector bounds seven sequential GETs, preserves numeric lexemes and stable history, excludes account data',async()=>temporary(async directory=>{
  const calls=[],waits=[];
  const fetcher=async(url,options)=>{assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers['API-Key'],secret);assert.ok(options.signal);const endpoint=new URL(url).pathname;calls.push(endpoint);return makeResponse(endpoint);};
  const options={directory,registryPath,key:secret,fetcher,wait:async ms=>waits.push(ms),now:()=>at};
  assert.equal((await collectMarket(options)).state,'SUCCESS');assert.deepEqual(calls,collectionEndpoints);assert.deepEqual(waits,Array(6).fill(1000));
  const first=await publishedMarket(directory);assert.equal(rank(first).length,3);assert.equal(rank(first)[0].amount,'999999999999999999.123456789');assert.equal(latest(first,{coinId:'usdc',metric:'PRICE'})[0].amount,'1.00001');assert.equal(first.collectionState.state,'SUCCESS');assert.equal(first.networks[0].tip,'12345678');
  await collectMarket({...options,now:()=>later});const second=await publishedMarket(directory);assert.equal(rank(second).length,3);assert.equal(series(second,rank(second,'usdc')[0]).length,2);
  for(const name of await readdir(join(directory,'collected'))){const raw=await readFile(join(directory,'collected',name),'utf8');for(const forbidden of [secret,'addressTopHolders','account','omit'])assert.ok(!raw.includes(forbidden));}
}));
test('429 stops the batch without retries, keeps exact previous index/time and exposes only bounded status',async()=>temporary(async directory=>{
  const options={directory,registryPath,key:secret,fetcher:async url=>makeResponse(new URL(url).pathname),wait:async()=>{},now:()=>at};
  await collectMarket(options);const before=await publishedMarket(directory),index=await readFile(join(directory,'index.json'),'utf8');let calls=0;
  const result=await collectMarket({...options,now:()=>later,fetcher:async url=>{calls++;return calls===2?new Response('private error '+secret,{status:429,headers:{'Retry-After':'120'}}):makeResponse(new URL(url).pathname);}});
  assert.deepEqual(result,{state:'FAILED',requests:2,published:false,httpStatus:429,retryAfterSeconds:'120'});assert.equal(calls,2);assert.equal(await readFile(join(directory,'index.json'),'utf8'),index);
  const after=await publishedMarket(directory);assert.deepEqual(after.observations,before.observations);assert.equal(after.publishedAt,before.publishedAt);assert.equal(after.collectionState.state,'FAILED');assert.ok(!JSON.stringify(after).includes(secret));assert.equal((await readdir(join(directory,'collected'))).length,1);
}));
test('shared writer excludes builders and collectors without touching status or making requests; errors release the lock',async()=>temporary(async directory=>{
  let calls=0;
  await withMarketWriter(directory,async()=>{
    await assert.rejects(buildMarket({directory,registryPath,sourcePaths:[]}),/MARKET_WRITER_BUSY/);
    await assert.rejects(collectMarket({directory,key:secret,fetcher:async()=>{calls++;}}),/MARKET_WRITER_BUSY/);
  });assert.equal(calls,0);
  await assert.rejects(withMarketWriter(directory,async()=>{throw Error('test');}));
  await withMarketWriter(directory,async()=>{});
}));
test('malformed or oversized responses, missing keys and unsafe Retry-After never publish or leak',async()=>temporary(async directory=>{
  const options={directory,registryPath,key:secret,wait:async()=>{},now:()=>at};
  for(const fetcher of [async()=>new Response('{"circulatingSupply":-1,"price":1}'),async()=>{throw Error(secret);},async()=>new Response('x'.repeat(2*1024*1024+1)),async()=>new Response('x',{status:403,headers:{'Retry-After':secret}})]){
    const result=await collectMarket({...options,fetcher});assert.equal(result.state,'FAILED');assert.equal(result.requests,1);assert.equal(result.retryAfterSeconds,null);assert.ok(!JSON.stringify(result).includes(secret));await assert.rejects(readFile(join(directory,'index.json')));
  }
  const result=await collectMarket({...options,key:''});assert.equal(result.requests,0);assert.equal(result.state,'FAILED');
  await assert.rejects(readProvider('/unapproved',secret,async()=>{throw Error('must not call');}),/INVALID_ENDPOINT/);
}));
test('new collection replaces latest rankings across original selector paths without inventing chart continuity',async()=>temporary(async directory=>{
  const old=join(directory,'old.json');await writeFile(old,JSON.stringify({additionalRequests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:at,data:{circulatingSupply:'42',price:'1'}}]}));
  await buildMarket({directory,registryPath,sourcePaths:[old]});await collectMarket({directory,registryPath,key:secret,fetcher:async url=>makeResponse(new URL(url).pathname),wait:async()=>{},now:()=>later});
  const data=await publishedMarket(directory);assert.equal(rank(data).length,3);assert.equal(series(data,rank(data).find(o=>o.coinId==='usdc')).length,1);assert.equal(latest(data,{coinId:'usdc',metric:'CIRCULATING'}).length,1);assert.equal(rank(data).find(o=>o.coinId==='usdc').amount,'999999999999999999.123456789');
}));
