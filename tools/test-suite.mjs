import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const archived=new Set(['allium-geography.test.mjs','allium-geography-flows.test.mjs','allium-executor.test.mjs','allium-live.test.mjs','allium-geography-diagnosis.test.mjs','balance-array-probe.test.mjs','provider-capability-probe.test.mjs']);
const tests=(await Promise.all(['tests','web'].map(async dir=>(await readdir(new URL('../'+dir+'/',import.meta.url))).filter(f=>/\.test\.(ts|mjs)$/.test(f)).sort().map(f=>({path:dir+'/'+f,archived:dir==='tests'&&archived.has(f)}))))).flat();
for(const offline of [false,true]){
 const files=tests.filter(t=>t.archived===offline).map(t=>t.path);
 const env=offline?{...process.env,NODE_OPTIONS:[process.env.NODE_OPTIONS,'--permission --allow-fs-read=* --allow-fs-write=* --allow-child-process'].filter(Boolean).join(' ')}:process.env;
 const status=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--use-env-proxy','--import','tsx','--test','--test-concurrency=2',...files],{cwd:new URL('../',import.meta.url),env,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>resolve(code??1));});
 if(status!==0)process.exit(status);
}
