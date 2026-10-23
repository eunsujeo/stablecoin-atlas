import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {file} from './allium-offline-files.mjs';
import {workspaceEnvironment} from './workspace-env.mjs';
import {alliumExecutionStorage as io,alliumHash} from './allium-executor.mjs';
import {prepareCapabilityProbe,collectCapabilityProbe,capabilityReport} from './provider-capability-probe.mjs';
import {balanceArrayPlan} from './balance-array-plan.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [command,approvalPath,reviewedHash,...extra]=process.argv.slice(2),profile='balance-array',plan=balanceArrayPlan(),root=fileURLToPath(new URL('../.state/allium-executor/',import.meta.url));
  if(extra.length||!['plan','prepare','collect','status'].includes(command))throw Error();
  if(command==='plan'){if(approvalPath||reviewedHash)throw Error();console.log(JSON.stringify(plan));}
  else if(command==='status'){if(approvalPath||reviewedHash)throw Error();console.log(JSON.stringify(capabilityReport(JSON.parse(await file(join(root,plan.slot,'receipt.json'),262144)),profile)));}
  else{
   const env=await workspaceEnvironment(),keys={allium:env.ALLIUM_API_KEY},approvalBytes=Buffer.from(await file(approvalPath,65536)),dir=fileURLToPath(new URL('../.state/provider-capability-authorization/',import.meta.url)),path=join(dir,plan.slot+'.json');
   if(command==='prepare'){
    if(reviewedHash)throw Error();await io.privateDirectory(dir);const b=await prepareCapabilityProbe(root,{keys,approvalBytes,profile,now:new Date().toISOString()});await io.durableFile(path,b);
    console.log(JSON.stringify({state:'PREPARED_NOT_SENT',authorizationHash:alliumHash(b),maxHttpRequests:1,maxRuns:0}));
   }else{
    const r=await collectCapabilityProbe(root,{keys,approvalBytes,profile,authorizationBytes:Buffer.from(await file(path,131072)),reviewedHash});console.log(JSON.stringify(r));
    if(r.state!=='COMPLETE')process.exitCode=1;
   }
  }
 }catch{console.error('BALANCE_ARRAY_PROBE_BLOCKED: inspect private evidence; never replay a consumed slot.');process.exitCode=1;}
}
