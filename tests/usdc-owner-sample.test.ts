import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { keccak256 } from 'viem';
import { proxySlots } from '../src/evm/proxy.js';
import { caller, usdcReference, probeControlCandidates } from '../tools/research/usdc-control-probe.js';
import { ownerSampleSource, BoundedOwnerBaseRpc, OwnerBlacklistRpc, probeUSDCOwnerSample, validateUSDCOwnerSample, validateUSDCBlacklistSource } from '../tools/research/usdc-owner-sample-probe.js';
const owner='0x'+'33'.repeat(20),other='0x'+'44'.repeat(20),zero='0x'+'0'.repeat(64),hash='0x'+'11'.repeat(32),tag='0x123';
const proxyCode='0x6000',implCode='0x6001',ref={...usdcReference,proxyCodeHash:keccak256(proxyCode),implementationCodeHash:keccak256(implCode)};
const word=(a:string)=>'0x'+'0'.repeat(24)+a.slice(2).toLowerCase();
async function server(mode:string,run:(url:string,calls:any[])=>Promise<void>){
 const calls:any[]=[];let owners=0,headers=0,chains=0,proxyCodes=0,slots=0;
 const http=createServer(async(req,res)=>{let raw='';for await(const part of req)raw+=String(part);const b=JSON.parse(raw);calls.push(b);let result:any;
 const fail=()=>res.end(JSON.stringify({jsonrpc:'2.0',id:b.id,error:{code:3,message:'execution reverted https://secret.invalid/CANARY'}}));
 if(b.method==='eth_chainId'){chains++;result=mode==='preChain'&&chains===2?'0x2':'0x1';}
 if(b.method==='eth_blockNumber')result=tag;
 if(b.method==='eth_getBlockByNumber'){headers++;if(mode==='postHeaderError'&&headers===4){fail();return;}result={number:tag,hash:mode==='postHeader'&&headers===4?'0x'+'22'.repeat(32):hash,secret:'CANARY'};}
 if(b.method==='eth_getCode'){
  if(b.params[0]===ref.proxy){proxyCodes++;result=mode==='badBase'&&proxyCodes===1?'0x':mode==='postCode'&&proxyCodes===4?'0x6002':proxyCode;}
  else result=implCode;
 }
 if(b.method==='eth_getStorageAt'){
  result=b.params[1]===proxySlots.legacyImplementation?word(ref.implementation):zero;
  if(b.params[1]===proxySlots.legacyAdmin){slots++;if(mode==='postSlot'&&slots===4)result=word(other);}
 }
 if(b.method==='eth_call'){
  if(b.params[0].data==='0x8da5cb5b'){owners++;result=word(owner);if(mode==='zeroOwner')result=zero;if(mode==='ownerError'||mode==='postOwnerError'&&owners===3){fail();return;}if(mode==='preOwner'&&owners===2||mode==='postOwner'&&owners===3)result=word(other);}
  else if(b.params[0].data.startsWith(ownerSampleSource.selector)){
   if(mode==='readError'){fail();return;}result=mode==='true'?'0x'+'0'.repeat(63)+'1':mode==='dirty'?'0x'+'0'.repeat(63)+'2':mode==='secret'?'https://secret.invalid/CANARY':zero;
  }else {if(mode==='pausedError'&&b.params[0].data==='0x5c975abb'){fail();return;}result=b.params[0].data==='0x5c975abb'?zero:word(other);}
 }
 res.end(JSON.stringify({jsonrpc:'2.0',id:b.id,result}));});
 await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const a=http.address();assert(a&&typeof a!=='string');
 try{await run(`http://127.0.0.1:${a.port}`,calls);}finally{http.closeAllConnections();await new Promise<void>(r=>http.close(()=>r()));}
}
test('USDC owner sample binds fresh getter address, exact blacklist word and separate namespaces without inferring authority',async()=>{
 for(const mode of ['success','true','pausedError'])await server(mode,async(url,calls)=>{
  const r=await probeUSDCOwnerSample(url,ref);validateUSDCOwnerSample(r,ref);assert.equal(r.stage,'OBSERVED');assert.equal(r.readStatus,'OK');assert.equal((r as any).value,mode==='true');
  assert.equal(r.totalRequestCount,46);assert.equal(r.baseRequestCount,25);assert.equal(r.requestCount,21);assert.equal(calls.length,46);assert.equal(r.sample!.address,owner);
  assert.equal(r.baseProbe.readings[5]!.readStatus,'NOT_TESTED');assert.equal(r.authorityState,'UNKNOWN');assert.equal(r.verdict,'INCONCLUSIVE');assert(!JSON.stringify(r).includes('CANARY'));
  const reads=calls.filter(c=>c.method==='eth_call'&&c.params[0].data.length===74);assert.equal(reads.length,1);assert.deepEqual(reads[0].params,[{to:ref.proxy,from:caller,data:ownerSampleSource.selector+word(owner).slice(2)},tag]);
  assert(!calls.some(c=>c.method==='eth_call'&&c.params[0].to===owner));assert.equal(calls.at(-1).method,'eth_getBlockByNumber');
  for(const mutate of [(x:any)=>x.sample.address=other,(x:any)=>x.baseProbeSha256='a'.repeat(64),(x:any)=>x.sample.baseEvidenceReferences[0].namespace='ownerSample',(x:any)=>x.evidenceReferences[0].namespace='baseProbe',
   (x:any)=>x.value=!x.value,(x:any)=>x.evidence.at(-1).data.result.hash='0x'+'22'.repeat(32),(x:any)=>x.totalRequestCount++, (x:any)=>x.sourceEvidence.selector='0xe47d6060']){
    const changed=structuredClone(r);mutate(changed);assert.throws(()=>validateUSDCOwnerSample(changed,ref));
  }
 });
});
test('USDC failed owner admission or precheck performs no blacklist reads and default base remains unchanged',async()=>{
 for(const mode of ['badBase','zeroOwner','ownerError','preChain','preOwner'])await server(mode,async(url,calls)=>{
  const r=await probeUSDCOwnerSample(url,ref);validateUSDCOwnerSample(r,ref);assert.equal(r.stage,'PRECONDITION_ERROR');assert.equal(r.readStatus,'NOT_TESTED');assert(!calls.some(c=>c.method==='eth_call'&&c.params[0].data.length===74));
 });
 await server('success',async(url,calls)=>{const r=await probeControlCandidates(url,ref);assert.equal(r.stage,'OBSERVED');assert.equal(calls.length,25);assert.equal(r.evidence.length,28);});
});
test('USDC malformed and reverted sample responses stay partial while post owner/slots/code/header errors are inconsistent',async()=>{
 for(const mode of ['dirty','secret','readError','postOwner','postOwnerError','postSlot','postCode','postHeader','postHeaderError'])await server(mode,async url=>{
  const r=await probeUSDCOwnerSample(url,ref);validateUSDCOwnerSample(r,ref);assert.equal(r.stage,mode.startsWith('post')?'CONSISTENCY_ERROR':'PARTIAL');assert(!JSON.stringify(r).includes('CANARY'));
  if(!mode.startsWith('post'))assert(!Object.hasOwn(r,'value'));if(mode==='readError')assert.equal(r.readStatus,'READ_FAILED');
 });
});
test('USDC bounded base/sample transports freeze admission, enforce scope and independent 32/24 budgets',async()=>{
 await server('success',async(url,calls)=>{
  const b=new BoundedOwnerBaseRpc(url,ref);for(let i=0;i<32;i++)await b.request('eth_chainId');await assert.rejects(b.request('eth_chainId'),/budget/);assert.equal(calls.length,32);
  await assert.rejects(b.request('eth_sendTransaction',[]));await assert.rejects(b.request('eth_call',[{to:owner,from:caller,data:'0x8da5cb5b'},tag]));
  const base=await probeControlCandidates(url,ref,{rpc:new BoundedOwnerBaseRpc(url,ref)}),rpc=new OwnerBlacklistRpc(url,base,ref);base.readings[0]!.value=other;
  const tx={to:ref.proxy,from:caller,data:ownerSampleSource.selector+word(owner).slice(2)};
  for(const[m,p]of [['eth_call',[{...tx,to:owner},tag]],['eth_call',[{...tx,from:owner},tag]],['eth_call',[{...tx,data:ownerSampleSource.selector+word(other).slice(2)},tag]],['eth_call',[{...tx,data:'0xe47d6060'+word(owner).slice(2)},tag]],
   ['eth_call',[tx,'latest']],['eth_call',[tx,tag,{}]],['eth_getCode',[owner,tag]],['eth_getStorageAt',[ref.proxy,zero,tag]],['eth_sendTransaction',[]],['eth_blockNumber',[]]]as[string,any[]][])await assert.rejects(rpc.request(m,p),/scope/);
  for(let i=0;i<24;i++)await rpc.request('eth_chainId');await assert.rejects(rpc.request('eth_chainId'),/budget/);assert.equal(calls.length,81);
 });
});
test('USDC sample source is pinned and cannot mix Tether capitalization or ABI provenance',()=>{
 const raw=readFileSync(new URL('../docs/research/usdc-source-binding.json',import.meta.url));validateUSDCBlacklistSource(raw);const s=JSON.parse(raw.toString());s.verificationServiceStudy.localRecompilation.getterCandidates.find((g:any)=>g.signature==='isBlacklisted(address)').selector='0xe47d6060';assert.throws(()=>validateUSDCBlacklistSource(Buffer.from(JSON.stringify(s))));
});
test('USDC sample CLI saves failed gate0600 and keeps previous output on startup failure',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'usdc-owner-')),out=join(dir,'report.json'),run=promisify(execFile);
 try{await server('success',async url=>{await assert.rejects(run(process.execPath,['--use-env-proxy','--import','tsx','tools/research/usdc-owner-sample-probe.ts','--out',out],{env:{...process.env,RPC_URL:url},timeout:15000}));
  const r=JSON.parse(await readFile(out,'utf8'));validateUSDCOwnerSample(r);assert.equal(r.stage,'PRECONDITION_ERROR');assert.equal((await stat(out)).mode&0o777,0o600);});
  await writeFile(out,'KEEP');await assert.rejects(run(process.execPath,['--use-env-proxy','--import','tsx','tools/research/usdc-owner-sample-probe.ts','--out',out],{env:{...process.env,RPC_URL:''},timeout:15000}));assert.equal(await readFile(out,'utf8'),'KEEP');
 }finally{await rm(dir,{recursive:true,force:true});}
});
