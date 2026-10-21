import { decodeFunctionResult, encodeFunctionData, type Hex } from 'viem';
import { tronAddress } from '../address.js';
import type { PrivateFixtureSession } from './runtime.js';
import { decimal } from './lossless.js';
import { feeLimit } from './transaction.js';
import { encodeSignedCall, prepareCallTransaction, signCallTransaction } from './call-transaction.js';
import { resolveFixtureReference, waitForDeploymentReceipt } from './deployment.js';
import { verifyCallReceipt, verifyTokenTransition, verifyTokenPrecondition, type TokenPrecondition, type TokenSample, type ExpectedEvent } from './call-evidence.js';
export interface Actor { address: ReturnType<typeof tronAddress>; privateKey: Hex }
const check = (ok: unknown, code: string) => { if (!ok) throw Error(code); };
export async function runTokenScenarios(session: PrivateFixtureSession, contract: string, abi: any[], actors: Actor[], evidence: Record<string, unknown>[], boundary = false) {
  check(actors.length === 3 && new Set(actors.map(a => a.address.hex)).size === 3, 'FIXTURE_ACTORS_MISMATCH');
  const [owner, recipient, spender] = actors as [Actor, Actor, Actor];
  for (const actor of actors) {
    const account = await session.request('account', { address: actor.address.hex, visible: false });
    check(account.address === actor.address.hex && decimal(account.balance) >= BigInt(feeLimit), 'FIXTURE_ACTOR_NOT_FUNDED');
  }
  const read = async (functionName: string, args: unknown[] = []) => {
    const data = encodeFunctionData({ abi, functionName, args });
    const response = await session.request('constant', { owner_address: owner.address.hex, contract_address: contract, data: data.slice(2), visible: false });
    check(response.result?.result === true && Array.isArray(response.constant_result) && response.constant_result.length === 1, 'FIXTURE_CONSTANT_FAILED');
    const value = decodeFunctionResult({ abi, functionName, data: ('0x' + response.constant_result[0]) as Hex });
    check(typeof value === 'bigint', 'FIXTURE_CONSTANT_INVALID'); return (value as bigint).toString();
  };
  const sample = async (): Promise<TokenSample> => ({ owner: await read('balanceOf', [owner.address.rpc]), recipient: await read('balanceOf', [recipient.address.rpc]),
    spender: await read('balanceOf', [spender.address.rpc]), allowance: await read('allowance', [owner.address.rpc, spender.address.rpc]), totalSupply: await read('totalSupply') });
  const transfer = 2n ** 64n + 123n, approval = 2n ** 63n + 111n;
  const cases: Array<{ id: string; actor: Actor; name: string; args: unknown[]; operation: 'transfer' | 'approve' | 'transferFrom' | 'REVERT'; amount: bigint; event: ExpectedEvent | 'REVERT'; precondition?: TokenPrecondition; balancePlusOne?: boolean }> = [
    { id: 'transfer', actor: owner, name: 'transfer', args: [recipient.address.rpc, transfer], operation: 'transfer', amount: transfer,
      event: { name: 'Transfer', first: owner.address.hex, second: recipient.address.hex, amount: transfer } },
    { id: 'approve', actor: owner, name: 'approve', args: [spender.address.rpc, approval], operation: 'approve', amount: approval,
      event: { name: 'Approval', first: owner.address.hex, second: spender.address.hex, amount: approval } },
    { id: 'transferFrom', actor: spender, name: 'transferFrom', args: [owner.address.rpc, recipient.address.rpc, approval], operation: 'transferFrom', amount: approval,
      event: { name: 'Transfer', first: owner.address.hex, second: recipient.address.hex, amount: approval } },
    { id: 'approve-for-revocation', actor: owner, name: 'approve', args: [spender.address.rpc, approval], operation: 'approve', amount: approval,
      event: { name: 'Approval', first: owner.address.hex, second: spender.address.hex, amount: approval } },
    { id: 'revoke', actor: owner, name: 'approve', args: [spender.address.rpc, 0n], operation: 'approve', amount: 0n,
      event: { name: 'Approval', first: owner.address.hex, second: spender.address.hex, amount: 0n } },
    { id: 'unapproved-transferFrom', actor: spender, name: 'transferFrom', args: [owner.address.rpc, recipient.address.rpc, 1n], operation: 'REVERT', amount: 1n, event: 'REVERT', precondition: 'UNAPPROVED' },
  ];
  if (boundary) cases.splice(3, cases.length - 3,
    { id: 'zero-transfer', actor: owner, name: 'transfer', args: [recipient.address.rpc, 0n], operation: 'transfer', amount: 0n,
      event: { name: 'Transfer', first: owner.address.hex, second: recipient.address.hex, amount: 0n } },
    { id: 'zero-transferFrom-without-allowance', actor: spender, name: 'transferFrom', args: [owner.address.rpc, recipient.address.rpc, 0n], operation: 'transferFrom', amount: 0n,
      event: { name: 'Transfer', first: owner.address.hex, second: recipient.address.hex, amount: 0n }, precondition: 'ZERO_WITHOUT_ALLOWANCE' },
    { id: 'insufficient-balance-transfer', actor: owner, name: 'transfer', args: [recipient.address.rpc, 0n], operation: 'REVERT', amount: 0n,
      event: 'REVERT', precondition: 'BALANCE', balancePlusOne: true },
    { id: 'approve-for-allowance-boundary', actor: owner, name: 'approve', args: [spender.address.rpc, 1n], operation: 'approve', amount: 1n,
      event: { name: 'Approval', first: owner.address.hex, second: spender.address.hex, amount: 1n } },
    { id: 'insufficient-allowance-transferFrom', actor: spender, name: 'transferFrom', args: [owner.address.rpc, recipient.address.rpc, 2n], operation: 'REVERT', amount: 2n,
      event: 'REVERT', precondition: 'ALLOWANCE' },
    { id: 'approve-above-balance', actor: owner, name: 'approve', args: [spender.address.rpc, 0n], operation: 'approve', amount: 0n,
      event: { name: 'Approval', first: owner.address.hex, second: spender.address.hex, amount: 0n }, balancePlusOne: true },
    { id: 'insufficient-balance-transferFrom', actor: spender, name: 'transferFrom', args: [owner.address.rpc, recipient.address.rpc, 0n], operation: 'REVERT', amount: 0n,
      event: 'REVERT', precondition: 'BALANCE_WITH_ALLOWANCE', balancePlusOne: true },
    { id: 'revoke-after-boundaries', actor: owner, name: 'approve', args: [spender.address.rpc, 0n], operation: 'approve', amount: 0n,
      event: { name: 'Approval', first: owner.address.hex, second: spender.address.hex, amount: 0n } });
  for (const scenario of cases) evidence.push({ id: scenario.id, outcome: 'NOT_TESTED', stage: 'NOT_STARTED', amount: scenario.balancePlusOne ? 'UNKNOWN' : scenario.amount.toString(), expectedExecutionResult: scenario.operation === 'REVERT' ? 'REVERT' : 'SUCCESS',
    ...(scenario.balancePlusOne ? { amountRule: 'OWNER_BALANCE_PLUS_ONE' } : {}) });
  let baseline = await sample();
  check(decimal(baseline.allowance) === 0n && decimal(baseline.recipient) === 0n && decimal(baseline.spender) === 0n, 'FIXTURE_INITIAL_STATE_MISMATCH');
  for (const [index, scenario] of cases.entries()) {
    const record: Record<string, unknown> = { id: scenario.id, outcome: 'ERROR', stage: 'BUILD', caller: scenario.actor.address.base58, amount: scenario.balancePlusOne ? 'UNKNOWN' : scenario.amount.toString(), before: baseline, stateResponseBlock: 'UNKNOWN' };
    Object.assign(evidence[index]!, record);
    const current = evidence[index]!;
    if (scenario.balancePlusOne) delete current.amount;
    current.stage = 'PRECONDITION';
    const before = await sample(); current.before = before;
    check(JSON.stringify(before) === JSON.stringify(baseline), 'FIXTURE_BASELINE_CHANGED');
    const amount = scenario.balancePlusOne ? decimal(before.owner) + 1n : scenario.amount;
    current.amount = amount.toString();
    check(amount >= 0n && amount < 2n ** 256n, 'FIXTURE_AMOUNT_OUT_OF_RANGE');
    if (scenario.precondition) { current.precondition = scenario.precondition; verifyTokenPrecondition(before, scenario.precondition, amount); current.preconditionVerified = true; }
    if (scenario.operation === 'REVERT') {
      const account = await session.request('account', { address: scenario.actor.address.hex, visible: false });
      check(account.address === scenario.actor.address.hex && decimal(account.balance) >= BigInt(feeLimit), 'FIXTURE_ACTOR_NOT_FUNDED');
    }
    const args = [...scenario.args.slice(0, -1), amount];
    const expected = scenario.event === 'REVERT' ? 'REVERT' : { ...scenario.event, amount };
    const data = encodeFunctionData({ abi, functionName: scenario.name, args }).slice(2);
    current.stage = 'BUILD';
    const { receipt, block, txid, rawDataHex } = await submitFixtureCall(session, contract, data, actors, scenario.actor, current);
    current.receipt = verifyCallReceipt(receipt, block, txid, contract, expected,
      { owner: scenario.actor.address.hex, data, rawDataHex });
    current.stage = 'STATE';
    const after = await sample(); current.after = after;
    verifyTokenTransition(before, after, scenario.operation, amount);
    current.outcome = 'OBSERVED'; current.stage = 'VERIFIED'; baseline = after;
  }
}

export async function submitFixtureCall(session: PrivateFixtureSession, contract: string, data: string, actors: Actor[], actor: Actor, current: Record<string, unknown>) {
  const response = await session.request('trigger', { owner_address: actor.address.hex, contract_address: contract,
    data, fee_limit: feeLimit, visible: false });
  current.builderAccepted = response.result?.result === true;
  check(response.result?.result === true && response.transaction, 'FIXTURE_TRIGGER_REJECTED');
  const policy = { owner: actor.address.hex, contract, data, allowedSigners: actors.map(a => a.address.hex),
    block: await resolveFixtureReference(session, response.transaction), now: String(Date.now()) };
  const unsigned = prepareCallTransaction(response.transaction, policy);
  const signed = await signCallTransaction(unsigned, { ...policy, now: String(Date.now()) }, actor.privateKey);
  current.txId = signed.txID; current.stage = 'BROADCAST';
  const accepted = await session.request('broadcast', { transaction: encodeSignedCall(signed, { ...policy, now: String(Date.now()) }) });
  check(accepted.result === true && (accepted.txid === undefined || accepted.txid === signed.txID), 'FIXTURE_BROADCAST_REJECTED');
  current.stage = 'RECEIPT';
  const receipt = await waitForDeploymentReceipt(session, signed.txID);
  const n = decimal(receipt.blockNumber); check(n <= BigInt(Number.MAX_SAFE_INTEGER), 'FIXTURE_INVALID_BLOCK');
  const block = await session.request('block', { num: Number(n) });
  return { receipt, block, txid: signed.txID as string, rawDataHex: signed.raw_data_hex as string };
}
