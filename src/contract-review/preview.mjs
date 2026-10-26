import { createServer } from 'node:http';
import { readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
export function createReportServer(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 4 * 1024 * 1024) throw Error('REPORT_LIMIT');
  return createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Frame-Options', 'DENY');
    const expectedHost = `127.0.0.1:${res.socket.localPort}`;
    if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== `http://${expectedHost}`)) { res.writeHead(403); res.end(); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    if (!['/', '/index.html'].includes(req.url)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': bytes.length }); res.end(req.method === 'HEAD' ? undefined : bytes);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2); if (args.length !== 2 || args[0] !== '--dir') throw Error();
    const path = join(args[1], 'index.html'), stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw Error();
    // Serve the generated report only, never sources, snapshot or arbitrary filesystem paths.
    const server = createReportServer(await readFile(path));
    server.listen(0, '127.0.0.1', () => console.log(`Contract Review: http://127.0.0.1:${server.address().port}`));
  } catch { console.error('CONTRACT_REPORT_PREVIEW_FAILED'); process.exitCode = 1; }
}
