import {join,dirname} from 'node:path';
import {readYahooFX} from './yahoo-fx-store.mjs';
import {databaseFrankfurterFXReader} from './market-db/frankfurter-fx-preview.mjs';
// Explicit migration fallback, with the original provider/date retained in every response.
// No provider HTTP request is ever initiated by a web request.
export function referenceFXReader({env,connect,file='/var/lib/atlas-public/yahoo-fx.json',legacy=databaseFrankfurterFXReader({env,connect,allowExpired:true}),read=readYahooFX}={}){
 return async()=>{try{return await read(file);}catch{return legacy();}};
}
export function yahooPublicPath(config){return join(dirname(config.fxFile??'/var/lib/atlas-public/fx.json'),'yahoo-fx.json');}
export async function optionalFXStatus(read){
 try{const p=await read();return {state:'AVAILABLE',provider:p.provider??'ECB',date:p.date};}
 catch(e){if(e.message!=='FX_UNAVAILABLE')throw e;return {state:'UNAVAILABLE',impact:'KRW_ONLY'};}
}
