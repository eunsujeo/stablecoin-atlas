import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { summarize } from '../src/domain/evaluator.ts';
import { buildEvidence } from '../tools/evidence-build.mjs';
import { digest, publishedIndex, publishedArtifact } from '../tools/evidence-store.mjs';
import { validateIndex, filterItems, comparisonRows, reportLinks } from './evidence-model.js';
const specimen=JSON.parse(await readFile(new URL('../tests/fixtures/report-v1.json',import.meta.url)));
specimen.assetIdentity.networkId='1';specimen.assetIdentity.contractAddress={status:'KNOWN',value:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'};
specimen.evidence=[{id:'e1',kind:'SYNTHETIC_ONLY',provenance:'OBSERVED',observedAt:specimen.startedAt,observedBlockOrSlot:'1',data:{balance:'9007199254740993123456'}}];
specimen.results=[{assessmentId:specimen.assessmentId,assetIdentity:structuredClone(specimen.assetIdentity),scenarioId:'SYNTHETIC',scenarioVersion:'1.0.0',capability:'BALANCE',support:'UNKNOWN',executionStatus:'COMPLETED',verdict:'PASS',evidenceReferences:['e1'],observedBlockOrSlot:'1',startedAt:specimen.startedAt,completedAt:specimen.completedAt,limitations:['Synthetic test only'],observations:{balance:'9007199254740993123456'}}];
specimen.capabilitySummary=summarize(specimen);
const bytes=Buffer.from(JSON.stringify(specimen));
const source=[['usdc-readonly.json','STORED_READ_ONLY','EVM','1','USDC','0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48']];
async function temporary(run){const path=await mkdtemp(join(tmpdir(),'evidence-test-'));try{await run(pathToFileURL(path+'/'));}finally{await rm(path,{recursive:true,force:true});}}
test('evidence publication preserves source bytes, links scenario/evidence IDs and serves only verified projections',async()=>temporary(async root=>{
 const report=JSON.parse(bytes);report.unreviewedEnvironment='OMITTED_ROOT_CANARY';const input=Buffer.from(JSON.stringify(report));
 const index=await buildEvidence({root,sourceList:source,readSource:async()=>input});assert.equal(index.reports.length,1);assert.equal(index.items.length,report.results.length);const r=index.reports[0];assert.equal(r.id,digest(input));assert.equal(r.sourceSha256,digest(input));assert.equal(r.hashKind,'ORIGINAL_BYTES');assert.deepEqual(await readFile(new URL(`sources/${digest(input)}.json`,root)),input);
 const projection=await publishedArtifact(r.id,'json',root),view=JSON.parse(projection);assert.equal(view.projection,'BOUNDED_ALLOWLIST_NOT_ORIGINAL_REPORT');assert.equal(view.report.unreviewedEnvironment,undefined);assert.ok(!projection.toString().includes('OMITTED_ROOT_CANARY'));assert.equal(view.report.results[0].verdict,report.results[0].verdict);assert.equal(view.report.results[0].support,report.results[0].support);
 const html=(await publishedArtifact(r.id,'html',root)).toString();assert.ok(html.includes(r.id));assert.ok(html.includes(report.results[0].scenarioId));assert.ok(!html.includes('OMITTED_ROOT_CANARY'));
 await writeFile(new URL(`artifacts/${r.viewSha256}.json`,root),'{}');await assert.rejects(publishedArtifact(r.id,'json',root),/HASH_MISMATCH/);await assert.rejects(publishedArtifact('../private','json',root));
}));
test('failed/missing/secret/invalid inputs never replace the prior index and failures are recorded without data leakage',async()=>temporary(async root=>{
 await buildEvidence({root,sourceList:source,readSource:async()=>bytes});const before=await readFile(new URL('index.json',root));
 for(const change of [r=>{r.results[0].evidenceReferences=['missing'];},r=>{r.evidence[0].data={privateKey:'SECRET_CANARY'};},r=>{r.evidence[0].data={message:'https://private.invalid/SECRET_CANARY'};},r=>{r.assetIdentity.networkId='999';}]){
  const r=JSON.parse(bytes);change(r);await assert.rejects(buildEvidence({root,sourceList:source,readSource:async()=>Buffer.from(JSON.stringify(r))}),/^Error: EVIDENCE_BUILD_FAILED$/);assert.deepEqual(await readFile(new URL('index.json',root)),before);assert.equal((await publishedIndex(root)).index.lastBuild.state,'FAILED');assert.ok(!(await readFile(new URL('last-build.json',root),'utf8')).includes('SECRET_CANARY'));
 }
 await assert.rejects(buildEvidence({root,sourceList:source,readSource:async()=>{throw new Error('missing');}}));assert.deepEqual(await readFile(new URL('index.json',root)),before);
}));
test('distinct executions of the same scenario remain separate and comparison preserves missing/unsupported/not-tested semantics',async()=>temporary(async root=>{
 const first=await buildEvidence({root,sourceList:source,readSource:async()=>bytes});const altered=JSON.parse(bytes);altered.limitations.push('Additional stored run context.');const second=await buildEvidence({root,sourceList:source,readSource:async()=>Buffer.from(JSON.stringify(altered))});
 assert.equal(second.reports.length,2);assert.equal(second.items.length,first.items.length*2);assert.equal(new Set(second.items.map(i=>i.key)).size,second.items.length);validateIndex(second);assert.equal(filterItems(second,{reportId:first.reports[0].id}).length,first.items.length);
 const rows=comparisonRows(second,second.reports.map(r=>r.id));assert.ok(rows.length);assert.deepEqual(rows[0].cells[0].map(s=>s.verdict),rows[0].cells[1].map(s=>s.verdict));assert.throws(()=>comparisonRows(second,[first.reports[0].id,first.reports[0].id]));assert.throws(()=>reportLinks('../../.env'));
 const missing=structuredClone(second);missing.items=missing.items.filter(s=>s.reportId!==missing.reports[1].id||s.capability!==rows[0].capability);assert.equal(comparisonRows(missing,missing.reports.map(r=>r.id))[0].cells[1].length,0);
}));
test('embedded local reports preserve parent-byte and reserialized-child hashes without authenticating the lab envelope',async()=>temporary(async root=>{
 const lab={mode:'SIMULATION',assessments:['StandardToken','NoReturnToken','FalseReturnToken','FeeToken','ZeroResetToken','PausableToken','BlacklistToken'].map((fixture,i)=>{const r=structuredClone(specimen);r.mode='SIMULATION';r.assessmentId='synthetic-fixture-'+i;r.assetIdentity.networkId='31337';for(const s of r.results){s.assessmentId=r.assessmentId;s.assetIdentity=structuredClone(r.assetIdentity);s.verdict=i===2?'FAIL':i===3?'INCONCLUSIVE':'PASS';}r.capabilitySummary=summarize(r);return {fixture,report:r};})};const input=Buffer.from(JSON.stringify(lab));
 const index=await buildEvidence({root,sourceList:[['dashboard-local-validation.json','LOCAL_FIXTURE','EVM','31337',null,null]],readSource:async()=>input});
 assert.equal(index.reports.length,7);assert.equal(index.items.length,7);
 for(const [i,r]of index.reports.entries()){assert.equal(r.scope,'LOCAL_FIXTURE');assert.equal(r.sourceSha256,digest(input));assert.equal(r.selector,`$.assessments[${i}].report`);assert.equal(r.hashKind,'RESERIALIZED_EMBEDDED_REPORT');assert.equal(r.id,digest(Buffer.from(JSON.stringify(lab.assessments[i].report))));}
 assert.ok(index.items.some(i=>i.verdict==='FAIL'));assert.ok(index.items.some(i=>i.verdict==='INCONCLUSIVE'));
}));
test('publication failure after new artifact creation does not publish partial items or discard earlier runs',async()=>temporary(async root=>{
 await buildEvidence({root,sourceList:source,readSource:async()=>bytes});const before=await readFile(new URL('index.json',root));const changed=JSON.parse(bytes);changed.limitations.push('new-generation-before-failure');let reads=0;
 await assert.rejects(buildEvidence({root,sourceList:[...source,...source],readSource:async()=>{if(reads++)throw new Error('input missing');return Buffer.from(JSON.stringify(changed));}}));
 assert.deepEqual(await readFile(new URL('index.json',root)),before);assert.equal((await publishedIndex(root)).index.reports.length,1);
}));
test('HTTP evidence routes expose documents/projections only, verify hashes, and never expose preserved source snapshots',async()=>temporary(async root=>{
 const {startPreviewServer}=await import('../tools/ui-preview.mjs');const index=await buildEvidence({root,sourceList:source,readSource:async()=>bytes});const r=index.reports[0],server=await startPreviewServer(0,{evidenceDirectory:root}),base=`http://127.0.0.1:${server.address().port}`;
 try{
  const response=await fetch(base+'/evidence/index.json');assert.equal(response.status,200);assert.equal((await response.json()).items.length,index.items.length);
  for(const extension of ['json','html']){const url=base+`/evidence/${r.id}.${extension}`,get=await fetch(url),head=await fetch(url,{method:'HEAD'});assert.equal(get.status,200);assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(get.headers.get('content-length'),head.headers.get('content-length'));}
  assert.equal((await fetch(base+`/evidence/sources/${r.sourceSha256}.json`)).status,404);assert.equal((await fetch(base+`/reports/dashboard-evidence/sources/${r.sourceSha256}.json`)).status,404);
  assert.equal((await fetch(base+'/evidence/index.json',{method:'POST'})).status,405);assert.equal((await fetch(base+'/evidence/index.json',{headers:{origin:'https://evil.invalid'}})).status,403);
  await writeFile(new URL(`artifacts/${r.documentSha256}.html`,root),'tampered');const broken=await fetch(base+`/evidence/${r.id}.html`);assert.equal(broken.status,503);assert.equal(await broken.text(),'EVIDENCE_UNAVAILABLE');
 }finally{server.closeIdleConnections();await new Promise(resolve=>server.close(resolve));}
}));
