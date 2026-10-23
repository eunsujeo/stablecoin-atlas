const key='atlas-overview-chart-v1';
const fields=['version','coinId','networkId','source','period','comparison'];
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
