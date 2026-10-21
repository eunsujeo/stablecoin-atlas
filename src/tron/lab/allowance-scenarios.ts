import { decodeFunctionResult, encodeFunctionData, type Hex } from 'viem';
import { tronAddress } from '../address.js';
import { decimal } from './lossless.js';
import { feeLimit } from './transaction.js';
import { submitFixtureCall, type Actor } from './scenarios.js';
import { collectCallExecution, type TokenSample } from './call-evidence.js';
import { verifyAllowanceProbe, type AllowanceProbeInput } from './allowance-negative.js';
import { tronAllowanceProbes, type TronAllowanceProbe } from './compiler.js';
import type { PrivateFixtureSession } from './runtime.js';
const check=(ok:unknown,code:string)=>{if(!ok)throw new Error(code);};
export const allowanceProbeAmount=2n**64n+123n;
export type AllowanceProof=Omit<AllowanceProbeInput,'amount'> & {amount:string};
export function replayAllowanceProof(proof: AllowanceProof) {
  check(typeof proof.amount==='string'&&/^[1-9][0-9]*$/.test(proof.amount),'FIXTURE_AMOUNT_OUT_OF_RANGE');
  return verifyAllowanceProbe({...proof,amount:decimal(proof.amount)});
}
export async function runAllowanceScenario(session:PrivateFixtureSession,contract:string,abi:any[],actors:Actor[],variant:TronAllowanceProbe,operation:'approve'|'transferFrom',record:Record<string,any>,submit=submitFixtureCall) {
  check(Object.hasOwn(tronAllowanceProbes,variant),'FIXTURE_VARIANT_REJECTED');
  const spec=tronAllowanceProbes[variant];check(spec.operation==='both'||spec.operation===operation,'FIXTURE_ALLOWANCE_OPERATION_MISMATCH');
  check(actors.length===3&&new Set(actors.map(a=>a.address.hex)).size===3,'FIXTURE_ACTORS_MISMATCH');
  const [owner,recipient,spender]=actors as [Actor,Actor,Actor];
  for(const a of actors){const account=await session.request('account',{address:a.address.hex,visible:false});check(account.address?.toLowerCase()===a.address.hex&&decimal(account.balance)>=BigInt(feeLimit),'FIXTURE_ACTOR_NOT_FUNDED');}
  const read=async(functionName:string,args:unknown[]=[])=>{
    const data=encodeFunctionData({abi,functionName,args}),response=await session.request('constant',{owner_address:owner.address.hex,contract_address:contract,data:data.slice(2),visible:false});
    check(response.result?.result===true&&Array.isArray(response.constant_result)&&response.constant_result.length===1&&/^[a-f0-9]{64}$/i.test(response.constant_result[0]),'FIXTURE_CONSTANT_FAILED');
    const v=decodeFunctionResult({abi,functionName,data:('0x'+response.constant_result[0])as Hex});check(typeof v==='bigint','FIXTURE_CONSTANT_INVALID');return (v as bigint).toString();
  };
  const sample=async():Promise<TokenSample>=>({owner:await read('balanceOf',[owner.address.rpc]),recipient:await read('balanceOf',[recipient.address.rpc]),spender:await read('balanceOf',[spender.address.rpc]),allowance:await read('allowance',[owner.address.rpc,spender.address.rpc]),totalSupply:await read('totalSupply')});
  let baseline=await sample();record.initialSample=baseline;
  check(decimal(baseline.owner)===2n**128n&&baseline.totalSupply===baseline.owner&&baseline.recipient==='0'&&baseline.spender==='0'&&baseline.allowance==='0','FIXTURE_INITIAL_STATE_MISMATCH');
  async function execute(which:'approve'|'transferFrom',selected:TronAllowanceProbe,amount:bigint,current:Record<string,any>) {
    current.outcome='ERROR';current.stage='PRECONDITION';const before=await sample();current.before=before;check(JSON.stringify(before)===JSON.stringify(baseline),'FIXTURE_BASELINE_CHANGED');
    const actor=which==='approve'?owner:spender,args=which==='approve'?[spender.address.rpc,amount]:[owner.address.rpc,recipient.address.rpc,amount];
    const data=encodeFunctionData({abi,functionName:which,args}).slice(2);current.amount=amount.toString();
    const call=await submit(session,contract,data,actors,actor,current),binding={owner:actor.address.hex,data,rawDataHex:call.rawDataHex};
    collectCallExecution(call.receipt,call.block,call.txid,contract,binding);
    current.stage='STATE';const after=await sample();current.after=after;
    const included=call.block.transactions.find((t:any)=>t.txID===call.txid);
    const rawReceipt=Object.fromEntries(['id','blockNumber','result','fee','contractResult','log'].filter(k=>call.receipt[k]!==undefined).map(k=>[k,structuredClone(call.receipt[k])]));
    rawReceipt.receipt=Object.fromEntries(['result','energy_usage_total'].filter(k=>call.receipt.receipt[k]!==undefined).map(k=>[k,call.receipt.receipt[k]]));
    const proof:AllowanceProof={variant:selected,operation:which,owner:owner.address.hex,recipient:recipient.address.hex,spender:spender.address.hex,amount:amount.toString(),contract:tronAddress(contract).hex,txid:call.txid,binding,before,after,
      receipt:rawReceipt,block:{blockID:call.block.blockID,block_header:{raw_data:{number:call.block.block_header.raw_data.number}},transactions:[{txID:included.txID,raw_data:structuredClone(included.raw_data),ret:included.ret.map((r:any)=>({contractRet:r.contractRet}))}]}};
    current.proof=proof;current.observation=replayAllowanceProof(proof);current.stage='VERIFIED';current.outcome='OBSERVED';baseline=after;
  }
  if(operation==='transferFrom') {record.setup={outcome:'NOT_TESTED',stage:'NOT_STARTED'};await execute('approve','standard',allowanceProbeAmount+7n,record.setup);}
  record.target={outcome:'NOT_TESTED',stage:'NOT_STARTED'};await execute(operation,variant,allowanceProbeAmount,record.target);
  record.stage='VERIFIED';record.outcome='OBSERVED';
}
