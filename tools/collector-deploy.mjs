import {lstat,access,readFile,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const fail=code=>{throw Error(code);};
export function deploymentRuntimeSupported(version=process.versions.node,flags=process.allowedNodeEnvironmentFlags){
 const m=/^(\d+)\.(\d+)\.(\d+)$/.exec(version);return !!(m&&(Number(m[1])>24||Number(m[1])===24&&Number(m[2])>=5)&&flags.has('--use-env-proxy'));
}
export function deploymentArguments(args){
 if(args[0]!=='check')fail('DEPLOY_ARGUMENTS_INVALID');const o={};
 for(let i=1;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!['--kind','--selection','--env-file','--state-root'].includes(k)||Object.hasOwn(o,k)||!v||v.startsWith('--')||v.length>4096||/[\x00-\x1f]/.test(v))fail('DEPLOY_ARGUMENTS_INVALID');o[k]=v;}
 if(!['arkham','registered'].includes(o['--kind'])||!o['--env-file']||!o['--state-root']||(o['--kind']==='registered'?!/^[a-f0-9]{64}$/.test(o['--selection']??''):o['--selection']!==undefined))fail('DEPLOY_ARGUMENTS_INVALID');return o;
}
async function privatePath(path,directory){
 const s=await lstat(path);if(s.isSymbolicLink()||(directory?!s.isDirectory():!s.isFile())||process.platform!=='win32'&&((s.mode&0o077)!==0||s.uid!==process.getuid()))fail('DEPLOY_PATH_UNSAFE');
 await access(path,directory?constants.R_OK|constants.W_OK|constants.X_OK:constants.R_OK);return s;
}
export async function checkDeployment(options){
 if(!deploymentRuntimeSupported())fail('DEPLOY_NODE_UNSUPPORTED');
 const root=resolve(options['--state-root']),envFile=resolve(options['--env-file']),repo=await realpath(fileURLToPath(new URL('../',import.meta.url)));
 await privatePath(root,true);const canonical=await realpath(root),inside=relative(repo,canonical);
 if(inside===''||!inside.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&!isAbsolute(inside))fail('DEPLOY_PATH_UNSAFE');
 for(const name of ['receipts','archive','market-store'])await privatePath(join(root,name),true);
 const stat=await privatePath(envFile,false);if(stat.size>65536)fail('DEPLOY_ENV_INVALID');
 const {parseEnv}=await import('node:util'),env=parseEnv(await readFile(envFile,'utf8'));
 const allowed=options['--kind']==='arkham'?['DATABASE_URL','DATABASE_CA_FILE','ARKM_API_KEY']:['DATABASE_URL','DATABASE_CA_FILE'];
 if(Object.keys(env).some(k=>!allowed.includes(k))||!env.DATABASE_URL?.trim()||options['--kind']==='arkham'&&!env.ARKM_API_KEY?.trim())fail('DEPLOY_ENV_INVALID');
 if(env.DATABASE_CA_FILE){const s=await lstat(env.DATABASE_CA_FILE);if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o022)!==0)fail('DEPLOY_PATH_UNSAFE');await access(env.DATABASE_CA_FILE,constants.R_OK);}
 const {databaseConfig}=await import('./market-db/connection.mjs');databaseConfig(env.DATABASE_URL);
 return {state:'READY',scope:'LOCAL_CONFIGURATION_ONLY',kind:options['--kind'],databaseAccessChecked:false,providerRequests:0};
}
export async function main(args){return checkDeployment(deploymentArguments(args));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await main(process.argv.slice(2))));}catch(e){const code=/^DEPLOY_[A-Z_]+$/.test(e.message)?e.message:'DEPLOY_CHECK_FAILED';console.error('COLLECTOR_DEPLOY_FAILED ('+code+'): details omitted.');process.exitCode=1;}}
