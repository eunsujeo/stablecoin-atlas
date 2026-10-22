import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase } from './connection.mjs';
import { checkDatabase } from './health.mjs';
import { loadSources } from './files.mjs';
import { importSources } from './repository.mjs';
import { safeErrorCode } from './errors.mjs';
import { collectMarket } from '../market-collect.mjs';
import { atomic, defaultMarketDirectory } from '../market-store.mjs';

const defaultArchive = fileURLToPath(new URL('../../.state/market-db-artifacts', import.meta.url));
export function databaseCollector({ env, archiveDirectory = defaultArchive,
  registryPath = new URL('../../data/asset-registry.json', import.meta.url),
  connect = connectDatabase, collect = collectMarket, onCollected = async () => {}, now = () => Date.now() } = {}) {
  return async ({ directory = defaultMarketDirectory, key } = {}) => {
    const root = resolve(directory instanceof URL ? fileURLToPath(directory) : directory);
    const state = { state: 'CHECKING', updatedAt: new Date(now()).toISOString(),
      localPublished: false, sourceName: null, sourceHash: null, errorCode: null };
    const save = async values => {
      Object.assign(state, values, { updatedAt: new Date(now()).toISOString() });
      await atomic(join(root, 'database-state.json'), state);
    };
    let client, importing = false;
    try {
      await save({}); client = await connect(env);
      // Cover a run crossing UTC month end before spending provider requests.
      await checkDatabase(client, { at: now(), through: now() + 120000 });
      await save({ state: 'COLLECTING' });
      const result = await collect({ directory: root, key, registryPath });
      if (result.state !== 'SUCCESS') { Object.assign(state,{localPublished:Boolean(result.published),sourceName:result.sourceName??null,sourceHash:result.sourceHash??null}); await save({ state: 'FAILED' }); return result; }
      state.localPublished = true;
      if (!/^[a-f0-9-]{36}\.json$/.test(result.sourceName ?? '') || !/^[a-f0-9]{64}$/.test(result.sourceHash ?? '')) throw Error('INVALID_SOURCE_NAME');
      state.sourceName = result.sourceName; state.sourceHash = result.sourceHash;
      await onCollected({sourceName:state.sourceName,sourceHash:state.sourceHash});
      const input = await loadSources({ reportsDirectory: dirname(root), registryPath,
        names: ['market-store/collected/' + result.sourceName] });
      if (input.sources[0].hash !== result.sourceHash) throw Error('DATABASE_CONTENT_CONFLICT');
      const times = input.sources[0].units.map(unit => Date.parse(unit.observedAt));
      await checkDatabase(client, { at: Math.min(...times), through: Math.max(...times) });
      await save({ state: 'IMPORTING' }); importing = true;
      const stored = await importSources(client, { ...input, archiveDirectory });
      // IMPORTING after a crash/COMMIT response loss is intentionally unconfirmed.
      await save({ state: 'STORED' });
      return { ...result, database: stored.state };
    } catch (error) {
      await save({ state: importing ? 'UNCONFIRMED' : 'FAILED', errorCode: safeErrorCode(error) });
      return { state: 'FAILED', published: state.localPublished, database: state.state };
    } finally { await client?.end().catch(() => {}); }
  };
}
