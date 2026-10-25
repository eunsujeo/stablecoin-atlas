import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {storeFX} from '../tools/fx-store.mjs';
import {isCLIEntrypoint} from '../tools/cli-entrypoint.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const clis=[
 ['collector-worker.mjs',['status','--unsupported'],/COLLECTOR_FAILED \(INVALID_ARGUMENTS\)/],
 ['registered-collector.mjs',['status','--unsupported'],/REGISTERED_COLLECTOR_FAILED \(INVALID_ARGUMENTS\)/],
 ['fx-store.mjs',['check','--directory','missing-store'],/FX_CHECK_FAILED \(FX_STORE_MISSING\)/],
 ['collector-deploy.mjs',['check'],/COLLECTOR_DEPLOY_FAILED \(DEPLOY_ARGUMENTS_INVALID\)/],
 ['publish-production-fx.mjs',[],/PUBLIC_FX_PUBLISH_FAILED/],
 ['production-web.mjs',['--invalid'],/ATLAS_WEB_START_FAILED/],
];
async function fixture(run){
 const root=await mkdtemp(join(tmpdir(),'atlas cli links #-'));
 try{
  const link=join(root,'collector-current');await symlink(repo,link,'dir');
  const guard=join(root,'offline.mjs');
  await writeFile(guard,"import net from 'node:net';\nconst denied=()=>{throw Error('TEST_NETWORK_FORBIDDEN');};\nglobalThis.fetch=denied;net.Socket.prototype.connect=denied;\n");
  const invoke=(args)=>{
   const r=spawnSync(process.execPath,['--import',pathToFileURL(guard).href,...args],{cwd:root,env:{PATH:process.env.PATH,HOME:root,TMPDIR:root},encoding:'utf8',timeout:15000});
   assert.ifError(r.error);assert.equal(r.signal,null);assert(!r.stderr.includes('TEST_NETWORK_FORBIDDEN'));return r;
  };
  await run({root,link,invoke});
 }finally{await rm(root,{recursive:true,force:true});}
}
test('entrypoint detection rejects absent/unresolvable entries and distinct module URLs',()=>{
 const entry=fileURLToPath(import.meta.url);
 assert(isCLIEntrypoint(import.meta.url,entry));
 for(const candidate of ['',null,entry+'.missing'])assert.equal(isCLIEntrypoint(import.meta.url,candidate),false);
 for(const url of ['node:fs','invalid',import.meta.url+'?separate',import.meta.url+'#separate',new URL('../tools/fx-store.mjs',import.meta.url)])assert.equal(isCLIEntrypoint(url,entry),false);
});
for(const [name,args,error] of clis){
 test(`${name} executes through real, directory symlink, file symlink and relative systemd paths`,async()=>fixture(async({root,link,invoke})=>{
  const real=join(repo,'tools',name),fileLink=join(root,name);await symlink(real,fileLink);
  const before=await readdir(root);
  const baseline=invoke([real,...args]);assert.equal(baseline.status,1);assert.equal(baseline.stdout,'');assert.match(baseline.stderr,error);
  for(const entry of [join(link,'tools',name),fileLink,relative(root,join(link,'tools',name))]){
   const result=invoke([entry,...args]);assert.equal(result.status,baseline.status,entry);assert.equal(result.stdout,baseline.stdout);assert.equal(result.stderr,baseline.stderr);
  }
  // Preserve the release directory layout so sibling imports remain resolvable.
  const result=invoke(['--preserve-symlinks-main',join(link,'tools',name),...args]);assert.equal(result.status,1);assert.equal(result.stderr,baseline.stderr);
  const imported=invoke(['--input-type=module','-e',`await import(${JSON.stringify(pathToFileURL(join(link,'tools',name)).href)});`]);
  assert.equal(imported.status,0);assert.equal(imported.stdout,'');assert.equal(imported.stderr,'');
  assert.deepEqual(await readdir(root),before);
 }));
}
test('symlinked deployment check and FX check/publish return successful local results',async()=>fixture(async({root,link,invoke})=>{
 const state=join(root,'state');await mkdir(state,{mode:0o700});
 for(const name of ['receipts','archive','market-store'])await mkdir(join(state,name),{mode:0o700});
 const envFile=join(root,'writer.env');await writeFile(envFile,'DATABASE_URL=postgresql://writer:fixture@127.0.0.1:1/db\nARKM_API_KEY=fixture-only\n',{mode:0o600});
 const args=['check','--kind','arkham','--state-root',state,'--env-file',envFile];
 const real=invoke([join(repo,'tools/collector-deploy.mjs'),...args]),linked=invoke([join(link,'tools/collector-deploy.mjs'),...args]);
 assert.equal(real.status,0);assert.equal(linked.status,0);assert.equal(linked.stdout,real.stdout);assert.equal(JSON.parse(linked.stdout).state,'READY');
 const directory=join(root,'fx'),date=new Date().toISOString().slice(0,10);
 const xml=Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><gesmes:subject>Reference rates</gesmes:subject><gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender><Cube><Cube time='${date}'><Cube currency='USD' rate='2'/><Cube currency='KRW' rate='2000'/></Cube></Cube></gesmes:Envelope>`);
 const source=join(root,'source.xml');await writeFile(source,xml);await storeFX({directory,source});
 const files=await readdir(directory,{recursive:true}),bytes=await Promise.all(files.filter(p=>p.endsWith('.json')||p.endsWith('.xml')).map(async p=>[p,await readFile(join(directory,p))]));
 for(const base of [repo,link]){
  const result=invoke([join(base,'tools/fx-store.mjs'),'check','--directory',directory]);assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).state,'READY');assert.equal(JSON.parse(result.stdout).providerRequests,0);
  const published=invoke([join(base,'tools/publish-production-fx.mjs'),directory,join(root,'fx.json')]);assert.equal(published.status,0);assert.equal(published.stdout,'PUBLIC_FX_PUBLISHED\n');
 }
 assert.deepEqual(await readdir(directory,{recursive:true}),files);for(const [p,b] of bytes)assert.deepEqual(await readFile(join(directory,p)),b);
}));
