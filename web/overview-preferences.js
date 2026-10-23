const key='atlas-overview-chart-v1';
const fields=['version','coinId','networkId','source','period','comparison'];
const defaults={version:1,coinId:'usdc',networkId:'all',source:'history',period:'1y',comparison:'amount'};
const parameters={coin:'coinId',network:'networkId',source:'source',period:'period',comparison:'comparison'};
// A shared partial URL uses fixed defaults, never the recipient's saved choices.
export function readChartURL(href){
 try{
  const url=new URL(href),value={...defaults};let present=false;
  for(const [parameter,field]of Object.entries(parameters)){
   const values=url.searchParams.getAll(parameter);if(!values.length)continue;present=true;
   if(values.length!==1)return {...defaults};value[field]=values[0];
  }
  return present?(validateChartPreferences(value)??{...defaults}):null;
 }catch{return null;}
}
export function chartURL(value,href){
 const valid=validateChartPreferences(value);if(!valid)return null;
 try{const url=new URL(href);for(const [parameter,field]of Object.entries(parameters))url.searchParams.set(parameter,valid[field]);return url.href;}catch{return null;}
}
export function syncChartURL(value,browser=globalThis){
 try{const href=chartURL(value,browser.location.href);if(!href)return false;if(href!==browser.location.href)browser.history.replaceState(browser.history.state,'',href);return true;}catch{return false;}
}
export function validateChartPreferences(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||!fields.every(f=>Object.hasOwn(value,f))||value.version!==1)return null;
 if(!['usdc','usdt','rlusd','jpyc','jpysc'].includes(value.coinId)||typeof value.networkId!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(value.networkId)||!['history','minted'].includes(value.source)||!['30d','90d','1y'].includes(value.period)||!['amount','change'].includes(value.comparison))return null;
 return {...value};
}
export function readChartPreferences(storage){
 try{const raw=(storage??globalThis.localStorage).getItem(key);if(typeof raw!=='string'||raw.length>1024)return null;return validateChartPreferences(JSON.parse(raw));}catch{return null;}
}
export function saveChartPreferences(value,storage){
 const valid=validateChartPreferences(value);if(!valid)return false;
 try{(storage??globalThis.localStorage).setItem(key,JSON.stringify(valid));return true;}catch{return false;}
}
