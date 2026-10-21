import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SolanaReadOnlyAdapter } from '../src/solana/adapter.js';
import { XrplReadOnlyAdapter } from '../src/xrpl/adapter.js';
import { decodeLegacyTokenAccount } from '../src/solana/token-account.js';
import { isClassicAddress, isXrplAmountString } from '../src/xrpl/trust-lines.js';
import { encodePublicKey, SOLANA_MAINNET_GENESIS as genesis, SOLANA_STABLECOIN_MINTS as mints, LEGACY_TOKEN_PROGRAM } from '../src/research/solana-mint-readonly.js';
import { XRPL_STABLECOIN_ISSUERS as issuers } from '../src/research/xrpl-issuer-readonly.js';
import { assertSerializedReport, assertReportContract, validateReportShape } from './helpers/report-contract.js';
import type { AssessmentReport } from '../src/domain/model.js';
const secret='synthetic-account-state-credential',hash='AB'.repeat(32),holder='r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59';
const tokenAddress=encodePublicKey(Buffer.alloc(32,3)),owner=encodePublicKey(Buffer.alloc(32,1)),delegate=encodePublicKey(Buffer.alloc(32,2));
function bytes(key:string){const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;for(const c of key)n=n*58n+BigInt(alphabet.indexOf(c));return Buffer.from(n.toString(16).padStart(64,'0'),'hex');}
function tokenData(){const b=Buffer.alloc(165);bytes(mints[0].mint).copy(b);b.fill(1,32,64);b.writeBigUInt64LE(9007199254740993n,64);b.writeUInt32LE(1,72);b.fill(2,76,108);b[108]=2;b.writeBigUInt64LE(18446744073709551615n,121);return b;}
type Request={id?:number;method:string;params:any[]};
async function node(chain:'solana'|'xrpl',run:(url:string,calls:Request[],set:(f:string)=>void)=>Promise<void>){
 const calls:Request[]=[];let fault='';
 const server=createServer(async(req,res)=>{let text='';for await(const c of req)text+=String(c);const r=JSON.parse(text) as Request;calls.push(r);
  if(fault==='http'&&(r.method==='account_lines'||r.method==='getMultipleAccounts')){res.writeHead(451,{'x-squid-error':'ERR_ACCESS_DENIED 0'});res.end(secret);return;}
  let result:any;
  if(chain==='solana'){
   if(r.method==='getGenesisHash')result=fault==='network'?'1'.repeat(32):genesis;
   else{assert.equal(r.method,'getMultipleAccounts');assert.deepEqual(r.params,[[mints[0].mint,tokenAddress],{commitment:'finalized',encoding:'base64'}]);
    const mint=Buffer.alloc(82);mint[44]=6;mint[45]=fault==='mint'?0:1;mint.writeBigUInt64LE(42n,36);
    const b=tokenData();if(fault==='zero'){b.writeBigUInt64LE(0n,64);b.writeUInt32LE(0,72);b.writeBigUInt64LE(0n,121);}
    if(fault==='mint-mismatch')b.fill(4,0,32);if(fault==='state')b[108]=3;if(fault==='uninitialized')b[108]=0;
    if(fault==='native')b.writeUInt32LE(1,109);if(fault==='tag')b.writeUInt32LE(2,72);if(fault==='native-tag')b.writeUInt32LE(2,109);
    const pack=(data:Buffer)=>({owner:LEGACY_TOKEN_PROGRAM,executable:false,space:data.length,data:[data.toString('base64'),'base64'],extra:secret});
    const token:any=pack(fault==='length'?b.subarray(1):b);if(fault==='owner')token.owner='1'.repeat(32);if(fault==='executable')token.executable=true;if(fault==='encoding')token.data[1]='base64+zstd';if(fault==='space')token.space=82;
    result={context:{slot:999},value:fault==='count'?[pack(mint)]:[pack(mint),fault==='null'?null:token]};
   }
   res.end(JSON.stringify({jsonrpc:'2.0',id:r.id,result}));return;
  }
  const p=r.params[0];assert.equal(p.api_version,2);result={status:'success'};
  if(r.method==='server_info')result.info={network_id:fault==='network'?1:0};
  else if(r.method==='ledger')result={...result,validated:true,ledger_hash:hash,ledger_index:999,ledger:{closed:true}};
  else if(r.method==='account_info')result={...result,validated:true,ledger_hash:hash,ledger_index:999,account_data:{Account:p.account,LedgerEntryType:'AccountRoot',Flags:0}};
  else{
   assert.equal(r.method,'account_lines');assert.equal(p.account,holder);assert.equal(p.peer,issuers[0].issuer);assert.equal(p.ledger_hash,hash);assert.equal(p.limit,20);assert.equal(p.ignore_default,false);
   const line:any={account:issuers[0].issuer,currency:issuers[0].currency,balance:'-9007199254740993.125',limit:'1e+20',limit_peer:'0',peer_authorized:true,freeze_peer:true,no_ripple:false,extra:secret};
   if(fault==='zero')line.balance='0';if(fault==='amount-number')line.balance=123;if(fault==='amount-exp')line.balance='1e100';if(fault==='flag')line.peer_authorized='false';if(fault==='peer')line.account=issuers[1].issuer;if(fault==='currency')line.currency='bad-currency';if(fault==='negative-limit')line.limit='-1';
   result={...result,account:fault==='holder'?'wrong':holder,validated:fault!=='unvalidated',ledger_hash:fault==='hash'?'CD'.repeat(32):hash,ledger_index:fault==='index'?998:999,lines:fault==='absent'?[]:[line]};
   if(fault==='pages'){result.lines=p.marker?[line]:[];if(!p.marker)result.marker='opaque-page-1';else assert.equal(p.marker,'opaque-page-1');}
   if(fault==='repeated'){result.lines=[];result.marker='same-marker';}
   if(fault==='limit'){result.lines=[];result.marker='page-'+calls.filter(c=>c.method==='account_lines').length;}
   if(fault==='marker')result.marker={unreviewed:secret};if(fault==='duplicate')result.lines=[line,line];
   if(fault==='rpc')result={status:'error',error_code:19,error:'actNotFound',error_message:secret};
  }
  res.end(JSON.stringify({result,extra:secret}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const a=server.address();assert(a&&typeof a!=='string');
 try{await run(`http://127.0.0.1:${a.port}/?token=${secret}`,calls,f=>{fault=f;calls.length=0;});}finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
const solRequest={networkId:genesis,assetAddress:mints[0].mint,accountAddress:tokenAddress};
const xrplRequest={networkId:'0',assetAddress:issuers[0].issuer,currencyCode:issuers[0].currency,accountAddress:holder};
const balance=(r:AssessmentReport)=>r.results.find(x=>x.capability==='BALANCE')!;
function conservative(r:AssessmentReport){assertSerializedReport(r);assert(r.results.every(x=>x.support==='UNKNOWN'&&x.verdict!=='PASS'&&x.verdict!=='FAIL'));assert(!JSON.stringify(r).includes(secret));assert.equal(r.results.find(x=>x.capability==='TRANSFER')!.verdict,'NOT_TESTED');}
test('legacy Token Account decoder preserves exact u64, None payload and separate authorities; rejects layout/tags/state',()=>{
 const b=tokenData(),r=decodeLegacyTokenAccount(b);assert.equal(r.ownerAuthority,owner);assert.equal(r.delegate.state,'PRESENT');assert.equal(r.amountRaw,'9007199254740993');assert.equal(r.delegatedAmountRaw,'18446744073709551615');assert.equal(r.accountState,'FROZEN');
 b.writeBigUInt64LE(18446744073709551615n,64);assert.equal(decodeLegacyTokenAccount(b).amountRaw,'18446744073709551615');
 b.writeUInt32LE(1,109);b.writeBigUInt64LE(9007199254740993n,113);assert.deepEqual(decodeLegacyTokenAccount(b).nativeReserve,{state:'PRESENT',amountRaw:'9007199254740993'});b.writeUInt32LE(0,109);
 b.writeUInt32LE(0,72);assert.deepEqual(decodeLegacyTokenAccount(b).delegate,{state:'NONE_IN_ACCOUNT'});b.fill(9,133,165);assert.deepEqual(decodeLegacyTokenAccount(b).closeAuthority,{state:'NONE_IN_ACCOUNT'});
 for(const offset of [72,109,129]){const bad=tokenData();bad.writeUInt32LE(2,offset);assert.throws(()=>decodeLegacyTokenAccount(bad));}
 for(const length of [0,82,164,166])assert.throws(()=>decodeLegacyTokenAccount(Buffer.alloc(length)));b[108]=3;assert.throws(()=>decodeLegacyTokenAccount(b));
});
test('Solana account batch pins mint/token at one slot and distinguishes frozen, delegation, zero and read failure with recovery/isolation',async()=>{
 await node('solana',async(url,calls,set)=>{const adapter=new SolanaReadOnlyAdapter(url);
  const reports=await Promise.all([adapter.assessReadOnly(solRequest),adapter.assessReadOnly(solRequest)]);assert.equal(calls.length,4);
  for(const r of reports){conservative(r);const o=balance(r).observations;assert.equal(o.balance,'9007199254740993');assert.equal(o.ownerAuthority,owner);assert.equal(o.accountState,'FROZEN');assert.deepEqual(o.delegate,{state:'PRESENT',address:delegate});assert.equal(o.delegatedAmountRaw,'18446744073709551615');assert.equal(r.results.find(x=>x.capability==='DELEGATION')!.verdict,'INCONCLUSIVE');assert.equal(r.results.find(x=>x.capability==='FREEZE')!.verdict,'NOT_TESTED');assert.equal(balance(r).observedBlockOrSlot,'999');}
  reports[0]!.results[0]!.observations.mutated=true;assert(!JSON.stringify(reports[1]).includes('mutated'));
  set('zero');const zero=await adapter.assessReadOnly(solRequest);conservative(zero);assert.equal(balance(zero).observations.balance,'0');assert.deepEqual(balance(zero).observations.delegate,{state:'NONE_IN_ACCOUNT'});
  for(const fault of ['network','http','mint','mint-mismatch','state','uninitialized','native','tag','native-tag','length','owner','executable','encoding','space','null','count']){
   set(fault);const r=await adapter.assessReadOnly(solRequest);conservative(r);assert.equal(balance(r).observations.balance,undefined,fault);assert.equal(calls.length,fault==='network'?1:2);
   assert.equal(balance(r).verdict,fault==='network'?'NOT_TESTED':'INCONCLUSIVE');if(fault==='http')assert(JSON.stringify(r).includes('ERR_ACCESS_DENIED'));
   set('');const recovered=await adapter.assessReadOnly(solRequest);conservative(recovered);assert.equal(balance(recovered).observations.balance,'9007199254740993');
  }
  for(const accountAddress of ['',secret,mints[0].mint]){set('');await assert.rejects(adapter.assessReadOnly({...solRequest,accountAddress}));assert.equal(calls.length,0);}
 });
});
test('XRPL validates checksum/canonical classic addresses and bounded string-number grammar without numeric conversion',()=>{
 for(const a of [holder,...issuers.map(x=>x.issuer)])assert.equal(isClassicAddress(a),true,a);
 for(const a of ['',holder+'r',holder.slice(0,-1)+'r','X'+holder.slice(1),secret])assert.equal(isClassicAddress(a),false,a);
 for(const v of ['0','-0.125','9007199254740993.125','1e-81','1E+95','1e-99'])assert.equal(isXrplAmountString(v),true,v);
 for(const v of [0,123,NaN,null,true,'','1e100','1e999999999','Infinity','NaN',' 1','01','1\n'])assert.equal(isXrplAmountString(v),false,String(v));
});
test('XRPL holder perspective preserves signed/fraction/exponent strings, individual flags and missing fields, never delegation',async()=>{
 await node('xrpl',async(url,calls,set)=>{const adapter=new XrplReadOnlyAdapter(url);const rs=await Promise.all([adapter.assessReadOnly(xrplRequest),adapter.assessReadOnly(xrplRequest)]);assert.equal(calls.length,8);
  for(const r of rs){conservative(r);const t=balance(r).observations.trustLine as any;assert.equal(t.holder,holder);assert.equal(t.issuer,issuers[0].issuer);assert.equal(t.currency,issuers[0].currency);assert.equal(t.lineState,'PRESENT');assert.equal(t.line.balanceValue,'-9007199254740993.125');assert.equal(t.line.holderLimitValue,'1e+20');assert.deepEqual(t.line.flags.peer_authorized,{state:'PRESENT',value:true});assert.deepEqual(t.line.flags.freeze_peer,{state:'PRESENT',value:true});assert.deepEqual(t.line.flags.authorized,{state:'NOT_PRESENT'});assert.equal(r.results.find(x=>x.capability==='DELEGATION')!.verdict,'NOT_TESTED');assert.equal(r.results.find(x=>x.capability==='FREEZE')!.verdict,'NOT_TESTED');
   for(const value of [123,'1e100','01']){const mutated=structuredClone(r);(balance(mutated).observations.trustLine as any).line.balanceValue=value;assert.equal(validateReportShape(mutated),false);}
  }
  rs[0]!.results[0]!.observations.mutated=true;assert(!JSON.stringify(rs[1]).includes('mutated'));
  set('zero');let t=balance(await adapter.assessReadOnly(xrplRequest)).observations.trustLine as any;assert.equal(t.line.balanceValue,'0');
  set('absent');const absent=await adapter.assessReadOnly(xrplRequest);conservative(absent);t=balance(absent).observations.trustLine as any;assert.equal(t.lineState,'NOT_PRESENT');assert.equal(t.complete,true);assert.equal(t.line,undefined);
 });
});
test('XRPL pagination uses fixed ledger/peer, does not infer absence from short/partial pages or RPC errors, and recovers',async()=>{
 await node('xrpl',async(url,calls,set)=>{const adapter=new XrplReadOnlyAdapter(url);
  set('pages');const paged=await adapter.assessReadOnly(xrplRequest);conservative(paged);assert.equal(calls.length,5);assert.equal((balance(paged).observations.trustLine as any).pagesRead,2);
  for(const fault of ['network','http','holder','unvalidated','hash','index','peer','currency','amount-number','amount-exp','negative-limit','flag','repeated','limit','marker','duplicate','rpc']){
   set(fault);const r=await adapter.assessReadOnly(xrplRequest);conservative(r);const t=balance(r).observations.trustLine as any;assert.equal(t.lineState,'UNKNOWN',fault);assert.equal(t.complete,false);assert.equal(t.line,undefined);assert(calls.length<=6);
   assert.equal(balance(r).verdict,fault==='network'?'NOT_TESTED':'INCONCLUSIVE');if(fault==='limit'){assert.equal(calls.length,6);assert.equal(t.reason,'PAGINATION_LIMIT');}if(fault==='repeated'){assert.equal(calls.length,5);assert.equal(t.reason,'REPEATED_PAGINATION_MARKER');}if(fault==='http'){assert.equal(calls.length,4);assert(JSON.stringify(r).includes('ERR_ACCESS_DENIED'));}
   set('');const recovered=await adapter.assessReadOnly(xrplRequest);conservative(recovered);assert.equal((balance(recovered).observations.trustLine as any).lineState,'PRESENT');
  }
  for(const accountAddress of ['',secret,issuers[0].issuer,holder.slice(0,-1)+'r']){set('');await assert.rejects(adapter.assessReadOnly({...xrplRequest,accountAddress}));assert.equal(calls.length,0);}
 });
});
function cli(url:string,args:string[]){return new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{const c=spawn(process.execPath,['--use-env-proxy','--import','tsx','src/cli.ts',...args],{env:{...process.env,SOLANA_RPC_URL:url,XRPL_RPC_URL:url},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';c.stdout.on('data',d=>stdout+=String(d));c.stderr.on('data',d=>stderr+=String(d));c.on('error',reject);c.on('close',code=>resolve({code,stdout,stderr}));});}
test('explicit account CLI emits common valid private reports, rejects ambiguous/invalid options before RPC and preserves prior files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'account-read-cli-')),out=join(dir,'synthetic.json');
 try{for(const chain of ['solana','xrpl'] as const)await node(chain,async(url,calls,set)=>{
  const args=chain==='solana'?['assess','--chain',chain,'--network','mainnet-beta','--token',mints[0].mint,'--token-account',tokenAddress]:['assess','--chain',chain,'--network','mainnet','--issuer',issuers[0].issuer,'--currency',issuers[0].currency,'--holder',holder];
  const r=await cli(url,args);assert.equal(r.code,0,r.stderr);assertReportContract(JSON.parse(r.stdout));assert(!(r.stdout+r.stderr).includes(secret));
  const saved=await cli(url,[...args,'--out',out]);assert.equal(saved.code,0,saved.stderr);assert.equal(saved.stdout,'');assert.equal((await stat(out)).mode&0o777,0o600);
  const offline=await cli(url,['validate','--file',out]);assert.equal(offline.code,0);assert.equal(JSON.parse(offline.stdout).valid,true);
  for(const extra of chain==='solana'?[['--token-account',''],['--token-account',secret],['--holder',holder]]:[['--holder',''],['--holder',issuers[0].issuer],['--token-account',tokenAddress]]){
   set('');await writeFile(out,'preserve-me');const bad=await cli(url,[...args,...extra,'--out',out]);assert.equal(bad.code,1);assert.equal(calls.length,0);assert.equal(await readFile(out,'utf8'),'preserve-me');assert(!(bad.stdout+bad.stderr).includes(secret));
  }
 });
 for(const args of [['lab','--token-account',''],['assess','--chain','evm','--token-account',''],['assess','--chain','tron','--token-account','']])assert.equal((await cli('http://127.0.0.1:1',args)).code,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
