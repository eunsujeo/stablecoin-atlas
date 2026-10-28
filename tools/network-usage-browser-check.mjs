// Owned offline fixture only. Chrome with Safari stream APIs disabled is emulation, not an iPhone test.
import {spawn} from 'node:child_process';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {startPreviewServer} from './ui-preview.mjs';
import {surveyDto} from '../tests/survey-fixture.mjs';
import {networkUsageFixture} from '../tests/network-usage-fixture.mjs';
let publishedUsage;const server=await startPreviewServer(0,{networkUsageReader:async()=>{if(!publishedUsage)throw Error('NOT_READY');return publishedUsage;}}),base='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(join(tmpdir(),'atlas-usage-browser-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-pipe','--disable-background-networking','--disable-component-update','--disable-sync','--disable-default-apps','--disable-extensions','--no-first-run',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let id=0,buffer='',session;const pending=new Map(),errors=[],requests=[];
chrome.stdio[4].on('data',b=>{buffer+=b.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const v=JSON.parse(raw);if(v.id&&pending.has(v.id)){const p=pending.get(v.id);clearTimeout(p.timer);pending.delete(v.id);v.error?p.reject(Error(p.method+': '+v.error.message)):p.resolve(v.result);}if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails.text);if(v.method==='Network.requestWillBeSent')requests.push(v.params.request.url);if(v.method==='Fetch.requestPaused'){const p=v.params;send(p.request.url.startsWith(base+'/')?'Fetch.continueRequest':'Fetch.failRequest',p.request.url.startsWith(base+'/')?{requestId:p.requestId}:{requestId:p.requestId,errorReason:'BlockedByClient'}).catch(e=>errors.push(e.message));}}});
function send(method,params={},page=true){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},15000);pending.set(n,{resolve,reject,timer,method});chrome.stdio[3].write(JSON.stringify({id:n,method,params,...(page&&session?{sessionId:session}:{})})+'\0');});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,replMode:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;}
async function click(label){await evaluate(`document.querySelector('[aria-label="${label}"]').click()`);}
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 for(const method of ['Runtime.enable','Page.enable','Network.enable'])await send(method);
 await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Page.navigate',{url:base+'/source-review-notes.html'});
 for(let i=0;i<100;i++){if(await evaluate(`location.origin==='${base}'&&document.readyState==='complete'`))break;await new Promise(r=>setTimeout(r,30));}
 // A static document establishes the origin without loading application scripts.
 await send('Page.setDocumentContent',{frameId:(await send('Page.getFrameTree')).frameTree.frame.id,html:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${base}/styles.css"></head><body><main><section id="overview-supply"></section></main></body></html>`});
 await evaluate("Object.defineProperty(ReadableStream.prototype,Symbol.asyncIterator,{value:undefined,configurable:true});Object.defineProperty(AbortSignal,'any',{value:undefined,configurable:true});");
 const dto=await surveyDto(),snapshot=dto.snapshots.find(s=>s.survey==='volume');
 for(const r of snapshot.rows.filter(r=>r.deploymentId.startsWith('usdc-'))){r.values.transfer_volume_usd=r.deploymentId==='usdc-ethereum'?'1000':'200';r.values.transfer_count=r.deploymentId==='usdc-ethereum'?'10':'40';r.values.transfer_tx_count=r.deploymentId==='usdc-ethereum'?'7':'20';}
 snapshot.rows.find(r=>r.deploymentId==='usdc-ethereum'&&r.providerDay==='2026-10-16').values.transfer_count='0';
 await evaluate(`window.readCalls=0;window.renderUsageView=(await import('${base}/supply-overview.js')).initializeSupplyOverview(document.querySelector('#overview-supply'),{read:async()=>{window.readCalls++;throw Error('UNEXPECTED_READ');}});window.usageData=${JSON.stringify(dto)};await window.renderUsageView({index:null,market:null,indexFailed:false,survey:{data:window.usageData,state:'AVAILABLE'}});`);
 const views=[];
 for(const [width,height]of [[1440,1100],[390,1100]])for(const theme of ['light','dark']){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate(`document.documentElement.dataset.theme='${theme}';new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  for(const [label,unit]of [['전송량','tokens'],['전송금액','USD'],['전송 건수','건'],['전송 포함 트랜잭션 수','건']]){
   await click('전송 활동 지표 · '+label);
   assert.equal(await evaluate("document.querySelector('.overview-transfer-row .network-axis-title').textContent"),unit);
   assert((await evaluate("document.querySelector('.summary-volume').textContent")).includes(label+' 1위'));
   assert.equal(await evaluate("document.querySelector('.overview-usage tbody tr').cells[4].textContent"),'100.00');
   assert.equal(await evaluate("document.querySelector('.overview-usage tbody tr:last-child').cells[4].textContent"),'5.00');
   assert.equal(await evaluate("document.querySelector('.overview-usage tbody tr').cells[2].textContent"),'10');
  }
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  views.push({width,theme});
 }
 await evaluate("document.querySelector('.overview-transfer-row svg.market-price-chart').focus()");
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home',windowsVirtualKeyCode:36});
 assert((await evaluate("document.querySelector('.overview-usage .chart-note').textContent")).startsWith('2026-10-16'));
 assert.equal(await evaluate("document.querySelector('.overview-usage tbody tr').cells[4].textContent"),'—');
 await evaluate("document.querySelector('.donut-legend [data-series=\"usdc:ethereum\"]').click()");assert.equal(await evaluate("document.querySelectorAll('.overview-usage tbody tr').length"),1);
 await evaluate("document.querySelector('.donut-legend [data-series=\"usdc:solana\"]').click()");assert((await evaluate("document.querySelector('.overview-usage tbody').textContent")).includes('목록에서 네트워크'));
 await evaluate("document.querySelector('.donut-legend [data-series=\"usdc:ethereum\"]').click();document.querySelector('.donut-legend [data-series=\"usdc:solana\"]').click()");
 await click('연동 통화 · JPY');assert((await evaluate("document.querySelector('.overview-usage caption').textContent")).startsWith('JPYSC'));
 assert.equal(await evaluate("document.querySelector('.overview-usage tbody tr').cells[2].textContent"),'—');
 await click('전송량 최신일 선택');assert.equal(await evaluate("document.querySelector('.overview-usage tbody tr').cells[2].textContent"),'9,007,199,254,740,993');
 await click('연동 통화 · USD');assert((await evaluate("document.querySelector('.overview-usage caption').textContent")).startsWith('USDC'));
 await evaluate("window.usageData.snapshots.find(s=>s.survey==='volume').rows.forEach(r=>r.values.transfer_count=null);await window.renderUsageView({index:null,market:null,indexFailed:false,survey:{data:window.usageData,state:'LAST_GOOD'}})");
 await click('전송 활동 지표 · 전송 건수');assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"전송 활동 지표\"] button').length"),4);assert((await evaluate("document.querySelector('.overview-transfer-row').textContent")).includes('관측값이 없습니다'));
 await click('전송 활동 지표 · 전송금액');assert(await evaluate("!!document.querySelector('.overview-transfer-row svg.market-price-chart')"));
 assert.equal(await evaluate('window.readCalls'),0);assert.equal(await evaluate('typeof ReadableStream.prototype[Symbol.asyncIterator]'),'undefined');assert.equal(requests.filter(u=>!u.startsWith(base+'/')).length,0);assert.equal(requests.filter(u=>u.includes('.json')).length,0);assert.deepEqual(errors,[]);
 publishedUsage=await networkUsageFixture();
 await evaluate(`window.cachedUsage=(await import('${base}/browser-data.js')).cachedJSON;window.arkhamData=await window.cachedUsage('/network-usage-data.json');await window.renderUsageView({index:null,market:null,indexFailed:false,survey:{data:window.usageData,state:'AVAILABLE'},usage:{data:window.arkhamData,state:'AVAILABLE'}});`);
 assert((await evaluate("document.querySelector('.overview-usage .chart-note').textContent")).includes('ARKHAM'));
 assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"전송 활동 지표\"] button').length"),2);
 assert.equal(await evaluate("document.querySelector('.overview-usage tbody tr').cells[3].textContent"),'—');
 assert.equal(await evaluate("document.querySelector('.overview-usage tbody tr').cells[4].textContent"),'<0.01');
 await click('활동 자료 출처 · Allium 기존 저장');assert((await evaluate("document.querySelector('.overview-usage .chart-note').textContent")).includes('ALLIUM'));
 await click('활동 자료 출처 · Arkham 수집 저장');await click('전송 활동 지표 · 전송 건수');
 assert.equal(await evaluate("document.querySelector('.overview-usage tbody tr').cells[2].textContent"),'9,007,199,254,740,993');
 await evaluate("await window.cachedUsage('/network-usage-data.json');await window.renderUsageView({index:null,market:null,indexFailed:false,survey:{data:window.usageData,state:'AVAILABLE'},usage:{data:window.arkhamData,state:'LAST_GOOD'}})");
 assert((await evaluate("document.querySelector('.overview-transfer-row').textContent")).includes('이전 정상 자료'));
 await evaluate("await window.renderUsageView({index:null,market:null,indexFailed:false,survey:{data:window.usageData,state:'AVAILABLE'},usage:{data:null,state:'UNAVAILABLE'}})");
 assert((await evaluate("document.querySelector('#overview-supply').textContent")).includes('ARKHAM 활동 자료 조회 실패'));
 assert.equal(requests.filter(u=>u.includes('/network-usage-data.json')).length,1);assert.equal(requests.filter(u=>!u.startsWith(base+'/')).length,0);assert.deepEqual(errors,[]);
 await mkdir('.state/agent-logs',{recursive:true});await writeFile('.state/agent-logs/network-usage-browser.png',Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
 console.log(JSON.stringify({state:'PASS',views,sourceReads:0,arkhamAPIReads:1,sourceSwitchRequests:0,externalRequests:0,jsErrors:0,safariStreamAPIs:'DISABLED_CHROME_EMULATION'}));
}finally{
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Closing'));}pending.clear();chrome.kill();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));await rm(profile,{recursive:true,force:true});server.closeAllConnections();await new Promise(r=>server.close(r));
}
