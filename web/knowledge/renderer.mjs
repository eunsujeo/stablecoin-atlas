import {ease,clamp} from './engine.mjs';
import {DELIVERIES,ETHEREUM} from './protocol.mjs';
import {presentation,STATUS} from './presentation.mjs';
const NS='http://www.w3.org/2000/svg';
function el(name,attrs={},text){const n=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;}
const set=(n,key,value)=>{const v=String(value);if(n.getAttribute(key)!==v)n.setAttribute(key,v);};
const text=(n,value)=>{if(n.textContent!==value)n.textContent=value;};
function curve(a,b,bend){return `M${a[0]},${a[1]} Q${bend[0]},${bend[1]} ${b[0]},${b[1]}`;}
function point(a,b,c,t){return [(1-t)**2*a[0]+2*(1-t)*t*c[0]+t*t*b[0],(1-t)**2*a[1]+2*(1-t)*t*c[1]+t*t*b[1]];}
export class Renderer{
 constructor(svg,onSelect){
  this.svg=svg;this.onSelect=onSelect;this.mobile=false;this.nodes=[];this.wires=[];this.packets=[];
  const defs=el('defs');const pattern=el('pattern',{id:'draft-grid',width:24,height:24,patternUnits:'userSpaceOnUse'});pattern.append(el('circle',{cx:1,cy:1,r:.65,fill:'var(--line)',opacity:.18}));defs.append(pattern);svg.append(defs,el('rect',{width:'100%',height:'100%',fill:'url(#draft-grid)'}));
  this.wireLayer=el('g',{'aria-hidden':'true'});svg.append(this.wireLayer);
  for(let i=0;i<8;i++){const wire=el('path',{fill:'none',stroke:'var(--line)','stroke-width':1.2});this.wireLayer.append(wire);this.wires.push(wire);const packet=el('g');packet.append(el('rect',{x:-8,y:-5,width:16,height:10,rx:2,fill:'var(--purple)',stroke:'var(--bg)','stroke-width':1.5}),el('path',{d:'M-5 0H5',stroke:'var(--bg)','stroke-width':1}));this.wireLayer.append(packet);this.packets.push(packet);}
  this.block=el('g',{role:'button',tabindex:0,'aria-label':'추적 블록 C100 상세','data-select':'block',class:'inspectable'});svg.append(this.block);
  this.block.append(el('rect',{x:-103,y:-76,width:206,height:160,rx:12,fill:'var(--control)',stroke:'var(--line)'}));
  this.shell=el('rect',{x:-97,y:-82,width:194,height:160,rx:11,fill:'var(--panel)',stroke:'var(--purple)','stroke-width':1.4});this.block.append(this.shell,el('path',{d:'M-97 -35H97',stroke:'var(--line)'}));
  this.block.append(el('text',{x:-81,y:-59,class:'svg-caption'},'BEACON BLOCK'));this.block.append(el('text',{x:-81,y:-13,class:'svg-block-id'},'C100'));
  this.blockLabel=el('text',{x:82,y:-14,'text-anchor':'end',class:'svg-caption'},'준비 중');this.block.append(this.blockLabel);
  this.rows=[];for(let i=0;i<3;i++){const row=el('g');row.append(el('rect',{x:-81,y:6+i*19,width:162,height:14,rx:3,fill:'var(--active)'}),el('text',{x:-73,y:16+i*19,class:'svg-tx'},['거래 실행 결과','상태 root','서명 · 합의 정보'][i]));this.block.append(row);this.rows.push(row);}
  this.seal=el('g',{opacity:0});this.seal.append(el('rect',{x:-72,y:91,width:144,height:26,rx:13,fill:'var(--teal)'}),el('text',{x:0,y:108,'text-anchor':'middle',class:'svg-seal'},'FINALIZED · C100'));this.block.append(this.seal);
  this.caption=el('text',{'text-anchor':'middle',class:'svg-foot'});svg.append(this.caption);
  for(let i=0;i<8;i++){
   const g=el('g',{role:'button',tabindex:0,'aria-label':`노드 V${String(i+1).padStart(2,'0')} 상세`,'data-select':`peer:${i}`,class:'inspectable'});
   const outline=el('rect',{x:-49,y:-36,width:98,height:72,rx:9,fill:'var(--panel)',stroke:'var(--line)'});
   const name=el('text',{x:0,y:-13,'text-anchor':'middle',class:'svg-validator'},`검증자 V${String(i+1).padStart(2,'0')}`),status=el('text',{x:0,y:-45,'text-anchor':'middle',class:'svg-status'},'대기');
   g.append(outline,name,status,el('text',{x:-36,y:6,class:'svg-small'},'실행'),el('text',{x:-36,y:23,class:'svg-small'},'합의'));
   const bars=[];for(let j=0;j<2;j++){g.append(el('rect',{x:-4,y:j*17,width:40,height:5,rx:2,fill:'var(--track)'}));const bar=el('rect',{x:0,y:0,width:40,height:5,rx:2,fill:j?'var(--blue)':'var(--teal)'});const h=el('g',{transform:`translate(-4 ${j*17})`});h.append(bar);g.append(h);bars.push(bar);}
   if(ETHEREUM.committee.includes(i)){g.append(el('path',{d:'M-49 -36H49V-29H-49Z',fill:'var(--blue)','data-role':'validator'}));}
   const vote=el('text',{x:0,y:54,'text-anchor':'middle',class:'svg-vote'},'');g.append(vote);svg.append(g);this.nodes.push({g,outline,status,bars,vote});
  }
  this.assignment=el('g',{'aria-hidden':'true','pointer-events':'none'});
  this.assignment.append(el('rect',{x:-126,y:-76,width:252,height:157,rx:12,fill:'var(--panel)',stroke:'var(--line)'}),el('text',{x:0,y:-48,'text-anchor':'middle',class:'svg-caption'},'SLOT 3200 · 배정 확인'),el('rect',{x:-108,y:-28,width:102,height:32,rx:5,fill:'var(--active)'}),el('rect',{x:6,y:-28,width:102,height:32,rx:5,fill:'var(--active)'}),el('text',{x:-57,y:-7,'text-anchor':'middle',class:'svg-caption'},'RANDAO seed'),el('text',{x:57,y:-7,'text-anchor':'middle',class:'svg-caption'},'유효 지분'));
  this.assignmentResult=el('text',{x:0,y:46,'text-anchor':'middle',class:'svg-assignment'},'배정된 제안자');this.assignment.append(this.assignmentResult);svg.append(this.assignment);
  this.epochScene=el('g');this.epochCards=[];this.epochLinks=[];
  this.epochHeading=el('text',{'text-anchor':'middle',class:'svg-epoch-heading'});this.epochScene.append(this.epochHeading);
  for(let i=0;i<3;i++){
   const g=el('g',{role:'button',tabindex:0,'aria-label':`체크포인트 C${99+i} 상세`,'data-select':`checkpoint:${99+i}`,class:'inspectable'});
   const plate=el('rect',{x:-71,y:-75,width:142,height:149,rx:12,fill:'var(--panel)',stroke:'var(--line)','stroke-width':1.5});
   g.append(el('rect',{x:-65,y:-69,width:142,height:149,rx:12,fill:'var(--control)',stroke:'var(--line)'}),plate,el('text',{x:-51,y:-49,class:'svg-caption'},`체크포인트 · E${99+i}`),el('text',{x:-51,y:-7,class:'svg-block-id'},`C${99+i}`));
   const status=el('text',{x:-51,y:21,class:'svg-caption'});g.append(status,el('path',{d:'M-51 38H51M-51 46H26M-51 54H43',stroke:'var(--line)','stroke-width':3}));this.epochScene.append(g);this.epochCards.push({g,plate,status});
  }
  for(let i=0;i<2;i++){const path=el('path',{fill:'none',stroke:'var(--blue)','stroke-width':3,pathLength:1,'stroke-dasharray':1});this.epochScene.append(path);const label=el('text',{'text-anchor':'middle',class:'svg-foot'});this.epochScene.append(label);this.epochLinks.push({path,label});}
  this.epochNote=el('text',{'text-anchor':'middle',class:'svg-foot'});this.epochScene.append(this.epochNote);svg.append(this.epochScene);
  this.epochLine=el('g',{'aria-hidden':'true'});svg.append(this.epochLine);this.ticks=[];for(let i=0;i<32;i++){const r=el('rect',{width:5,height:10,rx:1,fill:'var(--track)'});this.epochLine.append(r);this.ticks.push(r);}
  this.epochLabel=el('text',{'text-anchor':'middle',class:'svg-foot'});svg.append(this.epochLabel);
  svg.addEventListener('click',e=>{const n=e.target.closest('[data-select]');if(n)this.onSelect(n.dataset.select);});
  svg.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){const n=e.target.closest('[data-select]');if(n){e.preventDefault();this.onSelect(n.dataset.select);}}});
  this.layout(false);
 }
 layout(mobile){this.mobile=mobile;this.center=mobile?[210,235]:[480,160];this.positions=mobile?[[60,65],[60,165],[360,65],[360,165],[60,295],[60,395],[360,295],[360,395]]:[[90,85],[250,65],[710,65],[870,85],[90,245],[250,245],[710,245],[870,245]];
  this.svg.setAttribute('viewBox',mobile?'0 0 420 500':'0 0 960 350');this.block.setAttribute('transform',`translate(${this.center})`);set(this.assignment,'transform',`translate(${this.center}) scale(${mobile?.78:1})`);
  const xs=mobile?[70,210,350]:[245,480,715],cy=mobile?215:155;this.epochXs=xs;this.epochY=cy;
  set(this.epochHeading,'x',this.center[0]);set(this.epochHeading,'y',mobile?80:30);
  this.epochCards.forEach((n,i)=>set(n.g,'transform',`translate(${xs[i]} ${cy}) scale(${mobile?.8:1})`));
  this.epochLinks.forEach((n,i)=>{set(n.path,'d',`M${xs[i]} ${cy+83} Q${(xs[i]+xs[i+1])/2} ${cy+160} ${xs[i+1]} ${cy+83}`);set(n.label,'x',(xs[i]+xs[i+1])/2);set(n.label,'y',cy+153);});
  set(this.epochNote,'x',this.center[0]);set(this.epochNote,'y',mobile?417:60);
  this.nodes.forEach((n,i)=>{n.g.setAttribute('transform',`translate(${this.positions[i]})`);const a=this.positions[DELIVERIES[i].from],b=this.positions[i],c=[(a[0]+b[0])/2,(a[1]+b[1])/2-45];this.wires[i].setAttribute('d',curve(a,b,c));});
  set(this.caption,'x',this.center[0]);set(this.caption,'y',mobile?350:273);set(this.epochLine,'transform',`translate(${mobile?58:328} ${mobile?460:313})`);this.ticks.forEach((r,i)=>set(r,'x',i*9.6));set(this.epochLabel,'x',this.center[0]);set(this.epochLabel,'y',mobile?487:340);
 }
 draw(s,{selected='',reduced=false,view=presentation(s)}={}){
  const t=s.t,epochOpacity=reduced?(t>=12?1:0):ease((t-11.6)/.4),assemblyOpacity=reduced?(t>=3?1:0):ease((t-2.6)/.4);
  set(this.assignment,'opacity',(1-assemblyOpacity)*(1-epochOpacity));text(this.assignmentResult,s.assigned?'V03 · 이번 슬롯 제안자':'배정 확인 중');
  set(this.block,'opacity',assemblyOpacity*(1-epochOpacity));set(this.block,'visibility',t>=12||t<3?'hidden':'visible');set(this.block,'tabindex',t>=12||t<3?-1:0);
  set(this.epochScene,'opacity',epochOpacity);set(this.epochScene,'visibility',t>=12?'visible':'hidden');
  text(this.epochHeading,this.mobile?(s.t>=22?(s.checkpoints[1].finalized?'C100은 확정, C101은 아직':'지지가 부족해, 확정은 대기'):'두 epoch의 연결을 봅니다'):s.t>=22?(s.checkpoints[1].finalized?'두 번의 지지, C100의 최종 확정':'지지가 부족하면, 확정은 전진하지 않습니다'):'한 블록에서, 두 epoch의 연결로');
  text(this.epochNote,this.mobile?'중간 슬롯 생략 · 시간 압축':'중간 슬롯은 시간 압축 · 체크포인트 사이에도 블록이 이어집니다');
  this.epochCards.forEach((n,i)=>{const c=s.checkpoints[i],exists=i===0||i===1&&s.proposed||i===2&&s.nextBlock;set(n.g,'opacity',exists?1:.3);set(n.g,'tabindex',t>=12?0:-1);set(n.g,'data-selected',selected===`checkpoint:${c.epoch}`);set(n.plate,'stroke',c.finalized?'var(--teal)':c.justified?'var(--blue)':'var(--line)');set(n.plate,'fill',c.finalized?'var(--control)':'var(--panel)');text(n.status,c.finalized?STATUS.finalized:c.justified?STATUS.justified:exists?STATUS.accepted:'제안 전');});
  this.epochLinks.forEach((n,i)=>{const count=s.votes[100+i].length,source=s.sources[100+i]-99,x=this.epochXs,y=this.epochY;set(n.path,'d',`M${x[source]} ${y+83} Q${(x[source]+x[i+1])/2} ${y+160} ${x[i+1]} ${y+83}`);set(n.path,'data-source',s.sources[100+i]);set(n.label,'x',(x[source]+x[i+1])/2);set(n.label,'y',y+153+(source!==i?19:0));set(n.path,'stroke-dashoffset',1-count/12);set(n.path,'stroke',count>=8?'var(--teal)':'var(--blue)');text(n.label,`${count} / 12 지지${source!==i?' · C99 → C101':''}`);});
  set(this.wireLayer,'opacity',(1-epochOpacity)*(view.step.key==='propagate'?1:.16));set(this.caption,'opacity',1-epochOpacity);
  set(this.shell,'stroke',s.checkpoints[1].finalized?'var(--teal)':s.checkpoints[1].justified?'var(--blue)':'var(--purple)');
  text(this.blockLabel,view.block);
  this.rows.forEach((r,i)=>{const p=clamp((t-3-i*.55)/1.4),v=reduced?(p===1?1:0):ease(p);set(r,'opacity',v);set(r,'transform',`translate(${(-95+i*20)*(1-v)} ${-20*(1-v)})`);});
  set(this.seal,'opacity',s.checkpoints[1].finalized?1:0);set(this.block,'data-selected',selected==='block');
  text(this.caption,t<3?'예시 배정 · 실제 RANDAO 계산 아님':t<12?'실행 payload + 합의 정보':`C100 · ${s.blockStatus==='finalized'?'최종 확정':s.blockStatus==='justified'?'정당화됨 · 최종 확정 전':'최종 확정 전'}`);
  this.nodes.forEach((n,i)=>{const p=s.peers[i],proposer=i===2&&s.assigned;
   set(n.outline,'stroke',p.offline?'var(--danger)':proposer?'var(--purple)':p.attested?'var(--blue)':p.verified?'var(--teal)':'var(--line)');set(n.outline,'stroke-dasharray',p.offline?'4 4':'none');set(n.status,'fill',p.offline?'var(--danger)':proposer?'var(--purple)':p.verified?'var(--teal)':'var(--muted)');set(n.g,'data-selected',selected===`peer:${i}`);set(n.g,'opacity',(p.offline?.72:view.activePeers.includes(i)||selected===`peer:${i}`?1:.72)*(1-epochOpacity));set(n.outline,'stroke-width',view.activePeers.includes(i)?2.5:1);set(n.g,'data-active',view.activePeers.includes(i));set(n.g,'visibility',t>=12?'hidden':'visible');set(n.g,'tabindex',t>=12?-1:0);
   text(n.status,p.offline?'OFF':proposer?'제안자':p.verified?'검증됨':p.received?'수신':'대기');text(n.vote,p.attested?(this.mobile?'◆ 투표':'◆ 투표 · head / source / target'):'');
   n.bars.forEach((bar,j)=>{let f=p.offline?0:clamp((t-(8.05+i*.12+j*.4))/.6);if(reduced)f=p.verified?1:0;set(bar,'transform',`scale(${f} 1)`);});
   const a=this.positions[DELIVERIES[i].from],b=this.positions[i],c=[(a[0]+b[0])/2,(a[1]+b[1])/2-45],progress=clamp((t-DELIVERIES[i].at)/.65);
   const pos=point(a,b,c,ease(progress));set(this.packets[i],'transform',`translate(${pos})`);set(this.packets[i],'opacity',!reduced&&i!==2&&!p.offline&&progress>0&&progress<1?1:0);
   set(this.wires[i],'stroke',p.received?'var(--muted)':'var(--line)');set(this.wires[i],'opacity',p.offline?.25:t>=12?.35:.8);
  });
  set(this.epochLine,'visibility',t>=12?'hidden':'visible');
  const epochProgress=(s.seconds%384)/384;this.ticks.forEach((r,i)=>set(r,'fill',i<Math.floor(epochProgress*32)?'var(--blue)':'var(--track)'));
  text(this.epochLabel,`EPOCH ${s.epoch} · SLOT ${s.slot} · 12 s / slot`);
 }
}
