import { parseAbi } from 'viem';
export const abi = parseAbi([
  'function name() view returns (string)', 'function symbol() view returns (string)',
  'function decimals() view returns (uint8)', 'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)', 'function approve(address,uint256) returns (bool)',
  'function transferFrom(address,address,uint256) returns (bool)',
  'function owner() view returns (address)', 'function paused() view returns (bool)',
  'function blacklisted(address) view returns (bool)', 'function setPaused(bool)',
  'function setBlacklisted(address,bool)',
  'event Transfer(address indexed from,address indexed to,uint256 value)',
  'event Approval(address indexed owner,address indexed spender,uint256 value)',
]);
export function classifyReturn(data: string): 'TRUE' | 'FALSE' | 'EMPTY' | 'MALFORMED' {
  if (data === '0x') return 'EMPTY';
  if (data === '0x' + '0'.repeat(63) + '1') return 'TRUE';
  if (data === '0x' + '0'.repeat(64)) return 'FALSE';
  return 'MALFORMED';
}
