import {readFile, mkdir, open, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {keccak256} from 'viem';
import {ReviewRpc} from '../../src/token-review/rpc.ts';
import {compareRuntime} from '../../src/token-review/runtime-comparison.ts';
import {workspaceEnvironment} from '../workspace-env.mjs';

export const target='0xdAC17F958D2ee523a2206206994597C13D831ec7';
export const root='.state/usdt-live-runtime-20261025';
const sha=b=>createHash('sha256').update(b).digest('hex');
const quantity=v=>typeof v==='string'&&/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(v);
const hash=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/i.test(v);
export async function consume(directory,planSha256){
  const handle=await open(`${directory}/consumed.json`,'wx',0o600);
  try{await handle.writeFile(JSON.stringify({startedAt:new Date().toISOString(),planSha256,executions:1}));await handle.sync();}
  finally{await handle.close();}
  const dir=await open(directory,'r');try{await dir.sync();}finally{await dir.close();}
}

// A single sequence; any rejection or provider failure permanently closes this guard.
export function boundary(endpoint,send,now=Date.now){
  const started=now();let attempts=0,returned=0,closed=false,height,pinned;
  const methods=['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getCode','eth_chainId','eth_getBlockByNumber'];
  return {summary:()=>({attempts,returned,closed}),async fetch(url,options){
    const fail=()=>{closed=true;throw new Error('USDT_FIXED_READ_FAILED');};
    if(closed||attempts!==returned||attempts>=6||now()-started>=120000)return fail();
    try{
      const body=JSON.parse(options?.body??'null'),i=attempts;
      if(new URL(url).href!==endpoint||options?.method!=='POST'||options.redirect!=='error'||body.jsonrpc!=='2.0'||body.id!==i+1||body.method!==methods[i]||!Array.isArray(body.params))return fail();
      const expected=i===2||i===5?[height,false]:i===3?[target,{blockHash:pinned,requireCanonical:true}]:[];
      if(JSON.stringify(body.params)!==JSON.stringify(expected))return fail();
      attempts++;
      const signal=AbortSignal.any([options.signal,AbortSignal.timeout(Math.min(10000,Math.max(1,120000-(now()-started))))]);
      const response=await send(url,{...options,signal});
      // ReviewRpc owns streaming size/envelope checks. Do not clone/buffer here.
      return response;
    }catch{return fail();}
  },accept(value){
    if(closed||returned+1!==attempts||now()-started>=120000)return failAccept();
    const i=returned;
    if((i===0||i===4)&&value!=='0x1'||i===1&&!quantity(value)||
      (i===2||i===5)&&(!value||value.number!==height||!hash(value.hash)||i===5&&value.hash!==pinned)||
      i===3&&(typeof value!=='string'||!/^0x(?:[0-9a-f]{2})+$/i.test(value)))return failAccept();
    if(i===1)height=value;if(i===2)pinned=value.hash;returned++;
    return value;
    function failAccept(){closed=true;throw new Error('USDT_FIXED_READ_FAILED');}
  },stop(){closed=true;}};
}

export async function observe(endpoint,{send=globalThis.fetch,now=Date.now}={}){
  const guard=boundary(endpoint,send,now),rpc=new ReviewRpc(endpoint,[target]);
  const original=globalThis.fetch;
  globalThis.fetch=guard.fetch;
  const call=async(method,params=[])=>guard.accept(await rpc.request(method,params));
  try{
    await call('eth_chainId');const height=await call('eth_blockNumber');
    const block=await call('eth_getBlockByNumber',[height,false]);rpc.pinHash(block.hash);
    const code=await call('eth_getCode',[target,{blockHash:block.hash,requireCanonical:true}]);
    await call('eth_chainId');await call('eth_getBlockByNumber',[height,false]);
    return {status:'OBSERVED',block:{number:BigInt(height).toString(),hash:block.hash},code,observedHash:keccak256(code),...guard.summary()};
  }catch{guard.stop();return {status:'INCONCLUSIVE',error:'USDT_FIXED_READ_FAILED',...guard.summary()};}
  finally{globalThis.fetch=original;}
}

async function main(){
  process.umask(0o077);
  if(!process.execArgv.includes('--use-env-proxy'))throw new Error('PROXY_MODE_REQUIRED');
  const env=await workspaceEnvironment();if(!env.RPC_URL)throw new Error('RPC_NOT_CONFIGURED');
  const endpoint=new URL(env.RPC_URL).href;
  const old='.state/usdt-offline-recompile-20261025',companion='.state/usdt-stored-runtime-analysis-20261025';
  const rows=JSON.parse(await readFile(`${companion}/input-hashes.json`,'utf8'));
  for(const path of [`${companion}/report.json`,`${companion}/report.md`,`${companion}/input-hashes.json`,`${companion}/validation.json`,'tools/research/usdt-runtime-once.mjs','src/token-review/rpc.ts']){
    if(!rows.some(r=>r.path===path))rows.push({path,sha256:sha(await readFile(path))});
  }
  const verify=async()=>{for(const r of rows){if(sha(await readFile(r.path))!==r.sha256)throw new Error('INPUT_CHANGED');}};
  await verify();
  const artifact=await readFile(`${old}/output/artifacts/source-0.compile-result.json`);
  if(artifact.length!==2381870||sha(artifact)!=='ed20b9809cddd888d90bf0a8dfb8d33a3fca03dd8ba476c83a72de3fa51efdc9')throw new Error('ARTIFACT_MISMATCH');
  const saved=JSON.parse(artifact),runtime=saved.selected.evm.deployedBytecode;
  if(saved.compiler!=='0.4.18+commit.9cf6e910.Emscripten.clang'||Object.hasOwn(runtime,'immutableReferences')||JSON.stringify(runtime.linkReferences)!=='{}')throw new Error('ARTIFACT_STRUCTURE');
  const prepared=compareRuntime(runtime,undefined,{},saved.compiler);
  if(prepared.runtimeHash!=='0xc60427dda11e864272d53e4327226c4f1b67b81e36124a73e23f197649a8cc27'||prepared.originalRuntime.length!==22152)throw new Error('RUNTIME_MISMATCH');
  await mkdir(root,{mode:0o700});
  const emit=async(name,value)=>{const h=await open(`${root}/${name}`,'wx',0o600);try{await h.writeFile(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');await h.sync();}finally{await h.close();}};
  const plan={schema:'USDTFixedReadPlan/1.0',chainId:'1',target,maxRpc:6,maxSeconds:120,retries:0,endpointSwitches:0,compilerExecutions:0,proxyMode:'NODE_USE_ENV_PROXY',inputHashes:rows,cost:'UNKNOWN'};
  await emit('plan.json',plan);await consume(root,sha(await readFile(`${root}/plan.json`)));
  const startedAt=new Date().toISOString();
  let result;
  try{
    const observed=await observe(endpoint);
    await verify();
    const comparison=compareRuntime(runtime,observed.status==='OBSERVED'?observed.observedHash:undefined,{},saved.compiler);
    result={schema:'StoredRuntimeLiveComparison/1.0',startedAt,finishedAt:new Date().toISOString(),identity:{chainId:'1',address:target},observation:observed,comparison,binding:'UNKNOWN',cost:'UNKNOWN',compilerExecutions:0,originalsUnchanged:true,consumed:true};
    await emit('report.json',result);
    await emit('report.md',`# USDT 저장 runtime·고정 블록 코드 대조\n\n${result.startedAt} ~ ${result.finishedAt}\n\n관측 ${observed.status}; RPC ${observed.attempts}/6; 비교 ${comparison.reason}; matched ${comparison.matched}; binding UNKNOWN; 비용 UNKNOWN.\n\n${observed.block?`블록 ${observed.block.number}, hash ${observed.block.hash}.`:''}\n\n전체 코드 비교만 수행했으며 기존 보고서·판정을 유지한다. 생성자/원본 소스 진위/실제 dispatch는 미확인이다.\n`);
    const names=['plan.json','consumed.json','report.json','report.md'];
    if((await stat(root)).mode%512!==448)throw new Error('PERMISSIONS');
    for(const name of names)if((await stat(`${root}/${name}`)).mode%512!==384)throw new Error('PERMISSIONS');
    await emit('validation.json',{result:'PASS',verifiedInputFiles:rows.length,originalsUnchanged:true,permissionsVerified:true,attempts:observed.attempts,returned:observed.returned,compilerExecutions:0});
    console.log(JSON.stringify({status:observed.status,attempts:observed.attempts,returned:observed.returned,block:observed.block??null,comparison:comparison.reason,matched:comparison.matched,binding:'UNKNOWN',validation:'PASS'}));
  }catch{
    await emit('failed.json',{status:'INCONCLUSIVE',error:'EXECUTION_OR_VALIDATION_INCOMPLETE',retryAllowed:false,finishedAt:new Date().toISOString()});
    throw new Error('EXECUTION_OR_VALIDATION_INCOMPLETE');
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){main().catch(()=>{console.error('USDT one-shot incomplete; details omitted; do not retry.');process.exitCode=1;});}
