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
      const call=!request.url.startsWith(base+'/')?send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'}):failEvidence&&request.url.endsWith('/evidence/index.json')?send('Fetch.fulfillRequest',{requestId,responseCode:503,body:Buffer.from('UNAVAILABLE').toString('base64')}):send('Fetch.continueRequest',{requestId});
      call.catch(e=>errors.push(e.message));
    }
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text);
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
async function key(key,code,virtual){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual});}

const {sourceReviewProfiles:profiles}=await import('../web/source-review-data.js');
const views=[];
try {
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 for(const route of ['/#assets','/atlas.html#assets']){
  await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+route});
  await until("document.querySelector('[data-source-review]')?.dataset.reviewId==='usdc-ethereum'");
  const isAtlas=route.includes('atlas.html');
  assert.equal(await evaluate("document.querySelectorAll('#asset-read-archive,#atlas-read-archive,#asset-cards,#asset-detail,#profile-report,#profile-identity,#profile-results').length"),0);
  assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').textContent"),'검증 결과');
  assert(!(await evaluate("document.querySelector('[data-source-review]').innerText")).includes('UNKNOWN'));
  if(!isAtlas){await until("!document.querySelector('#evidence-reload').disabled");assert.equal(await evaluate("getComputedStyle(document.querySelector('#evidence-metrics')).display"),'none');}
  assert(!(await evaluate(`document.querySelector('${isAtlas?'#assets':'#assets-screen'}').textContent`)).includes('과거 읽기 실행 기록'));
  const seen=[];
  for(const p of profiles){
   await evaluate(`(()=>{const r=document.querySelector('[data-source-review]');r.querySelector('[data-coin-id="${p.coinId}"]').click();const n=r.querySelector('[aria-label="소스 검토 네트워크"]');n.value=${JSON.stringify(p.chainId)};n.dispatchEvent(new Event('change'));})()`);
   assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),p.id);
   const text=await evaluate("document.querySelector('.source-review-detail').textContent");assert(text.includes(p.address));assert(!text.includes('미확인 (UNKNOWN)'));assert(!text.includes('전체 배포 연결'));assert.equal(await evaluate("document.querySelectorAll('.source-review-badge').length"),0);seen.push(text);
   for(const label of ['개요','검증 결과','근거·한계']){
    await evaluate(`Array.from(document.querySelectorAll('[role=tab]')).find(t=>t.textContent===${JSON.stringify(label)}).click()`);
    assert.equal(await evaluate("document.querySelectorAll('[role=tabpanel]:not([hidden])').length"),1);
    const visible=await evaluate("document.querySelector('[role=tabpanel]:not([hidden])').innerText");
    for(const value of label==='검증 결과'?[...p.functions,...p.authorities]:label==='근거·한계'?['소스 검토 근거',p.reviewedAt,...(['jpyc','jpysc','rlusd'].includes(p.coinId)?p.limitations:[])]:[p.address,p.chainId,'소스 확인 완료'])assert(visible.includes(value),p.id+' missing '+value);
   }
   const resultRows=await evaluate("Array.from(document.querySelectorAll('.source-review-results tbody tr')).map(r=>({text:r.textContent,status:r.dataset.reviewStatus}))");
   assert.equal(resultRows.length,p.functions.length+p.authorities.length);
   for(const [index,text]of [...p.functions,...p.authorities].entries()){
    assert(resultRows[index].text.includes(text));assert(resultRows[index].text.includes('소스 확인 완료'));assert.equal(resultRows[index].status,p.sourceReviewStatus);
   }
   assert(!text.includes(p.observation));assert(!text.includes(p.bindingDetail));
   await evaluate("document.querySelector('[role=tab][id$=\"-behavior-tab\"]').click()");
   const sourceVisible=await evaluate("document.querySelector('[data-source-review]').innerText");
   assert(sourceVisible.includes('소스 확인 완료'));assert(!sourceVisible.includes('UNKNOWN'));

   assert.equal(await evaluate("document.querySelector('.source-review-detail a').getAttribute('href')"),'/source-review-notes.html#'+p.id);
  }
  views.push(seen);
  // Search matches stored chain and full address, preserves selection, and recovers from no results.
  for(const [query,expected]of [['Kaia',['jpyc']],[profiles[1].address,['usdt']],['no-matching-asset',[]],['',['usdc','usdt','rlusd','jpyc','jpysc']]]){
   await evaluate(`(()=>{const s=document.querySelector('.source-review-search input');s.value=${JSON.stringify(query)};s.dispatchEvent(new Event('input'));})()`);
   assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.source-review-asset')).map(b=>b.dataset.coinId)"),expected);
   assert.equal(await evaluate("document.querySelector('.source-review-empty').hidden"),expected.length>0);
   assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),'jpysc-ethereum');
  }
  // Each asset remembers its own chain. Switching USDC must never retain Kaia's identity.
  await evaluate(`(()=>{document.querySelector('[data-coin-id="jpyc"]').click();const s=document.querySelector('[aria-label="소스 검토 네트워크"]');s.value='8217';s.dispatchEvent(new Event('change'));document.querySelector('[data-coin-id="usdc"]').click();})()`);
  assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),'usdc-ethereum');
  await evaluate("document.querySelector('[data-coin-id=jpyc]').click()");
  assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),'jpyc-kaia');
  // Native focus plus roving tab navigation, with correct panel ownership.
  await evaluate("document.querySelector('[role=tab]').click();document.querySelector('[role=tab]').focus()");
  for(const [keyboard,code,virtual,label]of [['ArrowRight','ArrowRight',39,'검증 결과'],['End','End',35,'근거·한계'],['ArrowRight','ArrowRight',39,'개요'],['ArrowLeft','ArrowLeft',37,'근거·한계'],['Home','Home',36,'개요']]){
   await key(keyboard,code,virtual);
   assert.equal(await evaluate("document.activeElement.textContent"),label);
   assert(await evaluate("document.activeElement.getAttribute('aria-selected')==='true'&&document.querySelector('[role=tabpanel]:not([hidden])').getAttribute('aria-labelledby')===document.activeElement.id"));
  }
  assert(await evaluate("getComputedStyle(document.querySelector('.source-review-tabs button[aria-selected=true]')).borderBottomColor!=='rgba(0, 0, 0, 0)'"));

  for(const mode of ['dark','light']){
   await evaluate(`document.documentElement.dataset.theme='${mode}'`);
   await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
   await evaluate("document.querySelector('[role=tab][id$=\"-behavior-tab\"]').click();document.querySelector('[data-source-review]').scrollIntoView({block:'start'})");await screenshot('profile-redesign-'+(isAtlas?'atlas-':'legacy-')+mode);
   await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
   assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
   for(const tab of ['overview','behavior','evidence']){
    await evaluate(`document.querySelector('[role=tab][id$="-${tab}-tab"]').click()`);
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
   }
   await evaluate("document.querySelector('[role=tab][id$=\"-behavior-tab\"]').click();document.querySelector('.source-review-results').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('profile-redesign-'+(isAtlas?'atlas-':'legacy-')+mode+'-mobile');
  }
  await evaluate("location.hash='#compare'");
  await until(isAtlas?"!document.querySelector('#compare-report-1').disabled&&document.querySelectorAll('#native-comparison-body tr').length>0":"document.querySelectorAll('#comparison-body tr').length>0");
 }
 assert.deepEqual(views[0],views[1]);
 // Overview summarizes source status by asset and preserves the existing read grade.
 await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+'/#overview'});
 await until("document.querySelectorAll('#overview-source-rows article').length===5&&!document.querySelector('#overview-reload').disabled");
 assert.equal(await evaluate("document.querySelector('#overview-read-history').open"),false);
 assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#overview-source-metrics strong')).slice(0,3).map(e=>e.textContent)"),['8 / 8','5개','4개']);
 for(const coinId of new Set(profiles.map(p=>p.coinId))){
  const selected=profiles.filter(p=>p.coinId===coinId);
  const row=await evaluate(`document.querySelector('#overview-source-rows [data-source-coin="${coinId}"]').textContent`);
  for(const value of [selected[0].symbol,'소스 확인 완료',...selected.map(p=>p.network)])assert(row.includes(value),coinId+' overview missing '+value);
  for(const p of selected)for(const detail of [...p.functions,...p.authorities])assert(!row.includes(detail),'overview should stay compact');
  await evaluate("(()=>{const s=document.querySelector('.source-review-search input');s.value='no-match';s.dispatchEvent(new Event('input'));})()");
  await evaluate(`document.querySelector('#overview-source-rows [data-source-coin="${coinId}"] a').click()`);
  await until(`location.hash==='#assets'&&document.querySelector('[data-source-review]').dataset.reviewId.startsWith('${coinId}-')`);
  await evaluate("location.hash='#overview'");
 }
 const {dashboardEvidence}=await import('../web/evidence-model.js'),{overviewSummary}=await import('../web/overview-model.js');
 const original=overviewSummary(dashboardEvidence(await(await fetch(base+'/evidence/index.json')).json()));
 assert.equal(await evaluate("document.querySelector('#overview-read-grade').textContent"),original.grade===null?'등급 없음':`${original.provisional?'잠정 ':''}${original.grade}`);
 await evaluate("document.querySelector('#overview-read-history').open=true");
 assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#overview-verdicts strong')).map(e=>Number(e.textContent))"),['PASS','FAIL','INCONCLUSIVE','NOT_TESTED','NOT_APPLICABLE','UNSUPPORTED'].map(v=>original.counts[v]));
 await evaluate("document.querySelector('#overview-read-history').open=false");
 for(const mode of ['dark','light']){
  await evaluate(`document.documentElement.dataset.theme='${mode}'`);
  for(const width of [1440,390]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
   await evaluate("document.querySelector('#overview-technical').scrollIntoView({block:'start'})");
   assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
   await screenshot('overview-source-'+mode+'-'+width);
   assert(await evaluate("Array.from(document.querySelectorAll('.overview-source-asset')).every(e=>e.scrollWidth<=e.clientWidth+1)"),'summary cards must fit');
  }
 }
 failEvidence=true;
 await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+'/#overview'});
 await until("document.querySelectorAll('#overview-source-rows article').length===5&&!document.querySelector('#overview-error').hidden");
 assert.equal(await evaluate("document.querySelectorAll('#overview-source-rows .overview-source-status').length"),5);
 assert.equal(await evaluate("document.querySelector('#overview-read-grade').textContent"),'미산정');
 for(const route of ['/#assets','/atlas.html#assets']){
  await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+route});
  await until("document.querySelector('[data-source-review]')?.dataset.reviewId==='usdc-ethereum'");
  if(!route.includes('atlas.html'))await until("!document.querySelector('#evidence-error').hidden");
  assert.equal(await evaluate("document.querySelectorAll('#asset-read-archive,#atlas-read-archive,#asset-detail,#profile-results').length"),0);
  assert.equal(await evaluate("document.querySelectorAll('.source-review-asset').length"),5);
  await evaluate("document.querySelector('[data-coin-id=jpysc]').click()");
  assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),'jpysc-ethereum');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(u=>!u.startsWith(base+'/')&&!u.startsWith('data:')),[]);
 console.log('PASS source profiles and technical overview: 5 tokens/8 deployments, itemized source results/status/evidence links, source-only profiles, no archive or historical diagnostics in DOM, comparison path preserved, compact 5 asset cards and 8/8 source summary, preserved read grade/verdict counts and detail navigation, search/network/tabs/keyboard, evidence failure isolation, dark/light/390px, JS errors=0/external requests=0');
}finally{try{await send('Fetch.disable');await send('Browser.close',{},false);}catch{}chrome.kill();await new Promise(resolve=>{if(chrome.exitCode!==null)resolve();else chrome.once('exit',resolve);});await rm(profile,{recursive:true,force:true});}
