import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {workspaceEnvironment} from '../workspace-env.mjs';
import {boundedRead} from '../evidence-store.mjs';
import {archiveSources} from './files.mjs';
import {connectDatabase} from './connection.mjs';
import {initializeRegistration,grantRegistrationReader} from './registration-access.mjs';
import {installRegistration,importRegistrationHistory,readRegistrationHistory,registrationFilter} from './registration.mjs';
import {safeErrorCode} from './errors.mjs';

export function registrationDatabaseArguments(args){
 const command=args[0],flags={init:[],grant:['--role'],install:['--catalogue','--fetched-at','--archive-dir'],import:['--selection','--coin','--source','--fetched-at','--archive-dir'],read:['--selection','--coin','--metric','--from','--to','--source-id']}[command];
 if(!flags)throw Error('INVALID_COMMAND');
 const options={command};
 for(let i=1;i<args.length;i+=2){
  const key=args[i],value=args[i+1];if(!['--env-file',...flags].includes(key)||Object.hasOwn(options,key)||!value||value.startsWith('--'))throw Error('INVALID_ARGUMENTS');
  options[key]=value;
 }
 const required={init:[],grant:['--role'],install:['--catalogue','--fetched-at'],import:['--selection','--coin','--source','--fetched-at'],read:['--selection','--coin','--metric','--from','--to']}[command];
 if(required.some(k=>!options[k]))throw Error('MISSING_ARGUMENT');
 if(command==='read')options.filter=registrationFilter({selectionId:options['--selection'],coinId:options['--coin'],metric:options['--metric'],from:options['--from'],to:options['--to'],...(options['--source-id']?{sourceId:options['--source-id']}:{})});
 return options;
}

export async function main(args,env=process.env){
 const options=registrationDatabaseArguments(args);
 let bytes,metadata,legacy;
 if(['install','import'].includes(options.command)){
  bytes=await boundedRead(options['--catalogue']??options['--source'],options.command==='install'?16*1024*1024:32*1024*1024);
  if(options.command==='install'){
   metadata=JSON.parse((await boundedRead(new URL('../../data/market-registration.json',import.meta.url),256*1024)).toString('utf8'));
   legacy=JSON.parse((await boundedRead(new URL('../../data/asset-registry.json',import.meta.url),128*1024)).toString('utf8'));
  }
 }
 const variables=await workspaceEnvironment(options['--env-file'],options['--env-file']?{}:env),client=await connectDatabase(variables);
 try{
  if(options.command==='init')return await initializeRegistration(client);
  if(options.command==='grant')return await grantRegistrationReader(client,options['--role']);
  if(options.command==='read')return await readRegistrationHistory(client,options.filter);
  // Persist content-addressed private raw bytes before publication. No provider calls here.
  await archiveSources([{hash:createHash('sha256').update(bytes).digest('hex'),bytes}],options['--archive-dir']??'.state/registration-artifacts',{byteLimit:32*1024*1024});
  if(options.command==='install')return await installRegistration(client,metadata,legacy,bytes,{fetchedAt:options['--fetched-at']});
  return await importRegistrationHistory(client,{selectionId:options['--selection'],coinId:options['--coin'],bytes,fetchedAt:options['--fetched-at']});
 }finally{await client.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await main(process.argv.slice(2))));}
 catch(error){console.error('REGISTRATION_DATABASE_COMMAND_FAILED ('+safeErrorCode(error)+'): details omitted.');process.exitCode=1;}
}
