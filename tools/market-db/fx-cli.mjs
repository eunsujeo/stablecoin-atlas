import {isCLIEntrypoint} from '../cli-entrypoint.mjs';
import {workspaceEnvironment} from '../workspace-env.mjs';
import {boundedRead} from '../evidence-store.mjs';
import {storedFXInputs} from '../fx-store.mjs';
import {digest} from './plan.mjs';
import {connectDatabase} from './connection.mjs';
import {initializeFX,grantFX,importFX,readFXSnapshot} from './fx.mjs';

export function fxArguments(args){
 const flags={init:[],grant:['--role','--mode'],import:['--directory'],read:[],stored:[]}[args[0]];
 if(!flags)throw Error('INVALID_COMMAND');const p={command:args[0]};
 for(let i=1;i<args.length;i+=2){const k=args[i],v=args[i+1];
  if(!['--env-file','--reviewed-definers','--reviewed-sha256',...flags].includes(k)||Object.hasOwn(p,k)||!v||v.startsWith('--')||/[\x00-\x1f]/.test(v))throw Error('INVALID_ARGUMENTS');p[k]=v;
 }
 if(flags.some(k=>!p[k])||Boolean(p['--reviewed-definers'])!==Boolean(p['--reviewed-sha256']))throw Error('MISSING_ARGUMENT');
 if(p.command==='grant'&&(!/^[a-z][a-z0-9_]{0,62}$/.test(p['--role'])||!['reader','writer'].includes(p['--mode'])))throw Error('INVALID_GRANT');return p;
}
export async function main(args){
 const p=fxArguments(args),inputs=p.command==='import'?await storedFXInputs(p['--directory']):[];
 let reviewedDefiners=[];
 if(p['--reviewed-definers']){
  const bytes=await boundedRead(p['--reviewed-definers'],65536);
  if(digest(bytes)!==p['--reviewed-sha256'])throw Error('REVIEW_HASH_MISMATCH');
  const review=JSON.parse(bytes);if(review.schemaVersion!==1||review.kind!=='SUPPLY_SOURCE_REVIEWED_DEFINERS'||!Array.isArray(review.definers))throw Error('INVALID_REVIEW');reviewedDefiners=review.definers;
 }
 const env=await workspaceEnvironment(p['--env-file'],p['--env-file']?{}:process.env),c=await connectDatabase(env);
 try{
  if(p.command==='init')return await initializeFX(c,{reviewedDefiners});
  if(p.command==='grant')return await grantFX(c,p['--role'],p['--mode'],{reviewedDefiners});
  if(p.command==='import'){
   let inserted=0;for(const input of inputs)inserted+=(await importFX(c,input.payload,input.raw,{reviewedDefiners})).inserted;
   return {state:inserted?'IMPORTED':'UNCHANGED',snapshots:inputs.length,inserted,providerRequests:0};
  }
  return await readFXSnapshot(c,{allowExpired:p.command==='stored'});
 }finally{await c.end().catch(()=>{});}
}
if(isCLIEntrypoint(import.meta.url)){try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch{console.error('FX_DB_COMMAND_FAILED: details omitted.');process.exitCode=1;}}
