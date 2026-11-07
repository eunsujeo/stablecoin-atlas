import test from 'node:test';
import assert from 'node:assert/strict';
import {maintenanceCommand} from '../tools/deploy/maintenance.mjs';
import {idleAction,waitMaintenanceIdle} from '../tools/deploy/maintenance-idle.mjs';
import {readFile} from 'node:fs/promises';
const idle={ActiveState:'inactive',MainPID:'0'};
test('maintenance permits only fixed commands and paths; cannot supply SHA, shell, env, unit or config',()=>{
 for(const name of ['status','verify','enable','deploy','finish-yahoo-fx']){const [program,args]=maintenanceCommand([name]);assert(program.startsWith('/usr/'));assert(args.every(x=>!x.includes('/home/')));}
 for(const args of [[],['bash'],['status','--config','/tmp/evil'],['verify; sh'],['finish-yahoo-fx','/tmp/evil'],['deploy','atlas-collector.service'],['NODE_OPTIONS=--import=/tmp/evil']])assert.throws(()=>maintenanceCommand(args),/MAINTENANCE_ARGUMENTS/);
 assert.deepEqual(maintenanceCommand(['deploy']),['/usr/bin/systemctl',['start','--no-block','atlas-deploy-apply.service']]);
});
test('idle barrier waits for live work and only clears failed state with zero PID',async()=>{
 const resets=[];let tick=0;
 const result=await waitMaintenanceIdle({attempts:4,read:async unit=>unit==='atlas-deploy-agent.service'?idle:tick===0?{ActiveState:'active',MainPID:'42'}:tick===1?{ActiveState:'failed',MainPID:'0'}:idle,reset:async unit=>resets.push([tick,unit]),sleep:async()=>{tick++;}});
 assert.equal(result.state,'IDLE');assert.deepEqual(resets,[[1,'atlas-deploy-apply.service']]);assert.equal(tick,2);
});
test('timeout and uncertain states never stop a live unit or clear its failure status',async()=>{
 let resets=0;
 await assert.rejects(waitMaintenanceIdle({attempts:2,read:async()=>({ActiveState:'failed',MainPID:'42'}),reset:async()=>{resets++;},sleep:async()=>{}}),/MAINTENANCE_BUSY/);assert.equal(resets,0);
 for(const s of [{},{ActiveState:'active',MainPID:'unknown'},{ActiveState:'unknown',MainPID:'0'}])assert.throws(()=>idleAction(s),/STATE_INVALID/);
 await assert.rejects(waitMaintenanceIdle({read:async()=>({ActiveState:'failed',MainPID:'0'}),reset:async()=>{throw Error('RESET_DENIED');}}),/RESET_DENIED/);
});
test('sudoers grants exact root-owned wrapper commands, never interpreters or wildcards',async()=>{
 const text=await readFile(new URL('../deploy/atlas-maintenance.sudoers',import.meta.url),'utf8');
 const rule=text.split('\n').find(l=>l.startsWith('mob '));assert(rule.includes('NOPASSWD: NOSETENV:'));assert(!rule.includes('*'));assert(!rule.includes('/home/'));assert(!rule.includes('/bin/bash'));
 const names=rule.match(/\/usr\/local\/bin\/atlas-maintenance [a-z-]+/g);assert.equal(names.length,5);for(const n of names)maintenanceCommand([n.split(' ').at(-1)]);
});
test('one-time installer pins the exact reviewed payload bytes',async()=>{
 const {createHash}=await import('node:crypto');
 const source=await readFile(new URL('../deploy/install-maintenance.py',import.meta.url),'utf8');
 const pins=JSON.parse(source.match(/^PINS = (\{.+\})$/m)[1].replaceAll("'",'"'));
 const files={'atlas-maintenance':'deploy/atlas-maintenance','atlas-maintenance.sudoers':'deploy/atlas-maintenance.sudoers','finish-yahoo-fx.sh':'deploy/atlas-finish-yahoo-fx.sh','maintenance.mjs':'tools/deploy/maintenance.mjs','maintenance-idle.mjs':'tools/deploy/maintenance-idle.mjs'};
 assert.deepEqual(Object.keys(pins).sort(),Object.keys(files).sort());
 for(const [name,path]of Object.entries(files))assert.equal(pins[name],createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex'));
});
