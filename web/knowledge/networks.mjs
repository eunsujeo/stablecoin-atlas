import {BASE_STEPS,BASE_SCENARIOS,baseSteps,baseState,baseView,baseDetail,baseSources} from './base.mjs';
import {SOLANA_STEPS,solanaState,solanaView,solanaDetail,solanaSources} from './solana.mjs';
import {TRON_STEPS,tronState,tronView,tronDetail,tronSources} from './tron.mjs';
import {XRPL_STEPS,xrplState,xrplView,xrplDetail,xrplSources} from './xrpl.mjs';
export const NETWORKS={base:{name:'Base',steps:BASE_STEPS,stepsFor:baseSteps,state:baseState,view:baseView,detail:baseDetail,sources:baseSources,scenarios:BASE_SCENARIOS},solana:{name:'Solana',steps:SOLANA_STEPS,state:solanaState,view:solanaView,detail:solanaDetail,sources:solanaSources,scenarios:{normal:'빠른 확정',slow:'두 라운드 확정',offline:'지분55% 오프라인',skipped:'리더 미응답·회복'}},tron:{name:'TRON',steps:TRON_STEPS,state:tronState,view:tronView,detail:tronDetail,sources:tronSources,scenarios:{normal:'정상 생산·확정',missed:'슬롯 누락',offline:'9 SR 오프라인'}},xrpl:{name:'XRPL',steps:XRPL_STEPS,state:xrplState,view:xrplView,detail:xrplDetail,sources:xrplSources,scenarios:{normal:'정상 합의',offline:'UNL 일부 오프라인',delayed:'Validation 지연'}}};

// Semantic tones use protocol evidence, never translated status strings.
export function networkUX(s){
 if(s.lesson==='xrpl')return {tones:['neutral',s.accepted?'success':s.t>=12?'warning':'progress',s.validated?'success':s.candidate?'progress':'neutral',s.validated?'success':'warning'],stages:s.stageStates};
 if(s.lesson==='tron')return {tones:['neutral','neutral',s.support>=19?'success':s.support===18?'warning':'progress',s.solid>=5001?'success':'warning']};
 if(s.lesson==='solana')return {tones:['neutral',s.finalized?'success':s.replayed?'warning':'neutral',s.finalized?'success':s.scenario==='offline'?'warning':'progress','success']};
 if(s.lesson==='base'){const w=s.withdrawal,derived=s.deposit?s.deposit.executed:s.batch.derived,final=s.finalized===s.head&&s.head>500;return {tones:w?[final?'success':'warning',s.claim?.state==='INVALID'||s.claim?.state==='CHALLENGED'?'warning':w.gates.claimValid&&w.gates.claimResolved?'success':'neutral',w.eligible?'success':'warning',w.relayed?'success':'warning']:['neutral',derived?'success':'warning',final?'success':'neutral',derived?'success':'warning']};}
 return null;
}
