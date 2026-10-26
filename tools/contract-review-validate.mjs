import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { boundedJSON } from '../src/contract-review/review.mjs';
import { normalizeSourcify, sha256 } from '../src/contract-review/source.mjs';
import { multicall3Source } from '../src/contract-review/profiles.mjs';
import { batchExperiments } from '../src/contract-review/lab.mjs';
try {
  const { values } = parseArgs({ options: { capture: { type: 'string' }, out: { type: 'string' } }, strict: true });
  if (!values.capture || !values.out) throw Error();
  const bundle = normalizeSourcify(await boundedJSON(values.capture), '1', '0xca11bde05977b3631167028862be2a173976ca11');
  if (bundle.name !== 'Multicall3' || Object.keys(bundle.sources).length !== 1 || sha256(bundle.sources[bundle.file].content) !== multicall3Source) throw Error();
  await mkdir(values.out, { mode: 0o700 });
  const result = await batchExperiments(bundle.sources[bundle.file].content, 'Multicall3');
  await writeFile(join(values.out, 'experiments.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ status: result.status, checks: result.checks.length, failures: 0, mode: result.sourceMode }));
} catch { console.error('CONTRACT_FIXTURE_VALIDATION_FAILED'); process.exitCode = 1; }
