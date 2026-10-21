import { publishedMarket } from './market-store.mjs';
import { publishedIndex, publishedArtifact } from './evidence-store.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const assets = new Map([
  ['/', ['../web/index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['../web/index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['../web/styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['../web/app.js', 'text/javascript; charset=utf-8']],
  ['/evidence.js', ['../web/evidence.js', 'text/javascript; charset=utf-8']],
  ['/evidence-model.js', ['../web/evidence-model.js', 'text/javascript; charset=utf-8']],
  ['/overview.js', ['../web/overview.js', 'text/javascript; charset=utf-8']],
  ['/overview-model.js', ['../web/overview-model.js', 'text/javascript; charset=utf-8']],
  ['/market-view.js', ['../web/market-view.js', 'text/javascript; charset=utf-8']],
  ['/market-model.js', ['../web/market-model.js', 'text/javascript; charset=utf-8']],
  ['/model.js', ['../web/model.js', 'text/javascript; charset=utf-8']],
  ['/mock-data.json', ['../docs/ui/mock-dashboard-data.json', 'application/json; charset=utf-8']],
]);
const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
export function createPreviewServer({ evidenceDirectory, marketDirectory } = {}) {
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    const fail = (status, code) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(req.method === 'HEAD' ? undefined : code); };
    const address = server.address();
    // Use the actual listener's port, including when tests request an ephemeral port.
    const port = typeof address === 'object' && address ? address.port : null;
    const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const origins = new Set([...hosts].map(host => `http://${host}`));
    if (!hosts.has(req.headers.host) || (req.headers.origin !== undefined && !origins.has(req.headers.origin)) || req.headers['sec-fetch-site'] === 'cross-site') { fail(403, 'FORBIDDEN'); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); fail(405, 'METHOD_NOT_ALLOWED'); return; }
    if (req.url === '/market-data.json') {
      try {
        const bytes = Buffer.from(JSON.stringify(await publishedMarket(marketDirectory)));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bytes.length });
        res.end(req.method === 'HEAD' ? undefined : bytes);
      } catch { fail(503, 'MARKET_DATA_UNAVAILABLE'); }
      return;
    }
    const evidenceMatch = /^\/evidence\/([a-f0-9]{64})\.(json|html)$/.exec(req.url ?? '');
    if (req.url === '/evidence/index.json' || evidenceMatch) {
      try {
        const bytes = evidenceMatch ? await publishedArtifact(evidenceMatch[1], evidenceMatch[2], evidenceDirectory) : Buffer.from(JSON.stringify((await publishedIndex(evidenceDirectory)).index));
        res.writeHead(200, { 'Content-Type': evidenceMatch?.[2] === 'html' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'Content-Length': bytes.length });
        res.end(req.method === 'HEAD' ? undefined : bytes);
      } catch { fail(503, 'EVIDENCE_UNAVAILABLE'); }
      return;
    }
    const asset = assets.get(req.url);
    if (!asset) { fail(404, 'NOT_FOUND'); return; }
    try {
      const bytes = await readFile(new URL(asset[0], import.meta.url));
      if (bytes.length > 128000 || (req.url === '/mock-data.json' && bytes.length > 64000)) { fail(500, 'ASSET_UNAVAILABLE'); return; }
      res.writeHead(200, { 'Content-Type': asset[1], 'Content-Length': bytes.length });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { fail(500, 'ASSET_UNAVAILABLE'); }
  });
  return server;
}
export async function startPreviewServer(port = 4173, options = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('INVALID_PORT');
  const server = createPreviewServer(options);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--port' || !/^\d{1,5}$/.test(args[1]))) throw new Error('INVALID_ARGUMENTS');
    const server = await startPreviewServer(args.length ? Number(args[1]) : 4173);
    console.log(`Local preview: http://127.0.0.1:${server.address().port}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(() => { process.exitCode = 0; }); server.closeIdleConnections(); });
  } catch { console.error('Preview could not start. Check the port or use --port 0.'); process.exitCode = 1; }
}
