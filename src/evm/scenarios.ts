import { keccak256, toHex, type Address } from 'viem';
import type { Capability, Profile, ScenarioOutcome } from '../domain/model.js';
import { eventMatches, FixtureExecutor, succeeded, type Execution } from './executor.js';
export interface Actors { owner: Address; recipient: Address; spender: Address }
export interface Scenario {
  id: string; capability: Capability;
  run(executor: FixtureExecutor, actors: Actors, profile: Profile): Promise<ScenarioOutcome>;
}
const amount = 10_000n;
const transferTopic = keccak256(toHex('Transfer(address,address,uint256)'));
const outcome = (ok: boolean, observations: Record<string, unknown>, support: ScenarioOutcome['support'] = 'SUPPORTED'): ScenarioOutcome =>
  ({ verdict: ok ? 'PASS' : 'FAIL', support, observations });
async function balances(e: FixtureExecutor, a: Actors) {
  return { sender: await e.read<bigint>('balanceOf', [a.owner]), receiver: await e.read<bigint>('balanceOf', [a.recipient]) };
}
async function transferObservation(e: FixtureExecutor, a: Actors, fromSpender = false) {
  const before = await balances(e, a);
  const tx = fromSpender ? await e.transact(a.spender, 'transferFrom', [a.owner, a.recipient, amount])
    : await e.transact(a.owner, 'transfer', [a.recipient, amount]);
  const after = await balances(e, a);
  const debit = before.sender - after.sender, received = after.receiver - before.receiver;
  const eventValid = eventMatches(tx, 'Transfer', { from: a.owner, to: a.recipient, value: received });
  const valid = succeeded(tx) && debit === amount && received > 0n && received <= debit && eventValid;
  return { before, after, debit, received, eventValid, valid, tx };
}
function rejected(tx: Execution): boolean {
  return tx.receipt.status === '0x0' || (tx.receipt.status === '0x1' && tx.returnKind === 'FALSE');
}
export const scenarios: Scenario[] = [
  { id: 'ERC20-000', capability: 'BALANCE', async run(e, a) {
    const b = await balances(e, a);
    return outcome(b.sender > 0n && b.receiver === 0n, { balances: b, fixturePrecondition: 'Funded owner and empty recipient' });
  } },
  { id: 'ERC20-008', capability: 'TRANSFER', async run(e, a) {
    const before = await balances(e, a), supplyBefore = await e.read<bigint>('totalSupply');
    const tx = await e.transact(a.owner, 'transfer', [a.recipient, 0n]);
    const after = await balances(e, a), supplyAfter = await e.read<bigint>('totalSupply');
    const eventValid = eventMatches(tx, 'Transfer', { from: a.owner, to: a.recipient, value: 0n });
    const balancesUnchanged = before.sender === after.sender && before.receiver === after.receiver;
    const supplyUnchanged = supplyBefore === supplyAfter;
    const valid = succeeded(tx) && eventValid && balancesUnchanged && supplyUnchanged;
    return { ...outcome(valid, { requested: 0n, before, after, supplyBefore, supplyAfter, tx,
      eventValid, balancesUnchanged, supplyUnchanged }, valid ? 'SUPPORTED' : 'UNKNOWN'),
      limitations: ['Only the sampled zero transfer is assessed; other accounts, transferFrom, fees and general conformance are not established. EMPTY is compatibility acceptance, not strict Boolean-return conformance.'] };
  } },
  { id: 'ERC20-009', capability: 'ALLOWANCE', async run(e, a) {
    const approval = await e.transact(a.owner, 'approve', [a.spender, amount]);
    const initialAllowance = await e.read<bigint>('allowance', [a.owner, a.spender]);
    const approvalEventValid = eventMatches(approval, 'Approval', { owner: a.owner, spender: a.spender, value: amount });
    const approvalVerified = succeeded(approval) && approvalEventValid && initialAllowance === amount;
    if (!approvalVerified) return { verdict: 'INCONCLUSIVE', support: 'UNKNOWN',
      observations: { requested: 0n, approval, initialAllowance, approvalEventValid, approvalVerified, zeroTransferAttempted: false },
      limitations: ['Approval prerequisite was not established; zero transferFrom was not attempted.'] };
    const before = await balances(e, a), supplyBefore = await e.read<bigint>('totalSupply');
    const allowanceBefore = await e.read<bigint>('allowance', [a.owner, a.spender]);
    const tx = await e.transact(a.spender, 'transferFrom', [a.owner, a.recipient, 0n]);
    const after = await balances(e, a), supplyAfter = await e.read<bigint>('totalSupply');
    const allowanceAfter = await e.read<bigint>('allowance', [a.owner, a.spender]);
    const eventValid = eventMatches(tx, 'Transfer', { from: a.owner, to: a.recipient, value: 0n });
    const balancesUnchanged = before.sender === after.sender && before.receiver === after.receiver;
    const supplyUnchanged = supplyBefore === supplyAfter;
    const allowanceUnchanged = allowanceBefore === amount && allowanceAfter === allowanceBefore;
    const valid = succeeded(tx) && eventValid && balancesUnchanged && supplyUnchanged && allowanceUnchanged;
    return { ...outcome(valid, { requested: 0n, approval, initialAllowance, approvalEventValid, approvalVerified,
      zeroTransferAttempted: true, before, after, supplyBefore, supplyAfter, allowanceBefore, allowanceAfter,
      tx, eventValid, balancesUnchanged, supplyUnchanged, allowanceUnchanged }, valid ? 'SUPPORTED' : 'UNKNOWN'),
      limitations: ['Only this zero transferFrom with verified finite nonzero approval is assessed; zero-allowance authorization, other inputs and general supply safety remain unverified. EMPTY is compatibility acceptance; preflight is not mined return data.'] };
  } },
  { id: 'ERC20-010', capability: 'ALLOWANCE', async run(e, a) {
    const approval = await e.transact(a.owner, 'approve', [a.spender, amount]);
    const initialAllowance = await e.read<bigint>('allowance', [a.owner, a.spender]);
    const approvalEventValid = eventMatches(approval, 'Approval', { owner: a.owner, spender: a.spender, value: amount });
    const approvalVerified = succeeded(approval) && approvalEventValid && initialAllowance === amount;
    const setup = { requested: 1n, approval, initialAllowance, approvalEventValid, approvalVerified };
    if (!approvalVerified) return { verdict: 'INCONCLUSIVE', support: 'UNKNOWN',
      observations: { ...setup, revokeAttempted: false, probeAttempted: false },
      limitations: ['Approval prerequisite was not established; revocation and spender probe were not attempted.'] };
    const before = await balances(e, a), supplyBefore = await e.read<bigint>('totalSupply');
    const revoke = await e.transact(a.owner, 'approve', [a.spender, 0n]);
    const allowanceAfter = await e.read<bigint>('allowance', [a.owner, a.spender]);
    const after = await balances(e, a), supplyAfter = await e.read<bigint>('totalSupply');
    const revokeEventValid = eventMatches(revoke, 'Approval', { owner: a.owner, spender: a.spender, value: 0n });
    const revokeVerified = succeeded(revoke) && revokeEventValid && allowanceAfter === 0n
      && before.sender === after.sender && before.receiver === after.receiver && supplyBefore === supplyAfter;
    const revocation = { ...setup, revokeAttempted: true, before, supplyBefore, revoke, allowanceAfter,
      after, supplyAfter, revokeEventValid, revokeVerified };
    if (!revokeVerified) return { ...outcome(false, { ...revocation, probeAttempted: false }, 'UNKNOWN'),
      limitations: ['Observed revocation conditions did not match; the spender probe was not attempted.'] };
    const beforeNegative = await balances(e, a), supplyBeforeNegative = await e.read<bigint>('totalSupply');
    const allowanceBefore = await e.read<bigint>('allowance', [a.owner, a.spender]);
    const probePrerequisiteVerified = beforeNegative.sender >= 1n && allowanceBefore === 0n
      && new Set([a.owner.toLowerCase(), a.recipient.toLowerCase(), a.spender.toLowerCase()]).size === 3;
    const probeSetup = { ...revocation, beforeNegative, supplyBeforeNegative, allowanceBefore, probePrerequisiteVerified };
    if (!probePrerequisiteVerified) return { verdict: 'INCONCLUSIVE', support: 'UNKNOWN',
      observations: { ...probeSetup, probeAttempted: false }, limitations: ['Funded owner, distinct actors and zero allowance were not established before the probe.'] };
    const negative = await e.transact(a.spender, 'transferFrom', [a.owner, a.recipient, 1n]);
    const afterNegative = await balances(e, a), supplyAfterNegative = await e.read<bigint>('totalSupply');
    const allowanceAfterNegative = await e.read<bigint>('allowance', [a.owner, a.spender]);
    // A failed receipt alone does not explain a disagreement with preflight.
    const probeRejected = (negative.returnKind === 'REVERT' && negative.receipt.status === '0x0')
      || (negative.returnKind === 'FALSE' && negative.receipt.status === '0x1');
    const probeStateUnchanged = beforeNegative.sender === afterNegative.sender && beforeNegative.receiver === afterNegative.receiver
      && supplyBeforeNegative === supplyAfterNegative && allowanceAfterNegative === allowanceBefore;
    // A malformed Transfer log is still contradictory evidence even if decoding skipped it.
    const noTransferEvent = !negative.receipt.logs.some(log => log.address.toLowerCase() === e.token.toLowerCase()
      && log.topics[0]?.toLowerCase() === transferTopic);
    const indeterminate = negative.returnKind !== 'MALFORMED' && (negative.receipt.status === '0x0'
      ? negative.returnKind !== 'REVERT' : negative.receipt.status !== '0x1' || negative.returnKind === 'REVERT');
    const valid = probeRejected && probeStateUnchanged && noTransferEvent;
    const result = outcome(valid, { ...probeSetup, probeAttempted: true, negative, afterNegative,
      supplyAfterNegative, allowanceAfterNegative, probeRejected, probeStateUnchanged, noTransferEvent }, valid ? 'SUPPORTED' : 'UNKNOWN');
    return { ...result, verdict: !valid && indeterminate && probeStateUnchanged && noTransferEvent ? 'INCONCLUSIVE' : result.verdict,
      limitations: ['Only sampled revocation and subsequent rejection are assessed; rejection is not proof that revocation caused it. Other inputs, actors, alternative permissions and all-state safety remain unverified. EMPTY is compatibility acceptance; preflight is not mined return data.'] };
  } },
  { id: 'ERC20-002', capability: 'TRANSFER', async run(e, a, profile) {
    const observed = await transferObservation(e, a);
    const beforeNegative = await balances(e, a);
    const negative = await e.transact(a.recipient, 'transfer', [a.owner, beforeNegative.receiver + 1n]);
    const afterNegative = await balances(e, a);
    const insufficientBalanceRejected = rejected(negative) && beforeNegative.sender === afterNegative.sender && beforeNegative.receiver === afterNegative.receiver;
    return outcome(observed.valid && insufficientBalanceRejected && (profile !== 'exact-receipt' || observed.received === amount),
      { requested: amount, ...observed, insufficientBalance: { negative, beforeNegative, afterNegative, rejected: insufficientBalanceRejected } }, observed.valid ? 'SUPPORTED' : 'UNKNOWN');
  } },
  { id: 'ERC20-003', capability: 'ALLOWANCE', async run(e, a) {
    const initial = await e.transact(a.owner, 'approve', [a.spender, amount]);
    const initialAllowance = await e.read<bigint>('allowance', [a.owner, a.spender]);
    const update = await e.transact(a.owner, 'approve', [a.spender, amount * 2n]);
    const afterUpdate = await e.read<bigint>('allowance', [a.owner, a.spender]);
    let zeroResetRequired: boolean | 'UNKNOWN' = succeeded(initial) && initialAllowance === amount
      && succeeded(update) && afterUpdate === amount * 2n ? false : 'UNKNOWN';
    let reset: Execution | undefined, retry: Execution | undefined;
    if (!succeeded(update) && initialAllowance === amount && afterUpdate === amount) {
      reset = await e.transact(a.owner, 'approve', [a.spender, 0n]);
      const resetAllowance = await e.read<bigint>('allowance', [a.owner, a.spender]);
      retry = await e.transact(a.owner, 'approve', [a.spender, amount * 2n]);
      zeroResetRequired = succeeded(reset) && resetAllowance === 0n && succeeded(retry) ? true : 'UNKNOWN';
    }
    const finalAllowance = await e.read<bigint>('allowance', [a.owner, a.spender]);
    const effective = retry ?? update;
    const valid = succeeded(initial) && initialAllowance === amount && finalAllowance === amount * 2n && succeeded(effective)
      && eventMatches(initial, 'Approval', { owner: a.owner, spender: a.spender, value: amount })
      && eventMatches(effective, 'Approval', { owner: a.owner, spender: a.spender, value: amount * 2n });
    return outcome(valid, { initial, initialAllowance, update, afterUpdate, zeroResetRequired, reset, retry, finalAllowance }, valid ? 'SUPPORTED' : 'UNKNOWN');
  } },
  { id: 'ERC20-004', capability: 'ALLOWANCE', async run(e, a, profile) {
    const approval = await e.transact(a.owner, 'approve', [a.spender, amount * 2n]);
    const allowanceBefore = await e.read<bigint>('allowance', [a.owner, a.spender]);
    const observed = await transferObservation(e, a, true);
    const allowanceAfter = await e.read<bigint>('allowance', [a.owner, a.spender]);
    const beforeNegative = await balances(e, a);
    const negative = await e.transact(a.spender, 'transferFrom', [a.owner, a.recipient, allowanceAfter + 1n]);
    const afterNegative = await balances(e, a);
    const allowanceAfterNegative = await e.read<bigint>('allowance', [a.owner, a.spender]);
    const insufficientAllowanceRejected = rejected(negative) && allowanceAfterNegative === allowanceAfter
      && beforeNegative.sender === afterNegative.sender && beforeNegative.receiver === afterNegative.receiver;
    return outcome(succeeded(approval) && allowanceBefore === amount * 2n && observed.valid && allowanceAfter === amount
      && insufficientAllowanceRejected && (profile !== 'exact-receipt' || observed.received === amount),
    { approval, allowanceBefore, ...observed, allowanceAfter, insufficientAllowanceRejected,
      negative, beforeNegative, afterNegative, allowanceAfterNegative }, observed.valid ? 'SUPPORTED' : 'UNKNOWN');
  } },
  { id: 'ERC20-005', capability: 'TRANSFER', async run(e, a) {
    const observed = await transferObservation(e, a);
    return outcome(observed.valid, { returnKind: observed.tx.returnKind, stateAndEventCorroborated: observed.valid, ...observed }, observed.valid ? 'SUPPORTED' : 'UNKNOWN');
  } },
  { id: 'ERC20-006', capability: 'TRANSFER_FEE', async run(e, a, profile) {
    const supplyBefore = await e.read<bigint>('totalSupply');
    const observed = await transferObservation(e, a);
    const supplyAfter = await e.read<bigint>('totalSupply');
    if (!observed.valid) return { verdict: 'INCONCLUSIVE', support: 'UNKNOWN', observations: { requested: amount, ...observed },
      limitations: ['A successful transfer with corroborating events is required to assess a receipt difference.'] };
    const difference = observed.debit - observed.received;
    return outcome(profile !== 'exact-receipt' || difference === 0n,
      { requested: amount, ...observed, receiptDifference: difference, feeObserved: difference > 0n,
        supplyBefore, supplyAfter, supplyChange: supplyAfter - supplyBefore }, difference > 0n ? 'SUPPORTED' : 'UNKNOWN');
  } },
  ...(['PAUSE', 'BLACKLIST'] as const).map((capability): Scenario => ({ id: 'ERC20-007', capability, async run(e, a) {
    const pause = capability === 'PAUSE';
    const setter = pause ? 'setPaused' : 'setBlacklisted';
    const enableArgs = pause ? [true] : [a.owner, true];
    const disableArgs = pause ? [false] : [a.owner, false];
    const unauthorized = await e.transact(a.recipient, setter, enableArgs);
    const enable = await e.transact(a.owner, setter, enableArgs);
    if (enable.receipt.status !== '0x1') return { verdict: 'INCONCLUSIVE', support: 'UNKNOWN',
      observations: { unauthorized, enable }, limitations: ['Known fixture setter not executable; arbitrary contracts may expose other controls.'] };
    const adminOwner = await e.read<Address>('owner');
    const enabled = pause ? await e.read<boolean>('paused') : await e.read<boolean>('blacklisted', [a.owner]);
    const before = await balances(e, a);
    const blocked = await e.transact(a.owner, 'transfer', [a.recipient, amount]);
    const after = await balances(e, a);
    const disable = await e.transact(a.owner, setter, disableArgs);
    const disabled = pause ? await e.read<boolean>('paused') : await e.read<boolean>('blacklisted', [a.owner]);
    const restored = await transferObservation(e, a);
    return outcome(unauthorized.receipt.status === '0x0' && adminOwner.toLowerCase() === a.owner.toLowerCase()
      && enabled && !disabled && rejected(blocked) && before.sender === after.sender && before.receiver === after.receiver
      && disable.receipt.status === '0x1' && restored.valid,
    { unauthorized, enable, adminOwner, enabled, blocked, before, after, disable, disabled, restored }, 'SUPPORTED');
  } })),
];
