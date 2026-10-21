import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile,writeFile,mkdtemp,rm,stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { encodeAbiParameters, getAddress } from 'viem';
import { contextProfiles } from '../tools/research/service-account-context.js';
import { ServiceReadRpc,runServiceAccountReadOnly,validateServiceAccountRun } from '../tools/research/service-account-readonly.js';
import { tronAddress } from '../src/tron/address.js';
import { proxySlots } from '../src/evm/proxy.js';
import { json } from '../src/domain/evaluator.js';
import { writeReportAtomically } from '../src/report-output.js';
const seed=JSON.parse(readFileSync(new URL('./fixtures/service-account-context.json',import.meta.url),'utf8'));
const raw=(x:unknown)=>Buffer.from(JSON.stringify(x)),max=(2n**256n-1n).toString(),zero='0x'+'0'.repeat(64),word=(n:bigint)=>encodeAbiParameters([{type:'uint256'}],[n]);
function input(profile:keyof typeof contextProfiles='ethereum-usdc',allowance=false){const x=structuredClone(seed),p=contextProfiles[profile];Object.assign(x,{profileId:profile,...p});
 const a=(hex:string)=>p.chainFamily==='TRON'?tronAddress('41'+hex.repeat(20)).base58:'0x'+hex.repeat(20);
 x.query.holder.address=a('11');if(allowance){const owner=structuredClone(x.query.holder),spender=structuredClone(owner);owner.purpose=spender.purpose='ALLOWANCE_REVIEW';spender.address=a('22');x.query={kind:'ALLOWANCE',owner,spender};}return x;}
async function server(family:'EVM'|'TRON',mode:string,run:(url:string,calls:any[])=>Promise<void>){
 const calls:any[]=[];let height=256n;
 const http=createServer(async(req,res)=>{let body='';for await(const b of req)body+=String(b);const q=JSON.parse(body);calls.push(q);let result:any;
 if(q.method==='eth_chainId')result=mode==='chain'?'0x2':family==='EVM'?'0x1':'0x2b6653dc';
 else if(q.method==='eth_blockNumber')result='0x'+(height++).toString(16);
 else if(q.method==='eth_getBlockByNumber'){const n=q.params[0]==='latest'?height:BigInt(q.params[0]);result={number:'0x'+n.toString(16),hash:'0x'+n.toString(16).padStart(16,'0')+'ab'.repeat(24),private:'CANARY'};}
 else if(q.method==='eth_getCode')result=mode==='clone'?'0x363d3d373d3d3d363d73'+'33'.repeat(20)+'5af43d82803e903d91602b57fd5bf3':'0x6000';
 else if(q.method==='eth_getStorageAt')result=mode==='pointer'&&[proxySlots.implementation,proxySlots.beacon].includes(q.params[1])?'0x'+'0'.repeat(24)+'33'.repeat(20):zero;
 else if(q.method==='eth_call'){
  const data=q.params[0].data;
  if(data==='0x5c60da1b')result='0x'+'0'.repeat(24)+'44'.repeat(20);
  else if(data.startsWith('0x70a08231')||data.startsWith('0xdd62ed3e')){
   if(mode==='readError'){res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,error:{code:3,message:'execution reverted https://secret.invalid/CANARY'}}));return;}
   result=mode==='invalid'?'0x01':word(data.startsWith('0xdd62ed3e')?0n:BigInt(max));
  }else if(data==='0x06fdde03'||data==='0x95d89b41')result=encodeAbiParameters([{type:'string'}],['SYNTHETIC']);
  else if(data==='0x313ce567')result=word(6n);else if(data==='0x18160ddd')result=word(BigInt(max));else assert.fail('unexpected selector');
 }else assert.fail('unexpected RPC');
 if(mode==='oversize'){res.end('x'.repeat(1048577));return;}
 if(mode==='redirect'){res.writeHead(302,{location:'http://127.0.0.1:1/should-not-follow'});res.end();return;}
 res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result}));});
 await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));const addr=http.address();assert(addr&&typeof addr!=='string');
 try{await run(`http://127.0.0.1:${addr.port}`,calls);}finally{http.closeAllConnections();await new Promise<void>(r=>http.close(()=>r()));}
}
test('service runner links four fixed profiles to exact balances and preserves EVM repin versus TRON UNKNOWN context',async()=>{
 for(const profile of Object.keys(contextProfiles)as(keyof typeof contextProfiles)[])await server(contextProfiles[profile].chainFamily,'ok',async(url,calls)=>{
  const bytes=raw(input(profile)),r=await runServiceAccountReadOnly(bytes,{evm:url,tron:url});validateServiceAccountRun(r,bytes);assert.equal(r.stage,'OBSERVED');assert.equal(r.binding.value,max);assert.equal(r.verdict,'INCONCLUSIVE');assert.equal(r.contextValidation.rpcAdmission,'NOT_GRANTED');
  const reads=calls.filter(c=>c.method==='eth_call'&&c.params[0].data.startsWith('0x70a08231'));assert.equal(reads.length,1);assert.equal(reads[0].params[0].data,'0x70a08231'+'0'.repeat(24)+'11'.repeat(20));
  if(r.contextValidation.chainFamily==='EVM'){assert.equal(r.assessment.assetIdentity.observedBlockOrSlot,'256');assert.equal(r.binding.queryBlockOrSlot,'257');assert(r.binding.queryBlockHash);}else{assert.equal(r.binding.queryBlockOrSlot,'UNKNOWN');assert.equal(r.binding.queryBlockHash,null);assert.equal(reads[0].params[1],'latest');}
  assert.equal(r.requestCount,calls.length);assert(!JSON.stringify(r).includes('CANARY'));assert(calls.every(c=>['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getStorageAt','eth_getCode','eth_call'].includes(c.method)));
  if(profile==='ethereum-usdc')await writeReportAtomically('reports/service-account-readonly-synthetic.json',json({kind:'SYNTHETIC_LOCAL_HTTP_ARTIFACT_NOT_MAINNET_EVIDENCE',report:r}));
 });
});
test('TRON allowance preserves owner/spender order, aliases, zero value and explicit additional owner balance',async()=>{
 await server('TRON','ok',async(url,calls)=>{
  for(const same of [false,true]){const x=input('tron-usdt',true);x.query.owner.address=tronAddress(x.query.owner.address).hex;if(same)x.query.spender.address=tronAddress(x.query.owner.address).base58;
   const bytes=raw(x),r=await runServiceAccountReadOnly(bytes,{tron:url,evm:'not-used'});validateServiceAccountRun(r,bytes);assert.equal(r.binding.value,'0');assert.equal(r.binding.additionalBalanceRead,true);assert.equal(r.binding.scenarioId,'TRC20-007');assert.equal(r.binding.request.accountAddress,tronAddress(x.query.owner.address).base58);
   const read=calls.filter(c=>c.method==='eth_call'&&c.params[0].data.startsWith('0xdd62ed3e')).at(-1);assert.equal(read.params[0].data,'0xdd62ed3e'+'0'.repeat(24)+'11'.repeat(20)+'0'.repeat(24)+(same?'11':'22').repeat(20));
  }
 });
});
test('invalid input, report-as-input and EVM allowance never contact RPC or substitute a balance read',async()=>{
 await server('EVM','ok',async(url,calls)=>{
  const x=input();x.query.holder.provenance.referenceId='https://secret.invalid/CANARY';await assert.rejects(runServiceAccountReadOnly(raw(x),{evm:url}));
  const bytes=raw(input('ethereum-usdc',true)),r=await runServiceAccountReadOnly(bytes,{});validateServiceAccountRun(r,bytes);assert.equal(r.stage,'NOT_IMPLEMENTED');assert.equal(r.requestCount,0);assert.equal(r.binding.readStatus,'NOT_TESTED');assert.equal(r.assessment,null);
  await assert.rejects(runServiceAccountReadOnly(raw(r.contextValidation),{evm:url}));assert.equal(calls.length,0);
 });
});
test('selected query errors remain failures, chain mismatch is fatal, redirect is not followed and upstream secrets stay omitted',async()=>{
 for(const family of ['EVM','TRON']as const)for(const mode of ['readError','invalid','chain','redirect','oversize'])await server(family,mode,async(url,calls)=>{
  const bytes=raw(input(family==='EVM'?'ethereum-usdc':'tron-usdt'));
  if(['chain','redirect','oversize'].includes(mode)){await assert.rejects(runServiceAccountReadOnly(bytes,{evm:url,tron:url}));assert.equal(calls.length,1);}
  else{const r=await runServiceAccountReadOnly(bytes,{evm:url,tron:url});validateServiceAccountRun(r,bytes);assert.equal(r.stage,mode==='invalid'?'INVALID_RESPONSE':'READ_FAILED');assert(!Object.hasOwn(r.binding,'value'));assert(!JSON.stringify(r).includes('CANARY'));}
 });
});
test('runner freezes original bytes across awaits and concurrent assessments keep separate evidence namespaces',async()=>{
 await server('EVM','ok',async(url)=>{
  const first=raw(input()),original=Buffer.from(first),second=input();second.query.holder.address='0x'+'22'.repeat(20);
  const one=runServiceAccountReadOnly(first,{evm:url});first.fill(32);const [a,b]=await Promise.all([one,runServiceAccountReadOnly(raw(second),{evm:url})]);validateServiceAccountRun(a,original);validateServiceAccountRun(b,raw(second));assert.notEqual(a.assessment.assessmentId,b.assessment.assessmentId);assert.equal(a.binding.request.accountAddress,'0x'+'11'.repeat(20));assert.equal(b.binding.request.accountAddress,'0x'+'22'.repeat(20));
  for(const method of ['foreignCall','send']){const r=structuredClone(a);const e=r.assessment.evidence.find((e:any)=>e.kind==='RPC'&&e.data.method==='eth_call');if(method==='send')e.data.method='eth_sendTransaction';else e.data.params[0].data='0x70a08231'+'0'.repeat(24)+'33'.repeat(20);r.assessmentSha256=createHash('sha256').update(JSON.stringify(r.assessment)).digest('hex');assert.throws(()=>validateServiceAccountRun(r,original));}
  for(const mutate of [(r:any)=>r.binding.request.accountAddress='0x'+'33'.repeat(20),(r:any)=>r.binding.value='0',(r:any)=>r.binding.evidenceReferences[0].namespace='contextValidation',(r:any)=>r.assessmentSha256='a'.repeat(64),(r:any)=>r.assessment.results.find((s:any)=>s.scenarioId==='ERC20-000').capability='TRANSFER']){const r=structuredClone(a);mutate(r);assert.throws(()=>validateServiceAccountRun(r,original));}
 });
});
test('per-run RPC scope fixes calldata/caller/tag, rejects writes and caps32 requests',async()=>{
 await server('EVM','ok',async(url,calls)=>{
  const bytes=raw(input()),rpc=new ServiceReadRpc(url,bytes);bytes.fill(32);
  for(const[m,p]of [['eth_sendTransaction',[]],['evm_snapshot',[]],['eth_getCode',['0x'+'33'.repeat(20),'latest']],['eth_call',[{to:getAddress(contextProfiles['ethereum-usdc'].assetAddress),data:'0x095ea7b3'},'latest']]]as[string,any[]][])await assert.rejects(rpc.request(m,p));assert.equal(calls.length,0);
  const tag=await rpc.request<string>('eth_blockNumber');
  for(const[m,p]of [['eth_call',[{to:getAddress(contextProfiles['ethereum-usdc'].assetAddress),data:'0x095ea7b3'},tag]],['eth_call',[{to:getAddress(contextProfiles['ethereum-usdc'].assetAddress),data:'0x70a08231'+'0'.repeat(24)+'22'.repeat(20)},tag]],['eth_getCode',['0x'+'33'.repeat(20),tag]],['eth_call',[{to:getAddress(contextProfiles['ethereum-usdc'].assetAddress),from:'0x'+'11'.repeat(20),data:'0x06fdde03'},tag]],['eth_call',[{to:getAddress(contextProfiles['ethereum-usdc'].assetAddress),data:'0x06fdde03'},tag,{}]]]as[string,any[]][])await assert.rejects(rpc.request(m,p));
  for(let i=0;i<31;i++)await rpc.request('eth_chainId');await assert.rejects(rpc.request('eth_chainId'),/budget/);assert.equal(calls.length,32);
 });
});
test('CLI selects only its chain env, saves success0600/unsupported exit2 and preserves original files on failures',async()=>{
 const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'account-run-')),file=join(dir,'input.json'),out=join(dir,'out.json');
 const cmd=['--use-env-proxy','--import','tsx','tools/research/service-account-readonly.ts','--input',file,'--out',out];
 try{await server('TRON','ok',async(url)=>{const bytes=raw(input('tron-usdt',true));await writeFile(file,bytes);await exec(process.execPath,cmd,{env:{...process.env,TRON_RPC_URL:url,RPC_URL:'CANARY_NOT_USED'},timeout:15000});validateServiceAccountRun(JSON.parse(await readFile(out,'utf8')),bytes);assert.equal((await stat(out)).mode&0o777,0o600);});
  await server('EVM','readError',async(url)=>{await writeFile(file,raw(input()));await writeFile(out,'KEEP');await assert.rejects(exec(process.execPath,cmd,{env:{...process.env,RPC_URL:url},timeout:15000}),e=>!String(e).includes('CANARY'));assert.equal(await readFile(out,'utf8'),'KEEP');});
  const bytes=raw(input('ethereum-usdc',true));await writeFile(file,bytes);await assert.rejects(exec(process.execPath,cmd,{env:{...process.env,RPC_URL:'CANARY_NOT_USED'},timeout:15000}),(e:any)=>e.code===2);const r=JSON.parse(await readFile(out,'utf8'));validateServiceAccountRun(r,bytes);assert.equal(r.stage,'NOT_IMPLEMENTED');
  await assert.rejects(exec(process.execPath,[...cmd.slice(0,-1),file],{timeout:15000}));assert.deepEqual(await readFile(file),bytes);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('scope grants code targets only from fresh same-tag pointers, beacon responses or exact clone runtime',async()=>{
 for(const mode of ['pointer','clone'])await server('EVM',mode,async(url)=>{
  const rpc=new ServiceReadRpc(url,raw(input())),tag=await rpc.request<string>('eth_blockNumber'),token=getAddress(contextProfiles['ethereum-usdc'].assetAddress),target='0x'+'33'.repeat(20),nested='0x'+'44'.repeat(20);
  await assert.rejects(rpc.request('eth_getCode',[target,tag]));
  if(mode==='clone')await rpc.request('eth_getCode',[token,tag]);
  else await rpc.request('eth_getStorageAt',[token,proxySlots.implementation,tag]);
  await rpc.request('eth_getCode',[target,tag]);const otherTag=await rpc.request<string>('eth_blockNumber');await assert.rejects(rpc.request('eth_getCode',[target,otherTag]));
  if(mode==='pointer'){
   await rpc.request('eth_getStorageAt',[token,proxySlots.beacon,tag]);
   await assert.rejects(rpc.request('eth_call',[{to:target,from:target,data:'0x5c60da1b'},tag]));
   await rpc.request('eth_call',[{to:target,from:token,data:'0x5c60da1b'},tag]);await rpc.request('eth_getCode',[nested,tag]);
   await assert.rejects(rpc.request('eth_call',[{to:nested,from:token,data:'0x5c60da1b'},tag]));
  }
 });
});
