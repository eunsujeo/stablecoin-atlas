import {ease} from './engine.mjs';
const NS='http://www.w3.org/2000/svg';
const set=(n,k,v)=>n.setAttribute(k,String(v));
function el(tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))set(n,k,v);if(text!==undefined)n.textContent=text;return n;}
export class TransactionRenderer{
 constructor(svg){
  this.pool=el('g',{'aria-label':'관찰 노드 A의 거래 풀과 추적 결과'});this.title=el('text',{x:18,class:'slot-zone-note'});this.pool.append(this.title);
  this.items=Array.from({length:4},(_,i)=>{const id=`TX0${i+1}`,g=el('g',{'data-tx':id,'data-select':'lesson:tx:'+id,role:'button',tabindex:0,class:'inspectable tx-chip'}),box=el('rect',{rx:4,height:40,fill:'var(--control)',stroke:'var(--line)'}),name=el('text',{x:9,y:16,class:'tx-name'}),status=el('text',{x:9,y:33,class:'tx-status'});g.append(box,name,status);this.pool.append(g);return{g,box,name,status};});
  this.ghost=el('g',{'aria-hidden':'true',class:'tx-transfer'});this.ghost.append(el('rect',{x:-29,y:-12,width:58,height:24,rx:4,fill:'var(--panel)',stroke:'var(--teal)'}));this.ghostText=el('text',{'text-anchor':'middle',y:4,class:'tx-name'});this.ghost.append(this.ghostText);svg.append(this.pool,this.ghost);
 }
 draw(s,{mobile,reduced,collapsed=false}){
  const tx=s.transactions,y=mobile?840:306;set(this.pool,'visibility',collapsed?'hidden':'visible');set(this.title,'y',y-7);this.title.textContent=tx.scenario==='empty'?'노드 A · 사용자 거래 0개':s.t<2?`서명 → 전파 · 노드 A 관측 ${tx.items.filter(q=>q.observedByA).length} / B 관측 ${tx.items.filter(q=>q.observedByB).length}`:'노드 A의 거래 풀 · 포함 후에도 결과 추적';
  this.items.forEach((n,i)=>{const q=tx.items[i];set(n.g,'visibility',!collapsed&&q?'visible':'hidden');set(n.g,'tabindex',!collapsed&&q?0:-1);set(n.g,'transform',`translate(${mobile?20:20+i*230} ${y+(mobile?i*50:0)})`);set(n.box,'width',mobile?380:218);set(n.g,'data-status',q?.status??'');set(n.g,'data-block',q?.block??'');set(n.g,'data-active',q?.id===tx.active);set(n.box,'stroke',q?.id===tx.active?'var(--purple)':'var(--line)');set(n.box,'fill',q?.id===tx.active?'var(--active)':'var(--control)');set(n.g,'opacity',q?.id===tx.active||!tx.active?1:.9);n.name.textContent=q?`${q.id} · ${q.type}`:'';n.status.textContent=q?(q.block?`Included · #${q.blockNumber} · 미확정`:q.status==='executed'?`Executed · ${q.receipt.status?'상태 변경':'호출 되돌림'} (R${q.receipt.status})`:q.label):'';set(n.g,'aria-label',q?`${q.id}, ${q.type}, ${n.status.textContent}, 상세 설명`:'거래 없음');});
  // One educational transfer marker at a time; the data already belongs to the proposed block.
  const arriving=tx.items.find(q=>s.t>=q.arrivalAt-.2&&s.t<q.arrivalAt);
  const flight=tx.items.find(q=>q.block&&s.t>=q.transferAt&&s.t<q.transferAt+.2);
  set(this.ghost,'visibility',(flight||arriving)&&!reduced&&!collapsed?'visible':'hidden');
  const i=flight?Number(flight.id.slice(2))-1:0,p=flight?ease((s.t-flight.transferAt)/.2):0,target=flight?flight.blockNumber-700:0,start=[mobile?210:129+i*230,y+17+(mobile?i*50:0)],end=mobile?[target%2?315:105,510+Math.floor(target/2)*115]:[110+target*148,233];
  set(this.ghost,'transform',`translate(${start[0]+(end[0]-start[0])*p} ${start[1]+(end[1]-start[1])*p})`);this.ghostText.textContent=flight?.id??arriving?.id??'';if(arriving){const j=Number(arriving.id.slice(2))-1,r=ease((s.t-(arriving.arrivalAt-.2))/.2),endX=mobile?210:129+j*230;set(this.ghost,'transform',`translate(${30+(endX-30)*r} ${y-12+(29+(mobile?j*50:0))*r})`);}
 }
}
