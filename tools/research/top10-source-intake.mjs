import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {initialLogicFromMetadata,verifyConstructorParent} from './source-constructor-link.mjs';
import {registrationHash} from '../market-registration/planner.mjs';
const PIN='a8ad54e299a13f99c2beaefdf17d8b8fcad70a066cd3122e3719fce5f4409a01';
const EXTRA_PIN='9d86de81fe882d35ac0965a3da4131d50f39870e57dc8335553e3ccb2976b69c';
const LINK_PIN='51f2f1e9d942f451bed0966fcffaee386d4cbd6d65006b3c68df9abc90767b47';
const XRPL_PIN='64d10961df892dafd070d98ba997956aace03c9d92d762337b8d28f98e844188';
const CORRECTED_LINK_PIN='60e8e33e69d619629674067d237156af4578f3d729c1b196c5735c99ce18ba39';
const PLAN_FILES={"e4d40f9be339d43b0b17b597f9a1dffc02837dfe08f8ad25ef459b83b9c9e161":"source-review-top10-initial-logic-plan.json",[CORRECTED_LINK_PIN]:'source-review-top10-constructor-corrected-plan.json',[PIN]:'source-review-top10-intake-plan.json',[EXTRA_PIN]:'source-review-top10-remaining-plan.json',[LINK_PIN]:'source-review-top10-constructor-plan.json',[XRPL_PIN]:'source-review-top10-xrpl-path-plan.json'};
const REPO_ROOT=fileURLToPath(new URL('../../',import.meta.url));
const PARENTS={'usdc-base':'a/00-usdc-base','usdc-arbitrum':'a/01-usdc-arbitrum','usdc-polygon':'a/02-usdc-polygon','usdc-avalanche':'a/03-usdc-avalanche','usdt-arbitrum':'a/04-usdt-arbitrum','usdt-polygon':'a/05-usdt-polygon','usdt-plasma':'a/06-usdt-plasma','usdt-mantle':'a/07-usdt-mantle','usdc-bsc':'b/17-usdc-bsc-source'};
async function parentBytes(target){const key=target.coinId+'-'+target.networkId;if(!Object.hasOwn(PARENTS,key))throw Error('CONSTRUCTOR_LINK_INVALID');const [phase,file]=PARENTS[key].split('/');return readFile(resolve(REPO_ROOT,'.state/top10-source-intake-20261025-'+phase,file+'-response.bin'));}
const digest=b=>createHash('sha256').update(b).digest('hex');
const save=(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
function validate(plan){const {planSha256,...body}=plan;if(!Object.hasOwn(PLAN_FILES,planSha256)||registrationHash(body)!==planSha256)throw Error('PLAN_PIN_MISMATCH');}
export async function collectPinnedSources(plan,{root,transport=fetch,now=Date.now,parentLoader=parentBytes}={}){
 validate(plan);if(transport===fetch&&!process.execArgv.includes('--use-env-proxy'))throw Error('MANAGED_PROXY_REQUIRED');if(!root)throw Error('ROOT_REQUIRED');
 const parents=new Map();for(const t of plan.targets.filter(t=>t.kind==='CONSTRUCTOR_METADATA')){const bytes=await parentLoader(t);verifyConstructorParent(bytes,t);parents.set(t.id,bytes);}
 await mkdir(root,{mode:0o700});await chmod(root,0o700);const started=now();
 await save(join(root,'authorization.json'),{planSha256:plan.planSha256,executorSha256:digest(await readFile(new URL(import.meta.url))),authorization:'USER_APPROVED_ALL_18_SOURCE_REVIEW_2026_10_25',startedAt:new Date(started).toISOString(),scope:plan.planSha256===PIN?'INITIAL_PINNED_8_PASSIVE_LOOKUPS':'REMAINING_TEN_PUBLISHED_SOURCE_SNAPSHOTS'});
 const result={planSha256:plan.planSha256,state:'RUNNING',attempts:0,bytes:0,targets:[],rpcRequests:0,compilerExecutions:0};
 let stop=false;
 for(const [index,target]of plan.targets.entries()){
  if(now()-started>=plan.deadlineSeconds*1000){stop=true;result.reason='DEADLINE';}
  if(stop){result.targets.push({artifactId:target.id,caseIds:target.caseIds,coinId:target.coinId,networkId:target.networkId,state:'NOT_EXECUTED',reason:result.reason??'BATCH_STOPPED'});continue;}
  const name=String(index).padStart(2,'0')+'-'+(target.id??(target.coinId+'-'+target.networkId));
  const item={artifactId:target.id,caseIds:target.caseIds,coinId:target.coinId,networkId:target.networkId,chainId:target.chainId,address:target.address,state:'INTENT',attemptedAt:new Date(now()).toISOString()};
  await save(join(root,name+'-intent.json'),{...item,url:target.url,method:'GET'});result.attempts++;
  let body=Buffer.alloc(0),saved=false;const chunks=[];let size=0;
  try{
   const remaining=plan.deadlineSeconds*1000-(now()-started);if(remaining<=0)throw Error('DEADLINE');
   const response=await transport(target.url,{method:'GET',redirect:'error',headers:{Accept:'application/json','Accept-Encoding':'identity'},signal:AbortSignal.timeout(Math.max(1,Math.min(plan.requestTimeoutSeconds*1000,remaining)))});
   item.status=response.status;
   const length=response.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||BigInt(length)>BigInt(plan.maximumResponseBytes))){await response.body?.cancel();throw Error('BODY_LIMIT');}
   const encoding=response.headers.get('content-encoding');if(encoding&&encoding!=='identity'){await response.body?.cancel();throw Error('UNEXPECTED_ENCODING');}
   if(response.body)for await(const chunk of response.body){if(size+chunk.length>plan.maximumResponseBytes||result.bytes+chunk.length>plan.maximumTotalBytes)throw Error('BODY_LIMIT');chunks.push(Buffer.from(chunk));size+=chunk.length;result.bytes+=chunk.length;}
   body=Buffer.concat(chunks);await writeFile(join(root,name+'-response.bin'),body,{flag:'wx',mode:0o600});saved=true;item.sourceHash=digest(body);item.bytes=body.length;
   if(response.status===404){item.state='SOURCE_UNAVAILABLE';}
   else if(response.status!==200){item.state='HTTP_FAILED';stop=true;}
   else if(target.kind==='CONSTRUCTOR_METADATA'){
    let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}catch{throw Error('INVALID_JSON');}
    const link=initialLogicFromMetadata(data,target,parents.get(target.id));item.state=link?'CONSTRUCTOR_METADATA_STORED':'CONSTRUCTOR_METADATA_NO_LINK';item.initialLogic=link;
   }else if(target.kind==='SOURCE_TEXT'||target.kind==='DOCUMENT'){
    const text=new TextDecoder('utf-8',{fatal:true}).decode(body);const lower=text.toLowerCase();
    const visible=text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<!--[^]*?-->/g,' ').replace(/<[^>]+>/g,' ');
    if(target.kind==='DOCUMENT'&&(/<title[^>]*>[^<]*(just a moment|access denied|attention required)/i.test(text)||/checking your browser|verify you are human/i.test(visible)))throw Error('CHALLENGE_RESPONSE');
    if(target.kind==='SOURCE_TEXT'&&(response.headers.get('content-type')??'').includes('text/html'))throw Error('SOURCE_SHAPE_INVALID');
    if(target.expectedText.some(marker=>target.kind==='DOCUMENT'?!lower.includes(marker.toLowerCase()):!text.includes(marker)))throw Error('SOURCE_SHAPE_INVALID');
    item.state=target.kind==='SOURCE_TEXT'?'SOURCE_STORED':'DOCUMENT_STORED';
   }else{
    let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}catch{throw Error('INVALID_JSON');}
    if(!data||typeof data!=='object'||Array.isArray(data)||String(data.chainId)!==target.chainId||typeof data.address!=='string'||data.address.toLowerCase()!==target.address.toLowerCase())throw Error('IDENTITY_MISMATCH');
    if(!data.sources||typeof data.sources!=='object'||Array.isArray(data.sources)||!data.compilation||!Array.isArray(data.abi))throw Error('SOURCE_SHAPE_INVALID');
    const sources=Object.entries(data.sources);if(!sources.length||sources.length>256||sources.some(([key,v])=>key.length>512||!v||typeof v.content!=='string'))throw Error('SOURCE_SHAPE_INVALID');
    item.state='SOURCE_STORED';item.sourceCount=sources.length;item.contractName=data.compilation.name??null;item.fullyQualifiedName=data.compilation.fullyQualifiedName??null;
   }
  }catch(error){if(!saved&&chunks.length){body=Buffer.concat(chunks);await writeFile(join(root,name+'-partial-response.bin'),body,{flag:'wx',mode:0o600});item.partialBody=true;item.sourceHash=digest(body);item.bytes=body.length;}item.state='FAILED';item.reason=['CONSTRUCTOR_LINK_INVALID','CHALLENGE_RESPONSE','BODY_LIMIT','UNEXPECTED_ENCODING','INVALID_JSON','IDENTITY_MISMATCH','SOURCE_SHAPE_INVALID','DEADLINE'].includes(error?.message)?error.message:'TRANSPORT_FAILED';stop=true;}
  await save(join(root,name+'-receipt.json'),item);result.targets.push(item);
 }
 result.state=stop?'STOPPED':'COMPLETE';result.completedAt=new Date(now()).toISOString();await save(join(root,'result.json'),result);return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.execArgv.includes('--use-env-proxy'))throw Error('MANAGED_PROXY_REQUIRED');
 if(process.argv.length!==4||process.argv[2]!=='--approved-plan-sha256'||!Object.hasOwn(PLAN_FILES,process.argv[3]))throw Error('EXPLICIT_APPROVED_PLAN_REQUIRED');
 const file=PLAN_FILES[process.argv[3]];
 const plan=JSON.parse(await readFile(new URL('../../data/'+file,import.meta.url),'utf8'));
 const result=await collectPinnedSources(plan,{root:resolve(REPO_ROOT,plan.slot)});console.log(JSON.stringify({state:result.state,attempts:result.attempts,bytes:result.bytes,targets:result.targets.map(t=>({artifactId:t.artifactId,caseIds:t.caseIds,coinId:t.coinId,networkId:t.networkId,state:t.state,status:t.status,reason:t.reason,sourceCount:t.sourceCount,contractName:t.contractName,initialLogic:t.initialLogic}))}));
}
