import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtemp,writeFile,readFile,stat,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { encodeAbiParameters,getAddress,type Address } from 'viem';
import { EvmReadOnlyAdapter } from '../src/evm/adapter.js';
import { assessEvm } from '../src/evm/assessment.js';
import { Rpc } from '../src/evm/rpc.js';
import { LocalLab } from '../src/lab/anvil.js';
import { compileFixtures } from '../src/lab/compiler.js';
import { FixtureExecutor,send } from '../src/evm/executor.js';
import { json } from '../src/domain/evaluator.js';
import { writeReportAtomically } from '../src/report-output.js';
import { contextProfiles } from '../tools/research/service-account-context.js';
import { runServiceAccountReadOnly,validateServiceAccountRun } from '../tools/research/service-account-readonly.js';
import { assertSerializedReport } from './helpers/report-contract.js';
const zero='0x'+'0'.repeat(64),max=2n**256n-1n,owner='0x'+'11'.repeat(20),spender='0x'+'22'.repeat(20);
function input(profile:'ethereum-usdc'|'ethereum-usdt'|'ethereum-rlusd'='ethereum-usdc',same=false){const x=JSON.parse(readFileSync(new URL('./fixtures/service-account-context.json',import.meta.url),'utf8'));Object.assign(x,{profileId:profile,...contextProfiles[profile]});const a=x.query.holder;a.purpose='ALLOWANCE_REVIEW';x.query={kind:'ALLOWANCE',owner:a,spender:{...structuredClone(a),address:same?owner:spender}};return Buffer.from(JSON.stringify(x));}
async function mock(mode:string,amount:bigint,run:(url:string,calls:any[])=>Promise<void>){const calls:any[]=[];const s=createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=String(c);const q=JSON.parse(raw);calls.push(q);let result:any;
 if(q.method==='eth_chainId')result='0x1';else if(q.method==='eth_blockNumber')result='0x100';else if(q.method==='eth_getBlockByNumber')result={number:'0x100',hash:'0x'+'11'.repeat(32)};else if(q.method==='eth_getCode')result='0x6000';else if(q.method==='eth_getStorageAt')result=zero;
 else if(q.method==='eth_call'){
  const data=q.params[0].data;assert(!data.startsWith('0x70a08231'),'pair query must not be replaced or supplemented by a balance read');
  if(data.startsWith('0xdd62ed3e')){
   if(mode==='transport'){res.destroy();return;}if(mode==='revert'){res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,error:{code:3,message:'execution reverted https://secret.invalid/CANARY'}}));return;}
   result=mode==='short'?'0x01':mode==='long'?zero+zero.slice(2):mode==='nonhex'?'CANARY':encodeAbiParameters([{type:'uint256'}],[amount]);
  }else result=['0x06fdde03','0x95d89b41'].includes(data)?encodeAbiParameters([{type:'string'}],['SYNTHETIC']):encodeAbiParameters([{type:'uint256'}],[6n]);
 }else assert.fail('Unexpected RPC');res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result}));});
 await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const a=s.address();assert(a&&typeof a!=='string');try{await run(`http://127.0.0.1:${a.port}`,calls);}finally{s.closeAllConnections();await new Promise<void>(r=>s.close(()=>r()));}}
test('opt-in EVM allowance binds three stablecoins, exact pair order/same-pair and bigint0/2^53/max without executing approval',async()=>{
 for(const profile of ['ethereum-usdc','ethereum-usdt','ethereum-rlusd']as const)for(const amount of [0n,2n**53n+1n,max])await mock('ok',amount,async(url,calls)=>{
  const raw=input(profile,amount===0n),old=await runServiceAccountReadOnly(raw,{});validateServiceAccountRun(old,raw);assert.equal(old.stage,'NOT_IMPLEMENTED');assert.equal(calls.length,0);
  const r=await runServiceAccountReadOnly(raw,{evm:url},{evmAllowance:true});validateServiceAccountRun(r,raw);assert.equal(r.evmAllowanceRead,true);assert.equal(r.binding.scenarioId,'ERC20-011');assert.equal(r.binding.value,amount.toString());assert.equal(r.binding.additionalBalanceRead,false);assert.equal(r.verdict,'INCONCLUSIVE');assert.equal(r.binding.queryBlockOrSlot,'256');
  const selected=r.assessment.results.find((s:any)=>s.scenarioId==='ERC20-011');assert.equal(selected.scenarioVersion,'1.0.0');assert.equal(selected.support,'UNKNOWN');assert.equal(selected.observations.readStatus,'OK');
  for(const id of ['ERC20-003','ERC20-004','ERC20-010'])assert.equal(r.assessment.results.find((s:any)=>s.scenarioId===id).verdict,'NOT_TESTED');
  const q=calls.filter(c=>c.method==='eth_call'&&c.params[0].data.startsWith('0xdd62ed3e'));assert.equal(q.length,1);assert.equal(q[0].params[0].data,'0xdd62ed3e'+'0'.repeat(24)+'11'.repeat(20)+'0'.repeat(24)+(amount===0n?'11':'22').repeat(20));
  const forged=structuredClone(r);delete forged.evmAllowanceRead;assert.throws(()=>validateServiceAccountRun(forged,raw));
  const wrongStatus=structuredClone(r);wrongStatus.assessment.results.find((s:any)=>s.scenarioId==='ERC20-011').observations.readStatus='READ_FAILED';wrongStatus.assessmentSha256=createHash('sha256').update(JSON.stringify(wrongStatus.assessment)).digest('hex');assert.throws(()=>validateServiceAccountRun(wrongStatus,raw));
  const bad=structuredClone(r);bad.assessment.evidence.find((e:any)=>e.kind==='RPC'&&e.data.method==='eth_call'&&e.data.params[0].data.startsWith('0xdd62ed3e')).data.params[0].data='0xdd62ed3e'+'0'.repeat(24)+'22'.repeat(20)+'0'.repeat(24)+'11'.repeat(20);bad.assessmentSha256=createHash('sha256').update(JSON.stringify(bad.assessment)).digest('hex');assert.throws(()=>validateServiceAccountRun(bad,raw));
  if(profile==='ethereum-usdc'&&amount===max){const a=input(profile),b=input(profile,true);const [one,two]=await Promise.all([runServiceAccountReadOnly(a,{evm:url},{evmAllowance:true}),runServiceAccountReadOnly(b,{evm:url},{evmAllowance:true})]);validateServiceAccountRun(one,a);validateServiceAccountRun(two,b);assert.notEqual(one.assessment.assessmentId,two.assessment.assessmentId);assert.notEqual(one.binding.request.spenderAddress,two.binding.request.spenderAddress);}
  if(profile==='ethereum-usdc'&&amount===max)await writeReportAtomically('reports/service-account-evm-allowance-synthetic.json',json({kind:'SYNTHETIC_LOCAL_HTTP_ARTIFACT_NOT_MAINNET_EVIDENCE',report:r}));
 });
});
test('incomplete/empty/invalid pairs and actors+spender fail before RPC; short/long/nonhex and revert/transport never become zero',async()=>{
 let count=0;class NoRpc extends Rpc{override async request<T>():Promise<T>{count++;throw Error('Unexpected request');}}
 const rpc=new NoRpc('http://127.0.0.1:1'),adapter=new EvmReadOnlyAdapter('http://127.0.0.1:1',()=>rpc),base={networkId:'1',assetAddress:contextProfiles['ethereum-usdc'].assetAddress};
 for(const request of [{...base,spenderAddress:spender},{...base,accountAddress:owner,spenderAddress:''},{...base,accountAddress:'',spenderAddress:spender},{...base,accountAddress:owner,spenderAddress:'invalid'}])await assert.rejects(adapter.assessReadOnly(request));
 for(const pair of [[undefined,spender],[owner,''],['invalid',spender]]as any[])await assert.rejects(assessEvm(rpc,'1',base.assetAddress,'baseline',undefined,pair[0],pair[1]));
 await assert.rejects(assessEvm(rpc,'1',base.assetAddress,'baseline',{}as any,owner as Address,spender as Address));assert.equal(count,0);
 const balance=JSON.parse(readFileSync(new URL('./fixtures/service-account-context.json',import.meta.url),'utf8'));await assert.rejects(runServiceAccountReadOnly(Buffer.from(JSON.stringify(balance)),{evm:'http://127.0.0.1:1'},{evmAllowance:true}));
 for(const mode of ['short','long','nonhex','revert','transport'])await mock(mode,0n,async(url)=>{const raw=input(),r=await runServiceAccountReadOnly(raw,{evm:url},{evmAllowance:true});validateServiceAccountRun(r,raw);assert.equal(r.stage,['revert','transport'].includes(mode)?'READ_FAILED':'INVALID_RESPONSE');assert(!Object.hasOwn(r.binding,'value'));assert(!JSON.stringify(r).includes('CANARY'));});
});
test('new private Anvil fixture allowance reflects actual approve/revoke state while read adapter emits only read RPC', {timeout:120000},async()=>{
 const lab=await LocalLab.start();try{
  const {bytecodes}=await compileFixtures(),accounts=await lab.rpc.request<Address[]>('eth_accounts');const a=getAddress(accounts[0]!),b=getAddress(accounts[1]!);
  const receipt=await send(lab.rpc,{from:a,data:bytecodes.StandardToken!,gas:'0x7a1200'});assert(receipt.contractAddress);const token=getAddress(receipt.contractAddress),executor=new FixtureExecutor(lab.rpc,token);const methods:string[]=[];
  class ForwardRead extends Rpc{override async request<T>(method:string,params:unknown[]=[]):Promise<T>{assert(['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_getStorageAt','eth_call'].includes(method));methods.push(method);const result=await lab.rpc.request<T>(method,params);this.record('RPC',{method,params,result});return result;}}
  const adapter=new EvmReadOnlyAdapter('http://127.0.0.1:1',()=>new ForwardRead('http://127.0.0.1:1'));
  for(const amount of [0n,17n,max,0n]){
   if(amount!==0n||methods.length){const tx=await executor.transact(a,'approve',[b,amount]);assert.equal(tx.receipt.status,'0x1');assert(tx.events.some(e=>e.name==='Approval'));}
   const before=await executor.read('allowance',[a,b]);const r=await adapter.assessReadOnly({networkId:'31337',assetAddress:token,accountAddress:a,spenderAddress:b});assertSerializedReport(r);const s=r.results.find(s=>s.scenarioId==='ERC20-011')!;assert.equal(s.observations.allowance,amount);assert.equal(before,amount);assert.equal(await executor.read('allowance',[a,b]),before);assert.equal(s.support,'UNKNOWN');assert.equal(s.verdict,'PASS');
  }
  assert(!methods.some(m=>m.startsWith('evm_')||m.startsWith('eth_send')));
 }finally{await lab.stop();}
});
test('explicit CLI allowance saves0600, wrong flags/query failures preserve output and default remains NOT_IMPLEMENTED',async()=>{
 const run=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'evm-allowance-')),file=join(dir,'input.json'),out=join(dir,'out.json'),cmd=['--use-env-proxy','--import','tsx','tools/research/service-account-readonly.ts','--input',file,'--out',out];
 try{const bytes=input();await writeFile(file,bytes);await mock('ok',max,async(url)=>{await run(process.execPath,[...cmd,'--evm-allowance'],{env:{...process.env,RPC_URL:url,TRON_RPC_URL:'CANARY_NOT_USED'},timeout:15000});const r=JSON.parse(await readFile(out,'utf8'));validateServiceAccountRun(r,bytes);assert.equal(r.binding.value,max.toString());assert.equal((await stat(out)).mode&0o777,0o600);});
  await writeFile(out,'KEEP');await mock('long',0n,async(url)=>{await assert.rejects(run(process.execPath,[...cmd,'--evm-allowance'],{env:{...process.env,RPC_URL:url},timeout:15000}));assert.equal(await readFile(out,'utf8'),'KEEP');});
  await assert.rejects(run(process.execPath,cmd,{env:{...process.env,RPC_URL:'IGNORED'},timeout:15000}),(e:any)=>e.code===2);assert.equal(JSON.parse(await readFile(out,'utf8')).stage,'NOT_IMPLEMENTED');assert.deepEqual(await readFile(file),bytes);
 }finally{await rm(dir,{recursive:true,force:true});}
});
