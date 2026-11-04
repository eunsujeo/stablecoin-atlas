import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,id} from './wallet-flow-fixture.mjs';
import {analyze} from '../web/wallet-flow/model.mjs';
import {elapsedLabel,coverageLabel} from '../web/wallet-flow/findings.mjs';
test('findings distinguish chronological forwarding, resource timing and pooled-address activity',()=>{
 const {snapshot}=fixture();const c=analyze(snapshot).findings.cases[0];
 assert.equal(c.delayMs,120000);assert.equal(c.sameAmount,true);assert.equal(c.firstForward.txid,id(3));
 assert.equal(c.resourceWindows[0].beforeMs,720000);assert.equal(c.resourceWindows[0].afterMs,60000);
 assert.equal(c.nextTransfers.length,3);assert.equal(c.nextTotalRaw,'300000000');assert.equal(c.nextRecipientCount,3);
 assert.equal(c.attribution,'NOT_ESTABLISHED');assert.equal(c.successor.incomingRaw,'300000000');
 assert.equal(c.timeline.length,4);assert.deepEqual(c.timeline.map(e=>e.txid),[id(2),id(1),id(3),id(4)]);
 assert.deepEqual(analyze(snapshot).findings,analyze(structuredClone(snapshot)).findings);
});
test('absence of later evidence remains absence, not zero-value forwarding or invented ownership',()=>{
 const {snapshot}=fixture();snapshot.events=snapshot.events.filter(e=>![id(3),id(6)].includes(e.txid));
 const c=analyze(snapshot).findings.cases[0];assert.equal(c.firstForward,null);assert.equal(c.delayMs,null);assert.equal(c.pattern,'NO_FORWARD_OBSERVED');assert.equal(c.successor,null);
 assert.equal(elapsedLabel(null),'미확인');assert.equal(elapsedLabel(336000),'5분 36초');assert.match(coverageLabel('not-collected'),/이력 미조회/);
});
test('large exact amounts and earlier hub events do not become post-receipt paths',()=>{
 const {snapshot}=fixture();const early=snapshot.events.find(e=>e.txid===id(7));snapshot.transactions.find(t=>t.txid===id(7)).timestamp-=3600000;snapshot.transactions.find(t=>t.txid===id(7)).blockNumber-=100;
 snapshot.events.find(e=>e.txid===id(8)).amountRaw='9007199254740993000000';
 const c=analyze(snapshot).findings.cases[0];assert.equal(c.priorContextCount,1);assert(!c.nextTransfers.some(e=>e.id===early.id));assert.equal(c.nextTotalRaw,'9007199254741193000000');
});
