let active=null,panel=null,pinned=false,timer,suppressFocus=false;
let sequence=0;
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
function close(restore=false){
  clearTimeout(timer);const trigger=active;active=null;pinned=false;
  if(trigger){trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-controls');}
  panel?.remove();panel=null;
  if(restore&&trigger?.isConnected){suppressFocus=true;trigger.focus({preventScroll:true});suppressFocus=false;}
}
function position(){if(!active||!panel)return;const box=active.getBoundingClientRect(),width=panel.offsetWidth,height=panel.offsetHeight;
  panel.style.left=Math.max(12,Math.min(box.left,innerWidth-width-12))+'px';
  panel.style.top=Math.max(12,box.bottom+10+height<=innerHeight-12?box.bottom+10:Math.min(box.top-height-10,innerHeight-height-12))+'px';
}
function show(trigger,profile,data){
  clearTimeout(timer);if(active===trigger)return;close();active=trigger;
  const d=data.registry.deployments.find(d=>d.id===profile.deploymentId),coin=data.registry.coins.find(c=>c.id===d.coinId),network=data.registry.networks.find(n=>n.id===d.networkId);
  panel=el('section',undefined,'token-info-popover');panel.id='token-info-'+(++sequence);panel.setAttribute('role','dialog');panel.setAttribute('aria-label',`${coin.symbol} · ${network.name} 기본정보`);panel.tabIndex=-1;
  panel.append(el('h3',`${coin.symbol} · ${network.name}`),el('span',profile.standard,'token-info-standard'),el('p',profile.assetDescription),el('p',profile.networkDescription));
  const list=el('dl'),add=(label,value)=>list.append(el('dt',label),el('dd',value));
  add('네트워크',network.name);add('표준',profile.standard);
  if(profile.identity.kind==='ISSUED'){add('발행자',profile.identity.issuer);add('통화 코드',profile.identity.currency);}
  else add(profile.identity.kind==='MINT'?'Mint 주소':'컨트랙트 주소',profile.identity.address);
  panel.append(list);
  const sources=el('div',undefined,'token-info-sources');
  for(const source of profile.sources){const link=el('a',source.title+' ↗');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';sources.append(link);}
  panel.append(sources,el('small',`공식 자료 확인 ${profile.reviewedAt.slice(0,10)} · 기본정보이며 검증 판정과 별도입니다.`));
  panel.addEventListener('pointerenter',()=>clearTimeout(timer));panel.addEventListener('pointerleave',()=>{if(!pinned)timer=setTimeout(()=>close(),180);});
  panel.addEventListener('focusout',event=>{if(!panel?.contains(event.relatedTarget)&&event.relatedTarget!==active)close();});
  document.body.append(panel);trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','true');position();
}
export function tokenInfoButton(data,deploymentId,label='ⓘ'){
  const profile=data.tokenProfiles?.find(p=>p.deploymentId===deploymentId);if(!profile)return null;
  const d=data.registry.deployments.find(d=>d.id===deploymentId),coin=data.registry.coins.find(c=>c.id===d.coinId),network=data.registry.networks.find(n=>n.id===d.networkId);
  const button=el('button',label,'token-info-trigger');button.type='button';button.setAttribute('aria-label',`${coin.symbol} · ${network.name} 기본정보`);button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
  button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')show(button,profile,data);});
  button.addEventListener('pointerleave',()=>{if(active===button&&!pinned)timer=setTimeout(()=>close(),180);});
  button.addEventListener('focus',()=>{if(!suppressFocus)show(button,profile,data);});
  button.addEventListener('blur',event=>{if(active===button&&!panel?.contains(event.relatedTarget))close();});
  button.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();button.click();}});
  button.addEventListener('click',()=>{if(active===button&&pinned){close();return;}show(button,profile,data);pinned=true;panel.focus({preventScroll:true});});
  return button;
}
document.addEventListener('pointerdown',event=>{if(active&&!active.contains(event.target)&&!panel?.contains(event.target))close();},{capture:true});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();close(true);}});
window.addEventListener('resize',position);window.addEventListener('scroll',event=>{if(active&&event.target!==panel&&!panel?.contains(event.target))close();},{capture:true});
new MutationObserver(()=>{if(active&&!active.isConnected)close();}).observe(document.body,{childList:true,subtree:true});
