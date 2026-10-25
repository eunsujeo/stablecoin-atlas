import {sourceReviewProfiles,sourceReviewDate,sourceReviewNotice,sourceReviewFor} from './source-review-data.js';
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const coins=[...new Set(sourceReviewProfiles.map(p=>p.coinId))];
const sections=[['overview','개요'],['behavior','검증 결과'],['evidence','근거·한계']];
export function initializeSourceReview(root){
  let coinId=coins[0],chainId='1',activeSection='overview';
  const rememberedChains=new Map();
  const heading=node('div',undefined,'source-review-heading');
  heading.append(node('h2','자산별 기술 프로필'),node('p',`저장 소스 검토 · ${sourceReviewDate} 기준`));
  const layout=node('div',undefined,'source-review-layout'),directory=node('aside',undefined,'source-review-directory');
  directory.setAttribute('aria-label','검토 자산 선택');
  const directoryHeading=node('div',undefined,'source-review-directory-heading');
  directoryHeading.append(node('strong','검토 자산'),node('span',`${coins.length}개 자산 · ${sourceReviewProfiles.length}개 배포`));
  const searchLabel=node('label','자산 찾기','source-review-search'),search=node('input');
  search.type='search';search.placeholder='토큰 · 체인 · 주소';search.autocomplete='off';searchLabel.append(search);
  const list=node('div',undefined,'source-review-asset-list');
  const empty=node('p','일치하는 자산이 없습니다. 검색어를 바꿔보세요.','source-review-empty');empty.hidden=true;
  directory.append(directoryHeading,searchLabel,list,empty,node('p','목록은 저장 소스 검토 범위입니다. 지원 자산 목록과는 별도입니다.','source-review-directory-note'));
  const workspace=node('div',undefined,'source-review-workspace'),toolbar=node('div',undefined,'source-review-toolbar');
  const selection=node('p');selection.setAttribute('role','status');
  const field=node('label','배포 네트워크'),network=node('select');network.setAttribute('aria-label','소스 검토 네트워크');field.append(network);toolbar.append(selection,field);
  const detail=node('article',undefined,'source-review-detail');
  workspace.append(toolbar,detail);layout.append(directory,workspace);root.replaceChildren(heading,layout);
  function renderDirectory(){
    const query=search.value.trim().toLowerCase();list.replaceChildren();
    for(const id of coins){
      const profiles=sourceReviewProfiles.filter(p=>p.coinId===id);
      if(query&&!profiles.some(p=>[p.symbol,p.network,p.chainId,p.address].some(value=>value.toLowerCase().includes(query))))continue;
      const button=node('button',undefined,'source-review-asset');button.type='button';button.dataset.coinId=id;button.setAttribute('aria-pressed',String(id===coinId));
      const mark=node('span',id.slice(0,1).toUpperCase(),'source-review-mark');mark.setAttribute('aria-hidden','true');
      const text=node('span');text.append(node('strong',id.toUpperCase()),node('small',`${profiles.length}개 배포 · ${profiles.map(p=>p.network).join(' / ')}`));button.append(mark,text);
      button.addEventListener('click',()=>{
        rememberedChains.set(coinId,chainId);coinId=id;chainId=rememberedChains.get(id)??profiles[0].chainId;
        for(const entry of list.children)entry.setAttribute('aria-pressed',String(entry.dataset.coinId===id));
        networks();render();
      });list.append(button);
    }empty.hidden=list.childElementCount>0;
  }
  function networks(){
    network.replaceChildren();
    for(const p of sourceReviewProfiles.filter(p=>p.coinId===coinId)){const option=node('option',`${p.network} · chainId ${p.chainId}`);option.value=p.chainId;network.append(option);}
    network.value=chainId;
  }
  function facts(entries){const dl=node('dl',undefined,'source-review-identity');for(const [label,value]of entries)dl.append(node('dt',label),node('dd',value));return dl;}
  function items(title,values){const section=node('section',undefined,'source-review-section'),list=node('ul');for(const text of values)list.append(node('li',text));section.append(node('h4',title),list);return section;}
  function render(){
    const p=sourceReviewFor(coinId,chainId);detail.replaceChildren();root.dataset.reviewId=p.id;selection.textContent=`${p.symbol} / ${p.network}`;
    const hero=node('header',undefined,'source-review-hero'),title=node('div');
    title.append(node('p','TOKEN PROFILE','source-review-eyebrow'),node('h3',p.symbol),node('p',`${p.network} · chainId ${p.chainId}`));
    hero.append(title);detail.append(hero);
    const tablist=node('div',undefined,'source-review-tabs');tablist.setAttribute('role','tablist');tablist.setAttribute('aria-label','자산 프로필 내용');
    const panels=new Map(),tabs=new Map();
    function activate(key,focus=false){activeSection=key;for(const [id,tab]of tabs){tab.setAttribute('aria-selected',String(id===key));tab.tabIndex=id===key?0:-1;panels.get(id).hidden=id!==key;}if(focus)tabs.get(key).focus();}
    for(const [key,label]of sections){
      const tab=node('button',label);tab.type='button';tab.id=`${root.id}-${key}-tab`;tab.setAttribute('role','tab');
      const panel=node('section',undefined,'source-review-tabpanel');panel.id=`${root.id}-${key}-panel`;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.tabIndex=0;
      tab.setAttribute('aria-controls',panel.id);tab.addEventListener('click',()=>activate(key));
      tab.addEventListener('keydown',event=>{
        const index=sections.findIndex(([id])=>id===key);let next;
        if(event.key==='ArrowRight')next=(index+1)%sections.length;if(event.key==='ArrowLeft')next=(index+sections.length-1)%sections.length;
        if(event.key==='Home')next=0;if(event.key==='End')next=sections.length-1;
        if(next!==undefined){event.preventDefault();activate(sections[next][0],true);}
      });tabs.set(key,tab);panels.set(key,panel);tablist.append(tab);
    }detail.append(tablist,...panels.values());
    const overview=panels.get('overview');
    overview.append(node('h4','자산 정보'),facts([['네트워크',p.network],['chainId',p.chainId],['컨트랙트',p.address],['기능·권한 조건','소스 확인 완료'],['소스 검토 기준일',p.reviewedAt]]));
    const summary=node('div',undefined,'source-review-summary');summary.append(node('h4','소스 확인 범위'),node('p','전송·승인·발행과 발행사 제어·권한 조건. 항목별 확인 내용은 검증 결과 탭에서 확인할 수 있습니다.'));
    overview.append(summary,node('p',sourceReviewNotice,'source-review-notice'));
    const results=node('section',undefined,'source-review-results');
    results.append(node('h4','항목별 검증 결과'),node('p','저장 소스의 함수·modifier·조건 확인 결과입니다. 실행 보고서의 PASS/FAIL과 별도로 표시합니다.','source-review-result-note'));
    const table=node('table'),caption=node('caption',`${p.symbol} / ${p.network} · 소스 확인 결과`);caption.className='sr-only';
    const head=node('thead'),heading=node('tr');
    for(const title of ['검토 항목','확인 상태','확인 내용']){const cell=node('th',title);cell.scope='col';heading.append(cell);}head.append(heading);
    const body=node('tbody');
    for(const [category,values]of [['기능',p.functions],['권한',p.authorities]]){
      for(const [index,text]of values.entries()){
        const row=node('tr');row.dataset.reviewStatus=p.sourceReviewStatus;
        const title=node('th',`${category} ${index+1}`);title.scope='row';
        const status=node('td');status.dataset.label='확인 상태';status.append(node('span',p.sourceReviewStatus==='SOURCE_REVIEWED'?'소스 확인 완료':'소스 검토 전','source-review-result-status'));
        const content=node('td',text);content.dataset.label='확인 내용';
        row.append(title,status,content);body.append(row);
      }
    }
    table.append(caption,head,body);results.append(table);panels.get('behavior').append(results);
    panels.get('evidence').append(node('h4','저장 관측과 소스 연결'),node('p',p.observation),node('p',p.bindingDetail,'source-review-binding'),items('검토 한계',p.limitations),facts([['검토 기준일',p.reviewedAt]]));
    const footer=node('footer',undefined,'source-review-footer');footer.append(node('span','확인 근거 · 저장 소스와 관측 자료'));
    const link=node('a','검토 근거·제한 발췌 보기 →');link.href=`/source-review-notes.html#${p.id}`;footer.append(link);detail.append(footer);activate(activeSection);
  }
  search.addEventListener('input',renderDirectory);network.addEventListener('change',()=>{chainId=network.value;render();});renderDirectory();networks();render();
}
for(const root of document.querySelectorAll('[data-source-review]'))initializeSourceReview(root);
