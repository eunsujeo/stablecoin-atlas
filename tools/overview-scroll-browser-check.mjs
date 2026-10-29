// Owned offline fixture. Covers native scroll anchoring on/off; not an iPhone run.
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {startPreviewServer} from './ui-preview.mjs';
import {usageV2Fixture} from '../tests/network-usage-v2-fixture.mjs';
let publishedUsage;const server=await startPreviewServer(0,{networkUsageReader:async()=>{if(!publishedUsage)throw Error('NOT_READY');return publishedUsage;}}),base='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(join(tmpdir(),'atlas-usage-browser-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-pipe','--disable-background-networking','--disable-component-update','--disable-sync','--disable-default-apps','--disable-extensions','--no-first-run',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let id=0,buffer='',session;const pending=new Map(),errors=[],requests=[];
chrome.stdio[4].on('data',b=>{buffer+=b.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const v=JSON.parse(raw);if(v.id&&pending.has(v.id)){const p=pending.get(v.id);clearTimeout(p.timer);pending.delete(v.id);v.error?p.reject(Error(p.method+': '+v.error.message)):p.resolve(v.result);}if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails.text);if(v.method==='Network.requestWillBeSent')requests.push(v.params.request.url);if(v.method==='Fetch.requestPaused'){const p=v.params;send(p.request.url.startsWith(base+'/')?'Fetch.continueRequest':'Fetch.failRequest',p.request.url.startsWith(base+'/')?{requestId:p.requestId}:{requestId:p.requestId,errorReason:'BlockedByClient'}).catch(e=>errors.push(e.message));}}});
function send(method,params={},page=true){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},15000);pending.set(n,{resolve,reject,timer,method});chrome.stdio[3].write(JSON.stringify({id:n,method,params,...(page&&session?{sessionId:session}:{})})+'\0');});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,replMode:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;}
async function click(label){await evaluate(`document.querySelector('[aria-label="${label}"]').click()`);}
async function frames(){await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
async function metric(label,keyboard=false){
 const aria='전송 활동 지표 · '+label;
 await evaluate(`window.metricButton=document.querySelector('[aria-label="${aria}"]');metricButton.scrollIntoView({block:'center',behavior:'instant'});metricButton.focus({preventScroll:true});`);await frames();
 const before=await evaluate('({x:scrollX,y:scrollY,minHeight:document.querySelector("#overview-supply").style.minHeight,priority:document.querySelector("#overview-supply").style.getPropertyPriority("min-height")})');assert(before.y>200,'fixture must exercise a scrolled document');
 if(keyboard){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:36,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}
 else{const p=await evaluate(`(()=>{const r=document.querySelector('[aria-label="${aria}"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});}
 await frames();await new Promise(r=>setTimeout(r,350));
 const after=await evaluate('({x:scrollX,y:scrollY,focused:document.activeElement?.getAttribute("aria-label"),selected:document.activeElement?.getAttribute("aria-pressed"),height:document.querySelector("#overview-supply").style.minHeight,priority:document.querySelector("#overview-supply").style.getPropertyPriority("min-height")})');
 assert(Math.abs(after.y-before.y)<=2,JSON.stringify({label,keyboard,before,after}));assert.equal(after.x,before.x);assert.equal(after.focused,aria);assert.equal(after.selected,'true',JSON.stringify({label,keyboard,before,after}));assert.equal(after.height,before.minHeight);assert.equal(after.priority,before.priority);return {label,keyboard,y:after.y};
}
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 for(const method of ['Runtime.enable','Page.enable','Network.enable'])await send(method);
 await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});await send('Page.navigate',{url:base+'/source-review-notes.html'});
 for(let i=0;i<100;i++){if(await evaluate(`location.origin==='${base}'&&document.readyState==='complete'`))break;await new Promise(r=>setTimeout(r,30));}
 await send('Page.setDocumentContent',{frameId:(await send('Page.getFrameTree')).frameTree.frame.id,html:`<!doctype html><html style="overflow-anchor:none"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${base}/styles.css"></head><body><header style="height:300px">Scroll regression fixture</header><main style="margin:0;padding:24px"><section id="overview-supply"></section></main><footer style="height:600px">Keep the scroll target in range after content height changes</footer></body></html>`});
 await evaluate(`window.updateOverview=(await import('${base}/supply-overview.js')).initializeSupplyOverview(document.querySelector('#overview-supply'),{read:()=>{throw Error('NO_DATA_READ');}});await updateOverview({index:null,market:{supplyHistory:[{coinId:'usdc',provider:'DEFILLAMA',metric:'NETWORK_CIRCULATING',to:'2026-10-27',from:'2026-10-21',fetchedAt:'2026-10-28T00:00:00.000Z',networks:[{networkId:'ethereum',points:[{day:'2026-10-21',amount:'100'},{day:'2026-10-27',amount:'200'}]}]}]},indexFailed:false,usage:{state:'AVAILABLE',data:${JSON.stringify(usageV2Fixture())}}});`);
 const views=[];for(const anchoring of ['none','auto'])for(const[width,height]of [[1440,900],[390,844]])for(const theme of ['light','dark']){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate(`document.documentElement.dataset.theme='${theme}';document.documentElement.style.overflowAnchor='${anchoring}'`);await frames();await new Promise(r=>setTimeout(r,150));
  const cases=[];for(const keyboard of [false,true])for(const label of ['전송 건수','전송금액','전송 건수','전송금액'])cases.push(await metric(label,keyboard));views.push({anchoring,width,theme,cases});
 }
 await evaluate("document.querySelector('#overview-supply').style.setProperty('min-height','32px','important')");await metric('전송 건수');
 assert.deepEqual(errors,[]);assert.equal(requests.filter(u=>/^https?:/.test(u)&&!u.startsWith(base+'/')).length,0);assert.equal(requests.filter(u=>u.includes('-data.json')).length,0);
 console.log(JSON.stringify({state:'PASS',views,jsErrors:0,providerRequests:0,databaseReads:0}));
}finally{
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Closing'));}pending.clear();chrome.kill();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));await rm(profile,{recursive:true,force:true});server.closeAllConnections();await new Promise(r=>server.close(r));
}
