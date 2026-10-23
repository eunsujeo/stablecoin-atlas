import {pathToFileURL} from 'node:url';
import {workspaceEnvironment} from '../workspace-env.mjs';
import {boundedRead} from '../evidence-store.mjs';
import {connectDatabase} from './connection.mjs';
import {initializeSupply,grantSupply,importSupply,readSupply} from './allium-supply.mjs';
import {alliumSupplySource,supplyReadRange} from '../allium-supply-source.mjs';
export function supplyArguments(args){
 const command=args[0],flags={init:[],grant:['--role','--mode'],import:['--source','--expected-sha256','--archive-dir'],read:['--coin','--from','--to']}[command];if(!flags)throw Error('INVALID_COMMAND');
 const p={command};for(let i=1;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!['--env-file',...flags].includes(k)||Object.hasOwn(p,k)||!v||v.startsWith('--')||/[\x00-\x1f]/.test(v))throw Error('INVALID_ARGUMENTS');p[k]=v;}
 if((command==='grant'?['--role','--mode']:command==='import'?['--source','--expected-sha256']:command==='read'?['--from','--to']:[]).some(k=>!p[k]))throw Error('MISSING_ARGUMENT');
 if(command==='read')supplyReadRange({coinId:p['--coin'],from:p['--from'],to:p['--to']});
 if(command==='grant'&&!['reader','writer'].includes(p['--mode']))throw Error('INVALID_MODE');return p;
}
export async function main(args){
 const p=supplyArguments(args),bytes=p.command==='import'?await boundedRead(p['--source'],2097152):null;
 if(bytes)alliumSupplySource(bytes,{expectedHash:p['--expected-sha256']});
 const env=await workspaceEnvironment(p['--env-file'],p['--env-file']?{}:process.env),c=await connectDatabase(env);
 try{
  if(p.command==='init')return await initializeSupply(c);
  if(p.command==='grant')return await grantSupply(c,p['--role'],p['--mode']);
  if(p.command==='import')return await importSupply(c,bytes,{expectedHash:p['--expected-sha256'],archiveRoot:p['--archive-dir']??'.state/allium-supply-archive'});
  return await readSupply(c,{coinId:p['--coin'],from:p['--from'],to:p['--to']});
 }finally{await c.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch{console.error('ALLIUM_SUPPLY_COMMAND_FAILED: details omitted.');process.exitCode=1;}}
