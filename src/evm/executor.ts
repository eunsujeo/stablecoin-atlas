import { decodeEventLog, decodeFunctionResult, encodeFunctionData, type Address, type Hex } from 'viem';
import { setTimeout as delay } from 'node:timers/promises';
import { abi, classifyReturn } from './abi.js';
import { isRevert, Rpc } from './rpc.js';
export interface Receipt {
  status: Hex; transactionHash: Hex; blockNumber: Hex; blockHash: Hex; gasUsed: Hex;
  contractAddress: Address | null;
  logs: { address: Address; topics: [Hex, ...Hex[]]; data: Hex; logIndex: Hex }[];
}
export type FunctionName = 'transfer' | 'approve' | 'transferFrom' | 'balanceOf' | 'allowance' | 'totalSupply' | 'owner' | 'paused' | 'blacklisted' | 'setPaused' | 'setBlacklisted';
export interface Execution {
  returnKind: ReturnType<typeof classifyReturn> | 'REVERT'; receipt: Receipt; events: { name: string; args: Record<string, unknown> }[];
}
// Only constructed with the private LocalLab RPC and newly deployed fixtures.
export class FixtureExecutor {
  constructor(readonly rpc: Rpc, readonly token: Address) {}
  data(fn: FunctionName, args: readonly unknown[] = []): Hex {
    return encodeFunctionData({ abi, functionName: fn, args } as Parameters<typeof encodeFunctionData>[0]);
  }
  async read<T = bigint>(fn: FunctionName, args: readonly unknown[] = []): Promise<T> {
    const block = await this.rpc.pin();
    const raw = await this.rpc.request<Hex>('eth_call', [{ to: this.token, data: this.data(fn, args) }, block]);
    return decodeFunctionResult({ abi, functionName: fn, data: raw }) as T;
  }
  async transact(from: Address, fn: FunctionName, args: readonly unknown[] = []): Promise<Execution> {
    const block = await this.rpc.pin();
    const tx = { from, to: this.token, data: this.data(fn, args), gas: '0x1e8480' as Hex };
    let returnKind: Execution['returnKind'];
    try { returnKind = classifyReturn(await this.rpc.request<Hex>('eth_call', [tx, block])); }
    catch (error) { if (!isRevert(error)) throw error; returnKind = 'REVERT'; }
    const receipt = await send(this.rpc, tx);
    const events: Execution['events'] = [];
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.token.toLowerCase()) continue;
      try {
        const event = decodeEventLog({ abi, ...log, strict: true });
        events.push({ name: event.eventName, args: event.args as Record<string, unknown> });
      } catch { /* Raw undecodable log remains in the receipt evidence. */ }
    }
    this.rpc.record('EXECUTION_DECODE', { from, function: fn, args, returnKind, transactionHash: receipt.transactionHash, events });
    return { returnKind, receipt, events };
  }
}
export async function send(rpc: Rpc, tx: { from: Address; to?: Address; data: Hex; gas: Hex }): Promise<Receipt> {
  const hash = await rpc.request<Hex>('eth_sendTransaction', [tx]);
  for (let attempt = 0; attempt < 100; attempt++) {
    const receipt = await rpc.request<Receipt | null>('eth_getTransactionReceipt', [hash]);
    if (receipt) {
      rpc.block = BigInt(receipt.blockNumber).toString();
      rpc.record('MINED_RECEIPT', receipt);
      return receipt;
    }
    await delay(20);
  }
  throw new Error('Receipt timeout; execution outcome unknown');
}
export const succeeded = (tx: Execution): boolean => tx.receipt.status === '0x1' && ['TRUE', 'EMPTY'].includes(tx.returnKind);
export function eventMatches(tx: Execution, name: string, expected: Record<string, unknown>): boolean {
  return tx.events.some(e => e.name === name && Object.entries(expected).every(([key, value]) =>
    typeof value === 'string' && value.startsWith('0x')
      ? String(e.args[key]).toLowerCase() === value.toLowerCase() : e.args[key] === value));
}
