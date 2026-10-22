import {safeErrorCode} from './errors.mjs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {workspaceEnvironment} from '../workspace-env.mjs';
import {connectDatabase} from './connection.mjs';
import {initialize,partition,grantAccess} from './schema.mjs';
import {loadSources} from './files.mjs';
import {importSources,listSeries,latestValues,history,networkHistory,latestNetworks} from './repository.mjs';
import {fail} from './plan.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export function parseArguments(argv){
  const [command,...args]=argv,allowed={init:[],partition:['month'],grant:['role','access'],plan:['source','reports-dir','registry'],import:['source','reports-dir','registry','archive-dir'],series:['coin','after','limit'],latest:['coin','after','limit'],history:['series','from','to','cursor','limit'],networks:['provider','after','limit'],'network-history':['network','provider','from','to','cursor','limit']};
  if(!Object.hasOwn(allowed,command??''))fail('INVALID_COMMAND');const options={};
  for(let i=0;i<args.length;i+=2){const flag=args[i];if(!/^--[a-z-]+$/.test(flag??'')||!allowed[command].includes(flag.slice(2))||!args[i+1]||args[i+1].startsWith('--'))fail('INVALID_ARGUMENTS');
    const key=flag.slice(2);if(key==='source')(options.source??=[]).push(args[i+1]);else{if(Object.hasOwn(options,key))fail('INVALID_ARGUMENTS');options[key]=args[i+1];}}
  const required={partition:['month'],grant:['role','access'],plan:['source'],import:['source'],history:['series','from','to'],'network-history':['network','from','to']}[command]??[];
  if(required.some(k=>!options[k]))fail('MISSING_ARGUMENT');return {command,options};
}
export async function main(argv,env=process.env){
  const {command,options:o}=parseArguments(argv);let input;
  if(['plan','import'].includes(command))input=await loadSources({reportsDirectory:resolve(o['reports-dir']??resolve(root,'reports')),registryPath:resolve(o.registry??resolve(root,'data/asset-registry.json')),names:o.source});
  if(command==='plan')return {state:'PLANNED',sources:input.sources.length,observations:input.sources.reduce((n,p)=>n+p.observationCount,0),networks:input.sources.reduce((n,p)=>n+p.networkCount,0),omittedUnits:input.sources.reduce((n,p)=>n+p.omittedUnits,0),networkCalls:0};
  const variables=await workspaceEnvironment(undefined,env),client=await connectDatabase(variables);
  try{
    if(command==='init')return await initialize(client);
    if(command==='partition')return await partition(client,o.month);
    if(command==='grant')return await grantAccess(client,o.role,o.access);
    if(command==='import')return await importSources(client,{...input,archiveDirectory:resolve(o['archive-dir']??resolve(root,'.state/market-db-artifacts'))});
    if(command==='series')return await listSeries(client,o);
    if(command==='latest')return await latestValues(client,o);
    if(command==='networks')return await latestNetworks(client,o);
    if(command==='network-history')return await networkHistory(client,o);
    return await history(client,o);
  }finally{await client.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await main(process.argv.slice(2))));}
  catch(error){console.error(`MARKET_DATABASE_COMMAND_FAILED (${safeErrorCode(error)}): verify explicit command, private input/archive, schema, partition, role and server environment. Details omitted.`);process.exitCode=1;}
}
