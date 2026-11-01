import {XRPL_STEPS,xrplState,xrplView,xrplDetail,xrplSources} from './xrpl.mjs';
export const NETWORKS={xrpl:{name:'XRPL',steps:XRPL_STEPS,state:xrplState,view:xrplView,detail:xrplDetail,sources:xrplSources,scenarios:{normal:'정상 합의',offline:'UNL 일부 오프라인',delayed:'Validation 지연'}}};
