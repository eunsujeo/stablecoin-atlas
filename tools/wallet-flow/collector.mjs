import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tronAddress} from '../../src/tron/address.ts';
import {USDT,TXID,validateSnapshot} from '../../web/wallet-flow/model.mjs';
import {sha256,parseExact,normalizeTransaction,normalizeBalance} from './normalize.mjs';
export const LIMITS=Object.freeze({requests:80,bytes:16*1024*1024,responseBytes:2*1024*1024,seconds:300,addresses:4,pages:2,pageSize:50,transactions:24,intervalMs:1100});
export function collectionPlan({txid,seeds=[],hours=6}){if(!TXID.test(txid)||!Array.isArray(seeds)||seeds.length>2||!Number.isInteger(hours)||hours<1||hours>24)throw Error('INVALID_PLAN');return {version:1,provider:'TronGrid',origin:'https://api.trongrid.io',txid,seeds:[...new Set(seeds.map(a=>tronAddress(a).base58))],hours,limits:LIMITS,retries:0,automatic:false,internalTrx:'not-collected',labelLookup:'not-collected'};}
export async function collect(plan,{directory,apiKey,freeTierConfirmed=false,fetchImpl=fetch,now=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms)),limits=LIMITS}={}){
 if(JSON.stringify(collectionPlan(plan))!==JSON.stringify(plan))throw Error('PLAN_MISMATCH');if(apiKey&&!freeTierConfirmed)throw Error('FREE_TIER_CONFIRMATION_REQUIRED');
 // New exclusive run directory is the durable claim; failures never replay this run.
 await mkdir(directory,{mode:0o700});await writeFile(join(directory,'plan.json'),JSON.stringify(plan),{flag:'wx',mode:0o600});
 const started=now(),sources=[],transactions=[],events=[],coverage=[],balances=new Map(),scanned=new Set(),visited=new Set(),queue=[],seenTx=new Set(),raw=[];let calls=0,bytes=0,last=-Infinity,partial=false;
 async function request(path,body){
  if(calls>=limits.requests||now()-started>=limits.seconds*1000)throw Error('RUN_LIMIT');const wait=limits.intervalMs-(now()-last);if(wait>0)await sleep(wait);if(now()-started>=limits.seconds*1000)throw Error('RUN_LIMIT');
  const ordinal=++calls;last=now();await writeFile(join(directory,`${ordinal}.intent.json`),JSON.stringify({path,body:body??null,startedAt:new Date(now()).toISOString()}),{flag:'wx',mode:0o600});
  const signal=AbortSignal.timeout(Math.max(1,Math.min(20000,limits.seconds*1000-(now()-started))));
  const response=await fetchImpl(plan.origin+path,{method:body?'POST':'GET',headers:{accept:'application/json',...(body?{'content-type':'application/json'}:{}),...(apiKey?{'TRON-PRO-API-KEY':apiKey}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal});
  if(!response.ok){await response.body?.cancel();throw Error(`PROVIDER_HTTP_${response.status}`);}const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;bytes+=chunk.length;if(size>limits.responseBytes||bytes>limits.bytes)throw Error('BYTE_LIMIT');chunks.push(chunk);}const buffer=Buffer.concat(chunks),hash=sha256(buffer),retrievedAt=new Date(now()).toISOString();await writeFile(join(directory,`${ordinal}.json`),buffer,{flag:'wx',mode:0o600});sources.push({sha256:hash,bytes:size,retrievedAt,endpointKind:path.split('?')[0].replace(/T[1-9A-HJ-NP-Za-km-z]{33}/g,'{address}')});raw.push({ordinal,sha256:hash});
  const data=parseExact(buffer.toString('utf8'));if(data?.Error||data?.error||data?.success===false)throw Error('PROVIDER_BODY_ERROR');return {data,hash,retrievedAt};
 }
 async function transaction(id){if(seenTx.has(id))return; if(!TXID.test(id))throw Error('INVALID_TRANSACTION_ID');if(seenTx.size>=limits.transactions){partial=true;return;}seenTx.add(id);const body=await request('/walletsolidity/gettransactionbyid',{value:id}),receipt=await request('/walletsolidity/gettransactioninfobyid',{value:id});if(body.data.txID!==id)throw Error('TXID_MISMATCH');const result=normalizeTransaction(body.data,receipt.data,receipt.hash);transactions.push(result.tx);events.push(...result.events);return result;}
 let snapshot;
 try{
 const root=await transaction(plan.txid);const deposit=root.events.filter(e=>e.kind==='USDT_TRANSFER');if(!deposit.length)throw Error('ROOT_HAS_NO_SUCCESSFUL_USDT_TRANSFER');const from=root.tx.timestamp-Math.min(3600000,plan.hours*1800000),to=from+plan.hours*3600000; // bounded prehistory and a nonzero post-deposit window
 queue.push(...plan.seeds,...deposit.map(e=>e.to));
 while(queue.length&&scanned.size<limits.addresses){const address=queue.shift();if(scanned.has(address))continue;scanned.add(address);const c={address,transfers:'partial',transactions:'partial',reasons:['Address history is provider-indexed; incoming resource visibility and internal TRX are not guaranteed.']};coverage.push(c);
 const balance=await request(`/v1/accounts/${address}?only_confirmed=true`);balances.set(address,normalizeBalance(balance.data,address,balance.hash,balance.retrievedAt));
 for(const [suffix,key]of [['/transactions/trc20','transfers'],['/transactions','transactions']]){
 let fingerprint=null;const seenPages=new Set();for(let page=0;page<limits.pages;page++){
 const query=new URLSearchParams({only_confirmed:'true',limit:String(limits.pageSize),min_timestamp:String(from),max_timestamp:String(to),order_by:'block_timestamp,asc',...(key==='transfers'?{contract_address:USDT}:{}),...(fingerprint?{fingerprint}: {})});const result=await request(`/v1/accounts/${address}${suffix}?${query}`);if(!Array.isArray(result.data.data))throw Error('INVALID_HISTORY');
 for(const item of result.data.data){const id=key==='transfers'?item.transaction_id:item.txID;if(!TXID.test(id))throw Error('INVALID_HISTORY_TXID');const r=await transaction(id);if(r)for(const e of r.events.filter(e=>e.kind==='USDT_TRANSFER'&&e.from===address&&r.tx.timestamp>=root.tx.timestamp))if(!visited.has(e.to)){visited.add(e.to);queue.push(e.to);}}
 fingerprint=result.data.meta?.fingerprint;if(fingerprint!==undefined&&fingerprint!==null&&(typeof fingerprint!=='string'||fingerprint.length>2048))throw Error('INVALID_CURSOR');if(!fingerprint){c[key]=partial?'partial':'complete';break;}if(seenPages.has(fingerprint))throw Error('REPEATED_CURSOR');seenPages.add(fingerprint);
 }if(c[key]!=='complete')c.reasons.push(key+' page/transaction limit reached; omitted events are unknown.');
 }
 }
 const all=new Set([...scanned,...transactions.map(t=>t.caller),...events.flatMap(e=>[e.from,e.to])]);for(const a of all)if(!scanned.has(a))coverage.push({address:a,transfers:'not-collected',transactions:'not-collected',reasons:['Address discovered but not expanded within the collection bound.']});
 snapshot={schemaVersion:1,network:'tron-mainnet',token:USDT,kind:'observed',rootTxid:plan.txid,createdAt:new Date(now()).toISOString(),window:{from,to},addresses:[...all].sort().map(address=>({address,labels:[],balance:balances.get(address)??null})),transactions,events,coverage,sources};validateSnapshot(snapshot);
 await writeFile(join(directory,'snapshot.json'),JSON.stringify(snapshot,null,2),{flag:'wx',mode:0o600});await writeFile(join(directory,'receipt.json'),JSON.stringify({status:'COLLECTED',calls,bytes,raw,partial:partial||queue.length>0||coverage.some(c=>c.transfers!=='complete'||c.transactions!=='complete')}),{flag:'wx',mode:0o600});return snapshot;
 }catch(error){await writeFile(join(directory,'failure.json'),JSON.stringify({status:'FAILED',code:/^[A-Z0-9_]+$/.test(error.message)?error.message:'COLLECTION_FAILED',calls,bytes,raw,at:new Date(now()).toISOString()}),{flag:'wx',mode:0o600});throw Error('COLLECTION_FAILED');}
}
export async function publishSnapshot(directory,destination){
 const snapshot=validateSnapshot(JSON.parse(await readFile(join(directory,'snapshot.json'),'utf8'))),receipt=JSON.parse(await readFile(join(directory,'receipt.json'),'utf8'));
 if(receipt.status!=='COLLECTED'||snapshot.kind!=='observed')throw Error('UNVERIFIED_COLLECTION');
 const bodies=new Map(),receipts=new Map(),balances=new Map();for(const row of receipt.raw){const bytes=await readFile(join(directory,`${row.ordinal}.json`));if(sha256(bytes)!==row.sha256||!snapshot.sources.some(s=>s.sha256===row.sha256))throw Error('SOURCE_HASH_MISMATCH');const intent=JSON.parse(await readFile(join(directory,`${row.ordinal}.intent.json`),'utf8')),data=parseExact(bytes.toString('utf8'));const account=intent.path.match(/^\/v1\/accounts\/(T[1-9A-HJ-NP-Za-km-z]{33})\?only_confirmed=true$/);if(account){const source=snapshot.sources.find(s=>s.sha256===row.sha256);balances.set(account[1],normalizeBalance(data,account[1],row.sha256,source.retrievedAt));}if(intent.path==='/walletsolidity/gettransactionbyid')bodies.set(intent.body.value,data);if(intent.path==='/walletsolidity/gettransactioninfobyid')receipts.set(intent.body.value,{data,hash:row.sha256});}
 for(const a of snapshot.addresses)if(JSON.stringify(a.balance)!==JSON.stringify(balances.get(a.address)??null))throw Error('BALANCE_TAMPERED');
 const actual=[];for(const tx of snapshot.transactions){const r=receipts.get(tx.txid);if(!r||!bodies.has(tx.txid))throw Error('SOURCE_MISSING');const n=normalizeTransaction(bodies.get(tx.txid),r.data,r.hash);if(JSON.stringify(n.tx)!==JSON.stringify(tx))throw Error('TRANSACTION_TAMPERED');actual.push(...n.events);}
 if(JSON.stringify(actual)!==JSON.stringify(snapshot.events))throw Error('EVENTS_TAMPERED');
 const bytes=JSON.stringify(snapshot,null,2);if(Buffer.byteLength(bytes)>2*1024*1024)throw Error('PUBLIC_BYTE_LIMIT');await writeFile(destination,bytes,{flag:'wx',mode:0o600});return {status:'EXPORTED',transactions:snapshot.transactions.length,events:snapshot.events.length};
}
