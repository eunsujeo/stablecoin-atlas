const safariStreams=true;
import {loopbackRequest} from './loopback-http.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const fixture=await (await import('../tests/production-browser-fixture.mjs')).productionBrowserFixture();fixture.setFXFailed(false);
let limited=false;const apiRequests=[];
const base=fixture?'http://127.0.0.1:'+fixture.server.address().port:process.argv[2],publicHost='atlas.example.com',publicOrigin='https://'+publicHost,responses=[];
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Local origin required');
await mkdir('.state/agent-logs',{recursive:true});
const profile = await mkdtemp(join(tmpdir(), 'atlas-browser-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-pipe', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-default-apps', '--disable-extensions', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
let failEvidence=false,id=0,buffer='',session;const requests=[],errors=[],pending=new Map(),fetchWork=new Set(),networkWork=new Set();
let lastNetworkActivity=Date.now();
chrome.stderr.on('data', () => {});
chrome.stdio[4].on('data', data => {
  buffer += data.toString(); let end;
  while ((end = buffer.indexOf('\0')) !== -1) {
    const raw = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (!raw) continue;
    const value = JSON.parse(raw);
    if (value.id && pending.has(value.id)) { const { resolve, reject, timer } = pending.get(value.id); clearTimeout(timer); pending.delete(value.id); value.error ? reject(new Error(JSON.stringify(value.error))) : resolve(value.result); }
    if(value.sessionId===session&&value.method==='Network.requestWillBeSent'){requests.push(value.params.request.url);networkWork.add(value.params.requestId);lastNetworkActivity=Date.now();}
    if(value.sessionId===session&&['Network.loadingFinished','Network.loadingFailed'].includes(value.method)){networkWork.delete(value.params.requestId);lastNetworkActivity=Date.now();}
    if(value.sessionId===session&&value.method==='Fetch.requestPaused'){
      lastNetworkActivity=Date.now();
      const {requestId,request}=value.params;
      const call=(async()=>{
        const url=new URL(request.url);
        if(url.origin!==publicOrigin){await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return;}
        if(url.pathname==='/cache-test.html'){await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:Buffer.from('<!doctype html><html><body><main><p id=notice></p></main></body></html>').toString('base64')});return;}
        if(url.pathname.endsWith('.json'))apiRequests.push({path:url.pathname,at:Date.now()});
        if(limited&&url.pathname==='/market-data.json'){await send('Fetch.fulfillRequest',{requestId,responseCode:429,responseHeaders:[{name:'Retry-After',value:'120'}],body:Buffer.from('Rate limited').toString('base64')});return;}
        const response=await loopbackRequest({port:Number(new URL(base).port),path:url.pathname+url.search,host:publicHost,origin:request.headers.Origin,timeout:30000});
        responses.push({path:url.pathname,status:response.status});
        const body=response.body;
        await send('Fetch.fulfillRequest',{requestId,responseCode:response.status,responseHeaders:response.headers,body:body.toString('base64')});
      })();
      fetchWork.add(call);
      call.then(()=>{fetchWork.delete(call);lastNetworkActivity=Date.now();},e=>{fetchWork.delete(call);lastNetworkActivity=Date.now();errors.push(e.message);});
    }
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description??value.params.exceptionDetails.text);
  }
});
function rawSend(method, params = {}, page = true) {
  return new Promise((resolve, reject) => { const n = ++id, timer = setTimeout(() => { pending.delete(n); reject(new Error(`CDP timeout ${method}`)); }, 15000); pending.set(n, { resolve, reject, timer }); chrome.stdio[3].write(JSON.stringify({ id: n, method, params, ...(page && session ? { sessionId: session } : {}) }) + '\0'); });
}
async function drainFetch(){
  const deadline=Date.now()+20000;
  do{
    if(Date.now()>=deadline)throw new Error('Fetch drain timeout');
    let timer;
    try{await Promise.race([Promise.allSettled([...fetchWork]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Fetch drain timeout')),deadline-Date.now());})]);}
    finally{clearTimeout(timer);}
    await new Promise(resolve=>setTimeout(resolve,50));
  }while(fetchWork.size||networkWork.size||Date.now()-lastNetworkActivity<150);
}
async function send(method,params={},page=true){
  if(['Page.navigate','Page.reload','Fetch.disable','Browser.close'].includes(method))await drainFetch();
  return rawSend(method,params,page);
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function screenshot(name) { await evaluate('new Promise(resolve => setTimeout(resolve, 250))'); const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(`.state/${name}.png`, Buffer.from(r.data, 'base64')); }

async function until(expression){for(let i=0;i<300;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Browser readiness timeout '+JSON.stringify({errors,responses}));}
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(ReadableStream.prototype,Symbol.asyncIterator,{value:undefined,configurable:true});Object.defineProperty(AbortSignal,'any',{value:undefined,configurable:true});"});
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 const boot=async clock=>{
  await send('Page.navigate',{url:publicOrigin+'/cache-test.html'});
  await until("!!document.querySelector('#notice')");
  await evaluate(`(async()=>{const [{createJSONClient},{createResponseStore},{validateMarket}]=await Promise.all([import('/browser-cache.js'),import('/browser-idb.js'),import('/market-model.js')]);window.clock=${clock};window.store=createResponseStore();window.client=createJSONClient({store,spacingMs:0,now:()=>window.clock});window.options={validate:validateMarket,ttl:300000,label:'시장 자료'};})()`);
  assert.equal(await evaluate('typeof ReadableStream.prototype[Symbol.asyncIterator]'),'undefined');
 };
 const at=Date.now();await boot(at);
 const original=await evaluate("client.read('/market-data.json',options).then(JSON.stringify)");await until('client.stats().pending===0');assert.equal(apiRequests.length,1);
 await evaluate('client.close()');await boot(at+1000);
 assert.equal(await evaluate("client.read('/market-data.json',options).then(JSON.stringify)"),original);assert.equal(apiRequests.length,1,'reload must use actual IndexedDB without another API request');
 limited=true;await evaluate('window.clock+=300001');
 assert.equal(await evaluate("client.read('/market-data.json',options).then(JSON.stringify)"),original);await until('client.stats().pending===0');assert.equal(apiRequests.length,2);
 const deadline=await evaluate('client.stats().cooldown');assert(deadline>at+300001);
 await evaluate("import('/browser-cache-ui.js').then(({cacheStatusText})=>document.querySelector('#notice').textContent=cacheStatusText(client.states()[0]))");
 assert.match(await evaluate("document.querySelector('#notice').textContent"),/429.*마지막 정상 자료.*브라우저 저장/);await screenshot('browser-cache-429-last-good');
 await evaluate('client.close()');await boot(deadline-1);
 assert.equal(await evaluate("client.read('/market-data.json',options).then(JSON.stringify)"),original);
 assert.equal(await evaluate("client.read('/fx-data.json',options).then(()=>0,e=>e.status)"),429);assert.equal(apiRequests.length,2,'origin cooldown must survive reload and block other API types');
 limited=false;await evaluate(`window.clock=${deadline}`);await evaluate("client.read('/market-data.json',options)");await until('client.stats().pending===0');assert.equal(apiRequests.length,3);
 assert.equal(await evaluate("client.read('/market-data.json',options).then(JSON.stringify)"),original,'observation, source and amount strings must remain identical');
 await evaluate("client.close();window.key=JSON.stringify(['/market-data.json','1','same-origin','']);store.get(key).then(e=>{e.text='{\"bad\":true}';return store.put(e);})");
 await boot(deadline+1);assert.equal(await evaluate("client.read('/market-data.json',options).then(JSON.stringify)"),original);await until('client.stats().pending===0');assert.equal(apiRequests.length,4,'corrupt persistent data must be discarded and replaced');
 const quota=await evaluate("(async()=>{client.close();const saved=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='entries')throw new DOMException('quota','QuotaExceededError');return saved.apply(this,args);};try{const {createJSONClient}=await import('/browser-cache.js');const {createResponseStore}=await import('/browser-idb.js');window.client=createJSONClient({store:createResponseStore(),spacingMs:0,now:()=>clock});const options2={...options,context:'quota'};const first=await client.read('/market-data.json',options2);const second=await client.read('/market-data.json',options2);return {same:JSON.stringify(first)===JSON.stringify(second),persistent:client.states()[0].persistent};}finally{IDBObjectStore.prototype.put=saved;}})()");
 assert.equal(quota.same,true);assert.equal(quota.persistent,false);assert.equal(apiRequests.length,5);
 const capacity=await evaluate("(async()=>{client.close();const {createResponseStore}=await import('/browser-idb.js');const store=createResponseStore({maxEntries:2,maxBytes:120000});try{await store.clear();for(let i=0;i<3;i++){const text=JSON.stringify({v:'x'.repeat(50000)});await store.put({key:'cap-'+i,text,bytes:new TextEncoder().encode(text).length,storedAt:i});}return {old:await store.get('cap-0'),last:!!(await store.get('cap-2'))};}finally{store.close();}})()");
 assert.equal(capacity.old,undefined);assert.equal(capacity.last,true);
 await drainFetch();assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(u=>!u.startsWith(publicOrigin+'/')&&!u.startsWith('data:')),[]);
 console.log('PASS actual Chrome IndexedDB with Safari API absence: reload cache/no API, stale immediate, 429 origin cooldown across reload/other URLs, last-good notice, recovery, corruption, quota memory fallback, capacity eviction, unchanged source/time/amount, external requests0. No actual iPhone or operating DB/API changes.');
}finally{try{await send('Fetch.disable');await send('Browser.close',{},false);}catch{}chrome.kill();await new Promise(r=>{if(chrome.exitCode!==null)r();else chrome.once('exit',r);});await rm(profile,{recursive:true,force:true});await fixture.stop();}
