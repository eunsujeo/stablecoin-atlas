import {presentationTime} from './pacing.mjs';
import {spawn} from 'node:child_process';import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const base='http://127.0.0.1:54874',out='docs/design/ethereum-learning/slots',profile=await mkdtemp(join(tmpdir(),'atlas-knowledge-'));await mkdir(out,{recursive:true});
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
async function click(q){await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const box=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(q)});n.scrollIntoView({block:'nearest'});const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function seek(t){const mode=await evaluate("knowledgeSnapshot.lesson==='slots'?knowledgeSnapshot.model.transactions.scenario:null"),value=presentationTime(t,mode);await evaluate(`(()=>{const e=document.querySelector('#timeline');e.value=${value};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function layout(){const d=await evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})');assert(d.scroll<=d.w+1,JSON.stringify(d));}
async function verify(desktop){
 const result=await evaluate(`(()=>{
  const q=x=>document.querySelector(x),s=knowledgeSnapshot,stage=q(s.lesson==='consensus'?'#stage':'#lesson-stage'),hiddenStage=q(s.lesson==='consensus'?'#lesson-stage':'#stage'),rect=n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};
  const bounds=['.heading-row','.kpis','.lab','.narrative','.transport','.lesson-foot'].map(k=>({k,...rect(q(k))}));
  const clipped=[...stage.querySelectorAll('text')].filter(n=>{const r=rect(n),v=rect(stage);return n.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&(r.x<v.x-1||r.right>v.right+1||r.y<v.y-1||r.bottom>v.bottom+1)}).map(n=>n.textContent);
  const overflow=[...document.querySelectorAll('.kpi,.narrative,.visual,.transport')].filter(n=>n.scrollHeight>n.clientHeight+2||n.scrollWidth>n.clientWidth+2).map(n=>n.className);
  let mismatch=[],objects=[];
  if(s.lesson!=='consensus'){
   [...document.querySelectorAll('.kpi')].forEach((n,i)=>{const actual=[n.firstElementChild.textContent,n.querySelector('strong').textContent,n.lastElementChild.textContent];if(JSON.stringify(actual)!==JSON.stringify(s.kpi.kpis[i]))mismatch.push({actual,expected:s.kpi.kpis[i]});});
   if(q('#action-sentence').textContent!==s.kpi.sentence||q('#chapter-note').textContent!==s.kpi.reason)mismatch.push('narrative');
   for(const n of stage.querySelectorAll('[data-object]')){
    const id=n.dataset.object;if(s.lesson==='slots'&&id.startsWith('slot:')){const slot=s.model.slots.find(x=>x.slot===Number(id.slice(5))),b=s.model.blocks.find(x=>x.id===slot.block);if(n.dataset.status!==slot.status||n.dataset.block!==(slot.block??'')||n.dataset.parent!==(b?.parent??''))objects.push(id);}
    if(s.lesson==='fork'){const b=s.model.blocks.find(x=>x.id===id);if(b&&(n.dataset.parent!==(b.parent??'')||n.dataset.canonical!==String(s.model.path.includes(id))||n.dataset.known!==String(s.model.known.includes(id))))objects.push(id);if(n.getAttribute('visibility')!==(b?'visible':'hidden'))objects.push('visibility '+id);}
   }
   if(s.lesson==='fork'){const expected=s.model.latest.map(m=>m.root).sort();const actual=[...q('#lesson-rail').children].map(n=>n.dataset.vote).filter(Boolean).sort();if(JSON.stringify(actual)!==JSON.stringify(expected))objects.push('votes');}
  }
  return {bounds,clipped,overflow,mismatch,objects,stageVisible:stage.checkVisibility(),otherHidden:!hiddenStage.checkVisibility(),w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollHeight,scrollW:document.documentElement.scrollWidth};
 })()`);
 assert(result.stageVisible&&result.otherHidden,'Exactly one matching renderer must be visible');assert.deepEqual(result.mismatch,[],'KPI and narrative mismatch');assert.deepEqual(result.objects,[],'Block links/votes mismatch');assert.deepEqual(result.clipped,[],'SVG clipping');assert.deepEqual(result.overflow,[],'Panel overflow');assert(result.scrollW<=result.w+1,'Horizontal overflow');
 if(desktop){assert(result.scroll<=result.h+1,'Desktop vertical overflow '+JSON.stringify(result));assert(result.bounds.every(b=>b.y>=0&&b.bottom<=result.h+1),'Core outside viewport');}
}
async function switchLesson(mode){await click('[data-lesson="'+mode+'"]');assert.equal(await evaluate('knowledgeSnapshot.lesson'),mode);assert.equal(await evaluate('knowledgeSnapshot.t'),0);assert.equal(await evaluate('knowledgeSnapshot.playing'),false);assert.equal(await evaluate("document.querySelector('.compare').hidden"),mode!=='consensus');}
try{
 const target=await send('Target.createTarget',{url:'about:blank'},false);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;for(const method of ['Runtime.enable','Page.enable','Network.enable'])await send(method);
 await viewport(1440,900);await send('Page.navigate',{url:base+'/'});await until('!!window.knowledgeSnapshot');
 for(const [w,h]of [[1440,900],[1280,800],[390,844],[360,800]]){
  await viewport(w,h);
  for(const t of [0,2.3,9,11.99,12,14.4,24]){
   await seek(t);await verify(w>760);
   assert.equal(await evaluate("document.querySelectorAll('.slot-time-cell[data-current=true]').length"),t===24?0:1);
   const cells=await evaluate("[...document.querySelectorAll('.slot-time-cell')].map(n=>({elapsed:Number(n.dataset.elapsed),status:n.dataset.status}))");
   const model=await evaluate('knowledgeSnapshot.model');assert.deepEqual(cells,model.slots.map(q=>({elapsed:q.elapsed,status:q.status})));
   assert.equal(await evaluate("[...document.querySelectorAll('.slot-result-block')].filter(n=>n.getAttribute('visibility')==='visible').length"),model.blocks.length);
   await shot(`${w}-slots-${t}`);
  }
 }
 await viewport(1280,800);
 for(const [time,slot,expected]of [[0,3203,['Scheduled','없음']],[9,3202,['Waiting','3.0 / 12초','없음']],[12,3202,['Missed','12.0 / 12초','없음']],[14,3203,['Proposed','#703','#702']]]){
  await seek(time);await click('[data-object="slot:'+slot+'"]');const detail=await evaluate("document.querySelector('#slot-detail-grid').textContent");for(const value of expected)assert(detail.includes(value),detail);await shot('selected-'+slot+'-'+time);await click('[data-close="detail-dialog"]');
 }
 for(const speed of [.5,1,1.5,2]){await click('#restart');await evaluate(`document.querySelector('#speed').value='${speed}';document.querySelector('#speed').dispatchEvent(new Event('change'))`);await click('#play');await sleep(650);await click('#play');const s=await evaluate('knowledgeSnapshot');assert(s.playbackTime>.4*speed&&s.playbackTime<1.3*speed);assert.equal(s.model.current.duration,12);assert(Math.abs(s.model.current.elapsed-s.t*3)<1e-8);}
 await seek(14.4);const before=await evaluate("document.querySelector('#lesson-stage').outerHTML");await seek(0);await seek(24);await seek(14.4);assert.equal(await evaluate("document.querySelector('#lesson-stage').outerHTML"),before);
 await writeFile(out+'/verification.json',JSON.stringify({status:'PASS',viewports:['1440x900','1280x800','390x844','360x800'],checks:['slot elapsed/status match model','current slot only','actual block count','future/waiting/missed/proposed selection details','parent across skipped slot','0.5/1/2x actual playback clocks','rewind exact SVG','KPI/narrative sync','no desktop overflow or SVG clipping'],jsErrors:errors},null,2));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('SLOT_BROWSER_PASS');
}finally{for(const p of pending.values())clearTimeout(p.timer);pending.clear();chrome.kill();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
