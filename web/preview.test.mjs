import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { startPreviewServer } from '../tools/ui-preview.mjs';
function read(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method: options.method ?? 'GET', headers: options.headers ?? {} }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }); req.on('error', reject); req.end();
  });
}
test('preview binds loopback and serves only fixed assets; HEAD, CSP and same-origin restrictions preserve the local boundary', async () => {
  const server = await startPreviewServer(0), port = server.address().port;
  try {
    assert.equal(server.address().address, '127.0.0.1');
    for (const [path, type] of [['/', 'text/html'], ['/index.html', 'text/html'], ['/app.js', 'text/javascript'], ['/model.js', 'text/javascript'], ['/styles.css', 'text/css'], ['/mock-data.json', 'application/json']]) {
      const get = await read(port, path), head = await read(port, path, { method: 'HEAD' });
      assert.equal(get.status, 200); assert.match(get.headers['content-type'], new RegExp(type)); assert.equal(head.status, get.status); assert.equal(head.headers['content-type'], get.headers['content-type']); assert.equal(head.headers['content-length'], get.headers['content-length']); assert.equal(head.body, '');
      assert.equal(get.headers['x-content-type-options'], 'nosniff'); assert.match(get.headers['content-security-policy'], /connect-src 'self'/); assert.match(get.headers['content-security-policy'], /frame-ancestors 'none'/);
    }
    for(const path of ['/atlas.html','/atlas.html?coin=usdc','/atlas.js','/atlas-evidence.js','/atlas.css','/atlas-dashboard.js','/atlas-dashboard-model.js','/comparison.js','/comparison-model.js','/comparison.css']) {
      for(const method of ['GET','HEAD']) assert.equal((await read(port,path,{method})).status,404);
    }
    const data = JSON.parse((await read(port, '/mock-data.json')).body); assert.equal(data.allValuesAreFictional, true);
    const shared='/?coin=jpyc&network=polygon&source=minted&period=90d&comparison=change';
    const document=await read(port,'/'),link=await read(port,shared),linkHead=await read(port,shared,{method:'HEAD'});
    assert.match(document.body, /src="\/app\.js"/);
    for (const path of ['/index.html']) assert.equal((await read(port,path)).body,document.body);
    const legacy=document;
    assert.ok(!legacy.body.includes('/atlas.html'));
    assert.ok(!legacy.body.includes('id="validation-screen"'));
    assert.ok(!legacy.body.includes('href="#validation"'));
    assert.ok(!legacy.body.includes('id="compare-screen"'));
    assert.ok(!legacy.body.includes('href="#compare"'));
    assert.match(legacy.body, /src="\/evidence\.js"/);
    for (const id of ['reports-screen','overview-screen','live-screen','assets-screen']) assert.ok(legacy.body.includes(`id="${id}"`));
    const legacyShared=await read(port,'/legacy.html?coin=jpyc&network=polygon&source=minted&period=90d&comparison=change');
    assert.equal(legacyShared.status,308);assert.equal(legacyShared.headers.location,shared);assert.equal(legacyShared.body,'');
    for(const method of ['GET','HEAD']){const redirect=await read(port,'/legacy.html',{method});assert.equal(redirect.status,308);assert.equal(redirect.headers.location,'/');assert.equal(redirect.body,'');}
    assert.equal((await read(port,'/legacy.html/other')).status,404);
    assert.equal((await read(port,'/legacy.html?coin='+ 'x'.repeat(2048))).status,404);
    assert.equal(link.status,200);assert.equal(link.body,document.body);assert.equal(linkHead.status,200);assert.equal(linkHead.body,'');assert.equal(linkHead.headers['content-length'],link.headers['content-length']);
    assert.equal((await read(port,'/?coin='+ 'x'.repeat(2048))).status,404);
    for (const path of ['/../.env', '/%2e%2e/.env', '/docs/ui/mock-dashboard-data.json', '/package.json', '/mock-data.json?url=other', '/app.js/../index.html', '/styles.css?x=1', '/.git/config']) { const response = await read(port, path); assert.equal(response.status, 404); assert.equal(response.body, 'NOT_FOUND'); }
    for (const headers of [{ host: 'evil.example' }, { host: `127.0.0.1:${port + 1}` }, { origin: 'null' }, { origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) assert.equal((await read(port, '/', { headers })).status, 403);
    assert.equal((await read(port, '/', { headers: { origin: `http://127.0.0.1:${port}` } })).status, 200);
    const post = await read(port, '/mock-data.json', { method: 'POST' }); assert.equal(post.status, 405); assert.equal(post.headers.allow, 'GET, HEAD');
    const headError = await read(port, '/.env', { method: 'HEAD' }); assert.equal(headError.status, 404); assert.equal(headError.body, '');
  } finally { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); }
});
