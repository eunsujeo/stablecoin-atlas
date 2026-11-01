import {TRON_STEPS,tronState,tronView,tronDetail,tronSources} from './tron.mjs';
import {XRPL_STEPS,xrplState,xrplView,xrplDetail,xrplSources} from './xrpl.mjs';
export const NETWORKS={tron:{name:'TRON',steps:TRON_STEPS,state:tronState,view:tronView,detail:tronDetail,sources:tronSources,scenarios:{normal:'정상 생산·확정',missed:'슬롯 누락',offline:'9 SR 오프라인'}},xrpl:{name:'XRPL',steps:XRPL_STEPS,state:xrplState,view:xrplView,detail:xrplDetail,sources:xrplSources,scenarios:{normal:'정상 합의',offline:'UNL 일부 오프라인',delayed:'Validation 지연'}}};
