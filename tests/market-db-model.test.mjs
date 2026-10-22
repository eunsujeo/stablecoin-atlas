import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {databaseConfig} from '../tools/market-db/connection.mjs';
import {importPlan,instant,sourceInstant,sourceName,digest} from '../tools/market-db/plan.mjs';
import {archiveSources,loadSources} from '../tools/market-db/files.mjs';
import {parseArguments} from '../tools/market-db/cli.mjs';
import {history} from '../tools/market-db/repository.mjs';
const registry=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url)));
const body={observedAt:'2026-10-21T00:00:00.123456Z',requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,data:{price:'1',circulatingSupply:'0',totalSupply:null}},{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,data:{price:'1',circulatingSupply:'0'}}]};
test('DB plan preserves same-time request positions, missing vs zero and legacy evidence without inventing HTTP calls',()=>{
  const p=importPlan(registry,Buffer.from(JSON.stringify(body)));assert.equal(p.units.length,2);assert.equal(p.observationCount,5);
  assert.equal(p.units[0].observedAt,'2026-10-21T00:00:00.123456Z');assert.equal(p.units[0].clock,'REPORT_FALLBACK');
  assert.equal(p.units[0].observations.find(o=>o.metric==='CIRCULATING').amount,'0');assert.equal(p.units[0].observations.find(o=>o.metric==='COIN_TOTAL').state,'MISSING');
  assert.notEqual(p.units[0].position,p.units[1].position);assert.equal(p.units[0].observations[0].legacy.groupId,p.units[1].observations[0].legacy.groupId);
  assert.notEqual(p.units[0].observations[0].legacy.id,p.units[1].observations[0].legacy.id);
  const r=structuredClone(body);r.requests.push({endpoint:'/token/market/usd-coin',state:'FAILED',httpStatus:429});const failed=importPlan(registry,Buffer.from(JSON.stringify(r))).units.at(-1);assert.equal(failed.state,'FAILED');assert.equal(failed.observations.length,0);
  const d=registry.deployments.find(d=>d.id==='usdc-xrpl'),xrpl={kind:'XRPL_GATEWAY_OBLIGATIONS_RESEARCH_NOT_ASSESSMENT',observedAt:body.observedAt,ledgerHash:'A'.repeat(64),ledgerIndex:'9007199254740993',observations:[{status:'OBSERVED',issuer:d.identity.issuer,currency:d.identity.currency,metric:'gateway_balances.obligations',value:'0',ledgerHash:'A'.repeat(64),ledgerIndex:'9007199254740993'}]};
  const u=importPlan(registry,Buffer.from(JSON.stringify(xrpl))).units[0];assert.equal(u.evidenceKind,'IMPORTED_UNIT');assert.equal(u.state,'RECORDED');assert.equal(u.httpStatus,null);assert.equal(u.ledgerIndex,'9007199254740993');assert.equal(u.clock,'REPORT_FALLBACK');
});
test('DB inputs reject Number amounts, unsafe fields and path/CLI expansion; preserve microseconds',async()=>{
  for(const name of ['../.env.local','/tmp/input.json','collected/../input.json','collected/link.json'])assert.throws(()=>sourceName(name));
  const numeric=structuredClone(body);numeric.requests[0].data.price=9007199254740993;assert.throws(()=>importPlan(registry,Buffer.from(JSON.stringify(numeric))));
  const secret={...body,authorization:'synthetic-credential'};assert.throws(()=>importPlan(registry,Buffer.from(JSON.stringify(secret))),/SENSITIVE_INPUT/);
  assert.equal(instant('2026-10-21T00:00:00.123456Z'),'2026-10-21T00:00:00.123456Z');assert.equal(instant('2026-10-21T00:00:00Z'),'2026-10-21T00:00:00.000000Z');assert.throws(()=>instant('2026-02-31T00:00:00Z'));
  assert.deepEqual(sourceInstant('2026-10-21T00:00:00.123456789Z'),{value:'2026-10-21T00:00:00.123456Z',original:'2026-10-21T00:00:00.123456789Z'});
  assert.throws(()=>parseArguments(['init','--database-url','secret']));assert.throws(()=>parseArguments(['history','--series','1']));assert.throws(()=>parseArguments(['import','--source','a','--registry','a','--registry','b']));
  assert.deepEqual(parseArguments(['series','--limit','2']),{command:'series',options:{limit:'2'}});
  const many=structuredClone(registry);many.networks=[];const networkData={};for(let i=0;i<30;i++){many.networks.push({id:'synthetic-'+i,name:'Synthetic '+i,family:'EVM',networkId:String(1000+i),providerKey:'synthetic_'+i});networkData['synthetic_'+i]={active:true,tip:'1'};}many.deployments=[];
  const tooMany={observedAt:body.observedAt,requests:Array.from({length:256},()=>({endpoint:'/networks/status',state:'SUCCESS',httpStatus:200,data:networkData}))};assert.throws(()=>importPlan(many,Buffer.from(JSON.stringify(tooMany))),/OVERSIZE_IMPORT/);
  await assert.rejects(history(null,{series:'1',from:'2026-10-01T00:00:00Z',to:'2026-11-02T00:00:00Z'}),/QUERY_RANGE/);
  await assert.rejects(history(null,{series:'1',from:'2026-10-01T00:00:00.000000Z',to:'2026-11-01T00:00:00.000001Z'}),/QUERY_RANGE/);
});
test('connection config uses explicit credentials, verified remote TLS and rejects TLS/option overrides',()=>{
  const local=databaseConfig('postgresql://synthetic:unused@127.0.0.1:1234/db');assert.equal(local.ssl,false);assert.equal(local.port,1234);
  const remote=databaseConfig('postgresql://synthetic:unused@example.invalid/db?sslmode=require');assert.equal(remote.ssl.rejectUnauthorized,true);
  for(const url of ['postgresql://synthetic:unused@example.invalid/db?sslmode=disable','postgresql://synthetic:unused@example.invalid/db?sslrootcert=/tmp/file','postgresql://synthetic:unused@example.invalid/db?options=anything','postgresql://synthetic@example.invalid/db','http://synthetic:unused@example.invalid/db'])assert.throws(()=>databaseConfig(url));
});
test('private byte archive supports concurrent identical writes and refuses collisions/symlinks/forged paths',async()=>{
  const root=await mkdtemp(join(tmpdir(),'atlas-db-files-'));try{
    const archive=join(root,'archive'),p=importPlan(registry,Buffer.from(JSON.stringify(body)));await Promise.all([archiveSources([p],archive),archiveSources([p],archive)]);
    const path=join(archive,p.hash.slice(0,2),p.hash+'.json');assert.deepEqual(await readFile(path),p.bytes);
    await writeFile(path,'{}');await assert.rejects(archiveSources([p],archive),/ARTIFACT_COLLISION/);
    const alias=join(root,'alias');await symlink(archive,alias);await assert.rejects(archiveSources([p],alias),/DIRECTORY/);
    await assert.rejects(archiveSources([{hash:'../../escape',bytes:Buffer.from('{}')}],archive),/INVALID_ARTIFACT/);
    const reports=join(root,'reports');await mkdir(reports);const registryPath=join(root,'registry.json');await writeFile(registryPath,JSON.stringify(registry));await symlink(path,join(reports,'arkham-api-smoke.json'));
    await assert.rejects(loadSources({reportsDirectory:reports,registryPath,names:['arkham-api-smoke.json']}));
    assert.equal(digest(p.bytes),p.hash);
  }finally{await rm(root,{recursive:true,force:true});}
});
