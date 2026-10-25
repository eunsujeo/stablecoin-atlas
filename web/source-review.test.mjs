import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sourceReviewProfiles,sourceReviewFor,sourceFeatureCatalog,sourceFeaturesFor} from './source-review-data.js';
import {sourceReviewNotes} from '../tools/source-review-notes.mjs';
import {startPreviewServer} from '../tools/ui-preview.mjs';
test('stored source profiles keep eight chain-specific deployments and their evidence limits',()=>{
  assert.equal(sourceReviewProfiles.length,8);
  assert.equal(new Set(sourceReviewProfiles.map(p=>p.coinId)).size,5);
  assert.equal(new Set(sourceReviewProfiles.map(p=>p.chainId+':'+p.address.toLowerCase())).size,8);
  assert(sourceReviewProfiles.every(p=>p.deploymentBinding==='UNKNOWN'&&p.reviewedAt==='2026-10-25'&&/^0x[0-9a-f]{40}$/i.test(p.address)));
  assert(sourceReviewProfiles.every(p=>p.sourceReviewStatus==='SOURCE_REVIEWED'));
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

test('source capabilities distinguish a reviewed path absence from missing evidence and keep chain scope',()=>{
  assert.equal(sourceFeatureCatalog.length,14);
  const get=(coinId,featureId)=>sourceFeaturesFor(coinId,'1').find(f=>f.id===featureId);
  assert.equal(get('usdt','zeroReset').status,'PRESENT');
  for(const coin of ['usdc','rlusd','jpyc','jpysc'])assert.equal(get(coin,'zeroReset').status,'ABSENT_IN_REVIEWED_PATH');
  assert.equal(get('usdc','fee').status,'ABSENT_IN_REVIEWED_PATH');
  assert.equal(get('usdt','fee').status,'PRESENT');
  assert.equal(get('jpyc','fee').status,'NOT_REVIEWED');
  assert.equal(get('usdc','upgrade').status,'NOT_REVIEWED');
  assert.match(get('usdt','upgrade').detail,/deprecate.*UUPS/);
  for(const id of ['approve','revoke','zeroReset'])assert.match(get('usdt',id).detail,/deprecated=false.*local/);
  assert.match(get('rlusd','blocklist').detail,/pause.*blacklist/);
  for(const p of sourceReviewProfiles){
    const rows=sourceFeaturesFor(p.coinId,p.chainId);
    assert.equal(rows.length,14);assert.equal(new Set(rows.map(f=>f.id)).size,14);
    assert(rows.every(f=>f.profileId===p.id&&f.detail&&f.evidence&&['PRESENT','ABSENT_IN_REVIEWED_PATH','NOT_REVIEWED'].includes(f.status)));
  }
  assert.deepEqual(sourceFeaturesFor('usdc','137'),[]);assert.deepEqual(sourceFeaturesFor('jpyc','999'),[]);assert.deepEqual(sourceFeaturesFor('missing','1'),[]);
  const rows=sourceFeaturesFor('jpyc','8217');rows[0].status='ABSENT_IN_REVIEWED_PATH';
  assert.equal(sourceFeaturesFor('jpyc','8217')[0].status,'PRESENT');
});
