import test from 'node:test';
import assert from 'node:assert/strict';
import {dirname} from 'node:path';
import {trusted} from '../tools/deploy/files.mjs';
import {bootstrapLayout,preflightInstallPaths} from '../tools/deploy/bootstrap-install.mjs';
import {assertBootstrapIdle,effectiveUnitPaths} from '../tools/deploy/bootstrap.mjs';
function system(){
 const nodes=new Map(),links=new Map([['/usr/local/sbin','bin']]);
 const meta=(type,mode,uid=0)=>({uid,mode,size:100,isFile:()=>type==='file',isDirectory:()=>type==='directory',isSymbolicLink:()=>type==='link'});
 function directory(path){if(nodes.has(path))return;nodes.set(path,meta('directory',0o40755));if(dirname(path)!==path)directory(dirname(path));}
 for(const path of ['/usr/local/bin','/usr/local/lib','/etc/atlas-deploy','/etc/systemd/system','/etc/polkit-1/rules.d','/etc/tmpfiles.d','/etc/logrotate.d','/var/lib','/var/log','/run','/opt/stablecoin-atlas/releases'])directory(path);
 nodes.set('/usr/local/sbin',meta('link',0o120777));for(const name of ['atlas-release','atlas-deploy-admin'])nodes.set('/usr/local/bin/'+name,meta('file',0o100755));
 const stat=async path=>{const key=path.startsWith('/usr/local/sbin/')?'/usr/local/bin/'+path.slice('/usr/local/sbin/'.length):path;if(!nodes.has(key))throw Object.assign(Error('missing'),{code:'ENOENT'});return {...nodes.get(key)};};
 const link=async path=>{assert(links.has(path));return links.get(path);},trust=(path,options)=>trusted(path,{...options,stat,link});
 return {nodes,links,stat,link,trust,meta,directory};
}
test('exact Fedora root-owned sbin -> bin alias verifies real leaf, target and both ancestor chains',async()=>{
 const s=system();assert.equal(await s.trust('/usr/local/sbin/atlas-release'),'/usr/local/sbin/atlas-release');assert.equal(await s.trust('/usr/local/sbin',{directory:true}),'/usr/local/sbin');
 await assert.rejects(s.trust('/usr/local/sbin'),/FILE_UNTRUSTED/);s.nodes.get('/usr/local/bin/atlas-release').mode=0o100600;await assert.rejects(s.trust('/usr/local/sbin/atlas-release',{privateFile:true,limit:10}),/FILE_UNTRUSTED/);
});
test('alternate targets, foreign link owners, chained links and writable/foreign real paths are rejected',async()=>{
 for(const target of ['/usr/local/bin','../bin','./bin','bin/','/tmp/attacker']){const s=system();s.links.set('/usr/local/sbin',target);await assert.rejects(s.trust('/usr/local/sbin/atlas-release'),/PATH_UNTRUSTED/);}
 for(const path of ['/usr/local/sbin','/usr/local/bin','/usr/local/bin/atlas-release','/usr/local','/usr','/']){const s=system();s.nodes.get(path).uid=42;await assert.rejects(s.trust('/usr/local/sbin/atlas-release'),/PATH_UNTRUSTED/);}
 for(const path of ['/usr/local/bin','/usr/local/bin/atlas-release','/usr/local','/usr','/']){const s=system();s.nodes.get(path).mode|=0o022;await assert.rejects(s.trust('/usr/local/sbin/atlas-release'),/PATH_UNTRUSTED/);}
 for(const path of ['/usr/local/bin','/usr/local/bin/atlas-release']){const s=system();s.nodes.set(path,s.meta('link',0o120777));await assert.rejects(s.trust('/usr/local/sbin/atlas-release'),/PATH_UNTRUSTED/);}
 const s=system();await assert.rejects(trusted('/usr/local/sbin',{directory:true,uid:42,stat:s.stat,link:s.link}),/PATH_UNTRUSTED/);
});
test('all other symlinks and noncanonical paths retain strict rejection',async()=>{
 const s=system();s.nodes.set('/usr/local/other',s.meta('link',0o120777));await assert.rejects(s.trust('/usr/local/other',{directory:true}),/PATH_UNTRUSTED/);
 for(const path of ['/usr/local/sbin/../bin/atlas-release','//usr/local/sbin/atlas-release','/usr/local/sbin/'])await assert.rejects(s.trust(path),/PATH_INVALID/);
});
test('install path preflight is read-only, accepts Fedora alias and catches every later write/read target early',async()=>{
 const s=system(),before=JSON.stringify([...s.nodes]);const good=await preflightInstallPaths({trust:s.trust,stat:s.stat});assert.equal(good.state,'READY');assert.equal(good.servicesChanged,0);assert.equal(JSON.stringify([...s.nodes]),before);
 for(const path of ['/var/log/atlas-deploy','/etc/systemd/system','/etc/atlas-deploy','/usr/local/lib']){
  const bad=system();bad.directory(path);bad.nodes.get(path).mode|=0o022;const r=await preflightInstallPaths({trust:bad.trust,stat:bad.stat});assert.equal(r.state,'FAILED');assert(r.checks.some(c=>c.state==='FAILED'));
 }
 const bad=system(),effective='/etc/systemd/system/private-override.conf';bad.nodes.set(effective,bad.meta('file',0o100644,42));const r=await preflightInstallPaths({trust:bad.trust,stat:bad.stat,effectiveUnits:[effective]});assert(r.checks.some(c=>c.path===effective&&c.state==='FAILED'));
 const privateFile=system(),layout=bootstrapLayout();privateFile.nodes.set(layout.receipt,privateFile.meta('file',0o100644));assert.equal((await preflightInstallPaths({trust:privateFile.trust,stat:privateFile.stat,files:[{path:layout.receipt}]})).state,'FAILED');
});
test('bootstrap idle guard permits only missing/inactive units and never swallows lookup failure',async()=>{
 await assertBootstrapIdle(async(_unit,options)=>{assert.equal(options.allowMissing,true);return null;});await assertBootstrapIdle(async()=>({ActiveState:'inactive',MainPID:'0'}));
 await assert.rejects(assertBootstrapIdle(async()=>({ActiveState:'active',MainPID:'0'})),/STOP_AUTOMATION/);
 await assert.rejects(assertBootstrapIdle(async unit=>unit.endsWith('.timer')?null:{ActiveState:'inactive',MainPID:'1'}),/APPLY_ACTIVE/);
 const reason=Error('LOOKUP_FAILED');await assert.rejects(assertBootstrapIdle(async()=>{throw reason;}),e=>e===reason);
 const paths=await effectiveUnitPaths({components:{web:{enabled:true},collector:{enabled:false},usage:{enabled:false}}},async()=>({FragmentPath:'/usr/lib/systemd/system/atlas-web.service',DropInPaths:'/etc/systemd/system/atlas-web.service.d/local.conf'}));assert.equal(paths.length,2);
});
