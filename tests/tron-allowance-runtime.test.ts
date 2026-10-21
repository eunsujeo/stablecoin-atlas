import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData,encodeAbiParameters,type Hex } from 'viem';
import { compileTronAllowanceProbe,tronAllowanceProbes,sha256,type TronAllowanceProbe } from '../src/tron/lab/compiler.js';
import { runAllowanceScenario } from '../src/tron/lab/allowance-scenarios.js';
import { allowanceCasePlan,runAllowanceSuite } from '../src/tron/lab/allowance-suite.js';
import { validateAllowanceReport,validateAllowanceCaseReport,serializeAllowanceReport } from '../src/tron/lab/allowance-report.js';
import { expectedContract } from '../src/tron/lab/transaction.js';
import { serializeTronRaw } from '../src/tron/lab/transaction.js';
import { tronAddress } from '../src/tron/address.js';
import { privateTvmSpecimen } from './helpers/private-tvm-specimen.js';
import { verifyTokenEvent } from '../src/tron/lab/call-evidence.js';
import { toEventSelector } from 'viem';
const supply=2n**128n,owner=tronAddress('41'+'11'.repeat(20)),recipient=tronAddress('41'+'22'.repeat(20)),spender=tronAddress('41'+'33'.repeat(20));
const actors=[owner,recipient,spender].map((address,i)=>({address,privateKey:('0x'+String(i+1).repeat(64))as Hex}));
const deployId='5'.repeat(64),contract=expectedContract(owner.hex,deployId);
const builds=new Map<string,Awaited<ReturnType<typeof compileTronAllowanceProbe>>>();
async function compiled(v:TronAllowanceProbe){if(!builds.has(v))builds.set(v,await compileTronAllowanceProbe(v));return builds.get(v)!;}
async function scenario(v:TronAllowanceProbe,op:'approve'|'transferFrom',fault=''){
 const c=await compiled(v),state={owner:supply,recipient:0n,spender:0n,allowance:0n,totalSupply:supply};let calls=0;
 const session:any={async request(method:string,body:any){if(method==='account')return{address:body.address,balance:'100000000000'};assert.equal(method,'constant');
  const d=decodeFunctionData({abi:c.abi,data:('0x'+body.data)as Hex});let value:bigint;
  if(d.functionName==='totalSupply')value=state.totalSupply;else if(d.functionName==='allowance')value=state.allowance;else{assert.equal(d.functionName,'balanceOf');const a=(d.args![0]as string).toLowerCase();value=a===owner.rpc?state.owner:a===recipient.rpc?state.recipient:state.spender;}
  return{result:{result:true},constant_result:[encodeAbiParameters([{type:'uint256'}],[value]).slice(2)]};}};
 const submit:any=async(_s:any,_contract:string,data:string,_actors:any,actor:any,record:any)=>{
  calls++;const d=decodeFunctionData({abi:c.abi,data:('0x'+data)as Hex}),isApprove=d.functionName==='approve',amount=BigInt(d.args!.at(-1)as bigint),spec=tronAllowanceProbes[v];const defect=spec.operation===d.functionName?spec.defect:'none';
  if(isApprove){if(defect!=='wrong-allowance')state.allowance=amount;}else{if(defect!=='wrong-allowance')state.allowance-=amount;state.owner-=amount;state.recipient+=amount;}
  if(fault==='compound'&&!isApprove)state.spender=1n;
  const raw_data={ref_block_bytes:'0001',ref_block_hash:'ab'.repeat(8),timestamp:'1700000000000',expiration:'1700000060000',fee_limit:'1000000000',contract:[{type:'TriggerSmartContract',parameter:{type_url:'type.googleapis.com/protocol.TriggerSmartContract',value:{owner_address:actor.address.hex,contract_address:contract.hex,data}}}]};
  const rawDataHex=serializeTronRaw({raw_data}),txid=sha256(Buffer.from(rawDataHex,'hex')),name=isApprove?'Approval':'Transfer';
  const log={address:contract.hex.slice(2),topics:[toEventSelector(`${name}(address,address,uint256)`).slice(2),'0'.repeat(24)+owner.hex.slice(2),'0'.repeat(24)+(isApprove?spender:recipient).hex.slice(2)],data:amount.toString(16).padStart(64,'0')};
  const receipt={id:txid,blockNumber:String(calls+2),receipt:{result:'SUCCESS'},contractResult:[(fault==='setup'&&isApprove||defect==='false'?'0'.repeat(64):'0'.repeat(63)+(defect==='malformed'?'2':'1'))],log:defect==='missing-event'?[]:[log]};
  const block={blockID:BigInt(calls+2).toString(16).padStart(16,'0')+'ab'.repeat(24),block_header:{raw_data:{number:String(calls+2)}},transactions:[{txID:txid,raw_data,ret:[{contractRet:'SUCCESS'}]}]};
  Object.assign(record,{txId:txid,builderAccepted:true,stage:'RECEIPT'});return{receipt,block,txid,rawDataHex};
 };
 const record:any={variant:v,operation:op,outcome:'ERROR',stage:'BUILD'};let failed=false;
 try{await runAllowanceScenario(session,contract.hex,c.abi,actors,v,op,record,submit);}catch{failed=true;}
 return{record,failed,calls,build:c};
}
async function report(v:TronAllowanceProbe,op:'approve'|'transferFrom',index:number,fault=''){
 const run=await scenario(v,op,fault),old=privateTvmSpecimen('standard',index),e=old.evidence;
 delete e.probe;e.owner=owner.base58;e.txId=deployId;e.contract=contract.base58;e.receipt.txId=deployId;
 e.actors={owner:owner.base58,recipient:recipient.base58,spender:spender.base58};e.stage=run.failed?'ALLOWANCE_PROBE':'VERIFIED_ALLOWANCE_PROBE';e.scenarioProfile='ALLOWANCE_PROBE';e.allowanceProbe=run.record;
 e.allowanceRuntimeCode={bytecode:run.build.runtimeBytecode,sha256:run.build.build.runtimeBytecodeSha256};
 const r:any={schemaVersion:'1.0',kind:'TRON_PRIVATE_TVM_ALLOWANCE_PROBE',outcome:run.failed?'ERROR':'OBSERVED',runtimeOwnership:run.failed?'UNKNOWN':'OBSERVED_OWNED_ISOLATED_RUNTIME',build:run.build.build,evidence:e,runtime:old.runtime};
 r.runtime.kind=r.kind;r.runtime.outcome=run.failed?'ERROR':'READY';if(run.failed)r.runtime.failure='RUNTIME_CHECK_FAILED';
 Object.assign(r.runtime.observations,{fixture:structuredClone(e),automaticAccountsRequested:true,memoryLimitBytes:'2147483648',cpuLimit:'2',pidsLimit:'256',fixtureRequestCount:'1',fixtureOperationCounts:{constant:'1'}});
 return r;
}
test('allowance work executes normal setup before transferFrom and verifies all ten probe observations',async()=>{
 for(const [i,p]of allowanceCasePlan.entries()){const r=await report(p.variant,p.operation,i+1);validateAllowanceCaseReport(r);assert.equal(r.outcome,'OBSERVED');const p1=r.evidence.allowanceProbe;
  if(p.operation==='transferFrom'){assert.equal(p1.setup.observation.fixtureVerdict,'PASS');assert.equal(BigInt(p1.target.before.allowance)-BigInt(p1.target.amount),7n);}
  else assert(!p1.setup);assert.equal(p1.target.observation.fixtureVerdict,p.variant==='standard'?'PASS':'FAIL');
 }
});
test('setup or composite target failure halts work and cannot become expected rejection',async()=>{
 for(const fault of ['setup','compound']){const run=await scenario('delegated-false','transferFrom',fault);assert(run.failed);assert.equal(run.calls,fault==='setup'?1:2);assert.equal(run.record.outcome,'ERROR');if(fault==='setup')assert(!run.record.target);else assert(!run.record.target.observation);
  const r=await report('delegated-false','transferFrom',1,fault);validateAllowanceCaseReport(r);assert.equal(r.outcome,'ERROR');
 }
});
test('suite requires controls first, distinct runtimes and all cleanup; stops at first error or abort',async()=>{
 const success=await runAllowanceSuite(undefined,async(v,op)=>report(v,op,allowanceCasePlan.findIndex(p=>p.variant===v&&p.operation===op)+1));validateAllowanceReport(success);assert.equal(success.outcome,'OBSERVED');assert.equal(success.cases.length,10);
 for(const fault of ['control','cleanup','throw','abort']){let count=0;const controller=new AbortController();if(fault==='abort')controller.abort();const result=await runAllowanceSuite(controller.signal,async(v,op)=>{count++;if(fault==='throw')throw Error('SECRET_CANARY');const r=await report(v,op,count);r.outcome='ERROR';r.runtime.outcome='ERROR';r.runtimeOwnership='UNKNOWN';r.runtime.failure='CLEANUP_FAILED';if(fault==='cleanup')r.runtime.cleanup.container='FAILED';return r;});validateAllowanceReport(result);assert.equal(result.outcome,'ERROR');assert.equal(count,fault==='abort'?0:1);assert(result.cases.slice(count).every(c=>c.outcome==='NOT_TESTED'));assert(!JSON.stringify(result).includes('SECRET_CANARY'));}
 const reused=await runAllowanceSuite(undefined,async(v,op)=>report(v,op,1));assert.equal(reused.outcome,'ERROR');assert.equal(reused.cases[1]!.outcome,'ERROR');assert(reused.cases.slice(2).every(c=>c.outcome==='NOT_TESTED'));
});
test('allowance report replays raw proof and rejects setup, caller/hash/amount/status/ownership/cleanup/namespace mutations',async()=>{
 const original=await report('delegated-wrong-allowance','transferFrom',1);validateAllowanceCaseReport(original);
 for(const mutate of [(r:any)=>r.evidence.allowanceProbe.setup.after.allowance='0',(r:any)=>r.evidence.allowanceProbe.target.proof.binding.owner=owner.hex,(r:any)=>r.evidence.allowanceProbe.target.proof.txid='0'.repeat(64),
  (r:any)=>r.evidence.allowanceProbe.target.observation.actualError='NONE',(r:any)=>r.evidence.allowanceProbe.target.proof.amount='1',(r:any)=>r.runtime.cleanup.network='FAILED',(r:any)=>r.build.contractName='TronAllowanceControl',(r:any)=>r.evidence.allowanceRuntimeCode.sha256='0'.repeat(64),
  (r:any)=>r.runtimeOwnership='UNKNOWN',(r:any)=>r.runtime.observations.fixtureRequestCount='2']){const r=structuredClone(original);mutate(r);if(r.runtime.observations.fixture)r.runtime.observations.fixture=structuredClone(r.evidence);assert.throws(()=>validateAllowanceCaseReport(r));}
 const wire=serializeAllowanceReport(original);validateAllowanceReport(JSON.parse(wire));
});
