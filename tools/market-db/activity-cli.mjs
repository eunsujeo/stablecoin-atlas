import {pathToFileURL} from 'node:url';
import {workspaceEnvironment} from '../workspace-env.mjs';
import {boundedRead} from '../evidence-store.mjs';
import {connectDatabase} from './connection.mjs';
import {initializeActivity,grantActivity,importActivity,readActivity} from './activity.mjs';
export function activityArguments(args){
 const command=args[0],flags={init:[],grant:['--role','--mode'],import:['--source','--expected-sha256','--from','--to','--archive-dir'],read:[]}[command];if(!flags)throw Error('INVALID_COMMAND');
 const p={command};for(let i=1;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!['--env-file',...flags].includes(k)||Object.hasOwn(p,k)||!v||v.startsWith('--')||/[\x00-\x1f]/.test(v))throw Error('INVALID_ARGUMENTS');p[k]=v;}
 if((command==='grant'?['--role','--mode']:command==='import'?['--source','--expected-sha256','--from','--to']:[]).some(k=>!p[k]))throw Error('MISSING_ARGUMENT');return p;
}
export async function main(args){const p=activityArguments(args),env=await workspaceEnvironment(p['--env-file'],p['--env-file']?{}:process.env);const bytes=p.command==='import'?await boundedRead(p['--source'],2*1024*1024):null;const c=await connectDatabase(env);try{
 if(p.command==='init')return await initializeActivity(c);
 if(p.command==='grant')return await grantActivity(c,p['--role'],p['--mode']);
 if(p.command==='import')return await importActivity(c,bytes,{expectedHash:p['--expected-sha256'],from:p['--from'],to:p['--to'],archiveRoot:p['--archive-dir']??'.state/activity-archive'});
 return await readActivity(c);
 }finally{await c.end().catch(()=>{});}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch{console.error('ACTIVITY_COMMAND_FAILED: details omitted.');process.exitCode=1;}}
