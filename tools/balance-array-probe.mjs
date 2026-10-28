import {retiredAlliumCollection} from './retired-allium.mjs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {file} from './allium-offline-files.mjs';
import {capabilityReport} from './provider-capability-probe.mjs';
import {balanceArrayPlan} from './balance-array-plan.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [command,approvalPath,reviewedHash,...extra]=process.argv.slice(2),profile='balance-array',plan=balanceArrayPlan(),root=fileURLToPath(new URL('../.state/allium-executor/',import.meta.url));
  if(extra.length||!['plan','prepare','collect','status'].includes(command))throw Error();
  if(command==='plan'){if(approvalPath||reviewedHash)throw Error();console.log(JSON.stringify(plan));}
  else if(command==='status'){if(approvalPath||reviewedHash)throw Error();console.log(JSON.stringify(capabilityReport(JSON.parse(await file(join(root,plan.slot,'receipt.json'),262144)),profile)));}
  else retiredAlliumCollection();
 }catch(error){console.error(error.message==='ALLIUM_COLLECTION_RETIRED'?'ALLIUM_COLLECTION_RETIRED':'BALANCE_ARRAY_PROBE_BLOCKED: inspect private evidence; never replay a consumed slot.');process.exitCode=1;}
}
