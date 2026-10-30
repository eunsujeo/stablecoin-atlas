import {hash,requireThat,sha,hex} from './files.mjs';
import {artifactFiles,validateBundle} from './archive.mjs';
export async function boundedResponse(response,{limit=2097152,signal,onProgress=()=>{}}={}){
 const parts=[];let length=0;const reader=response.body?.getReader();requireThat(reader,'HTTP_BODY_REQUIRED');
 let cancelled=false,rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
 const cancel=()=>{if(!cancelled){cancelled=true;reader.cancel().catch(()=>{});}};
 const abort=()=>{rejectAbort(signal.reason);cancel();};
 try{
  signal?.throwIfAborted();signal?.addEventListener('abort',abort,{once:true});
  for(;;){signal?.throwIfAborted();const r=await Promise.race([reader.read(),aborted]);signal?.throwIfAborted();if(r.done)break;length+=r.value.length;onProgress(length);requireThat(length<=limit,'HTTP_LIMIT');parts.push(Buffer.from(r.value));}
 }catch(e){cancel();throw e;}finally{signal?.removeEventListener('abort',abort);reader.releaseLock();}return Buffer.concat(parts);
}
export function githubClient({repository,token,fetcher=fetch,notBefore=0,now=Date.now,onCooldown=async()=>{},onDiagnostic=event=>console.error(JSON.stringify(event)),cache=null}){
 requireThat(repository==='eunsujeo/stablecoin-atlas'&&typeof token==='string'&&token.length>0,'GITHUB_CONFIGURATION');
 const prefix='/repos/'+repository;
 const emit=value=>{try{onDiagnostic(Object.freeze(value));}catch{}};
 async function call(path,{method='GET',body,raw=false,signal:cancellation}={}){
  requireThat(now()>=notBefore,'GITHUB_COOLDOWN');requireThat((path===prefix||path.startsWith(prefix+'/'))&&!/[\x00-\x20]/.test(path),'GITHUB_PATH');const deadline=AbortSignal.timeout(20000),signal=cancellation?AbortSignal.any([deadline,cancellation]):deadline;
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
  requireThat(found?.length,'ARTIFACT_NOT_READY');requireThat(found.length===1&&!found[0].expired,'ARTIFACT_EXPIRED_OR_DUPLICATE');requireThat(found?.length===1&&/^sha256:[a-f0-9]{64}$/.test(found[0].digest??'')&&Number.isSafeInteger(found[0].id)&&Number.isSafeInteger(found[0].size_in_bytes)&&found[0].size_in_bytes>0&&found[0].size_in_bytes<=96*1024*1024,'ARTIFACT_INVALID');
  return {id:r.id,attempt:r.run_attempt,sha:r.head_sha,component,event:r.event,artifactId:found[0].id,artifactBytes:found[0].size_in_bytes,digest:found[0].digest.slice(7),url:`https://github.com/${repository}/actions/runs/${r.id}/attempts/${r.run_attempt}`};
 }catch(e){if(identity)e.candidate=identity;throw e;}}
 async function bundle(c,{signal:cancellation}={}){
  const timeoutMs=180000,limitBytes=96*1024*1024,started=performance.now();let bodyStarted=null,bodyEnded=null,receivedBytes=0,status=null,bytes,signal,stage='cache',source='NETWORK',lastProgress=0,lastBytes=0;
  // Fixed fields and reason codes only. Neither signed URLs nor original errors enter diagnostics.
  const diagnostic=(phase,reason)=>{const elapsedMs=bodyStarted===null?0:Math.max(0,Math.round((bodyEnded??performance.now())-bodyStarted));emit({event:'ARTIFACT_DOWNLOAD',phase,stage,source,elapsedMs,totalElapsedMs:Math.max(0,Math.round(performance.now()-started)),receivedBytes,artifactBytes:bytes?.length??null,bytesPerSecond:elapsedMs?Math.floor(receivedBytes*1000/elapsedMs):0,status,timeoutMs,limitBytes,...(reason?{reason}:{})});};
  diagnostic('started');
  try{
   cancellation?.throwIfAborted();
   if(cache){requireThat(hex(c.digest),'ARTIFACT_CACHE_KEY');bytes=await cache.get(c.digest);cancellation?.throwIfAborted();if(bytes){source='CACHE';diagnostic('cache_hit');}}
   if(!bytes){
    stage='redirect';const response=await call(prefix+'/actions/artifacts/'+c.artifactId+'/zip',{raw:true,signal:cancellation});status=response.status;requireThat(response.status===302,'ARTIFACT_REDIRECT_REQUIRED');const location=new URL(response.headers.get('location'));await response.body?.cancel();
    requireThat(location.protocol==='https:'&&!location.username&&!location.password&&(/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(location.hostname)||/^[a-z0-9.-]+\.actions\.githubusercontent\.com$/.test(location.hostname)),'ARTIFACT_ORIGIN_INVALID');
    stage='body';status=null;bodyStarted=performance.now();lastProgress=bodyStarted;const deadline=AbortSignal.timeout(timeoutMs);signal=cancellation?AbortSignal.any([deadline,cancellation]):deadline;
    const download=await fetcher(location,{redirect:'error',signal});status=download.status;diagnostic('headers');
    if(status!==200){download.body?.cancel().catch(()=>{});throw Error('ARTIFACT_DOWNLOAD_FAILED');}
    bytes=await boundedResponse(download,{limit:limitBytes,signal,onProgress:length=>{receivedBytes=length;const clock=performance.now();if(clock-lastProgress>=5000||length-lastBytes>=8*1024*1024){lastProgress=clock;lastBytes=length;diagnostic('progress');}}});bodyEnded=performance.now();diagnostic('body_complete');
   }
   stage='hash';cancellation?.throwIfAborted();requireThat(Buffer.isBuffer(bytes)&&bytes.length<=limitBytes,'ARTIFACT_LIMIT');requireThat(hash(bytes)===c.digest,'ARTIFACT_HASH_MISMATCH');stage='archive';const files=artifactFiles(bytes);stage='manifest';const manifest=validateBundle(files,c);diagnostic('verified');cancellation?.throwIfAborted();
   if(cache&&source==='NETWORK'){
    stage='cache_publish';try{diagnostic(await cache.put(c.digest,bytes)?'cache_stored':'cache_unavailable');}catch{diagnostic('cache_unavailable','CACHE_WRITE_FAILED');}
   }
   cancellation?.throwIfAborted();stage='complete';diagnostic('complete');return {manifest,payload:files['release.tar']};
  }catch(e){const aborted=signal?.aborted?signal:cancellation?.aborted?cancellation:null;
   const reasons={HTTP_LIMIT:'HTTP_LIMIT',ARTIFACT_LIMIT:'HTTP_LIMIT',ARTIFACT_HASH_MISMATCH:'HASH_MISMATCH',ZIP_INVALID:'ZIP_INVALID',MANIFEST_INVALID:'MANIFEST_INVALID',NODE_ABI_MISMATCH:'NODE_ABI_MISMATCH',POLICY_MANIFEST_MISMATCH:'POLICY_MANIFEST_MISMATCH',RELEASE_INCOMPLETE:'RELEASE_INCOMPLETE',ARTIFACT_CACHE_INVALID:'CACHE_INVALID',ARTIFACT_CACHE_KEY:'CACHE_INVALID',ARTIFACT_CACHE_UNSAFE:'CACHE_UNSAFE',ARTIFACT_ORIGIN_INVALID:'ORIGIN_INVALID',ARTIFACT_REDIRECT_REQUIRED:'REDIRECT_INVALID',ARTIFACT_DOWNLOAD_FAILED:'HTTP_STATUS',GITHUB_RATE_LIMITED:'RATE_LIMITED'};
   const fallback={hash:'HASH_MISMATCH',archive:'ZIP_INVALID',manifest:'MANIFEST_INVALID',cache:'CACHE_READ_FAILED',redirect:'GITHUB_API_FAILED'};
   diagnostic('failed',aborted?(aborted.reason?.name==='TimeoutError'?'TIMEOUT':'ABORTED'):e?.name==='TimeoutError'?'TIMEOUT':e?.name==='AbortError'?'ABORTED':Object.hasOwn(reasons,e?.message)?reasons[e.message]:Object.hasOwn(fallback,stage)?fallback[stage]:'DOWNLOAD_FAILED');throw e;
  }
 }
 async function status(c,result){
  const other=result.versions??{};const description=[result.state,'reason='+(result.reason??'OK'),'current='+(result.current??'none').slice(0,12),'last='+(result.lastSuccess??'none').slice(0,12),'service='+(result.service??'unknown'),...['collector','usage'].map(k=>k[0]+'='+(other[k]?.current??'none').slice(0,7)+'/'+(other[k]?.service??'unknown'))].join(' ').slice(0,140);
  await call(prefix+'/statuses/'+c.sha,{method:'POST',body:{state:result.state==='SUCCESS'?'success':result.state==='PENDING'?'pending':'failure',context:'atlas/'+c.component,description,target_url:c.url}});
 }
 async function reportingReady(){const v=await call(prefix+'/actions/variables/ATLAS_DEPLOY_REPORTING_ENABLED');requireThat(v.value==='true','REPORTING_NOT_ENABLED');}
 async function discover(...args){const started=performance.now();try{const result=await candidate(...args);emit({event:'ARTIFACT_DISCOVERY',state:result?'CANDIDATE':'NONE',elapsedMs:Math.max(0,Math.round(performance.now()-started)),artifactBytes:result?.artifactBytes??null});return result;}catch(e){emit({event:'ARTIFACT_DISCOVERY',state:'FAILED',elapsedMs:Math.max(0,Math.round(performance.now()-started)),reason:'GITHUB_VERIFICATION_FAILED'});throw e;}}
 return {candidate:discover,bundle,status,reportingReady};
}
