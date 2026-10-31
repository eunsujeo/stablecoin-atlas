import test from 'node:test';import assert from 'node:assert/strict';import{mkdtemp,realpath,rm,readFile}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{operatingUsagePlan,validateUsageAuthorization}from'../tools/usage-operating-plan.mjs';import{collectOperatingUsage}from'../tools/usage-operating-collector.mjs';import{projectOperatingUsage}from'../tools/usage-operating-project.mjs';import{digest}from'../tools/market-db/plan.mjs';
async function setup(t){const root=await realpath(await mkdtemp(join(tmpdir(),'usage-operation-')));t.after(()=>rm(root,{recursive:true,force:true}));const p=await operatingUsagePlan('2026-10-29'),planBytes=Buffer.from(JSON.stringify(p)),a={kind:'ARKHAM_USAGE_PERIOD_AUTHORIZATION',policyHash:p.policyHash,fromDay:'2026-10-29',untilExclusive:'2026-11-28',maxHTTPPerDay:18,maxTotalHTTP:540,maxBytesPerDay:37748736,maxTotalBytes:1132462080,costStatus:'UNKNOWN_ACCEPTED'},approvalBytes=Buffer.from(JSON.stringify(a));let ms=0;return{p,a,o:{root,planBytes,expectedPlanHash:digest(planBytes),key:'fixture',approvalBytes,expectedApprovalHash:digest(approvalBytes),now:()=> '2026-10-29T01:00:00.000Z',clock:()=>ms,sleep:async n=>{ms+=n;},claim:async()=>({state:'CLAIMED'})}};}
test('daily policy fixes 18 targets across days; period authorization caps cumulative calls and expires',async t=>{
 const{p,a}=await setup(t);assert.equal(p.jobs.length,18);assert.equal(p.policyHash,(await operatingUsagePlan('2026-10-30')).policyHash);assert.notEqual(p.planHash,(await operatingUsagePlan('2026-10-30')).planHash);assert.equal(validateUsageAuthorization(a,p),a);
 for(const edit of [a=>a.maxTotalHTTP++,a=>a.policyHash='bad',a=>a.costStatus='FREE',a=>a.untilExclusive='2026-12-01']){const bad={...a};edit(bad);assert.throws(()=>validateUsageAuthorization(bad,p));}assert.throws(()=>validateUsageAuthorization(a,{...p,day:'2026-11-28'}));
});
test('complete daily archive projects 126 rows, no retry after DB day claim and publication can recover without calls',async t=>{
 const{p,o}=await setup(t);let calls=0;const r=await collectOperatingUsage({...o,fetcher:async(url,options)=>{const parsed=new URL(url);assert.equal(parsed.origin,'https://api.arkm.com');assert.equal(parsed.pathname,'/transfers/histogram');assert.equal(parsed.searchParams.get('chains'),p.jobs[calls].query.chains);assert.equal(parsed.searchParams.get('tokens'),p.jobs[calls].query.tokens);assert.equal(options.redirect,'error');calls++;return new Response('[{"time":"2026-10-28T00:00:00Z","count":9007199254740993,"usd":123.000000000000000001}]');}});assert.equal(r.state,'COMPLETE');assert.equal(calls,18);
 const view=await projectOperatingUsage(o.root,p.day);assert.equal(view.rows.length,126);assert.equal(view.rows.filter(r=>r.state==='OBSERVED').length,18);assert.equal(view.rows[0].transfers,null);assert.equal(view.rows.find(r=>r.state==='OBSERVED').transfers,'9007199254740993');assert.equal(view.availability.filter(a=>a.state==='NOT_TESTED').length,15);
 const second=await collectOperatingUsage({...o,claim:async()=>({state:'ALREADY_CLAIMED'}),fetcher:()=>assert.fail('must not send')});assert.equal(second.state,'ALREADY_CLAIMED');assert.deepEqual(await projectOperatingUsage(o.root,p.day),view);
});
test('daily first failure consumes slot, preserves evidence and prevents a replacement root from bypassing DB claim',async t=>{
 const{o}=await setup(t);let calls=0;const r=await collectOperatingUsage({...o,fetcher:async()=>{calls++;return new Response('{}',{status:429});}});assert.equal(calls,1);assert.equal(r.stopReason,'HTTP_429');assert(r.jobs.slice(1).every(j=>j.state==='NOT_TESTED'));
 await assert.rejects(projectOperatingUsage(o.root,'2026-10-29'));await assert.rejects(collectOperatingUsage({...o,fetcher:()=>assert.fail('no replay')}));
 const alternate=join(o.root,'fresh');assert.equal((await collectOperatingUsage({...o,root:alternate,claim:async()=>({state:'ALREADY_CLAIMED'}),fetcher:()=>assert.fail('no reset')})).state,'ALREADY_CLAIMED');
});
test('midnight boundary stops new dispatch and timer is daily without catch-up or automatic restarts',async t=>{
 const{o}=await setup(t);let sent=0;const r=await collectOperatingUsage({...o,now:()=>sent?'2026-10-30T00:00:00.000Z':'2026-10-29T23:59:59.000Z',fetcher:async()=>{sent++;return new Response('[]');}});assert.equal(sent,1);assert.equal(r.stopReason,'DAY_NOT_CURRENT');
 const timer=await readFile(new URL('../deploy/atlas-usage.timer',import.meta.url),'utf8'),service=await readFile(new URL('../deploy/atlas-usage.service',import.meta.url),'utf8');assert.match(timer,/00:20:00 UTC/);assert.match(timer,/Persistent=false/);assert.match(service,/Restart=no/);assert.match(service,/--use-env-proxy/);
});

test('operating CLI executes through a release symlink without provider or database access',async t=>{
 const{symlink}=await import('node:fs/promises'),{execFile}=await import('node:child_process'),{promisify}=await import('node:util');const root=await realpath(await mkdtemp(join(tmpdir(),'usage-release-')));t.after(()=>rm(root,{recursive:true,force:true}));await symlink(process.cwd(),join(root,'current'));const r=await promisify(execFile)(process.execPath,[join(root,'current/tools/usage-operating-cli.mjs'),'plan','--day','2026-10-29']);assert.equal(JSON.parse(r.stdout).jobs.length,18);
});

test('UTC day crossing during durable intent write sends no HTTP request',async t=>{
 const{o}=await setup(t);let reads=0,calls=0;const r=await collectOperatingUsage({...o,now:()=>++reads<5?'2026-10-29T23:59:59.000Z':'2026-10-30T00:00:00.000Z',fetcher:async()=>{calls++;throw Error('must not dispatch');}});assert.equal(calls,0);assert.equal(r.stopReason,'DAY_NOT_CURRENT');assert.equal(r.attempts[0].httpStatus,null);
});

test('runtime check needs authorization and least-privilege writer validation, without a legacy definer file',async t=>{
 const{usageOperation}=await import('../tools/usage-operating-cli.mjs'),{writeFile}=await import('node:fs/promises');const{a,o}=await setup(t);
 const authorizationFile=join(o.root,'authorization.json'),envFile=join(o.root,'writer.env'),config=join(o.root,'config.json');
 await writeFile(authorizationFile,JSON.stringify(a),{mode:0o600});await writeFile(envFile,'DATABASE_URL=postgresql://fixture.invalid/db\nARKM_API_KEY=fixture\n',{mode:0o600});
 const base={stateRoot:o.root,envFile,authorizationFile,authorizationHash:digest(Buffer.from(JSON.stringify(a)))};let checks=0,collections=0,closed=0;
 const deps={now:()=> '2026-10-29T01:00:00.000Z',connect:async()=>({end:async()=>{closed++;}}),checkWriter:async()=>{checks++;},collect:async()=>{collections++;throw Error('must not collect');}};
 for(const c of [base,{...base,reviewedDefinersFile:join(o.root,'missing.json'),reviewedDefinersHash:'f'.repeat(64)}]){await writeFile(config,JSON.stringify(c),{mode:0o600});assert.equal((await usageOperation(['check','--config',config],deps)).state,'READY');}
 assert.equal(checks,2);assert.equal(closed,2);assert.equal(collections,0);
 await assert.rejects(usageOperation(['run','--config',config],{...deps,checkWriter:async()=>{throw Error('NETWORK_USAGE_DATABASE_INVALID');}}),/NETWORK_USAGE_DATABASE_INVALID/);assert.equal(collections,0);assert.equal(closed,3);
 await writeFile(config,JSON.stringify({...base,authorizationHash:'0'.repeat(64)}));await assert.rejects(usageOperation(['run','--config',config],deps));assert.equal(collections,0);assert.equal(checks,2);
});
