import {pathToFileURL} from 'node:url';
import {workspaceEnvironment} from '../workspace-env.mjs';
import {boundedRead} from '../evidence-store.mjs';
import {connectDatabase,transaction} from './connection.mjs';
import {initializeContractReview,grantContractReview,importContractReviews,readContractReviews,reviewedImport} from './contract-review.mjs';
import {verifySupplyApiBoundary} from './supply-api-boundary.mjs';
import {digest} from './plan.mjs';
export function contractReviewArguments(args){
 const command=args[0],flags={init:[],grant:['--role','--mode'],import:['--source','--expected-sha256'],read:[],boundary:['--reviewed-definers','--reviewed-sha256']}[command];
 if(!flags)throw Error('INVALID_COMMAND');const p={command};
 for(let i=1;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!['--env-file','--reviewed-definers','--reviewed-sha256',...flags].includes(k)||Object.hasOwn(p,k)||!v||v.startsWith('--')||/[\x00-\x1f]/.test(v))throw Error('INVALID_ARGUMENTS');p[k]=v;}
 if(command!=='boundary'&&flags.some(k=>!p[k]))throw Error('MISSING_ARGUMENT');
 if(command==='grant'&&(!/^[a-z][a-z0-9_]{0,62}$/.test(p['--role'])||!['reader','writer'].includes(p['--mode'])))throw Error('INVALID_GRANT');
 if(Boolean(p['--reviewed-definers'])!==Boolean(p['--reviewed-sha256']))throw Error('MISSING_ARGUMENT');return p;
}
export async function main(args){
 const p=contractReviewArguments(args);let bytes,reviewedDefiners=[];
 if(p.command==='import'){bytes=await boundedRead(p['--source'],131072);reviewedImport(bytes,p['--expected-sha256']);}
 if(p['--reviewed-definers']){
  const raw=await boundedRead(p['--reviewed-definers'],65536);if(digest(raw)!==p['--reviewed-sha256'])throw Error('REVIEW_HASH_MISMATCH');
  const review=JSON.parse(raw);if(review.schemaVersion!==1||review.kind!=='SUPPLY_SOURCE_REVIEWED_DEFINERS'||!Array.isArray(review.definers))throw Error('INVALID_REVIEW');reviewedDefiners=review.definers;
 }
 const env=await workspaceEnvironment(p['--env-file'],p['--env-file']?{}:process.env),c=await connectDatabase(env);
 try{
  if(p.command==='init')return await initializeContractReview(c,{reviewedDefiners});
  if(p.command==='grant')return await grantContractReview(c,p['--role'],p['--mode'],{reviewedDefiners});
  if(p.command==='import')return await importContractReviews(c,bytes,p['--expected-sha256'],{reviewedDefiners});
  if(p.command==='boundary')return await transaction(c,()=>verifySupplyApiBoundary(c,{schema:'atlas_contract_review',reviewedDefiners}),{repeatableRead:true});
  return await readContractReviews(c);
 }finally{await c.end().catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch{console.error('CONTRACT_REVIEW_DB_COMMAND_FAILED: details omitted.');process.exitCode=1;}}
