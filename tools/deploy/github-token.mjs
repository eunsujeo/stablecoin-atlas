import {createSign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {destinations} from './config.mjs';
import {boundedResponse} from './github.mjs';
import {requireThat,trusted} from './files.mjs';
export async function githubToken(env,{readKey=async()=>{await trusted(destinations.githubKey,{privateFile:true,limit:65536});return readFile(destinations.githubKey);},fetcher=fetch,now=Date.now,onCooldown=async()=>{}}={}){
 if(Object.keys(env).join(',')==='GITHUB_TOKEN'){requireThat(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.trim()&&!/[\x00-\x20]/.test(env.GITHUB_TOKEN),'GITHUB_CREDENTIALS');return env.GITHUB_TOKEN;}
 requireThat(Object.keys(env).sort().join(',')==='GITHUB_APP_ID,GITHUB_APP_PRIVATE_KEY_FILE,GITHUB_INSTALLATION_ID'&&/^[1-9]\d{0,15}$/.test(env.GITHUB_APP_ID)&&/^[1-9]\d{0,15}$/.test(env.GITHUB_INSTALLATION_ID)&&env.GITHUB_APP_PRIVATE_KEY_FILE===destinations.githubKey,'GITHUB_CREDENTIALS');
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),seconds=Math.floor(now()/1000),body=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iat:seconds-60,exp:seconds+540,iss:env.GITHUB_APP_ID}),sign=createSign('RSA-SHA256');sign.update(body);const jwt=body+'.'+sign.sign(await readKey()).toString('base64url');
 const api=async(path,options={})=>{const signal=AbortSignal.timeout(20000),r=await fetcher('https://api.github.com'+path,{...options,redirect:'error',signal,headers:{Authorization:'Bearer '+jwt,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'}});
  if(r.status===429||r.status===403&&r.headers.get('x-ratelimit-remaining')==='0'){const seconds=Number(r.headers.get('retry-after'));await onCooldown(now()+Math.min(86400000,Math.max(60000,Number.isFinite(seconds)?seconds*1000:60000)));await r.body?.cancel();throw Error('GITHUB_RATE_LIMITED');}
  requireThat(r.ok,'GITHUB_APP_FAILED');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedResponse(r,{signal})));};
 const installation=await api('/repos/eunsujeo/stablecoin-atlas/installation');requireThat(String(installation.id)===env.GITHUB_INSTALLATION_ID&&String(installation.app_id)===env.GITHUB_APP_ID,'GITHUB_INSTALLATION_MISMATCH');
 const result=await api('/app/installations/'+env.GITHUB_INSTALLATION_ID+'/access_tokens',{method:'POST',body:JSON.stringify({repositories:['stablecoin-atlas'],permissions:{actions:'read',contents:'read',statuses:'write',actions_variables:'read'}})});
 requireThat(typeof result.token==='string'&&Date.parse(result.expires_at)>now()+60000,'GITHUB_TOKEN_INVALID');return result.token;
}
