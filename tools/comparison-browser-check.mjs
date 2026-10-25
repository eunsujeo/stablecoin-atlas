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
let holdComparison=false;const heldComparison=[];
let failEvidence=false,id=0,buffer='',session;const requests=[],errors=[],pending=new Map();
chrome.stderr.on('data', () => {});
chrome.stdio[4].on('data', data => {
  buffer += data.toString(); let end;
  while ((end = buffer.indexOf('\0')) !== -1) {
    const raw = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (!raw) continue;
    const value = JSON.parse(raw);
    if (value.id && pending.has(value.id)) { const { resolve, reject, timer } = pending.get(value.id); clearTimeout(timer); pending.delete(value.id); value.error ? reject(new Error(JSON.stringify(value.error))) : resolve(value.result); }
    if (value.method === 'Network.requestWillBeSent') requests.push(value.params.request.url);
    if(value.method==='Fetch.requestPaused'){
      const {requestId,request}=value.params;
      if(holdComparison&&request.url.endsWith('/comparison.js')){heldComparison.push(requestId);return;}
      const call=!request.url.startsWith(base+'/')?send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'}):failEvidence&&request.url.endsWith('/evidence/index.json')?send('Fetch.fulfillRequest',{requestId,responseCode:503,body:Buffer.from('UNAVAILABLE').toString('base64')}):send('Fetch.continueRequest',{requestId});
      call.catch(e=>errors.push(e.message));
    }
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description??value.params.exceptionDetails.text);
  }
});
function send(method, params = {}, page = true) {
  return new Promise((resolve, reject) => { const n = ++id, timer = setTimeout(() => { pending.delete(n); reject(new Error(`CDP timeout ${method}`)); }, 15000); pending.set(n, { resolve, reject, timer }); chrome.stdio[3].write(JSON.stringify({ id: n, method, params, ...(page && session ? { sessionId: session } : {}) }) + '\0'); });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function screenshot(name) { await evaluate('new Promise(resolve => setTimeout(resolve, 250))'); const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(`.state/${name}.png`, Buffer.from(r.data, 'base64')); }

async function until(expression){for(let i=0;i<180;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,60));}throw new Error('Not ready '+expression+' '+await evaluate("document.querySelector('[data-source-review]')?.innerText.slice(0,600)"));}
async function key(key,code,virtual){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,...(key==='Enter'?{text:'\r'}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual});}

const {sourceComparison}=await import('../web/comparison-model.js');
const {sourceReviewProfiles:profiles}=await import('../web/source-review-data.js');
try {
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 for(const route of ['/#compare','/atlas.html#compare']){
  const atlas=route.includes('atlas');
  await send('Page.navigate',{url:base+route});
  await until("document.querySelector('.profile-comparison tbody tr')");
  const reportSelect=atlas?'#compare-report-1':'#compare-1',reportBody=atlas?'#native-comparison-body':'#comparison-body';
  await until(`document.querySelector('${reportSelect}').options.length>1`);
  assert.equal(await evaluate("document.querySelector('[data-report-comparison]').hidden"),true);
  assert.equal(await evaluate("document.querySelectorAll('.profile-compare-selectors select')[0].options.length"),27);
  for(const p of profiles){
   const other=profiles.find(o=>o.id!==p.id);
   await evaluate(`(()=>{const s=document.querySelectorAll('.profile-compare-selectors select');s[0].value=${JSON.stringify(p.id)};s[1].value=${JSON.stringify(other.id)};s[2].value='';s[0].dispatchEvent(new Event('change'));s[1].dispatchEvent(new Event('change'));s[2].dispatchEvent(new Event('change'));})()`);
   // Browser has a real disabled-option UI; programmatic selection above dispatches after both values are set.
   const expected=sourceComparison([p.id,other.id]);
   assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('[data-compared-profile]')).map(e=>e.dataset.comparedProfile)"),[p.id,other.id]);
   const text=await evaluate("document.querySelector('.profile-comparison').textContent");
   for(const row of expected.rows)for(const item of row.cells[0]){assert(text.includes(item.detail),p.id+' detail');assert(text.includes(item.evidence),p.id+' evidence');}
   assert.equal(await evaluate("document.querySelector('.profile-comparison tbody').rows.length"),expected.rows.length);
  }
  await evaluate("(()=>{const s=document.querySelectorAll('.profile-compare-selectors select');s[0].value='usdc-ethereum';s[1].value='usdt-ethereum';s[2].value='rlusd-ethereum';for(const e of s)e.dispatchEvent(new Event('change'));})()");
  assert.equal(await evaluate("document.querySelectorAll('[data-compared-profile]').length"),3);
  assert(await evaluate("document.querySelectorAll('.profile-compare-selectors select')[1].querySelector('[value=usdc-ethereum]').disabled"));
  await evaluate("(()=>{const s=document.querySelectorAll('.profile-compare-selectors select')[1];s.value='';s.dispatchEvent(new Event('change'));})()");
  assert.equal(await evaluate("document.querySelectorAll('[data-compared-profile]').length"),2);
  await evaluate("(()=>{const s=document.querySelectorAll('.profile-compare-selectors select')[2];s.value='';s.dispatchEvent(new Event('change'));})()");
  assert.equal(await evaluate("document.querySelectorAll('.profile-comparison tbody tr').length"),0);
  assert((await evaluate("document.querySelector('.comparison-count').textContent")).includes('2~3'));
  await evaluate("(()=>{const s=document.querySelectorAll('.profile-compare-selectors select')[1];s.value='usdt-ethereum';s.dispatchEvent(new Event('change'));})()");
  await evaluate("document.querySelector('[data-comparison-mode=reports]').focus()");await key('Enter','Enter',13);
  assert.equal(await evaluate("document.querySelector('[data-report-comparison]').hidden"),false);
  assert.equal(await evaluate("document.querySelector('.profile-comparison').hidden"),true);
  assert(await evaluate(`document.querySelector('${reportBody}').rows.length>0`));
  const second=atlas?'#compare-report-2':'#compare-2',third=atlas?'#compare-report-3':'#compare-3';
  assert(await evaluate(`(()=>{const first=document.querySelector('${reportSelect}').value;return Array.from(document.querySelector('${second}').options).find(o=>o.value===first).disabled;})()`));
  await evaluate(`(()=>{const select=document.querySelector('${third}');select.value=Array.from(select.options).find(o=>o.value&&!o.disabled).value;select.dispatchEvent(new Event('change'));})()`);
  assert.equal(await evaluate(`document.querySelector('${reportBody}').rows[0].cells.length`),4);
  await evaluate(`(()=>{const select=document.querySelector('${third}');select.value='';select.dispatchEvent(new Event('change'));})()`);
  assert.equal(await evaluate(`document.querySelector('${reportBody}').rows[0].cells.length`),3);
  if(!atlas){
   await evaluate("document.querySelector('#comparison-body .scenario-button').click()");
   await until("document.querySelector('#detail-dialog').open&&document.querySelector('#dialog-content').textContent.includes('관측값')");
   await evaluate("document.querySelector('#detail-dialog').close()");
   await until("document.activeElement.classList.contains('scenario-button')");
  }
  const before=await evaluate(`document.querySelector('${reportBody}').textContent`);
  const value=await evaluate(`document.querySelector('${reportSelect}').value`);
  await evaluate("document.querySelector('[data-comparison-mode=profiles]').click();document.querySelector('[data-comparison-mode=reports]').click()");
  assert.equal(await evaluate(`document.querySelector('${reportSelect}').value`),value);
  assert.equal(await evaluate(`document.querySelector('${reportBody}').textContent`),before);
  for(const mode of ['profiles','reports'])for(const theme of ['dark','light'])for(const width of [1440,390]){
   await evaluate(`document.querySelector('[data-comparison-mode=${mode}]').click();document.documentElement.dataset.theme='${theme}'`);
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
   await evaluate("document.querySelector('[data-comparison-switch]').scrollIntoView({block:'start'})");
   assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),route+' '+mode+' '+width);
   await screenshot(`comparison-${atlas?'atlas':'legacy'}-${mode}-${theme}-${width}`);
  }
  failEvidence=true;
  await evaluate(atlas?"document.querySelector('.atlas-evidence-reload').click()":"document.querySelector('#evidence-reload').click()");
  await until(atlas?"!document.querySelector('.atlas-evidence-error').hidden":"!document.querySelector('#evidence-error').hidden");
  assert.equal(await evaluate(`document.querySelector('${reportBody}').textContent`),before);
  await evaluate("document.querySelector('[data-comparison-mode=profiles]').click()");
  assert.equal(await evaluate("document.querySelectorAll('[data-compared-profile]').length"),2);
  failEvidence=false;
 }
 // Hold the comparison module: static focus must work before dynamic controls exist.
 for(const reload of [false,true]){
  holdComparison=true;
  if(reload)await send('Page.reload',{ignoreCache:true});
  else {await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+'/atlas.html#compare'});}
  for(let i=0;i<150&&!heldComparison.length;i++)await new Promise(r=>setTimeout(r,50));
  assert(heldComparison.length);
  await until("document.activeElement===document.querySelector('#compare [data-comparison-switch]')");
  holdComparison=false;
  for(const requestId of heldComparison.splice(0))await send('Fetch.continueRequest',{requestId});
  await until("document.querySelectorAll('[data-compared-profile]').length===2");
 }
 await evaluate("location.hash='#assets'");await until("!document.querySelector('#assets').hidden");
 await evaluate("location.hash='#compare'");await until("!document.querySelector('#compare').hidden");
 assert(await evaluate("document.activeElement===document.querySelector('#compare [data-comparison-switch]')"));
 // A first-read failure leaves source comparison usable and makes no report judgments.
 failEvidence=true;
 for(const route of ['/#compare','/atlas.html#compare']){
  await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+route});
  await until("document.querySelectorAll('[data-compared-profile]').length===2");
  await until(route.includes('atlas')?"!document.querySelector('.atlas-evidence-error').hidden":"!document.querySelector('#evidence-error').hidden");
  assert.equal(await evaluate("document.querySelector('.profile-comparison').hidden"),false);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(u=>!u.startsWith(base+'/')&&!u.startsWith('data:')),[]);
 console.log('PASS comparison: both routes, all 26 profile features/evidence, 2/3 selections, missing selection, duplicate prevention, keyboard modes, stored report preservation and reload/first-read failure, dark/light at 1440/390px, JS errors=0/external requests=0');
}finally{try{await send('Fetch.disable');await send('Browser.close',{},false);}catch{}chrome.kill();await new Promise(resolve=>{if(chrome.exitCode!==null)resolve();else chrome.once('exit',resolve);});await rm(profile,{recursive:true,force:true});}
