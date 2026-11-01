// Development candidates: unchanged data, in-place switching and full-page rendering.
import {spawn} from 'node:child_process';import {mkdtemp,rm,writeFile,readFile,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:54873',development=!process.argv.includes('--production');
import {productionDocument} from './production-policy.mjs';
const productionHTML=productionDocument(await readFile('web/index.html')).toString('base64');
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('LOCAL_ONLY');
const snapshots=new Map();let failing=false,refreshMode='normal';
const profile=await mkdtemp(join(tmpdir(),'atlas-design-'));
const chrome=spawn(process.env.ATLAS_CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-pipe','--disable-background-networking','--disable-component-update','--disable-sync','--disable-default-apps','--disable-extensions','--no-first-run',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let id=0,buffer='',session;
const pending=new Map(),errors=[],requests=[],responses=[];
function send(method,params={},page=true){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP_TIMEOUT'));},20000);pending.set(n,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id:n,method,params,...(page&&session?{sessionId:session}:{})})+'\0');});}
async function continueRequest(p){
 try{
  const url=new URL(p.request.url);if(url.origin!==base){await send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'});return;}
  if(!development&&(url.pathname==='/'||url.pathname==='/index.html')){await send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:productionHTML});return;}
  if(url.pathname.endsWith('.json')){
   if(failing&&['/market-data.json','/registration-index.json','/network-usage-data.json','/asset-review-data.json'].includes(url.pathname)){await send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:503,body:Buffer.from('UNAVAILABLE').toString('base64')});return;}
   if(url.pathname==='/market-data.json'&&refreshMode!=='normal'){
    await new Promise(r=>setTimeout(r,2500));
    if(refreshMode==='limited'){await send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:429,responseHeaders:[{name:'Retry-After',value:'60'}],body:Buffer.from('LIMITED').toString('base64')});return;}
   }
   const key=url.pathname+url.search;
   if(!snapshots.has(key))snapshots.set(key,(async()=>{const r=await fetch(base+key,{signal:AbortSignal.timeout(20000)});return {responseCode:r.status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(await r.arrayBuffer()).toString('base64')};})());
   await send('Fetch.fulfillRequest',{requestId:p.requestId,...await snapshots.get(key)});return;
  }
  await send('Fetch.continueRequest',{requestId:p.requestId});
 }catch{errors.push('INTERCEPTION_FAILED');await send('Fetch.failRequest',{requestId:p.requestId,errorReason:'Failed'}).catch(()=>{});}
}
chrome.stdio[4].on('data',bytes=>{
 buffer+=bytes.toString();let end;
 while((end=buffer.indexOf('\0'))!==-1){
  const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;
  const m=JSON.parse(raw);
  if(m.id&&pending.has(m.id)){
   const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);
   m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);
  }
  if(m.method==='Runtime.exceptionThrown')errors.push('JS_EXCEPTION');
  if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);
  if(m.method==='Network.responseReceived')responses.push({url:m.params.response.url,status:m.params.response.status});
  if(m.method==='Fetch.requestPaused')continueRequest(m.params);
 }
});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error('EVALUATION_FAILED');return r.result.value;}
const out='docs/design/compact-refresh';
await mkdir(out,{recursive:true});
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,400));}throw Error('WAIT_TIMEOUT: '+expression);}
async function shot(name){await until("document.readyState==='complete'");await evaluate('document.fonts.ready.then(()=>true)');await new Promise(r=>setTimeout(r,200));const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(out+'/'+name+'.png',Buffer.from(r.data,'base64'));}
async function click(selector){await until(`!!document.querySelector(${JSON.stringify(selector)})`);await new Promise(r=>setTimeout(r,100));const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});}
async function key(key,code=key){const windowsVirtualKeyCode={Enter:13,Escape:27,Tab:9}[key];await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});}
async function viewport(width,height=1100){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<901});await new Promise(r=>setTimeout(r,180));}
async function layout(label){const r=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,navCurrent:document.querySelectorAll('.sidebar a[aria-current="page"]').length,busy:document.querySelector('#overview-supply').getAttribute('aria-busy'),mode:document.documentElement.dataset.deployment??'development'})`);assert(r.scroll<=r.width+1,label+': overflow '+JSON.stringify(r));assert(r.navCurrent<=1);assert.equal(r.mode,development?'development':'production');console.log(label+' '+JSON.stringify(r));}
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 for(const method of ['Runtime.enable','Page.enable','Network.enable'])await send(method);
 await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await viewport(1440,900);await send('Page.navigate',{url:base+'/#overview'});
 await until("document.querySelectorAll('.overview-summary-card').length===2&&document.querySelector('#overview-supply')?.getAttribute('aria-busy')==='false'");
 await evaluate("(async()=>{window.cacheModule=await import('/browser-data.js');return true})()");
 const update="cacheModule.browserData.read('/market-data.json',{...cacheModule.apiRequestPolicy('/market-data.json'),ttl:1,version:'atlas-json-v1'}).catch(()=>null)";
 await new Promise(r=>setTimeout(r,20));
 const before=await evaluate("document.querySelector('#overview-supply').getBoundingClientRect().top");
 refreshMode='slow';await evaluate(update);
 await until("document.querySelector('#overview-screen .browser-cache-compact[data-cache-for=overview-screen]')?.dataset.state==='progress'");
 assert.equal(await evaluate("document.querySelector('#overview-supply').getBoundingClientRect().top"),before);
 assert.equal(await evaluate("document.querySelector('#overview-screen').previousElementSibling.hidden"),true);
 await shot('refresh-desktop');
 await viewport(390);await shot('refresh-mobile');
 await until("!cacheModule.browserData.states().some(r=>r.state==='refreshing')");
 assert.equal(await evaluate("document.querySelector('#overview-screen .browser-cache-compact[data-cache-for=overview-screen]').hidden"),true);
 await viewport(1440,900);await click('#overview-theme');refreshMode='limited';await evaluate(update);
 await until("cacheModule.browserData.states().some(r=>r.state==='rate-limited')");
 assert.equal(await evaluate("document.querySelector('#overview-screen').previousElementSibling.hidden"),false);
 assert.match(await evaluate("document.querySelector('#overview-screen').previousElementSibling.textContent"),/요청 제한.*마지막 정상 자료.*이후 다시 조회 가능/);
 assert.equal(await evaluate("document.querySelector('#overview-screen .browser-cache-compact[data-cache-for=overview-screen]').hidden"),true);
 await shot('rate-limited');assert.equal(errors.length,0);
 console.log('PASS: cached refresh without layout shift, mobile indicator, completion clears, 429 remains visible, JS errors 0');
}finally{for(const p of pending.values())clearTimeout(p.timer);pending.clear();chrome.kill();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
