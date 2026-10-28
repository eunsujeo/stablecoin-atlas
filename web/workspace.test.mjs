import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,lstat,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setupWorkspace} from '../tools/workspace-setup.mjs';
import {workspaceEnvironment} from '../tools/workspace-env.mjs';
import {exportWorkspace,importWorkspace,transferNames,marketSources} from '../tools/workspace-transfer.mjs';
import {sources} from '../tools/evidence-build.mjs';
import {digest} from '../tools/evidence-store.mjs';
import {summarize} from '../src/domain/evaluator.ts';
import {validateAssessmentReportText} from '../src/report-contract.ts';
import {compilerCacheState} from '../tools/workspace-doctor.mjs';
const specimen=JSON.parse(await readFile(new URL('../tests/fixtures/report-v1.json',import.meta.url),'utf8'));
const registry=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url),'utf8'));
const at='2026-01-01T00:00:00Z';
async function temporary(run){const root=await mkdtemp(join(tmpdir(),'atlas-workspace-'));try{await run(root);}finally{await rm(root,{recursive:true,force:true});}}
test('compiler diagnostics distinguish absent, wrong and matching bytes without executing a cache file',()=>temporary(async root=>{
  const file=join(root,'compiler.cjs'),bytes=Buffer.from('throw new Error("This file must never execute during doctor");');
  assert.equal(await compilerCacheState(file,digest(bytes)),'MISSING');await writeFile(file,bytes);assert.equal(await compilerCacheState(file,'0'.repeat(64)),'INVALID_HASH');assert.equal(await compilerCacheState(file,digest(bytes)),'READY');assert.equal(await compilerCacheState(file,'invalid'),'PIN_INVALID');
}));
test('setup creates private empty configuration once and preserves existing files and symlinks',()=>temporary(async root=>{
  await writeFile(join(root,'.env.example'),'RPC_URL=\nARKM_API_KEY=\n');const url=pathToFileURL(root+'/');assert.equal(await setupWorkspace(url),'CREATED');if(process.platform!=='win32')assert.equal((await lstat(join(root,'.env.local'))).mode&0o777,0o600);
  const content='ARKM_API_KEY=synthetic-local-only-value\n';await writeFile(join(root,'.env.local'),content);assert.equal(await setupWorkspace(url),'PRESERVED');assert.equal(await readFile(join(root,'.env.local'),'utf8'),content);
  await rm(join(root,'.env.local'));await symlink(join(root,'.env.example'),join(root,'.env.local'));await assert.rejects(setupWorkspace(url));
}));
test('environment loading keeps inherited values, rejects unrelated settings, and does not expand shell expressions',()=>temporary(async root=>{
  const path=join(root,'.env.local');await writeFile(path,"ARKM_API_KEY='$(ignored-command)'\nRPC_URL=unused\nALLIUM_API_KEY=synthetic-allium-only\n");
  const inherited={RPC_URL:'',PATH:'inherited-path',HTTPS_PROXY:'sentinel-inherited',NO_PROXY:'sentinel-local'};
  const actual=await workspaceEnvironment(path,inherited);assert.equal(actual.ARKM_API_KEY,'$(ignored-command)');assert.equal(actual.ALLIUM_API_KEY,undefined);assert.equal((await workspaceEnvironment(path,{ALLIUM_API_KEY:'inherited-allium'})).ALLIUM_API_KEY,undefined);assert.equal(actual.RPC_URL,'');assert.equal(actual.PATH,inherited.PATH);assert.equal(actual.HTTPS_PROXY,inherited.HTTPS_PROXY);assert.equal(actual.NO_PROXY,inherited.NO_PROXY);assert.deepEqual(inherited,{RPC_URL:'',PATH:'inherited-path',HTTPS_PROXY:'sentinel-inherited',NO_PROXY:'sentinel-local'});
  await writeFile(path,'HTTPS_PROXY=ignored\n');await assert.rejects(workspaceEnvironment(path,inherited));await writeFile(path,'NODE_OPTIONS=ignored\n');await assert.rejects(workspaceEnvironment(path,inherited));
  await rm(path);assert.deepEqual(await workspaceEnvironment(path,inherited),inherited);
}));
async function makeReports(root){await mkdir(root,{recursive:true});for(const[file,scope,chain,network,asset,expected]of sources){
  if(scope==='LOCAL_FIXTURE'){
    const assessments=['StandardToken','NoReturnToken','FalseReturnToken','FeeToken','ZeroResetToken','PausableToken','BlacklistToken'].map((fixture,i)=>{const report=structuredClone(specimen);report.assessmentId='synthetic-local-'+i;report.mode='SIMULATION';return{fixture,report};});
    await writeFile(join(root,file),JSON.stringify({mode:'SIMULATION',assessments})+'\n');continue;
  }
  const report=structuredClone(specimen);report.assessmentId='synthetic-'+asset+'-'+chain;report.mode='READ_ONLY';const identity=report.assetIdentity;identity.chainFamily=chain;identity.networkId=network;
  if(chain==='EVM'||chain==='TRON')identity.contractAddress={status:'KNOWN',value:expected};
  else if(chain==='SOLANA'){identity.contractAddress={status:'NOT_APPLICABLE',reason:'Synthetic Solana specimen'};identity.mintAddress={status:'KNOWN',value:expected};}
  else{for(const key of ['contractAddress','mintAddress','tokenProgramId','decimals','implementationAddress'])identity[key]={status:'NOT_APPLICABLE',reason:'Synthetic XRPL specimen'};identity.issuer={status:'KNOWN',value:expected};identity.issuedCurrency={status:'KNOWN',value:registry.deployments.find(d=>d.identity.issuer===expected).identity.currency};}
  report.capabilitySummary=summarize(report);const text=JSON.stringify(report,null,1)+'\n';assert.equal(validateAssessmentReportText(text).valid,true,file);await writeFile(join(root,file),text);
 }
 const reports=[{kind:'TEST_MARKET_ONLY',observedAt:at,additionalRequests:[{endpoint:'/token/market/usd-coin',state:'SUCCESS',httpStatus:200,data:{circulatingSupply:'9007199254740993123456.123456',price:'1'}}]},{requests:[]},{observedAt:at,requests:[{endpoint:'/token/holders/usd-coin',state:'SUCCESS',httpStatus:200,data:{totalSupply:{ethereum:'123456789.123456',solana:'0'}}}]},{requests:[]},{kind:'XRPL_GATEWAY_OBLIGATIONS_RESEARCH_NOT_ASSESSMENT',ledgerHash:'A'.repeat(64),ledgerIndex:'42',observedAt:at,observations:[]}];
 for(let i=0;i<marketSources.length;i++)await writeFile(join(root,marketSources[i]),JSON.stringify(reports[i])+'\n');
}
test('fixed report transfer preserves original bytes and observations, never overwrites conflicts, and excludes environment files',()=>temporary(async root=>{
  const source=join(root,'source'),destination=join(root,'destination');await makeReports(source);await writeFile(join(source,'unlisted-report.json'),'not exported');await writeFile(join(root,'.env.local'),'ARKM_API_KEY=synthetic-private-local-value\n');
  const output=await exportWorkspace(source);assert.equal(output.files,14);assert.equal(output.reports,15);assert.equal(output.observations,4);if(process.platform!=='win32')assert.equal((await lstat(output.file)).mode&0o777,0o600);
  const bundle=JSON.parse(await readFile(output.file,'utf8'));assert.deepEqual(bundle.files.map(f=>f.name),transferNames);assert.ok(!JSON.stringify(bundle).includes('synthetic-private-local-value'));
  const imported=await importWorkspace(output.file,destination);assert.equal(imported.imported,14);for(const name of transferNames)assert.deepEqual(await readFile(join(destination,name)),await readFile(join(source,name)));
  const secretTarget=join(source,transferNames[0]),original=await readFile(secretTarget);const secretReport=JSON.parse(original);secretReport.note='synthetic-private-local-value';await writeFile(secretTarget,JSON.stringify(secretReport));await assert.rejects(exportWorkspace(source));await writeFile(secretTarget,original);
  assert.equal((await importWorkspace(output.file,destination)).preserved,14);
  const target=join(destination,transferNames[0]);await writeFile(target,'do not overwrite');await assert.rejects(importWorkspace(output.file,destination));assert.equal(await readFile(target,'utf8'),'do not overwrite');
}));
test('transfer rejects tampering, path injection, incomplete sets, secret metadata and symlink inputs before import',()=>temporary(async root=>{
  const source=join(root,'source');await makeReports(source);const output=await exportWorkspace(source),bundle=JSON.parse(await readFile(output.file,'utf8')),bad=join(root,'bad.json'),destination=join(root,'destination');
  for(const mutate of [b=>{b.files[0].sha256='0'.repeat(64);},b=>{b.files[0].name='../.env.local';},b=>{b.files.pop();},b=>{b.files[1]=b.files[0];},b=>{b.files[0].base64='%%%%';}]){const altered=structuredClone(bundle);mutate(altered);await writeFile(bad,JSON.stringify(altered));await assert.rejects(importWorkspace(bad,destination));}
  const altered=structuredClone(bundle),entry=altered.files[0],report=JSON.parse(Buffer.from(entry.base64,'base64'));report.apiKey='synthetic-credential';const bytes=Buffer.from(JSON.stringify(report));entry.base64=bytes.toString('base64');entry.sha256=digest(bytes);await writeFile(bad,JSON.stringify(altered));await assert.rejects(importWorkspace(bad,destination));await assert.rejects(lstat(destination),{code:'ENOENT'});
  await rm(join(source,transferNames[0]));await symlink(output.file,join(source,transferNames[0]));await assert.rejects(exportWorkspace(source));
}));
