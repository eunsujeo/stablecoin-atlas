export const VALIDATORS=Object.freeze([{id:'V01',weight:3n},{id:'V02',weight:3n},{id:'V03',weight:2n},{id:'V04',weight:2n},{id:'V05',weight:1n},{id:'V06',weight:1n}].map(Object.freeze));
export function ancestor(blocks,root,parent){
 const by=new Map(blocks.map(b=>[b.id,b])),seen=new Set();let b=by.get(root);
 while(b){if(seen.has(b.id))throw Error('BLOCK_CYCLE');seen.add(b.id);if(b.id===parent)return true;b=by.get(b.parent);}return false;
}
// Accepted, already-valid blocks/attestations only. No execution/BLS verification implied.
export function latestMessages(messages){
 const latest=new Map();for(const m of messages){const previous=latest.get(m.validator);if(!previous||m.epoch>previous.epoch)latest.set(m.validator,m);}return [...latest.values()];
}
export function chooseHead({blocks,messages,validators=VALIDATORS,justified,finalized}){
 const by=new Map(blocks.map(b=>[b.id,b]));if(by.size!==blocks.length||!by.has(justified)||!by.has(finalized)||!ancestor(blocks,justified,finalized))throw Error('INVALID_ANCHOR');
 const ids=new Set();for(const v of validators){if(ids.has(v.id)||typeof v.weight!=='bigint'||v.weight<=0n)throw Error('INVALID_VALIDATOR');ids.add(v.id);}
 for(const m of messages)if(!ids.has(m.validator)||!by.has(m.root)||!Number.isInteger(m.epoch)||m.epoch<0)throw Error('INVALID_MESSAGE');
 for(const b of blocks){if(!/^0x[0-9a-f]{64}$/.test(b.root))throw Error('INVALID_ROOT');if(b.parent!==null&&!by.has(b.parent))throw Error('UNKNOWN_PARENT');if(b.parent!==null&&b.slot<=by.get(b.parent).slot)throw Error('INVALID_SLOT_ORDER');}
 const latest=latestMessages(messages),weights=Object.fromEntries(blocks.map(b=>[b.id,0n]));
 for(const m of latest){const v=validators.find(v=>v.id===m.validator);if(v.slashed||v.equivocating||v.active===false)continue;let node=by.get(m.root);const seen=new Set();while(node){if(seen.has(node.id))throw Error('BLOCK_CYCLE');seen.add(node.id);weights[node.id]+=v.weight;node=by.get(node.parent);}}
 let head=justified;while(true){const children=blocks.filter(b=>b.parent===head&&b.viable!==false&&ancestor(blocks,b.id,finalized));if(!children.length)break;children.sort((a,b)=>weights[a.id]===weights[b.id]?(a.root<b.root?1:-1):weights[a.id]<weights[b.id]?1:-1);head=children[0].id;}
 const path=[];let b=by.get(head);while(b){path.unshift(b.id);b=by.get(b.parent);}
 return {head,path,weights,latest};
}
