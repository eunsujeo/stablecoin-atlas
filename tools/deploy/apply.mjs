import {parseEnv} from 'node:util';
import {readFile,mkdir,readdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadConfig,destinations} from './config.mjs';
import {githubToken} from './github-token.mjs';
import {githubClient} from './github.mjs';
import {artifactCache} from './artifact-cache.mjs';
import {timedDeployment} from './operation-timing.mjs';
import {reconcile} from './controller.mjs';
import {ROOT,STATE,operatingSystem,verifyInstallation,uidFor} from './system.mjs';
import {verifyConfiguredFile} from './config.mjs';
import {requireThat,atomicJSON,json,trusted} from './files.mjs';
export async function apply(){
 requireThat(process.platform==='linux'&&process.arch==='arm64'&&process.getuid()===0&&process.argv.length===2,'BROKER_CONTEXT');
 await trusted(ROOT,{directory:true});await trusted(STATE,{directory:true});const config=await loadConfig();requireThat(config.enabled,'AUTOMATION_DISABLED');await verifyInstallation();await verifyConfiguredFile('github',config.files.github,{uidFor});
 const enabled=await json('/etc/atlas-deploy/enabled.json');requireThat(enabled.configHash===(await import('./files.mjs')).hash(await readFile('/etc/atlas-deploy/config.json')),'BOOTSTRAP_NOT_VERIFIED');
 const credentials=parseEnv(await readFile(destinations.github,'utf8'));const cooldown=await json(join(STATE,'github-cooldown.json'),{until:0});requireThat(Date.now()>=cooldown.until,'GITHUB_COOLDOWN');const onCooldown=until=>atomicJSON(join(STATE,'github-cooldown.json'),{until});if(credentials.GITHUB_APP_PRIVATE_KEY_FILE)await verifyConfiguredFile('githubKey',config.files.githubKey,{uidFor});const token=await githubToken(credentials,{onCooldown});
 const github=githubClient({repository:config.repository,token,notBefore:cooldown.until,onCooldown,cache:artifactCache(join(STATE,'artifacts'))});
 const result=await reconcile({root:ROOT,state:STATE,config,github,ops:operatingSystem(config)});await atomicJSON(join(STATE,'latest.json'),result);
 // Only sanitized terminal reports, bounded retention. Versions/journal/claims are never pruned.
 const reports=(await readdir(join(STATE,'reports'))).filter(n=>/^\d+-\d+-(web|collector|usage)\.json$/.test(n)).sort((a,b)=>Number(a.split('-')[0])-Number(b.split('-')[0]));for(const n of reports.slice(0,-1000))await unlink(join(STATE,'reports',n));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await timedDeployment('apply',apply)));}catch(e){const reason=/^[A-Z_]{1,64}$/.test(e.message)?e.message:'BROKER_FAILED';console.error(JSON.stringify({state:'BLOCKED',reason}));process.exitCode=1;}}
