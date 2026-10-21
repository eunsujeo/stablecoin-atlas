import type { Evidence } from '../domain/model.js';

export class JsonRpcError extends Error {
  constructor(public readonly code: number, message: string) { super(message); }
  get category(): 'REVERT' | 'RPC_ERROR' { return 'RPC_ERROR'; }
}
// Transport/envelope/evidence only. State selection and error semantics belong to adapters.
export class JsonRpc {
  readonly evidence: Evidence[] = [];
  block = 'UNKNOWN';
  private id = 0;
  constructor(private readonly url: string) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error('Invalid RPC URL.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('RPC must use HTTP(S).');
  }
  record(kind: string, data: unknown, block = this.block): Evidence {
    const evidence: Evidence = { id: `e${this.evidence.length + 1}`, provenance: 'OBSERVED', kind,
      observedAt: new Date().toISOString(), observedBlockOrSlot: block, data };
    this.evidence.push(evidence); return evidence;
  }
  protected failure(code: number, _upstreamMessage: string): JsonRpcError {
    return new JsonRpcError(code, `RPC error (code ${code})`);
  }
  async request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const id = ++this.id;
    let body: { result?: T; error?: { code: number; message: string } };
    try {
      const response = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }), signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      body = await response.json() as typeof body;
      if (!validEnvelope(body, id)) throw new Error('Malformed RPC envelope');
    } catch (error) {
      const message = error instanceof Error && /^HTTP \d+$/.test(error.message) ? error.message : 'RPC transport/protocol failure';
      this.record('RPC_ERROR', { method, params, error: message }); throw new Error(message);
    }
    if (body.error) {
      const error = this.failure(body.error.code, body.error.message);
      this.record('RPC', { method, params, error: { code: error.code, category: error.category,
        message: error.message, upstreamDetailsOmitted: true } }); throw error;
    }
    this.record('RPC', { method, params, result: body.result }); return body.result as T;
  }
}
function validEnvelope(value: unknown, id: number): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  if (body.jsonrpc !== '2.0' || body.id !== id) return false;
  if (Object.hasOwn(body, 'result') === Object.hasOwn(body, 'error')) return false;
  if (Object.hasOwn(body, 'result')) return true;
  if (!body.error || typeof body.error !== 'object' || Array.isArray(body.error)) return false;
  const error = body.error as Record<string, unknown>;
  return Number.isSafeInteger(error.code) && typeof error.message === 'string';
}
