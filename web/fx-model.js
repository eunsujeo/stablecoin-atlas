import {decimal,units} from './market-model.js';
const scale=10n**36n;
const group=s=>s.replace(/\B(?=(\d{3})+(?!\d))/g,',');
const iso=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
export function validateFX(p){
 if(p?.schemaVersion===3){
  if(p.kind!=='YAHOO_REFERENCE_FX'||p.provider!=='YAHOO_FINANCE'||p.rateType!=='MARKET_QUOTE'||p.symbol!=='USDKRW=X'||p.base!=='USD'||p.quote!=='KRW'||!decimal(p.krwPerUSD)||units(p.krwPerUSD)===0n||!iso(p.observedAt)||!iso(p.fetchedAt)||p.importedAt!==null||p.date!==p.observedAt.slice(0,10)||p.observedAt>p.fetchedAt||!/^[a-f0-9]{64}$/.test(p.sourceHash))throw Error('INVALID_FX');return p;
 }
 if(p?.schemaVersion===2){
  if(p.kind!=='FRANKFURTER_REFERENCE_FX'||p.provider!=='FRANKFURTER'||p.rateType!=='BLENDED_REFERENCE'||p.base!=='USD'||p.quote!=='KRW'||typeof p.date!=='string'||!/^\d{4}-\d\d-\d\d$/.test(p.date)||!iso(p.date+'T00:00:00.000Z')||!decimal(p.krwPerUSD)||units(p.krwPerUSD)===0n||!/^[a-f0-9]{64}$/.test(p.sourceHash)||!iso(p.fetchedAt)||p.importedAt!==null||p.date>p.fetchedAt.slice(0,10))throw Error('INVALID_FX');return p;
 }
 if(!p||p.schemaVersion!==1||p.kind!=='ECB_REFERENCE_FX'||p.base!=='EUR'||typeof p.date!=='string'||!/^\d{4}-\d\d-\d\d$/.test(p.date)||!iso(p.date+'T00:00:00.000Z')||!decimal(p.usdPerEUR)||!decimal(p.krwPerEUR)||units(p.usdPerEUR)===0n||units(p.krwPerEUR)===0n||!/^[a-f0-9]{64}$/.test(p.sourceHash)||!((iso(p.fetchedAt)&&p.importedAt===null)||(iso(p.importedAt)&&p.fetchedAt===null))||p.date>(p.fetchedAt??p.importedAt).slice(0,10))throw Error('INVALID_FX');return p;
}
export function fxSourceLabel(p){return p?.schemaVersion===3?'Yahoo Finance 참고환율':p?.schemaVersion===2?'Frankfurter 일별 참고환율':'ECB 일별 참고환율';}
export function availableFX(p,now=Date.now()){try{validateFX(p);return Date.parse(p.fetchedAt??p.importedAt)<=now&&Date.parse(p.date)<=now;}catch{return false;}}
export function fxDisplayNote(p,now=Date.now()){return availableFX(p,now)?fxSourceLabel(p)+' · 기준일 '+p.date+(usableFX(p,now)?' · 참고 환산':' · 갱신 지연 · 마지막 정상 환율로 참고 환산'):'환율 미확보 · 달러 가격 표시';}
export function usableFX(p,now=Date.now()){try{if(!availableFX(p,now))return false;const age=Date.parse(new Date(now).toISOString().slice(0,10))-Date.parse(p.date);return age>=0&&age<=7*86400000;}catch{return false;}}
export function priceLabel(amount,currency='USD',fx=null,now=Date.now()){
 const n=units(amount);
 if(currency==='USD'){
  const rounded=(n+10n**28n/2n)/10n**28n;if(n>0n&&rounded===0n)return '<$0.00000001';
  const tail=String(rounded%100000000n).padStart(8,'0').replace(/0+$/,'');return '$'+group(String(rounded/100000000n))+(tail?'.'+tail:'');
 }
 if(currency!=='KRW')return '—';
 if(!availableFX(fx,now))return priceLabel(amount,'USD',null,now);
 const denominator=fx.schemaVersion>=2?scale*scale:units(fx.usdPerEUR)*scale;
 const rate=fx.schemaVersion>=2?units(fx.krwPerUSD):units(fx.krwPerEUR);
 const cents=(n*rate*100n+denominator/2n)/denominator;
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
