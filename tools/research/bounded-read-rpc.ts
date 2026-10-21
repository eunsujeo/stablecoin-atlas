import { Rpc, RpcError } from '../../src/evm/rpc.js';
const quantity = (x: unknown): x is string => typeof x === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i.test(x);
const word = (x: unknown): x is string => typeof x === 'string' && /^0x[0-9a-f]{64}$/i.test(x);
const bytes = (x: unknown): x is string => typeof x === 'string' && x.length <= 262146 && /^0x(?:[0-9a-f]{2})*$/i.test(x);

function project(method: string, raw: any): unknown {
  if (method === 'eth_getBlockByNumber') return raw && quantity(raw.number) && word(raw.hash) ? { number: raw.number, hash: raw.hash } : null;
  if (method === 'eth_chainId' || method === 'eth_blockNumber') return quantity(raw) ? raw : null;
  return bytes(raw) ? raw : null;
}

// Transport only: concrete subclasses must provide their own narrow request validator.
export abstract class BoundedReadRpc extends Rpc {
  private nextId = 0;
  constructor(private readonly endpoint: string) { super(endpoint); }
  override request<T = unknown>(_method: string, _params: unknown[] = []): Promise<T> {
    return Promise.reject(new Error('Concrete read request validator required'));
  }
  protected get requestBudget(): number { return 24; }
  protected projectResult(method: string, raw: unknown): unknown { return project(method, raw); }
  protected async transmit<T = unknown>(method: string, params: unknown[]): Promise<T> {
    if (this.nextId >= this.requestBudget) throw new Error('Read request outside budget');
    const id = ++this.nextId;
    try {
      const response = await fetch(this.endpoint, { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length;
        if (size > 1048576) { await reader.cancel(); throw new Error('Response size limit'); } chunks.push(chunk.value);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!body || body.jsonrpc !== '2.0' || body.id !== id || Object.hasOwn(body, 'result') === Object.hasOwn(body, 'error')) throw new Error('Invalid envelope');
      if (Object.hasOwn(body, 'error')) {
        if (!body.error || !Number.isSafeInteger(body.error.code) || typeof body.error.message !== 'string') throw new Error('Invalid error');
        throw this.failure(body.error.code, body.error.message);
      }
      const result = this.projectResult(method, body.result);
      this.record('RPC', { method, params, result });
      return result as T;
    } catch (error) {
      const message = error instanceof RpcError ? error.message : error instanceof Error && /^(HTTP [1-5][0-9]{2}|Response size limit)$/.test(error.message)
        ? error.message : 'Read RPC transport/protocol failure';
      this.record('RPC_ERROR', { method, params, error: message, ...(error instanceof RpcError ? { code: error.code, category: error.category } : {}) });
      throw error instanceof RpcError ? error : new Error(message);
    }
  }
}
