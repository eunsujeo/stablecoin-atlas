const safariStreams=process.argv.includes('--safari-streams');
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
let holdSource=true,failSource=false,failEvidence=false,id=0,buffer='',session;const requests=[],errors=[],pending=new Map(),fetchWork=new Set(),networkWork=new Set();
const heldSourceRequests=[];
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
      if(holdSource&&request.url===base+'/asset-review-data.json'){heldSourceRequests.push(requestId);continue;}
      const call=failSource&&request.url===base+'/asset-review-data.json'?send('Fetch.fulfillRequest',{requestId,responseCode:503,body:Buffer.from('UNAVAILABLE').toString('base64')}):!request.url.startsWith(base+'/')?send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'}):failEvidence&&request.url.endsWith('/evidence/index.json')?send('Fetch.fulfillRequest',{requestId,responseCode:503,body:Buffer.from('UNAVAILABLE').toString('base64')}):send('Fetch.continueRequest',{requestId});
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

async function until(expression){for(let i=0;i<180;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,60));}throw new Error('Not ready '+expression+' '+await evaluate("document.querySelector('[data-source-review]')?.innerText.slice(0,600)"));}
async function key(key,code,virtual){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,...(key==='Enter'?{text:'\r'}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual});}

const {sourceReviewProfiles:profiles,sourceFeaturesFor,sourceFeatureLabels,sourceProfileKey,sourceProfileStatus}=await import('../web/source-review-data.js');
const views=[];
try {
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 if(safariStreams)await send('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(ReadableStream.prototype,Symbol.asyncIterator,{value:undefined,configurable:true});Object.defineProperty(AbortSignal,'any',{value:undefined,configurable:true});"});
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 for(const route of ['/#assets','/legacy.html#assets']){
  const pageRequestStart=requests.length;
  await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+route});
  if(holdSource){
   await until("document.querySelector('[data-source-review]')?.getAttribute('aria-busy')==='true'&&document.querySelector('#overview-technical')?.getAttribute('aria-busy')==='true'&&document.querySelectorAll('progress[aria-label^=자산]').length===2");
   await screenshot('asset-review-loading');holdSource=false;for(const requestId of heldSourceRequests.splice(0))await send('Fetch.continueRequest',{requestId});
  }
  await until("document.querySelector('[data-source-review]')?.dataset.reviewId==='usdc-ethereum'&&document.querySelector('#overview-technical')?.dataset.reviewState==='ready'");
  assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.snapshotId"),'asset-source-review-20261025-v1');
  assert.equal(await evaluate("document.querySelector('#overview-technical').dataset.snapshotId"),'asset-source-review-20261025-v1');
  assert.equal(requests.slice(pageRequestStart).filter(url=>url===base+'/asset-review-data.json').length,route==='/#assets'?1:0);
  assert.equal(await evaluate("document.querySelector('[data-source-review]').getAttribute('aria-busy')"),'false');
  assert.equal(await evaluate('location.pathname'),'/');
  if(safariStreams){assert.equal(await evaluate('typeof ReadableStream.prototype[Symbol.asyncIterator]'),'undefined');assert.equal(await evaluate('typeof AbortSignal.any'),'undefined');}
  assert.equal(await evaluate('location.hash'),'#assets');
  assert.equal(await evaluate("document.querySelector('#assets-screen').hidden"),false);
  assert.equal(await evaluate("document.querySelectorAll('.source-review-hero,.source-review-completion').length"),0);
  assert(!(await evaluate("document.querySelector('[data-source-review]').textContent")).includes('TOKEN PROFILE'));
  assert((await evaluate("document.querySelector('.source-review-toolbar label').textContent")).includes('검토 네트워크'));
  assert(!(await evaluate("document.querySelector('.source-review-directory').textContent")).includes('개 배포'));

  assert.equal(await evaluate("document.querySelectorAll('#asset-read-archive,#atlas-read-archive,#asset-cards,#asset-detail,#profile-report,#profile-identity,#profile-results').length"),0);
  assert.equal(await evaluate("document.querySelector('[data-source-review] [role=tab][aria-selected=true]').textContent"),'검증 결과');
  assert(!(await evaluate("document.querySelector('[data-source-review]').innerText")).includes('UNKNOWN'));
  {await until("!document.querySelector('#evidence-reload').disabled");assert.equal(await evaluate("getComputedStyle(document.querySelector('#evidence-metrics')).display"),'none');}
  assert(!(await evaluate(`document.querySelector('#assets-screen').textContent`)).includes('과거 읽기 실행 기록'));
  const seen=[];
  for(const p of profiles){
   await evaluate(`(()=>{const r=document.querySelector('[data-source-review]');r.querySelector('[data-coin-id="${p.coinId}"]').click();const n=r.querySelector('[aria-label="소스 검토 네트워크"]');n.value=${JSON.stringify(sourceProfileKey(p))};n.dispatchEvent(new Event('change'));})()`);
   assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),p.id);
   const text=await evaluate("document.querySelector('.source-review-detail').textContent");assert(text.includes(p.address));assert(!text.includes('미확인 (UNKNOWN)'));assert(!text.includes('전체 배포 연결'));assert.equal(await evaluate("document.querySelectorAll('.source-review-badge').length"),0);seen.push(text);
   const features=sourceFeaturesFor(p.coinId,sourceProfileKey(p));
   for(const label of ['개요','검증 결과','근거·한계']){
    await evaluate(`Array.from(document.querySelectorAll('[data-source-review] [role=tab]')).find(t=>t.textContent===${JSON.stringify(label)}).click()`);
    assert.equal(await evaluate("document.querySelectorAll('[data-source-review] [role=tabpanel]:not([hidden])').length"),1);
    const visible=await evaluate("document.querySelector('[data-source-review] [role=tabpanel]:not([hidden])').innerText");
    for(const value of label==='검증 결과'?features.flatMap(f=>[f.label,f.detail,f.evidence,sourceFeatureLabels[f.status]]):label==='근거·한계'?['소스 검토 근거',p.reviewedAt,...(p.scopeLabel||['jpyc','jpysc','rlusd'].includes(p.coinId)?p.limitations:[])]:[p.address,...(p.chainId?[p.chainId]:[]),sourceProfileStatus(p)])assert(visible.includes(value),p.id+' missing '+value);
   }
   const resultRows=await evaluate("Array.from(document.querySelectorAll('.source-review-results tbody tr')).map(r=>({text:r.textContent,status:r.dataset.featureStatus,id:r.dataset.featureId}))");
   assert.equal(resultRows.length,features.length);
   for(const [index,feature]of features.entries()){
    assert(resultRows[index].text.includes(feature.label));assert(resultRows[index].text.includes(feature.detail));assert(resultRows[index].text.includes(feature.evidence));assert.equal(resultRows[index].status,feature.status);assert.equal(resultRows[index].id,feature.id);
   }
   for(const status of [...(p.features?new Set(features.map(f=>f.status)):['PRESENT','ABSENT_IN_REVIEWED_PATH','NOT_REVIEWED']),'ALL']){
    await evaluate(`document.querySelector('[data-feature-filter="${status}"]').click()`);
    const expected=features.filter(f=>status==='ALL'||f.status===status).map(f=>f.id);
    assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.source-review-results tbody tr:not([hidden])')).map(r=>r.dataset.featureId)"),expected);
   }
   assert(!text.includes(p.observation));assert(!text.includes(p.bindingDetail));
   await evaluate("document.querySelector('[data-source-review] [role=tab][id$=\"-behavior-tab\"]').click()");
   const sourceVisible=await evaluate("document.querySelector('[data-source-review]').innerText");
   assert(sourceVisible.includes('검토한 소스 경로 기준'));if(!p.features)assert(!/기능 [0-9]|권한 [0-9]/.test(sourceVisible));assert(!sourceVisible.includes('UNKNOWN'));

   assert.equal(await evaluate("document.querySelector('.source-review-detail a').getAttribute('href')"),'/source-review-notes.html#'+p.id);
  }
  views.push(seen);
  await evaluate(`document.querySelector('[data-coin-id="jpysc"]').click()`);
  // Search matches stored chain and full address, preserves selection, and recovers from no results.
  for(const [query,expected]of [['Kaia',['jpyc']],[profiles[1].address,['usdt']],['no-matching-asset',[]],['',['usdc','usdt','rlusd','jpyc','jpysc']]]){
   await evaluate(`(()=>{const s=document.querySelector('.source-review-search input');s.value=${JSON.stringify(query)};s.dispatchEvent(new Event('input'));})()`);
   assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.source-review-asset')).map(b=>b.dataset.coinId)"),expected);
   assert.equal(await evaluate("document.querySelector('.source-review-empty').hidden"),expected.length>0);
   const matching=query?profiles.filter(p=>[p.symbol,p.network,sourceProfileKey(p),p.address].some(v=>v.toLowerCase().includes(query.toLowerCase()))):[];
   assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('[data-review-target]')).map(b=>b.dataset.reviewTarget)"),matching.map(p=>p.id));
   assert.equal(await evaluate("document.querySelector('.source-review-matches').hidden"),!query);
   assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),'jpysc-ethereum');
  }
  // Each asset remembers its own chain. Switching USDC must never retain Kaia's identity.
  await evaluate(`(()=>{document.querySelector('[data-coin-id="jpyc"]').click();const s=document.querySelector('[aria-label="소스 검토 네트워크"]');s.value='8217';s.dispatchEvent(new Event('change'));document.querySelector('[data-coin-id="usdc"]').click();})()`);
  assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),'usdc-arc');
  await evaluate("document.querySelector('[data-coin-id=jpyc]').click()");
  assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),'jpyc-kaia');
  // Search opens the exact matching profile, including non-EVM identities and shared addresses.
  for(const p of profiles){
   await evaluate(`(()=>{const s=document.querySelector('.source-review-search input');s.value=${JSON.stringify(p.address)};s.dispatchEvent(new Event('input'));})()`);
   const selector=`[data-review-target="${p.id}"]`;
   assert((await evaluate(`document.querySelector(${JSON.stringify(selector)}).innerText`)).includes(sourceProfileStatus(p)));
   await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
   await key('Enter','Enter',13);
   assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),p.id);
   assert.equal(await evaluate("document.querySelector('[aria-label=\"소스 검토 네트워크\"]').value"),sourceProfileKey(p));
   assert.equal(await evaluate("document.querySelector('[data-review-target][aria-pressed=true]').dataset.reviewTarget"),p.id);
   assert.equal(await evaluate("document.activeElement.dataset.reviewTarget"),p.id);
   // Editing or clearing a query must leave the explicitly selected profile intact.
   await evaluate("(()=>{const s=document.querySelector('.source-review-search input');s.value='';s.dispatchEvent(new Event('input'));})()");
   assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),p.id);
  }
  await evaluate("document.querySelector('[data-coin-id=jpyc]').click()");
  assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),'jpyc-kaia');
  // Native focus plus roving tab navigation, with correct panel ownership.
  await evaluate("document.querySelector('[data-source-review] [role=tab]').click();document.querySelector('[data-source-review] [role=tab]').focus()");
  for(const [keyboard,code,virtual,label]of [['ArrowRight','ArrowRight',39,'검증 결과'],['End','End',35,'근거·한계'],['ArrowRight','ArrowRight',39,'개요'],['ArrowLeft','ArrowLeft',37,'근거·한계'],['Home','Home',36,'개요']]){
   await key(keyboard,code,virtual);
   assert.equal(await evaluate("document.activeElement.textContent"),label);
   assert(await evaluate("document.activeElement.getAttribute('aria-selected')==='true'&&document.querySelector('[data-source-review] [role=tabpanel]:not([hidden])').getAttribute('aria-labelledby')===document.activeElement.id"));
  }
  assert(await evaluate("getComputedStyle(document.querySelector('.source-review-tabs button[aria-selected=true]')).borderBottomColor!=='rgba(0, 0, 0, 0)'"));

  for(const mode of ['dark','light']){
   await evaluate(`document.documentElement.dataset.theme='${mode}'`);
   await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
   assert(await evaluate("document.querySelector('.source-review-tabs').getBoundingClientRect().top-document.querySelector('.source-review-toolbar').getBoundingClientRect().bottom<12"),'tabs must immediately follow compact toolbar');
   await evaluate("document.querySelector('[data-source-review] [role=tab][id$=\"-behavior-tab\"]').click();document.querySelector('[data-source-review]').scrollIntoView({block:'start'})");await screenshot('profile-redesign-'+(route.startsWith('/legacy')?'legacy-':'root-')+mode);
   await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
   assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
   await evaluate("(()=>{const s=document.querySelector('.source-review-search input');s.value='Solana';s.dispatchEvent(new Event('input'));document.querySelector('.source-review-matches').scrollIntoView({block:'start',behavior:'instant'});})()");
   assert(await evaluate("Array.from(document.querySelectorAll('.source-review-match')).every(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().height>=44)"));
   assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
   await screenshot('profile-search-'+(route.startsWith('/legacy')?'legacy-':'root-')+mode+'-mobile');
   await evaluate("(()=>{const s=document.querySelector('.source-review-search input');s.value='';s.dispatchEvent(new Event('input'));})()");
   for(const tab of ['overview','behavior','evidence']){
    await evaluate(`document.querySelector('[data-source-review] [role=tab][id$="-${tab}-tab"]').click()`);
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
   }
   await evaluate("document.querySelector('[data-source-review] [role=tab][id$=\"-behavior-tab\"]').click();document.querySelector('.source-review-results').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('profile-redesign-'+(route.startsWith('/legacy')?'legacy-':'root-')+mode+'-mobile');
   await evaluate("document.querySelector('[data-source-review]').scrollIntoView({block:'start',behavior:'instant'})");
   assert(await evaluate("(()=>{const gap=document.querySelector('.source-review-tabs').getBoundingClientRect().top-document.querySelector('.source-review-toolbar').getBoundingClientRect().bottom;return gap>=-1&&gap<12;})()"));
   await screenshot('profile-header-'+(route.startsWith('/legacy')?'legacy-':'root-')+mode+'-mobile');
   // New scope types must fit independently of the legacy ERC-20 profiles.
   for(const p of profiles.filter(p=>p.features)){
    await evaluate(`(()=>{document.querySelector('[data-coin-id="${p.coinId}"]').click();const n=document.querySelector('[aria-label="소스 검토 네트워크"]');n.value=${JSON.stringify(sourceProfileKey(p))};n.dispatchEvent(new Event('change'));})()`);
    for(const tab of ['overview','behavior','evidence']){
     await evaluate(`document.querySelector('[data-source-review] [role=tab][id$="-${tab}-tab"]').click()`);
     assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),p.id+' mobile '+tab);
    }
    assert((await evaluate("document.querySelector('[data-source-review] [role=tabpanel]:not([hidden])').innerText")).includes(p.scopeLabel));
   }
   await evaluate(`document.querySelector('[data-source-review] [role=tab][id$="-behavior-tab"]').click();document.querySelector('.source-review-results').scrollIntoView({block:'start',behavior:'instant'})`);
   await screenshot('top10-'+(route.startsWith('/legacy')?'legacy-':'root-')+mode+'-mobile');
   await evaluate("document.querySelector('[data-coin-id=jpyc]').click()");
  }
 }
 assert.deepEqual(views[0],views[1]);
 // Overview summarizes source status by asset and preserves the existing read grade.
 await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+'/#overview'});
 await until("document.querySelectorAll('#overview-source-rows article').length===5&&!document.querySelector('#overview-reload').disabled");
 assert.equal(await evaluate("document.querySelector('#overview-read-history').open"),false);
 assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#overview-source-metrics strong')).slice(0,3).map(e=>e.textContent)"),['8 / 26','5개',`${new Set(profiles.map(p=>p.chainId??p.networkKey)).size}개`]);
 for(const coinId of new Set(profiles.map(p=>p.coinId))){
  const selected=profiles.filter(p=>p.coinId===coinId);
  const row=await evaluate(`document.querySelector('#overview-source-rows [data-source-coin="${coinId}"]').textContent`);
  for(const value of [selected[0].symbol,selected.every(p=>!p.features)?'소스 확인 완료':'검토 종류별 근거 확인',...selected.map(p=>p.network)])assert(row.includes(value),coinId+' overview missing '+value);
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
 // Removed validation/comparison deep links safely use the overview without reviving pages.
 for(const route of ['/#validation','/legacy.html#validation','/#compare','/legacy.html#compare']){
  await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+route});
  await until("document.querySelector('#overview-screen')?.hidden===false&&document.querySelectorAll('#overview-source-rows article').length===5");
  assert.equal(await evaluate("document.querySelectorAll('#validation-screen,[data-screen=validation],a[href=\"#validation\"],#compare-screen,[data-screen=compare],a[href=\"#compare\"]').length"),0);
  assert.equal(await evaluate("document.querySelectorAll('#overview-verdicts button,.overview-evidence-row:is(button)').length"),0);
 }
 await evaluate("import('/browser-data.js').then(m=>m.browserData.clear())");
 failEvidence=true;
 await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+'/#overview'});
 await until("document.querySelectorAll('#overview-source-rows article').length===5&&!document.querySelector('#overview-error').hidden");
 assert.equal(await evaluate("document.querySelectorAll('#overview-source-rows .overview-source-status').length"),5);
 assert.equal(await evaluate("document.querySelector('#overview-read-grade').textContent"),'미산정');
 for(const route of ['/#assets','/legacy.html#assets']){
  await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+route});
  await until("document.querySelector('[data-source-review]')?.dataset.reviewId==='usdc-ethereum'");
  assert.equal(await evaluate('location.pathname'),'/');
  assert.equal(await evaluate('location.hash'),'#assets');
  assert.equal(await evaluate("document.querySelector('#assets-screen').hidden"),false);
  await until("!document.querySelector('#evidence-error').hidden");
  assert.equal(await evaluate("document.querySelectorAll('#asset-read-archive,#atlas-read-archive,#asset-detail,#profile-results').length"),0);
  assert.equal(await evaluate("document.querySelectorAll('.source-review-asset').length"),5);
  await evaluate("document.querySelector('[data-coin-id=jpysc]').click()");
  assert.equal(await evaluate("document.querySelector('[data-source-review]').dataset.reviewId"),'jpysc-ethereum');
 }
 if(safariStreams){
  await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+'/#live'});
  await until("!document.querySelector('#live-reload')?.disabled&&document.querySelectorAll('#live-metrics .market-stat').length>0");
  assert.equal(await evaluate("document.querySelector('#live-error').hidden"),true);
  assert.match(await evaluate("document.querySelector('#live-metrics').textContent"),/\$1/);
  assert.equal(await evaluate('typeof ReadableStream.prototype[Symbol.asyncIterator]'),'undefined');
 }
 await evaluate("import('/browser-data.js').then(m=>m.browserData.clear())");
 failSource=true;await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:base+'/#assets'});
 await until("document.querySelector('[data-source-review]')?.dataset.reviewState==='error'&&document.querySelector('#overview-technical')?.dataset.reviewState==='error'");
 assert.equal(await evaluate("document.querySelectorAll('.source-review-asset,#overview-source-rows article').length"),0);
 assert.equal(await evaluate("document.querySelectorAll('progress[aria-label^=자산]').length"),0);
 assert.equal(await evaluate("document.querySelector('[data-source-review]').getAttribute('aria-busy')"),'false');
 await drainFetch();
 assert.deepEqual(requests.filter(url=>/\/(?:source-review-data|source-review-top10-data)\.js$/.test(url)),[]);
 assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(u=>!u.startsWith(base+'/')&&!u.startsWith('data:')),[]);
 if(safariStreams)console.log('PASS Safari API-condition emulation: ReadableStream asyncIterator/AbortSignal.any absent (Chrome, not an actual iPhone).');
 console.log('PASS legacy-only navigation (removed validation/compare fallback), report data preserved; shared snapshot/single fetch/loading/error cleanup; source profiles: 5 assets/26 profiles, exact search selection by keyboard and scope labels, original 8 preserved, added 18 scoped features and states, 8/26 summary, network keys/search/tabs/filters, evidence links, read grade/verdict counts preserved, both routes/dark/light/390px, JS errors=0/external requests=0');
}finally{try{await send('Fetch.disable');await send('Browser.close',{},false);}catch{}chrome.kill();await new Promise(resolve=>{if(chrome.exitCode!==null)resolve();else chrome.once('exit',resolve);});await rm(profile,{recursive:true,force:true});}
