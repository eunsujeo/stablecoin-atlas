import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { prepareInfuraRuntimeRead, runInfuraRuntimeRead } from '../src/contract-review/runtime-once.mjs';

try {
  const { values } = parseArgs({ options: { preflight: { type: 'boolean' }, execute: { type: 'boolean' } }, strict: true });
  if (Boolean(values.preflight) === Boolean(values.execute)) throw Error();
  const workspace = fileURLToPath(new URL('../', import.meta.url));
  if (values.preflight) {
    await prepareInfuraRuntimeRead(workspace);
    console.log(JSON.stringify({ status: 'PREFLIGHT_READY', provider: 'INFURA_ETHEREUM_MAINNET', inputPins: 4, rpc: 0, get: 0 }));
  } else {
    const receipt = await runInfuraRuntimeRead(workspace);
    console.log(JSON.stringify({ status: receipt.status, comparison: receipt.comparison.status, rpc: receipt.transport.rpc, get: receipt.transport.get }));
    if (receipt.status !== 'OBSERVED' || receipt.comparison.status !== 'PASS') process.exitCode = 1;
  }
} catch {
  console.error('INFURA_RUNTIME_READ_STOPPED: configuration, input pins, mode or one-use slot rejected; private details omitted.');
  process.exitCode = 1;
}
