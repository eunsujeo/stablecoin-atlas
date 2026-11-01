// Educational normalized stake units, not ETH and not mainnet observations.
export const ETHEREUM=Object.freeze({id:'ethereum',slotSeconds:12,slotsPerEpoch:32,duration:24,startEpoch:100,proposer:2,committee:Object.freeze([1,4,6])});
export const SCENARIOS=Object.freeze({normal:Object.freeze({label:'정상 참여',offlineStake:Object.freeze([]),offlinePeers:Object.freeze([])}),offline:Object.freeze({label:'지분 5/12 오프라인',offlineStake:Object.freeze([7,8,9,10,11]),offlinePeers:Object.freeze([4,6,7])})});
export const STAKES=Object.freeze(Array.from({length:12},(_,i)=>Object.freeze({id:i,weight:1n})));
export function support(ids,stakes=STAKES){
 if(!stakes.length||new Set(stakes.map(s=>s.id)).size!==stakes.length)throw Error('INVALID_STAKE_SET');
 const seen=new Set();let weight=0n,total=0n;for(const s of stakes){if(typeof s.weight!=='bigint'||s.weight<=0n)throw Error('INVALID_STAKE');total+=s.weight;}
 for(const id of ids){if(seen.has(id))continue;const s=stakes.find(v=>v.id===id);if(!s)throw Error('UNKNOWN_STAKE');seen.add(id);weight+=s.weight;}
 return {weight,total,quorum:weight*3n>=total*2n};
}
export function advanceCheckpoint(previous,current,signed){
 if(current.epoch!==previous.epoch+1)throw Error('NON_CONSECUTIVE_CHECKPOINT');
 const approved=previous.justified&&support(signed).quorum;
 return {previous:{...previous,finalized:previous.finalized||approved},current:{...current,justified:approved,finalized:false}};
}
export const PHASES=Object.freeze([
 {at:0,key:'assign',label:'제안자 배정'}, {at:3,key:'build',label:'블록 조립'}, {at:6,key:'propagate',label:'전파'}, {at:9,key:'attest',label:'검증과 투표'}, {at:12,key:'epoch',label:'Epoch 집계'}, {at:16,key:'justify',label:'Justified'}, {at:18,key:'next',label:'다음 epoch'}, {at:22,key:'finalize',label:'Finality'},
].map(Object.freeze));
export function scenarioById(id){if(!Object.hasOwn(SCENARIOS,id))throw Error('UNKNOWN_SCENARIO');return SCENARIOS[id];}

// Fixed illustrative gossip routes, not observed network latencies.
export const DELIVERIES=Object.freeze([{from:1,to:0,at:7},{from:2,to:1,at:6.2},{from:2,to:2,at:6},{from:2,to:3,at:6.2},{from:0,to:4,at:7.7},{from:1,to:5,at:7},{from:2,to:6,at:6.2},{from:3,to:7,at:7}].map(Object.freeze));

// Six learning chapters; the eight protocol event phases remain independent.
export const LESSON_STEPS=Object.freeze([
 {at:0,key:'assign',label:'Proposer 선정'}, {at:3,key:'build',label:'블록 생성'},
 {at:6,key:'propagate',label:'블록 전파'}, {at:9,key:'attest',label:'Attestation'},
 {at:12,key:'justify',label:'Justification'}, {at:18,key:'finalize',label:'Finalization'},
].map(Object.freeze));
