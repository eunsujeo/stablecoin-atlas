import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { Ajv } from 'ajv';
import { compilerPin,tronAllowanceProbes,sha256 } from './compiler.js';
import { tvmGenesis,tvmImage } from './runtime.js';
import { expectedContract } from './transaction.js';
import { tronAddress } from '../address.js';
import { allowanceCasePlan } from './allowance-plan.js';
import { allowanceProbeAmount,replayAllowanceProof } from './allowance-scenarios.js';
import { json } from '../../domain/evaluator.js';
const schema=JSON.parse(readFileSync(new URL('../../../schemas/private-tvm-allowance.v1.schema.json',import.meta.url),'utf8'));
const validate=new Ajv({strict:true}).compile(schema);
const check=(ok:unknown)=>{if(!ok)throw new Error('PRIVATE_TVM_ALLOWANCE_REPORT_INVALID');};
const equal=(a:unknown,b:unknown)=>check(isDeepStrictEqual(a,b));
const number=(x:any)=>{check(typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x));return BigInt(x);};
function head(h:any){check(h&&typeof h.id==='string'&&/^[a-f0-9]{64}$/i.test(h.id));check(BigInt('0x'+h.id.slice(0,16))===number(h.number));}
function runtime(r:any,observed:boolean){
 check(r.kind==='TRON_PRIVATE_TVM_ALLOWANCE_PROBE');equal(r.image,tvmImage);
 check(Number.isFinite(Date.parse(r.startedAt))&&Number.isFinite(Date.parse(r.completedAt))&&Date.parse(r.completedAt)>=Date.parse(r.startedAt));
 equal(r.resources.container,'mca-tvm-'+r.runId);equal(r.resources.network,r.resources.container+'-net');
 for(const k of ['genesis','headBefore','headAfter'])if(r.observations[k])head(r.observations[k]);
 if(r.observations.fixtureRequestCount!==undefined){const counts=r.observations.fixtureOperationCounts;check(counts&&Object.keys(counts).every(k=>['deploy','trigger','broadcast','receipt','contract','constant','account','block'].includes(k)));equal(Object.values(counts).reduce((n:bigint,v)=>n+number(v),0n),number(r.observations.fixtureRequestCount));}
 if(r.outcome==='READY'){
  equal(r.cleanup,{container:'REMOVED',network:'REMOVED'});check(!r.failure&&r.resources.containerId&&r.resources.networkId);
  const o=r.observations;equal(o.genesis,{number:'0',id:tvmGenesis});check(number(o.headAfter.number)>number(o.headBefore.number));
  equal(o.peerCount,'0');equal(o.hostPublishedPorts,'0');check(o.internalNetwork===true&&o.containerLoopbackProbe===true);equal(o.codeVersion,'4.8.2');
  check(o.imageId&&o.probe&&o.resourceSample);equal(o.requestedAccountCount,'3');equal(o.automaticAccountsRequested,true);check(number(o.fixtureRequestCount)>0n);
  equal(o.memoryLimitBytes,'2147483648');equal(o.cpuLimit,'2');equal(o.pidsLimit,'256');
 }else{check(!observed&&typeof r.failure==='string');}
}
function callRecord(record:any,e:any,variant:string,operation:'approve'|'transferFrom',amount:bigint,complete:boolean){
 if(!record){check(!complete);return;}
 if(record.proof){
  const p=record.proof;equal(p.variant,variant);equal(p.operation,operation);equal(p.amount,amount.toString());
  equal(tronAddress(p.owner).base58,e.actors.owner);equal(tronAddress(p.recipient).base58,e.actors.recipient);equal(tronAddress(p.spender).base58,e.actors.spender);equal(tronAddress(p.contract).base58,e.contract);
  equal(record.before,p.before);equal(record.after,p.after);equal(record.amount,p.amount);equal(record.txId,p.txid);
  if(record.outcome==='OBSERVED'){const observation=replayAllowanceProof(p);equal(record.observation,observation);equal(record.stage,'VERIFIED');}
  else{check(!complete&&record.observation===undefined);}
 }else check(!complete&&record.outcome!=='OBSERVED');
}
function caseReport(r:any){
 const observed=r.outcome==='OBSERVED',e=r.evidence,b=r.build,variant=b.variant as keyof typeof tronAllowanceProbes,spec=tronAllowanceProbes[variant];check(spec);
 equal(b.sourceFile,'TronAllowanceProbes.sol');equal(b.contractName,spec.contractName);
 for(const k of ['version','file','sha256','manifestCommit']as const)equal(b[k],compilerPin[k]);check(b.reportedVersion.startsWith(compilerPin.version));
 equal(b.settings,{optimizer:{enabled:false,runs:200},evmVersion:'istanbul',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}});
 equal(e.stateResponseBlock,'UNKNOWN');runtime(r.runtime,observed);
 equal(r.runtimeOwnership,r.runtime.outcome==='READY'?'OBSERVED_OWNED_ISOLATED_RUNTIME':'UNKNOWN');
 if(r.runtime.observations.fixture)equal(r.runtime.observations.fixture,e);
 if(e.contract){equal(expectedContract(e.owner,e.txId).base58,e.contract);check(e.receipt||!observed);}
 if(e.receipt){equal(e.receipt.txId,e.txId);equal(e.receipt.executionResult,'SUCCESS');head({number:e.receipt.blockNumber,id:e.receipt.blockId});}
 if(e.allowanceRuntimeCode){equal(e.allowanceRuntimeCode.sha256,sha256(Buffer.from(e.allowanceRuntimeCode.bytecode,'hex')));equal(e.allowanceRuntimeCode.sha256,b.runtimeBytecodeSha256);equal(e.runtimeCodeMatchesBuild,true);}
 if(e.initialState){equal(e.initialState,{name:'Private TVM Fixture',symbol:'TVMF',decimals:6,totalSupply:(2n**128n).toString(),ownerBalance:(2n**128n).toString(),ownerSelfAllowance:'0',observedBlockOrSlot:'UNKNOWN'});}
 if(e.allowanceProbe){
  const p=e.allowanceProbe;equal(p.variant,variant);check(['approve','transferFrom'].includes(p.operation)&&(spec.operation==='both'||spec.operation===p.operation));
  equal(e.scenarioProfile,'ALLOWANCE_PROBE');equal(e.scenarioVersion,'1.0.0');check(e.actors&&new Set(Object.values(e.actors)).size===3);equal(e.owner,e.actors.owner);
  if(p.initialSample)equal(p.initialSample,{owner:(2n**128n).toString(),recipient:'0',spender:'0',allowance:'0',totalSupply:(2n**128n).toString()});
  if(p.operation==='transferFrom'){
   callRecord(p.setup,e,'standard','approve',allowanceProbeAmount+7n,observed);
   if(p.setup?.outcome==='OBSERVED')equal(p.setup.before,p.initialSample);
   if(p.target?.before){check(p.setup?.outcome==='OBSERVED');equal(p.target.before,p.setup.after);}
  }else{check(p.setup===undefined);if(p.target?.before)equal(p.target.before,p.initialSample);}
  callRecord(p.target,e,variant,p.operation,allowanceProbeAmount,observed);
  if(p.target?.outcome==='OBSERVED'){equal(p.stage,'VERIFIED');equal(p.outcome,'OBSERVED');}
  if(observed)check(p.initialSample&&p.target?.observation);
 }
 if(observed){equal(r.runtime.outcome,'READY');equal(e.stage,'VERIFIED_ALLOWANCE_PROBE');check(e.accountFunded===true&&e.broadcastAccepted===true&&e.allowanceRuntimeCode&&e.initialState&&e.allowanceProbe);}
 equal(r.outcome,r.runtime.outcome==='READY'&&e.stage==='VERIFIED_ALLOWANCE_PROBE'?'OBSERVED':'ERROR');
}
export function validateAllowanceCaseReport(report:unknown){check(validate(report));const r=report as any;equal(r.kind,'TRON_PRIVATE_TVM_ALLOWANCE_PROBE');caseReport(r);}
export function validateAllowanceReport(report:unknown){
 check(validate(report));const r=report as any;if(r.kind==='TRON_PRIVATE_TVM_ALLOWANCE_PROBE'){caseReport(r);return;}
 equal(r.cases.map((c:any)=>({variant:c.variant,operation:c.operation,id:c.id})),allowanceCasePlan.map(c=>({...c,id:`${c.operation}:${c.variant}`})));
 const ids=new Set<string>();let stopped=false,all=true;
 for(const c of r.cases){
  if(stopped){equal(c.outcome,'NOT_TESTED');check(c.report===undefined);all=false;continue;}
  if(c.outcome==='NOT_TESTED'){check(c.report===undefined);stopped=true;all=false;continue;}
  if(c.report){caseReport(c.report);equal(c.report.build.variant,c.variant);if(c.report.evidence.allowanceProbe)equal(c.report.evidence.allowanceProbe.operation,c.operation);
   for(const id of [c.report.runtime.runId,c.report.runtime.resources.containerId,c.report.runtime.resources.networkId].filter(Boolean)){check(!ids.has(id));ids.add(id);}
  }
  if(c.outcome==='OBSERVED')check(c.report?.outcome==='OBSERVED');else{equal(c.outcome,'ERROR');stopped=true;all=false;}
 }
 equal(r.outcome,all?'OBSERVED':'ERROR');check(Number.isFinite(Date.parse(r.startedAt))&&Number.isFinite(Date.parse(r.completedAt))&&Date.parse(r.completedAt)>=Date.parse(r.startedAt));
}
export function serializeAllowanceReport(report:unknown){const wire=JSON.parse(json(report));validateAllowanceReport(wire);return json(wire);}
