import test from 'node:test';
import assert from 'node:assert/strict';
import {priceLabel,validateFX,usableFX,readCurrency,saveCurrency} from './fx-model.js';
const at='2026-10-23T10:00:00.000Z',now=Date.parse(at),p={schemaVersion:1,kind:'ECB_REFERENCE_FX',base:'EUR',date:'2026-10-22',usdPerEUR:'2',krwPerEUR:'2000',sourceHash:'a'.repeat(64),fetchedAt:at,importedAt:null};
test('KRW reference conversion rounds bigint rational cents without changing the original USD amount',()=>{
 const amount='1.234567895';assert.equal(priceLabel(amount,'KRW',p,now),'₩1,234.57');assert.equal(priceLabel(amount,'USD'),'$1.2345679');assert.equal(amount,'1.234567895');assert.equal(priceLabel('0','KRW',p,now),'₩0.00');assert.equal(priceLabel('0.000005','KRW',p,now),'₩0.01');assert.equal(priceLabel('0.000004','KRW',p,now),'<₩0.01');assert.equal(priceLabel('0.000000000001','USD'),'<$0.00000001');
 assert.equal(priceLabel('9007199254740993.00001','KRW',p,now),'₩9,007,199,254,740,993,000.01');assert.equal(priceLabel('1','KRW',null,now),'—');assert.equal(priceLabel('1','KRW',{...p,date:'2026-10-14'},now),'—');assert(!usableFX({...p,date:'2026-10-24'},now));assert(usableFX(p,Date.parse('2026-10-29T23:59:59.999Z')));assert(!usableFX(p,Date.parse('2026-10-30T00:00:00.000Z')));
 for(const change of [{usdPerEUR:'0'},{krwPerEUR:2000},{base:'USD'},{fetchedAt:null},{importedAt:at}])assert.throws(()=>validateFX({...p,...change}));
});
test('currency URL overrides saved choices, survives storage denial and preserves chart query/hash/history state',()=>{
 const storage={getItem:()=> 'KRW'};assert.equal(readCurrency('http://localhost/?currency=USD',storage),'USD');assert.equal(readCurrency('http://localhost/',storage),'KRW');assert.equal(readCurrency('http://localhost/?currency=other',storage),'USD');assert.equal(readCurrency('http://localhost/?currency=KRW&currency=USD',storage),'USD');
 const browser={get localStorage(){throw Error('denied');},location:{href:'http://localhost/?coin=jpyc&period=90d#overview'},history:{state:{keep:true},replaceState(s,_,href){assert.deepEqual(s,{keep:true});browser.location.href=href;}}};saveCurrency('KRW',browser);assert.equal(new URL(browser.location.href).searchParams.get('coin'),'jpyc');assert.equal(new URL(browser.location.href).hash,'#overview');assert.equal(readCurrency(browser.location.href,storage),'KRW');
});
