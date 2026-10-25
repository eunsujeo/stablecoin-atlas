// Production has no mock loader and never requests the private evidence store.
const $=s=>document.querySelector(s);
const theme=()=>{const mode=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=mode;try{localStorage.setItem('atlas-theme',mode);}catch{}};
let saved;try{saved=localStorage.getItem('atlas-theme');}catch{}
document.documentElement.dataset.theme=saved==='light'?'light':'dark';
$('#theme-toggle').addEventListener('click',theme);
$('#evidence-theme').addEventListener('click',theme);
const themeLabel=()=>{$('#evidence-theme').textContent=document.documentElement.dataset.theme==='light'?'☾ 다크':'☀ 라이트';};
new MutationObserver(themeLabel).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});themeLabel();
$('#close-dialog').addEventListener('click',()=>$('#detail-dialog').close());
function navigate(){
  const screen=['overview','assets','live'].includes(location.hash.slice(1))?location.hash.slice(1):'overview';
  for(const id of ['overview','live'])$(`#${id}-screen`).hidden=id!==screen;
  $('#evidence-workspace > .evidence-notice').textContent='저장 소스에서 확인한 기능·권한 조건을 기준으로 정리한 자산 프로필입니다.';
  $('#evidence-workspace').hidden=screen!=='assets';$('#assets-screen').hidden=screen!=='assets';
  for(const link of document.querySelectorAll('[data-screen]')){link.classList.toggle('active',link.dataset.screen===screen);link.setAttribute('aria-current',link.dataset.screen===screen?'page':'false');}
  document.dispatchEvent(new Event('atlas:navigate'));
}
window.addEventListener('hashchange',navigate);navigate();
