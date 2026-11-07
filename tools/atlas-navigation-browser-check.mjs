import {spawn} from 'node:child_process';import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const pageUrl=process.env.ATLAS_URL??'http://127.0.0.1:54878/',base=new URL(pageUrl).origin,out=process.env.NAV_CHECK_OUTPUT??'.state/atlas-navigation-check',profile=await mkdtemp(join(tmpdir(),'atlas-flow-browser-'));await mkdir(out,{recursive:true});
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-pipe','--disable-background-networking','--disable-component-update','--disable-sync','--disable-default-apps','--no-first-run',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let id=0,buffer='',session;const pending=new Map(),errors=[],external=[];
function send(method,params={},page=true){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP_TIMEOUT '+method));},20000);pending.set(n,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id:n,method,params,...(page&&session?{sessionId:session}:{})})+'\0');});}
chrome.stdio[4].on('data',bytes=>{buffer+=bytes.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const m=JSON.parse(raw);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url)&&!m.params.request.url.startsWith(base+'/'))external.push(new URL(m.params.request.url).hostname);}});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expr,timeout=10000){for(let i=0;i<timeout/100;i++){if(await evaluate(expr))return;await sleep(100);}throw Error('WAIT_TIMEOUT '+expr);}
async function viewport(width,height){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<761});await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
 const checks=[];
 for(const [w,h]of [[1440,900],[1280,800],[390,844]]){
  await viewport(w,h);
  for(const network of ['ethereum','xrpl','tron','solana','base']){
   await send('Page.navigate',{url:base+'/knowledge/index.html#'+network});await until(`document.querySelector('#network-select')?.value==='${network}'`);await sleep(250);
   assert(await evaluate("document.querySelector('.return-to-atlas').getAttribute('href')==='/'"));
   assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'page overflow');
   assert(await evaluate("(()=>{const r=document.querySelector('.return-to-atlas').getBoundingClientRect();return r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()"),'return link visible');
   await writeFile(`${out}/${w}-${network}.png`,Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await evaluate("document.querySelector('.return-to-atlas').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
   await until("location.pathname==='/'&&!!document.querySelector('.sidebar')");
   assert.equal(await evaluate(`document.querySelector('a[href*="wallet-flow"]')`),null);
   checks.push({w,h,network,return:'PASS'});
  }
 }
 await evaluate(`document.querySelector('a[href*="/knowledge/"]').click()`);await until("!!document.querySelector('#network-select')");
 for(const n of ['xrpl','tron','base'])await evaluate(`{const s=document.querySelector('#network-select');s.value='${n}';s.dispatchEvent(new Event('change'));}`);
 await evaluate("document.querySelector('.return-to-atlas').click()");await until("location.pathname==='/'&&!!document.querySelector('.sidebar')");
 for(const path of ['/wallet-flow/index.html','/wallet-flow/app.mjs','/wallet-flow-data.json'])assert.equal(await evaluate(`fetch('${path}').then(r=>r.status)`),404);
 assert.deepEqual(errors,[]);assert(external.every(h=>h==='static.cloudflareinsights.com'));await writeFile(out+'/verification.json',JSON.stringify({status:'PASS',base,checks,removedRoutes:404,errors,external},null,2));console.log('ATLAS_NAVIGATION_REMOVAL_PASS');
}finally{for(const p of pending.values())clearTimeout(p.timer);chrome.kill();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
