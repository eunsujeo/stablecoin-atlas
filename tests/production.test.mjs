import test from 'node:test';
import assert from 'node:assert/strict';
import {request,createServer} from 'node:http';
import {mkdtemp,writeFile,readFile,mkdir,symlink,readlink,unlink,stat,readdir,rm,open} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {startPreviewServer} from '../tools/ui-preview.mjs';
import {productionDocument,validatePublicHosts,publicAssets} from '../tools/production-policy.mjs';
import {productionConnector} from '../tools/production-database.mjs';
import {stageRelease} from '../tools/release-stage.mjs';
import {activateRelease,checkWebHealth} from '../tools/release-switch.mjs';
import {loopbackRequest} from '../tools/loopback-http.mjs';
import {publishPublicFX,readPublicFX} from '../tools/publish-production-fx.mjs';
import {databaseFXReader} from '../tools/market-db/fx-preview.mjs';
import {storeFX} from '../tools/fx-store.mjs';
import {productionSettings,startProduction} from '../tools/production-web.mjs';
const sha='a'.repeat(40),host='atlas.example.com';
const env={DATABASE_URL:'postgresql://reader:SECRET_CANARY@database.invalid/db?sslmode=verify-full'};
const read=(port,path,headers={},method='GET')=>new Promise((resolve,reject)=>{
  const req=request({hostname:'127.0.0.1',port,path,headers:{host,...headers},method},res=>{let body='';res.setEncoding('utf8');res.on('data',b=>body+=b);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end();
});
test('public mode permits exact tunnel Host/HTTPS Origin and health, never trusts forwarding or exposes private routes',async()=>{
  let reads=0;const reader=async()=>{reads++;throw Error('SECRET_CANARY postgresql://private.example');};
  const server=await startPreviewServer(0,{production:{hosts:[host],commit:sha},marketReader:reader,registrationReader:reader,activityReader:reader,reviewedSupplyReader:reader,surveyReader:reader,fxReader:reader});
  const port=server.address().port;
  try{
    assert.equal(server.address().address,'127.0.0.1');
    for(const headers of [{},{origin:'https://'+host},{'x-forwarded-host':'untrusted.example','forwarded':'host=untrusted.example'}])assert.equal((await read(port,'/',headers)).status,200);
    for(const headers of [{host:'evil.example'},{host:'evil.example','x-forwarded-host':host},{origin:'http://'+host},{origin:'https://evil.example'},{origin:'null'},{'sec-fetch-site':'cross-site'},{host:host+':443'}])assert.equal((await read(port,'/',headers)).status,403);
    assert.equal((await read(port,'/',{host:`127.0.0.1:${port}`})).status,403);
    for(const method of ['GET','HEAD']){
      const r=await read(port,'/healthz',{host:`127.0.0.1:${port}`},method);assert.equal(r.status,200);if(method==='GET')assert.deepEqual(JSON.parse(r.body),{status:'ok',commit:sha});else assert.equal(r.body,'');
      for(const path of ['/mock-data.json','/app.js','/model.js','/evidence.js','/evidence/index.json','/evidence/'+sha+'.html','/%65vidence/index.json','/evidence/index.json?x=1','/geography-data.json','/.env.local','/reports/x','/source-intake/x','/atlas.html','/healthz?x=1','/market-data.json?x=1'])assert.equal((await read(port,path,{},method)).status,404,path);
    }
    const navigation={'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'};
    assert.equal((await read(port,'/',navigation)).status,200);
    for(const path of ['/?coin=usdc','/index.html','/index.html?coin=usdc','/source-review-notes.html'])assert.equal((await read(port,path,navigation)).status,200,path);
    assert.equal((await read(port,'/legacy.html?coin=usdc',navigation)).status,308);
    assert.equal((await read(port,'/source-review-notes.html?x=1',navigation)).status,404);
    for(const headers of [{...navigation,'sec-fetch-dest':'iframe'},{...navigation,'sec-fetch-mode':'cors'},{'sec-fetch-site':'cross-site','sec-fetch-dest':'document'},{...navigation,host:'wrong.example'}])assert.equal((await read(port,'/',headers)).status,403);
    assert.equal((await read(port,'/',navigation,'POST')).status,405);
    assert.equal((await read(port,'/market-data.json',navigation)).status,403);
    assert.equal((await read(port,'/',{...navigation,origin:'https://evil.example'})).status,403);
    assert.equal(reads,0);
    const html=(await read(port,'/')).body;
    assert(!html.includes('MOCK'));assert(!html.includes('/app.js'));assert(!html.includes('reports-screen'));assert(!html.includes('overview-read-history'));assert(html.includes('data-deployment="production"'));
    assert.equal((await read(port,'/production.js')).status,200);
    const failure=await read(port,'/market-data.json');assert.equal(failure.status,503);assert.equal(failure.body,'MARKET_DATA_UNAVAILABLE');assert(!failure.body.includes('SECRET'));
    assert.equal((await read(port,'/registration-index.json')).status,503);
    assert.equal((await read(port,'/',{},'POST')).status,405);
    assert.equal((await read(port,'/legacy.html?coin=usdc')).headers.location,'/?coin=usdc');
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('production template fails closed on layout drift and configuration never accepts wildcard or credential env mixing',async()=>{
  assert.throws(()=>productionDocument(Buffer.from('<html>changed</html>')),/TEMPLATE/);
  for(const hosts of [[],['*'],['https://atlas.example.com'],['atlas.example.com:443'],['atlas.example.com\r\nx:y'],['UPPER.example']])assert.throws(()=>validatePublicHosts(hosts));
  const root=await mkdtemp(join(tmpdir(),'atlas-production-config-'));
  try{
    const configFile=join(root,'web.json'),readerFile=join(root,'reader.env'),revisionFile=join(root,'REVISION');
    await writeFile(configFile,JSON.stringify({hosts:[host],port:4173,fxFile:'/tmp/fx.json'}));await writeFile(revisionFile,sha);
    await writeFile(readerFile,'DATABASE_URL='+env.DATABASE_URL+'\nARKM_API_KEY=SECRET_CANARY\n',{mode:0o600});
    await assert.rejects(productionSettings({configFile,readerFile,revisionFile}),/READER_CONFIG/);
    await writeFile(readerFile,'DATABASE_URL='+env.DATABASE_URL+'\n');assert.equal((await productionSettings({configFile,readerFile,revisionFile})).commit,sha);
    await symlink(readerFile,join(root,'link.env'));await assert.rejects(productionSettings({configFile,readerFile:join(root,'link.env'),revisionFile}),/PRIVATE/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('all readers share a bounded connector, queued saturation and failures release slots without logging credentials',async()=>{
  let opened=0;const connector=productionConnector(env,{limit:1,queueLimit:1,queueTimeout:50,open:async()=>{opened++;return {query:async()=>({rows:[]}),end:async()=>{opened--;}};},verify:async()=>{}});
  const a=await connector.connect(),pending=connector.connect();await assert.rejects(connector.connect(),/BUSY/);assert.equal(opened,1);
  await a.end();const b=await pending;assert.equal(opened,1);await b.end();await b.end();assert.equal(connector.active,0);
  const c=await connector.connect();await assert.rejects(connector.connect(),/BUSY/);await c.end();await connector.close();
  const failed=productionConnector(env,{open:async()=>{throw Error('SECRET_CANARY');}});await assert.rejects(failed.connect(),e=>!e.message.includes('SECRET'));assert.equal(failed.active,0);await failed.close();
  assert.throws(()=>productionConnector({DATABASE_URL:'postgresql://reader:x@127.0.0.1/db'}),/TLS_REQUIRED/);
});
test('release switching validates SHA, restarts only web, and restores a healthy previous commit after failure',async()=>{
  const root=await mkdtemp(join(tmpdir(),'atlas-release-')),old='b'.repeat(40);let restarts=0,stops=0;
  try{
    for(const s of [sha,old]){await mkdir(join(root,'releases',s),{recursive:true});await writeFile(join(root,'releases',s,'REVISION'),s);}
    await symlink(join(root,'releases',old),join(root,'current'));
    const options={root,sha,restart:async()=>{restarts++;},stop:async()=>{stops++;},health:async s=>s===old};
    await assert.rejects(activateRelease(options),/ROLLED_BACK/);assert.equal(await readlink(join(root,'current')),join(root,'releases',old));assert.equal(restarts,2);assert.equal(stops,0);
    assert.equal((await activateRelease({...options,health:async()=>true})).commit,sha);assert.equal(await readlink(join(root,'previous')),join(root,'releases',old));
    await activateRelease({...options,sha:'previous',rollback:true,health:async()=>true});assert.equal(await readlink(join(root,'current')),join(root,'releases',old));
    await assert.rejects(activateRelease({...options,sha:'../escape'}),/SHA/);
    await unlink(join(root,'current'));
    await assert.rejects(activateRelease({...options,health:async()=>false}),/FIRST_DEPLOY_FAILED_STOPPED/);assert.equal(stops,1);
    await mkdir(join(root,'.deployment-lock'));await assert.rejects(activateRelease(options));
  }finally{await rm(root,{recursive:true,force:true});}
});
test('SIGTERM closes the actual loopback HTTP process with zero exit, without private evidence or a provider',async()=>{
  const moduleURL=new URL('../tools/production-web.mjs',import.meta.url).href;
  const script=`import {startProduction,installProductionSignals} from ${JSON.stringify(moduleURL)};const connector={connect:async()=>({end:async()=>{}}),close:async()=>{}};const app=await startProduction({config:{port:0,hosts:['${host}'],fxFile:'/nonexistent'},env:{},commit:'${sha}'},{connector});installProductionSignals(app);console.log('READY');`;
  const child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['ignore','pipe','pipe']});let output='',errors='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>errors+=b);
  const completed=once(child,'exit');try{for(let i=0;i<100&&!output.includes('READY');i++)await new Promise(r=>setTimeout(r,25));assert(output.includes('READY'),errors);child.kill('SIGTERM');const [code,signal]=await completed;assert.equal(code,0);assert.equal(signal,null);assert.equal(errors,'');}finally{if(child.exitCode===null)child.kill('SIGKILL');}
});

test('FX publication exposes only verified projection, preserves pre-rename failures and distinguishes post-rename durability failure',async t=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-public-fx-')),oldMask=process.umask(0o077);
 try{
  const at=new Date().toISOString(),day=at.slice(0,10),input=join(root,'fixture.xml'),source=join(root,'private'),target=join(root,'fx.json');
  const xml=`<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><gesmes:subject>Reference rates</gesmes:subject><gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender><Cube><Cube time='${day}'><Cube currency='USD' rate='2'/><Cube currency='KRW' rate='2000'/></Cube></Cube></gesmes:Envelope>`;
  await writeFile(input,xml);await storeFX({directory:source,source:input,at});await publishPublicFX(source,target);
  const before=await readFile(target),data=JSON.parse(before);assert.equal(data.kind,'ECB_REFERENCE_FX');assert.equal((await stat(target)).mode&0o777,0o640);assert(!before.toString().includes('Envelope'));
  const blocked=join(root,'blocked');await mkdir(blocked);await assert.rejects(publishPublicFX(source,blocked));assert.deepEqual(await readFile(target),before);assert(!(await readdir(root)).some(n=>n.startsWith('.fx-')));
  const uncertain=join(root,'uncertain.json');await writeFile(uncertain,JSON.stringify({...data,usdPerEUR:'9'}));
  const probe=await open(target,'r'),prototype=Object.getPrototypeOf(probe),originalSync=prototype.sync;await probe.close();
  const sync=t.mock.method(prototype,'sync',async function(){if((await this.stat()).isDirectory())throw Error('injected directory sync failure');return originalSync.call(this);});
  try{await assert.rejects(publishPublicFX(source,uncertain),/PUBLIC_FX_DURABILITY_UNCONFIRMED/);assert.deepEqual(await readFile(uncertain),before);}finally{sync.mock.restore();}
  await writeFile(join(source,'archive',data.sourceHash+'.xml'),'corrupt');await assert.rejects(publishPublicFX(source,target));assert.deepEqual(await readFile(target),before);
 }finally{process.umask(oldMask);await rm(root,{recursive:true,force:true});}
});

test('production FX endpoint uses DB, rejects invalid/expired/missing data, ignores local file and recovers without restart',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-production-fx-')),target=join(root,'fx.json');let app,current;
 try{
  const connector={connect:async()=>({end:async()=>{}}),close:async()=>{}};
  app=await startProduction({config:{port:0,hosts:[host],fxFile:target},env:{},commit:sha},{connector,fxReader:databaseFXReader({connect:connector.connect,read:async()=>{if(!current)throw Error('SECRET_CANARY');return JSON.parse(current);}})});
  const port=app.server.address().port,now=new Date().toISOString();
  const good={schemaVersion:1,kind:'ECB_REFERENCE_FX',base:'EUR',date:now.slice(0,10),usdPerEUR:'2',krwPerEUR:'2000',sourceHash:'a'.repeat(64),fetchedAt:now,importedAt:null};
  for(const contents of [null,'','{"SECRET_CANARY":',JSON.stringify({...good,date:'2020-01-01'})]){
   current=contents;await writeFile(target,JSON.stringify(good));
   const r=await read(port,'/fx-data.json');assert.equal(r.status,503);assert(!r.body.includes('SECRET_CANARY'));assert(!r.body.includes(root));assert.match(r.body,/FX_UNAVAILABLE/);
  }
  current=JSON.stringify({...good,privateExtra:'SECRET_CANARY'});
  const r=await read(port,'/fx-data.json');assert.equal(r.status,200);assert.deepEqual(JSON.parse(r.body),good);assert.equal((await read(port,'/fx-data.json',{},'HEAD')).body,'');
  assert.deepEqual(await readPublicFX(target),good);
 }finally{await app?.stop();await rm(root,{recursive:true,force:true});}
});

test('loopback transport preserves Host/Origin, strips hop headers and rejects oversized, delayed or aborted bodies without following redirects',async()=>{
 const server=createServer((req,res)=>{
  if(req.url==='/redirect'){res.writeHead(308,{Location:'https://must-not-resolve.invalid/'});res.end();return;}
  if(req.url==='/large'){res.end('x'.repeat(256));return;}
  if(req.url==='/slow'){const t=setTimeout(()=>res.end('late'),1000);res.on('close',()=>clearTimeout(t));return;}
  if(req.url==='/abort'){res.writeHead(200,{'content-length':'100'});res.write('partial');setImmediate(()=>res.destroy());return;}
  if(req.url==='/healthz'){res.end(JSON.stringify({status:'ok',commit:sha}));return;}
  if(req.url==='/market-data.json'){res.statusCode=req.headers.host===host?200:403;res.end(JSON.stringify({readState:{source:'POSTGRESQL'}}));return;}
  res.writeHead(200,{Connection:'close, x-hop-private','x-hop-private':'hidden'});res.end(JSON.stringify({host:req.headers.host,origin:req.headers.origin}));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 try{
  const response=await loopbackRequest({port,host,origin:'https://'+host});assert.deepEqual(JSON.parse(response.body),{host,origin:'https://'+host});assert(!response.headers.some(h=>['connection','x-hop-private','transfer-encoding'].includes(h.name.toLowerCase())));
  assert.equal((await loopbackRequest({port,path:'/redirect'})).status,308);
  for(const options of [{path:'/large',limit:32},{path:'/slow',timeout:20},{path:'/abort'}])await assert.rejects(loopbackRequest({port,...options}),/HTTP_FAILED/);
  assert.equal(await checkWebHealth(sha,{port,host,attempts:1}),true);assert.equal(await checkWebHealth('b'.repeat(40),{port,host,attempts:1}),false);assert.equal(await checkWebHealth(sha,{port,host:'wrong.example',attempts:1}),false);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('every static import in published browser modules is also explicitly published',async()=>{
 for(const path of publicAssets){
  if(!path.endsWith('.js'))continue;
  const source=await readFile(new URL('../web'+path,import.meta.url),'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\s*)['"]\.\/([^'"]+)['"]/g))assert(publicAssets.has('/'+match[1]),path+' imports unpublished '+match[1]);
 }
});

test('same-SHA concurrent stage is exclusive, existing directories/symlinks survive and failed preparation cleans only owned temporary files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-stage-'));await mkdir(join(root,'releases'));let proceed,started;
 const ready=new Promise(r=>started=r),gate=new Promise(r=>proceed=r);
 try{
  const first=stageRelease({root,sha,prepare:async path=>{started();await gate;await writeFile(join(path,'payload'),'ready');}});await ready;
  await assert.rejects(stageRelease({root,sha,prepare:async()=>{throw Error('must not run');}}),e=>e.code==='EEXIST');
  proceed();assert.equal((await first).commit,sha);assert.equal((await stat(join(root,'releases',sha,'REVISION'))).mode&0o777,0o644);
  assert.equal(await readFile(join(root,'releases',sha,'payload'),'utf8'),'ready');
  await assert.rejects(stageRelease({root,sha,prepare:async()=>{throw Error('must not run');}}),/ALREADY_EXISTS/);
  const broken='b'.repeat(40);await symlink('/nonexistent',join(root,'releases',broken));await assert.rejects(stageRelease({root,sha:broken,prepare:async()=>{}}),/ALREADY_EXISTS/);assert.equal(await readlink(join(root,'releases',broken)),'/nonexistent');
  const failed='c'.repeat(40);await assert.rejects(stageRelease({root,sha:failed,prepare:async()=>{throw Error('fixture failure');}}),/fixture failure/);
  assert.deepEqual((await readdir(join(root,'releases'))).sort(),[sha,broken]);
  const raced='d'.repeat(40);await assert.rejects(stageRelease({root,sha:raced,prepare:async()=>{await mkdir(join(root,'releases',raced));await writeFile(join(root,'releases',raced,'existing'),'preserve');}}));
  assert.equal(await readFile(join(root,'releases',raced,'existing'),'utf8'),'preserve');
  assert(!(await readdir(join(root,'releases'))).some(n=>n.startsWith('.staging-')));
  const victim=join(root,'preserved'),linked='e'.repeat(40);await writeFile(victim,'unchanged');
  await stageRelease({root,sha:linked,prepare:async path=>{await symlink(victim,join(path,'REVISION'));}});assert.equal(await readFile(victim,'utf8'),'unchanged');assert.equal(await readFile(join(root,'releases',linked,'REVISION'),'utf8'),linked+'\n');
 }finally{proceed?.();await rm(root,{recursive:true,force:true});}
});
