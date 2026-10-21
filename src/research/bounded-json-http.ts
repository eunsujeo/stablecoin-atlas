export type ResearchFailure = { category: 'HTTP_ERROR' | 'RPC_ERROR' | 'TRANSPORT_OR_PROTOCOL_ERROR';
  httpStatus?: number; rpcCode?: number; squidErrorCode?: string };
export class ResearchReadError extends Error {
  constructor(readonly detail: ResearchFailure) { super(detail.category); }
}

// Callers keep method/parameter selection private. No endpoint fallback or proxy overrides.
export async function postResearchJson(url: string, payload: unknown): Promise<unknown> {
  try {
    const response = await fetch(url, { method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      const squid = response.headers.get('x-squid-error')?.split(/\s/)[0];
      await response.body?.cancel();
      throw new ResearchReadError({ category: 'HTTP_ERROR', httpStatus: response.status,
        ...(squid && /^ERR_[A-Z_]{1,64}$/.test(squid) ? { squidErrorCode: squid } : {}) });
    }
    if (!response.body) throw new Error();
    const reader = response.body.getReader(); let size = 0; const chunks: Buffer[] = [];
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > 64 * 1024) throw new Error();
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof ResearchReadError) throw error;
    throw new ResearchReadError({ category: 'TRANSPORT_OR_PROTOCOL_ERROR' });
  }
}
