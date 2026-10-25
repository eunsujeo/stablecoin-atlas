import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {productionConnector} from '../tools/production-database.mjs';
import {databaseMarketReader} from '../tools/market-db/preview.mjs';
import {startPreviewServer} from '../tools/ui-preview.mjs';
import {startProduction} from '../tools/production-web.mjs';

const env={DATABASE_URL:'postgresql://reader:SECRET_CANARY@private.invalid/db?sslmode=verify-full'};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function pool(options={}){
  const clients=[];let verifications=0;
  const connector=productionConnector(env,{limit:1,open:async()=>{
    const client=new EventEmitter();client.closed=0;client.sql=[];
    client.query=async sql=>{client.sql.push(sql);return {rows:[{value:'exact-9007199254740993'}]};};
    client.end=async()=>{client.closed++;};clients.push(client);return client;
  },verify:async c=>{verifications++;await c.query('verify');},...options});
  return {connector,clients,get verifications(){return verifications;}};
}

test('pool reuses bounded sessions, resets session state and revokes old leases before rechecking privileges',async()=>{
  const p=pool(),c=p.connector;
  try{
    const first=await c.connect();await first.query('read');await first.end();await first.end();
    assert.equal(p.clients.length,1);assert.equal(p.clients[0].closed,0);
    assert.deepEqual(p.clients[0].sql.slice(-2),['ROLLBACK','DISCARD ALL']);
    const next=await c.connect();assert.notEqual(first,next);assert.equal(p.verifications,2);
    await assert.rejects(first.query('SECRET_CANARY'),/LEASE_CLOSED/);await first.end();assert.equal(c.active,1);
    assert.equal((await next.query('read')).rows[0].value,'exact-9007199254740993');await next.end();
  }finally{await c.close();}
  assert.equal(p.clients[0].closed,1);assert.equal(c.active,0);
});

test('return waits for in-flight queries and does not hand the physical session to the next waiter',async()=>{
  const p=pool(),c=p.connector,gate=deferred();
  try{
    const first=await c.connect(),raw=p.clients[0],query=raw.query;
    raw.query=async sql=>{if(sql==='slow')await gate.promise;return query(sql);};
    const running=first.query('slow'),returned=first.end();let received=false;
    const queued=c.connect().then(value=>{received=true;return value;});
    await delay(10);assert.equal(received,false);assert.equal(c.active,1);
    gate.resolve();await running;await returned;const next=await queued;await next.end();
    assert.equal(p.clients.length,1);
  }finally{gate.resolve();await c.close();}
});

test('query, COMMIT, ROLLBACK, reset and privilege failures discard sessions; idle errors recover',async()=>{
  for(const fault of ['read','COMMIT','ROLLBACK','DISCARD ALL','verify']){
    let rejectVerification=false;
    const p=pool({verify:async c=>{if(rejectVerification)throw Error('SECRET_CANARY');await c.query('verify');}}),c=p.connector;
    try{
      const first=await c.connect(),raw=p.clients[0],query=raw.query;
      if(fault==='verify'){await first.end();rejectVerification=true;await assert.rejects(c.connect(),e=>e.message==='DATABASE_READER_UNAVAILABLE');rejectVerification=false;}
      else{
        raw.query=async sql=>{if(sql===fault)throw Error('SECRET_CANARY timeout');return query(sql);};
        if(!['ROLLBACK','DISCARD ALL'].includes(fault))await assert.rejects(first.query(fault));
        await first.end();
      }
      assert.equal(raw.closed,1,fault);const next=await c.connect();assert.equal(p.clients.length,2);await next.end();
      p.clients[1].emit('error',Error('SECRET_CANARY idle'));
      const recovered=await c.connect();assert.equal(p.clients.length,3);await recovered.end();
    }finally{await c.close();}
    assert.equal(c.active,0);
  }
});

test('queue timeout removes only its waiter, shutdown rejects pending work and is idempotent',async()=>{
  const p=pool({queueLimit:1,queueTimeout:15}),c=p.connector;
  const first=await c.connect();await assert.rejects(c.connect(),/BUSY/);
  const queued=c.connect();const rejection=assert.rejects(queued,/BUSY/);
  const closed=c.close();await rejection;await closed;await c.close();await first.end();
  assert.equal(p.clients[0].closed,1);assert.equal(c.active,0);await assert.rejects(c.connect(),/BUSY/);
});

test('shutdown during open or verify disposes the new session and releases every slot',async()=>{
  for(const phase of ['open','verify']){
    const gate=deferred(),started=deferred(),raw={closed:0,query:async()=>({rows:[]}),end:async()=>{raw.closed++;}};
    const c=productionConnector(env,{open:async()=>{if(phase==='open'){started.resolve();await gate.promise;}return raw;},verify:async()=>{if(phase==='verify'){started.resolve();await gate.promise;}}});
    const pending=c.connect(),rejection=assert.rejects(pending,/UNAVAILABLE/);await started.promise;
    const closed=c.close();gate.resolve();await rejection;await closed;assert.equal(raw.closed,1);assert.equal(c.active,0);
  }
});

test('idle timeout and maximum lifetime retire sessions without retaining timers or exceeding the pool',async()=>{
  for(const options of [{idleTimeout:10},{maxLifetime:10}]){
    const p=pool(options);try{
      const first=await p.connector.connect();await first.end();await delay(30);assert.equal(p.clients[0].closed,1);
      const next=await p.connector.connect();assert.equal(p.clients.length,2);await next.end();
    }finally{await p.connector.close();}
  }
});

test('web startup failure closes the pool after probing, and failed probes also clean up',async()=>{
  const p=pool(),server=await startPreviewServer(0);
  try{
    const settings={config:{port:server.address().port,hosts:['atlas.example.com'],fxFile:'/unused'},env,commit:'a'.repeat(40)};
    await assert.rejects(startProduction(settings,{connector:p.connector}),e=>e.code==='EADDRINUSE');
    assert.equal(p.clients[0].closed,1);assert.equal(p.connector.active,0);
    let closed=false;
    await assert.rejects(startProduction(settings,{connector:{connect:async()=>{throw Error('probe failed');},close:async()=>{closed=true;}}}));
    assert.equal(closed,true);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await p.connector.close();}
});

test('API timings separate queue/connect/verify/query/response, coalesce refreshes, preserve bytes and never log private input',async()=>{
  const p=pool(),events=[],gate=deferred(),requestsStarted=deferred();let at=0,reads=0,failed=false;
  const market=databaseMarketReader({connect:p.connector.connect,includeLocalStatus:false,now:()=>at,read:async c=>{
    reads++;await gate.promise;await c.query('SELECT SECRET_CANARY');if(failed)throw Error('SECRET_CANARY');
    return {observedAt:'2026-10-25T00:00:00Z',amount:'9007199254740993.000000000000000001'};
  }});
  const server=await startPreviewServer(0,{marketReader:market,activityReader:async()=>{const c=await p.connector.connect();try{await c.query('activity');return {exact:'1'};}finally{await c.end();}},onTiming:e=>events.push(e)});
  let requests=0;server.on('request',req=>{if(req.url==='/market-data.json'&&++requests===2)requestsStarted.resolve();});
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const a=fetch(base+'/market-data.json'),b=fetch(base+'/market-data.json');await requestsStarted.promise;gate.resolve();
    const first=await (await a).text();assert.equal(await (await b).text(),first);assert.equal(reads,1);
    assert.equal(await (await fetch(base+'/market-data.json')).text(),first);assert.equal(reads,1);
    at=300000;failed=true;assert.equal((await fetch(base+'/market-data.json')).status,503);assert.equal(reads,2);
    failed=false;assert.equal(await (await fetch(base+'/market-data.json')).text(),first);assert.equal(reads,3);
    assert.equal((await fetch(base+'/activity-data.json')).status,200);
    assert.equal((await fetch(base+'/market-data.json?secret=SECRET_CANARY')).status,404);
    const miss=events.find(e=>e.cache==='MISS'&&e.status===200);
    for(const key of ['dbWaitMs','dbConnectMs','dbVerifyMs','dbQueryMs','responseMs'])assert(miss[key]>=0,key);
    assert(miss.dbQueryCount>=4);assert(events.some(e=>e.cache==='COALESCED'));assert(events.some(e=>e.cache==='HIT'&&e.dbQueryCount===0));
    assert(events.some(e=>e.route==='/activity-data.json'&&e.dbReused===1));
    assert(!JSON.stringify(events).includes('SECRET_CANARY'));assert(!JSON.stringify(events).includes('private.invalid'));
    assert.equal(p.clients.length,1);
  }finally{gate.resolve();server.closeAllConnections();await new Promise(r=>server.close(r));await p.connector.close();}
});
