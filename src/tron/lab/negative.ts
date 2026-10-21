import { decodeFunctionResult, encodeFunctionData, type Hex } from 'viem';
import { tronAddress } from '../address.js';
import { feeLimit } from './transaction.js';
import { decimal } from './lossless.js';
import { collectCallExecution, verifyCallReceipt, verifyTokenEvent, verifyTokenTransition, type CallBinding, type TokenSample, type ExpectedEvent } from './call-evidence.js';
import { submitFixtureCall, type Actor } from './scenarios.js';
import type { TronFixture } from './compiler.js';
import type { PrivateFixtureSession } from './runtime.js';
const check = (ok: unknown, code: string) => { if (!ok) throw Error(code); };
export function verifyTransferProbe(variant: TronFixture, receipt: any, block: any, txid: string, contract: string, event: ExpectedEvent, binding: CallBinding, before: TokenSample, after: TokenSample) {
  const execution = collectCallExecution(receipt, block, txid, contract, binding);
  verifyTokenTransition(before, after, 'transfer', event.amount);
  const returnHex = variant === 'false-return' ? '0'.repeat(64) : variant === 'malformed-return' ? '0'.repeat(63) + '2' : '0'.repeat(63) + '1';
  check(Array.isArray(receipt.contractResult) && receipt.contractResult.length === 1 && receipt.contractResult[0]?.toLowerCase() === returnHex, 'FIXTURE_NEGATIVE_TRAIT_MISMATCH');
  if (variant === 'missing-event') check(receipt.log === undefined || Array.isArray(receipt.log) && receipt.log.length === 0, 'FIXTURE_NEGATIVE_TRAIT_MISMATCH');
  else verifyTokenEvent(receipt, contract, event);
  const expectedError = variant === 'standard' ? 'NONE' : variant === 'missing-event' ? 'FIXTURE_CALL_LOG_MISMATCH' : 'FIXTURE_CALL_RETURN_MISMATCH';
  let actualError = 'NONE';
  try { verifyCallReceipt(receipt, block, txid, contract, event, binding); }
  catch (error) {
    if (!(error instanceof Error) || error.message !== expectedError || expectedError === 'NONE') throw error;
    actualError = error.message;
  }
  check(actualError === expectedError, 'FIXTURE_NEGATIVE_DETECTION_MISSING');
  return { fixtureExpectation: variant === 'standard' ? 'PASS' : 'FAIL', fixtureVerdict: variant === 'standard' ? 'PASS' : 'FAIL',
    validatorRegression: variant === 'standard' ? 'NORMAL_ACCEPTANCE_OBSERVED' : 'EXPECTED_REJECTION_OBSERVED',
    expectedError, actualError, execution, contractResult: receipt.contractResult,
    logs: (receipt.log ?? []).map((l: any) => ({ address: l.address, topics: l.topics, data: l.data })),
    before, after, stateResponseBlock: 'UNKNOWN', limitation: 'Defined private transfer expectation only; not an AssessmentReport verdict or asset safety assessment.' };
}
export async function runTransferProbe(session: PrivateFixtureSession, contract: string, abi: any[], actors: Actor[], variant: TronFixture, record: Record<string, unknown>) {
  check(actors.length === 3 && new Set(actors.map(a => a.address.hex)).size === 3, 'FIXTURE_ACTORS_MISMATCH');
  const [owner, recipient, spender] = actors as [Actor, Actor, Actor];
  const read = async (functionName: string, args: unknown[] = []) => {
    const data = encodeFunctionData({ abi, functionName, args });
    const response = await session.request('constant', { owner_address: owner.address.hex, contract_address: contract, data: data.slice(2), visible: false });
    check(response.result?.result === true && Array.isArray(response.constant_result) && response.constant_result.length === 1, 'FIXTURE_CONSTANT_FAILED');
    const value = decodeFunctionResult({ abi, functionName, data: ('0x' + response.constant_result[0]) as Hex });
    check(typeof value === 'bigint', 'FIXTURE_CONSTANT_INVALID'); return (value as bigint).toString();
  };
  const sample = async (): Promise<TokenSample> => ({ owner: await read('balanceOf', [owner.address.rpc]), recipient: await read('balanceOf', [recipient.address.rpc]), spender: await read('balanceOf', [spender.address.rpc]),
    totalSupply: await read('totalSupply'), allowance: await read('allowance', [owner.address.rpc, spender.address.rpc]) });
  const amount = 2n ** 64n + 123n, before = await sample(); record.before = before; record.amount = amount.toString();
  check(decimal(before.owner) >= amount && decimal(before.recipient) === 0n && decimal(before.spender) === 0n && decimal(before.allowance) === 0n, 'FIXTURE_INITIAL_STATE_MISMATCH');
  const data = encodeFunctionData({ abi, functionName: 'transfer', args: [recipient.address.rpc, amount] }).slice(2);
  const account = await session.request('account', { address: owner.address.hex, visible: false });
  check(account.address === owner.address.hex && decimal(account.balance) >= BigInt(feeLimit), 'FIXTURE_ACTOR_NOT_FUNDED');
  const call = await submitFixtureCall(session, contract, data, actors, owner, record);
  const event: ExpectedEvent = { name: 'Transfer', first: owner.address.hex, second: recipient.address.hex, amount };
  const binding = { owner: owner.address.hex, data, rawDataHex: call.rawDataHex };
  collectCallExecution(call.receipt, call.block, call.txid, contract, binding);
  const expectedError = variant === 'standard' ? 'NONE' : variant === 'missing-event' ? 'FIXTURE_CALL_LOG_MISMATCH' : 'FIXTURE_CALL_RETURN_MISMATCH';
  try { verifyCallReceipt(call.receipt, call.block, call.txid, contract, event, binding); }
  catch (error) { if (!(error instanceof Error) || error.message !== expectedError || expectedError === 'NONE') throw error; }
  // The strict semantic rejection does not prevent collecting actual post-state.
  record.stage = 'STATE'; const after = await sample(); record.after = after;
  record.observation = verifyTransferProbe(variant, call.receipt, call.block, call.txid, contract, event,
    { owner: owner.address.hex, data, rawDataHex: call.rawDataHex }, before, after);
  record.stage = 'VERIFIED'; record.outcome = 'OBSERVED';
}
