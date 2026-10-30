import {requireThat} from './files.mjs';
export async function timedDeployment(operation,run,{onDiagnostic=value=>console.error(JSON.stringify(value))}={}){
 requireThat(['bootstrap','apply'].includes(operation),'DEPLOY_TIMING_OPERATION');const started=performance.now();
 const emit=phase=>{try{onDiagnostic(Object.freeze({event:'DEPLOY_OPERATION',operation,phase,totalElapsedMs:Math.max(0,Math.round(performance.now()-started))}));}catch{}};
 emit('started');try{const value=await run();emit('complete');return value;}catch(error){emit('failed');throw error;}
}
