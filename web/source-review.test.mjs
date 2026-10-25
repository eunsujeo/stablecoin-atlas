import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sourceReviewProfiles,sourceReviewFor} from './source-review-data.js';
import {sourceReviewNotes} from '../tools/source-review-notes.mjs';
import {startPreviewServer} from '../tools/ui-preview.mjs';
test('stored source profiles keep eight chain-specific deployments and their evidence limits',()=>{
  assert.equal(sourceReviewProfiles.length,8);
  assert.equal(new Set(sourceReviewProfiles.map(p=>p.coinId)).size,5);
  assert.equal(new Set(sourceReviewProfiles.map(p=>p.chainId+':'+p.address.toLowerCase())).size,8);
  assert(sourceReviewProfiles.every(p=>p.deploymentBinding==='UNKNOWN'&&p.reviewedAt==='2026-10-25'&&/^0x[0-9a-f]{40}$/i.test(p.address)));
  assert.equal(sourceReviewFor('usdc','137'),undefined);
  assert.equal(sourceReviewFor('jpyc','1').id,'jpyc-ethereum');
  assert.match(sourceReviewFor('usdc','1').bindingDetail,/전체 불일치/);
  assert.match(sourceReviewFor('usdt','1').observation,/INCONCLUSIVE/);
  assert.match(sourceReviewFor('jpyc','1').bindingDetail,/프록시만.*CONFIRMED.*구현체 연결 UNKNOWN/);
  for(const chainId of ['137','43114'])assert.match(sourceReviewFor('jpyc',chainId).bindingDetail,/Ethereum.*적용하지 않음/);
  assert.match(sourceReviewFor('jpyc','8217').bindingDetail,/부분 일치.*UNKNOWN/);
  assert.match(sourceReviewFor('jpysc','1').bindingDetail,/CALL_LIMIT.*DECLARATION_LIMIT/);
});
test('public notes match reviewed fields and expose neither archives nor live execution paths',async()=>{
  const html=await readFile(new URL('./source-review-notes.html',import.meta.url),'utf8');
  assert.equal(html,sourceReviewNotes());
  assert.equal((html.match(/배포 전체 연결: UNKNOWN/g)??[]).length,8);
  assert.doesNotMatch(html,/\.state|RPC_URL|DATABASE_URL|PRIVATE_KEY|api[_-]?key/i);
  const server=await startPreviewServer(0);const base=`http://127.0.0.1:${server.address().port}`;
  try{
    for(const path of ['/source-review.js','/source-review-data.js','/source-review.css','/source-review-notes.html'])assert.equal((await fetch(base+path)).status,200);
    assert.equal((await fetch(base+'/source-review-notes.html',{method:'POST'})).status,405);
    assert.equal((await fetch(base+'/docs/research/2026-10-25-token-review-source-summary.md')).status,404);
    assert.equal((await fetch(base+'/.state/')).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
