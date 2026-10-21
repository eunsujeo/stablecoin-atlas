import {spawnSync} from 'node:child_process';
import {access} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {boundedRead,digest} from './evidence-store.mjs';
export async function compilerCacheState(path=new URL('../.state/tron-compiler/tron-0.8.26.cjs',import.meta.url),expectedHash){
  try{
    const expected=expectedHash??JSON.parse((await boundedRead(new URL('../data/tron-compiler-pin.json',import.meta.url),4096)).toString('utf8')).sha256;
    if(typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected))return 'PIN_INVALID';
    return digest(await boundedRead(path,32*1024*1024))===expected?'READY':'INVALID_HASH';
  }catch(error){return error.code==='ENOENT'?'MISSING':'UNREADABLE';}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const mode=process.argv[2]??'ui';
  if(!['ui','full'].includes(mode)||process.argv.length>3){console.error('Use doctor [ui|full].');process.exitCode=1;}
  else{
    const [major,minor]=process.versions.node.split('.').map(Number),nodeOk=major>24||major===24&&minor>=5;
    const result={mode,node:{version:process.versions.node,ready:nodeOk},uiReady:nodeOk};
    for(const[name,path]of [['environmentFile','../.env.local'],['storedEvidence','../reports/dashboard-evidence/index.json'],['storedMarket','../reports/market-store/index.json']]){try{await access(new URL(path,import.meta.url));result[name]='PRESENT';}catch{result[name]='ABSENT';}}
    if(mode==='full'){
      const tools={};for(const name of ['anvil','javac','java']){
        const run=spawnSync(name,[name==='java'?'-version':name==='javac'?'-version':'--version'],{encoding:'utf8',timeout:10000,maxBuffer:4096,shell:false});
        const version=(run.stdout??'')+(run.stderr??'');tools[name]=run.status===0&&(name==='anvil'||/(?:javac |version ")(17|21)\./.test(version))?'READY':'MISSING_OR_UNSUPPORTED';
      }
      const dependencies={};for(const name of ['tsx','typescript','viem','solc','tronweb','ajv']){try{import.meta.resolve(name);dependencies[name]='READY';}catch{dependencies[name]='MISSING';}}
      result.tools=tools;result.dependencies=dependencies;result.tronCompilerCache=await compilerCacheState();
      result.fullCheckReady=nodeOk&&Object.values(tools).every(x=>x==='READY')&&Object.values(dependencies).every(x=>x==='READY')&&result.tronCompilerCache==='READY';
      if(result.tronCompilerCache!=='READY')result.nextStep='npm run compiler:prepare';
    }
    console.log(JSON.stringify(result,null,2));console.log('UI needs no keys, Anvil or Java. Missing stored data is not a failed validation. No remote RPC/API calls were made.');
    if(!nodeOk||mode==='full'&&!result.fullCheckReady)process.exitCode=1;
  }
}
