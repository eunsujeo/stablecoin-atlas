import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {databaseMarketReader} from '../tools/market-db/preview.mjs';
import {parsePreviewArguments,startPreviewServer} from '../tools/ui-preview.mjs';
test('DB read cache shares only a successful bounded response, closes clients on failure and never falls back',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'atlas-reader-'));let connections=0,ends=0,reads=0,at=1000,fail=false,release;
  const gate=new Promise(resolve=>release=resolve);
  const reader=databaseMarketReader({marketDirectory:directory,now:()=>at,connect:async()=>{connections++;return{end:async()=>{ends++;}};},read:async()=>{reads++;await gate;if(fail)throw Error('private-database-secret');return{test:'only-db'};}});
  try {
    const a=reader(),b=reader();release();assert.deepEqual(await a,await b);assert.equal(connections,1);assert.equal(ends,1);assert.equal(reads,1);
    await reader();assert.equal(connections,1);at+=299999;await reader();assert.equal(connections,1);at++;fail=true;await assert.rejects(reader(),/private-database-secret/);assert.equal(ends,2);
    // Expired success must not be returned after failure.
    await assert.rejects(reader());assert.equal(connections,3);assert.equal(ends,3);
    const large=databaseMarketReader({marketDirectory:directory,connect:async()=>({end:async()=>{ends++;}}),read:async()=>({x:'x'.repeat(2*1024*1024)})});await assert.rejects(large(),/QUERY_RESPONSE_LIMIT/);assert.equal(ends,4);
    const server=await startPreviewServer(0,{marketDirectory:directory,marketReader:reader});
    try{const url='http://127.0.0.1:'+server.address().port;
      const response=await fetch(url+'/market-data.json');assert.equal(response.status,503);assert.equal(await response.text(),'MARKET_DATA_UNAVAILABLE');
      assert.equal((await fetch(url+'/market-data.json',{headers:{origin:'https://other.invalid'}})).status,403);
      assert.equal((await fetch(url+'/market-data.json',{method:'POST'})).status,405);
    }finally{await new Promise(resolve=>server.close(resolve));}
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('preview DB arguments are explicit, bounded and independent of JSON mode',()=>{
  assert.deepEqual(parsePreviewArguments([]),{port:4173,database:false});
  assert.deepEqual(parsePreviewArguments(['--database','--database-env','reader.env','--port','0']),{port:0,database:true,envFile:'reader.env'});
  for(const args of [['--database-env','reader.env'],['--database','--database'],['--port','65536'],['--database-url','secret'],['--port','-1']])assert.throws(()=>parsePreviewArguments(args));
});
