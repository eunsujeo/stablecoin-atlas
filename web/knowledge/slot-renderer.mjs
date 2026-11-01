import {TransactionRenderer} from './transaction-renderer.mjs';
import {ease} from './engine.mjs';
import {SLOT_LABELS} from './lessons.mjs';
const NS='http://www.w3.org/2000/svg',set=(n,k,v)=>{if(n.getAttribute(k)!==String(v))n.setAttribute(k,String(v));},text=(n,v)=>{if(n.textContent!==v)n.textContent=v;};
function el(tag,attrs={},value){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))set(n,k,v);if(value!==undefined)n.textContent=value;return n;}
function label(x,y,cls,value){return el('text',{x,y,class:cls},value);}
export class SlotRenderer{
 constructor(svg){
  this.svg=svg;svg.replaceChildren();this.timelineTitle=label(18,22,'slot-zone-title','슬롯 타임라인 · 블록 제안 기회, 한 칸 12초');this.chainTitle=label(18,187,'slot-zone-title','블록 체인 · 실제 생성된 결과만 연결');svg.append(this.timelineTitle,this.chainTitle);
  this.cells=[];for(let i=0;i<6;i++){
   const g=el('g',{'data-object':`slot:${3200+i}`,'data-select':`lesson:slot:${3200+i}`,role:'button',tabindex:0,class:'inspectable slot-time-cell'}),box=el('rect',{fill:'var(--control)',stroke:'var(--line)',rx:6}),name=label(0,0,'slot-cell-name',`슬롯 ${3200+i}`),actor=label(0,0,'slot-cell-meta',`제안자 V0${i+1}`),status=label(0,0,'slot-cell-meta','예정'),clock=label(0,0,'slot-cell-clock','0 / 12초'),track=el('rect',{fill:'var(--track)',height:5,rx:2}),origin=el('g'),fill=el('rect',{x:0,y:0,height:5,rx:2,fill:'var(--purple)'});origin.append(fill);g.append(box,name,actor,status,clock,track,origin);svg.append(g);this.cells.push({g,box,name,actor,status,clock,track,origin,fill});
  }
  this.links=el('g',{'aria-hidden':'true'});svg.append(this.links);this.blocks=[];
  for(let i=0;i<6;i++){const id=`B${700+i}`,g=el('g',{'data-object':id,'data-select':`lesson:${id}`,role:'button',tabindex:0,class:'inspectable slot-result-block'}),back=el('rect',{x:-53,y:-27,width:112,height:62,rx:4,fill:'var(--control)',stroke:'var(--line)'}),box=el('rect',{x:-58,y:-32,width:112,height:62,rx:4,fill:'var(--panel)',stroke:'var(--line)','stroke-width':1.5}),name=label(-44,-10,'slot-block-name',`블록 #${700+i}`),meta=label(-44,9,'slot-block-meta',''),parent=label(-44,24,'slot-block-meta','');g.append(back,box,name,meta,parent);const path=el('path',{fill:'none',stroke:'var(--teal)','stroke-width':2,pathLength:1,'stroke-dasharray':1});this.links.append(path);svg.append(g);const validation=label(-44,49,'tx-status','');g.append(validation);this.blocks.push({g,box,back,name,meta,parent,path,validation});}
  this.note=label(18,337,'slot-zone-note','슬롯을 선택하면 제안자·시간·생성 결과·부모를 함께 확인합니다.');svg.append(this.note);this.transactions=new TransactionRenderer(svg);
 }
 draw(s,{mobile=false,reduced=false,collapsed=false}={}){
  set(this.svg,'viewBox',mobile?'0 0 420 1060':'0 0 960 350');set(this.svg,'aria-label','위: 12초가 흐르는 슬롯 타임라인. 아래: 실제 생성된 블록과 부모 연결. 슬롯은 블록이 없어도 진행됩니다.');
  set(this.note,'visibility','hidden');this.transactions.draw(s,{mobile,reduced,collapsed});set(this.chainTitle,'y',mobile?455:179);set(this.note,'y',mobile?800:337);text(this.timelineTitle,s.t===24?'슬롯 3206 시작 · 블록 없이도 시간은 계속':mobile?'슬롯 타임라인 · 한 칸 = 12초':'슬롯 타임라인 · 블록 제안 기회, 한 칸 12초');text(this.note,mobile?'시간 칸 선택 → 제안자·블록·부모 확인':'슬롯을 선택하면 제안자·시간·생성 결과·부모를 함께 확인합니다.');
  const cellPositions=[];s.slots.forEach((entry,i)=>{
   const c=this.cells[i],x=mobile?20:20+i*154,y=mobile?42+i*64:40,w=mobile?380:140,h=mobile?56:104,block=s.blocks.find(b=>b.id===entry.block),active=entry.slot===s.slot;
   cellPositions.push([x+w/2,y+h]);set(c.g,'transform',`translate(${x} ${y})`);set(c.g,'data-status',entry.status);set(c.g,'data-block',entry.block??'');set(c.g,'data-parent',block?.parent??'');set(c.g,'data-elapsed',entry.elapsed);set(c.g,'data-current',active);set(c.g,'aria-current',active?'step':'false');set(c.g,'aria-label',`슬롯 ${entry.slot}, 제안자 ${entry.proposer}, ${entry.elapsed.toFixed(1)}/12초, ${SLOT_LABELS[entry.status]}${block?`, 블록 번호 ${block.number}, 부모 ${block.parent}`:''}`);
   set(c.box,'width',w);set(c.box,'height',h);set(c.box,'stroke',active?'var(--purple)':entry.status==='skipped'?'var(--pink)':'var(--line)');set(c.box,'stroke-width',active?2.5:1);set(c.box,'stroke-dasharray',entry.status==='future'?'4 4':'none');set(c.box,'fill',active?'var(--active)':'var(--control)');
   for(const [n,nx,ny]of [[c.name,12,21],[c.actor,12,mobile?40:42],[c.status,mobile?190:12,mobile?21:64],[c.clock,mobile?190:12,mobile?40:84]]){set(n,'x',nx);set(n,'y',ny);}
   text(c.status,entry.status==='future'?'아직 시작 전':entry.status==='skipped'?'Skipped · 블록 없음':block?`제안됨 · #${block.number}`:entry.status==='unresponsive'?'미응답 · 대기':'블록 제안 대기');text(c.clock,`${entry.elapsed.toFixed(1)} / 12초`);set(c.track,'x',8);set(c.track,'y',h-8);set(c.track,'width',w-16);set(c.origin,'transform',`translate(8 ${h-8})`);set(c.fill,'width',w-16);set(c.fill,'transform',`scale(${entry.elapsed/entry.duration} 1)`);set(c.fill,'fill',active?'var(--purple)':entry.status==='skipped'?'var(--pink)':'var(--muted)');
  });
  const positions=[];this.blocks.forEach((n,i)=>{
   const b=s.blocks.find(b=>b.number===700+i),end=mobile?[i%2?315:105,510+Math.floor(i/2)*115]:[110+i*148,233],birth=b?(reduced?1:ease((s.t-b.createdAt)/.65)):0,from=b&&i>0?cellPositions[b.slot-3200]:end;
   const pos=b&&i>0?(mobile?[end[0],end[1]-18*(1-birth)]:[from[0]+(end[0]-from[0])*birth,from[1]+25+(end[1]-from[1]-25)*birth]):end;positions.push(end);
   set(n.g,'visibility',b?'visible':'hidden');set(n.g,'tabindex',b?0:-1);set(n.g,'transform',`translate(${pos})`);set(n.g,'opacity',b?(.25+.75*birth):0);set(n.g,'data-parent',b?.parent??'');set(n.g,'data-slot',b?.slot??'');set(n.back,'visibility',b?.checkpoint?'visible':'hidden');set(n.box,'stroke',b?.slot===s.slot?'var(--purple)':'var(--line)');
   const payload=s.transactions.blocks.find(q=>q.id===b?.id);text(n.validation,payload?payload.validation.includes('재실행')?'재실행 확인':payload.validation.includes('전파')?'전파 중':payload.validation.includes('초기')?'초기 부모':'제안됨':'');text(n.meta,b?`${b.checkpoint?'C100 · ':''}${b.slot} · ${payload?.transactions===null?'기존':(payload?.transactions.length??0)+'건'}`:'');text(n.parent,b?(b.parent?`부모 #${b.number-1}`:'이전의 유효 블록'):'');set(n.path,'visibility',b&&i>0?'visible':'hidden');set(n.path,'data-parent',b?.parent??'');set(n.path,'data-child',b?.id??'');
   if(b&&i>0){const a=positions[i-1];set(n.path,'d',mobile&&i%2===0?`M${a[0]},${a[1]+31}V${a[1]+57}H${end[0]}V${end[1]-32}`:`M${a[0]+54},${a[1]}H${end[0]-58}`);set(n.path,'stroke-dashoffset',1-birth);}else{set(n.path,'d','');set(n.path,'stroke-dashoffset',1);}
  });
 }
}
