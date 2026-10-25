import {sourceComparison} from './comparison-model.js';
import {sourceReviewProfiles, sourceProfileStatus, sourceFeatureLabels} from './source-review-data.js';

const node = (tag, text, className) => {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
};
for (const root of document.querySelectorAll('[data-comparison-workspace]')) {
  const switcher = root.querySelector('[data-comparison-switch]');
  const reports = root.querySelector('[data-report-comparison]');
  const panel = node('section', undefined, 'profile-comparison');
  panel.setAttribute('aria-label','저장 소스 프로필 비교');
  const heading = node('div', undefined, 'comparison-intro');
  heading.append(node('h2','자산 비교'), node('p','자산과 네트워크를 함께 선택하고, 저장 소스의 기능·조건·근거를 나란히 확인하세요.'));
  const selectors = node('div', undefined, 'profile-compare-selectors');
  let selection = ['usdc-ethereum','usdt-ethereum',''];
  const controls = selection.map((id, index) => {
    const label = node('label', `프로필 ${index+1}${index===2?' · 선택 사항':''}`);
    const select = node('select');select.setAttribute('aria-label',label.textContent);
    const empty = node('option', index===2?'선택 안 함':'프로필 선택');empty.value='';select.append(empty);
    for (const profile of sourceReviewProfiles) {
      const option = node('option',`${profile.symbol} · ${profile.network} · ${sourceProfileStatus(profile)}`);
      option.value=profile.id;select.append(option);
    }
    select.value=id;label.append(select);selectors.append(label);
    select.addEventListener('change',()=>{selection[index]=select.value;render();});
    return select;
  });
  const note = node('p','각 셀은 해당 프로필의 검토 범위만 나타냅니다. 항목명이 같은 경우에도 체인별 실행 의미는 다를 수 있습니다. 미수록은 기능 부재가 아닙니다.','comparison-note');
  const message = node('p',undefined,'comparison-count');message.setAttribute('role','status');
  const scroll = node('div',undefined,'profile-comparison-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','프로필별 소스 조건 비교표 · 좌우로 스크롤');
  const table = node('table');const caption=node('caption','자산·네트워크별 저장 소스 검토 비교');caption.className='sr-only';
  const head=node('thead'),body=node('tbody');table.append(caption,head,body);scroll.append(table);
  panel.append(heading,selectors,note,message,scroll,node('p','소스 조건 확인은 실행 PASS·현재 배포 연결·실제 권한 인증과 별도입니다. 검토한 경로의 ‘없음’은 토큰 전체의 기능 부재를 뜻하지 않습니다.','comparison-note'));
  switcher.after(panel);
  const modes = [['profiles','자산 비교',panel],['reports','검증 비교',reports]];
  switcher.className='comparison-switch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label','비교 자료 선택');
  for(const [mode,label,target] of modes){
    target.id ||= 'comparison-'+mode;
    const button=node('button',label);button.type='button';button.dataset.comparisonMode=mode;button.setAttribute('aria-controls',target.id);
    button.addEventListener('click',()=>choose(mode));switcher.append(button);
  }
  function choose(mode){
    for(const [value,,target] of modes)target.hidden=value!==mode;
    for(const button of switcher.children)button.setAttribute('aria-pressed',String(button.dataset.comparisonMode===mode));
  }
  function render(){
    controls.forEach((select,index)=>{for(const option of select.options)option.disabled=!!option.value&&selection.some((id,other)=>other!==index&&id===option.value);});
    head.replaceChildren();body.replaceChildren();
    let comparison;
    try{comparison=sourceComparison(selection.filter(Boolean));}catch{message.textContent='서로 다른 프로필 2~3개를 선택하세요.';return;}
    const {profiles,rows}=comparison;
    message.textContent=`${profiles.length}개 프로필 · ${rows.length}개 검토 항목 · 각 프로필에 기록된 항목명 기준으로 표시`;
    const header=node('tr'),title=node('th','검토 항목');title.scope='col';header.append(title);
    for(const profile of profiles){
      const cell=node('th');cell.scope='col';cell.dataset.comparedProfile=profile.id;
      const link=node('a','소스 검토 근거 →');link.href='/source-review-notes.html#'+profile.id;
      cell.append(node('strong',`${profile.symbol} · ${profile.network}`),node('small',sourceProfileStatus(profile)),node('small',`${profile.identityLabel??'컨트랙트 주소'} · ${profile.address||'식별자 미확보'}`),node('small',`검토 ${profile.reviewedAt}`),link);header.append(cell);
    }
    head.append(header);
    for(const row of rows){
      const tr=node('tr'),label=node('th',row.label);label.scope='row';label.append(node('small',row.group));tr.append(label);
      for(const items of row.cells){
        const cell=node('td');
        if(!items.length)cell.append(node('p','해당 검토 범위에 미수록','comparison-missing-feature'));
        for(const item of items){
          const block=node('div');block.dataset.sourceFeature=item.id;
          block.append(node('strong',sourceFeatureLabels[item.status]??item.status),node('p',item.detail),node('small',`근거 · ${item.evidence}`));cell.append(block);
        }
        tr.append(cell);
      }
      body.append(tr);
    }
  }
  render();choose('profiles');
}
