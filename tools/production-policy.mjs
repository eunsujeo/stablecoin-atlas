// Separate publication policy. A newly added preview route is private by default.
export const publicAssets=new Set([
  '/browser-json.js','/browser-idb.js','/browser-cache.js','/browser-data.js','/browser-cache-ui.js',
  '/','/index.html','/legacy.html','/production.js','/styles.css','/loading.css','/loading.js',
  '/asset-review-model.js','/asset-review-store.js','/network-usage-model.js',
  '/source-review.js','/source-review-data.js','/source-review-top10-data.js','/source-review.css','/source-review-notes.html',
  '/overview.js','/overview-model.js','/overview-market-model.js','/overview-preferences.js',
  '/market-view.js','/market-model.js','/market-chart.js','/token-profile.js','/token-profile-model.js',
  '/supply-overview.js','/supply-overview-model.js','/supply-history-model.js','/registration-model.js',
  '/allium-dashboard-model.js','/fx-model.js','/activity-model.js','/reviewed-supply-model.js','/reviewed-supply.js',
  '/survey-model.js','/survey.js','/geography-model.js','/geography.js','/evidence-model.js',
]);
const publicData=new Set(['/network-usage-data.json','/asset-review-data.json','/market-data.json','/registration-index.json','/activity-data.json','/reviewed-supply-data.json','/survey-data.json','/fx-data.json']);
export function allowedProductionPath(url){
  if(typeof url!=='string'||url.length>2048)return false;
  if(publicAssets.has(url)||publicData.has(url)||url==='/healthz')return true;
  return /^(?:\/|\/index\.html|\/legacy\.html|\/registration-history\.json)\?/.test(url);
}
export function validatePublicHosts(value){
  if(!Array.isArray(value)||!value.length||value.length>8||new Set(value).size!==value.length)throw Error('PUBLIC_HOSTS_REQUIRED');
  for(const host of value)if(typeof host!=='string'||host.length>253||! /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host))throw Error('PUBLIC_HOST_INVALID');
  return new Set(value);
}
export function productionDocument(bytes){
  let html=bytes.toString('utf8');
  // These exact markers deliberately fail closed if the preview layout changes.
  const cut=(start,end,consume=false)=>{const a=html.indexOf(start),b=html.indexOf(end,a);if(a<0||b<0)throw Error('PUBLIC_TEMPLATE_CHANGED');html=html.slice(0,a)+html.slice(b+(consume?end.length:0));};
  for(const part of ['assets','nav','screen'])cut(`<!-- local-contract-${part}:start -->`,`<!-- local-contract-${part}:end -->`,true);
  cut('    <div id="market-screen"','  </main>');
  cut('      <details id="overview-read-history"','\n      </section>');
  cut('      <section id="overview-geography"','      </section>',true);
  html=html.replace(/<div id="reports-screen"[^\n]*\n/,'');
  html=html.replace('src="/app.js"','src="/production.js"').replace('<script type="module" src="/evidence.js"></script>','');
  html=html.replace('<html lang="ko"','<html data-deployment="production" lang="ko"');
  html=html.replace(/<p id="evidence-status"[^\n]*\n/,'').replace('<div class="evidence-metrics" id="evidence-metrics"></div>','');
  html=html.replace('<button id="evidence-reload" class="quiet-button">근거 다시 읽기 ↻</button>','');
  html=html.replace('  </main>','<button id="theme-toggle" hidden></button>\n  </main>').replace('ATLAS / MOCK DETAIL','ATLAS / DETAIL');
  return Buffer.from(html);
}
