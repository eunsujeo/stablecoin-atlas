import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toEventSelector } from 'viem';
import { verifyAllowanceProbe, type AllowanceProbeInput } from '../src/tron/lab/allowance-negative.js';
import { compileTronAllowanceProbe,tronAllowanceProbes,compilerPin,sha256,type TronAllowanceProbe } from '../src/tron/lab/compiler.js';
import { serializeTronRaw } from '../src/tron/lab/transaction.js';
import { json } from '../src/domain/evaluator.js';
import { writeReportAtomically } from '../src/report-output.js';
const owner='41'+'11'.repeat(20),recipient='41'+'22'.repeat(20),spender='41'+'33'.repeat(20),contract='41'+'44'.repeat(20),supply=2n**128n,amount=2n**64n+123n,max=2n**256n-1n;
const word=(n:bigint)=>n.toString(16).padStart(64,'0'),addressWord=(a:string)=>'0'.repeat(24)+a.slice(2);
const cases:Array<[TronAllowanceProbe,'approve'|'transferFrom',string]>=[['standard','approve','NONE'],['standard','transferFrom','NONE'],['approve-false','approve','FIXTURE_CALL_RETURN_MISMATCH'],['approve-malformed','approve','FIXTURE_CALL_RETURN_MISMATCH'],['approve-missing-event','approve','FIXTURE_CALL_LOG_MISMATCH'],['approve-wrong-allowance','approve','FIXTURE_CALL_STATE_MISMATCH'],['delegated-false','transferFrom','FIXTURE_CALL_RETURN_MISMATCH'],['delegated-malformed','transferFrom','FIXTURE_CALL_RETURN_MISMATCH'],['delegated-missing-event','transferFrom','FIXTURE_CALL_LOG_MISMATCH'],['delegated-wrong-allowance','transferFrom','FIXTURE_CALL_STATE_MISMATCH']];
function specimen(variant:TronAllowanceProbe,operation:'approve'|'transferFrom',n=amount):AllowanceProbeInput{
 const approve=operation==='approve',caller=approve?owner:spender;
 const data=approve?'095ea7b3'+addressWord(spender)+word(n):'23b872dd'+addressWord(owner)+addressWord(recipient)+word(n);
 const raw={ref_block_bytes:'0001',ref_block_hash:'ab'.repeat(8),timestamp:'1700000000000',expiration:'1700000060000',fee_limit:'1000000000',contract:[{type:'TriggerSmartContract',parameter:{type_url:'type.googleapis.com/protocol.TriggerSmartContract',value:{owner_address:caller,contract_address:contract,data}}}]};
 const rawDataHex=serializeTronRaw({raw_data:raw}),txid=sha256(Buffer.from(rawDataHex,'hex'));
 const before={owner:supply.toString(),recipient:'0',spender:'0',allowance:approve?'0':(n+7n).toString(),totalSupply:supply.toString()};
 const after=approve?{...before,allowance:n.toString()}:{...before,owner:(supply-n).toString(),recipient:n.toString(),allowance:'7'};
 if(variant.endsWith('wrong-allowance'))after.allowance=before.allowance;
 const log={address:contract.slice(2),topics:[toEventSelector(approve?'Approval(address,address,uint256)':'Transfer(address,address,uint256)').slice(2),addressWord(owner),addressWord(approve?spender:recipient)],data:word(n)};
 const receipt={id:txid,blockNumber:'2',receipt:{result:'SUCCESS'},contractResult:[variant.endsWith('false')?word(0n):variant.endsWith('malformed')?word(2n):word(1n)],log:variant.endsWith('missing-event')?[]:[log]};
 const block={blockID:'0000000000000002'+'ab'.repeat(24),block_header:{raw_data:{number:'2'}},transactions:[{txID:txid,raw_data:raw,ret:[{contractRet:'SUCCESS'}]}]};
 return{variant,operation,owner,recipient,spender,contract,amount:n,receipt,block,txid,binding:{owner:caller,data,rawDataHex},before,after};
}
test('synthetic approve/transferFrom controls and eight single-defect cases require exact normal rejection, not arbitrary failure',async()=>{
 const observations=[];
 for(const[v,op,error]of cases){const x=specimen(v,op),r=verifyAllowanceProbe(x);assert.equal(r.actualError,error);assert.equal(r.fixtureVerdict,v==='standard'?'PASS':'FAIL');assert.equal(r.validatorRegression,v==='standard'?'NORMAL_ACCEPTANCE_OBSERVED':'EXPECTED_REJECTION_OBSERVED');assert.equal(r.stateResponseBlock,'UNKNOWN');assert.equal(r.runtimeOwnership,'NOT_ESTABLISHED_BY_THIS_VERIFIER');assert.equal(r.amount,amount.toString());observations.push(r);const snapshot=r.after.allowance;x.after.allowance='123';assert.equal(r.after.allowance,snapshot);}
 await writeReportAtomically('reports/tron-allowance-probe-synthetic.json',json({kind:'SYNTHETIC_VALIDATOR_CASES_NOT_TVM_EXECUTION',actualTvmExecution:'NOT_TESTED',cases:observations}));
});
test('execution, caller, selectors, complete arguments, transaction hash and inclusion errors are never expected semantic rejection',()=>{
 const mutations:Array<(x:AllowanceProbeInput)=>void>=[x=>x.receipt.id='00'.repeat(32),x=>x.receipt.receipt.result='REVERT',x=>x.receipt.receipt.result='OUT_OF_ENERGY',x=>x.block.transactions=[],x=>x.block.blockID='00'.repeat(32),x=>x.binding.owner=recipient,
 x=>x.binding.data='095ea7b3'+addressWord(recipient)+word(amount),x=>x.block.transactions[0].raw_data.contract[0].parameter.value.owner_address=recipient,x=>x.binding.rawDataHex='00',x=>x.owner=x.spender,x=>x.variant='__proto__' as any,x=>x.operation='transfer' as any];
 for(const[v,op]of cases)for(const mutate of mutations){const x=specimen(v,op);mutate(x);assert.throws(()=>verifyAllowanceProbe(x));}
 // Consistently re-hashing a different call must still fail operation-derived calldata.
 const x=specimen('approve-false','approve');x.block.transactions[0].raw_data.contract[0].parameter.value.data='095ea7b3'+addressWord(recipient)+word(amount);x.binding.data=x.block.transactions[0].raw_data.contract[0].parameter.value.data;x.binding.rawDataHex=serializeTronRaw(x.block.transactions[0]);x.txid=sha256(Buffer.from(x.binding.rawDataHex,'hex'));x.receipt.id=x.block.transactions[0].txID=x.txid;assert.throws(()=>verifyAllowanceProbe(x),/BODY_MISMATCH/);
});
test('independent return/event/state checks reject compound defects, wrong log contents and balance/supply/allowance drift',()=>{
 for(const[v,op]of cases){
  for(const mutate of [(x:AllowanceProbeInput)=>x.after.owner='1',(x:AllowanceProbeInput)=>x.after.spender='1',(x:AllowanceProbeInput)=>x.after.totalSupply='1',(x:AllowanceProbeInput)=>x.receipt.contractResult=[],(x:AllowanceProbeInput)=>x.receipt.contractResult=[word(3n)]]){const x=specimen(v,op);mutate(x);assert.throws(()=>verifyAllowanceProbe(x));}
  if(!v.endsWith('missing-event'))for(const mutate of [(x:AllowanceProbeInput)=>x.receipt.log=[],(x:AllowanceProbeInput)=>x.receipt.log[0].data=word(1n),(x:AllowanceProbeInput)=>x.receipt.log[0].topics[1]=addressWord(recipient),(x:AllowanceProbeInput)=>x.receipt.log[0].address=owner.slice(2),(x:AllowanceProbeInput)=>x.receipt.log.push(x.receipt.log[0])]){const x=specimen(v,op);mutate(x);assert.throws(()=>verifyAllowanceProbe(x));}
  if(v!=='standard'){const x=specimen(v,op);if(v.endsWith('wrong-allowance'))x.after.recipient='1';else x.after.allowance='1';assert.throws(()=>verifyAllowanceProbe(x));}
 }
});
test('positive amount, uint256 state bounds and finite sufficient transferFrom baseline are explicit preconditions',()=>{
 for(const op of ['approve','transferFrom']as const){for(const n of [0n,-1n,max+1n]){const x=specimen('standard',op);x.amount=n;assert.throws(()=>verifyAllowanceProbe(x));}const x=specimen('standard',op);x.before.totalSupply=(max+1n).toString();assert.throws(()=>verifyAllowanceProbe(x));}
 for(const field of ['owner','allowance']as const){const x=specimen('standard','transferFrom');x.before[field]='0';assert.throws(()=>verifyAllowanceProbe(x),/PRECONDITION/);}
 const infinite=specimen('standard','transferFrom');infinite.before.allowance=max.toString();assert.throws(()=>verifyAllowanceProbe(infinite),/PRECONDITION/);
 const control=specimen('standard','approve',max);assert.equal(verifyAllowanceProbe(control).after.allowance,max.toString());const wrong=specimen('approve-wrong-allowance','approve',max);assert.equal(verifyAllowanceProbe(wrong).actualError,'FIXTURE_CALL_STATE_MISMATCH');
 const wrongOperation=specimen('approve-false','transferFrom');assert.throws(()=>verifyAllowanceProbe(wrongOperation),/OPERATION_MISMATCH/);
});
test('separate compiler allowlist pins nine approval contracts and ABI/source/init/runtime hashes without changing transfer variants',async()=>{
 await assert.rejects(compileTronAllowanceProbe('../outside.sol' as any),/VARIANT_REJECTED/);await assert.rejects(compileTronAllowanceProbe('__proto__' as any),/VARIANT_REJECTED/);
 const source=readFileSync(new URL('../fixtures/TronAllowanceProbes.sol',import.meta.url)),hashes=new Set<string>(),oldFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Compiler must use existing pinned local cache');};
 try{assert.equal(Object.keys(tronAllowanceProbes).length,9);for(const v of Object.keys(tronAllowanceProbes)as TronAllowanceProbe[]){const c=await compileTronAllowanceProbe(v);assert.equal(c.build.version,compilerPin.version);assert.equal(c.build.sha256,compilerPin.sha256);assert.equal(c.build.sourceFile,'TronAllowanceProbes.sol');assert.equal(c.build.contractName,tronAllowanceProbes[v].contractName);assert.equal(c.build.sourceSha256,sha256(source));assert.equal(c.build.abiSha256,sha256(JSON.stringify(c.abi)));assert.equal(c.build.bytecodeSha256,sha256(Buffer.from(c.bytecode,'hex')));assert.equal(c.build.runtimeBytecodeSha256,sha256(Buffer.from(c.runtimeBytecode,'hex')));assert(c.abi.some(a=>a.name==='approve'&&a.inputs.map((i:any)=>i.type).join(',')==='address,uint256'));assert(c.abi.some(a=>a.name==='transferFrom'&&a.inputs.map((i:any)=>i.type).join(',')==='address,address,uint256'));assert(!c.abi.some(a=>/^set|mint|freeze|upgrade/.test(a.name??'')));hashes.add(c.build.bytecodeSha256);}}
 finally{globalThis.fetch=oldFetch;}assert.equal(hashes.size,9);
});
