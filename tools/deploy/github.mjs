import {hash,requireThat,sha,hex} from './files.mjs';
import {artifactFiles,validateBundle} from './archive.mjs';
export async function boundedResponse(response,{limit=2097152,signal}={}){
 const parts=[];let length=0;const reader=response.body?.getReader();requireThat(reader,'HTTP_BODY_REQUIRED');
 try{for(;;){signal?.throwIfAborted();const r=await reader.read();if(r.done)break;length+=r.value.length;requireThat(length<=limit,'HTTP_LIMIT');parts.push(Buffer.from(r.value));}}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}return Buffer.concat(parts);
}
export function githubClient({repository,token,fetcher=fetch,notBefore=0,now=Date.now,onCooldown=async()=>{}}){
 requireThat(repository==='eunsujeo/stablecoin-atlas'&&typeof token==='string'&&token.length>0,'GITHUB_CONFIGURATION');
 const prefix='/repos/'+repository;
 async function call(path,{method='GET',body,raw=false}={}){
  requireThat(now()>=notBefore,'GITHUB_COOLDOWN');requireThat((path===prefix||path.startsWith(prefix+'/'))&&!/[\x00-\x20]/.test(path),'GITHUB_PATH');const signal=AbortSignal.timeout(20000);
  const response=await fetcher('https://api.github.com'+path,{method,redirect:'manual',signal,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(response.status===429||response.status===403&&response.headers.get('x-ratelimit-remaining')==='0'){const retry=response.headers.get('retry-after'),reset=Number(response.headers.get('x-ratelimit-reset'))*1000;const requested=/^\d+$/.test(retry??'')?now()+Number(retry)*1000:Date.parse(retry??'');notBefore=Math.max(now()+60000,Math.min(now()+86400000,Number.isFinite(requested)?requested:Number.isFinite(reset)&&reset>now()?reset:now()+60000));await onCooldown(notBefore);await response.body?.cancel();throw Error('GITHUB_RATE_LIMITED');}
  if(raw)return response;
  if(response.status<200||response.status>=300){await response.body?.cancel();throw Error('GITHUB_HTTP_FAILED');}const bytes=await boundedResponse(response,{signal});return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }
 async function candidate(config,versions=null){let identity;try{
  const branch=await call(prefix+'/branches/main');requireThat(sha(branch.commit?.sha),'MAIN_INVALID');
  const repo=await call(prefix);requireThat(repo.id===config.repositoryId&&repo.full_name===repository,'REPOSITORY_MISMATCH');
  const runs=await call(prefix+'/actions/workflows/'+config.workflowId+'/runs?branch=main&status=success&per_page=20');requireThat(Array.isArray(runs.workflow_runs),'RUNS_INVALID');
  const candidates=runs.workflow_runs.filter(r=>r.head_sha===branch.commit.sha&&r.head_branch==='main'&&r.status==='completed'&&r.conclusion==='success'&&r.workflow_id===config.workflowId&&r.repository?.id===config.repositoryId&&r.head_repository?.id===config.repositoryId&&['push','workflow_dispatch'].includes(r.event)&&Number.isSafeInteger(r.id)&&Number.isSafeInteger(r.run_attempt)).sort((a,b)=>b.id-a.id||b.run_attempt-a.run_attempt);
  const r=candidates.find(r=>{const component=/^(web|collector|usage) \/ /.exec(r.display_title??'')?.[1],v=versions?.[component];return !v||r.id>(v.lastAttempt??0)||r.id===(v.lastAttempt??0)&&r.run_attempt>(v.lastAttemptNumber??0);});if(!r)return null;
  const component=/^(web|collector|usage) \/ /.exec(r.display_title??'')?.[1];requireThat(component&&(!['collector','usage'].includes(component)||r.event==='workflow_dispatch'),'COMPONENT_EVENT_INVALID');
  identity={id:r.id,attempt:r.run_attempt,sha:r.head_sha,component,event:r.event,url:`https://github.com/${repository}/actions/runs/${r.id}/attempts/${r.run_attempt}`};
  const definition=await call(prefix+'/contents/.github/workflows/production.yml?ref='+r.head_sha);requireThat(definition.sha===config.workflowBlob,'WORKFLOW_CHANGED');
  const artifacts=await call(prefix+'/actions/runs/'+r.id+'/artifacts?per_page=100');const name=`atlas-${component}-${r.head_sha}-${r.id}-${r.run_attempt}`;
  const found=artifacts.artifacts?.filter(a=>a.name===name&&a.workflow_run?.id===r.id&&a.workflow_run?.head_sha===r.head_sha);
  requireThat(found?.length,'ARTIFACT_NOT_READY');requireThat(found.length===1&&!found[0].expired,'ARTIFACT_EXPIRED_OR_DUPLICATE');requireThat(found?.length===1&&/^sha256:[a-f0-9]{64}$/.test(found[0].digest??'')&&Number.isSafeInteger(found[0].id)&&found[0].size_in_bytes<=96*1024*1024,'ARTIFACT_INVALID');
  return {id:r.id,attempt:r.run_attempt,sha:r.head_sha,component,event:r.event,artifactId:found[0].id,digest:found[0].digest.slice(7),url:`https://github.com/${repository}/actions/runs/${r.id}/attempts/${r.run_attempt}`};
 }catch(e){if(identity)e.candidate=identity;throw e;}}
 async function bundle(c){
  const response=await call(prefix+'/actions/artifacts/'+c.artifactId+'/zip',{raw:true});requireThat(response.status===302,'ARTIFACT_REDIRECT_REQUIRED');const location=new URL(response.headers.get('location'));await response.body?.cancel();
  requireThat(location.protocol==='https:'&&!location.username&&!location.password&&(/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(location.hostname)||/^[a-z0-9.-]+\.actions\.githubusercontent\.com$/.test(location.hostname)),'ARTIFACT_ORIGIN_INVALID');
  const signal=AbortSignal.timeout(60000),download=await fetcher(location,{redirect:'error',signal});requireThat(download.status===200,'ARTIFACT_DOWNLOAD_FAILED');const bytes=await boundedResponse(download,{limit:96*1024*1024,signal});requireThat(hash(bytes)===c.digest,'ARTIFACT_HASH_MISMATCH');const files=artifactFiles(bytes),manifest=validateBundle(files,c);return {manifest,payload:files['release.tar']};
 }
 async function status(c,result){
  const other=result.versions??{};const description=[result.state,'reason='+(result.reason??'OK'),'current='+(result.current??'none').slice(0,12),'last='+(result.lastSuccess??'none').slice(0,12),'service='+(result.service??'unknown'),...['collector','usage'].map(k=>k[0]+'='+(other[k]?.current??'none').slice(0,7)+'/'+(other[k]?.service??'unknown'))].join(' ').slice(0,140);
  await call(prefix+'/statuses/'+c.sha,{method:'POST',body:{state:result.state==='SUCCESS'?'success':result.state==='PENDING'?'pending':'failure',context:'atlas/'+c.component,description,target_url:c.url}});
 }
 async function reportingReady(){const v=await call(prefix+'/actions/variables/ATLAS_DEPLOY_REPORTING_ENABLED');requireThat(v.value==='true','REPORTING_NOT_ENABLED');}
 return {candidate,bundle,status,reportingReady};
}
