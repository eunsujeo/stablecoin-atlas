import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, symlink, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { summarize } from '../src/domain/evaluator.js';
import type { AssessmentReport } from '../src/domain/model.js';
import { validateAssessmentReportText as validate, validateAssessmentReportFile, maxReportBytes } from '../src/report-contract.js';
import { validateReportShape } from './helpers/report-contract.js';
const secret='synthetic-report-key-and-value-credential';
function sample(verdict:'PASS'|'FAIL'='PASS'):AssessmentReport {
  const r=JSON.parse(readFileSync(new URL('./fixtures/report-v1.json',import.meta.url),'utf8')) as AssessmentReport;
  r.evidence=[{id:'e1',kind:'SYNTHETIC_ONLY',provenance:'OBSERVED',observedAt:r.startedAt,observedBlockOrSlot:'1',data:{}}];
  r.results=[{assessmentId:r.assessmentId,assetIdentity:structuredClone(r.assetIdentity),scenarioId:'SYNTHETIC',scenarioVersion:'1.0.0',
    capability:'BALANCE',support:'UNKNOWN',executionStatus:'COMPLETED',verdict,evidenceReferences:['e1'],observedBlockOrSlot:'1',
    startedAt:r.startedAt,completedAt:r.completedAt,limitations:['Synthetic specimen only'],observations:{balance:'9007199254740993123456'}}];
  r.capabilitySummary=summarize(r);return r;
}
const wire=(x:unknown)=>JSON.stringify(x);
function cli(args:string[],env:NodeJS.ProcessEnv=process.env){return new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{
  const c=spawn(process.execPath,['--use-env-proxy','--import','tsx','src/cli.ts','validate',...args],{env,stdio:['ignore','pipe','pipe']});
  const timeout=setTimeout(()=>{c.kill();reject(new Error('Validation CLI timeout'));},5000);
  let stdout='',stderr='';c.stdout.on('data',d=>{stdout+=String(d);});c.stderr.on('data',d=>{stderr+=String(d);});
  c.on('error',e=>{clearTimeout(timeout);reject(e);});c.on('close',code=>{clearTimeout(timeout);resolve({code,stdout,stderr});});
});}
test('offline wire validator accepts legitimate FAIL, additive/reordered data, and returns independent fixed semantic reasons',()=>{
  for(const verdict of ['PASS','FAIL'] as const){const r=sample(verdict);r.capabilitySummary.reverse();Object.assign(r,{future:{[secret]:secret}});
    r.results[0]!.assetIdentity=Object.fromEntries(Object.entries(r.assetIdentity).reverse()) as unknown as AssessmentReport['assetIdentity'];
    const result=validate(wire(r));assert.equal(result.valid,true);assert.deepEqual(result.issues,[]);assert(!wire(result).includes(secret));}
  const cases:[string,(r:AssessmentReport)=>void][]=[
    ['DUPLICATE_EVIDENCE_ID',r=>{r.evidence.push(structuredClone(r.evidence[0]!));}],
    ['DUPLICATE_SCENARIO_CAPABILITY',r=>{r.results.push(structuredClone(r.results[0]!));}],
    ['ASSESSMENT_ID_MISMATCH',r=>{r.results[0]!.assessmentId=secret;}],
    ['IDENTITY_MISMATCH',r=>{r.results[0]!.assetIdentity.networkId=secret;}],
    ['MISSING_EVIDENCE_REFERENCE',r=>{r.results[0]!.evidenceReferences=[secret];}],
    ['OBSERVED_EVIDENCE_REQUIRED',r=>{r.evidence[0]!.provenance='DOCUMENTED';}],
    ['TIME_ORDER_INVALID',r=>{r.completedAt='2000-01-01T00:00:00Z';}],
    ['INVALID_TIMESTAMP',r=>{r.evidence[0]!.observedAt='2026-99-99T00:00:00Z';}],
    ['CAPABILITY_SUMMARY_MISMATCH',r=>{r.capabilitySummary=[];}],
  ];
  for(const[expected,mutate]of cases){const r=sample();mutate(r);const result=validate(wire(r));assert.equal(result.valid,false,expected);assert(result.issues.some(e=>e.code===expected),wire(result));assert(!wire(result).includes(secret));}
});
test('Solana supplyRaw uses optional canonical decimal strings in schema, production validation and offline CLI',async()=>{
  // Mutated copies are synthetic contract specimens, never new on-chain observations.
  const path=new URL('../reports/solana-usdc-assessment-readonly.json',import.meta.url);
  const original=readFileSync(path,'utf8'),report=JSON.parse(original) as AssessmentReport;
  const supply=report.results.find(r=>r.scenarioId==='SOLANA-003')!.observations;
  for(const value of ['0','123','9007199254740993','18446744073709551615','18446744073709551616']){
    supply.supplyRaw=value;assert.equal(validateReportShape(report),true);assert.equal(validate(wire(report)).valid,true);
    assert.equal(supply.supplyRaw,value); // No coercion or precision loss; this is not a u64 range check.
  }
  const invalid=[0,123,9007199254740992,'1e6','01','-1','+1',' 1','1 ','1\n','\t1','1.0','',null,true,{},[]];
  for(const value of invalid){
    supply.supplyRaw=value;assert.equal(validateReportShape(report),false,wire(value));
    const result=validate(wire(report));assert.equal(result.valid,false,wire(value));
    assert.equal(result.issues[0]!.code,'SCHEMA_INVALID');assert.deepEqual(supply.supplyRaw,value);
  }
  delete supply.supplyRaw;Object.assign(supply,{futureSupplyFormat:{value:123}});
  assert.equal(validateReportShape(report),true);assert.equal(validate(wire(report)).valid,true);
  const dir=await mkdtemp(join(tmpdir(),'solana-supply-format-')),file=join(dir,'synthetic.json');
  try{
    for(const value of [123,'1e6','18446744073709551615']){
      supply.supplyRaw=value;const text=wire(report);await writeFile(file,text);
      const result=await cli(['--file',file]);assert.equal(result.code,typeof value==='string'&&value!=='1e6'?0:2,result.stderr);
      assert.equal(JSON.parse(result.stdout).valid,result.code===0);assert.equal(await readFile(file,'utf8'),text);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
  assert.equal(readFileSync(path,'utf8'),original);
});
test('JSON lexical boundary preserves strings/escapes, rejects duplicate decoded keys and enforces exact byte/depth limits',()=>{
  const r=sample();Object.assign(r,{future:{escaped:'"\\"'+secret+'['.repeat(500),array:[{id:'x'},{id:'y'}]}});
  assert.equal(validate(wire(r)).valid,true);
  assert.equal(validate('{"schemaVersion":"1.0","\\u0073chemaVersion":"1.0"}').issues[0]!.code,'DUPLICATE_JSON_KEY');
  assert.equal(validate('{"'+secret+'":1,"'+secret+'":2}').issues[0]!.code,'DUPLICATE_JSON_KEY');
  assert.equal(validate('{').issues[0]!.code,'INVALID_JSON');
  const text=wire(sample());const padded=text+' '.repeat(maxReportBytes-Buffer.byteLength(text));assert.equal(validate(padded).valid,true);
  assert.equal(validate(padded+' ').issues[0]!.code,'SIZE_LIMIT');
  const nest=(n:number)=>text.slice(0,-1)+',"future":'+'['.repeat(n)+'0'+']'.repeat(n)+'}';
  assert.equal(validate(nest(127)).valid,true);assert.equal(validate(nest(128)).issues[0]!.code,'DEPTH_LIMIT');
  let touched=0;const hostile=Object.defineProperty({toJSON(){touched++;}},'value',{get(){touched++;return secret;}});
  assert.equal(validate(hostile as unknown as string).issues[0]!.code,'INVALID_JSON');assert.equal(touched,0);
});
test('fixed diagnostic codes/locations never echo secret property names or cap unbounded semantic error output',()=>{
  const r=sample();Object.assign(r.assetIdentity,{[secret]:{[secret]:secret}});Object.assign(r.results[0]!.observations,{balance:secret});
  const shape=validate(wire(r));assert.equal(shape.valid,false);assert.equal(shape.issues[0]!.code,'SCHEMA_INVALID');assert(!wire(shape).includes(secret));
  const many=sample(),one=structuredClone(many.results[0]!);many.results=Array.from({length:100},(_,i)=>({...structuredClone(one),scenarioId:'S'+i,assessmentId:secret}));many.capabilitySummary=summarize(many);
  const result=validate(wire(many));assert.equal(result.issues.length,32);assert.equal(result.issueLimitReached,true);assert(!wire(result).includes(secret));
});
test('same-FD file validation is bounded, strict UTF8 and read-only; special inputs do not hang or follow final symlinks',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'report-file-')),file=join(dir,'report.json');
  try{
    const text=wire(sample('FAIL'));await writeFile(file,text);const before=createHash('sha256').update(await readFile(file)).digest('hex');
    assert.equal((await validateAssessmentReportFile(file)).valid,true);assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),before);
    const link=join(dir,'link.json');await symlink(file,link);await assert.rejects(validateAssessmentReportFile(link));
    const folder=join(dir,'folder');await mkdir(folder);await assert.rejects(validateAssessmentReportFile(folder));
    await writeFile(file,Buffer.from([0xc3,0x28]));assert.equal((await validateAssessmentReportFile(file)).issues[0]!.code,'INVALID_UTF8');
    await writeFile(file,Buffer.alloc(maxReportBytes+1,32));assert.equal((await validateAssessmentReportFile(file)).issues[0]!.code,'SIZE_LIMIT');
    const fifo=join(dir,'fifo');execFileSync('mkfifo',[fifo]);const special=await cli(['--file',fifo]);assert.equal(special.code,1);assert.equal(JSON.parse(special.stdout).issues[0].code,'FILE_INPUT_ERROR');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('validate CLI is offline, distinguishes valid FAIL/invalid JSON/input errors, rejects unknown or duplicate options and preserves input',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'report-cli-')),file=join(dir,secret+'.json');let requests=0;
  const server=createServer((_req,res)=>{requests++;res.end('{}');});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const a=server.address();assert(a&&typeof a!=='string');
  try{
    const url=`http://127.0.0.1:${a.port}/?token=${secret}`,env={...process.env,RPC_URL:url,TRON_RPC_URL:url,SOLANA_RPC_URL:url,XRPL_RPC_URL:url};
    const r=sample('FAIL');r.evidence[0]!.data={endpoint:url,[secret]:secret};const text=wire(r);await writeFile(file,text);
    const valid=await cli(['--file',file],env);assert.equal(valid.code,0,valid.stderr);assert.equal(JSON.parse(valid.stdout).valid,true);
    assert(!(valid.stdout+valid.stderr).includes(secret));assert.equal(await readFile(file,'utf8'),text);
    await writeFile(file,'{');const invalid=await cli(['--file',file],env);assert.equal(invalid.code,2);assert.equal(JSON.parse(invalid.stdout).issues[0].code,'INVALID_JSON');
    for(const args of [[],['--file',''],['--file',file,'--file',file],['--file',file,'--out',join(dir,'must-not-exist')],['--file',file,secret],['--file',file,'--chain',secret]]){
      const bad=await cli(args,env);assert.equal(bad.code,1);assert.equal(JSON.parse(bad.stdout).issues[0].code,'INVALID_OPTIONS');assert(!(bad.stdout+bad.stderr).includes(secret));
    }
    const missing=await cli(['--file',join(dir,'missing-'+secret)],env);assert.equal(missing.code,1);assert(!(missing.stdout+missing.stderr).includes(secret));
    assert.equal(await readFile(file,'utf8'),'{');assert.equal(requests,0);
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await rm(dir,{recursive:true,force:true});}
});
