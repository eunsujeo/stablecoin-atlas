import {spawn} from 'node:child_process';import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const pageUrl=process.env.KNOWLEDGE_URL??'http://127.0.0.1:54874/',base=new URL(pageUrl).origin,chain=process.env.KNOWLEDGE_CHAIN??'xrpl',out=process.env.KNOWLEDGE_OUTPUT??('docs/design/knowledge/'+chain),profile=await mkdtemp(join(tmpdir(),'atlas-knowledge-'));await mkdir(out,{recursive:true});
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-pipe','--disable-background-networking','--disable-component-update','--disable-sync','--disable-default-apps','--no-first-run',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let id=0,buffer='',session;const pending=new Map(),errors=[],external=[];
function send(method,params={},page=true){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP_TIMEOUT '+method));},20000);pending.set(n,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id:n,method,params,...(page&&session?{sessionId:session}:{})})+'\0');});}
chrome.stdio[4].on('data',bytes=>{buffer+=bytes.toString();let end;while((end=buffer.indexOf('\0'))!==-1){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const m=JSON.parse(raw);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url)&&!m.params.request.url.startsWith(base+'/'))external.push(new URL(m.params.request.url).hostname);}});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expr,timeout=10000){for(let i=0;i<timeout/100;i++){if(await evaluate(expr))return;await sleep(100);}throw Error('WAIT_TIMEOUT '+expr);}
async function viewport(width,height){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});}
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;await send('Runtime.enable');await send('Page.enable');await viewport(1440,900);
 const results=[];
 for(const chain of ['xrpl','tron','solana','base']){
 await send('Page.navigate',{url:pageUrl+'#'+chain});await until('!!window.knowledgeSnapshot');
 for(const condition of ['initial','network-switch','while-playing','pause-resume','seek-resume','scenario-change','rewind']){
 const r=await evaluate(`(async()=>{
 const q=s=>document.querySelector(s),change=(s,v)=>{q(s).value=v;q(s).dispatchEvent(new Event('change',{bubbles:true}));},click=s=>q(s).click(),raf=()=>new Promise(r=>requestAnimationFrame(r));
 if(knowledgeSnapshot.playing)click('#play');click('#restart');
 if(${JSON.stringify(condition)}==='network-switch'){change('#network-select','ethereum');change('#network-select',${JSON.stringify(chain)});}
 if(${JSON.stringify(condition)}==='while-playing'){change('#speed','1');click('#play');await new Promise(r=>setTimeout(r,200));}
 change('#speed','0.5');
 if(${JSON.stringify(condition)}==='pause-resume'){click('#play');await raf();click('#play');}
 if(${JSON.stringify(condition)}==='seek-resume'){q('#timeline').value=3;q('#timeline').dispatchEvent(new Event('input'));}
 if(${JSON.stringify(condition)}==='scenario-change')change('#network-scenario',[...q('#network-scenario').options][1].value);
 if(${JSON.stringify(condition)}==='rewind'){q('#timeline').value=4;q('#timeline').dispatchEvent(new Event('input'));click('#restart');}
 if(!knowledgeSnapshot.playing)click('#play');await raf();await raf();
 const start=performance.now(),before=knowledgeSnapshot;await new Promise(r=>setTimeout(r,1200));await raf();const end=performance.now(),after=knowledgeSnapshot;click('#play');
 return {wallSeconds:(end-start)/1000,presentationDelta:after.playbackTime-before.playbackTime,modelDelta:after.t-before.t,speed:after.speed,domSpeed:q('#speed').value,ratio:(after.playbackTime-before.playbackTime)/((end-start)/1000)};
 })()`);
 assert.equal(r.speed,.5);assert.equal(r.domSpeed,'0.5');assert(Math.abs(r.ratio-.5)<.04,JSON.stringify(r));results.push({chain,condition,...r});
 }
 }
 await writeFile(out+'/rate-measurements.json',JSON.stringify({status:'PASS',method:'Browser performance.now and presentationTime sampled in-page across 1.2 second windows; CDP latency excluded. Native select change events dispatched.',results},null,2));console.log('RATE_PASS '+results.length+' '+Math.min(...results.map(r=>r.ratio))+'..'+Math.max(...results.map(r=>r.ratio)));
}finally{for(const p of pending.values())clearTimeout(p.timer);chrome.kill();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
