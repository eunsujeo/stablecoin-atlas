import {pathToFileURL} from 'node:url';
import {workspaceEnvironment} from '../workspace-env.mjs';
import {boundedJson} from '../market-store.mjs';
import {connectDatabase} from './connection.mjs';
import {initializeCatalog,importCatalog,grantCatalogReader} from './catalog.mjs';
import {validateRegistry} from '../../web/market-model.js';
import {safeErrorCode} from './errors.mjs';
export async function main(args,env=process.env){
  const command=args[0],options={};
  if(!['init','import','grant'].includes(command))throw new Error('INVALID_COMMAND');
  for(let i=1;i<args.length;i+=2){const flag=args[i];if(!['--env-file',...(command==='grant'?['--role']:command==='import'?['--file']:[])].includes(flag)||Object.hasOwn(options,flag)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('INVALID_ARGUMENTS');options[flag]=args[i+1];}
  if(command==='grant'&&!options['--role'])throw new Error('MISSING_ARGUMENT');
  let registry,profiles;
  if(command==='import'){
    registry=validateRegistry((await boundedJson(new URL('../../data/asset-registry.json',import.meta.url),128*1024)).value);
    const data=(await boundedJson(options['--file']??new URL('../../data/token-profiles.json',import.meta.url),256*1024)).value;
    if(data.schemaVersion!==1||Object.keys(data).some(k=>!['schemaVersion','profiles'].includes(k)))throw new Error('CATALOG_PROFILE_INVALID');profiles=data.profiles;
  }
  const variables=await workspaceEnvironment(options['--env-file'],options['--env-file']?{}:env),client=await connectDatabase(variables);
  try{if(command==='init')return await initializeCatalog(client);if(command==='grant')return await grantCatalogReader(client,options['--role']);return await importCatalog(client,registry,profiles);}
  finally{await client.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch(error){console.error('CATALOG_COMMAND_FAILED ('+safeErrorCode(error)+'): details omitted.');process.exitCode=1;}
}
