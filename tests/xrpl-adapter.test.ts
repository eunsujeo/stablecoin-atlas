import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { XrplReadOnlyAdapter, xrplDeferred } from '../src/xrpl/adapter.js';
import { EvmReadOnlyAdapter } from '../src/evm/adapter.js';
import { TronReadOnlyAdapter } from '../src/tron/adapter.js';
import { SolanaReadOnlyAdapter } from '../src/solana/adapter.js';
import { XRPL_STABLECOIN_ISSUERS as profiles } from '../src/research/xrpl-issuer-readonly.js';
import { verifyReadOnlyAdapterContract } from './helpers/read-only-adapter-contract.js';
import { assertSerializedReport, assertReportContract, validateReportShape } from './helpers/report-contract.js';
const hash='AB'.repeat(32),secret='synthetic-xrpl-adapter-credential';
type Request={method:string;params:Record<string,unknown>[]};
async function withNode(run:(url:string,calls:Request[],set:(f:string)=>void)=>Promise<void>){
  const calls:Request[]=[];let fault='';
  const server=createServer(async(req,res)=>{
    let raw='';for await(const c of req)raw+=String(c);const r=JSON.parse(raw) as Request;calls.push(r);const p=r.params[0]!;
    assert.equal(p.api_version,2);
    if(fault==='http'){res.writeHead(403);res.end(secret);return;}
    let result:Record<string,unknown>={status:'success'};
    if(r.method==='server_info'){assert.deepEqual(p,{api_version:2});result.info=fault==='network-missing'?{}:{network_id:fault==='network'?1:0,secret};}
    else if(r.method==='ledger'){
      assert.deepEqual(p,{api_version:2,ledger_index:'validated',transactions:false,expand:false});
      result={...result,validated:fault!=='ledger-unvalidated',ledger_hash:hash,ledger_index:123456789,
        ledger:{closed:true,ledger_hash:fault==='ledger-hash'?'CD'.repeat(32):hash,ledger_index:'123456789'}};
    }else{
      assert.equal(r.method,'account_info');assert(profiles.some(x=>x.issuer===p.account));
      assert.deepEqual(p,{api_version:2,account:p.account,ledger_hash:hash,strict:true});
      if(fault==='account-rpc')result={status:'error',error_code:19,error:'actNotFound',error_message:secret};
      else result={...result,validated:fault!=='account-unvalidated',ledger_hash:fault==='account-hash'?'CD'.repeat(32):hash,
        ledger_index:fault==='account-index'?123456788:123456789,account_data:{
          Account:fault==='issuer'?'wrong':p.account,LedgerEntryType:fault==='type'?'RippleState':'AccountRoot',
          Flags:fault==='flags'?'4294967295':p.account===profiles[0].issuer?0:4294967295,Balance:secret,Domain:secret}};
    }
    res.end(JSON.stringify({result,unexpected:secret}));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const a=server.address();assert(a&&typeof a!=='string');
  try{await run(`http://127.0.0.1:${a.port}/?token=${secret}`,calls,f=>{fault=f;calls.length=0;});}
  finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test('XRPL common Adapter contract preserves currency+issuer, single issuer/3calls, concurrent isolation and recovery',async()=>{
  await withNode(async(url,calls)=>{
    const requests=profiles.map(p=>({networkId:'0',assetAddress:p.issuer,currencyCode:p.currency}));
    const reports=await verifyReadOnlyAdapterContract({adapter:new XrplReadOnlyAdapter(url),requests,
      invalidRequests:[{...requests[0]!,networkId:'mainnet'},{...requests[0]!,currencyCode:''},{...requests[0]!,currencyCode:profiles[1].currency},
        {networkId:'0',assetAddress:profiles[0].issuer},{...requests[0]!,accountAddress:''}],
      unexecuted:xrplDeferred.map(([scenarioId,capability])=>({scenarioId,capability})),
      verifyObservation(r,i){
        assert.deepEqual(r.assetIdentity.issuedCurrency,{status:'KNOWN',value:profiles[i]!.currency});
        assert.deepEqual(r.assetIdentity.issuer,{status:'KNOWN',value:profiles[i]!.issuer});
        for(const k of ['contractAddress','mintAddress','tokenProgramId','decimals','implementationAddress'] as const)assert.equal(r.assetIdentity[k].status,'NOT_APPLICABLE');
        assert.equal(r.assetIdentity.symbol.status,'UNKNOWN');assert.equal(r.assetIdentity.issuerVerificationStatus,'UNKNOWN');
        assert.equal(r.results.find(x=>x.scenarioId==='XRPL-002')!.observations.ledgerHash,hash);
        const read=r.evidence.find(e=>e.kind==='XRPL_ISSUER_READ_RESULT')!.data as {account:{accountRoot:{flags:{flagsRaw:string}}}};
        assert.equal(read.account.accountRoot.flags.flagsRaw,i===0?'0':'4294967295');
        assert(r.results.every(x=>x.support==='UNKNOWN'&&x.verdict!=='PASS'&&x.verdict!=='FAIL'));
        assert.equal(r.results.find(x=>x.capability==='ALLOWANCE')!.verdict,'NOT_APPLICABLE');
        assert.equal(r.evidence[0]!.provenance,'DOCUMENTED');assert(!JSON.stringify(r).includes(secret));
      }});
    assert.equal(calls.length,9);assert.equal(calls.filter(x=>x.method==='account_info').length,3);
    assert(calls.every(x=>['server_info','ledger','account_info'].includes(x.method)));
    reports[0]!.evidence[0]!.data={mutated:true};assert(!JSON.stringify(reports[1]).includes('mutated'));
  });
});
test('XRPL failure reports remain valid, stop at failed network/ledger, preserve unobserved issuer and recover',async()=>{
  await withNode(async(url,calls,set)=>{
    const adapter=new XrplReadOnlyAdapter(url),request={networkId:'0',assetAddress:profiles[0].issuer,currencyCode:profiles[0].currency};
    for(const fault of ['network','network-missing','http','ledger-unvalidated','ledger-hash','account-unvalidated','account-hash','account-index','issuer','type','flags','account-rpc']){
      set(fault);const r=await adapter.assessReadOnly(request);assertSerializedReport(r);assert.equal(r.assetIdentity.issuer.status,'UNKNOWN');
      assert.deepEqual(r.assetIdentity.issuedCurrency,{status:'KNOWN',value:profiles[0].currency});
      assert(r.results.every(x=>x.support==='UNKNOWN'&&x.verdict!=='PASS'&&x.verdict!=='FAIL'));assert(!JSON.stringify(r).includes(secret));
      const flags=r.results.find(x=>x.scenarioId==='XRPL-002')!;
      if(['network','network-missing','http'].includes(fault)){assert.equal(calls.length,1);assert.equal(flags.verdict,'NOT_TESTED');}
      else if(fault.startsWith('ledger')){assert.equal(calls.length,2);assert.equal(flags.executionStatus,'NOT_EXECUTED');}
      else{assert.equal(calls.length,3);assert.equal(flags.verdict,'INCONCLUSIVE');assert.equal(flags.executionStatus,'ERROR');}
      set('');assertSerializedReport(await adapter.assessReadOnly(request));
    }
    for(const adapter of [new EvmReadOnlyAdapter(url),new TronReadOnlyAdapter(url),new SolanaReadOnlyAdapter(url)]){
      set('');await assert.rejects(adapter.assessReadOnly({...request,currencyCode:''}),/Currency code requires XRPL/);assert.equal(calls.length,0);
    }
  });
});
test('XRPL schema requires currency knowledge on root and scenario identity, rejects malformed codes and fixed decimals without invalidating legacy reports',async()=>{
  await withNode(async(url)=>{
    const r=await new XrplReadOnlyAdapter(url).assessReadOnly({networkId:'0',assetAddress:profiles[0].issuer,currencyCode:profiles[0].currency});
    assertSerializedReport(r);
    const mutations:((x:any)=>void)[]=[x=>{delete x.assetIdentity.issuedCurrency;},x=>{delete x.results[0].assetIdentity.issuedCurrency;},
      x=>{x.assetIdentity.issuedCurrency={status:'KNOWN',value:'USDC'};},x=>{x.assetIdentity.issuedCurrency={status:'KNOWN',value:'0x'+profiles[0].currency};},
      x=>{x.assetIdentity.issuedCurrency={status:'KNOWN',value:profiles[1].currency.toLowerCase()};},
      x=>{x.assetIdentity.issuedCurrency={status:'UNKNOWN',reason:'unknown',value:profiles[0].currency};},
      ...['decimals','contractAddress','mintAddress','tokenProgramId','implementationAddress'].map(k=>(x:any)=>{x.assetIdentity[k]={status:'KNOWN',value:k==='decimals'?6:'not-applicable'};})];
    for(const mutate of mutations){const x=JSON.parse(JSON.stringify(r));mutate(x);assert.equal(validateReportShape(x),false);}
    const legacy=JSON.parse(await readFile('tests/fixtures/report-v1.json','utf8'));assertReportContract(legacy);
  });
});
function cli(url:string,args:string[]){return new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{
  const c=spawn(process.execPath,['--use-env-proxy','--import','tsx','src/cli.ts',...args],{env:{...process.env,XRPL_RPC_URL:url},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';c.stdout.on('data',d=>{stdout+=String(d);});c.stderr.on('data',d=>{stderr+=String(d);});c.on('error',reject);c.on('close',code=>resolve({code,stdout,stderr}));
});}
test('XRPL assess CLI uses explicit pair/options, normalizes network, saves0600 and rejects ambiguity before RPC',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'xrpl-adapter-')),out=join(dir,'report.json');
  try{await withNode(async(url,calls,set)=>{
    const args=['assess','--chain','xrpl','--network','mainnet','--issuer',profiles[0].issuer,'--currency',profiles[0].currency];
    const stdout=await cli(url,args);assert.equal(stdout.code,0,stdout.stderr);const r=JSON.parse(stdout.stdout);assertReportContract(r);assert.equal(r.assetIdentity.networkId,'0');
    const saved=await cli(url,[...args,'--out',out]);assert.equal(saved.code,0);assert.equal(saved.stdout,'');assert.equal((await stat(out)).mode&0o777,0o600);
    for(const extra of [['--token',''],['--holder',''],['--spender',''],['--profile',''],['--network','1'],['--issuer',''],['--currency',''],['--currency',profiles[1].currency]]){
      set('');await writeFile(out,'preserve-me');const bad=await cli(url,[...args,...extra,'--out',out]);assert.equal(bad.code,1);assert.equal(calls.length,0);assert.equal(await readFile(out,'utf8'),'preserve-me');assert(!(bad.stdout+bad.stderr).includes(secret));
    }
    for(const args of [['lab','--issuer',''],['lab','--currency',''],['assess','--chain','evm','--currency',''],['assess','--chain','solana','--issuer','']]){
      set('');assert.equal((await cli(url,args)).code,1);assert.equal(calls.length,0);
    }
    set('http');const failed=await cli(url,[...args,'--out',out]);assert.equal(failed.code,0);assertReportContract(JSON.parse(await readFile(out,'utf8')));
  });}finally{await rm(dir,{recursive:true,force:true});}
});
