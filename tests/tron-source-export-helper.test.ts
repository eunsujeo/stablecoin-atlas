import { test } from 'node:test';
import assert from 'node:assert/strict';
const names = ['BasicToken','BlackList','Migrations','MultiSigWallet','Ownable','Pausable','SafeMath','StandardToken','StandardTokenWithFees','TetherToken'];
const g = globalThis as any;let runId=0;
async function run(options: {url?:string;missing?:boolean;fault?:string}={}) {
  const saved=new Map<string,PropertyDescriptor|undefined>();let blob:Blob|undefined,clicked=0,removed=0,revoked=0,forbidden=0;
  const set=(key:string,value:unknown)=>{saved.set(key,Object.getOwnPropertyDescriptor(g,key));Object.defineProperty(g,key,{value,configurable:true,writable:true});};
  const RealURL=URL;
  const models:any[]=names.map((name,i)=>({getLanguageId:()=>i%2?'sol':'solidity',getValue:()=>`pragma solidity ^0.4.18;\ncontract ${name} { function transfer(address,uint) public {} function approve(address,uint) public {} }\n// quote " backslash \\ literal`,uri:{path:`/${name}.sol`,query:'DO_NOT_EXPORT'}}));
  models.push({getLanguageId:()=> 'json',getValue:()=>{forbidden++;throw Error('NON_SOLIDITY_READ');}});
  if(options.fault==='empty')models[0].getValue=()=>'';
  if(options.fault==='read')models[0].getValue=()=>{throw Error('PRIVATE_CANARY');};
  if(options.fault==='duplicate')models[1].getValue=models[0].getValue;
  if(options.fault==='name')models[1].uri.path=models[0].uri.path;
  if(options.fault==='size')models[0].getValue=()=> 'pragma solidity;'+ 'x'.repeat(512*1024);
  if(options.fault==='count')models.shift();
  if(options.fault==='root')models[9].getValue=()=> 'pragma solidity; contract TetherToken {}';
  const labels=names.map((n,i)=>({textContent:`File ${i+1} (of 10): ${n}.sol`}));
  if(options.fault==='labels')labels[1]=labels[0]!;
  try {
    set('location',{href:options.url??'https://tronscan.org/contract/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t/code'});
    set('monaco',options.missing?undefined:{editor:{getModels:()=>models}});
    set('document',{querySelectorAll:()=>labels,createElement:()=>{if(options.fault==='create')throw Error('create failed');return({click(){clicked++;if(options.fault==='click')throw Error('download failed');},remove(){removed++;}});},get cookie(){forbidden++;throw Error('COOKIE_READ');}});
    set('URL',class extends RealURL {static override createObjectURL(value:Blob){blob=value;return'blob:local-mock';}static override revokeObjectURL(){revoked++;}});
    set('setTimeout',(fn:()=>void)=>{fn();return 0;});
    set('console',{info(){}});
    for(const key of ['fetch','XMLHttpRequest','localStorage','sessionStorage','ethereum','tronWeb']){saved.set(key,Object.getOwnPropertyDescriptor(g,key));Object.defineProperty(g,key,{configurable:true,get(){forbidden++;throw Error('FORBIDDEN_ACCESS');}});}
    let error:unknown;try{await import(new URL('../tools/research/export-tron-editor-sources.js',import.meta.url).href+'?run='+runId++);}catch(e){error=e;}
    return{payload:blob?JSON.parse(await blob.text()):undefined,clicked,removed,revoked,forbidden,error};
  } finally {for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(g,key,descriptor);else delete g[key];}}
}
test('TRON editor exporter preserves source escapes and private model URI queries stay absent; local download is cleaned',async()=>{
  for(const url of [undefined,'https://tronscan.org/#/contract/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t/code']){const r=await run(url?{url}:{});assert(!r.error);assert.equal(r.payload.models.length,10);assert.equal(r.payload.modelToFileAssociation,'UNVERIFIED_CANDIDATES_ONLY');assert(r.payload.models[0].content.includes('quote " backslash \\'));assert(!JSON.stringify(r.payload).includes('DO_NOT_EXPORT'));assert.equal(r.clicked,1);assert.equal(r.removed,1);assert.equal(r.revoked,1);assert.equal(r.forbidden,0);}
});
test('TRON editor exporter fails closed on wrong origin/route, unavailable API, labels, missing/duplicate/oversized/broken models',async()=>{
  for(const url of ['http://tronscan.org/contract/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t/code','https://evil.invalid/contract/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t/code','https://tronscan.org/search?address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t','https://tronscan.org/contract/TWrong/code','https://u:p@tronscan.org/contract/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t/code']){const r=await run({url});assert(r.error);assert.equal(r.clicked,0);assert.equal(r.forbidden,0);}
  for(const options of [{missing:true},...['empty','read','duplicate','name','size','count','root','labels'].map(fault=>({fault}))]){const r=await run(options);assert(r.error);assert.equal(r.clicked,0);assert.equal(r.forbidden,0);assert(!String(r.error).includes('PRIVATE_CANARY'));}
  const created=await run({fault:'create'});assert(created.error);assert.equal(created.revoked,1);assert.equal(created.forbidden,0);
  const failed=await run({fault:'click'});assert(failed.error);assert.equal(failed.removed,1);assert.equal(failed.revoked,1);assert.equal(failed.forbidden,0);
});
