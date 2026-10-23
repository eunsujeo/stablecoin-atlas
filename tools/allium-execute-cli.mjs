import {pathToFileURL, fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {boundedRead} from './evidence-store.mjs';
import {workspaceEnvironment} from './workspace-env.mjs';
import {alliumPlan} from './allium-plan.mjs';
import {alliumUsage, executeAlliumSurvey, executeAlliumManualSurvey, resumeAlliumManualSurvey, reviewAlliumArchive, alliumReceiptView} from './allium-executor.mjs';

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
  const o=executionArguments(args);
  if(o.command==='status')return alliumReceiptView(JSON.parse(await boundedRead(join(root,'survey-'+o['--day'],'receipt.json'),131072)));
  if(o.command==='usage')return alliumUsage({root,apiKey:(await workspaceEnvironment()).ALLIUM_API_KEY});
  const [metadata,legacy]=await Promise.all([boundedRead(new URL('../data/market-registration.json',import.meta.url),262144),boundedRead(new URL('../data/asset-registry.json',import.meta.url),131072)]);
  const plan=alliumPlan(JSON.parse(metadata),JSON.parse(legacy),{asOfDay:o['--day']});
  if(o.command==='review')return reviewAlliumArchive(plan,{root,kind:o['--kind'],expectedHash:o['--reviewed-sha256']});
  const manual=['execute-manual','resume-manual'].includes(o.command);
  const [authorizationBytes,usageBytes,evidenceBytes]=await Promise.all([boundedRead(o['--authorization'],65536),boundedRead(o['--usage'],2097152),boundedRead(o[manual?'--approval':'--controls'],2097152)]);
  const resume=o.command==='resume-manual';
  return (resume?resumeAlliumManualSurvey:manual?executeAlliumManualSurvey:executeAlliumSurvey)(plan,{root,authorizationBytes,usageBytes,...(manual?{approvalBytes:evidenceBytes}:{controlsBytes:evidenceBytes}),
    ...(resume?{sqlReviewBytes:await boundedRead(o['--sql-review'],65536),reviewedSqlReviewHash:o['--reviewed-sql-review-sha256']}:{}),reviewedHash:o['--reviewed-authorization-sha256'],apiKey:(await workspaceEnvironment()).ALLIUM_API_KEY});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const result=await executionMain(process.argv.slice(2));console.log(JSON.stringify(result));if(result.state&&result.state!=='SUCCEEDED')process.exitCode=1;}
  catch{console.error('ALLIUM_EXECUTION_BLOCKED: input, evidence or reservation unavailable; details omitted.');process.exitCode=1;}
}
