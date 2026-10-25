import {sourceReviewProfiles,sourceReviewDate,sourceReviewNotice,sourceReviewFor} from './source-review-data.js';
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
export function initializeSourceReview(root){
  let coinId='usdc',chainId='1';
  const heading=node('div',undefined,'source-review-heading');heading.append(node('h2','토큰 소스 검토'),node('p',`검토 기준 ${sourceReviewDate} · 5개 토큰 · 8개 배포`));
  const filters=node('div',undefined,'source-review-filters'),coin=node('select'),network=node('select');
  coin.setAttribute('aria-label','소스 검토 토큰');network.setAttribute('aria-label','소스 검토 네트워크');
  for(const id of [...new Set(sourceReviewProfiles.map(p=>p.coinId))]){const option=node('option',id.toUpperCase());option.value=id;coin.append(option);}
  for(const [label,control]of [['토큰',coin],['네트워크',network]]){const field=node('label',label);field.append(control);filters.append(field);}
  const detail=node('article',undefined,'source-review-detail');detail.setAttribute('aria-live','polite');
  root.append(heading,node('p',sourceReviewNotice,'source-review-notice'),filters,detail);
  function networks(){
    network.replaceChildren();
    const profiles=sourceReviewProfiles.filter(p=>p.coinId===coinId);
    if(!profiles.some(p=>p.chainId===chainId))chainId=profiles[0].chainId;
    for(const p of profiles){const option=node('option',`${p.network} · chainId ${p.chainId}`);option.value=p.chainId;network.append(option);}
    network.value=chainId;
  }
  function render(){
    const p=sourceReviewFor(coinId,chainId);detail.replaceChildren();
    if(!p){delete root.dataset.reviewId;detail.append(node('p','선택한 토큰·체인의 저장 소스 검토가 없습니다.'));return;}
    root.dataset.reviewId=p.id;
    detail.append(node('h3',`${p.symbol} · ${p.network}`));
    const identity=node('dl',undefined,'source-review-identity');
    for(const [label,value]of [['chainId',p.chainId],['컨트랙트',p.address],['소스 검토 기준일',p.reviewedAt],['배포 전체 연결',`미확인 (${p.deploymentBinding})`]])identity.append(node('dt',label),node('dd',value));
    detail.append(identity);
    const grid=node('div',undefined,'source-review-columns');
    for(const [title,items]of [['전송·승인·발행 조건',p.functions],['발행사 제어·권한 조건',p.authorities]]){const section=node('section'),list=node('ul');for(const text of items)list.append(node('li',text));section.append(node('h4',title),list);grid.append(section);}
    detail.append(grid,node('h4','저장 관측과 소스 연결'),node('p',p.observation),node('p',p.bindingDetail,'source-review-binding'));
    const limits=node('ul');for(const text of p.limitations)limits.append(node('li',text));detail.append(node('h4','검토 한계'),limits);
    const link=node('a','검토 근거·제한 발췌 보기 →');link.href=`/source-review-notes.html#${p.id}`;detail.append(link);
  }
  coin.addEventListener('change',()=>{coinId=coin.value;networks();render();});
  network.addEventListener('change',()=>{chainId=network.value;render();});
  networks();render();
}
for(const root of document.querySelectorAll('[data-source-review]'))initializeSourceReview(root);
