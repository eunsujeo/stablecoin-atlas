const active = new WeakMap();
function skeleton(kind) {
  const host=document.createElement('div');host.className=`loading-skeleton skeleton-${kind}`;host.setAttribute('aria-hidden','true');
  const line=(name='')=>{const item=document.createElement('span');item.className='skeleton-block '+name;return item;};
  if(kind==='chart')host.append(line('skeleton-heading'),line('skeleton-value'),line('skeleton-plot'),line('skeleton-caption'));
  else for(let i=0;i<(kind==='cards'?4:3);i++){
    const row=document.createElement('div');row.className=kind==='cards'?'skeleton-card':'skeleton-row';
    row.append(line('skeleton-heading'),line('skeleton-value'),line('skeleton-caption'));host.append(row);
  }
  return host;
}
// Only first loads replace empty content. Refreshes retain the last successful view.
export function beginLoading(root,{ready=false,targets=[]}={}) {
  const token=Symbol('loading'),saved=[];active.set(root,token);
  root.setAttribute('aria-busy','true');root.dataset.loading=ready?'refresh':'initial';
  if(!ready)for(const [selector,kind='rows']of targets){
    const target=typeof selector==='string'?root.querySelector(selector):selector;if(!target)continue;
    const original=[...target.childNodes];let placeholder=skeleton(kind);
    if(target.tagName==='TBODY'){
      const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=7;cell.append(placeholder);row.append(cell);placeholder=row;
    }else if(['OL','UL'].includes(target.tagName)){const item=document.createElement('li');item.setAttribute('aria-hidden','true');item.append(placeholder);placeholder=item;}
    saved.push({target,original,placeholder});target.replaceChildren(placeholder);
  }
  return ()=>{
    // A superseded dialog request must not finish a newer request's loading state.
    if(active.get(root)!==token)return;
    for(const {target,original,placeholder}of saved)if(placeholder.parentNode===target)target.replaceChildren(...original);
    root.setAttribute('aria-busy','false');delete root.dataset.loading;active.delete(root);
  };
}
