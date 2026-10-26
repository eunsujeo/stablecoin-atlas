import { keccak256, toHex } from 'viem';

export const limits = Object.freeze({ rpc: 32, get: 4, responseBytes: 2 * 1024 * 1024, totalBytes: 8 * 1024 * 1024, timeoutMs: 120000, requestMs: 15000, depth: 3, nodes: 4 });
export const publicRPC = Object.freeze({ '1': 'https://ethereum-rpc.publicnode.com', '8453': 'https://base-rpc.publicnode.com' });
export function address(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw Error('INVALID_ADDRESS');
  return value.toLowerCase();
}
export function chain(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,15}$/.test(value)) throw Error('INVALID_CHAIN_ID');
  return value;
}
export function hex(value, bytes) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value) || (bytes !== undefined && value.length !== 2 + bytes * 2)) throw Error('INVALID_HEX');
  return value.toLowerCase();
}
export function slot(label) { return toHex(BigInt(keccak256(toHex(label))) - 1n, { size: 32 }); }
export const slots = Object.freeze({ implementation: slot('eip1967.proxy.implementation'), admin: slot('eip1967.proxy.admin'), beacon: slot('eip1967.proxy.beacon') });
export function wordAddress(value) {
  const word = hex(value, 32);
  if (!/^0x0{24}/.test(word)) throw Error('NON_ADDRESS_SLOT');
  return /^0x0{64}$/.test(word) ? null : address(`0x${word.slice(-40)}`);
}
const methods = new Set(['eth_chainId', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call']);
// Only fixed categories leave this module. Never copy provider messages, URLs or raw codes.
const connectionKinds = new Map([
  ...['ENOTFOUND', 'EAI_AGAIN'].map(code => [code, 'DNS_FAILURE']),
  ...['ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].map(code => [code, 'TLS_FAILURE']),
  ...['ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH'].map(code => [code, 'CONNECTION_FAILURE']),
  ...['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].map(code => [code, 'CONNECTION_TIMEOUT']),
  ['UND_ERR_HEADERS_TIMEOUT', 'RESPONSE_TIMEOUT'], ['UND_ERR_BODY_TIMEOUT', 'BODY_TIMEOUT'],
]);
function failureKind(error, signal, phase) {
  if (signal.aborted) return 'REQUEST_TIMEOUT';
  if (phase !== 'CONNECT') return phase;
  const seen = new Set();
  for (let depth = 0; error && typeof error === 'object' && depth < 5 && !seen.has(error); depth++) {
    seen.add(error);
    if (connectionKinds.has(error.code)) return connectionKinds.get(error.code);
    error = error.cause;
  }
  return 'UNKNOWN';
}
export class Transport {
  constructor(rpcURL, fetcher = fetch, policy = limits) {
    const url = new URL(rpcURL);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname))) throw Error('INVALID_RPC_TRANSPORT');
    this.rpcURL = rpcURL; this.fetcher = fetcher; this.policy = policy; this.started = Date.now(); this.rpcCount = 0; this.getCount = 0; this.bytes = 0; this.events = []; this.sourceCaptures = [];
  }
  async request(kind, url, init, label) {
    if (Date.now() - this.started >= this.policy.timeoutMs) throw Error('TIME_LIMIT');
    const key = kind === 'RPC' ? 'rpcCount' : 'getCount', max = kind === 'RPC' ? this.policy.rpc : this.policy.get;
    if (this[key] >= max) throw Error('REQUEST_LIMIT');
    this[key]++;
    const event = { kind, operation: label, status: 'UNKNOWN', bytes: 0 }; this.events.push(event);
    const signal = AbortSignal.timeout(Math.max(1, Math.min(this.policy.requestMs, this.policy.timeoutMs - (Date.now() - this.started))));
    let phase = 'CONNECT';
    try {
      const response = await this.fetcher(url, { ...init, redirect: 'error', signal });
      event.httpStatus = response.status;
      phase = 'BODY_READ_FAILED';
      const chunks = [];
      for await (const chunk of response.body ?? []) {
        const b = Buffer.from(chunk); event.bytes += b.length; this.bytes += b.length;
        if (event.bytes > this.policy.responseBytes || this.bytes > this.policy.totalBytes) { phase = 'BYTE_LIMIT'; throw Error('BYTE_LIMIT'); }
        chunks.push(b);
      }
      const body = Buffer.concat(chunks);
      if (kind === 'GET') this.sourceCaptures.push({ provider: label, httpStatus: response.status, bodyBase64: body.toString('base64') });
      if (!response.ok) { phase = 'HTTP_FAILURE'; throw Error('HTTP_FAILURE'); }
      phase = 'INVALID_UTF8';
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(body);
      phase = 'INVALID_JSON';
      const result = JSON.parse(decoded);
      event.status = 'RECEIVED'; return result;
    } catch (error) { event.status = 'FAILED'; event.failureKind = failureKind(error, signal, phase); throw Error('READ_FAILED'); }
  }
  get(url, provider) {
    const parsed = new URL(url);
    if (!(parsed.origin === 'https://sourcify.dev' && /^\/server\/v2\/contract\/[1-9][0-9]*\/0x[0-9a-f]{40}$/i.test(parsed.pathname))
      && !(parsed.origin === 'https://api.etherscan.io' && parsed.pathname === '/v2/api')) throw Error('SOURCE_HOST_NOT_ALLOWED');
    return this.request('GET', url, { method: 'GET' }, provider);
  }
  async rpc(method, params = []) {
    if (!methods.has(method)) throw Error('METHOD_NOT_ALLOWED');
    const id = this.rpcCount + 1;
    const eventIndex = this.events.length;
    const body = await this.request('RPC', this.rpcURL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }, method);
    const event = this.events[eventIndex];
    if (body?.jsonrpc !== '2.0' || body.id !== id || Object.hasOwn(body, 'error') || !Object.hasOwn(body, 'result')) {
      event.rpcStatus = 'INVALID';
      event.failureKind = body?.jsonrpc === '2.0' && body.id === id && Object.hasOwn(body, 'error') ? 'RPC_ERROR_RESPONSE' : 'RPC_ENVELOPE_INVALID';
      throw Error('RPC_RESULT_INVALID');
    }
    event.rpcStatus = 'VALID';
    return body.result;
  }
}
export async function pin(transport, chainId) {
  const actual = await transport.rpc('eth_chainId');
  if (typeof actual !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(actual) || BigInt(actual) !== BigInt(chainId)) throw Error('CHAIN_MISMATCH');
  const block = await transport.rpc('eth_getBlockByNumber', ['latest', false]);
  if (!block || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(block.number ?? '')) throw Error('INVALID_BLOCK');
  return { number: BigInt(block.number).toString(), numberHex: block.number, hash: hex(block.hash, 32), selector: { blockHash: hex(block.hash, 32), requireCanonical: true } };
}
