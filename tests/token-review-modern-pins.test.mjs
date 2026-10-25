import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat,readdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {keccak256} from 'viem';
import {rlusdCompiler,jpyscCompiler,stageCachedCompiler,verifyCompilerBytes} from '../src/token-review/compiler-cache.mjs';
import {prepareInput,prepareSourceBundle,compilerProfile,compile} from '../src/token-review/compiler.ts';
import {analyzeSource} from '../src/token-review/semantic-analysis.ts';
import {compareRuntime} from '../src/token-review/runtime-comparison.ts';
import {reviewToken} from '../src/token-review/review.ts';
import {validateReviewReport} from '../src/token-review/report.ts';
const stagingRoot=await mkdtemp(join(tmpdir(),'review-modern-pins-'));
const key=process.platform==='win32'?'TEMP':'TMPDIR',previous=process.env[key];process.env[key]=stagingRoot;
after(async()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;await rm(stagingRoot,{recursive:true,force:true});});
function bundle(count,evmVersion='cancun'){
 const sources=Object.fromEntries(Array.from({length:count},(_,i)=>[`S${i}.sol`,{content:i?'pragma solidity ^0.8.0;':
  'pragma solidity ^0.8.0; contract Private {address public owner; mapping(address=>uint256) public balances; constructor(){owner=msg.sender;} modifier onlyOwner(){require(msg.sender==owner);_;} function mint(address to,uint256 amount) external onlyOwner {balances[to]+=amount;} function transfer(address to,uint256 amount) external returns(bool){require(balances[msg.sender]>=amount);balances[msg.sender]-=amount;balances[to]+=amount;return true;} function denied() external pure returns(bool){return false;} } contract Shadow {address public owner; function require(bool) internal pure {} function fake() external view {require(msg.sender==owner);}}'}]));
 return Buffer.from(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion,viaIR:true}}));
}
test('source count defaults remain 32; only exact new pins allow 35 and 41 including audit snapshots',()=>{
 assert.equal(Object.keys(prepareSourceBundle(bundle(32)).sources).length,32);
 for(const v of [undefined,'0.8.29','0.8.34','0.8.29+commit.ab55807c.WRONG','0.8.34+commit.80d5c536.WRONG','0.8.37+commit.arbitrary.Emscripten.clang'])assert.throws(()=>prepareInput(bundle(33),'S0.sol:Private',v),/SOURCE_COUNT_LIMIT/);
 for(const [p,count] of [[rlusdCompiler,35],[jpyscCompiler,41]]){
  assert.equal(Object.keys(prepareInput(bundle(count),'S0.sol:Private',p.version).input.sources).length,count);
  assert.equal(Object.keys(prepareSourceBundle(bundle(count),p.version).sources).length,count);
  assert.throws(()=>prepareInput(bundle(count+1),'S0.sol:Private',p.version),/SOURCE_COUNT_LIMIT/);
 }
});
for(const [p,count,evm] of [[rlusdCompiler,35,'cancun'],[jpyscCompiler,41,'osaka']]){
 test(`${p.id}: private staged compiler version, AST, writes and whole runtime`,async t=>{
  if(!await compilerProfile(p.version))return t.skip('Pinned compiler cache unavailable; no acquisition');
  const stage=await stageCachedCompiler(p.version);
  try{assert.equal((await stat(stage.path)).mode&511,384);verifyCompilerBytes(await readFile(stage.path),p.sha256);}finally{await stage.cleanup();}
  await assert.rejects(access(stage.path));
  const prepared=prepareInput(bundle(count,evm),'S0.sol:Private',p.version),r=await compile(prepared.input,prepared.file,prepared.contractName,p.version);
  assert.equal(r.compiler,p.version);assert(!r.errors.some(x=>x.severity==='error'));assert(r.selected.abi.some(x=>x.name==='mint'));
  assert.equal(Object.keys(r.sources).length,count);
  const graph=analyzeSource(prepared.input,r,prepared.file,prepared.contractName,()=> 'e');
  const mint=graph.entries.find(e=>e.name==='mint');assert(mint.conditions.some(c=>c.callerEqualityState?.name==='owner'));assert(mint.writes.some(w=>w.expression.includes('balances')));
  const shadow=analyzeSource(prepared.input,r,prepared.file,'Shadow',()=> 'e');
  assert(!shadow.entries.find(e=>e.name==='fake').conditions.some(c=>c.callerEqualityState?.name==='owner'));
  const wrongVersion=analyzeSource(prepared.input,{...r,compiler:p.version.replace('.Emscripten.clang','.WRONG')},prepared.file,prepared.contractName,()=> 'e');
  assert(!wrongVersion.entries.find(e=>e.name==='mint').conditions.some(c=>c.callerEqualityState?.name==='owner'));
  assert(graph.entries.find(e=>e.name==='denied').behaviors.some(b=>b.pattern==='FALSE_RETURN'));
  const runtime=r.selected.evm.deployedBytecode;assert.equal(compareRuntime(runtime,keccak256(`0x${runtime.object}`),{},p.version).matched,true);
  assert.equal(compareRuntime(runtime,keccak256('0x6000'),{},p.version).matched,false);
  assert.equal(compareRuntime(runtime,undefined,{},p.version).reason,'ADDRESS_NOT_OBSERVED');
 });
 test(`${p.id}: private offline review and same-version audit snapshot with zero fetch`,async t=>{
  if(!await compilerProfile(p.version))return t.skip('Pinned compiler cache unavailable; no acquisition');
  const dir=await mkdtemp(join(stagingRoot,'offline-')),original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('OFFLINE');};
  try{
   await writeFile(join(dir,'source.json'),bundle(count,evm));await writeFile(join(dir,'audit.txt'),'Private fixture document; no real audit.');
   const address='0x1111111111111111111111111111111111111111';
   await writeFile(join(dir,'config.json'),JSON.stringify({schemaVersion:'TokenReviewConfig1.1',network:{chainId:'31337'},token:{address},sources:[{address,contract:'S0.sol:Private',compilerVersion:p.version,inputFile:'source.json'}],audits:[{file:'audit.txt',sourceSnapshotFile:'source.json',compareToAddress:address}]}));
   const r=await reviewToken(join(dir,'config.json'),undefined,join(dir,'output'),{offline:true});validateReviewReport(r);
   assert.equal(r.sources[0].compilation,'SUCCEEDED');assert.equal(r.sources[0].compilerUsed,p.version);assert.equal(r.sources[0].binding.confirmation,'UNKNOWN');
   assert.equal(r.audits[0].sourceComparison.sourceMatch,'MATCH');assert.equal(r.audits[0].authenticity,'UNKNOWN');assert.equal(r.audits[0].deploymentMapping,'UNKNOWN');
   assert.equal(r.contracts.length,0);assert.equal(r.archive,null);assert.equal(calls,0);
  }finally{globalThis.fetch=original;await rm(dir,{recursive:true,force:true});}
 });
 test(`${p.id}: private import and timeout failures clean staged artifacts`,async t=>{
  if(!await compilerProfile(p.version))return t.skip('Pinned compiler cache unavailable; no acquisition');
  const prepared=prepareInput(bundle(1,evm),'S0.sol:Private',p.version);
  prepared.input.sources['S0.sol'].content='pragma solidity ^0.8.0; import "https://fixture.invalid/remote.sol"; contract Private {}';
  const r=await compile(prepared.input,prepared.file,prepared.contractName,p.version);assert(r.errors.some(e=>e.severity==='error'));assert.equal(r.selected,null);
  await assert.rejects(compile(prepared.input,prepared.file,prepared.contractName,p.version,{timeoutMs:1}),/COMPILER_PROCESS_FAILED/);
  assert(!(await readdir(stagingRoot)).some(x=>x.startsWith('token-review-solc-')));
 });
}
