// Owned offline fixture only. Chrome with Safari stream APIs disabled is emulation, not an iPhone test.
import {spawn} from 'node:child_process';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {startPreviewServer} from './ui-preview.mjs';
import {surveyDto} from '../tests/survey-fixture.mjs';
import {usageV2Fixture} from '../tests/network-usage-v2-fixture.mjs';
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
 for(const method of ['Runtime.enable','Page.enable','Network.enable'])await send(method);await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Page.navigate',{url:base+'/source-review-notes.html'});for(let i=0;i<100;i++){if(await evaluate(`location.origin==='${base}'&&document.readyState==='complete'`))break;await new Promise(r=>setTimeout(r,30));}
 await send('Page.setDocumentContent',{frameId:(await send('Page.getFrameTree')).frameTree.frame.id,html:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${base}/styles.css"></head><body><main><section id="overview-supply"></section></main></body></html>`});
 publishedUsage=usageV2Fixture();const oldSurvey=await surveyDto();
 await evaluate(`Object.defineProperty(ReadableStream.prototype,Symbol.asyncIterator,{value:undefined,configurable:true});Object.defineProperty(AbortSignal,'any',{value:undefined,configurable:true});window.updateUsage=(await import('${base}/supply-overview.js')).initializeSupplyOverview(document.querySelector('#overview-supply'),{read:()=>{throw Error('NO_READ');}});window.cachedUsage=(await import('${base}/browser-data.js')).cachedJSON;window.oldSurvey=${JSON.stringify(oldSurvey)};window.usageSnapshot=await cachedUsage('/network-usage-data.json');await updateUsage({index:null,market:null,indexFailed:false,survey:{data:oldSurvey,state:'AVAILABLE'},usage:{data:usageSnapshot,state:'AVAILABLE'}});`);
 const views=[];for(const[width,height]of [[1440,1100],[390,1100]])for(const theme of ['light','dark']){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate(`document.documentElement.dataset.theme='${theme}';new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="활동 자료 출처"]')===null`),true);assert.equal(await evaluate(`document.querySelector('#overview-supply').textContent.includes('Allium')`),false);
  assert.equal(await evaluate(`document.querySelector('.overview-usage')===null`),true);
  assert.equal(await evaluate(`document.querySelector('#overview-supply').textContent.includes('전송 이벤트당 평균')`),false);
  for(const[label,unit]of [['전송금액','USD'],['전송 건수','건']]){await click('전송 활동 지표 · '+label);assert.equal(await evaluate(`document.querySelector('.overview-transfer-row .network-axis-title').textContent`),unit);assert.equal(await evaluate(`document.querySelectorAll('[aria-label="전송 활동 지표"] button').length`),2);}
  assert.equal(await evaluate(`document.querySelector('.overview-donut-card svg title').textContent.includes('9,007,199,254,740,993')`),true);views.push({width,theme});
 }
 await evaluate(`await updateUsage({index:null,market:null,indexFailed:false,survey:{data:oldSurvey,state:'AVAILABLE'},usage:{data:usageSnapshot,state:'LAST_GOOD'}})`);assert((await evaluate(`document.querySelector('#overview-supply').textContent`)).includes('이전 정상 자료'));
 await evaluate(`await updateUsage({index:null,market:null,indexFailed:false,survey:{data:oldSurvey,state:'AVAILABLE'},usage:{data:null,state:'UNAVAILABLE'}})`);const failed=await evaluate(`document.querySelector('#overview-supply').textContent`);assert(failed.includes('ARKHAM 활동 자료 조회 실패'));assert(!failed.includes('Allium'));assert.equal(await evaluate(`document.querySelector('.overview-transfer-row')===null`),true);
 assert.equal(requests.filter(u=>u.includes('/network-usage-data.json')).length,1);assert.equal(requests.filter(u=>/\/(survey|activity|geography|reviewed-supply)-data\.json/.test(u)).length,0);assert.equal(requests.filter(u=>/^https?:/.test(u)&&!u.startsWith(base+'/')).length,0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({state:'PASS',views,sourcePicker:false,alliumDisplayed:false,alliumRequests:0,fallback:false,arkhamReads:1,externalRequests:0,jsErrors:0,safariStreamAPIs:'DISABLED_CHROME_EMULATION'}));
}finally{
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Closing'));}pending.clear();chrome.kill();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));await rm(profile,{recursive:true,force:true});server.closeAllConnections();await new Promise(r=>server.close(r));
}
