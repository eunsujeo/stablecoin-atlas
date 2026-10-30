import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {storeFX,storedFXInputs} from '../tools/fx-store.mjs';
import {verifiedFXInput} from '../tools/market-db/fx.mjs';
import {fxArguments} from '../tools/market-db/fx-cli.mjs';
import {databaseFXReader} from '../tools/market-db/fx-preview.mjs';
const at='2026-10-23T01:46:21.297Z';
test('offline FX migration preserves expired original bytes/timestamps and rejects damaged source before DB access',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-fx-migrate-')),mask=process.umask(0o077);
 try{
  const source=join(root,'source.xml'),directory=join(root,'store');
  const raw=Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><gesmes:subject>Reference rates</gesmes:subject><gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender><Cube><Cube time='2026-10-22'><Cube currency='USD' rate='1.23'/><Cube currency='KRW' rate='1500.123456789'/></Cube></Cube></gesmes:Envelope>`);
  await writeFile(source,raw);await storeFX({directory,source,at});
  const snapshot=join(directory,'snapshots','2026-10-23.json'),before=await readFile(snapshot);
  const inputs=await storedFXInputs(directory);assert.equal(inputs.length,1);assert.deepEqual(inputs[0].raw,raw);assert.equal(inputs[0].payload.importedAt,at);assert.equal(inputs[0].payload.date,'2026-10-22');assert.equal(inputs[0].payload.fetchedAt,null);verifiedFXInput(inputs[0].payload,inputs[0].raw);assert.deepEqual(await readFile(snapshot),before);
  await writeFile(join(directory,'archive',inputs[0].payload.sourceHash+'.xml'),'damaged');await assert.rejects(storedFXInputs(directory));
 }finally{process.umask(mask);await rm(root,{recursive:true,force:true});}
});
test('DB FX reader merges concurrent requests, releases failed connections, expires and recovers without a file fallback',async()=>{
 const p={schemaVersion:1,kind:'ECB_REFERENCE_FX',base:'EUR',date:'2026-10-22',usdPerEUR:'1.23',krwPerEUR:'1500',sourceHash:'a'.repeat(64),fetchedAt:null,importedAt:at};
 let opened=0,closed=0,current=Date.parse(at),value=p;
 const reader=databaseFXReader({now:()=>current,connect:async()=>{opened++;return {end:async()=>{closed++;}};},read:async()=>{if(!value)throw Error('SECRET_CANARY');return value;}});
 const result=await Promise.all([reader(),reader()]);assert.deepEqual(result,[p,p]);assert.equal(opened,1);assert.equal(closed,1);
 current=Date.parse('2026-11-01T00:00:00.000Z');await assert.rejects(reader(),/^Error: FX_UNAVAILABLE$/);assert.equal(closed,2);
 current=Date.parse(at)-1;await assert.rejects(reader());value=null;await assert.rejects(reader(),e=>e.message==='FX_UNAVAILABLE');assert.equal(closed,4);
 current=Date.parse(at);value={...p,secret:'SECRET_CANARY'};assert.deepEqual(await reader(),p);assert.equal(closed,5);
});
test('FX DB CLI keeps import/read/init/grant explicit and rejects arbitrary arguments',()=>{
 assert.equal(fxArguments(['import','--directory','source','--env-file','reader.env']).command,'import');
 assert.equal(fxArguments(['stored']).command,'stored');
 for(const args of [[],['collect'],['import'],['grant','--role','anon;bad','--mode','writer'],['init','--force','yes'],['init','--reviewed-definers','file'],['read','--env-file','x','--env-file','y']])assert.throws(()=>fxArguments(args));
});
