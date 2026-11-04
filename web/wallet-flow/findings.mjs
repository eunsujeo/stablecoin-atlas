// Explain observed events. Temporal links are never attribution of pooled funds.
export function deriveFindings(snapshot,analysis){
 const txs=new Map(snapshot.transactions.map(t=>[t.txid,t]));
 const transfers=analysis.events.filter(e=>e.kind==='USDT_TRANSFER'&&BigInt(e.amountRaw)>0n&&e.from!==e.to);
 const byId=new Map(analysis.events.map(e=>[e.id,e]));
 const enrich=e=>({...e,timestamp:txs.get(e.txid).timestamp,blockNumber:txs.get(e.txid).blockNumber});
 const later=(e,anchor)=>txs.get(e.txid).blockNumber>txs.get(anchor.txid).blockNumber&&txs.get(e.txid).timestamp>=txs.get(anchor.txid).timestamp;
 const sum=es=>es.reduce((a,e)=>a+BigInt(e.amountRaw),0n).toString();
 const stats=address=>{
  const incoming=transfers.filter(e=>e.to===address),outgoing=transfers.filter(e=>e.from===address);
  return {address,incomingCount:incoming.length,outgoingCount:outgoing.length,incomingRaw:sum(incoming),outgoingRaw:sum(outgoing),senders:new Set(incoming.map(e=>e.from)).size,recipients:new Set(outgoing.map(e=>e.to)).size,evidenceTxids:[...new Set([...incoming,...outgoing].map(e=>e.txid))],coverage:snapshot.coverage.find(c=>c.address===address)};
 };
 const cases=analysis.rootEvents.slice(0,20).map(deposit=>{
  const forwards=transfers.filter(e=>e.from===deposit.to&&later(e,deposit));
  const first=forwards[0]??null;
  const resourceWindows=first?analysis.resourceSequences.filter(r=>r.transfer===first.id).map(r=>{
   const delegate=byId.get(r.delegate),recovery=byId.get(r.recovery),ft=txs.get(first.txid).timestamp,dt=txs.get(delegate.txid).timestamp,rt=recovery?txs.get(recovery.txid).timestamp:null;
   return {resource:r.resource,provider:delegate.from,delegate:enrich(delegate),recovery:recovery?enrich(recovery):null,beforeMs:ft-dt,afterMs:rt===null?null:rt-ft,holdingMs:rt===null?null:rt-dt,energyUsage:r.energyUsage,energyFeeSun:r.energyFeeSun};
  }):[];
  const timelineIds=new Set([deposit.id,...(first?[first.id]:[]),...resourceWindows.flatMap(r=>[r.delegate.id,...(r.recovery?[r.recovery.id]:[])])]);
  const timeline=analysis.events.filter(e=>timelineIds.has(e.id)).map(enrich);
  const successor=first?stats(first.to):null;
  const nextTransfers=first?transfers.filter(e=>e.from===first.to&&later(e,first)).map(enrich):[];
  const priorContext=first?transfers.filter(e=>(e.from===first.to||e.to===first.to)&&txs.get(e.txid).timestamp<txs.get(first.txid).timestamp):[];
  return {deposit:enrich(deposit),firstForward:first?enrich(first):null,delayMs:first?txs.get(first.txid).timestamp-txs.get(deposit.txid).timestamp:null,sameAmount:first?BigInt(first.amountRaw)===BigInt(deposit.amountRaw):null,forwardCount:forwards.length,receivingAddress:stats(deposit.to),successor,priorContextCount:priorContext.length,nextTransfers,nextTotalRaw:sum(nextTransfers),nextRecipientCount:new Set(nextTransfers.map(e=>e.to)).size,resourceWindows,timeline,pattern:first?(resourceWindows.length?'RESOURCE_ASSISTED_FORWARD_CANDIDATE':'FORWARD_OBSERVED'):'NO_FORWARD_OBSERVED',attribution:'NOT_ESTABLISHED'};
 });
 const coverage={complete:snapshot.coverage.filter(c=>c.transfers==='complete'&&c.transactions==='complete').length,partial:snapshot.coverage.filter(c=>(c.transfers!=='not-collected'||c.transactions!=='not-collected')&&!(c.transfers==='complete'&&c.transactions==='complete')).length,unexpanded:snapshot.coverage.filter(c=>c.transfers==='not-collected'&&c.transactions==='not-collected').length};
 return {cases,omittedCases:Math.max(0,analysis.rootEvents.length-cases.length),coverage};
}
export function coverageLabel(value){return {complete:'지정 범위 조회 완료',partial:'일부 거래 확인 · 조회 범위 제한','not-collected':'연결 거래만 확인 · 주소 이력 미조회'}[value]??'조회 상태 미확인';}
export function elapsedLabel(milliseconds){if(milliseconds===null)return '미확인';const seconds=Math.floor(milliseconds/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;return [hours?`${hours}시간`:null,minutes?`${minutes}분`:null,rest||(!hours&&!minutes)?`${rest}초`:null].filter(Boolean).join(' ');}
