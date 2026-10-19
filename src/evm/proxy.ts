import { getAddress, type Address, type Hex } from 'viem';
import { known, unknown, type Knowledge } from '../domain/model.js';
import { Rpc } from './rpc.js';

export const proxySlots = {
  implementation: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  beacon: '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
  admin: '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
  legacyImplementation: '0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3',
  legacyAdmin: '0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b',
} as const;
type Probe = { status: 'VALUE'; address: Address } | { status: 'ZERO' | 'READ_FAILED' | 'INVALID_RESPONSE' };
export interface ProxyObservation {
  pattern: 'EIP1967_IMPLEMENTATION_SLOT' | 'EIP1967_BEACON_SLOT' | 'ZEPPELINOS_IMPLEMENTATION_SLOT' | 'ERC1167_CANONICAL' | 'UNKNOWN';
  resolution: 'RESOLVED' | 'UNRESOLVED';
  implementationAddress: Knowledge<string>; adminAddress: Knowledge<string>; beaconAddress: Knowledge<string>;
  candidateImplementation: Knowledge<string>;
  probes: Record<string, Probe>;
  limitations: string[];
}
export function decodeAddressWord(raw: unknown): Probe {
  if (typeof raw !== 'string' || !/^0x0{24}[0-9a-f]{40}$/i.test(raw)) return { status: 'INVALID_RESPONSE' };
  if (BigInt(raw) === 0n) return { status: 'ZERO' };
  return { status: 'VALUE', address: getAddress(`0x${raw.slice(-40)}`) };
}
export function canonicalCloneTarget(code: string): Address | undefined {
  const match = /^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/i.exec(code);
  return match ? getAddress(`0x${match[1]!}`) : undefined;
}
const hasCode = (raw: unknown): boolean => typeof raw === 'string' && /^0x(?:[0-9a-f]{2})+$/i.test(raw);

// A storage signal identifies a declared target; it does not prove dispatch or authority.
export async function inspectProxy(rpc: Rpc, token: Address, code: string, block: Hex): Promise<ProxyObservation> {
  const result: ProxyObservation = {
    pattern: 'UNKNOWN', resolution: 'UNRESOLVED',
    implementationAddress: unknown('No recognized target resolved'), candidateImplementation: unknown('No target candidate'),
    adminAddress: unknown('No administrator established'), beaconAddress: unknown('No beacon established'), probes: {},
    limitations: [
      'Pointer/code resolution does not prove actual delegation, upgrade authorization, or asset safety.',
      'Only EIP-1967 slots, ZeppelinOS implementation/admin slots and exact canonical ERC-1167 runtime are inspected; other variants and nested targets are not resolved.',
      'Zero slots or unsuccessful probes do not prove that a contract is immutable or has no proxy/administrator.',
    ],
  };
  async function probe(label: string, action: () => Promise<unknown>): Promise<Probe> {
    let value: Probe;
    try { value = decodeAddressWord(await action()); }
    catch { value = { status: 'READ_FAILED' }; }
    result.probes[label] = value; return value;
  }
  async function target(address: Address) {
    result.candidateImplementation = known(address);
    if (address.toLowerCase() === token.toLowerCase()) { result.limitations.push('Self-referential target; resolution withheld.'); return; }
    try {
      if (!hasCode(await rpc.request('eth_getCode', [address, block]))) {
        result.limitations.push('Target has empty or malformed code at the observed block.'); return;
      }
    } catch { result.limitations.push('Target code lookup failed.'); return; }
    result.implementationAddress = known(address); result.resolution = 'RESOLVED';
  }
  const clone = canonicalCloneTarget(code);
  if (clone) {
    result.pattern = 'ERC1167_CANONICAL';
    await target(clone);
  } else {
    const implementation = await probe('implementationSlot', () => rpc.request('eth_getStorageAt', [token, proxySlots.implementation, block]));
    const beacon = await probe('beaconSlot', () => rpc.request('eth_getStorageAt', [token, proxySlots.beacon, block]));
    const admin = await probe('adminSlot', () => rpc.request('eth_getStorageAt', [token, proxySlots.admin, block]));
    const legacy = await probe('legacyImplementationSlot', () => rpc.request('eth_getStorageAt', [token, proxySlots.legacyImplementation, block]));
    const legacyAdmin = await probe('legacyAdminSlot', () => rpc.request('eth_getStorageAt', [token, proxySlots.legacyAdmin, block]));
    if (admin.status === 'VALUE') result.adminAddress = known(admin.address);
    if (beacon.status === 'VALUE') result.beaconAddress = known(beacon.address);
    if (implementation.status === 'VALUE') {
      result.pattern = 'EIP1967_IMPLEMENTATION_SLOT';
      result.candidateImplementation = known(implementation.address);
      if (beacon.status === 'VALUE') {
        result.limitations.push('Both implementation and beacon slots are populated; ambiguous structure, resolution withheld.');
      } else if (beacon.status === 'ZERO' && legacy.status === 'ZERO') await target(implementation.address);
      else result.limitations.push('Beacon or ZeppelinOS implementation slot is populated or not established empty; resolution withheld.');
    } else if (implementation.status === 'ZERO' && beacon.status === 'VALUE' && legacy.status === 'ZERO') {
      result.pattern = 'EIP1967_BEACON_SLOT';
      try {
        if (hasCode(await rpc.request('eth_getCode', [beacon.address, block]))) {
          // Observe the proxy caller and a second caller; do not claim universal caller independence.
          const call = (from: Address) => rpc.request('eth_call', [{ from, to: beacon.address, data: '0x5c60da1b' }, block]);
          const primary = await probe('beaconImplementationFromProxy', () => call(token));
          const secondary = await probe('beaconImplementationFromZero', () => call('0x0000000000000000000000000000000000000000'));
          if (primary.status === 'VALUE' && secondary.status === 'VALUE' && primary.address === secondary.address) await target(primary.address);
          else result.limitations.push('Beacon implementation responses failed, were invalid, or differed between sampled callers.');
        } else result.limitations.push('Beacon has empty or malformed code.');
      } catch { result.limitations.push('Beacon code lookup failed.'); }
    } else if (legacy.status === 'VALUE') {
      result.pattern = 'ZEPPELINOS_IMPLEMENTATION_SLOT';
      // Expose only the administrator slot corresponding to this selected pattern.
      result.adminAddress = legacyAdmin.status === 'VALUE' ? known(legacyAdmin.address) : unknown('No ZeppelinOS administrator established');
      result.candidateImplementation = known(legacy.address);
      if (implementation.status === 'ZERO' && beacon.status === 'ZERO') await target(legacy.address);
      else result.limitations.push('EIP-1967 implementation or beacon slot is populated or not established empty; resolution withheld.');
    }
  }
  rpc.record('PROXY_OBSERVATION', result, BigInt(block).toString());
  return result;
}
