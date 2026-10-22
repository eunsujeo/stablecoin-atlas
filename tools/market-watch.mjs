import { mkdir, open, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { collectMarket } from './market-collect.mjs';
import { atomic, boundedJson, defaultMarketDirectory } from './market-store.mjs';
import { workspaceEnvironment } from './workspace-env.mjs';

export const intervalMs = 300000;
// No catch-up runs, endpoint retries, credential output or automatic restarts.
export async function watchMarket({ directory = defaultMarketDirectory, key, maxRuns = 12,
  signal, collect = collectMarket, clock = () => performance.now(), now = () => Date.now(),
  wait = (ms, signal) => pause(ms, undefined, { signal }), onState = () => {} } = {}) {
  if (!Number.isInteger(maxRuns) || maxRuns < 1 || maxRuns > 288) throw new Error('INVALID_RUN_BUDGET');
  const root = directory instanceof URL ? fileURLToPath(directory) : String(directory);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const lock = join(root, '.scheduler-lock'), owner = randomUUID();
  await mkdir(lock, { mode: 0o700 }); // EEXIST is fail closed, never steal a lock.
  const ownerPath = join(lock, 'owner.json');
  const handle = await open(ownerPath, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify({ owner })); } finally { await handle.close(); }
  const state = { state: 'COLLECTING', updatedAt: new Date(now()).toISOString(), nextAt: null,
    intervalSeconds: 300, runs: 0, maxRuns, requestLimit: maxRuns * 7 };
  const save = async value => {
    Object.assign(state, value, { updatedAt: new Date(now()).toISOString() });
    await atomic(join(root, 'scheduler-state.json'), state);
    onState({ ...state });
  };
  try {
    while (!signal?.aborted && state.runs < maxRuns) {
      const started = clock();
      await save({ state: 'COLLECTING', nextAt: null, runs: state.runs + 1 });
      const result = await collect({ directory: root, key });
      if (result.state !== 'SUCCESS') { await save({ state: 'FAILED', nextAt: null }); return { ...state }; }
      if (signal?.aborted || state.runs === maxRuns) break;
      const elapsed = Math.max(0, clock() - started);
      const delay = intervalMs - elapsed % intervalMs;
      await save({ state: 'WAITING', nextAt: new Date(now() + delay).toISOString() });
      try { await wait(delay, signal); } catch (error) { if (!signal?.aborted) throw error; }
    }
    await save({ state: signal?.aborted ? 'STOPPED' : 'LIMIT_REACHED', nextAt: null });
    return { ...state };
  } catch {
    await save({ state: 'FAILED', nextAt: null });
    return { ...state };
  } finally {
    if ((await boundedJson(ownerPath, 1024)).value.owner === owner) {
      await unlink(ownerPath); await rmdir(lock);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--max-runs' || !/^\d{1,3}$/.test(args[1]))) throw new Error();
    const { ARKM_API_KEY: key } = await workspaceEnvironment();
    if (!key?.trim()) throw new Error();
    const result = await watchMarket({ key, maxRuns: args.length ? Number(args[1]) : 12,
      signal: controller.signal, onState: state => console.log(JSON.stringify(state)) });
    if (result.state === 'FAILED') process.exitCode = 1;
  } catch {
    console.error('Scheduled collection could not run. Check credentials, arguments and writer/scheduler locks. Details omitted.');
    process.exitCode = 1;
  } finally { for (const signal of ['SIGINT', 'SIGTERM']) process.removeListener(signal, stop); }
}
