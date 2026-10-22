import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {boundedRead} from '../evidence-store.mjs';
import {parseHistorySource} from '../supply-history-source.mjs';
import {registrationPlan} from './planner.mjs';
import {registrationHistory} from './history.mjs';

export function parseRegistrationArguments(args) {
  const [command] = args;
  if (!['plan', 'detail'].includes(command)) throw Error('REGISTRATION_ARGUMENTS_INVALID');
  const options = {command}, allowed = command === 'plan' ? ['--catalogue', '--fetched-at'] : ['--coin', '--source', '--fetched-at', '--networks'];
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!allowed.includes(flag) || Object.hasOwn(options, flag) || typeof value !== 'string' || !value || value.startsWith('--')) throw Error('REGISTRATION_ARGUMENTS_INVALID');
    options[flag] = value;
  }
  if (command === 'plan' && Boolean(options['--catalogue']) !== Boolean(options['--fetched-at']) || command === 'detail' && (!options['--coin'] || !options['--source'] || !options['--fetched-at'])) throw Error('REGISTRATION_ARGUMENTS_INVALID');
  return options;
}

export async function main(args) {
  const options = parseRegistrationArguments(args);
  const metadata = JSON.parse((await boundedRead(new URL('../../data/market-registration.json', import.meta.url), 256 * 1024)).toString('utf8'));
  const legacy = JSON.parse((await boundedRead(new URL('../../data/asset-registry.json', import.meta.url), 128 * 1024)).toString('utf8'));
  if (options.command === 'detail') return registrationHistory(metadata, legacy, await boundedRead(options['--source'], 32 * 1024 * 1024), {
    coinId: options['--coin'], fetchedAt: options['--fetched-at'], ...(options['--networks'] ? {networks: options['--networks'].split(',')} : {}),
  });
  if (!options['--catalogue']) return registrationPlan(metadata, legacy);
  const bytes = await boundedRead(options['--catalogue'], 16 * 1024 * 1024);
  let catalogue; try { catalogue = parseHistorySource(bytes); } catch { throw Error('REGISTRATION_SOURCE_INVALID'); }
  return registrationPlan(metadata, legacy, {catalogue, sourceHash: createHash('sha256').update(bytes).digest('hex'), fetchedAt: options['--fetched-at']});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { const result = await main(process.argv.slice(2)); console.log(JSON.stringify(result)); if (result.state === 'SOURCE_ERRORS') process.exitCode = 1; }
  catch (error) { console.error('REGISTRATION_FAILED (' + (/^REGISTRATION_[A-Z_]{1,64}$/.test(error.message) ? error.message : 'INPUT_UNAVAILABLE') + '): details omitted.'); process.exitCode = 1; }
}
