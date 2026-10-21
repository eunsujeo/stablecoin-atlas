export const LEGACY_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function encodePublicKey(bytes: Uint8Array): string {
  if (bytes.length !== 32) throw new Error('INVALID_PUBLIC_KEY');
  let value = BigInt('0x' + Buffer.from(bytes).toString('hex')), result = '', zeros = 0;
  for (const byte of bytes) { if (byte !== 0) break; zeros++; }
  while (value > 0n) { result = alphabet[Number(value % 58n)]! + result; value /= 58n; }
  return '1'.repeat(zeros) + result;
}
export function publicKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  let n = 0n, leading = 0;
  for (const c of value) n = n * 58n + BigInt(alphabet.indexOf(c));
  for (const c of value) { if (c !== '1') break; leading++; }
  const hex = n.toString(16);
  const body = n === 0n ? Buffer.alloc(0) : Buffer.from(hex.padStart(Math.ceil(hex.length / 2) * 2, '0'), 'hex');
  const bytes = Buffer.concat([Buffer.alloc(leading), body]);
  return bytes.length === 32 && encodePublicKey(bytes) === value;
}
