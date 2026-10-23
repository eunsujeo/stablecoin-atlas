import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {workspaceEnvironment} from './workspace-env.mjs';
import {file,directory} from './allium-offline-files.mjs';
import {alliumHash,alliumExecutionStorage as io} from './allium-executor.mjs';
import {geographyPlan,prepareGeography,collectGeography,reviewGeography,geographyReceiptView} from './allium-geography.mjs';
import {publishGeographyAvailability} from './allium-geography-preview.mjs';
const root=fileURLToPath(new URL('../.state/allium-executor/',import.meta.url));
export async function geographyMain(args){
 const [command,...rest]=args,flags={plan:[],prepare:['--approval','--output'],collect:['--approval','--authorization','--reviewed-sha256'],review:['--source-sha256','--sql-sha256'],status:[],publish:[]}[command];
 if(!flags||rest.length%2)throw Error('INVALID_ARGUMENTS');const o={};
 for(let i=0;i<rest.length;i+=2){if(![...flags,'--kind'].includes(rest[i])||o[rest[i]]||!rest[i+1])throw Error('INVALID_ARGUMENTS');o[rest[i]]=rest[i+1];}
 if(flags.some(k=>!o[k]))throw Error('INVALID_ARGUMENTS');const kind=o['--kind']??'discovery';geographyPlan(kind);
 if(command==='plan')return geographyPlan(kind);
 if(command==='publish'){const p=await publishGeographyAvailability({kind});return {state:'PUBLISHED',collectionState:p.state,observations:p.observations};}
 if(command==='status')return geographyReceiptView(JSON.parse(await file(join(root,'geography-once',kind,'receipt.json'),131072)));
 if(command==='review'){const r=await reviewGeography(root,{kind,expectedSourceHash:o['--source-sha256'],expectedSqlHash:o['--sql-sha256']});return {state:r.state,rows:r.rows.length,sourceHash:r.sourceHash};}
 const approvalBytes=Buffer.from(await file(o['--approval'],65536)),{ALLIUM_API_KEY:apiKey}=await workspaceEnvironment();
 if(command==='prepare'){
  const output=resolve(o['--output']);if(!output.startsWith(fileURLToPath(new URL('../.state/',import.meta.url))))throw Error('PRIVATE_OUTPUT_REQUIRED');await directory(dirname(output));
  const b=await prepareGeography(root,{apiKey,approvalBytes,kind});await io.durableFile(output,b);return {state:'PREPARED_NOT_SENT',authorizationHash:alliumHash(b),maxRuns:1,maxHttpRequests:13};
 }
 const authorizationBytes=Buffer.from(await file(o['--authorization'],65536));if(JSON.parse(authorizationBytes).plan.kind!==kind)throw Error('INVALID_KIND');
 return collectGeography(root,{apiKey,approvalBytes,authorizationBytes,reviewedHash:o['--reviewed-sha256']});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const r=await geographyMain(process.argv.slice(2));console.log(JSON.stringify(r));if(r.state==='UNKNOWN')process.exitCode=1;}catch{console.error('ALLIUM_GEOGRAPHY_BLOCKED: private evidence or permanent reservation unavailable.');process.exitCode=1;}}
