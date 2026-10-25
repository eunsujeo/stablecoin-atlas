import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {observe,boundary,consume,target} from '../tools/research/usdt-runtime-once.mjs';
const endpoint='http://fixture.invalid/',h='0x'+'12'.repeat(32);
function transport(change=()=>{}){
  const requests=[];
  return {requests,async send(url,options){
    assert.equal(url,endpoint);assert.equal(options.redirect,'error');assert(options.signal);
    const q=JSON.parse(options.body);requests.push(q);
    let result=['0x1','0x10',{number:'0x10',hash:h},'0x60006000','0x1',{number:'0x10',hash:h}][requests.length-1];
    const replacement=change(q,requests.length);if(replacement!==undefined)result=replacement;
    return new Response(JSON.stringify({jsonrpc:'2.0',id:q.id,result}));
  }};
}
test('USDT fixed read observes six requests and pins only one address',async()=>{
  const t=transport(),r=await observe(endpoint,{send:t.send});
  assert.equal(r.status,'OBSERVED');assert.equal(r.attempts,6);assert.equal(r.returned,6);
  assert.deepEqual(r.block,{number:'16',hash:h});assert.equal(r.code,'0x60006000');
  assert.deepEqual(t.requests[3].params,[target,{blockHash:h,requireCanonical:true}]);
  assert.deepEqual(t.requests.map(q=>q.method),['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_chainId','eth_getBlockByNumber']);
});
test('USDT chain, header, empty code, ending hash and ending chain failures stop without retry',async()=>{
  for(const [at,value] of [[1,'0x2'],[3,{number:'0x11',hash:h}],[4,'0x'],[5,'0x2'],[6,{number:'0x10',hash:'0x'+'34'.repeat(32)}],[6,{number:'0x11',hash:h}]]){
    const t=transport((_q,i)=>i===at?value:undefined),r=await observe(endpoint,{send:t.send});
    assert.equal(r.status,'INCONCLUSIVE');assert.equal(r.attempts,at);assert.equal(t.requests.length,at);assert.equal(r.code,undefined);assert.equal(r.observedHash,undefined);
  }
});
test('USDT RPC error, bad envelope, HTTP, timeout and oversized body are inconclusive',async()=>{
  for(const send of [async()=>new Response(JSON.stringify({jsonrpc:'2.0',id:1,error:{code:-32000,message:'private provider text'}})),
    async()=>new Response(JSON.stringify({jsonrpc:'2.0',id:99,result:'0x1'})),
    async()=>new Response('private provider text',{status:403}),
    async()=>{throw new DOMException('private endpoint','TimeoutError');},
    async()=>new Response('x'.repeat(2097153))]){
    const r=await observe(endpoint,{send});assert.equal(r.status,'INCONCLUSIVE');assert.equal(r.attempts,1);
    assert(!JSON.stringify(r).includes('private'));assert.equal(r.returned,0);
  }
});
test('USDT boundary rejects wrong methods, targets and expired budget before send',async()=>{
  const request=(method,params,id=1)=>({method:'POST',redirect:'error',signal:AbortSignal.timeout(1000),body:JSON.stringify({jsonrpc:'2.0',id,method,params})});
  for(const options of [request('eth_call',[]),request('eth_chainId',['0x1']),request('eth_chainId',[],2)]){
    let sent=0;const b=boundary(endpoint,async()=>{sent++;});
    await assert.rejects(b.fetch(endpoint,options));assert.equal(sent,0);
    await assert.rejects(b.fetch(endpoint,request('eth_chainId',[])));assert.equal(sent,0);
  }
  let clock=0,sent=0;const expired=boundary(endpoint,async()=>{sent++;},()=>clock);clock=120000;
  await assert.rejects(expired.fetch(endpoint,request('eth_chainId',[])));assert.equal(sent,0);
  const t=transport(),b=boundary(endpoint,t.send);
  for(const [i,method,params,value] of [[1,'eth_chainId',[],'0x1'],[2,'eth_blockNumber',[],'0x10'],[3,'eth_getBlockByNumber',['0x10',false],{number:'0x10',hash:h}]]){
    await b.fetch(endpoint,request(method,params,i));b.accept(value);
  }
  await assert.rejects(b.fetch(endpoint,request('eth_getCode',['0x'+'11'.repeat(20),{blockHash:h,requireCanonical:true}],4)));
  assert.equal(t.requests.length,3);
});
test('USDT boundary rejects a seventh call and crossing the overall deadline',async()=>{
  let clock=0;const t=transport((_q,i)=>{if(i===4)clock=120000;}),r=await observe(endpoint,{send:t.send,now:()=>clock});
  assert.equal(r.status,'INCONCLUSIVE');assert.equal(r.attempts,4);
  const request=(i,method,params=[])=>({method:'POST',redirect:'error',signal:AbortSignal.timeout(1000),body:JSON.stringify({jsonrpc:'2.0',id:i,method,params})});
  const good=transport(),b=boundary(endpoint,good.send);
  const values=['0x1','0x10',{number:'0x10',hash:h},'0x6000','0x1',{number:'0x10',hash:h}];
  const methods=['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_chainId','eth_getBlockByNumber'];
  for(let i=0;i<6;i++){await b.fetch(endpoint,request(i+1,methods[i],i===2||i===5?['0x10',false]:i===3?[target,{blockHash:h,requireCanonical:true}]:[]));b.accept(values[i]);}
  await assert.rejects(b.fetch(endpoint,request(7,'eth_chainId')));assert.equal(good.requests.length,6);
});
test('USDT wx consumption allows one concurrent owner and forbids reuse',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'usdt-read-consume-'));
  try{
    const results=await Promise.allSettled([consume(dir,'a'),consume(dir,'a')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await stat(join(dir,'consumed.json'))).mode&0o777,0o600);
    await assert.rejects(consume(dir,'a'));
  }finally{await rm(dir,{recursive:true,force:true});}
});
