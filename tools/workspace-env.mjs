import { boundedRead } from './evidence-store.mjs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const environmentKeys = ['RPC_URL','TRON_RPC_URL','SOLANA_RPC_URL','XRPL_RPC_URL','ARKM_API_KEY','ALLIUM_API_KEY','DATABASE_URL','DATABASE_CA_FILE'];
export async function workspaceEnvironment(path = new URL('../.env.local',import.meta.url), inherited = process.env) {
  const env = {...inherited};
  try {
    const parsed=parseEnv((await boundedRead(path,65536)).toString('utf8'));
    if(Object.keys(parsed).some(key=>!environmentKeys.includes(key)))throw new Error('UNSUPPORTED_ENV_VARIABLE');
    for(const key of environmentKeys)if(!Object.hasOwn(inherited,key)&&parsed[key]?.trim())env[key]=parsed[key];
  }catch(error){if(error.code!=='ENOENT')throw new Error('ENV_FILE_UNREADABLE');}
  return env;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const script=process.argv[2];
    // Only existing package scripts may run, without evaluating command text in a shell.
    const allowed=['assess','research:solana-mints','research:xrpl-issuers'];
    if(!allowed.includes(script))throw new Error();
    const targets={assess:['--use-env-proxy','--import','tsx','src/cli.ts','assess'],'research:solana-mints':['--use-env-proxy','--import','tsx','src/research/solana-mint-cli.ts'],'research:xrpl-issuers':['--use-env-proxy','--import','tsx','src/research/xrpl-issuer-cli.ts']};
    const child=spawn(process.execPath,[...targets[script],...process.argv.slice(3)],{cwd:new URL('../',import.meta.url),env:await workspaceEnvironment(),stdio:'inherit',shell:false});
    child.on('error',()=>{console.error('Workspace command could not start.');process.exitCode=1;});
    child.on('exit',(code,signal)=>{process.exitCode=signal?1:code??1;});
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
  }catch{console.error('Workspace command failed. Check .env.local and the supported script name; details omitted.');process.exitCode=1;}
}
