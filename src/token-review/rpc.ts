import { getAddress, type Address, type Hex } from 'viem';
import { Rpc, RpcError } from '../evm/rpc.js';
import { proxySlots } from '../evm/proxy.js';

const methods = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call']);
const hex = (v: unknown): v is Hex => typeof v === 'string' && /^0x(?:[0-9a-fA-F]{2})*$/.test(v);
const quantity = (v: unknown): v is Hex => typeof v === 'string' && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(v);

// Separate bounded transport leaves the existing assess/lab semantics untouched.
export class ReviewRpc extends Rpc {
  private sequence = 0;
  private received = 0;
  private readonly deadline = Date.now() + 120_000;
  private pinned: { blockHash: string; requireCanonical: true } | undefined;
  private readonly targets = new Set<string>();
  constructor(private readonly endpoint: string, addresses: string[]) {
    super(endpoint);
    for (const address of addresses) this.allow(address);
  }
  allow(address: string): void { this.targets.add(getAddress(address)); }
  pinHash(hash: string): void {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('INVALID_BLOCK_HASH');
    this.pinned = { blockHash: hash, requireCanonical: true };
  }
  override async request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    if (!methods.has(method)) throw new Error('READ_ONLY_METHOD_REQUIRED');
    if (++this.sequence > 128 || Date.now() >= this.deadline) {
      this.record('RPC_ERROR', { method, params: [], code: 'RPC_BUDGET_EXHAUSTED' });
      throw new Error('RPC_BUDGET_EXHAUSTED');
    }
    const args = [...params];
    try {
      if (['eth_chainId', 'eth_blockNumber'].includes(method) && args.length !== 0
        || method === 'eth_getBlockByNumber' && (args.length !== 2 || !quantity(args[0]) || args[1] !== false)
        || method === 'eth_getCode' && args.length !== 2
        || method === 'eth_getStorageAt' && (args.length !== 3 || !Object.values(proxySlots).includes(args[1] as typeof proxySlots.implementation))
        || method === 'eth_call' && args.length !== 2) throw new Error('INVALID_READ_PARAMS');
      if (method === 'eth_getCode' || method === 'eth_getStorageAt' || method === 'eth_call') {
        if (!this.pinned) throw new Error('HASH_PIN_REQUIRED');
        const target = method === 'eth_call' ? (args[0] as { to: string }).to : args[0] as string;
        if (!this.targets.has(getAddress(target))) throw new Error('UNDECLARED_TARGET');
        args[method === 'eth_getStorageAt' ? 2 : 1] = this.pinned;
        if (method === 'eth_call') {
          const call = args[0] as { to: Address; data: Hex; from?: Address };
          if (!hex(call.data) || call.data.length > 8194 || Object.keys(call).some(k => !['to', 'data', 'from'].includes(k))) throw new Error('INVALID_READ_CALL');
          args[0] = { ...call, gas: '0x7a120', value: '0x0' }; // 500,000 gas, no value.
        }
      }
      const response = await fetch(this.endpoint, {
        method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: this.sequence, method, params: args }),
        signal: AbortSignal.timeout(Math.min(10_000, Math.max(1, this.deadline - Date.now()))),
      });
      if (!response.ok) { await response.body?.cancel(); throw new Error(`RPC_HTTP_${response.status}`); }
      if (!response.body) throw new Error('RPC_EMPTY_BODY');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const read = await reader.read(); if (read.done) break;
          size += read.value.length; this.received += read.value.length;
          if (size > 2 * 1024 * 1024 || this.received > 8 * 1024 * 1024) throw new Error('RPC_RESPONSE_LIMIT');
          chunks.push(read.value);
        }
      } finally { await reader.cancel().catch(() => undefined); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
      if (!body || body.jsonrpc !== '2.0' || body.id !== this.sequence
        || Object.hasOwn(body, 'result') === Object.hasOwn(body, 'error')) throw new Error('RPC_INVALID_ENVELOPE');
      if (body.error) {
        const e = body.error as { code?: unknown };
        if (!Number.isSafeInteger(e.code)) throw new Error('RPC_INVALID_ENVELOPE');
        throw new RpcError(e.code as number, 'RPC returned an error');
      }
      let result = body.result;
      if (method === 'eth_getBlockByNumber') {
        const block = result as { number?: unknown; hash?: unknown } | null;
        if (!block || !quantity(block.number) || typeof block.hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(block.hash)) throw new Error('RPC_INVALID_BLOCK');
        // No arbitrary provider text, transactions, or endpoint strings are retained.
        result = { number: block.number, hash: block.hash };
      } else if (['eth_chainId', 'eth_blockNumber'].includes(method) ? !quantity(result) : !hex(result)) throw new Error('RPC_INVALID_HEX');
      if (method === 'eth_getStorageAt' && (result as string).length !== 66) throw new Error('RPC_INVALID_STORAGE');
      // Only addresses returned by the fixed proxy slot/beacon probes are followed.
      if ((method === 'eth_getStorageAt' || method === 'eth_call' && (args[0] as { data: string }).data === '0x5c60da1b')
        && /^0x0{24}[0-9a-fA-F]{40}$/.test(result as string) && BigInt(result as string) !== 0n) {
        if (this.targets.size >= 32) throw new Error('TARGET_COUNT_LIMIT');
        this.allow(`0x${(result as string).slice(-40)}`);
      }
      this.record('RPC', { method, params: args, result });
      return result as T;
    } catch (error) {
      const safe = new Set(['HASH_PIN_REQUIRED', 'UNDECLARED_TARGET', 'INVALID_READ_CALL', 'INVALID_READ_PARAMS',
        'RPC_EMPTY_BODY', 'RPC_RESPONSE_LIMIT', 'RPC_INVALID_ENVELOPE', 'RPC_INVALID_BLOCK', 'RPC_INVALID_HEX', 'RPC_INVALID_STORAGE', 'TARGET_COUNT_LIMIT']);
      const code = error instanceof RpcError ? `RPC_ERROR_${error.code}` : error instanceof Error
        && (safe.has(error.message) || /^RPC_HTTP_[1-5][0-9]{2}$/.test(error.message)) ? error.message : 'RPC_READ_FAILED';
      this.record('RPC_ERROR', { method, params: args, code });
      throw new Error(code);
    }
  }
}
