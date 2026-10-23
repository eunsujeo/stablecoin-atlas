import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChartPreferences,readChartPreferences,saveChartPreferences,readChartURL,chartURL,syncChartURL} from './overview-preferences.js';
const choice={version:1,coinId:'jpyc',networkId:'polygon',source:'minted',period:'90d',comparison:'change'};
test('shared chart URLs round trip independent of storage and preserve page, unrelated query and origin',()=>{
 const href=chartURL(choice,'http://127.0.0.1:4173/?theme=light#overview');
 assert.deepEqual(readChartURL(href),choice);const url=new URL(href);assert.equal(url.origin,'http://127.0.0.1:4173');assert.equal(url.hash,'#overview');assert.equal(url.searchParams.get('theme'),'light');
 assert.equal(readChartURL('http://localhost/?theme=light#overview'),null);
 assert.deepEqual(readChartURL('http://localhost/?coin=rlusd#overview'),{version:1,coinId:'rlusd',networkId:'all',source:'history',period:'1y',comparison:'amount'});
});
test('malformed or ambiguous chart URL choices use fixed defaults rather than recipient preferences',()=>{
 const defaults={version:1,coinId:'usdc',networkId:'all',source:'history',period:'1y',comparison:'amount'};
 for(const query of ['coin=unknown','coin=jpyc&coin=usdc','network=../secret','period=24h','source=rpc','comparison=other','coin='])assert.deepEqual(readChartURL('http://localhost/?'+query),defaults);
 assert.equal(readChartURL('invalid'),null);assert.equal(chartURL({...choice,coinId:'other'},'http://localhost/'),null);
});
test('URL updates replace only current entry, preserve history state and tolerate denied browser APIs',()=>{
 let calls=0;const state={navigation:'keep'},browser={location:{href:'http://localhost/#overview'},history:{state,replaceState(s,title,href){assert.equal(s,state);assert.equal(title,'');calls++;browser.location.href=href;}}};
 assert.equal(syncChartURL(choice,browser),true);assert.equal(calls,1);assert.equal(syncChartURL(choice,browser),true);assert.equal(calls,1);assert.deepEqual(readChartURL(browser.location.href),choice);
 assert.equal(syncChartURL(choice,{get location(){throw Error('denied');}}),false);
 assert.equal(syncChartURL(choice,{location:{href:'http://localhost/'},history:{replaceState(){throw Error('denied');}}}),false);
});
test('chart preferences round trip only bounded UI choices and leave unrelated browser settings alone',()=>{
 const values=new Map([['atlas-theme','light']]),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 assert.equal(readChartPreferences(storage),null);assert.equal(saveChartPreferences(choice,storage),true);assert.deepEqual(readChartPreferences(storage),choice);assert.equal(values.get('atlas-theme'),'light');assert.equal(values.size,2);
 for(const source of ['history','minted'])for(const period of ['30d','90d','1y'])for(const comparison of ['amount','change'])assert(validateChartPreferences({...choice,source,period,comparison}));
});
test('corrupt, future, unsupported and oversized preferences fall back without saving arbitrary values',()=>{
 for(const raw of ['broken','null','[]','x'.repeat(1025),JSON.stringify({...choice,version:2}),JSON.stringify({...choice,coinId:'other'}),JSON.stringify({...choice,networkId:'../secret'}),JSON.stringify({...choice,networkId:'x'.repeat(65)}),JSON.stringify({...choice,source:'rpc'}),JSON.stringify({...choice,period:'24h'}),JSON.stringify({...choice,comparison:'unknown'}),JSON.stringify({...choice,token:'secret'})])assert.equal(readChartPreferences({getItem:()=>raw}),null);
 assert.equal(saveChartPreferences({...choice,amount:'123'},{setItem:()=>assert.fail('must not save')}),false);
});
test('unavailable or denied browser storage never prevents chart use',()=>{
 assert.equal(readChartPreferences({getItem:()=>{throw Error('denied');}}),null);assert.equal(saveChartPreferences(choice,{setItem:()=>{throw Error('quota');}}),false);
 const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage');try{Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('denied getter');}});assert.equal(readChartPreferences(),null);assert.equal(saveChartPreferences(choice),false);}finally{if(prior)Object.defineProperty(globalThis,'localStorage',prior);else delete globalThis.localStorage;}
});
