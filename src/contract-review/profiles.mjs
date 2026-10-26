import { sha256 } from './source.mjs';
// Manually reviewed source digest, not an address-based assertion or compiler proof.
export const multicall3Source = '2054218939d3fa0f52f8ce1a33658d570a550671f63197356ee5744f7e188b1e';
export function usageProfile(bundle, analysis) {
  if (!bundle || bundle.name !== 'Multicall3' || !bundle.file || sha256(bundle.sources[bundle.file]?.content ?? '') !== multicall3Source || analysis.selectedContract !== `${bundle.file}:Multicall3`) return {
    name: 'Generic EVM contract', status: 'UNKNOWN', purpose: 'Purpose requires manual review of selected contract, inherited code and integrations.',
    risks: ['Target control, custody, approval, upgrade and reentrancy properties require context-specific review.'],
    recommended: ['Check source binding and all UNKNOWN items before choosing a use case.', 'Use minimal permissions and explicitly validated call targets/arguments.'],
  };
  const locations = names => analysis.functions.filter(f => names.includes(f.name)).map(f => f.location);
  const usageFindings = [
    { rule: 'PERMISSIONLESS_EXECUTOR_ALLOWANCE', severity: 'HIGH', functions: ['aggregate3', 'aggregate3Value'], evidence: 'Supplied target and calldata can invoke transferFrom from executor context. A spender allowance to that executor can be used by another caller.', kind: 'USAGE_RISK' },
    { rule: 'ALLOWED_FAILURE_VALUE_REMAINDER', severity: 'MEDIUM', functions: ['aggregate3Value'], evidence: 'A failed CALL rolls back its value transfer; allowFailure can preserve the batch, retaining that value without a refund.', kind: 'USAGE_RISK' },
    { rule: 'UNFORWARDED_PAYABLE_VALUE', severity: 'MEDIUM', functions: ['aggregate3'], evidence: 'Payable entry performs CALL without value and contains no refund. Value may remain in executor context.', kind: 'USAGE_RISK' },
    { rule: 'UNCHECKED_VALUE_TOTAL', severity: 'HIGH', functions: ['aggregate3Value'], evidence: 'Value accumulator uses unchecked addition before final equality check. Wrapped arithmetic and failed value calls require conservation review; this engine does not prove exploitation.', kind: 'CODE_PATTERN' },
  ].map(f => ({ ...f, id: f.rule, location: locations(f.functions)[0] ?? null, status: 'REVIEW_REQUIRED', exploitability: 'CONDITIONAL_MANUAL_REVIEW', reviewStatus: 'SOURCE_DIGEST_REVIEWED' }));
  return {
    name: 'Multicall3 (reviewed source digest)', status: 'REVIEW_REQUIRED',
    purpose: 'Permissionless batch executor and block-data getters. Public entry points execute supplied targets and calldata.',
    digest: multicall3Source,
    findings: usageFindings,
    behavior: [
      { functions: ['aggregate3'], locations: locations(['aggregate3']), detail: 'Uses CALL without per-call value. Target sees the executor context address as msg.sender. A failed subcall is returned only when allowFailure is true; otherwise the batch reverts. The payable entry does not forward msg.value to targets.' },
      { functions: ['aggregate3Value'], locations: locations(['aggregate3Value']), detail: 'Uses CALL with each supplied value, accumulates values in unchecked arithmetic and compares the wrapped total to msg.value after executing calls. An allowed failed value call retains funds in the executor context; the sum check is not a refund.' },
      { functions: ['tryAggregate', 'tryBlockAndAggregate', 'blockAndAggregate'], locations: locations(['tryAggregate', 'tryBlockAndAggregate', 'blockAndAggregate']), detail: 'Legacy wrappers delegate to batch functions via internal Solidity calls; requireSuccess controls batch reversion.' },
    ],
    contexts: {
      directCall: 'EOA/service -> CALL Multicall3 -> CALL target: target msg.sender = Multicall3; target value = 0 for aggregate3 or explicit per-call value for aggregate3Value. Multicall3 does not implement DELEGATECALL.',
      delegatedIntegration: 'Wallet -> DELEGATECALL Multicall3 -> CALL target: Multicall3 code runs in wallet storage/balance/address context, preserving outer msg.sender/msg.value; target sees wallet as sender. This is an integration choice, not a Multicall3 opcode. Untrusted calldata may spend wallet funds.',
      readBatch: 'eth_call discards state after simulation but aggregate3 uses CALL, not STATICCALL. Inner calls may change simulated state and affect later results. It does not enforce a read-only target policy.',
    },
    risks: [
      'Never approve a permissionless executor as an ERC-20 spender: anyone can submit token.transferFrom(victim, attacker, amount) through it using that allowance.',
      'Do not leave ETH in the executor or assume allowed failed value transfers are refunded. Unchecked value accumulation requires separate value-conservation review; the final equality check alone is not a proof. No wrapped-total exploit was executed.',
      'Sending value to aggregate3 can strand ETH. aggregate3Value partial failures can leave residual ETH. All-or-revert behavior requires checking every result and choosing allowFailure=false where appropriate.',
      'Delegatecalling this code from a wallet needs a strict target/selector/value/argument policy and outer authorization; CALL and DELEGATECALL have different sender, balance and storage consequences.',
      'The same conventional address on another chain does not establish identical code. The upstream project reports a compromised historical deployer and an incorrect Ancient8 deployment; check each chain and fixed block.',
    ],
    recommended: [
      'For read batches use eth_call at a fixed block, send zero value, allowlist view targets/selectors and inspect every success flag; simulation can still include stateful inner CALLs.',
      'For stateful batches verify caller semantics, exact recipients/amounts, target policy, atomicity and per-call failures. Do not grant ERC-20 allowance to this public executor.',
      'Avoid custody/residual balances; account for value retained on allowed failure. Use a reviewed wrapper when authorization, refunds, static enforcement or value conservation is required.',
    ],
    references: ['https://github.com/mds1/multicall3', 'https://www.multicall3.com/'],
  };
}
