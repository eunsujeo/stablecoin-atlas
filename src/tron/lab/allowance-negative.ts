import { encodeFunctionData, parseAbi } from 'viem';
import { tronAddress } from '../address.js';
import { decimal } from './lossless.js';
import { tronAllowanceProbes, type TronAllowanceProbe } from './compiler.js';
import { collectCallExecution, verifyCallReceipt, verifyTokenEvent, verifyTokenTransition, type TokenSample, type CallBinding, type ExpectedEvent } from './call-evidence.js';
const check = (ok: unknown, code: string) => { if (!ok) throw new Error(code); };
const abi = parseAbi(['function approve(address,uint256) returns (bool)', 'function transferFrom(address,address,uint256) returns (bool)']);
const maximum = 2n ** 256n - 1n;
const fields = ['allowance','owner','recipient','spender','totalSupply'] as const;
export interface AllowanceProbeInput {
  variant: TronAllowanceProbe; operation: 'approve' | 'transferFrom'; owner: string; recipient: string; spender: string; amount: bigint;
  receipt: any; block: any; txid: string; contract: string; binding: CallBinding; before: TokenSample; after: TokenSample;
}
export function verifyAllowanceProbe(input: AllowanceProbeInput) {
  const { variant, operation, amount, receipt, block, txid, binding, before, after } = input;
  check(Object.hasOwn(tronAllowanceProbes, variant), 'FIXTURE_VARIANT_REJECTED');
  const spec = tronAllowanceProbes[variant];
  check(['approve','transferFrom'].includes(operation) && (spec.operation === 'both' || spec.operation === operation), 'FIXTURE_ALLOWANCE_OPERATION_MISMATCH');
  const [owner,recipient,spender,contract] = [input.owner,input.recipient,input.spender,input.contract].map(a => tronAddress(a));
  check(new Set([owner!.hex,recipient!.hex,spender!.hex,contract!.hex]).size === 4 && [owner,recipient,spender,contract].every(a => !/^0x0{40}$/i.test(a!.rpc)), 'FIXTURE_ACTORS_MISMATCH');
  check(typeof amount === 'bigint' && amount > 0n && amount <= maximum, 'FIXTURE_AMOUNT_OUT_OF_RANGE');
  for (const state of [before,after]) {
    check(JSON.stringify(Object.keys(state).sort()) === JSON.stringify(fields), 'FIXTURE_CALL_STATE_MISMATCH');
    for (const field of fields) check(decimal(state[field]) <= maximum, 'FIXTURE_AMOUNT_OUT_OF_RANGE');
  }
  check(operation === 'approve' ? decimal(before.allowance) === 0n : decimal(before.allowance) >= amount && decimal(before.allowance) < maximum && decimal(before.owner) >= amount, 'FIXTURE_CALL_PRECONDITION_MISMATCH');
  const caller = operation === 'approve' ? owner! : spender!;
  const data = operation === 'approve'
    ? encodeFunctionData({abi,functionName:'approve',args:[spender!.rpc,amount]}).slice(2)
    : encodeFunctionData({abi,functionName:'transferFrom',args:[owner!.rpc,recipient!.rpc,amount]}).slice(2);
  check(tronAddress(binding.owner).hex === caller.hex && binding.data.toLowerCase() === data, 'FIXTURE_CALL_BODY_MISMATCH');
  const event: ExpectedEvent = { name: operation === 'approve' ? 'Approval' : 'Transfer', first: owner!.hex, second: operation === 'approve' ? spender!.hex : recipient!.hex, amount };
  const execution = collectCallExecution(receipt,block,txid,contract!.hex,binding);
  const expectedReturn = spec.defect === 'false' ? '0'.repeat(64) : spec.defect === 'malformed' ? '0'.repeat(63)+'2' : '0'.repeat(63)+'1';
  check(Array.isArray(receipt.contractResult) && receipt.contractResult.length === 1 && typeof receipt.contractResult[0] === 'string' && receipt.contractResult[0].toLowerCase() === expectedReturn, 'FIXTURE_ALLOWANCE_TRAIT_MISMATCH');
  if (spec.defect === 'missing-event') check(receipt.log === undefined || Array.isArray(receipt.log) && receipt.log.length === 0, 'FIXTURE_ALLOWANCE_TRAIT_MISMATCH');
  else verifyTokenEvent(receipt,contract!.hex,event);
  const expected = structuredClone(before);
  if (operation === 'approve') expected.allowance = amount.toString();
  else { expected.owner=(decimal(before.owner)-amount).toString(); expected.recipient=(decimal(before.recipient)+amount).toString(); expected.allowance=(decimal(before.allowance)-amount).toString(); }
  for (const field of fields) check(after[field] === (field === 'allowance' && spec.defect === 'wrong-allowance' ? before.allowance : expected[field]), 'FIXTURE_CALL_STATE_MISMATCH');
  const expectedError = spec.defect === 'none' ? 'NONE' : spec.defect === 'missing-event' ? 'FIXTURE_CALL_LOG_MISMATCH' : spec.defect === 'wrong-allowance' ? 'FIXTURE_CALL_STATE_MISMATCH' : 'FIXTURE_CALL_RETURN_MISMATCH';
  let actualError = 'NONE';
  try { verifyCallReceipt(receipt,block,txid,contract!.hex,event,binding); verifyTokenTransition(before,after,operation,amount); }
  catch (error) { if (!(error instanceof Error) || error.message !== expectedError || expectedError === 'NONE') throw error; actualError=error.message; }
  check(actualError === expectedError, 'FIXTURE_NEGATIVE_DETECTION_MISSING');
  return { variant,operation,amount:amount.toString(),fixtureExpectation:spec.defect === 'none' ? 'PASS' : 'FAIL',fixtureVerdict:spec.defect === 'none' ? 'PASS' : 'FAIL',
    validatorRegression:spec.defect === 'none' ? 'NORMAL_ACCEPTANCE_OBSERVED' : 'EXPECTED_REJECTION_OBSERVED',expectedError,actualError,execution,
    contractResult:structuredClone(receipt.contractResult),logs:(receipt.log??[]).map((l:any)=>({address:l.address,topics:structuredClone(l.topics),data:l.data})),before:structuredClone(before),after:structuredClone(after),
    stateResponseBlock:'UNKNOWN',verificationScope:'CALL_RECEIPT_AND_SAMPLED_STATE_ONLY',runtimeOwnership:'NOT_ESTABLISHED_BY_THIS_VERIFIER',
    limitation:'Receipt/state verification only; provenance, owned runtime, actual TVM execution and asset safety require separate evidence.' };
}
