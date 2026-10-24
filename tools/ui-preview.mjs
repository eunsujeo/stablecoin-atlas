import {localRegistrationReader} from './registration-file-preview.mjs';
import {validateStoredSurvey} from '../web/survey-model.js';
import {boundedRead} from './evidence-store.mjs';
export const localSurveyReader=path=>async()=>validateStoredSurvey(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedRead(path,128*1024))));
import {validateGeography} from '../web/geography-model.js';
import {geographyReader as storedGeographyReader} from './allium-geography-preview.mjs';
import {databaseSurveyReader} from './market-db/survey-preview.mjs';
import {databaseReviewedSupplyReader} from './market-db/allium-supply-preview.mjs';
import {validateReviewedSupply} from '../web/reviewed-supply-model.js';
import {readFX} from './fx-store.mjs';
import {databaseActivityReader} from './market-db/activity-preview.mjs';
import {createHash} from 'node:crypto';
import { publishedMarket } from './market-store.mjs';
import { publishedIndex, publishedArtifact } from './evidence-store.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { workspaceEnvironment } from './workspace-env.mjs';
import { databaseMarketReader } from './market-db/preview.mjs';
import {databaseRegistrationReader,registrationRequest} from './market-db/registration-preview.mjs';

const assets = new Map([
  ['/supply-overview.js', ['../web/supply-overview.js', 'text/javascript; charset=utf-8']],
  ['/supply-overview-model.js', ['../web/supply-overview-model.js', 'text/javascript; charset=utf-8']],
  ['/allium-dashboard.js', ['../web/allium-dashboard.js', 'text/javascript; charset=utf-8']],
  ['/allium-dashboard-model.js', ['../web/allium-dashboard-model.js', 'text/javascript; charset=utf-8']],
  ['/atlas.html', ['../web/atlas.html', 'text/html; charset=utf-8']],
  ['/atlas.css', ['../web/atlas.css', 'text/css; charset=utf-8']],
  ['/atlas.js', ['../web/atlas.js', 'text/javascript; charset=utf-8']],
  ['/atlas-evidence.js', ['../web/atlas-evidence.js', 'text/javascript; charset=utf-8']],
  ['/atlas-dashboard.js', ['../web/atlas-dashboard.js', 'text/javascript; charset=utf-8']],
  ['/atlas-dashboard-model.js', ['../web/atlas-dashboard-model.js', 'text/javascript; charset=utf-8']],
  ['/', ['../web/index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['../web/index.html', 'text/html; charset=utf-8']],
  ['/legacy.html', ['../web/index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['../web/styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['../web/app.js', 'text/javascript; charset=utf-8']],
  ['/evidence.js', ['../web/evidence.js', 'text/javascript; charset=utf-8']],
  ['/evidence-model.js', ['../web/evidence-model.js', 'text/javascript; charset=utf-8']],
  ['/supply-history-model.js', ['../web/supply-history-model.js', 'text/javascript; charset=utf-8']],
  ['/token-profile.js', ['../web/token-profile.js', 'text/javascript; charset=utf-8']],
  ['/token-profile-model.js', ['../web/token-profile-model.js', 'text/javascript; charset=utf-8']],
  ['/loading.js', ['../web/loading.js', 'text/javascript; charset=utf-8']],
  ['/fx-model.js', ['../web/fx-model.js', 'text/javascript; charset=utf-8']],
  ['/reviewed-supply-model.js', ['../web/reviewed-supply-model.js', 'text/javascript; charset=utf-8']],
  ['/survey-model.js', ['../web/survey-model.js', 'text/javascript; charset=utf-8']],
  ['/survey.js', ['../web/survey.js', 'text/javascript; charset=utf-8']],
  ['/geography-model.js', ['../web/geography-model.js', 'text/javascript; charset=utf-8']],
  ['/geography.js', ['../web/geography.js', 'text/javascript; charset=utf-8']],
  ['/reviewed-supply.js', ['../web/reviewed-supply.js', 'text/javascript; charset=utf-8']],
  ['/activity-model.js', ['../web/activity-model.js', 'text/javascript; charset=utf-8']],
  ['/overview-market-model.js', ['../web/overview-market-model.js', 'text/javascript; charset=utf-8']],
  ['/overview-preferences.js', ['../web/overview-preferences.js', 'text/javascript; charset=utf-8']],
  ['/overview.js', ['../web/overview.js', 'text/javascript; charset=utf-8']],
  ['/registration-model.js', ['../web/registration-model.js', 'text/javascript; charset=utf-8']],
  ['/overview-model.js', ['../web/overview-model.js', 'text/javascript; charset=utf-8']],
  ['/market-view.js', ['../web/market-view.js', 'text/javascript; charset=utf-8']],
  ['/market-chart.js', ['../web/market-chart.js', 'text/javascript; charset=utf-8']],
  ['/market-model.js', ['../web/market-model.js', 'text/javascript; charset=utf-8']],
  ['/model.js', ['../web/model.js', 'text/javascript; charset=utf-8']],
  ['/mock-data.json', ['../docs/ui/mock-dashboard-data.json', 'application/json; charset=utf-8']],
]);
const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
export function createPreviewServer({ evidenceDirectory, marketDirectory, marketReader, registrationReader, fxDirectory, activityReader, reviewedSupplyReader, surveyReader, geographyReader=storedGeographyReader() } = {}) {
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
    if((req.url??'').split('?')[0].startsWith('/registration-')){
      if((req.url??'').split('?')[0]==='/registration-model.js'){ /* Fixed JavaScript asset below. */ }
      else{
        try{registrationRequest(req.url);}catch{fail(400,'INVALID_SUPPLY_QUERY');return;}
        if(!registrationReader){fail(404,'REGISTRATION_DISABLED');return;}
        try{
          const bytes=Buffer.from(JSON.stringify(await registrationReader(req.url)));
          if(bytes.length>2*1024*1024)throw Error('READ_LIMIT');
          if(req.url.startsWith('/registration-history.json?')){
            const etag='"'+createHash('sha256').update(bytes).digest('hex')+'"';
            res.setHeader('Cache-Control','private, no-cache');res.setHeader('ETag',etag);
            if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
          }
          res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
        }catch{fail(503,'SUPPLY_DATA_UNAVAILABLE');}
        return;
      }
    }
    if(req.url==='/geography-data.json'){
      try{const bytes=Buffer.from(JSON.stringify(validateGeography(await geographyReader())));if(bytes.length>2097152)throw Error('READ_LIMIT');res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);}catch{fail(503,'GEOGRAPHY_UNAVAILABLE');}return;
    }
    if(req.url==='/survey-data.json'){
      if(!surveyReader){fail(404,'SURVEY_DISABLED');return;}
      try{const bytes=Buffer.from(JSON.stringify(validateStoredSurvey(await surveyReader())));
        if(bytes.length>128*1024)throw Error('READ_LIMIT');
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
      }catch{fail(503,'SURVEY_UNAVAILABLE');}return;
    }
    if(req.url==='/reviewed-supply-data.json'){
      if(!reviewedSupplyReader){fail(404,'REVIEWED_SUPPLY_DISABLED');return;}
      try{const bytes=Buffer.from(JSON.stringify(validateReviewedSupply(await reviewedSupplyReader())));
        if(bytes.length>32*1024)throw Error('READ_LIMIT');
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
      }catch{fail(503,'REVIEWED_SUPPLY_UNAVAILABLE');}return;
    }
    if(req.url==='/activity-data.json'){if(!activityReader){fail(404,'ACTIVITY_DISABLED');return;}try{const bytes=Buffer.from(JSON.stringify(await activityReader()));if(bytes.length>128*1024)throw Error('READ_LIMIT');res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);}catch{fail(503,'ACTIVITY_UNAVAILABLE');}return;}
    if(req.url==='/fx-data.json'){try{const bytes=Buffer.from(JSON.stringify(await readFX(fxDirectory)));res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);}catch{fail(503,'FX_UNAVAILABLE');}return;}
    if (req.url === '/market-data.json') {
      try {
        const bytes = Buffer.from(JSON.stringify(await (marketReader ? marketReader() : publishedMarket(marketDirectory))));
        if(bytes.length>2*1024*1024)throw new Error('MARKET_RESPONSE_LIMIT');
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
    // Only fixed document routes accept UI query parameters. API and asset paths
    // retain their existing exact allowlists; query values never become paths.
    const assetPath=typeof req.url==='string'&&req.url.length<=2048&&/^(?:\/|\/index\.html|\/atlas\.html|\/legacy\.html)\?/.test(req.url)?req.url.split('?')[0]:req.url;
    const asset = assets.get(assetPath);
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
export function parsePreviewArguments(args) {
  const result={port:4173,database:false};
  const seen=new Set();
  for(let i=0;i<args.length;i++){
    const flag=args[i];if(seen.has(flag))throw new Error('INVALID_ARGUMENTS');seen.add(flag);
    if(flag==='--database')result.database=true;
    else if(flag==='--port'&&/^\d{1,5}$/.test(args[i+1]??''))result.port=Number(args[++i]);
    else if(flag==='--fx-dir'&&args[i+1]&&!args[i+1].startsWith('--'))result.fxDirectory=args[++i];
    else if(flag==='--registration-file'&&args[i+1]&&!args[i+1].startsWith('--'))result.registrationFile=args[++i];
    else if(flag==='--survey-file'&&args[i+1]&&!args[i+1].startsWith('--'))result.surveyFile=args[++i];
    else if(flag==='--database-env'&&args[i+1]&&!args[i+1].startsWith('--'))result.envFile=args[++i];
    else throw new Error('INVALID_ARGUMENTS');
  }
  if(result.port>65535||result.envFile&&!result.database||(result.surveyFile||result.registrationFile)&&result.database)throw new Error('INVALID_ARGUMENTS');
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parsePreviewArguments(process.argv.slice(2));
    // An explicit file is authoritative; inherited writer credentials cannot override it.
    const env=args.database?await workspaceEnvironment(args.envFile,args.envFile?{}:process.env):undefined;
    if(args.database&&!env.DATABASE_URL)throw new Error('DATABASE_CONFIG_REQUIRED');
    const server = await startPreviewServer(args.port,{fxDirectory:args.fxDirectory,...(args.registrationFile?{registrationReader:localRegistrationReader(args.registrationFile)}:{}),...(args.surveyFile?{surveyReader:localSurveyReader(args.surveyFile)}:{}),...(args.database?{marketReader:databaseMarketReader({env}),registrationReader:databaseRegistrationReader({env}),activityReader:databaseActivityReader({env}),reviewedSupplyReader:databaseReviewedSupplyReader({env}),surveyReader:databaseSurveyReader({env})}:{})});
    console.log(`Local preview: http://127.0.0.1:${server.address().port} (${args.database?'PostgreSQL read-only':'local JSON'})`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(() => { process.exitCode = 0; }); server.closeIdleConnections(); });
  } catch { console.error('Preview could not start. Check the port or use --port 0.'); process.exitCode = 1; }
}
