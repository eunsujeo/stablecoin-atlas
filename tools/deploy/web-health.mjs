import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {loopbackRequest} from '../loopback-http.mjs';
import {checkWebHealth} from '../release-switch.mjs';
import {publicAssets,productionDocument} from '../production-policy.mjs';
import {validateMarket} from '../../web/market-model.js';
import {validateRegistrationIndex,validateRegisteredHistory} from '../../web/registration-model.js';
import {validateNetworkUsage} from '../../web/network-usage-model.js';
import {validateAssetReview} from '../../web/asset-review-model.js';
import {validateFX} from '../../web/fx-model.js';
import {hash,requireThat} from './files.mjs';
export async function verifyWebRelease({sha,release,config,request=loopbackRequest}){
 const get=async path=>{const r=await request({port:config.port,host:config.hosts[0],path,timeout:15000,limit:2097152});requireThat(r.status===200,'HEALTH_HTTP');return r.body;};
 const decode=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));
 requireThat(decode(await get('/healthz')).commit===sha,'HEALTH_SHA');
 for(const path of publicAssets){if(path==='/legacy.html')continue;const expected=path==='/'||path==='/index.html'?productionDocument(await readFile(join(release,'web/index.html'))):await readFile(join(release,'web',path.slice(1)));requireThat(hash(await get(path))===hash(expected),'HEALTH_ASSET');}
 const market=decode(await get('/market-data.json'));validateMarket(market);requireThat(market.readState?.source==='POSTGRESQL','HEALTH_DATABASE');
 const index=validateRegistrationIndex(decode(await get('/registration-index.json')));
 for(const coin of index.coins){const metric=coin.metrics.find(m=>m.metric==='NETWORK_CIRCULATING');if(!metric)continue;const query=new URLSearchParams({selection:index.selectionId,coin:coin.id,metric:metric.metric});validateRegisteredHistory(decode(await get('/registration-history.json?'+query)),index,{coinId:coin.id,metric:metric.metric});}
 validateNetworkUsage(decode(await get('/network-usage-data.json')));validateAssetReview(decode(await get('/asset-review-data.json')));
 const response=await request({port:config.port,host:config.hosts[0],path:'/fx-data.json',timeout:15000,limit:65536});
 let fx;
 if(response.status===503){requireThat(response.body.toString('utf8')==='FX_UNAVAILABLE','HEALTH_FX_RESPONSE');fx={state:'UNAVAILABLE',impact:'KRW_ONLY'};}
 else {requireThat(response.status===200,'HEALTH_FX_RESPONSE');const p=validateFX(decode(response.body));fx={state:'AVAILABLE',provider:p.provider??'ECB',date:p.date};}
 return {state:'HEALTHY',commit:sha,fx};
}

export async function waitForWebRelease(options,{ready=checkWebHealth,verify=verifyWebRelease}={}){requireThat(await ready(options.sha,{host:options.config.hosts[0],port:options.config.port,attempts:12}),'HEALTH_NOT_READY');return verify(options);}
