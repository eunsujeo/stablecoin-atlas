import test from 'node:test';import assert from 'node:assert/strict';
import {currentContractReviews} from '../web/contract-review-view.js';
import {reviewedContractStore} from '../web/contract-review-reviewed.js';
test('contract display selects one latest chain/address result independent of input order and keeps source judgments intact',()=>{
 const saved=JSON.stringify(reviewedContractStore),views=currentContractReviews(reviewedContractStore);
 assert.equal(views.length,1);assert.equal(views[0].id,'multicall3-ethereum-20261026-infura-v3');
 assert.equal(views[0].status,'UNKNOWN');assert.equal(views[0].runtime.equality,'PASS');
 assert.equal(views[0].presentation.label,'저장 소스 검토 완료');assert.equal(views[0].presentation.fixtures,'10 / 10');
 assert.equal(currentContractReviews({...reviewedContractStore,reports:[...reviewedContractStore.reports].reverse()})[0].id,views[0].id);
 assert.equal(JSON.stringify(reviewedContractStore),saved);
 const visible=JSON.stringify(views[0].sections);assert(!/최초 실패|TLS_FAILURE|v2 실패 출처|원래 실패 시도 시각|전체 상태/.test(visible));
 assert.match(visible,/NOT_RUN/);assert.match(visible,/UNKNOWN/);assert.match(visible,/NOT_TESTED/);assert.match(visible,/로컬 검토 범위/);
});
test('contract display resolves equal observation times with completion time then ID and never deduplicates different chains',()=>{
 const p=reviewedContractStore.reports[0],a=structuredClone(p),b=structuredClone(p);a.id+='-a';b.id+='-b';
 const make=reports=>({...reviewedContractStore,reports});
 assert.equal(currentContractReviews(make([a,b]))[0].id,b.id);assert.equal(currentContractReviews(make([b,a]))[0].id,b.id);
 a.runtime.endedAt='2026-10-26T08:40:40.000Z';assert.equal(currentContractReviews(make([b,a]))[0].id,a.id);
 b.chainId='2';assert.equal(currentContractReviews(make([a,b])).length,2);
});
test('contract display handles no runtime or missing local evidence without claiming observed code or fixture results',()=>{
 const p=structuredClone(reviewedContractStore.reports[1]);
 p.sections=p.sections.filter(s=>s.id!=='experiments');
 const views=currentContractReviews({...reviewedContractStore,reports:[p]});
 assert.equal(views.length,1);assert.equal(views[0].runtime,undefined);assert.equal(views[0].status,'UNKNOWN');
 assert.equal(views[0].presentation.label,'저장 검토 결과');assert.equal(views[0].presentation.fixtures,'미기록');
 assert.deepEqual(currentContractReviews({...reviewedContractStore,reports:[]}),[]);
});
