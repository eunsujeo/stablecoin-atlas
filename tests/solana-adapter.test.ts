import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SolanaReadOnlyAdapter, solanaDeferred } from '../src/solana/adapter.js';
import { SOLANA_MAINNET_GENESIS as networkId, SOLANA_STABLECOIN_MINTS as profiles, LEGACY_TOKEN_PROGRAM } from '../src/research/solana-mint-readonly.js';
import { verifyReadOnlyAdapterContract } from './helpers/read-only-adapter-contract.js';
import { assertSerializedReport, assertReportContract } from './helpers/report-contract.js';
const secret='synthetic-solana-adapter-credential';
type Request={id:number;method:string;params:unknown[]};
async function withNode(run:(url:string,calls:Request[],set:(f:string)=>void)=>Promise<void>) {
  const calls:Request[]=[];let fault='';
  const server=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=String(chunk);const r=JSON.parse(raw) as Request;calls.push(r);
    if(fault==='http'){res.writeHead(403);res.end(secret);return;}
    if(fault==='rpc'){res.end(JSON.stringify({jsonrpc:'2.0',id:r.id,error:{code:-32000,message:secret,data:{url:secret}}}));return;}
    let result:unknown;
    if(r.method==='getGenesisHash')result=fault==='network'?'1'.repeat(32):networkId;
    else{
      assert.equal(r.method,'getMultipleAccounts');assert.equal(r.id,2);
      const mints=r.params[0] as string[];assert.equal(mints.length,1);assert(profiles.some(p=>p.mint===mints[0]));
      assert.deepEqual(r.params[1],{commitment:'finalized',encoding:'base64'});
      const b=Buffer.alloc(82);b.writeUInt32LE(1,0);b.fill(1,4,36);b[44]=6;b[45]=fault==='uninitialized'?0:1;
      b.writeBigUInt64LE(mints[0]===profiles[0].mint?9007199254740993n:18446744073709551615n,36);
      if(fault==='tag')b.writeUInt32LE(2,46);
      const account={owner:fault==='owner'?'1'.repeat(32):LEGACY_TOKEN_PROGRAM,executable:false,space:82,
        data:[b.toString('base64'),fault==='encoding'?'base64+zstd':'base64'],unexpected:secret};
      result={context:{slot:fault==='slot'?9007199254740992:123456789},value:fault==='count'?[]:fault==='null'?[null]:[account]};
    }
    res.end(JSON.stringify({jsonrpc:'2.0',id:fault==='id'?999:r.id,result,unexpected:secret}));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const a=server.address();assert(a&&typeof a!=='string');
  try{await run(`http://127.0.0.1:${a.port}/?token=${secret}`,calls,f=>{fault=f;calls.length=0;});}
  finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test('Solana common Adapter contract: single selected mint, concurrent isolation, exact supply, rejected inputs and recovery',async()=>{
  await withNode(async(url,calls)=>{
    const requests=profiles.map(p=>({networkId,assetAddress:p.mint}));
    const reports=await verifyReadOnlyAdapterContract({adapter:new SolanaReadOnlyAdapter(url),requests,
      invalidRequests:[{networkId:'1',assetAddress:profiles[0].mint},{networkId,assetAddress:'invalid'},
        {...requests[0]!,accountAddress:''}],unexecuted:solanaDeferred.map(([scenarioId,capability])=>({scenarioId,capability})),
      verifyObservation(report,i){
        assert.deepEqual(report.assetIdentity.mintAddress,{status:'KNOWN',value:profiles[i]!.mint});
        assert.deepEqual(report.assetIdentity.tokenProgramId,{status:'KNOWN',value:LEGACY_TOKEN_PROGRAM});
        assert.equal(report.assetIdentity.observedBlockOrSlot,'123456789');assert.equal(report.assetIdentity.symbol.status,'UNKNOWN');
        assert.equal(report.assetIdentity.contractAddress.status,'NOT_APPLICABLE');
        assert.equal(report.results.find(r=>r.capability==='SUPPLY_TRACKING')!.observations.supplyRaw,i===0?'9007199254740993':'18446744073709551615');
        assert(report.results.every(r=>r.support==='UNKNOWN'&&r.verdict!=='PASS'&&r.verdict!=='FAIL'));
        assert.equal(report.results.find(r=>r.capability==='ALLOWANCE')!.verdict,'NOT_APPLICABLE');
        assert.equal(report.results.find(r=>r.capability==='DELEGATION')!.verdict,'NOT_TESTED');
        assert(!JSON.stringify(report).includes(secret));assert(!JSON.stringify(report).includes('SOLANA_MINT_RESEARCH_NOT_ASSESSMENT'));
      }});
    assert.equal(calls.length,6);assert.equal(calls.filter(c=>c.method==='getMultipleAccounts').length,3);
    assert(calls.every(c=>['getGenesisHash','getMultipleAccounts'].includes(c.method)));
    reports[0]!.evidence[0]!.data={mutated:true};assert(!JSON.stringify(reports[1]).includes('mutated'));
  });
});
test('all failed Solana assessments keep Report1.0 contract, correct not-executed stages, unknown identity and safe evidence',async()=>{
  await withNode(async(url,calls,set)=>{
    const adapter=new SolanaReadOnlyAdapter(url),request={networkId,assetAddress:profiles[0].mint};
    for(const fault of ['network','http','rpc','id','slot','count','null','owner','encoding','uninitialized','tag']){
      set(fault);const r=await adapter.assessReadOnly(request);assertSerializedReport(r);
      assert(r.results.every(x=>x.verdict!=='PASS'&&x.verdict!=='FAIL'&&x.support==='UNKNOWN'));
      assert.equal(r.assetIdentity.mintAddress.status,'UNKNOWN');assert.equal(r.assetIdentity.decimals.status,'UNKNOWN');
      assert(!JSON.stringify(r).includes(secret));
      const supply=r.results.find(x=>x.capability==='SUPPLY_TRACKING')!;
      if(['network','http','rpc','id'].includes(fault)){
        assert.equal(calls.length,1);assert.equal(supply.executionStatus,'NOT_EXECUTED');assert.equal(supply.verdict,'NOT_TESTED');
        assert.equal(r.assetIdentity.observedBlockOrSlot,'UNKNOWN');
      }else assert.equal(supply.verdict,'INCONCLUSIVE');
      if(['http','rpc','id','slot','count','tag'].includes(fault))assert.equal(r.results[0]!.executionStatus,'ERROR');
      set('');assertSerializedReport(await adapter.assessReadOnly(request));
    }
  });
});
function cli(url:string,args:string[]){return new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{
  const c=spawn(process.execPath,['--use-env-proxy','--import','tsx','src/cli.ts','assess','--chain','solana',...args],
    {env:{...process.env,SOLANA_RPC_URL:url},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';c.stdout.on('data',d=>{stdout+=String(d);});c.stderr.on('data',d=>{stderr+=String(d);});
  c.on('error',reject);c.on('close',code=>resolve({code,stdout,stderr}));
});}
test('assess Solana CLI normalizes mainnet-beta, produces shared JSON/stdout or private output and rejects unsupported options before RPC',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'solana-adapter-')),out=join(dir,'report.json');
  try{await withNode(async(url,calls,set)=>{
    const args=['--network','mainnet-beta','--token',profiles[1].mint];
    const stdout=await cli(url,args);assert.equal(stdout.code,0,stdout.stderr);const r=JSON.parse(stdout.stdout);assertReportContract(r);
    assert.equal(r.assetIdentity.networkId,networkId);assert.equal(r.assetIdentity.chainFamily,'SOLANA');
    const saved=await cli(url,[...args,'--out',out]);assert.equal(saved.code,0,saved.stderr);assert.equal(saved.stdout,'');
    assert.equal((await stat(out)).mode&0o777,0o600);assertReportContract(JSON.parse(await readFile(out,'utf8')));
    for(const invalid of [['--holder',''],['--spender',''],['--profile',''],['--network','0'],['--token',secret]]){
      await writeFile(out,'preserve-me');set('');const failed=await cli(url,[...args,...invalid,'--out',out]);
      assert.equal(failed.code,1,JSON.stringify(invalid));assert.equal(calls.length,0);
      assert.equal(await readFile(out,'utf8'),'preserve-me');assert(!(failed.stdout+failed.stderr).includes(secret));
    }
    set('http');const inconclusive=await cli(url,[...args,'--out',out]);assert.equal(inconclusive.code,0);
    const failedReport=JSON.parse(await readFile(out,'utf8'));assertReportContract(failedReport);
    assert.equal(failedReport.results[0]!.executionStatus,'ERROR');assert.equal(failedReport.results[0]!.verdict,'INCONCLUSIVE');
    assert(!(JSON.stringify(failedReport)+inconclusive.stderr).includes(secret));
  });}finally{await rm(dir,{recursive:true,force:true});}
});
