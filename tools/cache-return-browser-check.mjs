import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const pageUrl='http://127.0.0.1:54881/',base=new URL(pageUrl).origin,out='.state/cache-return-browser',profile=await mkdtemp(join(tmpdir(),'atlas-flow-browser-'));await mkdir(out,{recursive:true});
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-pipe','--disable-background-networking','--disable-component-update','--disable-sync','--disable-default-apps','--no-first-run',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let id=0,buffer='',session;const pending=new Map(),errors=[],external=[];
function send(method,params={},page=true){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP_TIMEOUT '+method));},20000);pending.set(n,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id:n,method,params,...(page&&session?{sessionId:session}:{})})+'\0');});}
chrome.stdio[4].on('data',bytes=>{buffer+=bytes.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const m=JSON.parse(raw);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url)&&!m.params.request.url.startsWith(base+'/'))external.push(new URL(m.params.request.url).hostname);}});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expr,timeout=10000){for(let i=0;i<timeout/100;i++){if(await evaluate(expr))return;await sleep(100);}throw Error('WAIT_TIMEOUT '+expr);}
async function viewport(width,height){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<761});await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
let mode='seed',held=[],counts=new Map();
const proxy=createServer(async(req,res)=>{
 try{
  const isJSON=req.url.includes('.json');if(isJSON)counts.set(req.url,(counts.get(req.url)??0)+1);
  if(isJSON&&mode==='hold')await new Promise(r=>held.push(r));
  if(isJSON&&mode==='offline'){res.writeHead(503,{'Content-Type':'text/plain'});res.end('TEST_OFFLINE');return;}
  const response=await fetch('http://127.0.0.1:54879'+req.url);let body=Buffer.from(await response.arrayBuffer());
  // Isolated browser fixture only: deliberately recognizable old prices, never production data.
  if(mode==='seed'&&['/market-data.json','/registration-index.json'].includes(req.url)){
   const p=JSON.parse(body);for(const r of p.observations??[])if(r.metric==='PRICE')r.amount='7777';for(const c of p.coins??[])if(c.market?.price)c.market.price.amount='7777';body=Buffer.from(JSON.stringify(p));
  }
  res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')??'text/plain','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(502);res.end();}
});await new Promise(r=>proxy.listen(54881,'127.0.0.1',r));
async function ageCache(){return evaluate(`(async()=>{
 const {cacheDigest}=await import('/browser-cache.js');
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('stablecoin-atlas-response-cache-v1');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
 const rows=await new Promise((resolve,reject)=>{const q=db.transaction('entries').objectStore('entries').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
 for(const e of rows){e.storedAt-=8*86400000;e.digest=await cacheDigest(JSON.stringify([e.schema,e.key,e.url,e.version,e.storedAt,e.bytes])+'\\n'+e.text);}
 await new Promise((resolve,reject)=>{const t=db.transaction('entries','readwrite');for(const e of rows)t.objectStore('entries').put(e);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});db.close();return rows.length;
})()`);}
async function loaded(){await until("document.querySelector('#overview-market-rows')?.querySelectorAll('th').length>0&&!document.querySelector('#overview-reload')?.disabled",30000);}
async function shot(name){await writeFile(out+'/'+name+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));}
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;await send('Runtime.enable');await send('Page.enable');await send('Network.enable');const checks=[];
 for(const [w,h]of [[1440,900],[390,844]]){
  await send('Page.navigate',{url:'about:blank'});await viewport(w,h);await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'all'});mode='seed';
  await send('Page.navigate',{url:base+'/?currency=USD#overview'});await loaded();assert(await evaluate("document.querySelector('#overview-market-rows').innerText.includes('7,777')"));assert(await ageCache()>0);
  mode='hold';held=[];await send('Page.reload',{ignoreCache:true});
  for(let i=0;i<100&&!held.length;i++)await sleep(100);assert(held.length>0);await sleep(350);
  assert(!await evaluate("document.querySelector('#overview-market-rows').innerText.includes('7,777')"),'expired data must not flash before network completes');assert(await evaluate("document.querySelector('#overview-reload').disabled"));await shot(w+'-checking');
  mode='fresh';for(const release of held.splice(0))release();await loaded();assert(!await evaluate("document.querySelector('#overview-market-rows').innerText.includes('7,777')"));
  await evaluate("window.scrollTo({top:document.querySelector('.overview-market-table-panel').getBoundingClientRect().top+scrollY-24,behavior:'instant'})");await shot(w+'-fresh');
  let before=counts.get('/market-data.json');await evaluate("document.querySelector('#overview-reload').click()");await sleep(400);await loaded();assert.equal(counts.get('/market-data.json'),before+1,'manual reload bypasses TTL exactly once');
  before=counts.get('/market-data.json');await evaluate("window.realNow=Date.now;Date.now=()=>window.realNow()+61000;window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));");await sleep(400);await loaded();assert.equal(counts.get('/market-data.json'),before+1,'resume events merge to one request');await evaluate('Date.now=window.realNow');
  assert(await ageCache()>0);mode='offline';before=counts.get('/market-data.json');await send('Page.reload',{ignoreCache:true});await sleep(400);await loaded();
  assert(await evaluate("[...document.querySelectorAll('.browser-cache-status')].some(e=>!e.hidden&&e.textContent.includes('갱신 실패')&&e.textContent.includes('마지막 정상 자료'))"));await sleep(500);assert.equal(counts.get('/market-data.json'),before+1,'no automatic retry after last-good fallback');await evaluate("window.scrollTo({top:0,behavior:'instant'})");await shot(w+'-offline');
  checks.push({w,h,expiredFlash:false,manualRefresh:'PASS',resumeDedup:'PASS',offlineLastGood:'PASS',automaticRetries:0});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await writeFile(out+'/verification.json',JSON.stringify({state:'PASS',checks,errors,external},null,2));console.log('CACHE_RETURN_BROWSER_PASS');
}finally{mode='offline';for(const release of held)release();proxy.closeAllConnections();await new Promise(r=>proxy.close(r));for(const p of pending.values())clearTimeout(p.timer);chrome.kill();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
