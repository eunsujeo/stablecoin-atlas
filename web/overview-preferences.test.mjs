import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChartPreferences,readChartPreferences,saveChartPreferences} from './overview-preferences.js';
const choice={version:1,coinId:'jpyc',networkId:'polygon',source:'minted',period:'90d',comparison:'change'};
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
