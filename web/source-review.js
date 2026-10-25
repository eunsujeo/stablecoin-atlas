import {sourceReviewProfiles,sourceReviewDate,sourceReviewNotice,sourceReviewFor,sourceFeaturesFor,sourceFeatureLabels} from './source-review-data.js';
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const coins=[...new Set(sourceReviewProfiles.map(p=>p.coinId))];
const sections=[['overview','개요'],['behavior','검증 결과'],['evidence','근거·한계']];
export function initializeSourceReview(root){
  let coinId=coins[0],chainId='1',activeSection='behavior';
  const rememberedChains=new Map();
  const heading=node('div',undefined,'source-review-heading');
  heading.append(node('h2','자산별 기술 프로필'),node('p',`소스 기준 · ${sourceReviewDate} 검토`));
  const layout=node('div',undefined,'source-review-layout'),directory=node('aside',undefined,'source-review-directory');
  directory.setAttribute('aria-label','검토 자산 선택');
  const directoryHeading=node('div',undefined,'source-review-directory-heading');
  directoryHeading.append(node('strong','검토 자산'),node('span',`${coins.length}개 자산 · ${sourceReviewProfiles.length}개 검토 프로필`));
  const searchLabel=node('label','자산 찾기','source-review-search'),search=node('input');
  search.type='search';search.placeholder='토큰 · 체인 · 주소';search.autocomplete='off';searchLabel.append(search);
  const list=node('div',undefined,'source-review-asset-list');
  const empty=node('p','일치하는 자산이 없습니다. 검색어를 바꿔보세요.','source-review-empty');empty.hidden=true;
  directory.append(directoryHeading,searchLabel,list,empty,node('p','선택 목록은 소스를 검토한 네트워크입니다. 자산의 전체 발행 네트워크 목록과는 다릅니다.','source-review-directory-note'));
  const workspace=node('div',undefined,'source-review-workspace'),toolbar=node('div',undefined,'source-review-toolbar');
  const selection=node('p');selection.setAttribute('role','status');
  const field=node('label','검토 네트워크'),network=node('select');network.setAttribute('aria-label','소스 검토 네트워크');field.append(network);toolbar.append(selection,field);
  const detail=node('article',undefined,'source-review-detail');
  workspace.append(toolbar,detail);layout.append(directory,workspace);root.replaceChildren(heading,layout);
  function renderDirectory(){
    const query=search.value.trim().toLowerCase();list.replaceChildren();
    for(const id of coins){
      const profiles=sourceReviewProfiles.filter(p=>p.coinId===id);
      if(query&&!profiles.some(p=>[p.symbol,p.network,p.chainId,p.address].some(value=>value.toLowerCase().includes(query))))continue;
      const button=node('button',undefined,'source-review-asset');button.type='button';button.dataset.coinId=id;button.setAttribute('aria-pressed',String(id===coinId));
      const mark=node('span',id.slice(0,1).toUpperCase(),'source-review-mark');mark.setAttribute('aria-hidden','true');
      const text=node('span');text.append(node('strong',id.toUpperCase()),node('small',`검토 ${profiles.length}곳 · ${profiles.map(p=>p.network).join(' / ')}`));button.append(mark,text);
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
    const p=sourceReviewFor(coinId,chainId);detail.replaceChildren();root.dataset.reviewId=p.id;
    const features=sourceFeaturesFor(coinId,chainId);
    selection.replaceChildren(node('strong',p.symbol),node('span',`공통 ${features.length}개 기능`));
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
    results.append(node('h4','기능별 검증 결과'),node('p','있음·없음은 검토한 소스 경로 기준입니다. 근거가 부족한 항목은 추가 검토로 표시합니다.','source-review-result-note'));
    const filters=node('div',undefined,'source-review-feature-filters');filters.setAttribute('aria-label','기능 확인 상태 필터');
    const table=node('table'),caption=node('caption',`${p.symbol} / ${p.network} · 소스 기능별 확인 결과`);caption.className='sr-only';
    const head=node('thead'),heading=node('tr');
    for(const title of ['기능','유무','소스 조건·근거']){const cell=node('th',title);cell.scope='col';heading.append(cell);}head.append(heading);
    const body=node('tbody'),empty=node('p','해당 상태의 기능이 없습니다.','source-review-result-note');empty.hidden=true;
    for(const feature of features){
      const row=node('tr');row.dataset.featureId=feature.id;row.dataset.featureStatus=feature.status;
      const title=node('th');title.scope='row';title.append(node('strong',feature.label),node('small',feature.group));
      const status=node('td');status.dataset.label='유무';status.append(node('span',sourceFeatureLabels[feature.status],`source-review-result-status feature-${feature.status.toLowerCase()}`));
      const content=node('td');content.dataset.label='소스 조건·근거';content.append(node('p',feature.detail),node('small',feature.evidence,'source-review-feature-evidence'));
      row.append(title,status,content);body.append(row);
    }
    for(const [value,label]of [['ALL','전체'],...Object.entries(sourceFeatureLabels)]){
      const count=value==='ALL'?features.length:features.filter(f=>f.status===value).length;
      const button=node('button',`${label} ${count}`);button.type='button';button.dataset.featureFilter=value;button.setAttribute('aria-pressed',String(value==='ALL'));
      button.addEventListener('click',()=>{
        for(const other of filters.children)other.setAttribute('aria-pressed',String(other===button));
        for(const row of body.children)row.hidden=value!=='ALL'&&row.dataset.featureStatus!==value;
        empty.hidden=count!==0;
      });filters.append(button);
    }
    table.append(caption,head,body);results.append(filters,table,empty);panels.get('behavior').append(results);
    // Source-only scope notes; historical observation/binding diagnostics remain in research records.
    const sourceLimits=['jpyc','jpysc','rlusd'].includes(p.coinId)?p.limitations:[];
    panels.get('evidence').append(node('h4','소스 검토 근거'),node('p',sourceReviewNotice),items('검토 범위',[
      '확인 대상은 선택한 저장 소스의 함수·modifier·조건입니다.',
      '실제 실행·현재 배포 설정·서비스 운영은 이 소스 검토의 확인 대상에 포함하지 않습니다.',
      ...sourceLimits,
    ]),facts([['검토 기준일',p.reviewedAt]]));
    const footer=node('footer',undefined,'source-review-footer');footer.append(node('span','확인 근거 · 저장 소스 검토'));
    const link=node('a','검토 근거·제한 발췌 보기 →');link.href=`/source-review-notes.html#${p.id}`;footer.append(link);detail.append(footer);activate(activeSection);
  }
  search.addEventListener('input',renderDirectory);network.addEventListener('change',()=>{chainId=network.value;render();});renderDirectory();networks();render();
}
for(const root of document.querySelectorAll('[data-source-review]'))initializeSourceReview(root);
