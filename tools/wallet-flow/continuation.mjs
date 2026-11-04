import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {USDT,TXID,validateSnapshot,analyze} from '../../web/wallet-flow/model.mjs';
import {parseExact,sha256,normalizeTransaction} from './normalize.mjs';
import {publishSnapshot} from './collector.mjs';

export const CONTINUATION_LIMITS=Object.freeze({requests:41,transactions:20,responseBytes:2*1024*1024,bytes:16*1024*1024,seconds:180,intervalMs:1100});
export function continuationPlan(snapshot,eventId){
 validateSnapshot(snapshot);const analysis=analyze(snapshot);
 const eligible=new Set(analysis.paths.filter(p=>p.eventIds.length===2).map(p=>p.eventIds[1]));
 const event=snapshot.events.find(e=>e.id===eventId),tx=snapshot.transactions.find(t=>t.txid===event?.txid);
 if(snapshot.kind!=='observed'||!eligible.has(eventId)||!tx||tx.timestamp>=snapshot.window.to)throw Error('INVALID_CONTINUATION_ANCHOR');
 return {version:1,kind:'outgoing-continuation',parentHash:sha256(JSON.stringify(snapshot)),rootTxid:snapshot.rootTxid,eventId,address:event.to,from:tx.timestamp,to:snapshot.window.to,limits:CONTINUATION_LIMITS,retries:0};
}

// One immutable follow-up, using old evidence without repeating its provider calls.
export async function collectContinuation(plan,{parentDirectory,directory,fetchImpl=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),apiKey,freeTierConfirmed=false}={}){
 if(apiKey&&!freeTierConfirmed)throw Error('FREE_TIER_CONFIRMATION_REQUIRED');
 const parent=validateSnapshot(JSON.parse(await readFile(join(parentDirectory,'snapshot.json'),'utf8')));
 if(JSON.stringify(continuationPlan(parent,plan.eventId))!==JSON.stringify(plan))throw Error('PLAN_MISMATCH');
 await mkdir(directory,{mode:0o700});
 const save=(name,value)=>writeFile(join(directory,name),Buffer.isBuffer(value)?value:JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
 await save('plan.json',plan);
 let calls=0,bytes=0,last=-Infinity;const started=now(),snapshot=structuredClone(parent),raw=[];
 try{
  await publishSnapshot(parentDirectory,join(directory,'parent-verified.json'));
  const parentReceipt=JSON.parse(await readFile(join(parentDirectory,'receipt.json'),'utf8'));
  for(const row of parentReceipt.raw){
   if(!Number.isSafeInteger(row.ordinal)||row.ordinal<1||row.ordinal>4096)throw Error('INVALID_PARENT_ORDINAL');
   for(const suffix of ['.json','.intent.json'])await copyFile(join(parentDirectory,row.ordinal+suffix),join(directory,row.ordinal+suffix),constants.COPYFILE_EXCL);
   raw.push(row);
  }
  const inheritedRawCount=raw.length;let ordinal=Math.max(0,...raw.map(r=>r.ordinal));
  async function request(path,body){
   if(calls>=plan.limits.requests||now()-started>=plan.limits.seconds*1000)throw Error('RUN_LIMIT');
   const delay=plan.limits.intervalMs-(now()-last);if(delay>0)await sleep(delay);
   if(now()-started>=plan.limits.seconds*1000)throw Error('RUN_LIMIT');
   calls++;ordinal++;last=now();
   await save(ordinal+'.intent.json',{path,body:body??null,startedAt:new Date(now()).toISOString()});
   const response=await fetchImpl('https://api.trongrid.io'+path,{method:body?'POST':'GET',headers:{accept:'application/json',...(body?{'content-type':'application/json'}:{}),...(apiKey?{'TRON-PRO-API-KEY':apiKey}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(20000,plan.limits.seconds*1000-(now()-started))))});
   if(!response.ok){await response.body?.cancel();throw Error('HTTP_'+response.status);}
   let size=0;const chunks=[];
   for await(const chunk of response.body){size+=chunk.length;bytes+=chunk.length;if(size>plan.limits.responseBytes||bytes>plan.limits.bytes)throw Error('BYTE_LIMIT');chunks.push(chunk);}
   const buffer=Buffer.concat(chunks),hash=sha256(buffer);await save(ordinal+'.json',buffer);raw.push({ordinal,sha256:hash});
   snapshot.sources.push({sha256:hash,bytes:size,retrievedAt:new Date(now()).toISOString(),endpointKind:path.split('?')[0].replace(/T[1-9A-HJ-NP-Za-km-z]{33}/g,'{address}')});
   const data=parseExact(buffer.toString('utf8'));if(data?.Error||data?.error||data?.success===false)throw Error('PROVIDER_BODY_ERROR');return {data,hash};
  }
  const query=new URLSearchParams({only_confirmed:'true',only_from:'true',limit:'20',min_timestamp:String(plan.from),max_timestamp:String(plan.to),order_by:'block_timestamp,asc',contract_address:USDT});
  const history=await request(`/v1/accounts/${plan.address}/transactions/trc20?${query}`);
  if(!Array.isArray(history.data.data)||history.data.data.length>20)throw Error('INVALID_HISTORY');
  const seen=new Set(snapshot.transactions.map(t=>t.txid));let added=0;
  for(const row of history.data.data){
   if(row.type!=='Transfer')continue;
   if(row.from!==plan.address||row.token_info?.address!==USDT||!TXID.test(row.transaction_id))throw Error('HISTORY_BINDING');
   const id=row.transaction_id;if(seen.has(id))continue;
   if(added>=plan.limits.transactions)throw Error('TRANSACTION_LIMIT');
   const body=await request('/walletsolidity/gettransactionbyid',{value:id}),receipt=await request('/walletsolidity/gettransactioninfobyid',{value:id});
   if(body.data.txID!==id)throw Error('TXID_MISMATCH');
   const n=normalizeTransaction(body.data,receipt.data,receipt.hash);
   if(n.tx.timestamp<plan.from||n.tx.timestamp>plan.to||!n.events.some(e=>e.kind==='USDT_TRANSFER'&&e.from===plan.address))throw Error('OUTGOING_BINDING');
   snapshot.transactions.push(n.tx);snapshot.events.push(...n.events);seen.add(id);added++;
  }
  const existing=new Set(snapshot.addresses.map(a=>a.address));
  for(const address of new Set([...snapshot.transactions.map(t=>t.caller),...snapshot.events.flatMap(e=>[e.from,e.to])]))if(!existing.has(address)){
   snapshot.addresses.push({address,labels:[],balance:null});snapshot.coverage.push({address,transfers:'not-collected',transactions:'not-collected',reasons:['Address discovered but not expanded within the collection bound.']});existing.add(address);
  }
  const coverage=snapshot.coverage.find(c=>c.address===plan.address);
  coverage.reasons.push(`입금 후 송금 방향 보완: ${new Date(plan.from).toISOString()} ~ ${new Date(plan.to).toISOString()}, 첫 20개 색인 항목 중 새 거래 ${added}건. ${history.data.meta?.fingerprint?'다음 페이지 미조회.':'해당 방향 응답의 마지막 페이지.'} 다른 방향·기간의 완전성을 뜻하지 않음.`);
  snapshot.createdAt=new Date(now()).toISOString();validateSnapshot(snapshot);
  await save('snapshot.json',snapshot);await save('receipt.json',{status:'COLLECTED',calls,bytes,inheritedRawCount,raw,addedTransactions:added,partial:true});
  return snapshot;
 }catch(error){await save('failure.json',{status:'FAILED',code:/^[A-Z0-9_]+$/.test(error.message)?error.message:'COLLECTION_FAILED',calls,bytes,at:new Date(now()).toISOString()});throw Error('CONTINUATION_FAILED');}
}
