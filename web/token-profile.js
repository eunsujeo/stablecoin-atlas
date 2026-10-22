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
  mount(trigger);
}
function mount(trigger){
  panel.addEventListener('pointerenter',()=>clearTimeout(timer));panel.addEventListener('pointerleave',()=>{if(!pinned)timer=setTimeout(()=>close(),180);});
  panel.addEventListener('focusout',event=>{if(!panel?.contains(event.relatedTarget)&&event.relatedTarget!==active)close();});
  document.body.append(panel);trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','true');position();
}
export function tokenInfoButton(data,deploymentId,label='ⓘ'){
  const profile=data.tokenProfiles?.find(p=>p.deploymentId===deploymentId);if(!profile)return null;
  const d=data.registry.deployments.find(d=>d.id===deploymentId),coin=data.registry.coins.find(c=>c.id===d.coinId),network=data.registry.networks.find(n=>n.id===d.networkId);
  const button=el('button',label,'token-info-trigger');button.type='button';button.setAttribute('aria-label',`${coin.symbol} · ${network.name} 기본정보`);button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
  return bindInfoButton(button,()=>show(button,profile,data));
}
function bindInfoButton(button,open){
  button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')open();});
  button.addEventListener('pointerleave',()=>{if(active===button&&!pinned)timer=setTimeout(()=>close(),180);});
  button.addEventListener('focus',()=>{if(!suppressFocus)open();});
  button.addEventListener('blur',event=>{if(active===button&&!panel?.contains(event.relatedTarget))close();});
  button.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();button.click();}});
  button.addEventListener('click',()=>{if(active===button&&pinned){close();return;}open();pinned=true;panel.focus({preventScroll:true});});
  return button;
}
document.addEventListener('pointerdown',event=>{if(active&&!active.contains(event.target)&&!panel?.contains(event.target))close();},{capture:true});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();close(true);}});
window.addEventListener('resize',position);window.addEventListener('scroll',event=>{if(active&&event.target!==panel&&!panel?.contains(event.target))close();},{capture:true});
new MutationObserver(()=>{if(active&&!active.isConnected)close();}).observe(document.body,{childList:true,subtree:true});

export function registeredCoinInfoButton(index,market,coinId,label,networkId='all'){
 const coin=index?.coins.find(c=>c.id===coinId),basic=coin?.basicInfo;if(!basic)return null;
 const button=el('button',label??coin.symbol+' ⓘ','token-info-trigger');button.type='button';button.setAttribute('aria-label',coin.symbol+' 기본정보');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
 return bindInfoButton(button,()=>{
  clearTimeout(timer);if(active===button)return;close();active=button;
  panel=el('section',undefined,'token-info-popover');panel.id='token-info-'+(++sequence);panel.setAttribute('role','dialog');panel.setAttribute('aria-label',coin.symbol+' 기본정보');panel.tabIndex=-1;
  panel.append(el('h3',coin.name+' · '+coin.symbol));const list=el('dl'),add=(k,v)=>list.append(el('dt',k),el('dd',v));add('연동 통화',coin.pegCurrency);
  const ids=networkId==='all'?basic.networks:[networkId];add('네트워크',ids.map(id=>index.networks.find(n=>n.id===id)?.name??id).join(' · '));
  const known=[...basic.profiles];let description;
  for(const p of market?.tokenProfiles??[]){const d=market.registry.deployments.find(d=>d.id===p.deploymentId);if(d?.coinId===coinId){known.push({networkId:d.networkId,standard:p.standard,identity:p.identity});description??=p.assetDescription;}}
  if(description)panel.append(el('p',description));
  const profiles=known.filter(p=>ids.includes(p.networkId));
  for(const p of profiles){const name=index.networks.find(n=>n.id===p.networkId)?.name??p.networkId;add(name+' · '+p.standard,p.identity.kind==='ISSUED'?p.identity.currency+' · '+p.identity.issuer:p.identity.address);}
  if(!profiles.length)add('표준·주소','확인된 기본정보 미확보');
  panel.append(list);for(const note of coin.notes)panel.append(el('p',note));
  const links=el('div',undefined,'token-info-sources');for(const source of basic.sources){const a=el('a',source.title+' ↗');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}panel.append(links,el('small','기본정보 확인 '+basic.reviewedAt.slice(0,10)));mount(button);
 });
}
