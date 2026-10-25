import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,chmod,symlink,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {main,deploymentRuntimeSupported,deploymentArguments} from '../tools/collector-deploy.mjs';
import {parseCollectorArguments} from '../tools/collector-worker.mjs';
import {registeredCollectorArguments} from '../tools/registered-collector.mjs';
test('deployment doctor checks local private configuration without changing files or contacting a provider',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-deploy-'));try{
  for(const n of ['receipts','archive','market-store'])await mkdir(join(root,n),{mode:0o700});
  const envFile=join(root,'writer.env'),contents='DATABASE_URL=postgresql://writer:example@127.0.0.1:5432/db\nARKM_API_KEY=example-not-live\n';await writeFile(envFile,contents,{mode:0o600});
  const args=['check','--kind','arkham','--state-root',root,'--env-file',envFile],before=await readdir(root);
  const r=await main(args);assert.equal(r.state,'READY');assert.equal(r.databaseAccessChecked,false);assert.equal(r.providerRequests,0);assert.deepEqual(await readdir(root),before);assert.equal(await readFile(envFile,'utf8'),contents);
  await assert.rejects(main(['check','--kind','registered','--selection','a'.repeat(64),'--state-root',root,'--env-file',envFile]),/DEPLOY_ENV_INVALID/);
  await chmod(envFile,0o644);await assert.rejects(main(args),/DEPLOY_PATH_UNSAFE/);await chmod(envFile,0o600);
  await rm(join(root,'receipts'),{recursive:true});await symlink(join(root,'archive'),join(root,'receipts'));await assert.rejects(main(args),/DEPLOY_PATH_UNSAFE/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('deployment validates Node/proxy flag support and explicit credentials before worker execution',()=>{
 const supported=new Set(['--use-env-proxy']);assert(deploymentRuntimeSupported('24.5.0',supported));assert(deploymentRuntimeSupported('25.0.0',supported));assert(!deploymentRuntimeSupported('24.4.9',supported));assert(!deploymentRuntimeSupported('22.20.0',supported));assert(!deploymentRuntimeSupported('25.0.0',new Set()));
 for(const args of [['check'],['install'],['check','--kind','registered','--selection','bad','--state-root','/private/state','--env-file','/private/env'],['check','--kind','arkham','--state-root','/private/state','--env-file','/private/env','--env-file','other']])assert.throws(()=>deploymentArguments(args));
 const p=parseCollectorArguments(['run','--market-dir','/var/lib/atlas-collector/market-store']);assert.equal(p.marketDirectory,'/var/lib/atlas-collector/market-store');
 for(const args of [['run','--market-dir','/tmp/other'],['status','--market-dir','/tmp/market-store'],['run','--market-dir','bad\n/market-store']])assert.throws(()=>parseCollectorArguments(args));
});
test('systemd commands use current separate collectors and the same persistent recovery paths',async()=>{
 const arkham=await readFile(new URL('../deploy/atlas-collector.service',import.meta.url),'utf8'),daily=await readFile(new URL('../deploy/atlas-registered-collector@.service',import.meta.url),'utf8');
 const command=s=>s.match(/^ExecStart=(.+)$/m)[1].split(' '),args=command(arkham),a=parseCollectorArguments(args.slice(args.indexOf('run')));assert(a.skipDailyHistory);assert.equal(a.marketDirectory,'/var/lib/atlas-collector/market-store');
 const d=command(daily).map(x=>x==='%i'?'a'.repeat(64):x),b=registeredCollectorArguments(d.slice(d.indexOf('run')));assert.equal(a.stateDirectory,b.stateDirectory);assert.equal(a.archiveRoot,b.archiveRoot);
 for(const s of [arkham,daily]){assert.match(s,/^Restart=on-failure$/m);assert.match(s,/^StateDirectoryMode=0700$/m);assert.match(s,/^ProtectSystem=strict$/m);assert.match(s,/^ReadWritePaths=\/var\/lib\/atlas-collector$/m);assert(!s.includes('reports/market-store'));}
 for(const name of ['atlas-collector.service','atlas-registered-collector@.service','atlas-fx.service']){
  const base=await readFile(new URL('../deploy/'+name,import.meta.url),'utf8'),drop=await readFile(new URL('../deploy/'+name+'.d/production.conf',import.meta.url),'utf8');
  assert.match(base,/^User=atlascollector$/m);assert.match(base,/^Group=atlascollector$/m);assert.match(base,/^UMask=0077$/m);
  assert.match(drop,/^WorkingDirectory=\/opt\/stablecoin-atlas\/collector-current$/m);
  if(name==='atlas-fx.service'){
   assert(!/EnvironmentFile|LoadCredential/.test(base+drop));assert.match(drop,/^ReadWritePaths=\/var\/lib\/atlas-public$/m);
   assert.match(drop,/^ExecStartPost=\/usr\/bin\/node tools\/publish-production-fx.mjs \/var\/lib\/atlas-collector\/fx-store \/var\/lib\/atlas-public\/fx.json$/m);
  }
 }
 const timer=await readFile(new URL('../deploy/atlas-fx.timer',import.meta.url),'utf8');assert.match(timer,/^OnCalendar=\*-\*-\* 00:10:00 UTC$/m);assert.match(timer,/^Persistent=true$/m);
});
