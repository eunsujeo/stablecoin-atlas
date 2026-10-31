import {parseEnv} from 'node:util';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {destinations,verifyConfiguredFile} from './config.mjs';
import {githubToken} from './github-token.mjs';
import {githubClient} from './github.mjs';
import {artifactCache} from './artifact-cache.mjs';
import {localSourceClient} from './local-source.mjs';
import {atomicJSON,json,requireThat} from './files.mjs';
export async function deploymentSource(config,{state,uidFor,codeRoot}={}){
 if(config.source==='LOCAL_GIT')return localSourceClient({state,...(codeRoot?{codeRoot}:{})});
 await verifyConfiguredFile('github',config.files.github,{uidFor});if(config.files.githubKey)await verifyConfiguredFile('githubKey',config.files.githubKey,{uidFor});
 const cooldown=await json(join(state,'github-cooldown.json'),{until:0});requireThat(Date.now()>=cooldown.until,'GITHUB_COOLDOWN');const onCooldown=until=>atomicJSON(join(state,'github-cooldown.json'),{until});
 return githubClient({repository:config.repository,token:await githubToken(parseEnv(await readFile(destinations.github,'utf8')),{onCooldown}),onCooldown,notBefore:cooldown.until,cache:artifactCache(join(state,'artifacts'))});
}
