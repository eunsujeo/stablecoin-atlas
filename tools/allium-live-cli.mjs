import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve, dirname} from 'node:path';
import {boundedRead} from './evidence-store.mjs';
import {workspaceEnvironment} from './workspace-env.mjs';
import {alliumExecutionStorage as io, alliumHash, withAlliumSendLock} from './allium-executor.mjs';
import {dailyPlan, liveLegacyManifest, liveAuthorization, executeLiveOnce, resumeLiveOnce, liveStatus} from './allium-live-once.mjs';
import {directory, file} from './allium-offline-files.mjs';

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
  const o=liveArguments(args);
  if(o.command==='status')return liveStatus(root);
  const plan=dailyPlan({asOfDay:o['--day']}),env=await workspaceEnvironment();
  await file(o['--approval'],65536);
  const approvalBytes=await boundedRead(o['--approval'],65536),apiKey=env.ALLIUM_API_KEY;
  if(o.command==='prepare')return withAlliumSendLock(root,async()=>{
    const authorization=liveAuthorization(plan,{apiKey,approvalBytes,legacyManifest:await liveLegacyManifest(root),now:new Date().toISOString()});
    // Never print the grant, key fingerprint or account context to stdout.
    const output=resolve(o['--output']);
    if(!output.startsWith(fileURLToPath(new URL('../.state/',import.meta.url))))throw Error('PRIVATE_OUTPUT_REQUIRED');
    await directory(dirname(output));
    const bytes=Buffer.from(JSON.stringify(authorization));await io.durableFile(output,bytes);
    return {state:'PREPARED_NOT_SENT',authorizationHash:alliumHash(bytes),maxRuns:2,maxHttpRequests:26,providerRequests:0};
  });
  return (o.command==='resume'?resumeLiveOnce:executeLiveOnce)(plan,{root,apiKey,approvalBytes,authorizationBytes:await boundedRead(o['--authorization'],65536),
    reviewedHash:o['--reviewed-authorization-sha256'],...(o.command==='resume'?{
      sqlReviewBytes:await boundedRead(o['--sql-review'],65536),reviewedSqlReviewHash:o['--reviewed-sql-review-sha256']}: {})});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {const result=await liveMain(process.argv.slice(2));console.log(JSON.stringify(result));if(result.state==='UNKNOWN'||result.state==='FAILED'||result.state==='TRUNCATED')process.exitCode=1;}
  catch {console.error('ALLIUM_LIVE_BLOCKED: approval, lease or permanent reservation unavailable; private details omitted.');process.exitCode=1;}
}
