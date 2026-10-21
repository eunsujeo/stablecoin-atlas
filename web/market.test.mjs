import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {request} from 'node:http';
import {validateRegistry,validateMarket,units,rank,series,latest} from './market-model.js';
import {normalizeSources,buildMarket,publishedMarket} from '../tools/market-store.mjs';
import {startPreviewServer} from '../tools/ui-preview.mjs';
const registry=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url),'utf8'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const at='2026-10-21T01:00:00.000Z';
function source(amount='100000000000000000000.123456789012345678901234567890123456',time=at){const value={observedAt:time,requests:[{state:'SUCCESS',httpStatus:200,endpoint:'/token/holders/usd-coin',data:{totalSupply:{ethereum:amount,solana:'0',unregistered:'999999'}}},{state:'SUCCESS',httpStatus:200,endpoint:'/token/market/usd-coin',data:{circulatingSupply:'900',price:'1',API_KEY:'do-not-publish'}}]};return{value,hash:hash(value)};}
test('registry expansion preserves network identities and rejects duplicate/mismatched identifiers',()=>{
  const r=structuredClone(registry);r.coins.push({id:'newcoin',symbol:'NEW',name:'New coin',pricingId:'newcoin'});r.deployments.push({...r.deployments[0],id:'new-ethereum',coinId:'newcoin',identity:{kind:'CONTRACT',address:'0x'+'1'.repeat(40)}});assert.equal(validateRegistry(r).coins.length,4);
  r.deployments.push({...r.deployments[0],id:'duplicate'});assert.throws(()=>validateRegistry(r));
  const wrong=structuredClone(registry);wrong.deployments[0].networkId='solana';assert.throws(()=>validateRegistry(wrong));
  const secret=structuredClone(registry);secret.token='not-public';assert.throws(()=>validateRegistry(secret));
  const duplicateNetwork=structuredClone(registry);duplicateNetwork.networks.push({...duplicateNetwork.networks[0],id:'another'});assert.throws(()=>validateRegistry(duplicateNetwork));
});
test('decimal precision, explicit zero, missing values and incomparable metrics stay distinct',()=>{
  const s=source(),data=normalizeSources(registry,[s]);const rows=rank(data,'usdc');assert.equal(rows.length,2);assert.equal(rows[1].amount,'0');assert.ok(units(rows[0].amount)>10n**55n);assert.equal(data.omittedSupplyEntries,1);assert.equal(rank(data).length,1);assert.equal(rank(data)[0].amount,'900');assert.equal(latest(data,{coinId:'usdt',metric:'CIRCULATING'}).length,0);assert.ok(!JSON.stringify(data).includes('do-not-publish'));
  const bad=source();bad.value.requests[0].data.totalSupply.ethereum=100;assert.throws(()=>normalizeSources(registry,[bad]));
  const xrpl={kind:'XRPL_GATEWAY_OBLIGATIONS_RESEARCH_NOT_ASSESSMENT',observedAt:at,ledgerHash:'A'.repeat(64),ledgerIndex:'42',observations:[{status:'OBSERVED',issuer:registry.deployments[6].identity.issuer,currency:registry.deployments[6].identity.currency,metric:'gateway_balances.obligations',value:'999999999999999999',ledgerHash:'A'.repeat(64),ledgerIndex:'42'}]};
  const withX=normalizeSources(registry,[s,{value:xrpl,hash:hash(xrpl)}]);assert.equal(rank(withX,'usdc').length,2);assert.equal(latest(withX,{metric:'OBLIGATIONS'}).length,1);assert.equal(latest(withX,{metric:'OBLIGATIONS'})[0].observationClock,'REPORT_FALLBACK');
  xrpl.observations[0].ledgerHash='B'.repeat(64);assert.throws(()=>normalizeSources(registry,[{value:xrpl,hash:hash(xrpl)}]));
});
test('chain ranking uses one comparable request group; repeated import does not invent history',()=>{
  const data=normalizeSources(registry,[source()]);const again=normalizeSources(registry,[source()],data);assert.equal(again.observations.length,data.observations.length);assert.equal(series(again,rank(again,'usdc')[0]).length,1);
  const reassigned=structuredClone(registry);reassigned.deployments[0].identity.address='0x'+'2'.repeat(40);assert.throws(()=>normalizeSources(reassigned,[source()],data));
  const next=source('2','2026-10-21T02:00:00.000Z');delete next.value.requests[0].data.totalSupply.solana;next.hash=hash(next.value);const merged=normalizeSources(registry,[next],again);assert.equal(rank(merged,'usdc').length,1);assert.equal(rank(merged,'usdc')[0].amount,'2');assert.equal(series(merged,rank(merged,'usdc')[0]).length,2);
  const ties=source('0');const tied=rank(normalizeSources(registry,[ties]),'usdc');assert.equal(tied[0].deploymentId,'usdc-ethereum');assert.equal(tied[1].deploymentId,'usdc-solana');
});
test('market publication keeps last good snapshot on failure, verifies hashes, bounds reads and never serves raw inputs',async()=>{
  const root=await mkdtemp(join(tmpdir(),'atlas-market-')),directory=join(root,'store'),registryPath=join(root,'registry.json'),input=join(root,'input.json');
  try{
    await writeFile(registryPath,JSON.stringify(registry));await writeFile(input,JSON.stringify(source().value));
    const opts={registryPath,sourcePaths:[input],directory};await buildMarket(opts);const before=await publishedMarket(directory);assert.equal(before.lastBuildState,'SUCCESS');
    await buildMarket(opts);assert.equal((await publishedMarket(directory)).observations.length,before.observations.length);
    await writeFile(input,'{invalid');await assert.rejects(buildMarket(opts));const after=await publishedMarket(directory);assert.equal(after.lastBuildState,'FAILED');assert.deepEqual(after.observations,before.observations);
    await rm(input);await symlink(registryPath,input);await assert.rejects(buildMarket(opts));await rm(input);
    const server=await startPreviewServer(0,{marketDirectory:directory}),port=server.address().port;
    const read=path=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.end();});
    try{const response=await read('/market-data.json');assert.equal(response.status,200);validateMarket(JSON.parse(response.body));for(const path of ['/market-data.json?path=.env.local','/reports/market-store/index.json','/.env.local','/data/asset-registry.json'])assert.equal((await read(path)).status,404);
      const index=JSON.parse(await readFile(join(directory,'index.json'),'utf8'));await writeFile(join(directory,index.hash+'.json'),'{}');assert.equal((await read('/market-data.json')).status,503);await assert.rejects(publishedMarket(directory));await writeFile(input,JSON.stringify(source().value));await assert.rejects(buildMarket(opts));assert.equal(JSON.parse(await readFile(join(directory,'index.json'),'utf8')).hash,index.hash);
    }finally{server.closeIdleConnections();await new Promise(resolve=>server.close(resolve));}
  }finally{await rm(root,{recursive:true,force:true});}
});
