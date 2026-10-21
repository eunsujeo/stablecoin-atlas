import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, stat, symlink, link, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { getAddress } from 'viem';
import { tronAddress } from '../src/tron/address.js';
import { contextProfiles, maxContextBytes, validateServiceAccountContext, validateServiceAccountContextReport, readContextInput } from '../tools/research/service-account-context.js';
const example=JSON.parse(readFileSync(new URL('./fixtures/service-account-context.json',import.meta.url),'utf8'));
const bytes=(o:unknown)=>Buffer.from(JSON.stringify(o)), fresh=()=>structuredClone(example),now='2026-10-20T01:00:00.000Z';
const check=(o:unknown)=>validateServiceAccountContext(bytes(o),now);
const account=()=>structuredClone(example.query.holder);
const hash=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const exec=promisify(execFile);
test('local context validates only fixed profile tuples, normalizes EVM/TRON aliases and grants no network admission',()=>{
 const prior=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Unexpected network');};
 try{for(const[id,p]of Object.entries(contextProfiles)){
  const x=fresh();Object.assign(x,{profileId:id,chainFamily:p.chainFamily,networkId:p.networkId,assetAddress:p.assetAddress});
  if(p.chainFamily==='TRON'){x.assetAddress=tronAddress(p.assetAddress).hex;x.query.holder.address='41'+'11'.repeat(20);}
  const raw=bytes(x),r=validateServiceAccountContext(raw,now);validateServiceAccountContextReport(r,raw);assert.equal(r.rpcAdmission,'NOT_GRANTED');assert.equal(r.authorityState,'UNKNOWN');assert.equal(r.serviceAccountIdentity,'UNKNOWN');assert.equal(r.queryExecution,'NOT_TESTED');
  assert.equal(r.inputSha256,hash(raw));assert.equal(r.accounts[0]!.provenance.referenceIdSha256,hash(x.query.holder.provenance.referenceId));assert(!JSON.stringify(r).includes('example.synthetic.balance'));
  assert.equal(r.assetAddress,p.chainFamily==='EVM'?getAddress(p.assetAddress):p.assetAddress);
  assert.equal(r.accounts[0]!.address,p.chainFamily==='EVM'?getAddress(x.query.holder.address):tronAddress(x.query.holder.address).base58);
 }
 assert.equal(calls,0);
 }finally{globalThis.fetch=prior;}
 const upper=fresh();upper.query.holder.address='0x'+'AB'.repeat(20);assert.equal(check(upper).accounts[0]!.address,getAddress(upper.query.holder.address));
 const catalog=JSON.parse(readFileSync(new URL('../docs/research/stablecoin-profiles.json',import.meta.url),'utf8'));
 for(const[id,p]of Object.entries(contextProfiles)){const a=catalog.profiles.find((a:any)=>a.id===id);assert.equal(a.chain.networkId,p.networkId);assert.equal(a.identifier.contractAddress.toLowerCase(),p.assetAddress.toLowerCase());}
});
test('allowance requires purpose and provenance for both accounts; identical accounts remain explicit context only',()=>{
 for(const chainFamily of ['EVM','TRON'])for(const same of [false,true]){
  const x=fresh();if(chainFamily==='TRON')Object.assign(x,{profileId:'tron-usdt',chainFamily,networkId:'728126428',assetAddress:contextProfiles['tron-usdt'].assetAddress});
  const owner=account(),spender=account();owner.purpose=spender.purpose='ALLOWANCE_REVIEW';owner.provenance.kind='PUBLIC_REFERENCE';
  owner.address=chainFamily==='TRON'?'41'+'11'.repeat(20):'0x'+'11'.repeat(20);spender.address=chainFamily==='TRON'?tronAddress('41'+(same?'11':'22').repeat(20)).base58:'0x'+(same?'11':'22').repeat(20);
  x.query={kind:'ALLOWANCE',owner,spender};const r=check(x);assert.equal(r.accounts.length,2);assert.equal(r.pairRelation,same?'SAME_ACCOUNT':'DISTINCT_ACCOUNTS');assert.equal(r.accounts[0]!.provenance.authenticity,'UNKNOWN');
  for(const mutate of [(y:any)=>delete y.query.spender,(y:any)=>delete y.query.owner.provenance,(y:any)=>y.query.spender.purpose='DEPOSIT_REVIEW',(y:any)=>y.query.holder=account()]){const y=structuredClone(x);mutate(y);assert.throws(()=>check(y));}
 }
});
test('wrong network/asset/checksum, zero and normalized token-self addresses are rejected before any output',()=>{
 for(const mutate of [(x:any)=>x.network='TESTNET',(x:any)=>x.networkId='01',(x:any)=>x.chainFamily='TRON',(x:any)=>x.profileId='solana-usdc',(x:any)=>x.assetAddress=contextProfiles['ethereum-usdt'].assetAddress,
  (x:any)=>x.query.holder.address='0x'+'0'.repeat(40),(x:any)=>x.query.holder.address=x.assetAddress,(x:any)=>x.assetAddress='0xa0B86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  (x:any)=>x.query.holder.address='0xfCb19e6a322b27c06842A71e8c725399f049AE3a']){const x=fresh();mutate(x);assert.throws(()=>check(x));}
 const tron=fresh();Object.assign(tron,{profileId:'tron-usdt',chainFamily:'TRON',networkId:'728126428',assetAddress:contextProfiles['tron-usdt'].assetAddress});
 for(const address of [tronAddress(tron.assetAddress).hex,'41'+'0'.repeat(40),'42'+'11'.repeat(20),'0x'+'11'.repeat(20),tron.assetAddress.slice(0,-1)+'u']){tron.query.holder.address=address;assert.throws(()=>check(tron));}
});
test('strict provenance rejects missing fields, invalid/future UTC, URLs, unknown/secret fields and duplicate decoded JSON keys',()=>{
 for(const mutate of [(x:any)=>delete x.query.holder.provenance,(x:any)=>delete x.query.holder.provenance.referenceId,(x:any)=>x.query.holder.provenance.kind='OBSERVED',
  (x:any)=>x.query.holder.provenance.scope='OWNERSHIP_VERIFIED',(x:any)=>x.query.holder.provenance.referenceId='https://secret.invalid/CANARY',(x:any)=>x.query.holder.provenance.referenceId='../secret',
  (x:any)=>x.query.holder.provenance.recordedAt='2026-02-30T00:00:00.000Z',(x:any)=>x.query.holder.provenance.recordedAt='2026-10-20T02:00:00.000Z',(x:any)=>x.query.holder.provenance.recordedAt='2026-10-20T00:00:00+00:00',
  (x:any)=>x.RPC_URL='CANARY',(x:any)=>x.query.holder.privateKey='CANARY',(x:any)=>x.query.holder.provenance.customerLabel='CANARY']){const x=fresh();mutate(x);assert.throws(()=>check(x),e=>!String(e).includes('CANARY'));}
 const raw=JSON.stringify(fresh());for(const text of [raw.replace('"schemaVersion":"1.0"','"schemaVersion":"9","schemaVersion":"1.0"'),raw.replace('"referenceId":','"referenceId":"ignored","reference\\u0049d":')])assert.throws(()=>validateServiceAccountContext(Buffer.from(text),now));
 assert.throws(()=>check([fresh(),fresh()]));assert.throws(()=>validateServiceAccountContext(Buffer.alloc(maxContextBytes+1,32),now));assert.throws(()=>validateServiceAccountContext(Buffer.from([0xff]),now));assert.throws(()=>validateServiceAccountContext(Buffer.from('{'),now));
 const escaped=fresh();escaped.query.holder.provenance.referenceId='record.valid';const text=JSON.stringify(escaped).replace('record.valid','record.\\u0076alid');assert.equal(validateServiceAccountContext(Buffer.from(text),now).accounts[0]!.provenance.referenceIdSha256,hash('record.valid'));
});
test('context report verification requires original bytes and rejects field, account, source, hash or admission tampering',()=>{
 const raw=bytes(fresh()),r=validateServiceAccountContext(raw,now);
 for(const mutate of [(x:any)=>x.rpcAdmission='GRANTED',(x:any)=>x.accounts[0].address='0x'+'22'.repeat(20),(x:any)=>x.accounts[0].provenance.authenticity='VERIFIED',
  (x:any)=>x.inputSha256='a'.repeat(64),(x:any)=>x.accounts[0].provenance.referenceIdSha256='a'.repeat(64),(x:any)=>x.pairRelation='SAME_ACCOUNT',(x:any)=>x.support='SUPPORTED']){const x=structuredClone(r);mutate(x);assert.throws(()=>validateServiceAccountContextReport(x,raw));}
 assert.throws(()=>validateServiceAccountContextReport(r,Buffer.concat([raw,Buffer.from('\n')])));
 const reordered=Object.fromEntries(Object.entries(r).reverse());validateServiceAccountContextReport(reordered,raw);
});
test('bounded input reader rejects symlinks, nonregular/oversized files and same path/inode output aliases',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'account-input-')),input=join(dir,'in.json'),out=join(dir,'out.json');
 try{await writeFile(input,bytes(fresh()));assert.deepEqual(await readContextInput(input,out),bytes(fresh()));await assert.rejects(readContextInput(input,input));
  await link(input,out);await assert.rejects(readContextInput(input,out));await rm(out);await symlink(input,join(dir,'link'));await assert.rejects(readContextInput(join(dir,'link'),out));
  await mkdir(join(dir,'directory'));await assert.rejects(readContextInput(join(dir,'directory'),out));await assert.rejects(readContextInput('/dev/null',out));
  await exec('mkfifo',[join(dir,'fifo')]);await assert.rejects(readContextInput(join(dir,'fifo'),out));await writeFile(input,Buffer.alloc(maxContextBytes+1));await assert.rejects(readContextInput(input,out));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('local CLI uses no RPC configuration, writes only validated report0600 and preserves input/output on failure',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'account-cli-')),input=join(dir,'in.json'),out=join(dir,'out.json');
 const command=['--use-env-proxy','--import','tsx','tools/research/service-account-context.ts','--input',input,'--out',out];
 try{await writeFile(input,bytes(fresh()));const r=await exec(process.execPath,command,{env:{...process.env,RPC_URL:'CANARY_NOT_A_URL',TRON_RPC_URL:'CANARY_NOT_A_URL'},timeout:15000});assert(!r.stdout.includes('CANARY'));assert(!r.stderr.includes('CANARY'));
  const saved=JSON.parse(await readFile(out,'utf8'));validateServiceAccountContextReport(saved,await readFile(input));assert.equal((await stat(out)).mode&0o777,0o600);
  await writeFile(out,'KEEP');await writeFile(input,'{"RPC_URL":"https://secret.invalid/CANARY"}');await assert.rejects(exec(process.execPath,command,{timeout:15000}),e=>!String(e).includes('CANARY'));assert.equal(await readFile(out,'utf8'),'KEEP');
  await writeFile(input,bytes(fresh()));await assert.rejects(exec(process.execPath,[...command.slice(0,-1),input],{timeout:15000}));assert.deepEqual(await readFile(input),bytes(fresh()));
 }finally{await rm(dir,{recursive:true,force:true});}
});
