import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
// Local-only browser verification. Requires an existing Google Chrome on macOS.
const base = process.argv[2];
await mkdir('.state/agent-logs',{recursive:true});
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('Local URL required');
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
      const call=!request.url.startsWith(base+'/')?send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'}):failEvidence&&request.url.endsWith('/evidence/index.json')?send('Fetch.fulfillRequest',{requestId,responseCode:503,body:Buffer.from('UNAVAILABLE').toString('base64')}):send('Fetch.continueRequest',{requestId});
      fetchWork.add(call);
      call.then(()=>{fetchWork.delete(call);lastNetworkActivity=Date.now();},e=>{fetchWork.delete(call);lastNetworkActivity=Date.now();errors.push(e.message);});
    }
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text);
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

async function until(expression){for(let i=0;i<180;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,60));}throw new Error('Not ready '+expression+' '+await evaluate("document.querySelector('#contract-review-root')?.innerText.slice(0,600)"));}
async function key(key,code,virtual){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,...(key==='Enter'?{text:'\r'}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual});}

try {
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 for(const route of ['/#contracts','/legacy.html#contracts']){
  await send('Page.navigate',{url:base+route});
  await until("document.querySelector('#contract-review-root')?.dataset.contractReview==='multicall3-ethereum-20261026'&&!document.querySelector('#contracts-screen').hidden");
  assert.equal(await evaluate('location.pathname'),'/');
  assert.equal(await evaluate("document.querySelector('[data-screen=contracts]').getAttribute('aria-current')"),'page');
  for(const id of ['overview-screen','evidence-workspace','live-screen','market-screen'])assert.equal(await evaluate(`document.querySelector('#${id}').hidden`),true);
  assert.equal(await evaluate("document.querySelectorAll('[data-contract-section]').length"),11);
  assert((await evaluate("document.querySelector('.contract-heading').textContent")).includes('UNKNOWN'));
  for(const group of ['overview','behavior','risks','evidence']){
   await evaluate(`document.querySelector('#contract-${group}-tab').click()`);
   assert.equal(await evaluate("document.querySelectorAll('.contract-tabpanel:not([hidden])').length"),1);
   assert.equal(await evaluate(`document.querySelector('#contract-${group}-panel').hidden`),false);
  }
  await evaluate("document.querySelector('#contract-behavior-tab').click()");
  assert.equal(await evaluate("document.querySelector('[data-contract-section=functions] tbody').rows.length"),16);
  await evaluate("document.querySelector('#contract-evidence-tab').click()");
  const evidence=await evaluate("document.querySelector('#contract-evidence-panel').innerText");
  for(const value of ['10항목 PASS','NOT_RUN','UNKNOWN','NOT_TESTED','2054218939d3fa0f52f8ce1a33658d570a550671f63197356ee5744f7e188b1e'])assert(evidence.includes(value),value);
  // Roving keyboard focus changes both the active tab and its owned panel.
  await evaluate("document.querySelector('#contract-overview-tab').click();document.querySelector('#contract-overview-tab').focus()");
  await key('ArrowRight','ArrowRight',39);
  assert.equal(await evaluate('document.activeElement.id'),'contract-behavior-tab');
  assert.equal(await evaluate("document.querySelector('#contract-behavior-panel').hidden"),false);
  for(const [query,count]of [['0xca11bde0',1],['Ethereum',1],['missing-report',0],['',1]]){
   await evaluate(`(()=>{const s=document.querySelector('.contract-directory input');s.value=${JSON.stringify(query)};s.dispatchEvent(new Event('input'));})()`);
   assert.equal(await evaluate("document.querySelectorAll('[data-contract-report]').length"),count);
   assert.equal(await evaluate("document.querySelector('#contract-review-root').dataset.contractReview"),'multicall3-ethereum-20261026');
   assert.equal(await evaluate("document.querySelector('.contract-directory > .muted').hidden"),count!==0);
  }
  for(const width of [1440,390]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
   for(const theme of ['dark','light']){
    if(await evaluate('document.documentElement.dataset.theme')!==theme)await evaluate("document.querySelector('#contract-theme').click()");
    assert.equal(await evaluate('document.documentElement.dataset.theme'),theme);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
    for(const group of ['overview','behavior','risks','evidence']){
     await evaluate(`document.querySelector('#contract-${group}-tab').click()`);
     assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
    }
    await evaluate("document.querySelector('#contract-overview-tab').click();window.scrollTo({top:0,behavior:'instant'})");
    if(route==='/#contracts')await screenshot(`contract-dashboard-${theme}-${width}`);
   }
  }
  // Existing navigation and shared theme remain usable.
  await evaluate("document.querySelector('[data-screen=assets]').click()");
  await until("document.querySelector('#assets-screen').hidden===false&&document.querySelector('#contracts-screen').hidden===true");
  await evaluate("document.querySelector('[data-screen=contracts]').click()");
  await until("!document.querySelector('#contracts-screen').hidden");
 }
 // Failure of the unrelated evidence API cannot suppress the reviewed excerpt.
 failEvidence=true;
 await send('Page.reload');
 await until("!document.querySelector('#contracts-screen').hidden&&document.querySelector('#contract-review-root')?.dataset.contractReview==='multicall3-ethereum-20261026'&&!document.querySelector('#evidence-error').hidden");
 await drainFetch();
 assert.deepEqual(errors,[]);
 assert.deepEqual(requests.filter(url=>!url.startsWith(base+'/')&&!url.startsWith('data:')),[]);
 assert.deepEqual(requests.filter(url=>/snapshot|review\.json|\.state|review:contract/.test(url)),[]);
 console.log('PASS contract dashboard: main/legacy navigation, 11 sections/16 functions, tabs/keyboard/search, dark/light/1440px/390px, evidence503 independence, runtimeErrors0/externalRequests0/privateReportRequests0');
}finally{try{await send('Fetch.disable');await send('Browser.close',{},false);}catch{}chrome.kill();await new Promise(resolve=>{if(chrome.exitCode!==null)resolve();else chrome.once('exit',resolve);});await rm(profile,{recursive:true,force:true});}

