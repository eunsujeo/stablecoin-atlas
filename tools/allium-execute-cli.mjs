import {retiredAlliumCollection} from './retired-allium.mjs';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {boundedRead} from './evidence-store.mjs';
import {alliumPlan} from './allium-plan.mjs';
import {reviewAlliumArchive, alliumReceiptView} from './allium-executor.mjs';

const root=fileURLToPath(new URL('../.state/allium-executor/',import.meta.url));
export function executionArguments(args) {
  const [command,...rest]=args;
  const flags={usage:[],status:['--day'],execute:['--day','--authorization','--reviewed-authorization-sha256','--usage','--controls'],
    'execute-manual':['--day','--authorization','--reviewed-authorization-sha256','--usage','--approval'],
    'resume-manual':['--day','--authorization','--reviewed-authorization-sha256','--usage','--approval','--sql-review','--reviewed-sql-review-sha256'],
    review:['--day','--kind','--reviewed-sha256']}[command];
  if(!flags)throw Error('ARGUMENTS_INVALID');
  const options={command};
  for(let i=0;i<rest.length;i+=2){const [key,value]=rest.slice(i,i+2);if(!flags.includes(key)||Object.hasOwn(options,key)||!value||value.startsWith('--'))throw Error('ARGUMENTS_INVALID');options[key]=value;}
  if(flags.some(f=>!options[f]))throw Error('ARGUMENTS_INVALID');
  if(options['--day'] && (!/^\d{4}-\d\d-\d\d$/.test(options['--day'])||new Date(options['--day']).toISOString().slice(0,10)!==options['--day']))throw Error('ARGUMENTS_INVALID');
  return options;
}
export async function executionMain(args) {
  const o=executionArguments(args);if(!['status','review'].includes(o.command))retiredAlliumCollection();
  if(o.command==='status')return alliumReceiptView(JSON.parse(await boundedRead(join(root,'survey-'+o['--day'],'receipt.json'),131072)));
  const [metadata,legacy]=await Promise.all([boundedRead(new URL('../data/market-registration.json',import.meta.url),262144),boundedRead(new URL('../data/asset-registry.json',import.meta.url),131072)]);
  const plan=alliumPlan(JSON.parse(metadata),JSON.parse(legacy),{asOfDay:o['--day']});
  if(o.command==='review')return reviewAlliumArchive(plan,{root,kind:o['--kind'],expectedHash:o['--reviewed-sha256']});

}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const result=await executionMain(process.argv.slice(2));console.log(JSON.stringify(result));if(result.state&&result.state!=='SUCCEEDED')process.exitCode=1;}
  catch(error){console.error(error.message==='ALLIUM_COLLECTION_RETIRED'?'ALLIUM_COLLECTION_RETIRED':'ALLIUM_EXECUTION_BLOCKED: input, evidence or reservation unavailable; details omitted.');process.exitCode=1;}
}
