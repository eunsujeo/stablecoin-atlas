// Explicit offline browser fixture. No database, keys or provider requests.
import {readFile} from 'node:fs/promises';
import {startPreviewServer} from '../tools/ui-preview.mjs';
import {normalizeSources} from '../tools/market-store.mjs';
import {reviewedSupplyFixture} from './reviewed-supply-fixture.mjs';
import {surveyDto} from './survey-fixture.mjs';
import {validateRegistrationIndex} from '../web/registration-model.js';
export async function productionBrowserFixture(){
 const registry=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url)));
 const metadata=JSON.parse(await readFile(new URL('../data/market-registration.json',import.meta.url)));
 const market=normalizeSources(registry,[{hash:'a'.repeat(64),value:{requests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,observedAt:'2026-10-25T00:00:00.000Z',data:{price:'1',circulatingSupply:'100',totalSupply:'200'}}]}}]);
 const index=validateRegistrationIndex({schemaVersion:1,kind:'REGISTERED_SUPPLY_INDEX',selectionId:'a'.repeat(64),coins:metadata.coins.map(c=>({...c,metrics:[],notes:[]})),networks:metadata.networks});
 const survey=await surveyDto(),reviewed=reviewedSupplyFixture();let fxFailed=true;
 const at=new Date().toISOString(),fx={schemaVersion:1,kind:'ECB_REFERENCE_FX',base:'EUR',date:at.slice(0,10),usdPerEUR:'2',krwPerEUR:'2000',sourceHash:'a'.repeat(64),fetchedAt:at,importedAt:null};
 const server=await startPreviewServer(0,{production:{hosts:['atlas.example.com'],commit:'a'.repeat(40)},marketReader:async()=>market,
  registrationReader:async()=>index,activityReader:async()=>({schemaVersion:1,kind:'DAILY_TRANSFERS',provider:'ALLIUM',metric:'TRANSFER_VOLUME',networkId:'ethereum',dateBasis:'PROVIDER_DAY',state:'MISSING',series:[]}),
  reviewedSupplyReader:async()=>reviewed,surveyReader:async()=>survey,fxReader:async()=>{if(fxFailed)throw Error('SECRET_CANARY');return fx;}});
 return {server,setFXFailed:value=>{fxFailed=value;},stop:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
