import test from 'node:test';import assert from 'node:assert/strict';
import {slotState} from '../experiments/blockchain-knowledge/lessons.mjs';
import {transactionDetail} from '../experiments/blockchain-knowledge/transactions.mjs';
const tx=(t,scenario='normal')=>slotState(t,scenario).transactions;
test('signed examples arrive at two nodes at different times; no shared global pool',()=>{
 assert(tx(0).items.every(q=>q.status==='broadcast'&&!q.observedByA&&!q.observedByB));const a=tx(.5).items[0];assert(a.observedByA&&!a.observedByB);assert.equal(a.status,'pending');assert(tx(2).items.every(q=>q.observedByA&&q.observedByB));
});
test('selection, ordered execution, receipt and inclusion are different transitions',()=>{
 assert.equal(tx(4.4).items[0].status,'selected');assert.equal(tx(4.4).items[0].receipt,null);
 assert.equal(tx(4.8).items[0].status,'executed');assert.equal(tx(4.8).items[1].executed,false);assert.equal(tx(5.2).items[1].executed,true);assert.equal(tx(5.2).items[2].executed,false);
 assert.equal(tx(5.6).items[2].receipt.status,0);assert.equal(tx(5.6).items[2].block,null);assert.equal(tx(5.7).active,'TX03');
 const s=tx(6);assert.deepEqual(s.blocks.find(b=>b.id==='B702').transactions,['TX01','TX02','TX03']);assert.equal(s.items[2].receipt.status,0);assert(s.items[2].receipt.gasCharged&&s.items[2].receipt.nonceConsumed);assert(s.items.every(q=>!q.finalized));assert.equal(s.included,3);assert.equal(s.pending,1);assert.equal(s.selected,0);
});
test('excluded transaction survives skipped slot and is reconsidered under changed block fee conditions',()=>{
 for(const t of [6,8,9,11.99,12]){const q=tx(t).items[3];assert(q.inPool);assert.equal(q.block,null);assert.equal(q.executed,false);}
 assert.equal(tx(9).items[3].status,'excluded');assert.equal(tx(12.5).items[3].status,'selected');assert.equal(tx(13).items[3].status,'executed');assert.equal(tx(14).items[3].block,'B703');assert.equal(slotState(14).blocks.find(b=>b.id==='B703').parent,'B702');assert.equal(tx(14).pending,0);
});
test('empty payload still produces valid example blocks and preserves skipped slot and numbering',()=>{
 for(const t of [0,2,6,9,12,14,24]){const s=slotState(t,'empty');assert.deepEqual(s.blocks,slotState(t).blocks);assert.equal(s.transactions.items.length,0);assert.equal(s.transactions.included,0);assert(s.transactions.blocks.filter(b=>b.id!=='B700').every(b=>b.transactions.length===0));}
 assert.throws(()=>slotState(0,'unknown'),/UNKNOWN_TX_SCENARIO/);
});
test('proposal precedes propagation and peer verification; verification is not finality',()=>{
 const b=t=>tx(t).blocks.find(b=>b.id==='B702');assert.equal(b(5.99),undefined);assert.match(b(6).validation,/제안됨/);assert.match(b(6.5).validation,/전파/);assert.match(b(7).validation,/재실행 확인.*미확정/);assert(tx(24).items.every(q=>!q.finalized));assert.match(transactionDetail(tx(6).items[2]).technical,/Receipt status 0/);
});
test('transaction states and payloads reconstruct exactly on rewind without leaking receipts or future inclusions',()=>{
 for(const scenario of ['normal','empty'])for(const t of [0,.5,4.3,4.8,5.6,6,6.3,9,12.5,13,14,24]){const a=slotState(t,scenario);slotState(24,scenario);slotState(0,scenario);assert.deepEqual(slotState(t,scenario),a);for(const q of a.transactions.items){if(q.block)assert(a.blocks.some(b=>b.id===q.block));if(!q.executed)assert.equal(q.receipt,null);}}
 const changed=tx(24);changed.items[0].receipt.status=0;assert.equal(tx(24).items[0].receipt.status,1);
});
