import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {activateRelease} from '../release-switch.mjs';
import {stageVerified} from './stage.mjs';
import {atomicJSON,json,requireThat} from './files.mjs';
// The journal is authoritative. versions/reports are repairable views of committed outcomes.
export async function reconcile({root,state,config,github,ops,clock=()=>new Date().toISOString(),store=atomicJSON,repairOnly=false}){
 await mkdir(join(state,'reports'),{recursive:true,mode:0o700});const save=v=>store(join(state,'transaction.json'),v);
 const versions=await json(join(state,'versions.json'),{schemaVersion:1,web:{},collector:{},usage:{}});
 let tx=await json(join(state,'transaction.json'),null);
 const report=async(c,r)=>{
  const path=join(state,'reports',`${c.id}-${c.attempt}-${c.component}.json`),prior=await json(path,null).catch(()=>null);
  if(prior?.reported&&['state','current','lastSuccess','reason'].every(k=>(prior[k]??null)===(r[k]??null)))return prior;
  const observed={};for(const component of ['web','collector','usage'])observed[component]={current:await ops.current(component).catch(()=>null),lastSuccess:versions[component].lastSuccess??null,service:await ops.service(component).catch(()=>'unknown')};
  let notification=null;const value={versions:observed,component:c.component,requested:c.sha,runId:c.id,attempt:c.attempt,checkedAt:clock(),...r,reported:false};
  try{await store(path,value);}catch{notification='REPORT_STORAGE_PENDING';}
  try{if(!(tx?.manual&&c.id===0))await github.status(c,{...value,...(notification?{reason:notification}:{})});value.reported=true;try{await store(path,value);}catch{notification='REPORT_STORAGE_PENDING';}}
  catch{notification='GITHUB_REPORT_PENDING';}
  return notification?{...value,notification}:value;
 };
 const update=async(c,result)=>{
  const previous=versions[c.component],old=JSON.stringify(previous);versions[c.component]={...previous,...result,lastAttempt:Math.max(c.id,previous.lastAttempt??0),lastAttemptNumber:c.id>=(previous.lastAttempt??0)?c.attempt:previous.lastAttemptNumber};if(JSON.stringify(versions[c.component])!==old)await store(join(state,'versions.json'),versions);
 };
 const finish=async(c,result)=>{
  tx={...tx,phase:'COMMITTED',terminal:true,result};await save(tx); // Commit before derived caches or network reporting.
  try{await update(c,result);}catch{return report(c,{...result,reason:'VERSION_CACHE_PENDING'});}
  return report(c,result);
 };
 const restore=async(c,previous,before)=>{
  if(c.component!=='web')await ops.quiesce(c.component,tx);
  const gate=c.component==='web'?null:await ops.hold(c.component);
  try{if(previous)await ops.restore(c.component,previous);else{await ops.stop(c.component);await ops.clearPointer(c.component,c.sha);}}
  finally{await gate?.release();}
  if(c.component!=='web')await ops.resume(c.component,before??{});
  if(previous)await ops.health(c.component,previous);
 };
 if(tx&&!tx.terminal){
  const c=tx.candidate,actual=await ops.current(c.component);requireThat([tx.old,c.sha,null].includes(actual),'RECOVERY_POINTER_CHANGED');
  if((tx.recoveryAttempts??0)>=3)return report(c,{state:'RECOVERY_BLOCKED',current:actual,lastSuccess:tx.previousVersion?.lastSuccess??tx.old,service:await ops.service(c.component),reason:'RECOVERY_REQUIRES_REARM'});
  tx={...tx,phase:'RECOVERING',recoveryAttempts:(tx.recoveryAttempts??0)+1};await save(tx);
  try{
   // No writer was touched before the durable snapshot. Do not interrupt an unchanged worker.
   if(actual!==tx.old||tx.before)await restore(c,tx.old,tx.before);
   else if(actual)await ops.health(c.component,actual);
   else if(c.component==='web')await ops.stop('web'); // A removed first-deploy pointer does not prove the process stopped.
   const current=await ops.current(c.component);requireThat(current===tx.old,'RECOVERY_POINTER_MISMATCH');
   return await finish(c,{state:'CRASH_RECOVERED',current,lastSuccess:tx.old??tx.previousVersion?.lastSuccess??null,service:await ops.service(c.component),reason:'CRASH_RECOVERED'});
  }catch{
   if(c.component!=='web')await ops.leaveStopped(c.component);const current=await ops.current(c.component).catch(()=>null);const result={state:'RECOVERY_BLOCKED',current,lastSuccess:tx.previousVersion?.lastSuccess??tx.old,service:await ops.service(c.component),reason:'RECOVERY_GATE_FAILED'};
   tx={...tx,phase:'RECOVERY_BLOCKED',terminal:false};await save(tx);try{await update(c,result);}catch{}return report(c,result);
  }
 }
 // Repair a crash after durable COMMITTED but before versions/report publication, without a restart.
 if(tx?.phase==='COMMITTED'&&tx.result){requireThat(await ops.current(tx.candidate.component)===tx.result.current,'COMMITTED_POINTER_CHANGED');await update(tx.candidate,tx.result);const repaired=await report(tx.candidate,tx.result);if(repairOnly||repaired.notification)return repaired;}
 if(repairOnly)return {state:'NO_PENDING_RECOVERY'};
 requireThat(config.enabled,'AUTOMATION_DISABLED');let c;try{c=await github.candidate(config,versions);}catch(e){if(!e.candidate)throw e;const known=e.candidate;return report(known,{state:e.message==='ARTIFACT_NOT_READY'?'PENDING':'BLOCKED',current:await ops.current(known.component),lastSuccess:versions[known.component].lastSuccess??null,service:await ops.service(known.component),reason:/^[A-Z_]{1,64}$/.test(e.message)?e.message:'GITHUB_VERIFICATION_FAILED'});}if(!c)return {state:'NO_CANDIDATE'};
 const v=versions[c.component];
 if(c.id<(v.lastAttempt??0)||c.id===v.lastAttempt&&c.attempt<=(v.lastAttemptNumber??0)){
  const prior=await json(join(state,'reports',`${c.id}-${c.attempt}-${c.component}.json`),null);return prior?await report(c,prior):{state:'SUPERSEDED'};
 }
 const old=await ops.current(c.component);let held,switching=false;
 tx={schemaVersion:1,candidate:c,old,previousVersion:{...v},phase:'PREFLIGHT',terminal:false,startedAt:clock()};await save(tx);
 try{
  await report(c,{state:'PENDING',current:old,lastSuccess:v.lastSuccess??old,service:await ops.service(c.component)});
  requireThat(config.components[c.component]?.enabled,'COMPONENT_DISABLED');const bundle=await github.bundle(c);if(c.component!=='web')requireThat(bundle.manifest.policies?.[c.component]===config.components[c.component].policyHash,'COLLECTION_POLICY_CHANGED');
  await ops.preflight(c.component,{candidate:c,bundle});tx.phase='STAGING';await save(tx);await stageVerified(root,c.sha,bundle);
  if(c.component!=='web'){tx.before=await ops.snapshot(c.component);tx.phase='QUIESCING';await save(tx);await ops.quiesce(c.component,tx);held=await ops.hold(c.component);tx.phase='QUIESCED';await save(tx);}
  tx.phase='SWITCHING';await save(tx);switching=true;
  if(c.component==='web')await activateRelease({root,sha:c.sha,lockHeld:true,restart:()=>ops.restart('web'),stop:()=>ops.stop('web'),health:async s=>{try{await ops.health('web',s);return true;}catch{return false;}}});
  else{await ops.setPointer(c.component,c.sha);await held.release();held=null;tx.phase='RESUMING';await save(tx);await ops.resume(c.component,tx.before);await ops.health(c.component,c.sha);}
  return await finish(c,{state:'SUCCESS',current:c.sha,lastSuccess:c.sha,previous:old,service:await ops.service(c.component),reason:null});
 }catch(error){
  await held?.release().catch(()=>{});const reason=/^[A-Z_]{1,64}$/.test(error.message)?error.message:'DEPLOY_FAILED';let resultState='FAILED';
  try{
   const current=await ops.current(c.component);
   if(switching&&current!==old||c.component!=='web'&&tx.before){await restore(c,old,tx.before);resultState='ROLLED_BACK';}
   else if(c.component==='web'&&switching){if(old)await ops.health('web',old);else await ops.stop('web');if(reason==='DEPLOY_FAILED_ROLLED_BACK')resultState='ROLLED_BACK';}
  }catch{
   if(c.component!=='web')await ops.leaveStopped(c.component);tx={...tx,phase:'RECOVERY_BLOCKED',terminal:false};await save(tx);return report(c,{state:'RECOVERY_BLOCKED',current:await ops.current(c.component),lastSuccess:v.lastSuccess??old,service:await ops.service(c.component),reason});
  }
  const result={state:resultState,current:await ops.current(c.component),lastSuccess:v.lastSuccess??old,service:await ops.service(c.component),reason};return finish(c,result);
 }
}
