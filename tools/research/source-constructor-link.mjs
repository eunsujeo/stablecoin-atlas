import {createHash} from 'node:crypto';
const fail=()=>{throw Error('CONSTRUCTOR_LINK_INVALID');};
const ctor=data=>{if(!Array.isArray(data?.abi))fail();const list=data.abi.filter(x=>x.type==='constructor');if(list.length!==1||!Array.isArray(list[0].inputs))fail();return list[0];};
const signature=c=>JSON.stringify({stateMutability:c.stateMutability??'nonpayable',inputs:c.inputs.map(x=>({name:x.name,type:x.type}))});
export function verifyConstructorParent(parentBytes,target){
 if(!Buffer.isBuffer(parentBytes)||createHash('sha256').update(parentBytes).digest('hex')!==target.parentSourceHash)fail();
 let parent;try{parent=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(parentBytes));}catch{fail();}
 if(String(parent.chainId)!==target.chainId||parent.address?.toLowerCase()!==target.address.toLowerCase()||String(parent.matchId)!==target.expectedMatchId||parent.compilation?.name!==target.expectedContractName)fail();
 const c=ctor(parent),first=c.inputs[0];if(first?.type!=='address'||first.name!==target.expectedConstructorFirstName||!['implementationContract','_logic','_proxyTo','logic'].includes(first.name)||c.inputs.some(x=>!['address','bytes'].includes(x.type)))fail();
 return c;
}
// Decode initial logic from a provider archive. This never identifies the current implementation.
export function initialLogicFromMetadata(data,target,parentBytes){
 const parent=verifyConstructorParent(parentBytes,target);
 if(!data||String(data.chainId)!==target.chainId||data.address?.toLowerCase()!==target.address.toLowerCase()||String(data.matchId)!==target.expectedMatchId||data.compilation?.name!==target.expectedContractName)fail();
 const c=ctor(data);if(signature(c)!==signature(parent))fail();
 const args=data.creationBytecode?.transformationValues?.constructorArguments;if(args===undefined||args===null)return null;
 if(typeof args!=='string'||!/^0x[0-9a-fA-F]+$/.test(args)||(args.length-2)%64!==0)fail();
 const encoded=args.slice(2),length=BigInt(encoded.length/2),head=BigInt(c.inputs.length*32);if(length<head)fail();
 for(const [index,input]of c.inputs.entries()){
  const word=encoded.slice(index*64,(index+1)*64);
  if(input.type==='address'){if(!/^0{24}/.test(word))fail();}
  else{
   const offset=BigInt('0x'+word);if(offset%32n!==0n||offset<head||offset+32n>length)fail();
   const count=BigInt('0x'+encoded.slice(Number(offset)*2,Number(offset+32n)*2));const end=offset+32n+((count+31n)/32n)*32n;if(end>length)fail();
   const padding=encoded.slice(Number(offset+32n+count)*2,Number(end)*2);if(!/^0*$/.test(padding))fail();
  }
 }
 const address='0x'+encoded.slice(24,64).toLowerCase();if(address==='0x'+'0'.repeat(40))fail();
 return {address,chainId:target.chainId,relation:'INDEXED_CONSTRUCTOR_INITIAL_LOGIC_ONLY',currentImplementationBinding:'NOT_ESTABLISHED'};
}
