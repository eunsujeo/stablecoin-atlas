import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const pageUrl='http://127.0.0.1:54880/',base=new URL(pageUrl).origin,out='.state/yahoo-fx-browser',profile=await mkdtemp(join(tmpdir(),'atlas-flow-browser-'));await mkdir(out,{recursive:true});
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-pipe','--disable-background-networking','--disable-component-update','--disable-sync','--disable-default-apps','--no-first-run',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let id=0,buffer='',session;const pending=new Map(),errors=[],external=[];
function send(method,params={},page=true){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP_TIMEOUT '+method));},20000);pending.set(n,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id:n,method,params,...(page&&session?{sessionId:session}:{})})+'\0');});}
chrome.stdio[4].on('data',bytes=>{buffer+=bytes.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const m=JSON.parse(raw);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url)&&!m.params.request.url.startsWith(base+'/'))external.push(new URL(m.params.request.url).hostname);}});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expr,timeout=10000){for(let i=0;i<timeout/100;i++){if(await evaluate(expr))return;await sleep(100);}throw Error('WAIT_TIMEOUT '+expr);}
async function viewport(width,height){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<761});await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
let mode='fresh';
const fresh=JSON.parse(await readFile('.state/yahoo-fx-store/yahoo-fx.json','utf8'));
const stale={...fresh,date:'2026-10-01',observedAt:'2026-10-01T10:00:00.000Z',fetchedAt:'2026-10-01T11:00:00.000Z'};
// Stale/unavailable are deliberate test fixtures; market/registration responses use the real local DB reader.
const proxy=createServer(async(req,res)=>{
 try{
  if(req.url==='/fx-data.json'&&mode!=='fresh'){res.writeHead(mode==='missing'?503:200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(mode==='missing'?'FX_UNAVAILABLE':JSON.stringify(stale));return;}
  const r=await fetch('http://127.0.0.1:54879'+req.url);res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')??'text/plain','Cache-Control':'no-store'});res.end(Buffer.from(await r.arrayBuffer()));
 }catch{res.writeHead(502);res.end();}
});await new Promise(r=>proxy.listen(54880,'127.0.0.1',r));
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
 const checks=[];
 for(const [w,h]of [[1440,900],[390,844]]){
  await viewport(w,h);
  for(mode of ['fresh','stale','missing']){
   await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'all'});
   await send('Page.navigate',{url:base+'/?currency=KRW#overview'});
   await until("document.querySelector('#overview-market-rows')?.children.length>0&&!document.querySelector('#overview-reload')?.disabled",30000);
   assert(await evaluate("document.querySelector('#overview-price-currency').checkVisibility()"),'currency control must be visible');
   const snapshot=await evaluate("({note:document.querySelector('#overview-fx-note').textContent,label:document.querySelector('#overview-market-price-label').textContent,prices:document.querySelector('#overview-market-rows').innerText,error:document.querySelector('#overview-error').textContent})");
   if(mode==='fresh'){assert.match(snapshot.note,/Yahoo Finance/);assert(snapshot.prices.includes('₩'));}
   if(mode==='stale'){assert.match(snapshot.note,/갱신 지연.*마지막 정상/);assert(snapshot.prices.includes('₩'));}
   if(mode==='missing'){assert.match(snapshot.note,/달러 가격 표시/);assert.match(snapshot.label,/USD/);assert(snapshot.prices.includes('$'));assert(!snapshot.error.includes('환율'));}
   await evaluate("window.scrollTo({top:document.querySelector('.overview-market-table-panel').getBoundingClientRect().top+scrollY-24,behavior:'instant'})");await sleep(500);
   assert(await evaluate("(()=>{const r=document.querySelector('#overview-price-currency').getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight})()"));
   await writeFile(`${out}/${w}-${mode}.png`,Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   checks.push({w,h,mode,note:snapshot.note,label:snapshot.label});
   await evaluate("{const s=document.querySelector('#overview-price-currency');s.value='USD';s.dispatchEvent(new Event('change'));}");
   assert.match(await evaluate("document.querySelector('#overview-market-price-label').textContent"),/USD/);
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await writeFile(out+'/verification.json',JSON.stringify({state:'PASS',checks,errors,external},null,2));console.log('YAHOO_FX_BROWSER_PASS');
}finally{proxy.closeAllConnections();await new Promise(r=>proxy.close(r));for(const p of pending.values())clearTimeout(p.timer);chrome.kill();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
