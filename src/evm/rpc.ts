import type { Evidence } from '../domain/model.js';
export class RpcError extends Error {
  readonly reverted: boolean;
  constructor(public readonly code: number, message: string, reverted = false) {
    super(message);
    this.reverted = code === 3 || reverted;
  }
  get category(): 'REVERT' | 'RPC_ERROR' { return this.reverted ? 'REVERT' : 'RPC_ERROR'; }
}
export class Rpc {
  readonly evidence: Evidence[] = [];
  block = 'UNKNOWN';
  private id = 0;
  constructor(private readonly url: string) {
    let parsed: URL;
    try { parsed = new URL(url); }
    catch { throw new Error('Invalid RPC URL.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('RPC must use HTTP(S).');
  }
  record(kind: string, data: unknown, block = this.block): Evidence {
    const e: Evidence = { id: `e${this.evidence.length + 1}`, provenance: 'OBSERVED', kind,
      observedAt: new Date().toISOString(), observedBlockOrSlot: block, data };
    this.evidence.push(e); return e;
  }
  async request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const id = ++this.id;
    let body: { id: number; result?: T; error?: { code: number; message: string; data?: unknown } };
    try {
      const response = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      body = await response.json() as typeof body;
      if (!validEnvelope(body, id)) throw new Error('Malformed RPC envelope');
    } catch (error) {
      // Do not persist endpoint URLs, credentials, or transport exception causes.
      const message = error instanceof Error && /^HTTP \d+$/.test(error.message) ? error.message : 'RPC transport/protocol failure';
      this.record('RPC_ERROR', { method, params, error: message });
      throw new Error(message);
    }
    if (body.error) {
      // Classify only supported signals before discarding untrusted diagnostics.
      const reverted = body.error.code === 3 || ([-32000, -32015, -32603].includes(body.error.code)
        && /^execution reverted\b/i.test(body.error.message.trim()));
      const category = reverted ? 'REVERT' : 'RPC_ERROR';
      const message = `${reverted ? 'Execution reverted' : 'RPC error'} (code ${body.error.code})`;
      this.record('RPC', { method, params, error: { code: body.error.code, category, message, upstreamDetailsOmitted: true } });
      throw new RpcError(body.error.code, message, reverted);
    }
    this.record('RPC', { method, params, result: body.result });
    return body.result as T;
  }
  async pin(): Promise<string> {
    this.block = 'UNKNOWN';
    const invalid = (reason: 'INVALID_BLOCK_NUMBER' | 'INVALID_BLOCK_HEADER'): never => {
      this.record('BLOCK_REFERENCE_ERROR', { reason });
      throw new Error('Invalid RPC block reference.');
    };
    const block = await this.request<unknown>('eth_blockNumber');
    if (!isQuantity(block)) return invalid('INVALID_BLOCK_NUMBER');
    const raw = await this.request<unknown>('eth_getBlockByNumber', [block, false]);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid('INVALID_BLOCK_HEADER');
    const header = raw as Record<string, unknown>;
    if (!isQuantity(header.number) || BigInt(header.number) !== BigInt(block)
      || typeof header.hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(header.hash)) return invalid('INVALID_BLOCK_HEADER');
    this.block = BigInt(block).toString();
    this.record('BLOCK_REFERENCE', { number: this.block, hash: header.hash });
    return block;
  }
}

function isQuantity(value: unknown): value is string {
  return typeof value === 'string' && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value);
}
export function isRevert(error: unknown): error is RpcError {
  return error instanceof RpcError && error.reverted;
}

function validEnvelope(value: unknown, id: number): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  if (body.jsonrpc !== '2.0' || body.id !== id) return false;
  const hasResult = Object.hasOwn(body, 'result'), hasError = Object.hasOwn(body, 'error');
  if (hasResult === hasError) return false;
  if (hasResult) return true;
  if (!body.error || typeof body.error !== 'object' || Array.isArray(body.error)) return false;
  const error = body.error as Record<string, unknown>;
  return Number.isSafeInteger(error.code) && typeof error.message === 'string';
}
