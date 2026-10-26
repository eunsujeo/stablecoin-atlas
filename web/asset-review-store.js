import {fetchJSON} from './browser-json.js';
import {validateAssetReview,assetReviewByteLimit} from './asset-review-model.js';
import {beginLoading} from './loading.js';
let pending;
// Both screens share one exact response, including its snapshot ID and feature states.
export function readAssetReview(){
 return pending??=(async()=>{
  return validateAssetReview(await fetchJSON('/asset-review-data.json',{cache:'no-store',limit:assetReviewByteLimit,timeoutMs:15000}));
 })();
}
export function mountAssetReview(root,render,{target=root}={}){
 const loading=document.createElement('div');loading.className='panel';
 const message=document.createElement('p');message.textContent='자산 검토 자료를 불러오는 중입니다.';message.setAttribute('role','status');
 const progress=document.createElement('progress');progress.style.width='100%';progress.setAttribute('aria-label','자산 검토 자료 불러오기');
 const skeleton=document.createElement('div');loading.append(message,progress,skeleton);target.replaceChildren(loading);
 const finish=beginLoading(root,{targets:[[skeleton,'rows']]});
 return readAssetReview().then(snapshot=>{render(snapshot);root.dataset.snapshotId=snapshot.id;root.dataset.reviewState='ready';}).catch(()=>{
  const error=document.createElement('p');error.className='semantic-note';error.setAttribute('role','alert');error.textContent='자산 검토 자료를 읽지 못했습니다. 연결을 확인하고 새로고침하세요.';target.replaceChildren(error);root.dataset.reviewState='error';
 }).finally(finish);
}
