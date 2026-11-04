// Address activity describes this bounded sample, not a wallet's complete history.
export function activityProfiles(snapshot,events){
 const txs=new Map(snapshot.transactions.map(t=>[t.txid,t]));
 const moves=events.filter(e=>e.kind==='USDT_TRANSFER'&&BigInt(e.amountRaw)>0n&&e.from!==e.to).map(e=>({...e,timestamp:txs.get(e.txid).timestamp,blockNumber:txs.get(e.txid).blockNumber}));
 const total=rows=>rows.reduce((n,e)=>n+BigInt(e.amountRaw),0n).toString();
 return snapshot.addresses.map(({address})=>{
  const incoming=moves.filter(e=>e.to===address),outgoing=moves.filter(e=>e.from===address),history=moves.filter(e=>e.to===address||e.from===address);
  const senders=new Set(incoming.map(e=>e.from)).size,recipients=new Set(outgoing.map(e=>e.to)).size;
  const first=history[0]?.timestamp??null,last=history.at(-1)?.timestamp??null;
  const coverage=snapshot.coverage.find(c=>c.address===address);
  const counterparts=[...new Set(history.map(e=>e.from===address?e.to:e.from))].map(other=>{
   const received=incoming.filter(e=>e.from===other),sent=outgoing.filter(e=>e.to===other);
   return {address:other,receivedCount:received.length,sentCount:sent.length,receivedRaw:total(received),sentRaw:total(sent),txids:[...new Set([...received,...sent].map(e=>e.txid))]};
  }).sort((a,b)=>b.sentCount-a.sentCount||b.receivedCount-a.receivedCount||a.address.localeCompare(b.address));
  // Amounts are exact; counts alone are not evidence that the same customer funds moved.
  const repeatedAmounts=[...new Set(outgoing.map(e=>e.amountRaw))].map(amountRaw=>({amountRaw,events:outgoing.filter(e=>e.amountRaw===amountRaw)})).filter(g=>g.events.length>=2);
  const forward=incoming.some(i=>outgoing.some(o=>o.blockNumber>i.blockNumber&&o.timestamp>=i.timestamp&&o.timestamp-i.timestamp<=3600000));
  const hub=senders>=2&&recipients>=3,collection=senders>=2&&recipients<=2&&outgoing.length>0,distribution=recipients>=3;
  let role=hub?'집금·배분 허브 후보':collection?'집금 후보':distribution?'배분·출금 운영 후보':forward?'입금 후 전달 후보':'역할 근거 부족';
  // Describe an observable one-hour burst, independent of the requested six-hour window.
  let burst=[];for(let i=0;i<outgoing.length;i++){const window=outgoing.filter(e=>e.timestamp>=outgoing[i].timestamp&&e.timestamp<outgoing[i].timestamp+3600000);if(new Set(window.map(e=>e.txid)).size>new Set(burst.map(e=>e.txid)).size)burst=window;}
  const burstTransactions=new Set(burst.map(e=>e.txid)).size,burstRecipients=new Set(burst.map(e=>e.to)).size;
  const hotPattern=burstTransactions>=10&&burstRecipients>=5;
  const reason=hub?`${senders}개 주소에서 수신하고 ${recipients}개 주소로 송금`:collection?`${senders}개 주소에서 받아 ${recipients}개 주소로 전달`:distribution?`${recipients}개 주소로 분산 송금`:forward?'수신 이후 블록에서 1시간 이내 후속 송금':'이 자료만으로 반복적인 운영 용도를 좁히기 어려움';
  const span=first===null?null:Math.max(1,last-first+1),bins=first===null?[]:Array.from({length:12},(_,i)=>({from:first+Math.floor(span*i/12),to:first+Math.floor(span*(i+1)/12),incoming:0,outgoing:0,txids:[]}));
  for(const e of history){const b=bins[Math.min(11,Math.floor((e.timestamp-first)*12/span))];b[e.to===address?'incoming':'outgoing']++;if(!b.txids.includes(e.txid))b.txids.push(e.txid);}
  return {address,role,reason,level:'BEHAVIOR_CANDIDATE',ownership:'UNKNOWN',custody:'UNKNOWN',incomingCount:incoming.length,outgoingCount:outgoing.length,incomingRaw:total(incoming),outgoingRaw:total(outgoing),senders,recipients,first,last,history,coverage,counterparts,repeatedAmounts,bins,
   hot:{candidate:hotPattern,transactions:burstTransactions,recipients:burstRecipients,from:burst[0]?.timestamp??null,to:burst.at(-1)?.timestamp??null,txids:[...new Set(burst.map(e=>e.txid))]},
   evidenceTxids:[...new Set(history.map(e=>e.txid))],
   limitations:['집금·배분은 동작의 후보이며 거래소 소유·고객 입출금을 확정하지 않습니다.','Hot/Cold는 키 보관 방식과도 관련됩니다. 거래 빈도만으로 확정하지 않습니다.','장기 잔액·보관 기간·서명 운영 증거가 없어 준비금·콜드 역할은 판단하지 않습니다.'],
  };
 });
}

// Transaction context supplied by the user, deliberately not an address ownership label.
export function journeyContext(deposit){
 if(deposit.txid==='f00dd1d241084eb64c24a137f4f133277f6448c3edcd2352d20bba77bc2cd02e'&&deposit.from==='TDB1RpAHPQdGqfb1qi8J2jLY2oGe2jSy8A'&&deposit.to==='TSnLPAuoyCRYgyNZ484EvZEvS1UudS86E9')return {origin:'Binance 출금',destination:'Upbit 입금',basis:'USER_PROVIDED',note:'거래소 이름은 이 송금에 대한 사용자 설명입니다. 주소 소유권의 독립 검증이나 후속 주소의 Upbit 소속 확인을 뜻하지 않습니다.'};
 return {origin:'출발 주소',destination:'입금 수신 주소',basis:'ONCHAIN_ONLY',note:'온체인 송신·수신 주소입니다. 거래소 소속은 확인되지 않았습니다.'};
}
