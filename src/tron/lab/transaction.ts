import utils from 'tronweb/utils';
import { keccak256, recoverAddress, type Hex } from 'viem';
import { sha256 } from './compiler.js';
import { decimal } from './lossless.js';
import { tronAddress } from '../address.js';
const check = (ok: unknown, code = 'UNSAFE_DEPLOY_TRANSACTION') => { if (!ok) throw new Error(code); };
const keys = (o: any, allowed: string[]) => { check(o && typeof o === 'object' && !Array.isArray(o)); check(Object.keys(o).every(k => allowed.includes(k))); };
const zero = (v: unknown) => { if (v !== undefined) check(decimal(v) === 0n); };
export const feeLimit = '1000000000', originEnergyLimit = '10000000';
export interface DeployPolicy { contractName?: string; owner: string; bytecode: string; abi: any[]; block: { number: string; id: string; timestamp: string }; now: string }
export function normalizeAbi(abi: any[]) {
  return abi.map(e => ({ type: String(e.type ?? '').toLowerCase(), name: e.name ?? '',
    inputs: (e.inputs ?? []).map((p: any) => ({ name: p.name ?? '', type: p.type, indexed: p.indexed === true })),
    outputs: (e.outputs ?? []).map((p: any) => ({ name: p.name ?? '', type: p.type, indexed: p.indexed === true })),
    stateMutability: String(e.stateMutability ?? '').toLowerCase(), constant: e.constant === true || e.stateMutability?.toLowerCase() === 'view' || e.stateMutability?.toLowerCase() === 'pure',
    payable: e.payable === true || e.stateMutability?.toLowerCase() === 'payable' }));
}
export function expectedContract(owner: string, txid: string) {
  return tronAddress('41' + keccak256(('0x' + txid + tronAddress(owner).hex) as Hex).slice(-40));
}
function validate(input: any, policy: DeployPolicy, maxLifetime: bigint) {
  keys(input, ['visible', 'txID', 'raw_data', 'raw_data_hex', 'contract_address']);
  check(input.visible === undefined || input.visible === false);
  check(typeof input.raw_data_hex === 'string' && /^(?:[a-f0-9]{2})+$/i.test(input.raw_data_hex)
    && typeof input.txID === 'string' && /^[a-f0-9]{64}$/i.test(input.txID));
  const raw = input.raw_data; keys(raw, ['ref_block_bytes', 'ref_block_hash', 'expiration', 'timestamp', 'contract', 'fee_limit']);
  check(Array.isArray(raw.contract) && raw.contract.length === 1);
  const contract = raw.contract[0]; keys(contract, ['type', 'parameter', 'Permission_id']); zero(contract.Permission_id);
  check(contract.type === 'CreateSmartContract'); keys(contract.parameter, ['type_url', 'value']);
  check(contract.parameter.type_url === 'type.googleapis.com/protocol.CreateSmartContract');
  const value = contract.parameter.value; keys(value, ['owner_address', 'new_contract', 'call_token_value', 'token_id']);
  check(value.owner_address?.toLowerCase() === tronAddress(policy.owner).hex); zero(value.call_token_value); zero(value.token_id);
  const c = value.new_contract; keys(c, ['origin_address', 'abi', 'bytecode', 'call_value', 'consume_user_resource_percent', 'origin_energy_limit', 'name']);
  check(c.origin_address?.toLowerCase() === tronAddress(policy.owner).hex && c.bytecode?.toLowerCase() === policy.bytecode.toLowerCase());
  zero(c.call_value); check(c.consume_user_resource_percent === '100' && c.origin_energy_limit === originEnergyLimit
    && raw.fee_limit === feeLimit && c.name === (policy.contractName ?? 'TronStandardToken'), 'UNSAFE_DEPLOY_RESOURCES');
  keys(c.abi, ['entrys']); check(Array.isArray(c.abi.entrys));
  check(JSON.stringify(normalizeAbi(c.abi.entrys)) === JSON.stringify(normalizeAbi(policy.abi)), 'UNSAFE_DEPLOY_ABI');
  check(raw.ref_block_bytes === BigInt(policy.block.number).toString(16).padStart(4, '0').slice(-4)
    && raw.ref_block_hash === policy.block.id.slice(16, 32));
  const now = decimal(policy.now), time = decimal(raw.timestamp), expires = decimal(raw.expiration);
  check(time >= now - 60000n && time <= now + 10000n && expires > time && expires <= time + maxLifetime && expires > now, 'UNSAFE_DEPLOY_TIME');
  const hex = serializeTronRaw(input);
  check(hex === input.raw_data_hex.toLowerCase() && sha256(Buffer.from(hex, 'hex')) === input.txID.toLowerCase(), 'UNSAFE_DEPLOY_SERIALIZATION');
  if (input.contract_address !== undefined) check(input.contract_address.toLowerCase() === expectedContract(policy.owner, input.txID).hex);
  return structuredClone(input);
}
export function toTronProtobuf(input: any) {
  // SDK serialization only accepts bounded number values on some scalar setters.
  // These conversions never reach report JSON; money remains decimal text in the original.
  const pbInput = structuredClone(input);
  for (const field of ['fee_limit', 'timestamp', 'expiration']) {
    const v = decimal(pbInput.raw_data[field]); check(v <= BigInt(Number.MAX_SAFE_INTEGER)); pbInput.raw_data[field] = Number(v);
  }
  const value = pbInput.raw_data.contract[0].parameter.value;
  const nc = value.new_contract ?? value;
  for (const field of ['consume_user_resource_percent', 'origin_energy_limit', 'call_value', 'call_token_value', 'token_id']) if (nc[field] !== undefined) {
    const v = decimal(nc[field]); check(v <= BigInt(Number.MAX_SAFE_INTEGER)); nc[field] = Number(v);
  }
  if (pbInput.raw_data.contract[0].Permission_id !== undefined) pbInput.raw_data.contract[0].Permission_id = 0;
  return utils.transaction.txJsonToPb(pbInput);
}
export function serializeTronRaw(input: any): string { return utils.transaction.txPbToRawDataHex(toTronProtobuf(input)).toLowerCase(); }
export function validateDeployTransaction(input: any, policy: DeployPolicy) { return validate(input, policy, 60000n); }
export function prepareDeploymentTransaction(input: any, policy: DeployPolicy) {
  // TRE supplies a 12-hour expiry. Authenticate the complete original transaction
  // first, then shorten it locally and recompute its protobuf/hash/address.
  const transaction = validate(input, policy, 43200000n);
  transaction.raw_data.expiration = (decimal(transaction.raw_data.timestamp) + 60000n).toString();
  transaction.raw_data_hex = serializeTronRaw(transaction);
  transaction.txID = sha256(Buffer.from(transaction.raw_data_hex, 'hex'));
  if (transaction.contract_address !== undefined) transaction.contract_address = expectedContract(policy.owner, transaction.txID).hex;
  return validateDeployTransaction(transaction, policy);
}
export async function signVerifiedDeployment(input: any, policy: DeployPolicy, privateKey: Hex) {
  return signValidatedTransaction(validateDeployTransaction(input, policy), policy.owner, privateKey);
}
export async function signValidatedTransaction(input: any, owner: string, privateKey: Hex) {
  const transaction = structuredClone(input);
  const signed = utils.crypto.signTransaction(privateKey.slice(2), transaction);
  check(signed.raw_data_hex === input.raw_data_hex && signed.txID === input.txID && signed.signature?.length === 1);
  check(JSON.stringify(signed.raw_data) === JSON.stringify(input.raw_data));
  const signature = signed.signature[0]!;
  const recovered = await recoverAddress({ hash: ('0x' + signed.txID) as Hex,
    signature: ('0x' + signature.slice(0, 128) + (parseInt(signature.slice(128), 16) < 27 ? (parseInt(signature.slice(128), 16) + 27).toString(16) : signature.slice(128))) as Hex });
  check(tronAddress('41' + recovered.slice(2)).hex === tronAddress(owner).hex);
  return signed;
}

export function encodeSignedDeployment(input: any, policy: DeployPolicy): string {
  const { signature, ...unsigned } = input;
  validateDeployTransaction(unsigned, policy);
  check(Array.isArray(signature) && signature.length === 1 && /^[a-f0-9]{130}$/i.test(signature[0]));
  const pb = toTronProtobuf(unsigned);
  pb.addSignature(Buffer.from(signature[0], 'hex'));
  return Buffer.from(pb.serializeBinary()).toString('hex');
}
