import {decimal,units} from './market-model.js';
const scale=10n**36n;
const group=s=>s.replace(/\B(?=(\d{3})+(?!\d))/g,',');
const iso=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
export function validateFX(p){
 if(!p||p.schemaVersion!==1||p.kind!=='ECB_REFERENCE_FX'||p.base!=='EUR'||typeof p.date!=='string'||!/^\d{4}-\d\d-\d\d$/.test(p.date)||!iso(p.date+'T00:00:00.000Z')||!decimal(p.usdPerEUR)||!decimal(p.krwPerEUR)||units(p.usdPerEUR)===0n||units(p.krwPerEUR)===0n||!/^[a-f0-9]{64}$/.test(p.sourceHash)||!((iso(p.fetchedAt)&&p.importedAt===null)||(iso(p.importedAt)&&p.fetchedAt===null))||p.date>(p.fetchedAt??p.importedAt).slice(0,10))throw Error('INVALID_FX');return p;
}
export function usableFX(p,now=Date.now()){try{validateFX(p);const age=Date.parse(new Date(now).toISOString().slice(0,10))-Date.parse(p.date);return age>=0&&age<=7*86400000;}catch{return false;}}
export function priceLabel(amount,currency='USD',fx=null,now=Date.now()){
 const n=units(amount);
 if(currency==='USD'){
  const rounded=(n+10n**28n/2n)/10n**28n;if(n>0n&&rounded===0n)return '<$0.00000001';
  const tail=String(rounded%100000000n).padStart(8,'0').replace(/0+$/,'');return '$'+group(String(rounded/100000000n))+(tail?'.'+tail:'');
 }
 if(currency!=='KRW'||!usableFX(fx,now))return '—';
 const denominator=units(fx.usdPerEUR)*scale,cents=(n*units(fx.krwPerEUR)*100n+denominator/2n)/denominator;
 if(n>0n&&cents===0n)return '<₩0.01';return '₩'+group(String(cents/100n))+'.'+String(cents%100n).padStart(2,'0');
}
const key='atlas-market-currency-v1';
export function readCurrency(href,storage){
 try{const query=new URL(href).searchParams.getAll('currency');if(query.length)return query.length===1&&['USD','KRW'].includes(query[0])?query[0]:'USD';}catch{}
 try{const value=(storage??globalThis.localStorage).getItem(key);return ['USD','KRW'].includes(value)?value:'USD';}catch{return 'USD';}
}
export function saveCurrency(value,browser=globalThis){
 if(!['USD','KRW'].includes(value))return;
 try{browser.localStorage.setItem(key,value);}catch{}
 try{const url=new URL(browser.location.href);url.searchParams.set('currency',value);if(url.href!==browser.location.href)browser.history.replaceState(browser.history.state,'',url.href);}catch{}
}
