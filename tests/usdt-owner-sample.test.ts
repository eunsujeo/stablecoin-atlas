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
import { caller } from '../tools/research/usdc-control-probe.js';
import { usdtReference, usdtGetters, probeUSDT, validateUSDTReport } from '../tools/research/usdt-control-probe.js';
import { sampleGetters, OwnerSampleRpc, probeOwnerSample, validateOwnerSampleReport, validateOwnerSampleSource } from '../tools/research/usdt-owner-sample-probe.js';
const addr='0x'+'33'.repeat(20),other='0x'+'44'.repeat(20),zero='0x'+'0'.repeat(64),hash='0x'+'11'.repeat(32),otherHash='0x'+'22'.repeat(32),tag='0x123',code='0x6000';
const ref={...usdtReference,codeHash:keccak256(code)},word=(s:string)=>'0x'+'0'.repeat(24)+s.slice(2);
async function server(mode:string,run:(url:string,calls:any[])=>Promise<void>){
 const calls:any[]=[];let owners=0,getOwners=0,headers=0,chains=0,sampleCodes=0,tokenCodes=0;
 const http=createServer(async(req,res)=>{let raw='';for await(const p of req)raw+=String(p);const b=JSON.parse(raw);calls.push(b);let result:any;
 const fail=()=>res.end(JSON.stringify({jsonrpc:'2.0',id:b.id,error:{code:3,message:'execution reverted https://secret.invalid/CANARY'}}));
 if(b.method==='eth_chainId'){chains++;result=mode==='preChain'&&chains===3?'0x2':'0x1';}
 if(b.method==='eth_blockNumber')result=tag;
 if(b.method==='eth_getBlockByNumber'){headers++;if(mode==='postHeaderError'&&headers===4){fail();return;}result={number:tag,hash:mode==='postHeader'&&headers===4?otherHash:hash,secret:'CANARY'};}
 if(b.method==='eth_getCode'){
  if(b.params[0]===ref.target){tokenCodes++;result=mode==='postToken'&&tokenCodes===4?'0x6001':code;}
  else{sampleCodes++;result=mode==='empty'?'0x':mode==='invalidCode'?'0x0':mode==='postCode'&&sampleCodes===2?'0x01':'0x00';
   if(mode==='codeError'||mode==='postCodeError'&&sampleCodes===2){fail();return;}}
 }
 if(b.method==='eth_call'){
  const data=b.params[0].data,g=usdtGetters.find(g=>g.selector===data);
  if(g){result=g.type==='address'?word(addr):zero;
   if(g.signature==='owner()'){owners++;if(mode==='zero')result=zero;if(mode==='postOwner'&&owners===2)result=word(other);if(mode==='postOwnerError'&&owners===2){fail();return;}}
   if(g.signature==='getOwner()'){getOwners++;if(mode==='zero')result=zero;if(mode==='ownerMismatch')result=word(other);if(mode==='ownerError'){fail();return;}}
   if(g.signature==='paused()'&&mode==='pausedError'){fail();return;}
  }else{result=zero;
   if(mode==='blackMismatch'&&data.startsWith(sampleGetters[0].selector))result='0x'+'0'.repeat(63)+'1';
   if(mode==='dirty')result='0x'+'0'.repeat(63)+'2';if(mode==='secret')result='https://secret.invalid/CANARY';
   if(mode==='blackError'){fail();return;}
  }
 }
 res.end(JSON.stringify({jsonrpc:'2.0',id:b.id,result}));});
 await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const a=http.address();assert(a&&typeof a!=='string');
 try{await run(`http://127.0.0.1:${a.port}`,calls);}finally{http.closeAllConnections();await new Promise<void>(r=>http.close(()=>r()));}
}

test('USDT owner sample binds fresh control address, blacklist bool aliases, code bytes and namespaces without inferring EOA/authority',async()=>{
 for(const mode of ['success','empty','blackMismatch','pausedError'])await server(mode,async(url,calls)=>{
  const r=await probeOwnerSample(url,ref);validateOwnerSampleReport(r,ref);assert.equal(r.stage,'OBSERVED');assert.equal(r.totalRequestCount,26);assert.equal(r.requestCount,12);
  assert.equal(r.sample!.address,addr);assert.equal(r.sampleCode.codePresence,mode==='empty'?'EMPTY':'PRESENT');assert.equal(r.sampleCode.codeBytes,mode==='empty'?0:1);
  assert.equal(r.sampleCode.codeHash,keccak256(mode==='empty'?'0x':'0x00'));assert.equal(r.blacklistResponseComparison,mode==='blackMismatch'?'MISMATCH':'MATCH');
  assert.equal(r.ownerConsistency,'MATCH');assert.equal(r.authorityState,'UNKNOWN');assert(!JSON.stringify(r).includes('CANARY'));
  const reads=calls.filter(c=>c.method==='eth_call'&&c.params[0].data.length===74);assert.equal(reads.length,2);
  for(const [i,c]of reads.entries())assert.deepEqual(c.params,[{to:ref.target,from:caller,data:sampleGetters[i]!.selector+word(addr).slice(2)},tag]);
  assert(!calls.some(c=>c.method==='eth_call'&&c.params[0].to===addr));assert.equal(calls.at(-1).method,'eth_getBlockByNumber');
  for(const mutate of [(x:any)=>x.sample.address=other,(x:any)=>x.baseProbeSha256='a'.repeat(64),(x:any)=>x.sample.baseEvidenceReferences[0].namespace='ownerSample',
   (x:any)=>x.sampleCode.evidenceReferences[0].namespace='baseProbe',(x:any)=>x.sampleCode.codeBytes=99,(x:any)=>x.readings[0].value=!x.readings[0].value,
   (x:any)=>x.blacklistResponseComparison='UNKNOWN',(x:any)=>x.evidence.at(-1).data.result.hash=otherHash]){const changed=structuredClone(r);mutate(changed);assert.throws(()=>validateOwnerSampleReport(changed,ref));}
 });
});

test('USDT owner mismatch/zero/error and failed fresh frame prevent all sample reads while the base stays unchanged',async()=>{
 for(const mode of ['ownerMismatch','zero','ownerError','preChain'])await server(mode,async(url,calls)=>{
  const r=await probeOwnerSample(url,ref);validateOwnerSampleReport(r,ref);assert.equal(r.stage,'PRECONDITION_ERROR');assert.equal(r.sampleCode.readStatus,'NOT_TESTED');
  assert(!calls.some(c=>c.method==='eth_call'&&c.params[0].data.length===74));assert(!calls.some(c=>c.method==='eth_getCode'&&c.params[0]===addr));
 });
 await server('success',async(url,calls)=>{const r=await probeUSDT(url,ref);validateUSDTReport(r,ref);assert.equal(r.requestCount,14);assert.equal(calls.filter(c=>c.method==='eth_call').length,7);});
});

test('USDT code/blacklist initial failures remain partial and owner/code/token/header post failures are inconsistent',async()=>{
 for(const mode of ['invalidCode','codeError','dirty','secret','blackError','postOwner','postOwnerError','postCode','postCodeError','postToken','postHeader','postHeaderError'])await server(mode,async url=>{
  const r=await probeOwnerSample(url,ref);validateOwnerSampleReport(r,ref);assert.equal(r.stage,mode.startsWith('post')?'CONSISTENCY_ERROR':'PARTIAL');assert(!JSON.stringify(r).includes('CANARY'));
  if(mode==='invalidCode')assert.equal(r.sampleCode.readStatus,'INVALID_RESPONSE');if(mode==='codeError')assert.equal(r.sampleCode.readStatus,'READ_FAILED');
  if(mode==='postOwner')assert.equal(r.ownerConsistency,'MISMATCH');if(mode==='postCodeError')assert.equal(r.sampleCode.consistency,'NOT_ESTABLISHED');
  if(mode==='blackError')assert.equal(r.blacklistResponseComparison,'UNKNOWN');
 });
});

test('USDT sample transport freezes fresh owner admission, forbids owner functions/arbitrary samples/writes and caps16requests',async()=>{
 await server('success',async(url,calls)=>{
  const base=await probeUSDT(url,ref),rpc=new OwnerSampleRpc(url,base,ref);base.readings[0]!.value=other;base.readings[1]!.value=other;
  const tx={to:ref.target,from:caller,data:sampleGetters[0].selector+word(addr).slice(2)};
  for(const[m,p]of [['eth_call',[{...tx,to:addr},tag]],['eth_call',[{...tx,from:addr},tag]],['eth_call',[{...tx,data:sampleGetters[0].selector+word(other).slice(2)},tag]],
   ['eth_call',[{...tx,data:tx.data+'00'},tag]],['eth_call',[tx,'latest']],['eth_call',[tx,tag,{}]],['eth_getCode',[other,tag]],['eth_blockNumber',[]],['eth_getStorageAt',[]],['eth_sendTransaction',[]]]as[string,any[]][])await assert.rejects(rpc.request(m,p),/scope/);
  assert.equal(calls.length,14);await rpc.request('eth_call',[tx,tag]);for(let i=0;i<15;i++)await rpc.request('eth_chainId');await assert.rejects(rpc.request('eth_chainId'),/budget/);assert.equal(calls.length,30);
 });
});

test('USDT sample source fixes exact blacklist capitalization/ABI inputs/view and hash',()=>{
 const raw=readFileSync(new URL('../docs/research/usdt-control-provenance.json',import.meta.url));validateOwnerSampleSource(raw);
 const s=JSON.parse(raw.toString());s.getterCandidates.find((g:any)=>g.signature===sampleGetters[0].signature).inputs=[];assert.throws(()=>validateOwnerSampleSource(Buffer.from(JSON.stringify(s))));
});

test('USDT sample CLI saves failed-gate report0600 and preserves output on startup failure',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'usdt-owner-')),out=join(dir,'report.json'),run=promisify(execFile);
 try{await server('success',async url=>{await assert.rejects(run(process.execPath,['--use-env-proxy','--import','tsx','tools/research/usdt-owner-sample-probe.ts','--out',out],{env:{...process.env,RPC_URL:url},timeout:15000}));
  const r=JSON.parse(await readFile(out,'utf8'));validateOwnerSampleReport(r);assert.equal(r.stage,'PRECONDITION_ERROR');assert.equal((await stat(out)).mode&0o777,0o600);});
  await writeFile(out,'KEEP');await assert.rejects(run(process.execPath,['--use-env-proxy','--import','tsx','tools/research/usdt-owner-sample-probe.ts','--out',out],{env:{...process.env,RPC_URL:''},timeout:15000}));assert.equal(await readFile(out,'utf8'),'KEEP');
 }finally{await rm(dir,{recursive:true,force:true});}
});
