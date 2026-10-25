import test from 'node:test';
import assert from 'node:assert/strict';
import {withValidationBatch,prefetchValidation} from '../tools/market-db/validation-batch.mjs';

test('snapshot validation batch preserves bound values, result aliases/order/null/empty rows and consumes results once',async()=>{
  const calls=[],role="reader' $1; PRIVATE_CANARY",statements=['SELECT $1::text AS role','SELECT 1 AS value WHERE false'];
  const client={query:async(sql,values)=>{calls.push({sql,values});return calls.length===1?{rows:[{q0:[{role,flag:false,value:null,id:'9007199254740993',oid:4294967295}],q1:[]}]}:{rows:[{again:true}],rowCount:1};}};
  let retained;
  await withValidationBatch(client,async scoped=>{
    retained=scoped;await prefetchValidation(scoped,statements,[role]);
    assert.equal(calls.length,1);assert.equal(calls[0].sql.includes(role),false);assert.deepEqual(calls[0].values,[role]);
    const first=await scoped.query(statements[0],[role]);assert.equal(first.rowCount,1);assert.equal(first.rows[0].id,'9007199254740993');assert.equal(first.rows[0].oid,4294967295);assert.equal(first.rows[0].value,null);
    assert.deepEqual(await scoped.query(statements[1],[role]),{rows:[],rowCount:0});
    assert.deepEqual((await scoped.query(statements[0],[role])).rows,[{again:true}]);
  });
  await assert.rejects(retained.query('SELECT 1'),/VALIDATION_BATCH_CLOSED/);
  await assert.rejects(prefetchValidation(retained,['SELECT 1']),/VALIDATION_BATCH_CLOSED/);
  assert.equal(calls.length,2);
});

test('standalone/writer path remains sequential; scoped results are never reused by a later snapshot',async()=>{
  let calls=0;const client={query:async()=>{calls++;return {rows:[{q0:[{value:calls}]}]};}};
  await prefetchValidation(client,['SELECT 1']);assert.equal(calls,0);
  await withValidationBatch(client,async original=>{assert.equal(original,client);await original.query('SELECT 1');},false);
  for(let i=2;i<=3;i++)await withValidationBatch(client,async scoped=>{await prefetchValidation(scoped,['SELECT 1']);assert.equal((await scoped.query('SELECT 1')).rows[0].value,i);});
  assert.equal(calls,3);
});

test('batch rejects unsafe types, missing results, invalid bindings and unconsumed results without retaining a usable facade',async()=>{
  for(const result of [{q0:[{id:9007199254740992}]},{q0:[{amount:0.5}]},{q0:null}]){
    await assert.rejects(withValidationBatch({query:async()=>({rows:[result]})},scoped=>prefetchValidation(scoped,['SELECT 1'])),/VALIDATION_BATCH_/);
  }
  const client={query:async()=>({rows:[{q0:[]}]})};
  for(const [statements,values]of [[['DELETE FROM x'],[]],[['SELECT 1; SELECT 2'],[]],[['SELECT $2'],['x']],[['SELECT $0'],[]],[['SELECT $1'],[1]]]){
    await assert.rejects(withValidationBatch(client,scoped=>prefetchValidation(scoped,statements,values)),/VALIDATION_BATCH_INVALID/);
  }
  let retained;
  await assert.rejects(withValidationBatch(client,async scoped=>{retained=scoped;await prefetchValidation(scoped,['SELECT 1']);}),/VALIDATION_BATCH_UNCONSUMED/);
  await assert.rejects(retained.query('SELECT 1'),/VALIDATION_BATCH_CLOSED/);
});

test('query errors escape the batch and invalidate its facade for transaction rollback',async()=>{
  const failure=Error('fixture-query-error');let retained;
  await assert.rejects(withValidationBatch({query:async()=>{throw failure;}},async scoped=>{retained=scoped;await prefetchValidation(scoped,['SELECT 1']);}),error=>error===failure);
  await assert.rejects(retained.query('SELECT 1'),/VALIDATION_BATCH_CLOSED/);
});
