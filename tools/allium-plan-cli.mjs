import {pathToFileURL} from 'node:url';
import {boundedRead} from './evidence-store.mjs';
import {alliumPlan, alliumSurveyResult} from './allium-plan.mjs';

export function alliumArguments(args) {
  const [command, ...rest] = args;
  if (!['plan', 'review'].includes(command)) throw Error('ALLIUM_ARGUMENTS_INVALID');
  const flags = command === 'plan' ? ['--day'] : ['--day', '--kind', '--source', '--reviewed-sha256'];
  const options = {command};
  for (let i = 0; i < rest.length; i += 2) {
    const [key, value] = rest.slice(i, i + 2);
    if (!flags.includes(key) || Object.hasOwn(options, key) || !value || value.startsWith('--')) throw Error('ALLIUM_ARGUMENTS_INVALID');
    options[key] = value;
  }
  if (flags.some(f => !options[f])) throw Error('ALLIUM_ARGUMENTS_INVALID');
  return options;
}

export async function main(args) {
  const o = alliumArguments(args);
  const metadata = JSON.parse(await boundedRead(new URL('../data/market-registration.json', import.meta.url), 256 * 1024));
  const legacy = JSON.parse(await boundedRead(new URL('../data/asset-registry.json', import.meta.url), 128 * 1024));
  const plan = alliumPlan(metadata, legacy, {asOfDay: o['--day']});
  return o.command === 'plan' ? plan : alliumSurveyResult(plan, o['--kind'], await boundedRead(o['--source'], 2097152), {expectedHash: o['--reviewed-sha256']});
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await main(process.argv.slice(2)))); }
  catch { console.error('ALLIUM_PLAN_FAILED: input unavailable or invalid; details omitted.'); process.exitCode = 1; }
}
