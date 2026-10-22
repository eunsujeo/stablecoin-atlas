import {requireLegacyHistoryCollection} from './registration-scheduler.mjs';
import {pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
import {workspaceEnvironment} from '../workspace-env.mjs';
import {boundedJson} from '../market-store.mjs';
import {boundedRead} from '../evidence-store.mjs';
import {connectDatabase} from './connection.mjs';
import {initializeHistory,upgradeHistory,normalizeHistory,enableContinuousHistory,grantHistoryWriter,grantHistoryReader,importHistory,verifyHistoryWriter} from './history.mjs';
import {fetchHistorySource,historyProjection,sourceByteLimit} from '../supply-history-source.mjs';
import {historyAssets,validateSupplyHistory} from '../../web/supply-history-model.js';
import {validateRegistry} from '../../web/market-model.js';
import {archiveSources} from './files.mjs';
import {safeErrorCode} from './errors.mjs';
export async function main(args,env=process.env,{fetcher=fetch}={}){
 const command=args[0],options={};if(!['init','upgrade','normalize','continuous','grant-writer','grant','collect','import'].includes(command))throw Error('INVALID_COMMAND');
 const allowed=['--env-file',...(['grant','grant-writer'].includes(command)?['--role']:['collect','import'].includes(command)?['--archive-dir',...(command==='import'?['--manifest']:[])]:[])];
 for(let i=1;i<args.length;i+=2){const flag=args[i];if(!allowed.includes(flag)||Object.hasOwn(options,flag)||!args[i+1]||args[i+1].startsWith('--'))throw Error('INVALID_ARGUMENTS');options[flag]=args[i+1];}
 if(['grant','grant-writer'].includes(command)&&!options['--role']||command==='import'&&!options['--manifest'])throw Error('MISSING_ARGUMENT');
 const registry=validateRegistry((await boundedJson(new URL('../../data/asset-registry.json',import.meta.url),128*1024)).value);
 const variables=await workspaceEnvironment(options['--env-file'],options['--env-file']?{}:env),client=await connectDatabase(variables);
 try{
  if(command==='continuous')return await enableContinuousHistory(client);if(command==='init')return await initializeHistory(client);if(command==='upgrade')return await upgradeHistory(client);if(command==='normalize')return await normalizeHistory(client,registry);if(command==='grant-writer')return await grantHistoryWriter(client,options['--role']);if(command==='grant')return await grantHistoryReader(client,options['--role']);
  await verifyHistoryWriter(client);if(command==='collect')await requireLegacyHistoryCollection(client);const sources=[],snapshots=[];
  let entries=Object.keys(historyAssets).map(coinId=>({coinId}));
  if(command==='import'){
   const manifest=(await boundedJson(options['--manifest'],16384)).value;
   if(manifest.schemaVersion!==1||Object.keys(manifest).some(k=>!['schemaVersion','sources'].includes(k))||!Array.isArray(manifest.sources)||!manifest.sources.length||manifest.sources.length>3||new Set(manifest.sources.map(s=>s.coinId)).size!==manifest.sources.length)throw Error('HISTORY_INVALID');
   entries=manifest.sources;
   if(entries.some(s=>!s||Object.keys(s).length!==2||!Object.hasOwn(historyAssets,s.coinId)||typeof s.fetchedAt!=='string'))throw Error('HISTORY_INVALID');
  }
  for(const entry of entries){
   const bytes=command==='collect'?await fetchHistorySource(entry.coinId,fetcher):await boundedRead(join(dirname(options['--manifest']),entry.coinId+'.json'),sourceByteLimit);
   const fetchedAt=command==='collect'?new Date().toISOString():entry.fetchedAt;const p=historyProjection(bytes,entry.coinId,registry,fetchedAt);snapshots.push(p,historyProjection(bytes,entry.coinId,registry,fetchedAt,{metric:'NETWORK_MINTED'}));sources.push({hash:p.sourceHash,bytes});
  }
  validateSupplyHistory(snapshots,registry);
  // All responses must validate before durable DB publication; file conflicts never overwrite bytes.
  await archiveSources(sources,options['--archive-dir']??'.state/supply-history-artifacts',{byteLimit:sourceByteLimit});
  return {...await importHistory(client,registry,snapshots),providerRequests:command==='collect'?entries.length:0,networks:snapshots.reduce((n,s)=>n+s.networks.length,0),points:snapshots.flatMap(s=>s.networks).reduce((n,s)=>n+s.points.length,0)};
 }finally{await client.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch(error){console.error('HISTORY_COMMAND_FAILED ('+safeErrorCode(error)+'): details omitted.');process.exitCode=1;}}
