import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { decodeIssuerFlags, readStablecoinIssuers, XRPL_STABLECOIN_ISSUERS } from '../src/research/xrpl-issuer-readonly.js';
const ledgerHash='AB'.repeat(32), otherHash='CD'.repeat(32), sentinel='synthetic-xrpl-secret-sentinel';
type Request={method:string;params:Record<string,unknown>[]};
async function withNode(run:(url:string,calls:Request[],set:(f:string)=>void)=>Promise<void>) {
  let fault='';const calls:Request[]=[];
  const server=createServer(async(req,res)=>{
    let raw='';for await(const c of req)raw+=String(c);
    const r=JSON.parse(raw) as Request;calls.push(r);const p=r.params[0]!;
    assert.equal(p.api_version,2);
    if(fault==='http'){res.writeHead(403);res.end(sentinel);return;}
    if(fault==='squid'){res.writeHead(451,{'x-squid-error':'ERR_ACCESS_DENIED 0'});res.end(sentinel);return;}
    if(fault==='oversize'){res.end(' '.repeat(65537));return;}
    if(fault==='redirect'){res.writeHead(302,{location:'/secret?token='+sentinel});res.end();return;}
    let result:Record<string,unknown>={status:'success'};
    if(r.method==='server_info'){
      assert.deepEqual(p,{api_version:2});
      result.info={...(fault==='network-missing'?{}:{network_id:fault==='network-string'?'0':fault==='network-wrong'?1:0}),secret:sentinel};
    }else if(r.method==='ledger'){
      assert.deepEqual(p,{api_version:2,ledger_index:'validated',transactions:false,expand:false});
      result={...result,validated:fault==='ledger-unvalidated'?false:true,ledger_hash:fault==='ledger-hash'?'invalid':ledgerHash,
        ledger_index:fault==='ledger-unsafe'?9007199254740992:123456789,
        ledger:{closed:fault==='ledger-open'?false:true,ledger_hash:fault==='ledger-conflict'?otherHash:ledgerHash,
          ledger_index:fault==='ledger-index-conflict'?123456788:'123456789',total_coins:sentinel}};
      if(fault==='ledger-no-validated')delete result.validated;
    }else{
      assert.equal(r.method,'account_info');
      assert.deepEqual(p,{api_version:2,account:calls.length===3?XRPL_STABLECOIN_ISSUERS[0].issuer:XRPL_STABLECOIN_ISSUERS[1].issuer,ledger_hash:ledgerHash,strict:true});
      const firstOnly = fault==='first-account-rpc' || fault==='first-account-http';
      const bad = firstOnly ? calls.length===3 : calls.length===4;
      if(bad && (fault==='account-rpc'||fault==='first-account-rpc')){
        result={status:'error',error:'actNotFound',error_code:19,error_message:sentinel,request:{token:sentinel}};
      }else if(bad&&fault==='first-account-http'){
        res.writeHead(403);res.end(sentinel);return;
      }else{
        const a:Record<string,unknown>={Account:bad&&fault==='account-wrong'?XRPL_STABLECOIN_ISSUERS[0].issuer:p.account,
          LedgerEntryType:bad&&fault==='account-type'?'RippleState':'AccountRoot',Flags:bad&&fault==='flags-string'?'2147483648':
            bad&&fault==='flags-negative'?-1:bad&&fault==='flags-fraction'?1.5:bad&&fault==='flags-overflow'?4294967296:2147483648,
          Balance:sentinel,Domain:sentinel,RegularKey:sentinel};
        if(bad&&fault==='flags-missing')delete a.Flags;
        if(fault==='rate-zero')a.TransferRate=0;
        if(fault==='rate-one')a.TransferRate=1000000000;
        if(bad&&fault==='rate-invalid')a.TransferRate=9007199254740992;
        result={...result,account_data:a,validated:!(bad&&fault==='account-unvalidated'),ledger_hash:bad&&fault==='account-hash'?otherHash:ledgerHash,
          ledger_index:bad&&fault==='account-index'?123456788:123456789};
        if(bad&&fault==='account-missing-hash')delete result.ledger_hash;
      }
    }
    if(fault==='no-status')delete result.status;
    res.end(JSON.stringify({result,unexpected:sentinel}));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert(address&&typeof address!=='string');
  try{await run(`http://127.0.0.1:${address.port}/?token=${sentinel}`,calls,f=>{fault=f;calls.length=0;});}
  finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test('AccountRoot lsf uint32 decoding keeps high clawback bit and all uninterpreted bits without signed conversion',()=>{
  const zero=decodeIssuerFlags(0);assert.equal(zero.flagsRaw,'0');assert(Object.values(zero.bits).every(x=>x===false));
  assert.equal(decodeIssuerFlags(0x80000000).bits.allowTrustLineClawback,true);
  const max=decodeIssuerFlags(0xffffffff);assert.equal(max.flagsRaw,'4294967295');assert(Object.values(max.bits).every(x=>x===true));
  assert.equal(BigInt(max.uninterpretedFlagBits),0xffffffffn^(0x00040000n|0x00100000n|0x00200000n|0x00400000n|0x00800000n|0x80000000n));
  for(const invalid of [-1,1.5,4294967296,NaN,Infinity,'0','2147483648',null,undefined,{},0n])assert.throws(()=>decodeIssuerFlags(invalid));
});
test('issuer reader binds exact currency/issuer and same validated ledger without collecting balance/key/trustlines',async()=>{
  await withNode(async(url,calls,set)=>{
    const r=await readStablecoinIssuers(url);assert.equal(r.status,'OBSERVED');assert.equal(r.ledgerIndex,'123456789');assert.equal(r.ledgerHash,ledgerHash);
    assert.equal(r.requestCount,4);assert.deepEqual(calls.map(x=>x.method),['server_info','ledger','account_info','account_info']);
    assert(r.observations.every(o=>o.accountRoot?.flags.bits.allowTrustLineClawback===true));
    assert(r.observations.every(o=>o.accountRoot?.transferRate.state==='NOT_PRESENT'));
    assert.equal(r.productAdapter,'AVAILABLE_SEPARATELY_ISSUER_ONLY');assert.equal(r.amendmentActivation,'UNKNOWN');assert.equal(r.actualAuthorityExercise,'NOT_TESTED');
    assert(!JSON.stringify(r).includes(sentinel));assert(!JSON.stringify(r).includes('Balance'));assert(!JSON.stringify(r).includes('RegularKey'));
    for(const fault of ['rate-zero','rate-one']){
      set(fault);const rr=await readStablecoinIssuers(url);assert.equal(rr.status,'OBSERVED');
      assert.deepEqual(rr.observations[0]!.accountRoot!.transferRate,{state:'PRESENT',raw:fault==='rate-zero'?'0':'1000000000'});
    }
  });
});
test('missing/wrong network and invalid/unvalidated/conflicting ledger stop before issuer calls',async()=>{
  await withNode(async(url,calls,set)=>{
    for(const fault of ['network-missing','network-string','network-wrong','ledger-unvalidated','ledger-no-validated','ledger-hash','ledger-unsafe','ledger-open','ledger-conflict','ledger-index-conflict','no-status']){
      set(fault);const r=await readStablecoinIssuers(url);assert.equal(r.status,'INCONCLUSIVE',fault);
      assert(!calls.some(x=>x.method==='account_info'),fault);assert(r.observations.every(o=>o.accountRoot===undefined));
      assert.equal(r.ledgerHash,'UNKNOWN');assert(!JSON.stringify(r).includes(sentinel));
      if(fault.startsWith('network'))assert.equal(calls.length,1);
    }
  });
});
test('account mismatch/error preserves independent success; bounded/redacted failures never switch endpoint or issue writes',async()=>{
  await withNode(async(url,calls,set)=>{
    for(const fault of ['account-wrong','account-type','flags-string','flags-negative','flags-fraction','flags-overflow','flags-missing','rate-invalid',
      'account-unvalidated','account-hash','account-index','account-missing-hash','account-rpc','first-account-rpc','first-account-http','http','squid','oversize','redirect']){
      set(fault);const r=await readStablecoinIssuers(url);assert.equal(r.status,'INCONCLUSIVE',fault);
      assert(calls.length<=4);assert(calls.every(x=>['server_info','ledger','account_info'].includes(x.method)));
      assert(!JSON.stringify(r).includes(sentinel),fault);
      if(fault==='first-account-rpc'){assert.equal(r.observations[0]!.failure!.rpcCode,19);assert.equal(r.observations[1]!.status,'OBSERVED');}
      else if(fault==='first-account-http'){assert.equal(calls.length,3);assert.equal(r.observations[1]!.reason,'NOT_OBSERVED');}
      else if(fault==='squid')assert.deepEqual(r.failure,{category:'HTTP_ERROR',httpStatus:451,squidErrorCode:'ERR_ACCESS_DENIED'});
      else if(fault==='http')assert.deepEqual(r.failure,{category:'HTTP_ERROR',httpStatus:403});
      else if(!['oversize','redirect'].includes(fault)){assert.equal(r.observations[0]!.status,'OBSERVED',fault);assert.equal(r.observations[1]!.status,'INCONCLUSIVE',fault);}
    }
    await assert.rejects(readStablecoinIssuers('file:///synthetic'),/INVALID_RPC_CONFIGURATION/);
  });
});
function cli(url:string,out:string,args:string[]=[]) {
  return new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{
    const child=spawn(process.execPath,['--use-env-proxy','--import','tsx','src/research/xrpl-issuer-cli.ts','--out',out,...args],
      {env:{...process.env,XRPL_RPC_URL:url},stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',d=>{stdout+=String(d);});child.stderr.on('data',d=>{stderr+=String(d);});
    child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));
  });
}
test('XRPL research CLI saves0600 and inconclusive evidence, rejects unknown inputs before RPC and preserves existing output',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'xrpl-issuer-cli-')),out=join(dir,'report.json');
  try{await withNode(async(url,calls,set)=>{
    const r=await cli(url,out);assert.equal(r.code,0,r.stderr);assert.equal((await stat(out)).mode&0o777,0o600);
    assert.equal(JSON.parse(await readFile(out,'utf8')).status,'OBSERVED');
    await writeFile(out,'preserve-me');calls.length=0;
    const invalid=await cli(url,out,['--account',sentinel]);assert.equal(invalid.code,1);assert.equal(calls.length,0);
    assert.equal(await readFile(out,'utf8'),'preserve-me');assert(!invalid.stderr.includes(sentinel));
    set('http');const failed=await cli(url,out);assert.equal(failed.code,2);
    const text=await readFile(out,'utf8');assert.equal(JSON.parse(text).status,'INCONCLUSIVE');assert(!(failed.stdout+failed.stderr+text).includes(sentinel));
  });}finally{await rm(dir,{recursive:true,force:true});}
});
