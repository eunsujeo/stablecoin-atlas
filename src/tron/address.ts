import { createHash } from 'node:crypto';
import type { Hex } from 'viem';
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const checksum = (data: Buffer) => createHash('sha256').update(createHash('sha256').update(data).digest()).digest().subarray(0, 4);
function base58(data: Buffer): string {
  let value = BigInt('0x' + data.toString('hex')), result = '';
  while (value) { result = alphabet[Number(value % 58n)]! + result; value /= 58n; }
  return result;
}
export function tronAddress(input: string): { base58: string; hex: string; rpc: Hex } {
  const invalid = (): never => { throw new Error('Invalid TRON address.'); };
  if (typeof input !== 'string') return invalid();
  let payload: Buffer;
  if (/^(?:0x)?41[0-9a-fA-F]{40}$/.test(input)) payload = Buffer.from(input.replace(/^0x/, ''), 'hex');
  else {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(input)) return invalid();
    let value = 0n;
    for (const char of input) value = value * 58n + BigInt(alphabet.indexOf(char));
    const decoded = Buffer.from(value.toString(16).padStart(50, '0'), 'hex');
    if (decoded.length !== 25) return invalid();
    payload = decoded.subarray(0, 21);
    if (payload[0] !== 0x41 || !checksum(payload).equals(decoded.subarray(21))) return invalid();
    if (base58(decoded) !== input) return invalid();
  }
  return { base58: base58(Buffer.concat([payload, checksum(payload)])), hex: payload.toString('hex'),
    rpc: `0x${payload.subarray(1).toString('hex')}` };
}
