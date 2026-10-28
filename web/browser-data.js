import {validateNetworkUsage} from './network-usage-model.js';
import {createJSONClient} from './browser-cache.js';
import {validateMarket} from './market-model.js';
import {validateFX} from './fx-model.js';
import {validateRegistrationIndex} from './registration-model.js';
import {validateActivity} from './activity-model.js';
import {validateReviewedSupply} from './reviewed-supply-model.js';
import {validateStoredSurvey} from './survey-model.js';
import {validateGeography} from './geography-model.js';
import {validateIndex} from './evidence-model.js';
import {validateAssetReview} from './asset-review-model.js';
const minute=60000,hour=60*minute;
export const apiCachePolicies=Object.freeze({
 '/market-data.json':{ttl:5*minute,label:'시장 자료',validate:validateMarket},
 '/registration-index.json':{ttl:5*minute,label:'공급량 목록',validate:validateRegistrationIndex},
 '/registration-history.json':{ttl:5*minute,label:'공급량 이력'},
 '/fx-data.json':{ttl:hour,label:'참고 환율',validate:validateFX},
 '/asset-review-data.json':{ttl:hour,label:'기술 검토',validate:validateAssetReview,limit:262144},
 '/contract-review-data.json':{ttl:hour,label:'컨트랙트 검토',limit:131072},
 '/activity-data.json':{ttl:5*minute,label:'활동 자료',validate:validateActivity},
 '/reviewed-supply-data.json':{ttl:hour,label:'저장 공급량',validate:validateReviewedSupply},
 '/network-usage-data.json':{ttl:5*minute,label:'Arkham 활동 자료',validate:validateNetworkUsage,limit:131072},
 '/survey-data.json':{ttl:hour,label:'저장 조사',validate:validateStoredSurvey},
 '/geography-data.json':{ttl:hour,label:'지리 연구',validate:validateGeography},
 '/evidence/index.json':{ttl:hour,label:'실행 근거',validate:validateIndex,credentials:'omit'},
 '/mock-data.json':{ttl:hour,label:'가상 자료',limit:64000,credentials:'omit'},
});
export function apiRequestPolicy(path,origin=globalThis.location?.origin){
 if(typeof path!=='string'||path.length>2048||!path.startsWith('/')||path.startsWith('//')||!origin)throw Error('API_URL_INVALID');
 const u=new URL(path,origin);if(u.origin!==origin||path.split('?')[0]!==u.pathname||u.username||u.password||u.hash||!Object.hasOwn(apiCachePolicies,u.pathname))throw Error('API_URL_INVALID');
 if(u.pathname==='/registration-history.json'){
  if([...u.searchParams.keys()].length!==3||!['selection','coin','metric'].every(k=>u.searchParams.getAll(k).length===1)||!/^[a-f0-9]{64}$/.test(u.searchParams.get('selection'))||!['usdc','usdt','rlusd','jpyc','jpysc'].includes(u.searchParams.get('coin'))||!['NETWORK_CIRCULATING','NETWORK_MINTED'].includes(u.searchParams.get('metric')))throw Error('API_URL_INVALID');
 }else if(u.search)throw Error('API_URL_INVALID');
 u.searchParams.sort();return {url:u.pathname+u.search,...apiCachePolicies[u.pathname]};
}
function safeJSON(value,depth=0){
 if(depth>40)throw Error('CACHE_DATA_INVALID');
 if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){
  if(/^(?:__proto__|prototype|constructor|api[-_]?key|authorization|password|private[-_]?key|access[-_]?token|refresh[-_]?token|auth[-_]?token|secret|rpc[-_]?url|database[-_]?url)$/i.test(key))throw Error('CACHE_DATA_INVALID');
  if(typeof v==='string'&&/(?:postgres(?:ql)?:\/\/|https?:\/\/[^/\s]*@|https?:\/\/\S*[?&](?:api[-_]?key|access_token|token|secret|password|auth)=)/i.test(v))throw Error('CACHE_DATA_INVALID');safeJSON(v,depth+1);
 }
}
let channel;try{if(typeof window!=='undefined'&&typeof BroadcastChannel==='function')channel=new BroadcastChannel('atlas-json-cooldown-v1');}catch{}
export const browserData=createJSONClient({channel});
export function cachedJSON(path,{validate,context='',...options}={}){
 const {url,...policy}=apiRequestPolicy(path);if(options.headers||options.method&&options.method!=='GET'||options.credentials&&options.credentials!==(policy.credentials??'same-origin'))throw Error('API_REQUEST_INVALID');
 if(!policy.validate&&typeof validate!=='function')throw Error('API_VALIDATOR_REQUIRED');
 return browserData.read(url,{...options,...policy,context,version:'atlas-json-v1',credentials:policy.credentials??'same-origin',validate:value=>{safeJSON(value);policy.validate?.(value);validate?.(value);}});
}
