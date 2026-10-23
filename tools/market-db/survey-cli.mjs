import {supplyHash} from '../allium-supply-source.mjs';
import {verifySupplyApiBoundary} from './supply-api-boundary.mjs';
import {transaction} from './connection.mjs';
import {pathToFileURL} from 'node:url';
import {workspaceEnvironment} from '../workspace-env.mjs';
import {boundedRead} from '../evidence-store.mjs';
import {connectDatabase} from './connection.mjs';
import {initializeSurvey,upgradeSurvey,grantSurvey,importSurvey,readSurvey} from './survey.mjs';
import {storedSurveyPlan,surveyPlanForDay,surveySource} from '../allium-survey-source.mjs';
export function surveyArguments(args){
 const optional=['--archive-dir','--execution-authorization','--user-approval','--day'];
 const command=args[0],flags={init:[],upgrade:[],boundary:['--reviewed-definers','--reviewed-sha256'],grant:['--role','--mode'],import:['--source','--expected-sha256','--kind','--sql-review','--reviewed-sql-review-sha256','--review-receipt',...optional],read:['--day']}[command];if(!flags)throw Error('INVALID_COMMAND');
 const p={command};for(let i=1;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!['--env-file',...flags].includes(k)||Object.hasOwn(p,k)||!v||v.startsWith('--')||/[\x00-\x1f]/.test(v))throw Error('INVALID_ARGUMENTS');p[k]=v;}
 if(command!=='boundary'&&flags.filter(f=>!optional.includes(f)).some(f=>!p[f]))throw Error('MISSING_ARGUMENT');
 if(Boolean(p['--execution-authorization'])!==Boolean(p['--user-approval']))throw Error('MISSING_LIVE_EVIDENCE');
 if(p['--day'])surveyPlanForDay(p['--day']);
 if(command==='grant'&&!['reader','writer'].includes(p['--mode'])||command==='import'&&!['supply','volume'].includes(p['--kind']))throw Error('INVALID_ARGUMENT');return p;
}
export async function main(args){
 const p=surveyArguments(args);let bytes,options,reviewedDefiners=[];
 if(p.command==='boundary'&&(p['--reviewed-definers']||p['--reviewed-sha256'])){
  if(!p['--reviewed-definers']||!p['--reviewed-sha256'])throw Error('REVIEW_REQUIRED');
  const reviewBytes=await boundedRead(p['--reviewed-definers'],65536);if(supplyHash(reviewBytes)!==p['--reviewed-sha256'])throw Error('REVIEW_HASH_MISMATCH');
  const review=JSON.parse(reviewBytes);if(review.schemaVersion!==1||review.kind!=='SUPPLY_SOURCE_REVIEWED_DEFINERS'||!Array.isArray(review.definers))throw Error('INVALID_REVIEW');reviewedDefiners=review.definers;
 }
 if(p.command==='import'){
  const inputs=await Promise.all([boundedRead(p['--source'],2097152),boundedRead(p['--sql-review'],65536),boundedRead(p['--review-receipt'],131072),storedSurveyPlan(p['--day'])]);
  bytes=inputs[0];options={reviewBytes:inputs[1],receiptBytes:inputs[2],plan:inputs[3],kind:p['--kind'],expectedHash:p['--expected-sha256'],reviewHash:p['--reviewed-sql-review-sha256'],archiveRoot:p['--archive-dir']??'.state/allium-survey-archive'};
  if(p['--execution-authorization'])[options.executionAuthorizationBytes,options.userApprovalBytes]=await Promise.all([
   boundedRead(p['--execution-authorization'],65536),boundedRead(p['--user-approval'],65536)]);
  surveySource(bytes,options); // Reject unreviewed input before opening any DB connection.
 }
 const env=await workspaceEnvironment(p['--env-file'],p['--env-file']?{}:process.env),c=await connectDatabase(env);
 try{
  if(p.command==='boundary')return await transaction(c,()=>verifySupplyApiBoundary(c,{schema:'atlas_survey',reviewedDefiners}),{repeatableRead:true});
  if(p.command==='init')return await initializeSurvey(c);
  if(p.command==='upgrade')return await upgradeSurvey(c);
  if(p.command==='grant')return await grantSurvey(c,p['--role'],p['--mode']);
  if(p.command==='import')return await importSurvey(c,bytes,options);
  return await readSurvey(c,{asOfDay:p['--day']});
 }finally{await c.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch{console.error('ALLIUM_SURVEY_COMMAND_FAILED: details omitted.');process.exitCode=1;}}
