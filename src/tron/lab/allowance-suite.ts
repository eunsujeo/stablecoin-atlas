import { deployPrivateTronAllowanceFixture } from './deployment.js';
import type { TronAllowanceProbe } from './compiler.js';
import { validateAllowanceCaseReport } from './allowance-report.js';
import { allowanceCasePlan } from './allowance-plan.js';
export { allowanceCasePlan } from './allowance-plan.js';
export async function runAllowanceSuite(signal?:AbortSignal,run=deployPrivateTronAllowanceFixture,progress?:(id:string,outcome:string)=>void) {
  const startedAt=new Date().toISOString(),cases=allowanceCasePlan.map(p=>({...p,id:`${p.operation}:${p.variant}`,outcome:'NOT_TESTED',report:undefined as Awaited<ReturnType<typeof run>>|undefined}));
  const used=new Set<string>();let outcome='OBSERVED';
  for(const item of cases){
    if(signal?.aborted){outcome='ERROR';break;}item.outcome='ERROR';
    try{
      item.report=await run(item.variant,item.operation,signal);validateAllowanceCaseReport(item.report);
      const r=item.report;if(r.outcome!=='OBSERVED')throw new Error('ALLOWANCE_CASE_FAILED');
      for(const id of [r.runtime.runId,r.runtime.resources.containerId,r.runtime.resources.networkId]){if(!id||used.has(id))throw new Error('ALLOWANCE_ENVIRONMENT_REUSED');used.add(id);}
      item.outcome='OBSERVED';progress?.(item.id,item.outcome);
    }catch{outcome='ERROR';progress?.(item.id,'ERROR');break;}
  }
  return {schemaVersion:'1.0',kind:'TRON_PRIVATE_TVM_ALLOWANCE_SUITE',outcome,cases,startedAt,completedAt:new Date().toISOString(),
    limitations:['Ten separately owned fresh private runtimes, controls first. Fixture FAIL and regression acceptance are distinct.','No public-network transactions, issuer/authority/asset safety or finality verification. Getter state blocks remain UNKNOWN.']};
}
