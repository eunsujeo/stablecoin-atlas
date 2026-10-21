import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { compileLocalProbe } from '../src/tron/lab/probe.js';
const execute = promisify(execFile);
test('local Java probe bounds HTTP, rejects redirects, truncation and invalid UTF8 without diagnostic leakage', async () => {
  const probe = await compileLocalProbe(); let redirected = 0;
  const server = createServer((request, response) => {
    if (request.url === '/redirect') { response.writeHead(302, { location: '/target' }); response.end(); }
    else if (request.url === '/target') { redirected++; response.end('{}'); }
    else if (request.url === '/error') { response.writeHead(500); response.end('DIAGNOSTIC_SECRET_CANARY'); }
    else if (request.url === '/large') { response.writeHead(200); response.write(Buffer.alloc(1048577, 65)); response.end(); }
    else if (request.url === '/utf') response.end(Buffer.from([0xc3, 0x28]));
    else if (request.url === '/truncated') { response.writeHead(200, { 'Content-Length': '100' }); response.end('{}'); }
    else if (request.url === '/slow-header') {
      request.socket.write('HTTP/1.1 200 OK\r\nX-Drip: ');
      const timer = setInterval(() => request.socket.write('x'), 100);
      request.socket.once('close', () => clearInterval(timer));
    }
    else if (request.url === '/slow') {
      response.writeHead(200); const timer = setInterval(() => response.write('x'), 100);
      response.once('close', () => clearInterval(timer));
    } else if (request.url === '/timeout') { response.once('close', () => {}); }
    else if (request.url === '/nonjson') response.end('not-json');
    else response.end('{"ok":true}');
  });
  try {
    await execute('javac', ['--release', '17', '-g:none', '-proc:none', '-cp', probe.directory, '-d', probe.directory,
      fileURLToPath(new URL('./fixtures/LocalReadProbeDriver.java', import.meta.url))], { timeout: 30000 });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert(address && typeof address !== 'string');
    const run = (route: string) => execute('java', ['-cp', probe.directory, 'LocalReadProbeDriver', String(address.port), route], { timeout: 12000, maxBuffer: 1200000 });
    assert.deepEqual(JSON.parse((await run('/okay')).stdout), { ok: true });
    for (const route of ['/redirect', '/error', '/large', '/utf', '/truncated', '/timeout', '/slow', '/slow-header']) {
      await assert.rejects(run(route), (error: unknown) => {
        const e = error as { stdout: string; stderr: string };
        assert.equal(e.stdout, ''); assert.equal(e.stderr.trim(), 'LOCAL_READ_FAILED'); return true;
      }, route);
    }
    assert.equal(redirected, 0);
    const malformed = await run('/nonjson');
    assert.throws(() => JSON.parse(malformed.stdout), 'Host must reject non-JSON helper output');
    await assert.rejects(execute('java', ['-cp', probe.directory, 'LocalReadProbe', '/admin/accounts-json']),
      (error: unknown) => { const e = error as { stdout: string; stderr: string };
        assert.equal(e.stdout, ''); assert.equal(e.stderr.trim(), 'LOCAL_READ_FAILED'); return true; });
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await probe.cleanup();
  }
});
