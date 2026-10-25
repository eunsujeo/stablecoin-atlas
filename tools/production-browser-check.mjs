import {loopbackRequest} from './loopback-http.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const fxIsolation=process.argv[2]==='--fx-isolation';
const fixture=fxIsolation?await (await import('../tests/production-browser-fixture.mjs')).productionBrowserFixture():null;
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
        const response=await loopbackRequest({port:Number(new URL(base).port),path:url.pathname+url.search,host:publicHost,origin:request.headers.Origin,timeout:30000});
        responses.push({path:url.pathname,status:response.status});
        const body=response.body;
        await send('Fetch.fulfillRequest',{requestId,responseCode:response.status,responseHeaders:response.headers,body:body.toString('base64')});
      })();
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

async function until(expression){for(let i=0;i<300;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Browser readiness timeout '+JSON.stringify({errors,responses}));}
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Page.navigate',{url:publicOrigin+'/#overview'});
 await until("document.querySelectorAll('#overview-source-rows article').length===5&&!document.querySelector('#overview-reload').disabled");
 assert.equal(await evaluate("document.documentElement.dataset.deployment"),'production');
 assert.equal(await evaluate("document.querySelectorAll('#market-screen,#reports-screen,#overview-read-history,#overview-geography,.overview-read-grade').length"),0);
 assert.equal(await evaluate("document.querySelector('#overview-screen').hidden"),false);
 if(fxIsolation){
  for(const path of ['/market-data.json','/registration-index.json','/activity-data.json','/reviewed-supply-data.json','/survey-data.json'])assert(responses.some(r=>r.path===path&&r.status===200),path);
  assert(responses.some(r=>r.path==='/fx-data.json'&&r.status===503));
  assert.match(await evaluate("document.querySelector('#overview-error').textContent"),/참고 환율\(FX\)/);
  assert.equal(await evaluate("document.querySelector('#overview-error').hidden"),false);
  assert.match(await evaluate("document.querySelector('#overview-market-rows').textContent"),/\$1/);
  await evaluate("document.querySelector('#overview-price-currency').value='KRW';document.querySelector('#overview-price-currency').dispatchEvent(new Event('change'))");
  assert.match(await evaluate("document.querySelector('#overview-fx-note').textContent"),/미확보/);
  fixture.setFXFailed(false);
  await evaluate("document.querySelector('#overview-reload').click()");await until("!document.querySelector('#overview-reload').disabled");
  assert.equal(await evaluate("document.querySelector('#overview-error').hidden"),true);
  assert.match(await evaluate("document.querySelector('#overview-market-rows').textContent"),/₩1,000/);
  fixture.setFXFailed(true);
  await evaluate("document.querySelector('#overview-reload').click()");await until("!document.querySelector('#overview-reload').disabled");
  assert.match(await evaluate("document.querySelector('#overview-market-rows').textContent"),/₩1,000/);
  // A caught renderer exception has a different message from an endpoint failure.
  await evaluate("window.savedRows=document.querySelector('#overview-market-rows');window.savedRowsParent=window.savedRows.parentNode;window.savedRows.remove();document.querySelector('#overview-reload').click()");
  await until("!document.querySelector('#overview-reload').disabled");
  assert.match(await evaluate("document.querySelector('#overview-error').textContent"),/화면 표시 중 오류/);
  await evaluate("window.savedRowsParent.append(window.savedRows)");
 }
 await evaluate("location.hash='#assets'");await until("document.querySelector('#assets-screen')?.hidden===false&&document.querySelector('[data-source-review]')?.dataset.reviewId==='usdc-ethereum'");
 assert.equal(await evaluate("document.querySelectorAll('.source-review-asset').length"),5);
 for(const theme of ['dark','light'])for(const width of [1440,390]){
  await evaluate(`document.documentElement.dataset.theme='${theme}'`);await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));await screenshot('production-profile-'+theme+'-'+width);
 }
 await evaluate("location.hash='#reports'");await until("document.querySelector('#overview-screen').hidden===false");
 await drainFetch();
 assert(responses.some(r=>r.path==='/market-data.json'&&r.status===200),'Actual DB public market response required');
 assert.deepEqual(requests.filter(url=>!url.startsWith(publicOrigin+'/')&&!url.startsWith('data:')),[]);
 assert(!responses.some(r=>/^\/(?:mock-data\.json$|evidence(?:\/|\.js$)|geography-data\.json$|app\.js$)/.test(r.path)));
 assert.deepEqual(errors,[]);
 console.log(fxIsolation?'PASS offline production browser: five APIs200/FX503, USD retained, KRW missing/recovery/last good, renderer failure distinct, private/mock requests0, JS errors0. Actual Cloudflare/Fedora not executed.':'PASS production browser: simulated HTTPS tunnel to loopback, PostgreSQL market200, private/mock requests0, overview/profiles/theme/mobile, JS errors0. Actual Cloudflare/Fedora not executed.');
}finally{try{await send('Fetch.disable');await send('Browser.close',{},false);}catch{}chrome.kill();await new Promise(r=>{if(chrome.exitCode!==null)r();else chrome.once('exit',r);});await rm(profile,{recursive:true,force:true});await fixture?.stop();}
