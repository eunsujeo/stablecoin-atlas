import type { Hex } from 'viem';
import { tronAddress } from '../address.js';
import { decimal } from './lossless.js';
import { sha256 } from './compiler.js';
import { feeLimit, serializeTronRaw, signValidatedTransaction, toTronProtobuf, type DeployPolicy } from './transaction.js';
const check = (ok: unknown) => { if (!ok) throw Error('UNSAFE_CALL_TRANSACTION'); };
const keys = (value: any, allowed: string[]) => { check(value && typeof value === 'object' && !Array.isArray(value)); check(Object.keys(value).every(k => allowed.includes(k))); };
export interface CallPolicy { owner: string; contract: string; data: string; allowedSigners: string[]; block: DeployPolicy['block']; now: string }
function validate(input: any, policy: CallPolicy, lifetime: bigint) {
  keys(input, ['visible', 'txID', 'raw_data', 'raw_data_hex']);
  check(input.visible === undefined || input.visible === false);
  check(policy.allowedSigners.length === 3 && new Set(policy.allowedSigners.map(a => tronAddress(a).hex)).size === 3
    && policy.allowedSigners.map(a => tronAddress(a).hex).includes(tronAddress(policy.owner).hex));
  check(/^(?:[a-f0-9]{2})+$/i.test(policy.data) && policy.data.length >= 8);
  const raw = input.raw_data;
  keys(raw, ['contract', 'ref_block_bytes', 'ref_block_hash', 'timestamp', 'expiration', 'fee_limit']);
  check(Array.isArray(raw.contract) && raw.contract.length === 1 && raw.fee_limit === feeLimit);
  const c = raw.contract[0]; keys(c, ['type', 'parameter', 'Permission_id']);
  check(c.type === 'TriggerSmartContract' && (c.Permission_id === undefined || decimal(c.Permission_id) === 0n));
  keys(c.parameter, ['type_url', 'value']); check(c.parameter.type_url === 'type.googleapis.com/protocol.TriggerSmartContract');
  const v = c.parameter.value; keys(v, ['owner_address', 'contract_address', 'data', 'call_value', 'call_token_value', 'token_id']);
  check(v.owner_address?.toLowerCase() === tronAddress(policy.owner).hex && v.contract_address?.toLowerCase() === tronAddress(policy.contract).hex && v.data?.toLowerCase() === policy.data.toLowerCase());
  for (const field of ['call_value', 'call_token_value', 'token_id']) check(v[field] === undefined || decimal(v[field]) === 0n);
  check(raw.ref_block_bytes === BigInt(policy.block.number).toString(16).padStart(4, '0').slice(-4) && raw.ref_block_hash === policy.block.id.slice(16, 32));
  const now = decimal(policy.now), time = decimal(raw.timestamp), expires = decimal(raw.expiration);
  check(time >= now - 60000n && time <= now + 10000n && expires > now && expires > time && expires <= time + lifetime);
  check(typeof input.raw_data_hex === 'string' && /^(?:[a-f0-9]{2})+$/i.test(input.raw_data_hex) && /^[a-f0-9]{64}$/i.test(input.txID));
  const hex = serializeTronRaw(input);
  check(hex === input.raw_data_hex.toLowerCase() && sha256(Buffer.from(hex, 'hex')) === input.txID.toLowerCase());
  return structuredClone(input);
}
export function validateCallTransaction(input: any, policy: CallPolicy) { return validate(input, policy, 60000n); }
export function prepareCallTransaction(input: any, policy: CallPolicy) {
  const tx = validate(input, policy, 43200000n);
  tx.raw_data.expiration = (decimal(tx.raw_data.timestamp) + 60000n).toString();
  tx.raw_data_hex = serializeTronRaw(tx); tx.txID = sha256(Buffer.from(tx.raw_data_hex, 'hex'));
  return validateCallTransaction(tx, policy);
}
export async function signCallTransaction(input: any, policy: CallPolicy, key: Hex) {
  return signValidatedTransaction(validateCallTransaction(input, policy), policy.owner, key);
}
export function encodeSignedCall(input: any, policy: CallPolicy) {
  const { signature, ...unsigned } = input; validateCallTransaction(unsigned, policy);
  check(Array.isArray(signature) && signature.length === 1 && /^[a-f0-9]{130}$/i.test(signature[0]));
  const pb = toTronProtobuf(unsigned); pb.addSignature(Buffer.from(signature[0], 'hex'));
  return Buffer.from(pb.serializeBinary()).toString('hex');
}
