import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Transport, limits } from '../src/contract-review/network.mjs';

const secret = 'fixture-private-auth-marker';
const endpoint = `https://rpc.invalid/?key=${secret}`;
const failed = async (fetcher, expected, policy = limits) => {
  let calls = 0;
  const t = new Transport(endpoint, async (...args) => {
    calls++;
    assert.equal(args[1].redirect, 'error');
    return fetcher(...args);
  }, policy);
  await assert.rejects(t.rpc('eth_chainId'), { message: 'READ_FAILED' });
  assert.equal(calls, 1);
  assert.equal(t.rpcCount, 1);
  assert.equal(t.events[0].status, 'FAILED');
  assert.equal(t.events[0].failureKind, expected);
  assert(!JSON.stringify(t.events).includes(secret));
  return t;
};

test('transport classifies only allowlisted structured causes without exposing raw errors', async () => {
  for (const [code, expected] of [
    ['ENOTFOUND', 'DNS_FAILURE'], ['EAI_AGAIN', 'DNS_FAILURE'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'TLS_FAILURE'], ['CERT_HAS_EXPIRED', 'TLS_FAILURE'],
    ['ECONNREFUSED', 'CONNECTION_FAILURE'], ['ECONNRESET', 'CONNECTION_FAILURE'],
    ['UND_ERR_CONNECT_TIMEOUT', 'CONNECTION_TIMEOUT'], ['UND_ERR_HEADERS_TIMEOUT', 'RESPONSE_TIMEOUT'],
    ['UND_ERR_BODY_TIMEOUT', 'BODY_TIMEOUT'], [secret, 'UNKNOWN'],
  ]) {
    const cause = Object.assign(Error(secret), { code });
    const error = Error(`fetch failed ${endpoint}`, { cause });
    error.stack = secret;
    await failed(async () => { throw error; }, expected);
  }
  // Text resembling a known code is never parsed; cyclic/deep chains terminate.
  const cycle = Error(`ENOTFOUND ${secret}`); cycle.cause = cycle;
  await failed(async () => { throw cycle; }, 'UNKNOWN');
  let deep = Object.assign(Error(secret), { code: 'ENOTFOUND' });
  for (let n = 0; n < 6; n++) deep = Error(secret, { cause: deep });
  await failed(async () => { throw deep; }, 'UNKNOWN');
});

test('transport distinguishes HTTP, body interruption, UTF8, JSON and byte limits', async () => {
  const denied = await failed(async () => new Response(secret, { status: 403 }), 'HTTP_FAILURE');
  assert.equal(denied.events[0].httpStatus, 403);
  await failed(async () => new Response(new ReadableStream({ start(c) { c.error(Error(secret)); } })), 'BODY_READ_FAILED');
  await failed(async () => new Response(new Uint8Array([0xff])), 'INVALID_UTF8');
  await failed(async () => new Response(secret), 'INVALID_JSON');
  await failed(async () => new Response(secret), 'BYTE_LIMIT', { ...limits, responseBytes: 2 });
  await failed(async () => new Response(secret), 'BYTE_LIMIT', { ...limits, totalBytes: 2 });
});

test('transport distinguishes its own timeout and consumes limits without retries', async () => {
  await failed((_, { signal }) => new Promise((_, reject) => {
    const timer = setTimeout(() => reject(Error(secret)), 1000);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(Error(secret)); }, { once: true });
  }), 'REQUEST_TIMEOUT', { ...limits, requestMs: 10 });
  let calls = 0;
  const t = new Transport(endpoint, async () => { calls++; throw Error(secret); }, { ...limits, rpc: 1 });
  await assert.rejects(t.rpc('eth_chainId'), /READ_FAILED/);
  await assert.rejects(t.rpc('eth_chainId'), /REQUEST_LIMIT/);
  assert.equal(calls, 1); assert.equal(t.events.length, 1);
  t.started -= limits.timeoutMs;
  await assert.rejects(t.rpc('eth_chainId'), /TIME_LIMIT/);
  assert.equal(calls, 1);
});

test('received RPC error and malformed envelope differ from transport failure', async () => {
  for (const [body, expected] of [
    [{ jsonrpc: '2.0', id: 1, error: { code: -1, message: secret } }, 'RPC_ERROR_RESPONSE'],
    [{ jsonrpc: '2.0', id: 2, error: { message: secret } }, 'RPC_ENVELOPE_INVALID'],
    [{ jsonrpc: '2.0', id: 1 }, 'RPC_ENVELOPE_INVALID'],
    [null, 'RPC_ENVELOPE_INVALID'],
  ]) {
    const t = new Transport(endpoint, async () => Response.json(body));
    await assert.rejects(t.rpc('eth_chainId'), /RPC_RESULT_INVALID/);
    assert.equal(t.events[0].status, 'RECEIVED');
    assert.equal(t.events[0].rpcStatus, 'INVALID');
    assert.equal(t.events[0].failureKind, expected);
    assert(!JSON.stringify(t.events).includes(secret));
  }
  const t = new Transport(endpoint, async () => Response.json({ jsonrpc: '2.0', id: 1, result: '0x1' }));
  assert.equal(await t.rpc('eth_chainId'), '0x1');
  assert.equal(t.events[0].rpcStatus, 'VALID');
  assert.equal(t.events[0].failureKind, undefined);
});

test('overlapping responses attach RPC diagnostics to their own request event', async () => {
  let releaseFirst;
  const firstResponse = new Promise(resolve => { releaseFirst = resolve; });
  const t = new Transport(endpoint, async (_, init) => {
    const { id } = JSON.parse(init.body);
    return id === 1 ? firstResponse : Response.json({ jsonrpc: '2.0', id, result: '0x1' });
  });
  const first = t.rpc('eth_chainId');
  assert.equal(await t.rpc('eth_chainId'), '0x1');
  releaseFirst(Response.json({ jsonrpc: '2.0', id: 1, error: { message: secret } }));
  await assert.rejects(first, /RPC_RESULT_INVALID/);
  assert.equal(t.events[0].rpcStatus, 'INVALID');
  assert.equal(t.events[0].failureKind, 'RPC_ERROR_RESPONSE');
  assert.equal(t.events[1].rpcStatus, 'VALID');
  assert.equal(t.events[1].failureKind, undefined);
  assert(!JSON.stringify(t.events).includes(secret));
});
