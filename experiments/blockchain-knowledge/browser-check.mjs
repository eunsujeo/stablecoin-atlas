import {spawn} from 'node:child_process';import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const base='http://127.0.0.1:54874',out='docs/design/ethereum-learning/ux',profile=await mkdtemp(join(tmpdir(),'atlas-knowledge-'));await mkdir(out,{recursive:true});
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-pipe','--disable-background-networking','--disable-component-update','--disable-sync','--disable-default-apps','--no-first-run',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let id=0,buffer='',session;const pending=new Map(),errors=[],external=[];
function send(method,params={},page=true){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP_TIMEOUT '+method));},20000);pending.set(n,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id:n,method,params,...(page&&session?{sessionId:session}:{})})+'\0');});}
chrome.stdio[4].on('data',bytes=>{buffer+=bytes.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const m=JSON.parse(raw);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url)&&!m.params.request.url.startsWith(base+'/'))external.push(new URL(m.params.request.url).hostname);}});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expr,timeout=10000){for(let i=0;i<timeout/100;i++){if(await evaluate(expr))return;await sleep(100);}throw Error('WAIT_TIMEOUT '+expr);}
async function shot(name){await evaluate('scrollTo(0,0)');await evaluate('document.fonts.ready.then(()=>true)');const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(out+'/'+name+'.png',Buffer.from(r.data,'base64'));}
async function shotScene(name){await evaluate('scrollTo(0,0)');const clip=await evaluate("(()=>{const r=document.querySelector('.lab').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1};})()");const r=await send('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true});await writeFile(out+'/'+name+'.png',Buffer.from(r.data,'base64'));}
async function viewport(width,height){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<761});await sleep(150);}
async function click(q){const box=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(q)});n.scrollIntoView({block:'nearest'});const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function seek(t){await evaluate(`(()=>{const e=document.querySelector('#timeline');e.value=${t};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function verifyScene(desktop=false){
 const r=await evaluate(`(()=>{
 const s=knowledgeSnapshot,v=s.kpi,q=x=>document.querySelector(x),rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,right:r.right}};
 const expected={'#kpi-proposer':v.proposer,'#kpi-verified':v.verified+' / 8','#kpi-stake':v.weight+' / '+v.total,'#kpi-status':v.block,'#action-sentence':v.sentence,'#chapter-note':v.reason};
 const mismatch=Object.entries(expected).filter(([k,value])=>q(k).textContent!==value);
 const bounds=['.heading-row','.kpis','.lab','.narrative','.transport','.lesson-foot'].map(k=>({k,...rect(q(k))}));
 const legend=rect(q('.object-legend'));const clipped=[...q('#stage').querySelectorAll('text')].filter(n=>{const r=rect(n),svg=rect(q('#stage'));return n.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.w>0&&(r.x<svg.x-1||r.right>svg.right+1||r.y<svg.y-1||r.b>svg.b+1)}).map(n=>n.textContent);
 const overflow=[...document.querySelectorAll('.kpi,.narrative,.transport,.visual')].filter(n=>n.scrollHeight>n.clientHeight+2||n.scrollWidth>n.clientWidth+2).map(n=>n.className);
 return {mismatch,bounds,clipped,overflow,h:innerHeight,scroll:document.documentElement.scrollHeight,legend,active:[...q('#stage').querySelectorAll('[data-active=true]')].map(n=>Number(n.dataset.select.split(':')[1])),expectedActive:v.activePeers};
 })()`);
 assert.deepEqual(r.mismatch,[],'KPI/model mismatch');assert.deepEqual(r.clipped,[],'SVG text clipped');assert.deepEqual(r.overflow,[],'Panel overflow');assert.deepEqual(r.active,r.expectedActive,'active actors differ');
 if(desktop){assert(r.scroll<=r.h+1,'Desktop vertical overflow '+JSON.stringify(r));for(const b of r.bounds)assert(b.y>=0&&b.b<=r.h+1,'Core panel offscreen '+JSON.stringify(b));}
 return r.legend;
}
async function layout(){const d=await evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})');assert(d.scroll<=d.w+1,JSON.stringify(d));}
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;for(const method of ['Runtime.enable','Page.enable','Network.enable'])await send(method);
 await viewport(1440,900);await send('Page.navigate',{url:base+'/'});await until('!!window.knowledgeSnapshot');await click('[data-lesson="consensus"]');await shot('01-start');await layout();
 if(process.argv.includes('--quick')){await seek(10.8);await shot('02-validation');await viewport(1280,800);await shot('laptop-middle');await seek(24);await shot('03-finality');await viewport(390,1100);await shot('mobile');console.log('QUICK_RENDER_PASS');}
 else{
  // Full viewport fit, all boundary states, both scenarios, deterministic UI projection.
  for(const [w,h] of [[1440,900],[1280,800]]){
   await viewport(w,h);let legend=null;
   for(const scenario of ['normal','offline']){
    await click('[data-scenario="'+scenario+'"]');
    for(const t of [0,1.8,3,4.8,6,6.8,9,10.8,12,14.1,15.9,16,17,18,20,21.99,22,24]){
     await seek(t);await layout();const next=await verifyScene(true);if(legend)assert.deepEqual(next,legend,'Legend shifts between stages');legend=next;
     if([0,10.8,24].includes(t))await shot(`${w}-${scenario}-${t}`);
    }
   }
  }
  await click('[data-scenario="normal"]');await viewport(1440,900);await seek(0);
  // Real pointer scrubbing plus native range keyboard endpoints.
  const range=await evaluate("(()=>{const r=document.querySelector('#timeline').getBoundingClientRect();return{x:r.x+r.width*.5,y:r.y+r.height/2}})()");
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...range});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...range});assert(Math.abs(await evaluate('knowledgeSnapshot.t')-12)<.5);await verifyScene(true);
  for(const [key,code,time]of [['End',35,24],['Home',36,0]]){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});assert.equal(await evaluate('knowledgeSnapshot.t'),time);await verifyScene(true);}
  await click('#play');await until('knowledgeSnapshot.t>2');await click('#play');const paused=await evaluate('knowledgeSnapshot.t');await sleep(250);assert.equal(await evaluate('knowledgeSnapshot.t'),paused);
  await click('#restart');await click('#play');await until('!knowledgeSnapshot.playing&&knowledgeSnapshot.t===24',30000);assert.equal(await evaluate('knowledgeSnapshot.blockStatus'),'finalized');
  const perf=await evaluate('knowledgePerformance()');const sorted=perf.frameIntervalsMs.filter(n=>n<1000).sort((a,b)=>a-b),renders=perf.renderMs.sort((a,b)=>a-b);const stats={frames:sorted.length,medianFrameMs:sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)],p95RenderMs:renders[Math.floor(renders.length*.95)],over25ms:sorted.filter(n=>n>25).length,svgElements:perf.svgElements};console.log('PERFORMANCE '+JSON.stringify(stats));
  for(const [name,t]of [['01-start',0],['02-build',4.8],['03-propagation',6.8],['04-validation',10.8],['05-votes',15],['06-justified',17],['07-finality',24]]){await seek(t);await shot(name);if([0,10.8,24].includes(t))await shotScene('scene-'+t);}
  await seek(10.8);const first=await evaluate("document.querySelector('#stage').outerHTML");await seek(24);await seek(10.8);assert.equal(await evaluate("document.querySelector('#stage').outerHTML"),first);
  await click('#next');assert.equal(await evaluate('knowledgeSnapshot.t'),12);await click('#prev');assert.equal(await evaluate('knowledgeSnapshot.t'),9);
  await evaluate("document.querySelector('[data-select=\"peer:2\"]').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});assert.equal(await evaluate('knowledgeSnapshot.selected'),'peer:2');assert.match(await evaluate("document.querySelector('#detail-title').textContent"),/V03/);
  await click('[data-close="detail-dialog"]');await click('[data-select="block"]');assert.equal(await evaluate('knowledgeSnapshot.selected'),'block');await seek(24);assert.match(await evaluate("document.querySelector('#detail-technical').textContent"),/FINALIZED/);await click('[data-close="detail-dialog"]');assert.equal(await evaluate("document.querySelector('#detail-dialog').open"),false);
  await click('[data-scenario="offline"]');assert.equal(await evaluate('knowledgeSnapshot.t'),24);assert.equal(await evaluate('knowledgeSnapshot.blockStatus'),'accepted');assert.equal(await evaluate("document.querySelector('[data-checkpoint=\"100\"]').dataset.state"),'proposed');await shot('08-offline');
  await click('[data-scenario="normal"]');assert.equal(await evaluate('knowledgeSnapshot.blockStatus'),'finalized');
  for(const speed of [.5,2]){await click('#restart');await evaluate(`document.querySelector('#speed').value='${speed}';document.querySelector('#speed').dispatchEvent(new Event('change'))`);await click('#play');await sleep(600);await click('#play');const t=await evaluate('knowledgeSnapshot.t');assert(t>.35*speed&&t<1.1*speed);}
  for(const [w,h] of [[390,844],[360,800]]){await viewport(w,h);for(const scenario of ['normal','offline']){await click('[data-scenario="'+scenario+'"]');for(const t of [0,6.8,11,17,24]){await seek(t);await layout();await verifyScene();await shot(`${w}-${scenario}-${t}`);}}}
  await click('[data-scenario="normal"]');await seek(11);await shot('09-mobile');
  await evaluate("document.querySelector('#next').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});assert.equal(await evaluate('knowledgeSnapshot.t'),12);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await until('knowledgeSnapshot.reduced');assert.equal(await evaluate("document.querySelector('#play').disabled"),true);await click('#next');assert.equal(await evaluate('knowledgeSnapshot.t'),18);await shot('11-reduced-motion');
  await viewport(1280,800);await verifyScene(true);await click('#open-reference');assert.equal(await evaluate("document.querySelector('#reference-dialog').open"),true);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.equal(await evaluate("document.activeElement.id"),'open-reference');
  await viewport(1440,900);await send('Emulation.setScriptExecutionDisabled',{value:true});await send('Page.reload');await sleep(400);await shot('12-no-javascript');
  assert.equal(errors.length,0);assert.equal(external.length,0);await writeFile(out+'/verification.json',JSON.stringify({state:'PASS',stats,jsErrors:errors,externalRequests:external,checks:['24s real playback','pause','restart','rewind identical SVG','steps','speed 0.5/2','selection','normal/offline same time','1440x900 and 1280x800 no scroll across all boundaries and both scenarios','fixed legend bounds','KPI/model/active roles synchronized','SVG and panel clipping','360/390 layout','keyboard','pointer scrubbing and Home/End','native dialog Escape and focus restoration','reduced-motion','no-JS narrative']},null,2));console.log('PASS: deterministic interactive prototype and accessibility checks');
 }
}finally{for(const p of pending.values())clearTimeout(p.timer);pending.clear();chrome.kill();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
