import { hex } from './network.mjs';
export function inspectBytecode(code) {
  if (!code || code === '0x') return { status: 'UNKNOWN', reason: 'NO_RUNTIME', operations: [], selectors: [] };
  const bytes = Buffer.from(hex(code).slice(2), 'hex'), operations = [], selectors = []; let omittedCandidates = 0;
  const names = { 0xf1: 'CALL', 0xf2: 'CALLCODE', 0xf4: 'DELEGATECALL', 0xfa: 'STATICCALL', 0xff: 'SELFDESTRUCT', 0x55: 'SSTORE', 0x34: 'CALLVALUE', 0x33: 'CALLER' };
  for (let pc = 0; pc < bytes.length; pc++) {
    const op = bytes[pc];
    if (names[op]) { if (operations.length < 256) operations.push({ byteOffset: pc, opcode: names[op] }); else omittedCandidates++; }
    if (op >= 0x60 && op <= 0x7f) {
      const size = op - 0x5f;
      if (op === 0x63 && pc + 4 < bytes.length) { if (selectors.length < 256) selectors.push({ byteOffset: pc, candidate: `0x${bytes.subarray(pc + 1, pc + 5).toString('hex')}` }); else omittedCandidates++; }
      pc += size;
    }
  }
  return { status: 'REVIEW_REQUIRED', operations, selectors, omittedCandidates, caveat: 'Linear opcode candidates, not reachable-path proof. At most 256 operations and 256 selectors retained; omitted count is explicit. Includes possible embedded metadata/data. PUSH4 values are not proven function selectors. Source-free behavior and authorization remain UNKNOWN.' };
}
