import {databaseFXReader} from './fx-preview.mjs';
import {readFrankfurterFXSnapshot} from './frankfurter-fx.mjs';
// Explicit selected provider. Missing or invalid data never selects ECB silently.
export function databaseFrankfurterFXReader(options={}){
 const read=options.read??readFrankfurterFXSnapshot;
 return databaseFXReader({...options,read:async(...args)=>{
  const p=await read(...args);if(p?.schemaVersion!==2||p.provider!=='FRANKFURTER')throw Error('FX_UNAVAILABLE');return p;
 }});
}
