import {retiredAlliumCollection} from './retired-allium.mjs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dailyPlan, liveStatus} from './allium-live-once.mjs';

const root=fileURLToPath(new URL('../.state/allium-executor/',import.meta.url));
export function liveArguments(args) {
  const [command,...rest]=args,flags={prepare:['--day','--approval','--output'],
    collect:['--day','--approval','--authorization','--reviewed-authorization-sha256'],
    resume:['--day','--approval','--authorization','--reviewed-authorization-sha256','--sql-review','--reviewed-sql-review-sha256'],status:[]}[command];
  if(!flags)throw Error('ARGUMENTS_INVALID');
  const o={command};
  for(let i=0;i<rest.length;i+=2) {
    const [key,value]=rest.slice(i,i+2);
    if(!flags.includes(key)||Object.hasOwn(o,key)||!value||value.startsWith('--'))throw Error('ARGUMENTS_INVALID');o[key]=value;
  }
  if(flags.some(key=>!o[key]))throw Error('ARGUMENTS_INVALID');
  if(o['--day'])dailyPlan({asOfDay:o['--day']});
  return o;
}
export async function liveMain(args) {
  const o=liveArguments(args);if(o.command!=='status')retiredAlliumCollection();
  if(o.command==='status')return liveStatus(root);

}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {const result=await liveMain(process.argv.slice(2));console.log(JSON.stringify(result));if(result.state==='UNKNOWN'||result.state==='FAILED'||result.state==='TRUNCATED')process.exitCode=1;}
  catch(error){console.error(error.message==='ALLIUM_COLLECTION_RETIRED'?'ALLIUM_COLLECTION_RETIRED':'ALLIUM_LIVE_BLOCKED: approval, lease or permanent reservation unavailable; private details omitted.');process.exitCode=1;}
}
