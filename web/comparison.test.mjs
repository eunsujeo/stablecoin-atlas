import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceComparison} from './comparison-model.js';
import {sourceReviewProfiles,sourceFeaturesFor,sourceProfileKey} from './source-review-data.js';

test('source comparison preserves every profile feature and never joins scoped ids with different meanings',()=>{
  for(const profile of sourceReviewProfiles){
    const other=sourceReviewProfiles.find(p=>p.id!==profile.id);
    const result=sourceComparison([profile.id,other.id]);
    const actual=result.rows.flatMap(row=>row.cells[0]);
    assert.deepEqual(actual,sourceFeaturesFor(profile.coinId,sourceProfileKey(profile)));
    for(const row of result.rows)for(const cell of row.cells)for(const feature of cell){assert.equal(feature.label,row.label);assert.equal(feature.group,row.group);}
  }
  const result=sourceComparison(['usdc-base','usdc-solana']);
  for(const row of result.rows)if(row.cells.every(items=>items.length))assert.equal(row.cells[0][0].label,row.cells[1][0].label);
  assert.throws(()=>sourceComparison(['usdc-ethereum','usdc-ethereum']));
  assert.throws(()=>sourceComparison(['usdc-ethereum','missing']));
  assert.throws(()=>sourceComparison(['usdc-ethereum']));
});
