import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {collectPinnedSources} from '../tools/research/top10-source-intake.mjs';
const plan=JSON.parse(await readFile(new URL('../data/source-review-top10-intake-plan.json',import.meta.url),'utf8'));
const valid=url=>{const parts=new URL(url).pathname.split('/');return Response.json({chainId:parts.at(-2),address:parts.at(-1),sources:{'Token.sol':{content:'contract Token {}'}},compilation:{name:'Token'},abi:[]});};
async function fixture(fn){const dir=await mkdtemp(join(tmpdir(),'source-intake-'));try{await fn(join(dir,'once'));}finally{await rm(dir,{recursive:true,force:true});}}
test('pinned source intake archives eight exact passive GETs privately and refuses reused roots',()=>fixture(async root=>{
 let calls=0;const transport=async(url,options)=>{assert.equal(url,plan.targets[calls++].url);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert(!url.includes('proxyResolution'));return valid(url);};
 const out=await collectPinnedSources(plan,{root,transport});assert.equal(out.attempts,8);assert(out.targets.every(t=>t.state==='SOURCE_STORED'));assert.equal((await stat(root)).mode&0o777,0o700);assert.equal((await stat(join(root,'00-usdc-base-response.bin'))).mode&0o777,0o600);
 await assert.rejects(collectPinnedSources(plan,{root,transport}));assert.equal(calls,8);
}));
test('404 consumes once and continues; 403 stops remaining targets without provider switching',()=>fixture(async root=>{
 let calls=0;const out=await collectPinnedSources(plan,{root,transport:async url=>{calls++;return calls===1?new Response('{}',{status:404}):calls===3?new Response('denied',{status:403}):valid(url);}});
 assert.equal(calls,3);assert.equal(out.targets[0].state,'SOURCE_UNAVAILABLE');assert.equal(out.targets[2].state,'HTTP_FAILED');assert.equal(out.targets.filter(t=>t.state==='NOT_EXECUTED').length,5);
}));
test('transport, oversize and identity corruption stop after persisted single intent',async()=>{
 for(const transport of [async()=>{throw Error('secret should never be logged');},async()=>new Response('x',{headers:{'content-length':String(plan.maximumResponseBytes+1)}}),async()=>Response.json({chainId:'1',address:plan.targets[0].address})])await fixture(async root=>{
  let calls=0;const out=await collectPinnedSources(plan,{root,transport:async(...args)=>{calls++;return transport(...args);}});assert.equal(calls,1);assert.equal(out.targets[0].state,'FAILED');assert(!JSON.stringify(out).includes('secret'));assert.equal(out.targets.filter(t=>t.state==='NOT_EXECUTED').length,7);assert(await readFile(join(root,'00-usdc-base-intent.json')));
 });
});
test('changed plan is rejected before root or transport access',()=>fixture(async root=>{
 let calls=0;await assert.rejects(collectPinnedSources({...plan,maximumRequests:99},{root,transport:async()=>{calls++;}}));assert.equal(calls,0);await assert.rejects(stat(root));
}));

test('deadline expiry marks the batch stopped and sends no remaining requests',()=>fixture(async root=>{
 let clock=1000,calls=0;const out=await collectPinnedSources(plan,{root,now:()=>clock,transport:async url=>{calls++;clock+=181000;return valid(url);}});
 assert.equal(calls,1);assert.equal(out.state,'STOPPED');assert.equal(out.reason,'DEADLINE');assert.equal(out.targets.filter(t=>t.state==='NOT_EXECUTED').length,7);
}));
test('CLI requires managed proxy mode before creating any approval root',()=>fixture(async root=>{
 const dir=join(root,'..');const run=spawnSync(process.execPath,[fileURLToPath(new URL('../tools/research/top10-source-intake.mjs',import.meta.url)),'--approved-plan-sha256',plan.planSha256],{cwd:dir,encoding:'utf8'});
 assert.notEqual(run.status,0);assert.match(run.stderr,/MANAGED_PROXY_REQUIRED/);assert.equal(run.stdout,'');await assert.rejects(stat(join(dir,plan.slot)));
}));

test('remaining ten cases use deduplicated text/doc sources without evaluating downloaded contents',()=>fixture(async root=>{
 const extra=JSON.parse(await readFile(new URL('../data/source-review-top10-remaining-plan.json',import.meta.url),'utf8'));let calls=0;
 const out=await collectPinnedSources(extra,{root,transport:async url=>{const target=extra.targets[calls++];assert.equal(url,target.url);if(target.kind==='SOURCE_API')return valid(url);return new Response(target.expectedText.join('\n'),{headers:{'content-type':'text/plain'}});}});
 assert.equal(calls,24);assert(out.targets.every(t=>['SOURCE_STORED','DOCUMENT_STORED'].includes(t.state)));assert.equal(out.rpcRequests,0);
}));
test('an HTML challenge cannot be accepted as program source even when it contains the expected word',()=>fixture(async root=>{
 const extra=JSON.parse(await readFile(new URL('../data/source-review-top10-remaining-plan.json',import.meta.url),'utf8'));
 const out=await collectPinnedSources(extra,{root,transport:async()=>new Response('process_transfer process_mint_to',{headers:{'content-type':'text/html'}})});
 assert.equal(out.attempts,1);assert.equal(out.targets[0].reason,'SOURCE_SHAPE_INVALID');
}));

test('a 200 challenge document remains a failed capture even if expected words are present',()=>fixture(async root=>{
 const extra=JSON.parse(await readFile(new URL('../data/source-review-top10-remaining-plan.json',import.meta.url),'utf8'));let calls=0;
 const out=await collectPinnedSources(extra,{root,transport:async url=>{const target=extra.targets[calls++];if(target.kind==='SOURCE_API')return valid(url);return new Response(target.kind==='DOCUMENT'?'<html><title>Just a moment</title>'+target.expectedText.join(' '):target.expectedText.join(' '),{headers:{'content-type':target.kind==='DOCUMENT'?'text/html':'text/plain'}});}});
 assert.equal(out.state,'STOPPED');assert.equal(out.targets.find(t=>t.state==='FAILED').reason,'CHALLENGE_RESPONSE');assert(out.targets.filter(t=>t.state==='NOT_EXECUTED').every(t=>t.artifactId&&t.caseIds.length));
}));

test('constructor metadata verifies all parent bytes before creating a root or sending requests',()=>fixture(async root=>{
 const links=JSON.parse(await readFile(new URL('../data/source-review-top10-constructor-plan.json',import.meta.url),'utf8'));let calls=0;
 await assert.rejects(collectPinnedSources(links,{root,parentLoader:async()=>Buffer.from('corrupt'),transport:async()=>{calls++;}}));
 assert.equal(calls,0);await assert.rejects(stat(root));
}));

test('normal document body is not rejected merely for an embedded security script URL',()=>fixture(async root=>{
 const extra=JSON.parse(await readFile(new URL('../data/source-review-top10-remaining-plan.json',import.meta.url),'utf8'));let calls=0;
 const out=await collectPinnedSources(extra,{root,transport:async url=>{const t=extra.targets[calls++];if(t.kind==='SOURCE_API')return valid(url);return new Response(t.kind==='DOCUMENT'?'<html><title>Original Document</title><script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script><body>'+t.expectedText.join(' ')+'</body></html>':t.expectedText.join(' '),{headers:{'content-type':t.kind==='DOCUMENT'?'text/html':'text/plain'}});}});
 assert.equal(out.attempts,24);assert.equal(out.state,'COMPLETE');
}));
