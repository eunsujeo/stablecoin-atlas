import {test} from 'node:test';import assert from 'node:assert/strict';
import {fixture,id,addresses} from './wallet-flow-fixture.mjs';
import {analyze} from '../web/wallet-flow/model.mjs';
import {journeyContext} from '../web/wallet-flow/profiles.mjs';
test('address roles and repeated counterparties describe observed behavior without custody certainty',()=>{
 const {snapshot}=fixture(),r=analyze(snapshot),deposit=r.profiles.find(p=>p.address===addresses[1]),hub=r.profiles.find(p=>p.address===addresses[2]);
 assert.equal(deposit.role,'집금 후보');assert.equal(deposit.outgoingCount,2);assert.equal(deposit.counterparts.find(c=>c.address===addresses[2]).sentCount,2);
 assert.equal(hub.role,'배분·출금 운영 후보');assert.equal(hub.recipients,3);assert.equal(hub.hot.candidate,false);assert.equal(hub.custody,'UNKNOWN');assert.equal(hub.ownership,'UNKNOWN');
 assert.equal(hub.incomingRaw,'300000000');assert.equal(hub.outgoingRaw,'300000000');assert.equal(hub.repeatedAmounts[0].amountRaw,'50000000');assert.equal(hub.repeatedAmounts[0].events.length,2);
 assert.equal(hub.bins.reduce((n,b)=>n+b.incoming+b.outgoing,0),5);assert.equal(new Set(hub.bins.flatMap(b=>b.txids)).size,5);
 assert(!deposit.history.some(e=>e.txid===id(11)));assert(!deposit.history.some(e=>e.kind.startsWith('RESOURCE')));
});
test('bursty hot activity requires distinct transactions and destinations, not many logs in one transaction',()=>{
 const {snapshot}=fixture(),base=snapshot.events.find(e=>e.txid===id(7)),t=snapshot.transactions.find(t=>t.txid===id(7));
 for(let i=0;i<12;i++){const txid=id(100+i);snapshot.transactions.push({...t,txid,blockNumber:t.blockNumber+i+1,timestamp:t.timestamp+i*60000});snapshot.events.push({...base,txid,id:txid+':log:0',to:addresses[i%5]});}
 const p=analyze(snapshot).profiles.find(p=>p.address===addresses[2]);assert(p.hot.candidate);assert.equal(p.custody,'UNKNOWN');
 const copy=structuredClone(snapshot);copy.events=copy.events.map((e,i)=>e.txid.startsWith('0'.repeat(60))&&Number.parseInt(e.txid,16)>=100?{...e,txid:t.txid,id:t.txid+':log:'+i}:e);
 assert.equal(analyze(copy).profiles.find(p=>p.address===addresses[2]).hot.candidate,false);
});
test('missing history, null balance, and inactivity never assert cold storage',()=>{
 const {snapshot}=fixture();snapshot.events=[];const p=analyze(snapshot).profiles[0];assert.equal(p.first,null);assert.equal(p.role,'역할 근거 부족');assert.equal(p.custody,'UNKNOWN');assert.equal(p.hot.candidate,false);assert.deepEqual(p.bins,[]);
});
test('exchange names are transaction-scoped user context and cannot spread to adjacent addresses',()=>{
 const deposit={txid:'f00dd1d241084eb64c24a137f4f133277f6448c3edcd2352d20bba77bc2cd02e',from:'TDB1RpAHPQdGqfb1qi8J2jLY2oGe2jSy8A',to:'TSnLPAuoyCRYgyNZ484EvZEvS1UudS86E9'};
 assert.equal(journeyContext(deposit).basis,'USER_PROVIDED');assert.equal(journeyContext({...deposit,to:addresses[0]}).basis,'ONCHAIN_ONLY');assert.equal(journeyContext({...deposit,txid:id(1)}).basis,'ONCHAIN_ONLY');
});
