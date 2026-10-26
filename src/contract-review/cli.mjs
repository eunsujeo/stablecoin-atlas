import { parseArgs } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { publicRPC, address, chain } from './network.mjs';
import { review, boundedJSON, buildReport, writeReports, attachExperiments } from './review.mjs';
import { workspaceEnvironment } from '../../tools/workspace-env.mjs';
try {
  const { values } = parseArgs({ options: { 'chain-id': { type: 'string' }, address: { type: 'string' }, out: { type: 'string' }, 'public-rpc': { type: 'boolean' }, provider: { type: 'string', default: 'sourcify' }, 'source-json': { type: 'string' }, 'offline-snapshot': { type: 'string' }, experiments: { type: 'string' }, help: { type: 'boolean' } }, strict: true });
  if (values.help) {
    console.log('review:contract --chain-id 1|8453 --address 0x… --out .state/unique-run [--public-rpc] [--provider sourcify|etherscan] [--source-json capture.json]\nreview:contract --offline-snapshot .state/run/snapshot.private.json --out .state/offline-run\nRPC_URL from environment/.env.local by default; public RPC requires --public-rpc. ETHERSCAN_API_KEY from environment only. No retries or provider fallback.');
  } else if (values['offline-snapshot']) {
    if (!values.out || values['chain-id'] || values.address || values['source-json'] || values['public-rpc']) throw Error();
    const report = await buildReport(await boundedJSON(values['offline-snapshot'], 32 * 1024 * 1024));
    report.replay = { mode: 'OFFLINE_SAVED_OBSERVATION', authenticity: 'NOT_INDEPENDENTLY_AUTHENTICATED', currentChainState: 'NOT_OBSERVED' };
    if (values.experiments) attachExperiments(report, await boundedJSON(values.experiments));
    await mkdir(values.out, { mode: 0o700 }); await writeReports(values.out, report);
    console.log(JSON.stringify({ status: report.status, chainId: report.chainId, address: report.address, mode: 'OFFLINE_SAVED_OBSERVATION', analyzedAt: report.analyzedAt }));
  } else {
    const chainId = chain(values['chain-id']), target = address(values.address);
    if (!values.out || values.experiments || !['sourcify', 'etherscan'].includes(values.provider)) throw Error();
    const environment = await workspaceEnvironment();
    const rpcURL = values['public-rpc'] ? publicRPC[chainId] : environment.RPC_URL;
    if (!rpcURL) throw Error();
    const report = await review({ chainId, target, out: values.out, rpcURL, provider: values.provider, apiKey: process.env.ETHERSCAN_API_KEY,
      suppliedSource: values['source-json'] ? await boundedJSON(values['source-json']) : undefined });
    console.log(JSON.stringify({ status: report.status, chainId, address: target, block: report.block, transport: { rpc: report.transport.rpc, get: report.transport.get, bytes: report.transport.bytes } }));
    if (report.status === 'FAIL') process.exitCode = 2;
  }
} catch { console.error('CONTRACT_REVIEW_FAILED: check explicit chain/address/provider, unique output directory and configured read-only RPC. Provider errors and credentials are withheld.'); process.exitCode = 1; }
