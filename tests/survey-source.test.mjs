import test from 'node:test';import assert from 'node:assert/strict';
import {surveyFixture,surveyDto} from './survey-fixture.mjs';
import {surveySource} from '../tools/allium-survey-source.mjs';
import {validateStoredSurvey,validateSurveySnapshot,surveyRows,storedSurveyChoice} from '../web/survey-model.js';
import {supplyHash} from '../tools/allium-supply-source.mjs';
import {surveyArguments,main} from '../tools/market-db/survey-cli.mjs';
test('survey import binds raw, exact reviewed SQL, manifest, original receipt and fixed identities; preserves decimals/null/zero',async()=>{
 const f=await surveyFixture(),s=f.source();assert.equal(s.snapshot.rows.length,71);assert.equal(s.snapshot.rows.filter(r=>r.state==='OBSERVED').length,70);
 assert.equal(s.snapshot.rows[0].values.total_supply,'100.000000000000000001');assert.equal(s.snapshot.rows[0].values.circulating_supply,'0');assert.equal(s.snapshot.rows[0].values.adjusted_circulating_supply,null);
 assert(!JSON.stringify(s).includes('private-run'));assert.equal(s.snapshot.queriedAt,'2026-10-23T09:32:05.123456Z');
 for(const options of [{expectedHash:'0'.repeat(64)},{reviewHash:'0'.repeat(64)},{receiptBytes:Buffer.from('{}')},{kind:'registry'},{reviewBytes:Buffer.alloc(65537)}])assert.throws(()=>surveySource(f.bytes,{...f.options,...options}));
 for(const mutate of [m=>m.reviews[0].responseSqlHash='0'.repeat(64),m=>m.reviews[0].sourceHash='0'.repeat(64),m=>m.reviews[0].requestSqlHash='0'.repeat(64),m=>m.reviews[0].reviewStatus='PASS',m=>m.planHash='0'.repeat(64),m=>m.receiptHash='0'.repeat(64),m=>m.reviews.push(m.reviews[0])]){
  const m=JSON.parse(f.options.reviewBytes);mutate(m);const reviewBytes=Buffer.from(JSON.stringify(m));assert.throws(()=>surveySource(f.bytes,{...f.options,reviewBytes,reviewHash:supplyHash(reviewBytes)}));
 }
 for(const mutate of [p=>p.data[0].total_supply_str=2,p=>p.data[0].requested_address='wrong',p=>p.data.push(p.data[0]),p=>p.data=p.data.filter(r=>r.deployment_id!=='jpyc-kaia'),p=>p.data[0].provider_day='2026-10-23']){
  const bad=await surveyFixture({mutate});assert.throws(bad.source);
 }
});
test('survey display validates fixed snapshots, filters 77-day grid and distinguishes unmatched/missing/null/zero without leakage',async()=>{
 const dto=await surveyDto();dto.sql='private';dto.snapshots[0].secret='private';dto.snapshots[0].rows[0].secret='private';
 const safe=validateStoredSurvey(dto);assert(!JSON.stringify(safe).includes('private'));assert.equal(surveyRows(safe.snapshots[0]).length,77);
 const volume=safe.snapshots.find(s=>s.survey==='volume');assert.equal(surveyRows(volume).filter(r=>r.state==='OBSERVED').length,67);assert.equal(surveyRows(volume).filter(r=>r.state==='INCONCLUSIVE').length,7);assert.equal(surveyRows(volume).filter(r=>r.state==='MISSING').length,3);
 assert.equal(surveyRows(volume,{network:'solana'}).length,14);assert.equal(surveyRows(volume,{coin:'jpyc',network:'kaia'}).length,7);assert.throws(()=>surveyRows(volume,{network:'xrpl'}));
 for(const mutate of [p=>p.rows.push(p.rows[0]),p=>p.rows[0].values.total_supply=0,p=>p.rows[0].providerDay='2026-10-23',p=>p.deferred[0].state='PASS',p=>p.queriedAt='invalid',p=>p.rows[0].isNative=null]){const p=structuredClone(safe.snapshots[0]);mutate(p);assert.throws(()=>validateSurveySnapshot(p));}
 assert.deepEqual(storedSurveyChoice(safe,{status:'rejected'}),{data:safe,state:'LAST_GOOD'});assert.equal(storedSurveyChoice(null,{status:'rejected'}).state,'UNAVAILABLE');assert.equal(storedSurveyChoice(null,{status:'fulfilled',value:null}).state,'DISABLED');
 assert.throws(()=>validateStoredSurvey({...safe,snapshots:[safe.snapshots[0],safe.snapshots[0]]}));
});
test('offline CLI rejects incomplete approvals and unreviewed bytes before connecting',async()=>{
 for(const args of [['execute'],['read','--source','x'],['import','--source','x'],['init','--env-file','x','--env-file','y'],['grant','--role','x','--mode','owner']])assert.throws(()=>surveyArguments(args));
 assert.equal(surveyArguments(['read']).command,'read');await assert.rejects(main(['boundary','--reviewed-definers','missing']));
});
