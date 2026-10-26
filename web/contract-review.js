import {contractReviews,contractReviewGroups} from './contract-review-data.js';

const element=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function initializeContractReview(root){
  let selected=contractReviews[0],group='overview';
  const layout=element('div',undefined,'contract-layout');
  const directory=element('aside',undefined,'panel contract-directory');directory.setAttribute('aria-label','저장된 컨트랙트 보고서');
  const searchLabel=element('label','보고서 찾기'),search=element('input');search.type='search';search.placeholder='이름 · 네트워크 · 주소';searchLabel.append(search);
  const list=element('div',undefined,'contract-report-list'),empty=element('p','일치하는 보고서가 없습니다.','muted');empty.hidden=true;
  const count=element('p',undefined,'chart-note');count.setAttribute('role','status');
  directory.append(element('h2','저장 보고서'),searchLabel,count,list,empty,element('p','검토된 요약만 표시합니다.','chart-note'));
  const workspace=element('article',undefined,'contract-workspace');workspace.setAttribute('aria-label','선택한 컨트랙트 분석');layout.append(directory,workspace);root.replaceChildren(layout);
  function renderList(){
    const term=search.value.trim().toLowerCase();list.replaceChildren();
    const found=contractReviews.filter(r=>[r.name,r.network,r.chainId,r.address].some(v=>v.toLowerCase().includes(term)));
    for(const report of found){
      const button=element('button',undefined,'contract-report-button');button.type='button';button.dataset.contractReport=report.id;button.setAttribute('aria-pressed',String(selected.id===report.id));
      button.append(element('strong',report.name),element('small',`${report.network} · ${report.reviewedAt}`),element('span',`${report.status} · runtime 미확인`,'contract-status'));
      button.addEventListener('click',()=>{selected=report;group='overview';renderList();renderDetail();});list.append(button);
    }
    count.textContent=`${found.length} / ${contractReviews.length}개 보고서`;empty.hidden=found.length!==0;
  }
  function renderDetail(){
    root.dataset.contractReview=selected.id;workspace.replaceChildren();
    const header=element('header',undefined,'panel contract-heading'),title=element('div');
    title.append(element('p',`${selected.network} · chainId ${selected.chainId}`,'eyebrow'),element('h2',selected.name),element('p',selected.purpose,'muted'));
    const status=element('span',`${selected.status} · 배포 연결 미확인`,'contract-status');
    const heading=element('div',undefined,'panel-heading');heading.append(title,status);
    header.append(heading,element('p',selected.address,'contract-address'),element('p',`소스 분석 기준일 ${selected.analysisDate} · 실제 기준 블록 UNKNOWN`,'chart-note'));
    const metrics=element('div',undefined,'contract-metrics');
    for(const [value,label]of [['16','소스 함수'],['11','검토 항목'],['10 / 10','사설 검증 PASS'],['UNKNOWN','실제 runtime']]){
      const card=element('div');card.append(element('strong',value),element('span',label));metrics.append(card);
    }header.append(metrics);workspace.append(header);
    const tabs=element('div',undefined,'contract-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','컨트랙트 분석 내용');
    const panels=new Map(),buttons=new Map();
    function activate(key,focus=false){group=key;for(const [id,button]of buttons){const active=id===key;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;panels.get(id).hidden=!active;}if(focus)buttons.get(key).focus();}
    for(const [key,label]of contractReviewGroups){
      const button=element('button',label);button.type='button';button.id=`contract-${key}-tab`;button.setAttribute('role','tab');button.setAttribute('aria-controls',`contract-${key}-panel`);
      const panel=element('div',undefined,'contract-tabpanel');panel.id=`contract-${key}-panel`;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;
      button.addEventListener('click',()=>activate(key));
      button.addEventListener('keydown',event=>{const keys=contractReviewGroups.map(([id])=>id),index=keys.indexOf(key);let next;if(event.key==='ArrowRight')next=(index+1)%keys.length;if(event.key==='ArrowLeft')next=(index+keys.length-1)%keys.length;if(event.key==='Home')next=0;if(event.key==='End')next=keys.length-1;if(next!==undefined){event.preventDefault();activate(keys[next],true);}});
      buttons.set(key,button);panels.set(key,panel);tabs.append(button);
    }
    for(const item of selected.sections){
      const section=element('section',undefined,'panel contract-section');section.dataset.contractSection=item.id;
      section.append(element('h3',item.title),element('p',item.intro,'muted'));
      if(item.facts){const dl=element('dl',undefined,'contract-facts');for(const [label,value]of item.facts)dl.append(element('dt',label),element('dd',value));section.append(dl);}
      if(item.rows){
        const scroll=element('div',undefined,'table-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',`${selected.name} ${item.title}`);
        const table=element('table',undefined,'contract-table'),thead=element('thead'),tr=element('tr'),tbody=element('tbody');
        table.append(element('caption',`${selected.name} · ${item.title}`,'sr-only'));
        for(const text of item.columns){const th=element('th',text);th.scope='col';tr.append(th);}thead.append(tr);
        for(const row of item.rows){const tr=element('tr');row.forEach((text,index)=>{const cell=element(index===0?'th':'td',text);if(index===0)cell.scope='row';tr.append(cell);});tbody.append(tr);}
        table.append(thead,tbody);scroll.append(table);section.append(scroll);
      }
      if(item.notes){const ul=element('ul');for(const text of item.notes)ul.append(element('li',text));section.append(ul);}
      panels.get(item.group).append(section);
    }
    workspace.append(tabs,...panels.values());activate(group);
  }
  search.addEventListener('input',renderList);renderList();renderDetail();
}
const root=document.querySelector('#contract-review-root');
if(root){
  initializeContractReview(root);
  const button=document.querySelector('#contract-theme');button.addEventListener('click',()=>document.querySelector('#theme-toggle').click());
  const updateTheme=()=>{const light=document.documentElement.dataset.theme==='light';button.textContent=light?'☾ 다크':'☀ 라이트';button.setAttribute('aria-label',`${light?'다크':'라이트'} 모드로 전환`);};
  new MutationObserver(updateTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});updateTheme();
}
