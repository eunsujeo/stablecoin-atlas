// Render against a loopback preview. Uses installed Chrome; no browser/library downloads.
// HTML transformation exercises the production UI, not production HTTP security policy.
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const base=process.argv[2];
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base??''))throw Error('LOCAL_PREVIEW_REQUIRED');
const development=process.argv.includes('--development');
import assert from 'node:assert/strict';
import {productionDocument} from './production-policy.mjs';
const productionHTML=productionDocument(await readFile('web/index.html')).toString('base64');
let failure=false,holdInitial=false;
const held=[];
const isDocument=url=>url.startsWith(base+'/')&&new URL(url).pathname==='/';
const profile=await mkdtemp(join(tmpdir(),'atlas-design-'));
const chrome=spawn(process.env.ATLAS_CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-pipe','--disable-background-networking','--disable-component-update','--disable-sync','--disable-default-apps','--disable-extensions','--no-first-run',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let id=0,buffer='',session;
const pending=new Map(),errors=[],requests=[],responses=[];
function send(method,params={},page=true){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP_TIMEOUT'));},20000);pending.set(n,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id:n,method,params,...(page&&session?{sessionId:session}:{})})+'\0');});}
function continueRequest(p){
 const local=p.request.url.startsWith(base+'/');
 const data=/\/(?:registration-index|market-data|network-usage-data)\.json/.test(p.request.url);
 if(holdInitial&&data){held.push(p.requestId);return;}
 let method='Fetch.continueRequest',params={requestId:p.requestId};
 if(!development&&isDocument(p.request.url)){
  method='Fetch.fulfillRequest';params={...params,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:productionHTML};
 }else if(failure&&data){
  method='Fetch.fulfillRequest';params={...params,responseCode:503,body:Buffer.from('UNAVAILABLE').toString('base64')};
 }else if(!local){method='Fetch.failRequest';params.errorReason='BlockedByClient';}
 send(method,params).catch(()=>errors.push('INTERCEPTION_FAILED'));
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
const out=process.env.ATLAS_DESIGN_SCREENSHOTS??'.state/design-review';
await mkdir(out,{recursive:true});
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,400));}throw Error('WAIT_TIMEOUT: '+expression);}
async function shot(name){await until("document.readyState==='complete'");await evaluate('document.fonts.ready.then(()=>true)');await new Promise(r=>setTimeout(r,200));const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(out+'/'+name+'.png',Buffer.from(r.data,'base64'));}
async function click(selector){await until(`!!document.querySelector(${JSON.stringify(selector)})`);await new Promise(r=>setTimeout(r,100));const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});}
async function key(key,code=key){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code});}
async function viewport(width,height=1100){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<901});await new Promise(r=>setTimeout(r,180));}
async function layout(label){const r=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,navCurrent:document.querySelectorAll('.sidebar a[aria-current="page"]').length,busy:document.querySelector('#overview-supply').getAttribute('aria-busy'),mode:document.documentElement.dataset.deployment??'development'})`);assert(r.scroll<=r.width+1,label+': overflow '+JSON.stringify(r));assert(r.navCurrent<=1);assert.equal(r.mode,development?'development':'production');console.log(label+' '+JSON.stringify(r));}
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 for(const method of ['Runtime.enable','Page.enable','Network.enable'])await send(method);
 await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await viewport(1600);
 await send('Page.navigate',{url:base+'/#overview'});
 await until("document.querySelectorAll('.overview-metric-row svg').length>=2 && document.querySelector('#overview-supply')?.getAttribute('aria-busy')==='false'");
 assert.equal(await evaluate("document.documentElement.dataset.deployment??'development'"),development?'development':'production');
 await shot('overview-desktop-dark');await layout('overview-1600');
 await click('#sidebar-toggle');assert.equal(await evaluate("document.querySelector('#sidebar-toggle').getAttribute('aria-expanded')"),'false');await shot('overview-desktop-collapsed');await layout('collapsed-1600');await send('Page.reload');await until("document.querySelector('#sidebar-toggle')?.getAttribute('aria-expanded')==='false' && document.querySelector('#overview-supply')?.getAttribute('aria-busy')==='false'");await click('#sidebar-toggle');
 await click('#overview-theme');await until("document.documentElement.dataset.theme==='light'");await shot('overview-desktop-light');await click('#overview-theme');
 await evaluate("document.querySelector('#overview-technical').scrollIntoView({block:'start',behavior:'instant'})");await shot('technical-desktop');
 await send('Page.navigate',{url:base+'/#assets'});await evaluate("scrollTo(0,0)");await until("document.querySelectorAll('.source-review-results tbody tr').length>3");await shot('assets-desktop-dark');await layout('assets-1600');
 await click('.source-review-search input');await send('Input.insertText',{text:'RLUSD'});await until("document.querySelectorAll('.source-review-match').length===2");await shot('assets-search');await click('.source-review-match');await until("document.querySelector('.source-review-toolbar p').textContent.includes('RLUSD')");await shot('assets-selected');
 await evaluate("document.querySelector('.source-review-search input').value='';document.querySelector('.source-review-search input').dispatchEvent(new Event('input',{bubbles:true}))");
 await click('#evidence-theme');await shot('assets-desktop-light');await click('#evidence-theme');
 await send('Page.navigate',{url:base+'/#live'});await until("document.querySelectorAll('#live-ranking .market-rank-row').length>0 && document.querySelector('#live-screen').getAttribute('aria-busy')==='false'");await evaluate("scrollTo(0,0)");await shot('market-desktop-dark');await layout('market-1600');
 for(const width of [1280,900,768,390,360]){
  await viewport(width,1000);await send('Page.navigate',{url:base+'/#overview'});await evaluate("scrollTo(0,0)");await until("document.querySelector('.overview-metric-row svg')&&!document.querySelector('#overview-screen').hidden");await layout('overview-'+width);
  if(width===390){await shot('overview-mobile-dark');await click('#mobile-nav-toggle');assert.equal(await evaluate("document.querySelector('#mobile-nav-toggle').getAttribute('aria-expanded')"),'true');await shot('navigation-mobile');await key('Escape');assert.equal(await evaluate("document.activeElement.id"),'mobile-nav-toggle');await click('#mobile-nav-toggle');await click('[data-screen=assets]');await until("!document.querySelector('#assets-screen').hidden");assert.equal(await evaluate("document.querySelector('#mobile-nav-toggle').getAttribute('aria-expanded')"),'false');await layout('assets-mobile');await shot('assets-mobile-dark');await click('#evidence-theme');await shot('assets-mobile-light');await click('#evidence-theme');await send('Page.navigate',{url:base+'/#live'});await until("!document.querySelector('#live-screen').hidden && document.querySelector('#live-screen').getAttribute('aria-busy')==='false'");await evaluate("scrollTo(0,0)");await layout('market-mobile');await until("Math.abs(document.querySelector('#live-trend svg').viewBox.baseVal.width-document.querySelector('#live-trend').clientWidth)<2");await shot('market-mobile-dark');await send('Page.navigate',{url:base+'/#overview'});await evaluate("scrollTo(0,0)");await click('#overview-theme');await shot('overview-mobile-light');await click('#overview-theme');}
 }
 await send('Page.navigate',{url:base+'/#live'});await until("!document.querySelector('#live-screen').hidden");await layout('market-360');
 await viewport(1600);await send('Page.navigate',{url:base+'/#overview'});await evaluate("scrollTo(0,0)");
 await until("document.querySelector('#overview-supply')?.getAttribute('aria-busy')==='false' && !!document.querySelector('.metric-help-button')");await click('.metric-help-button');assert.equal(await evaluate("document.querySelector('.metric-help-button').getAttribute('aria-expanded')"),'true');await shot('metric-popover');await key('Escape');assert.equal(await evaluate("document.querySelector('.metric-help-button').getAttribute('aria-expanded')"),'false');
 // Actual keyboard Tab traversal from the document, including visible skip and nav focus.
 await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+'/#overview'});await until("document.querySelector('#sidebar-toggle')");await key('Tab');await shot('keyboard-focus');assert.equal(await evaluate("document.activeElement.className"),'skip-link');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await evaluate("getComputedStyle(document.documentElement).scrollBehavior"),'auto');
 const contrast=await evaluate(`(()=>{const s=getComputedStyle(document.documentElement);const luminance=c=>{const a=c.trim().slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;};const bg=luminance(s.getPropertyValue('--panel'));return ['--ink','--muted','--purple'].map(k=>{const c=luminance(s.getPropertyValue(k));return {token:k,ratio:(Math.max(c,bg)+.05)/(Math.min(c,bg)+.05)};});})()`);for(const row of contrast)assert(row.ratio>=4.5);
 const summaries=await evaluate("[...document.querySelectorAll('.summary-value')].map(e=>e.textContent)");
 assert(summaries.length>=2);
 // A fresh origin storage state prevents the error case from borrowing last-good data.
 holdInitial=true;await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'all'});await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+'/#overview'});await until("document.querySelector('#overview-supply')?.getAttribute('aria-busy')==='true' && !!document.querySelector('.loading-skeleton')");await shot('overview-loading');failure=true;holdInitial=false;for(const requestId of held.splice(0))await send('Fetch.fulfillRequest',{requestId,responseCode:503,body:Buffer.from('UNAVAILABLE').toString('base64')});await until("document.querySelector('#overview-supply')?.getAttribute('aria-busy')==='false'");await shot('overview-unavailable');await layout('error-1600');assert.equal(await evaluate("getComputedStyle(document.querySelector('.sidebar')).display"),'flex');assert.equal(await evaluate("document.querySelector('#overview-error').hidden"),false);
 assert.equal(errors.length,0,JSON.stringify(errors));const external=requests.filter(u=>/^https?:/.test(u)&&!u.startsWith(base+'/'));assert.equal(external.length,0);console.log(JSON.stringify({state:'PASS',jsErrors:errors.length,externalRequests:external.length,summaries,APIs:responses.filter(x=>x.url.endsWith('.json')).map(x=>({path:new URL(x.url).pathname,status:x.status}))}));
}finally{for(const p of pending.values())clearTimeout(p.timer);pending.clear();chrome.kill();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));await rm(profile,{recursive:true,force:true});}
