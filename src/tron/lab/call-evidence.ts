import { encodeAbiParameters, toEventSelector } from 'viem';
import { tronAddress } from '../address.js';
import { serializeTronRaw } from './transaction.js';
import { sha256 } from './compiler.js';
import { decimal } from './lossless.js';
const check = (condition: unknown, code: string) => { if (!condition) throw Error(code); };
export interface TokenSample { owner: string; recipient: string; spender: string; allowance: string; totalSupply: string }
export interface ExpectedEvent { name: 'Transfer' | 'Approval'; first: string; second: string; amount: bigint }
export interface CallBinding { owner: string; data: string; rawDataHex: string }
export function collectCallExecution(receipt: any, block: any, txid: string, contract: string, binding: CallBinding, result: 'SUCCESS' | 'REVERT' = 'SUCCESS') {
  check(receipt.id === txid && receipt.receipt?.result === result
    && (result === 'REVERT' ? receipt.result === 'FAILED' : receipt.result === undefined || receipt.result === 'SUCESS'), 'FIXTURE_CALL_EXECUTION_MISMATCH');
  const height = decimal(receipt.blockNumber), header = block.block_header?.raw_data;
  check(decimal(header?.number) === height && typeof block.blockID === 'string' && /^[a-f0-9]{64}$/i.test(block.blockID)
    && BigInt('0x' + block.blockID.slice(0, 16)) === height && Array.isArray(block.transactions)
    && block.transactions.filter((t: any) => t.txID === txid).length === 1
    && block.transactions.find((t: any) => t.txID === txid).ret?.[0]?.contractRet === result, 'FIXTURE_CALL_INCLUSION_MISMATCH');
  const included = block.transactions.find((t: any) => t.txID === txid);
  const calls = included.raw_data?.contract;
  check(Array.isArray(calls) && calls.length === 1 && calls[0].type === 'TriggerSmartContract'
    && calls[0].parameter?.type_url === 'type.googleapis.com/protocol.TriggerSmartContract'
    && calls[0].parameter.value?.owner_address?.toLowerCase() === tronAddress(binding.owner).hex
    && calls[0].parameter.value?.contract_address?.toLowerCase() === tronAddress(contract).hex
    && calls[0].parameter.value?.data?.toLowerCase() === binding.data.toLowerCase(), 'FIXTURE_CALL_BODY_MISMATCH');
  const includedHex = serializeTronRaw(included);
  check(includedHex === binding.rawDataHex.toLowerCase() && sha256(Buffer.from(includedHex, 'hex')) === txid.toLowerCase(), 'FIXTURE_CALL_BODY_MISMATCH');
  return { txId: txid, transaction: { type: 'TriggerSmartContract', owner: tronAddress(binding.owner).base58, contract: tronAddress(contract).base58, calldata: binding.data, rawDataSha256: txid }, executionResult: result, blockNumber: height.toString(), blockId: block.blockID.toLowerCase(),
    ...(receipt.fee === undefined ? {} : { feeSun: decimal(receipt.fee).toString() }),
    ...(receipt.receipt.energy_usage_total === undefined ? {} : { energyUsageTotal: decimal(receipt.receipt.energy_usage_total).toString() }) };
}
export function verifyTokenEvent(receipt: any, contract: string, expected: ExpectedEvent) {
  const topics = [toEventSelector(`${expected.name}(address,address,uint256)`).slice(2),
    encodeAbiParameters([{ type: 'address' }], [tronAddress(expected.first).rpc]).slice(2),
    encodeAbiParameters([{ type: 'address' }], [tronAddress(expected.second).rpc]).slice(2)];
  const data = encodeAbiParameters([{ type: 'uint256' }], [expected.amount]).slice(2);
  check(Array.isArray(receipt.log) && receipt.log.length === 1, 'FIXTURE_CALL_LOG_MISMATCH');
  const log = receipt.log[0];
  check(log.address?.toLowerCase() === tronAddress(contract).hex.slice(2) && Array.isArray(log.topics)
    && JSON.stringify(log.topics.map((t: string) => t.toLowerCase())) === JSON.stringify(topics)
    && log.data?.toLowerCase() === data, 'FIXTURE_CALL_LOG_MISMATCH');
  return { name: expected.name, first: tronAddress(expected.first).base58, second: tronAddress(expected.second).base58,
    amount: expected.amount.toString(), emitter: tronAddress(contract).base58, logIndex: '0', topics: log.topics, data: log.data };
}
export function verifyCallReceipt(receipt: any, block: any, txid: string, contract: string, expected: ExpectedEvent | 'REVERT', binding: CallBinding): ReturnType<typeof collectCallExecution> & { returnValue: boolean | 'NOT_APPLICABLE'; event?: ReturnType<typeof verifyTokenEvent> } {
  const result = expected === 'REVERT' ? 'REVERT' : 'SUCCESS';
  const execution = collectCallExecution(receipt, block, txid, contract, binding, result);
  if (expected === 'REVERT') {
    check(receipt.log === undefined || Array.isArray(receipt.log) && receipt.log.length === 0, 'FIXTURE_REVERT_LOGS_PRESENT');
    return { ...execution, returnValue: 'NOT_APPLICABLE' };
  }
  check(Array.isArray(receipt.contractResult) && receipt.contractResult.length === 1
    && receipt.contractResult[0]?.toLowerCase() === '0'.repeat(63) + '1', 'FIXTURE_CALL_RETURN_MISMATCH');
  const event = verifyTokenEvent(receipt, contract, expected);
  return { ...execution, returnValue: true, event };
}
export function verifyTokenTransition(before: TokenSample, after: TokenSample, operation: 'transfer' | 'approve' | 'transferFrom' | 'REVERT', amount: bigint) {
  const expected = Object.fromEntries(Object.entries(before).map(([key, value]) => [key, decimal(value)])) as Record<keyof TokenSample, bigint>;
  if (operation === 'transfer' || operation === 'transferFrom') { expected.owner -= amount; expected.recipient += amount; }
  if (operation === 'approve') expected.allowance = amount;
  if (operation === 'transferFrom') expected.allowance -= amount;
  check(Object.entries(expected).every(([key, value]) => value >= 0n && decimal(after[key as keyof TokenSample]) === value), 'FIXTURE_CALL_STATE_MISMATCH');
}
export type TokenPrecondition = 'ZERO_WITHOUT_ALLOWANCE' | 'UNAPPROVED' | 'BALANCE' | 'ALLOWANCE' | 'BALANCE_WITH_ALLOWANCE';
export function verifyTokenPrecondition(state: TokenSample, kind: TokenPrecondition, amount: bigint) {
  const balance = decimal(state.owner), allowance = decimal(state.allowance), maximum = 2n ** 256n - 1n;
  check(amount >= 0n && amount <= maximum && balance <= maximum && allowance <= maximum, 'FIXTURE_CALL_PRECONDITION_MISMATCH');
  const matches = kind === 'ZERO_WITHOUT_ALLOWANCE' ? amount === 0n && allowance === 0n
    : kind === 'UNAPPROVED' ? amount > 0n && allowance === 0n && balance >= amount
    : kind === 'BALANCE' ? amount > 0n && balance < amount
    : kind === 'ALLOWANCE' ? amount > 0n && allowance < amount && balance >= amount
    : kind === 'BALANCE_WITH_ALLOWANCE' ? amount > 0n && balance < amount && allowance >= amount : false;
  check(matches, 'FIXTURE_CALL_PRECONDITION_MISMATCH');
}
