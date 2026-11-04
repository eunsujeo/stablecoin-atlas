import {collectionPlan,collect,publishSnapshot} from './collector.mjs';
const [command,...args]=process.argv.slice(2),options={};
try{
 for(let i=0;i<args.length;i+=2){if(!['--txid','--seeds','--hours','--directory','--output'].includes(args[i])||args[i+1]===undefined||Object.hasOwn(options,args[i]))throw Error('INVALID_ARGUMENTS');options[args[i]]=args[i+1];}
 if(command==='export'){if(!options['--directory']||!options['--output'])throw Error('EXPORT_ARGUMENTS');console.log(JSON.stringify(await publishSnapshot(options['--directory'],options['--output'])));}
 else if(command==='plan'||command==='collect'){
 const plan=collectionPlan({txid:options['--txid'],seeds:options['--seeds']?.split(',')??[],hours:options['--hours']===undefined?6:Number(options['--hours'])});
 if(command==='plan')console.log(JSON.stringify(plan,null,2));
 else{if(!options['--directory'])throw Error('DIRECTORY_REQUIRED');const s=await collect(plan,{directory:options['--directory'],apiKey:process.env.WALLET_FLOW_TRONGRID_KEY,freeTierConfirmed:process.env.WALLET_FLOW_FREE_TIER==='confirmed'});console.log(JSON.stringify({status:'COLLECTED',transactions:s.transactions.length,events:s.events.length,addresses:s.addresses.length}));}
 }else throw Error('COMMAND_REQUIRED');
}catch(error){console.error(/^[A-Z0-9_]+$/.test(error.message)?error.message:'WALLET_FLOW_FAILED');process.exitCode=1;}
