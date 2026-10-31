import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {checkedIdentity,childIdentity} from '../tools/deploy/child-identity.mjs';
import {localMainCommand} from '../tools/deploy/local-source.mjs';
test('broker child execution refuses root, missing and invalid IDs before spawning',async()=>{
 for(const pair of [[0,100],[100,0],[-1,100],[100,NaN],[1.5,100],[undefined,undefined]])assert.throws(()=>checkedIdentity(...pair),/CHILD_IDENTITY_INVALID/);
 assert.throws(()=>localMainCommand({}),/CHILD_IDENTITY_INVALID/);
 for(const user of ['root','mob','atlasbuild;id',''])await assert.rejects(childIdentity(user),/CHILD_USER_INVALID/);
});
test('native exec runs the real child with explicit UID/GID and a clean environment',()=>{
 const identity=checkedIdentity(process.getuid(),process.getgid());
 const out=execFileSync(process.execPath,['-e',"console.log(JSON.stringify({uid:process.getuid(),gid:process.getgid(),keys:Object.keys(process.env)}))"],{...identity,env:{PATH:'/usr/bin:/bin'},encoding:'utf8'});
 const actual=JSON.parse(out);
 // macOS libuv supplies its own CoreFoundation encoding key even with an explicit env.
 if(process.platform==='darwin')actual.keys=actual.keys.filter(k=>k!=='__CF_USER_TEXT_ENCODING');
 assert.deepEqual(actual,{...identity,keys:['PATH']});
});
