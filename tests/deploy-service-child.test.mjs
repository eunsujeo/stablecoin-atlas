import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceChildCommand} from '../tools/deploy/service-child.mjs';
const base={user:'atlasweb',command:'/usr/bin/node',args:['probe.mjs'],cwd:'/usr/local/lib/atlas-deploy'};
test('service children have fixed unprivileged identities, no capabilities, bounded lifetime and clean launcher env',()=>{
 for(const user of ['atlasweb','atlascollector']){
  const a=serviceChildCommand({...base,user}),b=serviceChildCommand({...base,user});assert.notDeepEqual(a.args,b.args);assert.equal(a.command,'/usr/bin/systemd-run');assert.equal(a.options.uid,undefined);assert.deepEqual(a.options.env,{PATH:'/usr/bin:/bin'});
  for(const value of ['User='+user,'Group='+user,'NoNewPrivileges=true','CapabilityBoundingSet=','ProtectSystem=strict','ProtectHome=true','PrivateDevices=true','RestrictSUIDSGID=true','RuntimeMaxSec=120','KillMode=control-group','TasksMax=32'])assert.ok(a.args.includes('--property='+value),value);
  assert.ok(!a.args.some(v=>v.startsWith('--property=EnvironmentFile=')));assert.ok(!a.args.some(v=>v.startsWith('--property=ReadWritePaths=')));assert.ok(a.args.includes('--pipe'));assert.ok(a.args.includes('--wait'));assert.ok(a.args.includes('--setenv=NODE_OPTIONS='));
 }
 assert.ok(serviceChildCommand({...base,hold:true}).args.includes('--property=RuntimeMaxSec=1800'));
});
test('service dispatch rejects root, unknown users, shells, alternate directories and proxy expansion before execution',()=>{
 for(const change of [{user:'root'},{user:'mob'},{command:'/bin/sh'},{cwd:'/tmp'},{proxy:true},{args:['bad\0arg']},{user:'atlasbuild',hold:true}])assert.throws(()=>serviceChildCommand({...base,...change}),/CHILD_SERVICE_INVALID/);
});
